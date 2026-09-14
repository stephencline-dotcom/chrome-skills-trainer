const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

module.exports = function registerClassroom(app, express) {
  const catalog = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../public/data/skills.json'), 'utf8'
  ));
  const skills = Array.isArray(catalog) ? catalog : catalog.skills;
  const sessions = new Map();
  const bootId = crypto.randomUUID();

  const state = {
    bootId,
    revision: 0,
    teacherPresent: false,
    skillId: null,
    stepId: null,
    stepIndex: 0,
    deliveryMode: 'teacher-led',
    freezeScreenArmed: false,
    freezeCycle: 0,
    freezeUnlockVersion: 0,
    replayVersion: 0,
    resetVersion: 0
  };

  function changed() {
    state.revision += 1;
  }

  function releaseClass() {
    state.teacherPresent = false;
    state.freezeScreenArmed = false;
    state.freezeUnlockVersion += 1;
    changed();
  }

  function cleanSessions() {
    const now = Date.now();
    for (const [token, expires] of sessions) {
      if (expires <= now) sessions.delete(token);
    }
    if (!sessions.size && state.teacherPresent) releaseClass();
  }

  function authorized(req) {
    cleanSessions();
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    return sessions.has(token);
  }

  function teacherOnly(req, res, next) {
    if (!authorized(req)) {
      return res.status(401).json({ error: 'Teacher sign-in required.' });
    }
    next();
  }

  const teacherPasswordFile = path.join(
    __dirname,
    '../.teacher-password'
  );

  function getTeacherPassword() {
    if (process.env.TEACHER_PASSWORD) {
      return process.env.TEACHER_PASSWORD;
    }

    try {
      return fs
        .readFileSync(teacherPasswordFile, 'utf8')
        .replace(/\\r?\\n$/, '');
    } catch {
      return '';
    }
  }

  function passwordMatches(value) {
    const expected = getTeacherPassword();
    if (!expected || typeof value !== 'string') return false;
    const hash = text => crypto.createHash('sha256').update(text).digest();
    return crypto.timingSafeEqual(hash(value), hash(expected));
  }

  // Shared throttle for failed password attempts; no IP tracking required.
  let failures = 0;
  let retryAfter = 0;

  function checkPassword(req, res) {
    if (!getTeacherPassword()) {
      res.status(503).json({ error: 'Teacher password is not configured.' });
      return false;
    }
    if (Date.now() < retryAfter) {
      res.status(429).json({ error: 'Please wait a minute before trying again.' });
      return false;
    }
    if (!passwordMatches(req.body?.password)) {
      failures += 1;
      if (failures >= 10) {
        failures = 0;
        retryAfter = Date.now() + 60000;
      }
      res.status(401).json({ error: 'Incorrect teacher password.' });
      return false;
    }
    failures = 0;
    return true;
  }

  function resolveStep(body) {
    const skillId = body.skillId === undefined ? state.skillId : body.skillId;
    const skill = skills.find(item =>
      item.id === skillId && item.hasCompleteLesson
    );
    if (!skill) throw new Error('Choose a completed lesson.');

    const index = body.stepIndex === undefined
      ? (skillId === state.skillId ? state.stepIndex : 0)
      : body.stepIndex;

    if (!Number.isInteger(index) || !skill.lessonSections[index]) {
      throw new Error('Invalid lesson step.');
    }
    return {
      skillId,
      stepIndex: index,
      stepId: skill.lessonSections[index].id
    };
  }

  app.use('/api', express.json({ limit: '8kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/classroom-state', (req, res) => {
    cleanSessions();
    res.json(state);
  });

  app.get('/api/teacher-session', (req, res) => {
    res.json({ authenticated: authorized(req) });
  });

  app.post('/api/teacher-login', (req, res) => {
    if (!checkPassword(req, res)) return;
    cleanSessions();
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);

    if (!state.teacherPresent) {
      state.teacherPresent = true;
      changed();
    }
    res.json({ success: true, token, state });
  });

  app.post('/api/teacher-logout', teacherOnly, (req, res) => {
    // Release everyone before invalidating teacher sessions.
    releaseClass();
    sessions.clear();
    res.json({ success: true, state });
  });

  app.put('/api/classroom-state', teacherOnly, (req, res) => {
    const body = req.body || {};
    const allowedKeys = [
      'skillId', 'stepIndex', 'deliveryMode',
      'freezeScreenArmed', 'unlockAllFrozenStudents',
      'replayDemonstration', 'resetLesson'
    ];

    if (Object.keys(body).some(key => !allowedKeys.includes(key))) {
      return res.status(400).json({ error: 'Unknown classroom setting.' });
    }

    try {
      const next = { ...state };

      if (body.skillId !== undefined || body.stepIndex !== undefined) {
        Object.assign(next, resolveStep(body));
      }

      if (body.deliveryMode !== undefined) {
        if (!['teacher-led', 'independent'].includes(body.deliveryMode)) {
          throw new Error('Invalid delivery mode.');
        }
        next.deliveryMode = body.deliveryMode;
      }

      for (const key of [
        'freezeScreenArmed', 'unlockAllFrozenStudents',
        'replayDemonstration', 'resetLesson'
      ]) {
        if (body[key] !== undefined && typeof body[key] !== 'boolean') {
          throw new Error('Invalid classroom action.');
        }
      }

      if (body.freezeScreenArmed !== undefined) {
        if (body.freezeScreenArmed && !state.freezeScreenArmed) {
          next.freezeCycle += 1;
        }
        next.freezeScreenArmed = body.freezeScreenArmed;
      }

      // Release Unlocked only disarms. Unlock All also clears overlays.
      if (body.unlockAllFrozenStudents) {
        next.freezeScreenArmed = false;
        next.freezeUnlockVersion += 1;
      }

      if (body.resetLesson) {
        Object.assign(next, resolveStep({
          skillId: next.skillId, stepIndex: 0
        }));
        next.deliveryMode = 'teacher-led';
        next.resetVersion += 1;
      }

      if (body.replayDemonstration) {
        const skill = skills.find(item => item.id === next.skillId);
        if (!skill?.lessonSections[next.stepIndex]?.demonstration) {
          throw new Error('This step has no demonstration.');
        }
        next.replayVersion += 1;
      }

      const hasChanges = Object.keys(next).some(key => next[key] !== state[key]);
      if (hasChanges) {
        Object.assign(state, next);
        changed();
      }
      res.json(state);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/release-freeze-screen', (req, res) => {
    if (!checkPassword(req, res)) return;
    res.json({
      success: true,
      bootId,
      freezeCycle: state.freezeCycle
    });
  });

  app.use('/api', (error, req, res, next) => {
    res.status(error.status === 413 ? 413 : 400)
      .json({ error: 'Invalid classroom request.' });
  });
};
