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
import { MaximizeDemonstration } from './maximize-demonstration.js';

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
    const demonstrationType = this.skill.lessonSections.find(
      (step) => step.demonstration
    )?.demonstration;
    const DemonstrationClass = demonstrationType === 'maximize-cycle'
      ? MaximizeDemonstration
      : MinimizeDemonstration;

    this.demo = new DemonstrationClass({
      windowEl: this.windowManager.windowEl,
      minimizeBtnEl: this.windowManager.btnMinimize,
      maximizeBtnEl: this.windowManager.btnMaximize,
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
    if (!data) return;

    if (
      data.command === LOCAL_LESSON_COMMANDS.SET_LESSON &&
      data.skillId &&
      data.skillId !== this.skill.id
    ) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('skill', data.skillId);
      nextUrl.searchParams.set('lesson', 'active');
      window.location.replace(nextUrl);
      return;
    }

    if (data.skillId !== this.skill.id) return;

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

    this.modeBarEl.innerHTML = `
      <div class="student-mode-bar-left">
        <span class="${modeBadgeClass}">${modeLabel}</span>
        <span class="student-mode-sync-status">${syncStatus}</span>
      </div>
      <div class="student-mode-bar-right">
        ${navHtml}
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

    const shouldCollapse = !!collapsed;
    const changed = this.panelEl.classList.contains('is-collapsed') !== shouldCollapse;
    this.panelEl.classList.toggle('is-collapsed', shouldCollapse);

    if (changed && !shouldCollapse) {
      this.fitWindowToWorkspace();
    }
  }

  /**
   * Refit the restored Chrome window after instruction content changes size.
   * Runs immediately and after the short panel transition finishes.
   */
  fitWindowToWorkspace() {
    const fitWindow = () => {
      if (
        !this.windowManager.isMinimized &&
        !this.windowManager.isClosed &&
        !this.windowManager.isMaximized
      ) {
        this.windowManager.centerWindow();
        this.windowManager.applyRestoredBounds();
      }
    };

    requestAnimationFrame(fitWindow);
    window.setTimeout(fitWindow, 180);
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

    // 1. Configure interaction protection from lesson data.
    const allowInteraction = step.allowStudentInteraction !== false;
    const allowedControls = Array.isArray(step.allowedControls)
      ? step.allowedControls
      : null;

    this.windowManager.setInteractionEnabled(
      allowInteraction,
      allowedControls
    );

    // 2. Set the simulator's starting state from lesson data.
    const startState = step.startState || 'restored';
    this.setPanelCollapsed(startState === 'minimized');
    this.windowManager.resetToDefault();

    if (startState === 'minimized') {
      this.windowManager.minimize();
    } else if (startState === 'maximized') {
      this.windowManager.maximize();
    } else if (startState === 'closed') {
      this.windowManager.close();
    }

    // 3. Target highlighting - uses stable data-simulator-control attributes,
    // not fragile ids/classes, and renders as a non-clipping fixed overlay.
    const highlightTarget =
      step.highlightControl || step.targetControl;
    const controlKey =
      targetControlToControlKey(highlightTarget);
    if (controlKey) {
      const targetEl = getSimulatorControlElement(controlKey);
      if (targetEl) {
        this.highlight.show(
          targetEl,
          step.highlightLabel || getControlLabel(controlKey)
        );
      }
    }

    // 4. Render Student Instruction Card content
    this.renderInstructionCard(step);

    // 5. Step 3: play the same reusable cursor demonstration used by
    // Classroom Presentation and Teacher Lesson Control.
    if (step.demonstration === 'minimize-cycle' || step.demonstration === 'maximize-cycle') {
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

    // Render data-driven concept-check choices.
    if (step.presentationView === 'quiz' && step.quiz?.choices) {
      const choicesHtml = step.quiz.choices.map((choice) => `
        <button
          type="button"
          class="quiz-option-btn"
          data-quiz-choice="${choice.id}"
        >
          <span style="font-size: 1.4rem;">${choice.icon || ''}</span>
          <span>${choice.label}</span>
        </button>
      `).join('');

      contentHtml += `
        <div class="quiz-container">
          ${choicesHtml}
        </div>
      `;
    }

    // Data-driven completion state.
    if (step.presentationView === 'completion') {
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
          <p>You mastered the <strong>${this.skill.name}</strong> button!</p>
          ${actionsHtml}
        </div>
      `;
    }

    this.bodyEl.innerHTML = contentHtml;
    this.demoCaptionEl = step.demonstration
      ? document.getElementById('instruction-body-text')
      : null;

    // Attach data-driven quiz handlers.
    if (step.presentationView === 'quiz' && step.quiz?.choices) {
      this.bodyEl.querySelectorAll('[data-quiz-choice]').forEach((button) => {
        button.onclick = () => {
          const choice = step.quiz.choices.find(
            (item) => item.id === button.dataset.quizChoice
          );

          if (!choice) return;

          if (choice.correct) {
            this.bodyEl.querySelectorAll('[data-quiz-choice]').forEach(
              (item) => item.classList.remove('is-incorrect')
            );
            button.classList.add('is-correct');
            this.showFeedback('success', step.completionMessage);
            this.engine.setStepCompleted(step.id, true);
            this.renderModeBar();
          } else {
            button.classList.add('is-incorrect');
            this.showFeedback(
              'try-again',
              choice.feedback || 'Try another answer.'
            );
          }
        };
      });
    }

    // Restart Lesson (independent mode only, Step 8)
    const restartBtn = document.getElementById('restart-lesson-btn');
    if (restartBtn) {
      restartBtn.onclick = () => this.engine.resetLesson();
    }

    // Auto-complete presentation observation steps that require no student action
    if (
      step.allowStudentInteraction === false &&
      step.presentationView !== 'completion'
    ) {
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
      this.fitWindowToWorkspace();
    }

    this.announce(message);
  }

  /**
   * Handle WindowManager event notifications
   */
  handleWindowEvent(e) {
    const eventType = e.type;
    const action = e.detail?.action;

    // Keep the compact instruction panel visible while Chrome is minimized.
    if (eventType === 'window:minimized') {
      this.setPanelCollapsed(true);
      this.highlight.clear();
    } else if (
      eventType === 'window:restored' ||
      eventType === 'window:taskbar-restored' ||
      eventType === 'window:opened'
    ) {
      this.setPanelCollapsed(false);
    }

    const step = this.engine.getCurrentStep();
    if (!step || !Array.isArray(step.expectedActions)) return;

    const expectedIndex = this.challengeSequence.length;
    const expectedAction = step.expectedActions[expectedIndex];

    if (action !== expectedAction) return;

    this.challengeSequence.push(action);

    const sequenceComplete =
      this.challengeSequence.length === step.expectedActions.length;

    if (!sequenceComplete) {
      const message =
        step.intermediateMessages?.[this.challengeSequence.length - 1];

      if (message) {
        this.showFeedback('success', message);
      }

      return;
    }

    this.showFeedback('success', step.completionMessage);
    this.engine.setStepCompleted(step.id, true);
    this.renderModeBar();
  }

  /**
   * Handle control attempt events for feedback on incorrect control clicks
   */
  handleControlAttempt(e) {
    const { control, allowed } = e.detail || {};
    const step = this.engine.getCurrentStep();
    if (!step) return;

    if (
      step.identifyControl &&
      control === step.identifyControl &&
      allowed
    ) {
      e.preventDefault();
      this.highlight.clear();
      this.showFeedback('success', step.completionMessage);
      this.engine.setStepCompleted(step.id, true);
      this.renderModeBar();
      return;
    }

    if (!allowed && step.allowStudentInteraction !== false) {
      this.showFeedback(
        'try-again',
        'That button does something different. Try again!'
      );
    }
  }
}
