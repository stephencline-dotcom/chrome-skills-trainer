/**
 * presentation.js
 * Controller for the Classroom Presentation (projected) view.
 *
 * This page is intentionally NOT built on WindowManager - it has no drag,
 * resize, or real interaction logic. It only renders visual lesson state
 * (which control is highlighted, whether the window looks minimized, the
 * Step 3 demonstration) driven by messages from a Teacher Control tab over
 * LocalLessonChannel (same-browser BroadcastChannel only).
 *
 * If BroadcastChannel is unavailable, the page still loads its initial step
 * from URL parameters and clearly explains that live local following is
 * unavailable.
 */

import { lessonCatalog } from './lesson-catalog.js';
import { WindowManager } from './window-manager.js';
import { LocalLessonChannel, LOCAL_LESSON_COMMANDS } from './local-lesson-channel.js';
import { SimulatorHighlight } from './simulator-highlight.js';
import { targetControlToControlKey, getSimulatorControlElement, getControlLabel } from './simulator-controls.js';
import { MinimizeDemonstration } from './minimize-demonstration.js';
import { MaximizeDemonstration } from './maximize-demonstration.js';
import { CloseDemonstration } from './close-demonstration.js';

class PresentationController {
  constructor() {
    this.workspaceEl = document.getElementById('presentation-workspace');
    this.windowEl = document.getElementById('chrome-window');
    this.titleEl = document.getElementById('presentation-lesson-title');
    this.explanationEl = document.getElementById('presentation-explanation');
    this.stepIndicatorEl = document.getElementById('presentation-step-indicator');
    this.syncStatusEl = document.getElementById('presentation-sync-status');
    this.symbolBadgeEl = document.getElementById('presentation-symbol-badge');
    this.quizDisplayEl = document.getElementById('presentation-quiz-display');
    this.celebrationEl = document.getElementById('presentation-celebration');

    this.highlight = new SimulatorHighlight();
    this.channel = new LocalLessonChannel();
    this.demo = null;

    this.skill = null;
    this.currentStep = null;
    this.currentStepIndex = 0;
    this.connectedToTeacher = false;
    this.prevButtonEl = document.getElementById('presentation-prev-btn');
    this.nextButtonEl = document.getElementById('presentation-next-btn');

    this.handleResize = this.handleResize.bind(this);
    this.handleChannelMessage = this.handleChannelMessage.bind(this);
  }

