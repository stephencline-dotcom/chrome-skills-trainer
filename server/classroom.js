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

  // Simple in-memory storage for the one Chrome assessment.
  // This intentionally resets whenever the server restarts or redeploys.
  const assessmentClasses = new Map();
  const assessmentStudentSessions = new Map();

  let nextAssessmentClassId = 1;
  let nextAssessmentStudentId = 1;

  function cleanDisplayName(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function normalizeStudentName(value) {
    return cleanDisplayName(value).toLowerCase();
  }

  function generateAssessmentClassCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = '';

      for (let i = 0; i < 5; i += 1) {
        code += alphabet[crypto.randomInt(0, alphabet.length)];
      }

      const alreadyUsed = [...assessmentClasses.values()]
        .some(item => item.code === code);

      if (!alreadyUsed) return code;
    }

    throw new Error('Unable to create a unique class code.');
  }

  function getAssessmentClass(id) {
    return assessmentClasses.get(Number(id)) || null;
  }

  function serializeAssessmentClass(item) {
    return {
      id: item.id,
      name: item.name,
      code: item.code,
      students: [...item.students.values()]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(student => ({
          id: student.id,
          name: student.name,
          score: student.score,
          completedAt: student.completedAt
        }))
    };
  }
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

  // ------------------------------------------------------------
  // Quick Chrome Assessment: simple class roster + one score
  // ------------------------------------------------------------

  app.get('/api/assessment-classes', teacherOnly, (req, res) => {
    res.json({
      classes: [...assessmentClasses.values()]
        .map(serializeAssessmentClass)
    });
  });

  app.post('/api/assessment-classes', teacherOnly, (req, res) => {
    const name = cleanDisplayName(req.body?.name);

    if (!name || name.length > 80) {
      return res.status(400).json({
        error: 'Enter a class name.'
      });
    }

    const item = {
      id: nextAssessmentClassId++,
      name,
      code: generateAssessmentClassCode(),
      students: new Map()
    };

    assessmentClasses.set(item.id, item);

    res.status(201).json(
      serializeAssessmentClass(item)
    );
  });

  app.put('/api/assessment-classes/:id', teacherOnly, (req, res) => {
    const item = getAssessmentClass(req.params.id);

    if (!item) {
      return res.status(404).json({
        error: 'Class not found.'
      });
    }

    const name = cleanDisplayName(req.body?.name);

    if (!name || name.length > 80) {
      return res.status(400).json({
        error: 'Enter a class name.'
      });
    }

    item.name = name;

    res.json(
      serializeAssessmentClass(item)
    );
  });

  app.delete(
    '/api/assessment-classes/:id',
    teacherOnly,
    (req, res) => {
      const item =
        getAssessmentClass(req.params.id);

      if (!item) {
        return res.status(404).json({
          error: 'Class not found.'
        });
      }

      assessmentClasses.delete(item.id);

      for (
        const [token, session]
        of assessmentStudentSessions
      ) {
        if (session.classId === item.id) {
          assessmentStudentSessions.delete(token);
        }
      }

      res.json({
        success: true
      });
    }
  );

  app.put(
    '/api/assessment-classes/:classId/students/:studentId',
    teacherOnly,
    (req, res) => {
      const item =
        getAssessmentClass(
          req.params.classId
        );

      if (!item) {
        return res.status(404).json({
          error: 'Class not found.'
        });
      }

      const studentId =
        Number(req.params.studentId);

      const student =
        item.students.get(studentId);

      if (!student) {
        return res.status(404).json({
          error: 'Student not found.'
        });
      }

      const name =
        cleanDisplayName(
          req.body?.name
        );

      const nameKey =
        normalizeStudentName(name);

      if (
        !name ||
        !nameKey ||
        name.length > 80
      ) {
        return res.status(400).json({
          error: 'Enter a student name.'
        });
      }

      const duplicate =
        [...item.students.values()]
          .find(
            entry =>
              entry.id !== student.id &&
              entry.nameKey === nameKey
          );

      if (duplicate) {
        return res.status(400).json({
          error:
            'A student with that name is already in this class.'
        });
      }

      student.name = name;
      student.nameKey = nameKey;

      for (
        const [token, session]
        of assessmentStudentSessions
      ) {
        if (
          session.classId === item.id &&
          session.studentId === student.id
        ) {
          assessmentStudentSessions.delete(token);
        }
      }

      res.json(
        serializeAssessmentClass(item)
      );
    }
  );

  app.delete(
    '/api/assessment-classes/:classId/students/:studentId',
    teacherOnly,
    (req, res) => {
      const item =
        getAssessmentClass(
          req.params.classId
        );

      if (!item) {
        return res.status(404).json({
          error: 'Class not found.'
        });
      }

      const studentId =
        Number(req.params.studentId);

      if (!item.students.has(studentId)) {
        return res.status(404).json({
          error: 'Student not found.'
        });
      }

      item.students.delete(studentId);

      for (
        const [token, session]
        of assessmentStudentSessions
      ) {
        if (
          session.classId === item.id &&
          session.studentId === studentId
        ) {
          assessmentStudentSessions.delete(token);
        }
      }

      res.json(
        serializeAssessmentClass(item)
      );
    }
  );

  app.put(
    '/api/assessment-classes/:id/roster',
    teacherOnly,
    (req, res) => {
      const item = getAssessmentClass(req.params.id);

      if (!item) {
        return res.status(404).json({
          error: 'Class not found.'
        });
      }

      if (!Array.isArray(req.body?.names)) {
        return res.status(400).json({
          error: 'Roster names are required.'
        });
      }

      const cleaned = [];
      const seen = new Set();

      for (const rawName of req.body.names) {
        const name = cleanDisplayName(rawName);
        const nameKey = normalizeStudentName(name);

        if (!name || !nameKey || name.length > 80) continue;
        if (seen.has(nameKey)) continue;

        seen.add(nameKey);
        cleaned.push({ name, nameKey });
      }

      if (cleaned.length > 100) {
        return res.status(400).json({
          error: 'A class can contain up to 100 students.'
        });
      }

      const nextStudents = new Map();

      cleaned.forEach((entry, index) => {
        const existing = [...item.students.values()]
          .find(student => student.nameKey === entry.nameKey);

        const student = existing || {
          id: nextAssessmentStudentId++,
          name: entry.name,
          nameKey: entry.nameKey,
          score: null,
          completedAt: null
        };

        student.name = entry.name;
        student.nameKey = entry.nameKey;
        student.displayOrder = index;

        nextStudents.set(student.id, student);
      });

      item.students = nextStudents;

      // Roster edits invalidate old student join sessions for this class.
      for (const [token, session] of assessmentStudentSessions) {
        if (session.classId === item.id) {
          assessmentStudentSessions.delete(token);
        }
      }

      res.json(
        serializeAssessmentClass(item)
      );
    }
  );

  app.post('/api/assessment-join', (req, res) => {
    const classCode = String(
      req.body?.classCode || ''
    )
      .trim()
      .toUpperCase();


    const studentName = cleanDisplayName(
      req.body?.name
    );

    const nameKey = normalizeStudentName(
      studentName
    );

    if (
      !studentName ||
      !nameKey ||
      studentName.length > 80
    ) {
      return res.status(400).json({
        error: 'Enter your name.'
      });
    }

    const item =
      [...assessmentClasses.values()]
        .find(
          classItem =>
            classItem.code === classCode
        );

    if (!item) {
      return res.status(404).json({
        error:
          'This class link is no longer valid. Ask your teacher for the class link.'
      });
    }

    let student = [...item.students.values()]
      .find(entry => entry.nameKey === nameKey);

    if (!student) {
      if (item.students.size >= 100) {
        return res.status(400).json({
          error: 'This class already has 100 students.'
        });
      }

      const nextDisplayOrder =
        item.students.size === 0
          ? 0
          : Math.max(
              ...[...item.students.values()]
                .map(entry => Number(entry.displayOrder) || 0)
            ) + 1;

      student = {
        id: nextAssessmentStudentId++,
        name: studentName,
        nameKey,
        score: null,
        completedAt: null,
        displayOrder: nextDisplayOrder
      };

      item.students.set(
        student.id,
        student
      );
    }

    const token = crypto
      .randomBytes(24)
      .toString('hex');

    assessmentStudentSessions.set(token, {
      classId: item.id,
      studentId: student.id,
      expiresAt: Date.now() + (6 * 60 * 60 * 1000)
    });

    res.json({
      success: true,
      token,
      className: item.name,
      studentName: student.name,
      completed: student.score !== null,
      score: student.score
    });
  });

  app.post('/api/assessment-score', (req, res) => {
    const token = String(
      req.body?.token || ''
    );

    const score = Number(
      req.body?.score
    );

    const session =
      assessmentStudentSessions.get(token);

    if (
      !session ||
      session.expiresAt <= Date.now()
    ) {
      assessmentStudentSessions.delete(token);

      return res.status(401).json({
        error: 'Student assessment session expired.'
      });
    }

    if (
      !Number.isInteger(score) ||
      score < 0 ||
      score > 10
    ) {
      return res.status(400).json({
        error: 'Invalid assessment score.'
      });
    }

    const item =
      assessmentClasses.get(session.classId);

    const student =
      item?.students.get(session.studentId);

    if (!item || !student) {
      return res.status(404).json({
        error: 'Student record not found.'
      });
    }

    // Keep the first completed score for this one-time assessment.
    if (student.score === null) {
      student.score = score;
      student.completedAt =
        new Date().toISOString();
    }

    res.json({
      success: true,
      score: student.score,
      completedAt: student.completedAt
    });
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
