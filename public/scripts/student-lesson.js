/**
 * student-lesson.js
 * Controller for student lesson activities.
 * Connects LessonEngine to WindowManager events and student UI, and follows
 * Teacher Control over the local (same-browser only) BroadcastChannel sync
 * channel. Handles target highlighting, interaction protection, action
 * validation, quiz steps, step progression, and delivery-mode navigation.
 */

import { LessonEngine } from './lesson-engine.js';
import { SimulatorHighlight } from './simulator-highlight.js';
import { targetControlToControlKey, getSimulatorControlElement, getControlLabel } from './simulator-controls.js';
import { LocalLessonChannel, LOCAL_LESSON_COMMANDS, DELIVERY_MODES } from './local-lesson-channel.js';
import { MinimizeDemonstration } from './minimize-demonstration.js';

export class StudentLesson {
  /**
   * @param {Object} options
   * @param {Object} options.skill - Skill object from catalog
   * @param {Object} options.windowManager - Instance of WindowManager
   * @param {boolean} options.isPreview - Whether opened via the teacher's "Open Student Practice Preview" link
   */
  constructor({ skill, windowManager, isPreview = false }) {
    this.skill = skill;
    this.windowManager = windowManager;
    this.isPreview = isPreview;

    this.engine = new LessonEngine(skill);
    this.highlight = new SimulatorHighlight();
    this.channel = new LocalLessonChannel();
    this.demo = null;

    // Delivery mode state - defaults to teacher-led every time a lesson
    // starts, and is kept in a shape that can later be sourced from shared
    // classroom state instead of BroadcastChannel.
    this.deliveryMode = DELIVERY_MODES.TEACHER_LED;
    this.connectedToTeacher = false;
    this.teacherStepIndex = this.engine.getCurrentStepIndex();
    this.teacherStepId = this.engine.getCurrentStep()?.id || null;

    // Challenge state tracking
    this.challengeSequence = [];

    // Bind event handlers
    this.handleWindowEvent = this.handleWindowEvent.bind(this);
    this.handleControlAttempt = this.handleControlAttempt.bind(this);
    this.handleEngineEvent = this.handleEngineEvent.bind(this);
    this.handleChannelMessage = this.handleChannelMessage.bind(this);

    // DOM Element References
    this.titleEl = document.getElementById('instruction-card-title');
    this.bodyEl = document.getElementById('instruction-card-body');
    this.badgeEl = document.getElementById('preview-badge');
    this.stepBadgeEl = document.getElementById('instruction-step-badge');
    this.panelEl = document.getElementById('instruction-panel');
    this.modeBarEl = document.getElementById('student-mode-bar');
    this.demoCaptionEl = null;

    // Create live region for accessibility feedback if not present
    this.ensureLiveRegion();
  }

  ensureLiveRegion() {
    let liveEl = document.getElementById('lesson-live-region');
    if (!liveEl) {
      liveEl = document.createElement('div');
      liveEl.id = 'lesson-live-region';
      liveEl.setAttribute('aria-live', 'polite');
      liveEl.setAttribute('aria-atomic', 'true');
      liveEl.className = 'sr-only';
      liveEl.style.position = 'absolute';
      liveEl.style.width = '1px';
      liveEl.style.height = '1px';
      liveEl.style.overflow = 'hidden';
      document.body.appendChild(liveEl);
    }
    this.liveEl = liveEl;
  }

  announce(text) {
    if (this.liveEl) {
      this.liveEl.textContent = text;
    }
  }