  async init() {
    const params = new URLSearchParams(window.location.search);
    const skillId = params.get('skill');


    try {
      await lessonCatalog.loadCatalog();
      this.skill = skillId ? lessonCatalog.getSkillById(skillId) : null;
    } catch (err) {
      console.error('Classroom Presentation: failed to load lesson catalog.', err);
    }

    if (!this.skill || !Array.isArray(this.skill.lessonSections) || this.skill.lessonSections.length === 0) {
      this.titleEl.textContent = 'No Lesson Selected';
      this.explanationEl.textContent = 'Open this page from Teacher Control using "Open Classroom Presentation".';
      this.syncStatusEl.textContent = '';
      return;
    }

    this.windowManager = new WindowManager({
      desktopWorkspace: this.workspaceEl,
      windowEl: this.windowEl,
      titlebarEl: document.getElementById('window-titlebar'),
      btnMinimize: document.getElementById('btn-minimize'),
      btnMaximize: document.getElementById('btn-maximize'),
      btnClose: document.getElementById('btn-close'),
      taskbarBtn: document.getElementById('taskbar-chrome-btn')
    });
    this.windowManager.defaultWidth = 760;
    this.windowManager.defaultHeight = 440;
    this.windowManager.init();

    this.windowEl.addEventListener('window:control-attempt', (event) => {
      if (
        this.currentStep?.identifyControl &&
        event.detail?.control === this.currentStep.identifyControl
      ) {
        event.preventDefault();
      }
    });

    this.windowEl.addEventListener('window:minimized', () => {
      this.highlight.clear();
    });

    this.windowEl.addEventListener('window:closed', () => {
      this.highlight.clear();
    });

    this.windowEl.addEventListener('window:taskbar-restored', () => {
      if (
        this.currentStep?.id === 'step-2-find-button' ||
        this.currentStep?.id === 'step-4-guided-minimize'
      ) {
        this.applyControlHighlight('btn-minimize');
      }
    });

    const demonstrationType = this.skill.lessonSections.find(
      (step) => step.demonstration
    )?.demonstration;
    const DemonstrationClass = {
      'minimize-cycle': MinimizeDemonstration,
      'maximize-cycle': MaximizeDemonstration,
      'close-reopen-cycle': CloseDemonstration
    }[demonstrationType] || MinimizeDemonstration;

    this.demo = new DemonstrationClass({
      windowEl: this.windowEl,
      minimizeBtnEl: getSimulatorControlElement('minimize'),
      closeBtnEl: getSimulatorControlElement('close'),
      maximizeBtnEl: getSimulatorControlElement('maximize'),
      taskbarBtnEl: getSimulatorControlElement('chrome-taskbar'),
      cursorLayer: document.body,
      onCaption: (text) => this.setDemoCaption(text)
    });

    this.prevButtonEl?.addEventListener('click', () => {
      this.requestStepChange(this.currentStepIndex - 1);
    });

    this.nextButtonEl?.addEventListener('click', () => {
      this.requestStepChange(this.currentStepIndex + 1);
    });

    // Render the first step immediately so the projection is never blank,
    // then wait for the handshake to confirm a real Teacher Control state.
    this.renderStep(this.skill.lessonSections[0], 0);

    if (this.channel.isAvailable()) {
      this.syncStatusEl.textContent = 'Waiting for Teacher Control\u2026';
      this.channel.subscribe(this.handleChannelMessage);
      this.channel.publish({ command: LOCAL_LESSON_COMMANDS.FOLLOWER_READY, skillId: this.skill.id });
    } else {
      this.syncStatusEl.textContent = 'Local live following is unavailable in this browser (BroadcastChannel not supported). Showing the first lesson step only.';
    }
  }

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

