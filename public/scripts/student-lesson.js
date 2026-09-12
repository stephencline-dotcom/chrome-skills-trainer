/**
 * student-lesson.js
 * Controller for student lesson activities.
 * Connects LessonEngine to WindowManager events and student UI.
 * Handles target highlighting, interaction protection, action validation,
 * quiz steps, and step progression.
 */

import { LessonEngine } from './lesson-engine.js';

export class StudentLesson {
  /**
   * @param {Object} options
   * @param {Object} options.skill - Skill object from catalog
   * @param {Object} options.windowManager - Instance of WindowManager
   * @param {boolean} options.isPreview - Whether running in teacher preview mode
   */
  constructor({ skill, windowManager, isPreview = false }) {
    this.skill = skill;
    this.windowManager = windowManager;
    this.isPreview = isPreview;

    this.engine = new LessonEngine(skill);

    // Challenge state tracking
    this.challengeSequence = [];

    // Bind event handlers
    this.handleWindowEvent = this.handleWindowEvent.bind(this);
    this.handleControlAttempt = this.handleControlAttempt.bind(this);
    this.handleEngineEvent = this.handleEngineEvent.bind(this);

    // DOM Element References
    this.titleEl = document.getElementById('instruction-card-title');
    this.bodyEl = document.getElementById('instruction-card-body');
    this.badgeEl = document.getElementById('preview-badge');
    this.backBannerEl = document.getElementById('teacher-back-banner');
    this.backLinkEl = document.getElementById('teacher-back-link');

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

    // Render preview navigator if teacher preview mode
    if (this.isPreview) {
      this.renderPreviewNavigator();
    }

    // Apply initial step
    this.setupStep(this.engine.getCurrentStep());
  }

  /**
   * Render top preview navigation bar for teacher preview
   */
  renderPreviewNavigator() {
    let navEl = document.getElementById('student-preview-nav');
    if (!navEl) {
      navEl = document.createElement('nav');
      navEl.id = 'student-preview-nav';
      navEl.className = 'student-preview-nav';
      document.body.insertBefore(navEl, document.body.firstChild);
    }

    const step = this.engine.getCurrentStep();
    const idx = this.engine.getCurrentStepIndex();
    const total = this.engine.getTotalSteps();
    const canAdv = this.engine.canAdvance();

    navEl.innerHTML = `
      <div class="student-preview-nav-left">
        <span class="student-preview-nav-badge">Teacher Preview Mode</span>
        <span><strong>${this.skill.name}:</strong> Step ${idx + 1} of ${total} — ${step?.title || ''}</span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" id="preview-btn-prev" class="student-preview-nav-btn" ${idx === 0 ? 'disabled' : ''}>
          &larr; Prev Step
        </button>
        <button type="button" id="preview-btn-next" class="student-preview-nav-btn" ${!canAdv || idx === total - 1 ? 'disabled' : ''}>
          Next Step &rarr;
        </button>
        <a href="teacher.html?skill=${encodeURIComponent(this.skill.id)}&mode=present" class="student-preview-nav-btn" style="text-decoration: none;">
          Exit Preview
        </a>
      </div>
    `;

    const btnPrev = document.getElementById('preview-btn-prev');
    const btnNext = document.getElementById('preview-btn-next');

    if (btnPrev) {
      btnPrev.onclick = () => this.engine.previousStep();
    }
    if (btnNext) {
      btnNext.onclick = () => this.engine.nextStep();
    }
  }

  /**
   * Handle LessonEngine state changes
   */
  handleEngineEvent(eventName) {
    if (eventName === 'lesson:step-changed') {
      this.setupStep(this.engine.getCurrentStep());
      if (this.isPreview) {
        this.renderPreviewNavigator();
      }
    } else if (eventName === 'lesson:step-completed') {
      if (this.isPreview) {
        this.renderPreviewNavigator();
      }
    }
  }

  /**
   * Cleans up highlights and feedback before setting up step
   */
  cleanupCurrentStep() {
    // Remove highlights
    document.querySelectorAll('.target-highlight').forEach(el => el.classList.remove('target-highlight'));

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

    // 2. Set initial window state for step
    if (step.id === 'step-5-guided-restore') {
      // Begin with Chrome minimized for restore practice
      this.windowManager.resetToDefault();
      this.windowManager.minimize();
    } else if (step.id === 'step-6-independent-challenge' || step.id === 'step-4-guided-minimize') {
      this.windowManager.resetToDefault();
    } else {
      this.windowManager.resetToDefault();
    }

    // 3. Target highlighting
    if (step.targetControl && step.targetControl !== 'sequence' && step.targetControl !== 'quiz-minimize') {
      const targetEl = document.getElementById(step.targetControl);
      if (targetEl) {
        targetEl.classList.add('target-highlight');
      }
    }

    // 4. Render Student Instruction Card content
    this.renderInstructionCard(step);

    this.announce(`Step ${this.engine.getCurrentStepIndex() + 1}: ${step.studentTitle}. ${step.studentInstruction}`);
  }

  /**
   * Render student instruction card markup for current step
   */
  renderInstructionCard(step) {
    if (this.titleEl) {
      this.titleEl.textContent = `${this.skill.iconText ? this.skill.iconText + ' ' : ''}${step.studentTitle}`;
    }

    if (this.badgeEl) {
      this.badgeEl.style.display = 'inline-block';
      this.badgeEl.textContent = `Step ${this.engine.getCurrentStepIndex() + 1} of ${this.engine.getTotalSteps()}`;
    }

    if (this.isPreview && this.backBannerEl && this.backLinkEl) {
      this.backBannerEl.style.display = 'block';
      this.backLinkEl.href = `teacher.html?skill=${encodeURIComponent(this.skill.id)}&mode=present`;
    }

    if (!this.bodyEl) return;

    let contentHtml = `
      <p style="font-size: 0.95rem; line-height: 1.5; color: #1e293b; margin-bottom: 12px; font-weight: 500;">
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
      contentHtml += `
        <div class="celebration-banner">
          <h3>🎉 Lesson Complete!</h3>
          <p>You mastered the <strong>Minimize</strong> button!</p>
          <a href="teacher.html" class="return-hub-btn">
            &larr; Return to Skill Hub
          </a>
        </div>
      `;
    }

    this.bodyEl.innerHTML = contentHtml;

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
        };
      }

      if (btnClose) {
        btnClose.onclick = () => {
          btnClose.classList.add('is-incorrect');
          this.showFeedback('try-again', 'Close shuts the window completely. Try Minimize!');
        };
      }
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
    const step = this.engine.getCurrentStep();
    if (!step) return;

    const eventType = e.type;

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