  /**
   * Initialize student lesson controller
   */
  init() {
    // Add WindowManager event listeners
    document.addEventListener('window:minimized', this.handleWindowEvent);
    document.addEventListener('window:maximized', this.handleWindowEvent);
    document.addEventListener('window:restored', this.handleWindowEvent);
    document.addEventListener('window:taskbar-restored', this.handleWindowEvent);
    document.addEventListener('window:closed', this.handleWindowEvent);
    document.addEventListener('window:opened', this.handleWindowEvent);
    document.addEventListener('window:control-attempt', this.handleControlAttempt);

    // Listen to LessonEngine events
    this.engine.addListener(this.handleEngineEvent);

    // Shared "Watch It Work" demonstration controller, reused identically by
    // Classroom Presentation and Teacher Lesson Control's preview.
    this.demo = new MinimizeDemonstration({
      windowEl: this.windowManager.windowEl,
      minimizeBtnEl: this.windowManager.btnMinimize,
      taskbarBtnEl: this.windowManager.taskbarBtn,
      cursorLayer: document.body,
      onCaption: (text) => this.setDemoCaption(text)
    });

    // Join the local (same-browser only) Teacher Control sync channel
    if (this.modeBarEl) {
      this.modeBarEl.style.display = 'flex';
    }
    if (this.channel.isAvailable()) {
      this.channel.subscribe(this.handleChannelMessage);
      this.channel.publish({ command: LOCAL_LESSON_COMMANDS.FOLLOWER_READY, skillId: this.skill.id });
    }

    // Apply initial step (teacher-led by default; nav hidden until independent)
    this.setupStep(this.engine.getCurrentStep());
    this.renderModeBar();
  }

  /**
   * Handle incoming local sync messages from Teacher Control.
   */
  handleChannelMessage(data) {
    if (!data || data.skillId !== this.skill.id) return;

    switch (data.command) {
      case LOCAL_LESSON_COMMANDS.TEACHER_STATE:
      case LOCAL_LESSON_COMMANDS.SET_STEP: {
        this.connectedToTeacher = true;

        if (typeof data.deliveryMode === 'string') {
          this.applyDeliveryMode(data.deliveryMode, { silent: true });
        }

        const idx = this.skill.lessonSections.findIndex(s => s.id === data.stepId);
        const resolvedIndex = idx !== -1 ? idx : (typeof data.stepIndex === 'number' ? data.stepIndex : null);
        if (resolvedIndex !== null && this.skill.lessonSections[resolvedIndex]) {
          this.teacherStepIndex = resolvedIndex;
          this.teacherStepId = this.skill.lessonSections[resolvedIndex].id;

          // Teacher-led: the student always follows. Independent: the
          // teacher's step is only remembered, never forced onto the student.
          if (this.deliveryMode === DELIVERY_MODES.TEACHER_LED) {
            this.engine.goToStep(resolvedIndex);
          }
        }
        this.renderModeBar();
        break;
      }

      case LOCAL_LESSON_COMMANDS.SET_DELIVERY_MODE:
        this.connectedToTeacher = true;
        this.applyDeliveryMode(data.deliveryMode);
        break;

      case LOCAL_LESSON_COMMANDS.REPLAY_DEMONSTRATION: {
        const step = this.engine.getCurrentStep();
        if (this.deliveryMode === DELIVERY_MODES.TEACHER_LED && step && step.id === 'step-3-watch-it-work') {
          this.demo.play();
        }
        break;
      }

      case LOCAL_LESSON_COMMANDS.RESET_LESSON:
        this.deliveryMode = DELIVERY_MODES.TEACHER_LED;
        this.engine.resetLesson();
        this.renderModeBar();
        break;

      default:
        break;
    }
  }

  /**
   * Apply an incoming delivery-mode change.
   * @param {string} mode - DELIVERY_MODES.TEACHER_LED | DELIVERY_MODES.INDEPENDENT
   * @param {Object} [opts]
   * @param {boolean} [opts.silent] - skip re-rendering the mode bar (caller will)
   */
  applyDeliveryMode(mode, opts = {}) {
    if (mode !== DELIVERY_MODES.TEACHER_LED && mode !== DELIVERY_MODES.INDEPENDENT) return;
    const changingToTeacherLed = this.deliveryMode !== mode && mode === DELIVERY_MODES.TEACHER_LED;
    this.deliveryMode = mode;

    // Turning Independent Mode off must immediately return Student Practice
    // to the teacher's current step.
    if (changingToTeacherLed) {
      this.engine.goToStep(this.teacherStepIndex);
    }

    if (!opts.silent) {
      this.renderModeBar();
    }
  }