    if (data.command === LOCAL_LESSON_COMMANDS.TEACHER_STATE || data.command === LOCAL_LESSON_COMMANDS.SET_STEP) {
      this.connectedToTeacher = true;
      this.syncStatusEl.textContent = 'Connected \u2014 following Teacher Control automatically.';

      const idx = this.skill.lessonSections.findIndex(s => s.id === data.stepId);
      const step = idx !== -1 ? this.skill.lessonSections[idx] : this.skill.lessonSections[data.stepIndex] || null;
      if (step) {
        this.renderStep(step, idx !== -1 ? idx : data.stepIndex);
      }
    } else if (data.command === LOCAL_LESSON_COMMANDS.REPLAY_DEMONSTRATION) {
      if (this.currentStep && this.currentStep.id === 'step-3-watch-it-work') {
        this.demo.play();
      }
    } else if (data.command === LOCAL_LESSON_COMMANDS.RESET_LESSON) {
      this.renderStep(this.skill.lessonSections[0], 0);
    }
  }

  requestStepChange(stepIndex) {
    if (
      !Number.isInteger(stepIndex) ||
      stepIndex < 0 ||
      stepIndex >= this.skill.lessonSections.length
    ) {
      return;
    }

    if (this.connectedToTeacher && this.channel.isAvailable()) {
      this.channel.publish({
        command: LOCAL_LESSON_COMMANDS.REQUEST_STEP_CHANGE,
        skillId: this.skill.id,
        stepIndex
      });
      return;
    }

    this.renderStep(this.skill.lessonSections[stepIndex], stepIndex);
  }

  updateNavigationButtons() {
    if (this.prevButtonEl) {
      this.prevButtonEl.disabled = this.currentStepIndex === 0;
    }

    if (this.nextButtonEl) {
      this.nextButtonEl.disabled =
        this.currentStepIndex === this.skill.lessonSections.length - 1;
    }
  }

  setDemoCaption(text) {
    const el = document.getElementById('presentation-demo-caption');
    if (el) el.textContent = text;
  }

  centerWindow() {
    if (!this.workspaceEl || !this.windowEl) return;
    const width = Math.min(760, Math.max(360, this.workspaceEl.clientWidth - 60));
    const height = Math.min(440, Math.max(260, this.workspaceEl.clientHeight - 60));
    const left = Math.max(0, Math.floor((this.workspaceEl.clientWidth - width) / 2));
    const top = Math.max(0, Math.floor((this.workspaceEl.clientHeight - height) / 2));

    this.windowEl.style.position = 'absolute';
    this.windowEl.style.left = `${left}px`;
    this.windowEl.style.top = `${top}px`;
    this.windowEl.style.width = `${width}px`;
    this.windowEl.style.height = `${height}px`;
  }

  handleResize() {
    if (!this.windowEl.classList.contains('is-minimized')) {
    }
  }

  /** Resets all step-specific visual state before applying the new step. */
  clearStepVisuals() {
    this.highlight.clear();
    if (this.demo) this.demo.stop();
    if (this.windowManager) {
      this.windowManager.resetToDefault();
    } else {
      this.windowEl.classList.remove('is-minimized');
      this.windowEl.style.display = '';
    }
    this.symbolBadgeEl.style.display = 'none';
    this.quizDisplayEl.style.display = 'none';
    this.celebrationEl.style.display = 'none';
    const captionEl = document.getElementById('presentation-demo-caption');
    if (captionEl) {
      captionEl.style.display = 'none';
      captionEl.textContent = '';
    }
  }

  renderStep(step, stepIndex) {
    if (!step) return;
    this.currentStep = step;
    this.currentStepIndex = stepIndex;
    this.clearStepVisuals();
    this.updateNavigationButtons();

    const total = this.skill.lessonSections.length;
    this.stepIndicatorEl.textContent = `Step ${stepIndex + 1} of ${total}`;
    this.titleEl.textContent = `${this.skill.iconText ? this.skill.iconText + ' ' : ''}${step.studentTitle || step.title}`;
    this.explanationEl.textContent = step.studentInstruction || '';

    const startState = step.startState || 'restored';

    if (startState === 'minimized') {
      this.windowManager.minimize();
    } else if (startState === 'maximized') {
      this.windowManager.maximize();
    } else if (startState === 'closed') {
      this.windowManager.close();
    }

    if (step.presentationView === 'symbol') {
      const icon = this.symbolBadgeEl.querySelector(
        '.presentation-symbol-icon'
      );
      const caption = this.symbolBadgeEl.querySelector(
        '.presentation-symbol-caption'
      );

      if (icon) icon.textContent = this.skill.iconText || '';
      if (caption) caption.textContent = `The ${this.skill.name} Symbol`;
      this.symbolBadgeEl.style.display = 'flex';
    }

    if (step.highlightControl) {
      this.applyControlHighlight(step.highlightControl);
    }

    if (step.demonstration && this.demo) {
      this.demo.play();
    }

    if (step.presentationView === 'quiz') {
      this.windowEl.style.display = 'none';
      this.quizDisplayEl.innerHTML = (step.quiz?.choices || [])
        .map((choice) => `
          <div class="presentation-quiz-option">
            <span class="presentation-quiz-icon">${choice.icon || ''}</span>
            <span>${choice.label}</span>
          </div>
        `)
        .join('');
      this.quizDisplayEl.style.display = 'flex';
    }

    if (step.presentationView === 'completion') {
      this.windowEl.style.display = 'none';
      const text = document.getElementById(
        'presentation-celebration-text'
      );
      if (text) text.textContent = step.studentInstruction || '';
      this.celebrationEl.style.display = 'flex';
    }

    // Recenter after any layout-affecting visibility changes
    requestAnimationFrame(() => this.centerWindow());
  }

  applyControlHighlight(targetControlValue) {
    const controlKey = targetControlToControlKey(targetControlValue);
    if (!controlKey) return;
    const el = getSimulatorControlElement(controlKey);
    if (el) {
      this.highlight.show(
        el,
        this.currentStep?.highlightLabel || getControlLabel(controlKey)
      );
    }
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const controller = new PresentationController();
  controller.init();
});