  /**
   * Render/update the Student Practice mode status bar: mode label, sync
   * status, and (independent mode only) Previous/Next navigation.
   */
  renderModeBar() {
    if (!this.modeBarEl) return;

    const idx = this.engine.getCurrentStepIndex();
    const total = this.engine.getTotalSteps();
    const canAdvance = this.engine.canAdvance();
    const isIndependent = this.deliveryMode === DELIVERY_MODES.INDEPENDENT;

    const modeLabel = isIndependent ? 'Independent Practice' : 'Teacher-Led Lesson';
    const modeBadgeClass = isIndependent ? 'student-mode-badge is-independent' : 'student-mode-badge';

    let syncStatus;
    if (!this.channel.isAvailable()) {
      syncStatus = 'Local sync unavailable in this browser.';
    } else if (!this.connectedToTeacher) {
      syncStatus = 'Waiting for Teacher Control to open\u2026';
    } else {
      syncStatus = isIndependent ? 'Practicing independently.' : 'Following Teacher Control.';
    }

    // Teacher-led: Previous/Next are completely absent (not just hidden),
    // so they cannot take focus or a viewport row.
    const navHtml = isIndependent
      ? `
        <button type="button" id="student-nav-prev" class="student-mode-nav-btn" ${idx === 0 ? 'disabled' : ''}>
          &larr; Previous
        </button>
        <button type="button" id="student-nav-next" class="student-mode-nav-btn" ${(!canAdvance || idx === total - 1) ? 'disabled' : ''}>
          Next &rarr;
        </button>
      `
      : '';

    const exitHtml = this.isPreview
      ? `<a href="teacher.html?skill=${encodeURIComponent(this.skill.id)}&mode=present" class="student-mode-nav-btn">Exit Preview</a>`
      : '';

    this.modeBarEl.innerHTML = `
      <div class="student-mode-bar-left">
        <span class="${modeBadgeClass}">${modeLabel}</span>
        <span class="student-mode-sync-status">${syncStatus}</span>
      </div>
      <div class="student-mode-bar-right">
        ${navHtml}
        ${exitHtml}
      </div>
    `;

    const prevBtn = document.getElementById('student-nav-prev');
    const nextBtn = document.getElementById('student-nav-next');
    if (prevBtn) prevBtn.onclick = () => this.engine.previousStep();
    if (nextBtn) nextBtn.onclick = () => this.engine.nextStep();
  }

  /**
   * Handle LessonEngine state changes
   */
  handleEngineEvent(eventName) {
    if (eventName === 'lesson:step-changed') {
      this.setupStep(this.engine.getCurrentStep());
      this.renderModeBar();
    } else if (eventName === 'lesson:step-completed') {
      this.renderModeBar();
    }
  }

  /**
   * Directly set the instruction panel's collapsed (single-line) state.
   * Called proactively during step setup (so geometry is correct before the
   * window is centered) and reactively from window events.
   */
  setPanelCollapsed(collapsed) {
    if (!this.panelEl) return;
    this.panelEl.classList.toggle('is-collapsed', !!collapsed);
  }

  /**
   * Cleans up highlights, timers, and feedback before setting up a new step.
   * Prevents stale demonstration timers/cursors or late events from a
   * previous step from bleeding into the next one.
   */
  cleanupCurrentStep() {
    // Remove target-control highlight overlay (ring + label)
    this.highlight.clear();

    // Cancel any running demonstration (timers, cursor element, visual state)
    if (this.demo) {
      this.demo.stop();
    }
    this.demoCaptionEl = null;

    // Remove feedback banners
    document.querySelectorAll('.feedback-banner').forEach(el => el.remove());

    // Reset challenge tracking
    this.challengeSequence = [];
  }

  /**
   * Configure window manager state and UI for active step
   */
  setupStep(step) {
    if (!step) return;

    this.cleanupCurrentStep();

    // 1. Configure interaction protection
    const allowInteraction = step.allowStudentInteraction !== false;
    let allowedControls = null;

    if (allowInteraction) {
      if (step.targetControl === 'btn-minimize') {
        allowedControls = ['btn-minimize'];
      } else if (step.targetControl === 'taskbar-chrome-btn') {
        allowedControls = ['taskbar-chrome-btn'];
      } else if (step.targetControl === 'sequence') {
        allowedControls = ['btn-minimize', 'taskbar-chrome-btn'];
      }
    }

    this.windowManager.setInteractionEnabled(allowInteraction, allowedControls);

    // 2. Set initial window state for step. The instruction panel's
    // collapsed state is applied BEFORE resetToDefault()/minimize() so the
    // workspace has its final height when the window is centered.
    const shouldStartMinimized = step.id === 'step-5-guided-restore';
    this.setPanelCollapsed(shouldStartMinimized);
    this.windowManager.resetToDefault();
    if (shouldStartMinimized) {
      this.windowManager.minimize();
    }

    // 3. Target highlighting - uses stable data-simulator-control attributes,
    // not fragile ids/classes, and renders as a non-clipping fixed overlay.
    const controlKey = targetControlToControlKey(step.targetControl);
    if (controlKey) {
      const targetEl = getSimulatorControlElement(controlKey);
      if (targetEl) {
        this.highlight.show(targetEl, getControlLabel(controlKey));
      }
    }

    // 4. Render Student Instruction Card content
    this.renderInstructionCard(step);

    // 5. Step 3: play the same reusable cursor demonstration used by
    // Classroom Presentation and Teacher Lesson Control.
    if (step.id === 'step-3-watch-it-work') {
      this.demo.play();
    }

    this.announce(`Step ${this.engine.getCurrentStepIndex() + 1}: ${step.studentTitle}. ${step.studentInstruction}`);
  }

  setDemoCaption(text) {
    if (this.demoCaptionEl) {
      this.demoCaptionEl.textContent = text;
    }
  }

  /**
   * Render student instruction card markup for current step
   */
  renderInstructionCard(step) {
    const idx = this.engine.getCurrentStepIndex();
    const total = this.engine.getTotalSteps();

    if (this.titleEl) {
      this.titleEl.textContent = `${this.skill.iconText ? this.skill.iconText + ' ' : ''}${step.studentTitle}`;
    }

    if (this.stepBadgeEl) {
      this.stepBadgeEl.style.display = 'inline-block';
      this.stepBadgeEl.textContent = `Step ${idx + 1} of ${total}`;
    }

    if (this.badgeEl) {
      this.badgeEl.style.display = this.isPreview ? 'inline-block' : 'none';
      this.badgeEl.textContent = 'Practice Preview';
    }

    if (!this.bodyEl) return;

    let contentHtml = `
      <p class="instruction-body-text" id="instruction-body-text">
        ${step.studentInstruction}
      </p>
    `;

    // Special quiz rendering for Step 7
    if (step.studentMode === 'quiz') {
      contentHtml += `
        <div class="quiz-container">
          <button type="button" id="quiz-btn-minimize" class="quiz-option-btn">
            <span style="font-size: 1.4rem;">➖</span>
            <span>Minimize</span>
          </button>
          <button type="button" id="quiz-btn-close" class="quiz-option-btn">
            <span style="font-size: 1.4rem;">❌</span>
            <span>Close</span>
          </button>
        </div>
      `;
    }

    // Completion state / summary rendering for Step 8
    if (step.id === 'step-8-lesson-complete') {
      const isIndependent = this.deliveryMode === DELIVERY_MODES.INDEPENDENT;
      const actionsHtml = isIndependent
        ? `
          <div class="celebration-actions">
            <a href="teacher.html" class="return-hub-btn">&larr; Return to Skill Hub</a>
            <button type="button" id="restart-lesson-btn" class="return-hub-btn restart-lesson-btn">Restart Lesson</button>
          </div>
        `
        : `<p class="celebration-waiting-note">Waiting for your teacher to continue the class\u2026</p>`;

      contentHtml += `
        <div class="celebration-banner">
          <h3>🎉 Lesson Complete!</h3>
          <p>You mastered the <strong>Minimize</strong> button!</p>
          ${actionsHtml}
        </div>
      `;
    }

    this.bodyEl.innerHTML = contentHtml;
    this.demoCaptionEl = step.id === 'step-3-watch-it-work' ? document.getElementById('instruction-body-text') : null;

    // Attach Step 7 Quiz handlers if present
    if (step.studentMode === 'quiz') {
      const btnMin = document.getElementById('quiz-btn-minimize');
      const btnClose = document.getElementById('quiz-btn-close');

      if (btnMin) {
        btnMin.onclick = () => {
          btnMin.classList.add('is-correct');
          if (btnClose) btnClose.classList.remove('is-incorrect');
          this.showFeedback('success', step.completionMessage);
          this.engine.setStepCompleted(step.id, true);
          this.renderModeBar();
        };
      }

      if (btnClose) {
        btnClose.onclick = () => {
          btnClose.classList.add('is-incorrect');
          this.showFeedback('try-again', 'Close shuts the window completely. Try Minimize!');
        };
      }
    }

    // Restart Lesson (independent mode only, Step 8)
    const restartBtn = document.getElementById('restart-lesson-btn');
    if (restartBtn) {
      restartBtn.onclick = () => this.engine.resetLesson();
    }

    // Auto-complete presentation observation steps that require no student action
    if (step.allowStudentInteraction === false && step.id !== 'step-8-lesson-complete') {
      this.engine.setStepCompleted(step.id, true);
    }
  }

  /**
   * Display feedback banner inside instruction card
   * @param {'success'|'try-again'} type 
   * @param {string} message 
   */
  showFeedback(type, message) {
    // Remove existing feedback
    document.querySelectorAll('.feedback-banner').forEach(el => el.remove());

    const banner = document.createElement('div');
    banner.className = `feedback-banner ${type}`;
    banner.innerHTML = `
      <span>${type === 'success' ? '✅' : '💡'}</span>
      <span>${message}</span>
    `;

    if (this.bodyEl) {
      this.bodyEl.appendChild(banner);
    }

    this.announce(message);
  }

  /**
   * Handle WindowManager event notifications
   */
  handleWindowEvent(e) {
    const eventType = e.type;

    // Keep the instruction panel collapsed while Chrome is minimized so the
    // taskbar and its highlighted button stay visually dominant.
    if (eventType === 'window:minimized') {
      this.setPanelCollapsed(true);
    } else if (eventType === 'window:restored' || eventType === 'window:taskbar-restored' || eventType === 'window:opened') {
      this.setPanelCollapsed(false);
    }

    const step = this.engine.getCurrentStep();
    if (!step) return;

    // Step 2: Find the Button (identify mode)
    if (step.id === 'step-2-find-button' && eventType === 'window:minimized') {
      // In step 2, clicking Minimize identifies the button. Immediately restore window so it doesn't stay minimized.
      this.windowManager.restore();
      this.showFeedback('success', step.completionMessage);
      this.engine.setStepCompleted(step.id, true);
      return;
    }

    // Step 4: Guided Practice - Minimize
    if (step.id === 'step-4-guided-minimize' && eventType === 'window:minimized') {
      // The Minimize button just vanished behind the minimized window -
      // remove its highlight so no stray ring is left where it used to be.
      this.highlight.clear();
      this.showFeedback('success', step.completionMessage);
      this.engine.setStepCompleted(step.id, true);
      return;
    }

    // Step 5: Guided Practice - Bring It Back
    if (step.id === 'step-5-guided-restore' && eventType === 'window:taskbar-restored') {
      this.showFeedback('success', step.completionMessage);
      this.engine.setStepCompleted(step.id, true);
      return;
    }

    // Step 6: Independent Challenge (Minimize then Restore sequence)
    if (step.id === 'step-6-independent-challenge') {
      if (eventType === 'window:minimized' && this.challengeSequence.length === 0) {
        this.challengeSequence.push('minimized');
        this.showFeedback('success', 'Great! Now click the Chrome taskbar button to bring it back.');
      } else if (eventType === 'window:taskbar-restored' && this.challengeSequence.includes('minimized')) {
        this.challengeSequence.push('restored');
        this.showFeedback('success', step.completionMessage);
        this.engine.setStepCompleted(step.id, true);
      }
    }
  }

  /**
   * Handle control attempt events for feedback on incorrect control clicks
   */
  handleControlAttempt(e) {
    const { control, allowed } = e.detail || {};
    const step = this.engine.getCurrentStep();
    if (!step) return;

    if (!allowed && step.allowStudentInteraction !== false) {
      this.showFeedback('try-again', 'That button does something different. Try again!');
    }
  }
}
