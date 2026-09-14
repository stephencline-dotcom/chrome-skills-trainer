/**
 * lesson-hub.js
 * Teacher Skill Hub controller. Renders skill cards, handles category filters,
 * displays lesson details, and manages URL query parameter synchronization.
 * Supports Teacher Presentation Mode (mode=present).
 */

import { lessonCatalog } from './lesson-catalog.js';
import { LessonEngine } from './lesson-engine.js';
import { LocalLessonChannel, LOCAL_LESSON_COMMANDS, DELIVERY_MODES } from './local-lesson-channel.js';
import { MinimizeDemonstration } from './minimize-demonstration.js';
import { MaximizeDemonstration } from './maximize-demonstration.js';
import { CloseDemonstration } from './close-demonstration.js';
import { BackForwardDemonstration } from './back-forward-demonstration.js';
import { ReloadDemonstration } from './reload-demonstration.js';

class LessonHub {
  constructor() {
    this.currentCategory = 'All Skills';
    this.selectedSkill = null;
    this.engine = null;

    // DOM Element References
    this.mainContainer = document.querySelector('main.hub-container');
    this.filterContainer = document.getElementById('category-filter-bar');
    this.skillsGrid = document.getElementById('skills-grid');
    this.detailPanel = document.getElementById('detail-panel');
  }

  /**
   * Initialize Lesson Hub
   */
  async init() {
    try {
      await lessonCatalog.loadCatalog();

      const urlParams = new URLSearchParams(window.location.search);
      const initialSkillId = urlParams.get('skill');
      const mode = urlParams.get('mode');

      if (initialSkillId && mode === 'present') {
        const skill = lessonCatalog.getSkillById(initialSkillId);
        if (skill && skill.hasCompleteLesson) {
          this.renderPresentationMode(skill);
          return;
        }
      }

      this.renderCategoryFilters();
      this.renderSkillsGrid();

      if (initialSkillId) {
        const skill = lessonCatalog.getSkillById(initialSkillId);
        if (skill) {
          this.selectSkill(skill, false);
        } else {
          this.renderEmptyDetailState();
        }
      } else {
        this.renderEmptyDetailState();
      }
    } catch (err) {
      console.error('Failed to initialize Teacher Skill Hub:', err);
    }
  }

  /**
   * Render category filter buttons
   */
  renderCategoryFilters() {
    if (!this.filterContainer) return;

    const categories = lessonCatalog.getCategories();
    this.filterContainer.innerHTML = '';

    categories.forEach(category => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `filter-btn ${category === this.currentCategory ? 'is-active' : ''}`;
      btn.textContent = category;
      btn.setAttribute('aria-pressed', category === this.currentCategory ? 'true' : 'false');

      btn.addEventListener('click', () => {
        this.currentCategory = category;
        this.filterContainer.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');

        this.renderSkillsGrid();
      });

      this.filterContainer.appendChild(btn);
    });
  }

  /**
   * Render skill cards grid according to current category filter
   */
  renderSkillsGrid() {
    if (!this.skillsGrid) return;

    const skills = lessonCatalog.getSkillsByCategory(this.currentCategory);
    this.skillsGrid.innerHTML = '';

    if (skills.length === 0) {
      this.skillsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #64748b;">
          No skills found in this category.
        </div>
      `;
      return;
    }

    skills.forEach(skill => {
      const card = document.createElement('article');
      const isSelected = this.selectedSkill && this.selectedSkill.id === skill.id;
      card.className = `skill-card ${isSelected ? 'is-selected' : ''}`;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      card.setAttribute('aria-label', `Select ${skill.name} skill`);

      card.innerHTML = `
        <span class="skill-card-badge">${skill.category}</span>
        <div class="skill-card-header">
          <div class="skill-card-icon" aria-hidden="true">${skill.iconText || '📌'}</div>
          <h3 class="skill-card-name">${skill.name}</h3>
        </div>
        <p class="skill-card-explanation">${skill.shortExplanation}</p>
      `;

      const handleSelect = () => this.selectSkill(skill, true);

      card.addEventListener('click', handleSelect);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      });

      this.skillsGrid.appendChild(card);
    });
  }

  /**
   * Select a skill, highlight card, update detail panel, and update URL
   */
  selectSkill(skill, updateUrl = true) {
    this.selectedSkill = skill;

    const cards = this.skillsGrid ? this.skillsGrid.querySelectorAll('.skill-card') : [];
    cards.forEach(card => {
      card.classList.remove('is-selected');
      card.setAttribute('aria-pressed', 'false');
    });

    const skills = lessonCatalog.getSkillsByCategory(this.currentCategory);
    const cardIndex = skills.findIndex(s => s.id === skill.id);
    if (cardIndex !== -1 && cards[cardIndex]) {
      cards[cardIndex].classList.add('is-selected');
      cards[cardIndex].setAttribute('aria-pressed', 'true');
    }

    this.renderDetailPanel(skill);

    if (updateUrl) {
      const newUrl = `${window.location.pathname}?skill=${encodeURIComponent(skill.id)}`;
      window.history.replaceState({ skillId: skill.id }, '', newUrl);
    }
  }

  /**
   * Render detail panel for selected skill
   */
  renderDetailPanel(skill) {
    if (!this.detailPanel) return;

    const sectionsHtml = skill.lessonSections.map((sec, idx) => `
      <div class="section-item">
        <div class="section-item-title-row">
          <span class="section-item-title">${idx + 1}. ${sec.title}</span>
          <span class="section-item-badge">${sec.type || sec.section}</span>
        </div>
        <p class="section-item-desc">${sec.placeholderDescription || sec.teacherText || ''}</p>
      </div>
    `).join('');

    let actionButtonHtml = '';
    if (skill.hasCompleteLesson) {
      actionButtonHtml = `
        <a href="teacher.html?skill=${encodeURIComponent(skill.id)}&mode=present" class="start-lesson-btn" aria-label="Start Lesson presentation for ${skill.name}">
          <span>Start Lesson Presentation</span>
          <span aria-hidden="true">&rarr;</span>
        </a>
      `;
    } else {
      actionButtonHtml = `
        <div style="background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 30px; padding: 12px; text-align: center; font-weight: 700; color: #64748b; font-size: 0.95rem;">
          💡 Lesson Coming Soon
        </div>
      `;
    }

    this.detailPanel.innerHTML = `
      <div class="detail-header">
        <span class="detail-category-tag">${skill.category}</span>
        <div class="detail-title-area">
          <div class="detail-icon" aria-hidden="true">${skill.iconText || '📌'}</div>
          <h2 class="detail-title">${skill.name}</h2>
        </div>
        <p class="detail-explanation">${skill.shortExplanation}</p>
      </div>

      <div class="detail-action-area">
        ${actionButtonHtml}
      </div>

      <div class="detail-sections-header">
        <span>Lesson Overview (${skill.lessonSections.length} Steps)</span>
      </div>

      <div class="section-list">
        ${sectionsHtml}
      </div>
    `;
  }

  /**
   * Render empty detail panel when no skill is selected
   */
  renderEmptyDetailState() {
    if (!this.detailPanel) return;

    this.detailPanel.innerHTML = `
      <div class="detail-panel-empty">
        <div class="detail-panel-empty-icon" aria-hidden="true">💡</div>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #475569; margin-bottom: 8px;">Select a Skill Card</h3>
        <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.4;">
          Choose any skill card from the grid to view lesson details, review activity steps, and launch a teacher presentation.
        </p>
      </div>
    `;
  }

  /**
   * Render Teacher Presentation Mode view
   */
  renderPresentationMode(skill) {
    this.selectedSkill = skill;
    this.engine = new LessonEngine(skill);
    this.channel = new LocalLessonChannel();

    // Defaults to teacher-led every time a lesson starts, per spec. Kept as
    // a plain string (not a boolean) so this can later be sourced from
    // shared classroom state instead of local toggle UI.
    this.deliveryMode = DELIVERY_MODES.TEACHER_LED;

    // Local handshake: respond to a follower (Classroom Presentation or
    // Student Practice) announcing itself with the complete current state.
    this.channel.subscribe((data) => {
      if (!data || data.skillId !== skill.id) return;
      if (data.command === LOCAL_LESSON_COMMANDS.FOLLOWER_READY) {
        this.publishTeacherState();
      } else if (
        data.command === LOCAL_LESSON_COMMANDS.REQUEST_STEP_CHANGE &&
        Number.isInteger(data.stepIndex)
      ) {
        this.engine.goToStep(data.stepIndex);
      }
    });

    if (!this.mainContainer) return;

    // Replace main container content with presentation player layout
    this.mainContainer.innerHTML = `
      <div class="teacher-present-layout">
        <!-- Main Slide Card -->
        <main class="teacher-slide-card" aria-label="Teacher Lesson Control Slide">
          <div id="slide-content-area">
            <!-- Dynamically populated by updateSlideView -->
          </div>
        </main>

        <!-- Right Steps Sidebar -->
        <aside class="teacher-steps-sidebar" aria-label="Lesson Steps Sidebar">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <span style="background-color: #3b82f6; color: #ffffff; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
              Local Control Mode
            </span>
            <a href="teacher.html?skill=${encodeURIComponent(skill.id)}" class="slide-nav-btn" style="padding: 6px 12px; font-size: 0.8rem; text-decoration: none;">
              Exit Lesson
            </a>
          </div>

          <div class="mode-toggle-row">
            <span class="mode-toggle-label">Independent Mode</span>
            <button type="button" id="independent-mode-toggle" class="mode-toggle-btn" aria-pressed="false">
              Off
            </button>
          </div>
          <p id="teacher-sync-status" class="teacher-sync-status" aria-live="polite">No followers connected yet.</p>

          <h3 class="sidebar-title">${skill.iconText || '📌'} ${skill.name} Steps</h3>
          <ul id="sidebar-step-list" class="sidebar-step-list">
            <!-- Dynamically populated by updateSidebarSteps -->
          </ul>
        </aside>
      </div>
    `;

    const modeToggleBtn = document.getElementById('independent-mode-toggle');
    if (modeToggleBtn) {
      modeToggleBtn.onclick = () => {
        this.deliveryMode = this.deliveryMode === DELIVERY_MODES.TEACHER_LED
          ? DELIVERY_MODES.INDEPENDENT
          : DELIVERY_MODES.TEACHER_LED;
        this.updateModeToggleUi();
        this.channel.publish({
          command: LOCAL_LESSON_COMMANDS.SET_DELIVERY_MODE,
          skillId: this.selectedSkill.id,
          stepId: this.engine.getCurrentStep()?.id,
          stepIndex: this.engine.getCurrentStepIndex(),
          deliveryMode: this.deliveryMode
        });
      };
    }
    this.updateModeToggleUi();

    // Listen for step changes
    this.engine.addListener((eventName) => {
      if (eventName === 'lesson:step-changed') {
        this.updateSlideView();
        this.updateSidebarSteps();
        this.publishTeacherState();
      }
    });

    this.updateSlideView();
    this.updateSidebarSteps();

    this.channel.publish({
      command: LOCAL_LESSON_COMMANDS.SET_LESSON,
      skillId: this.selectedSkill.id,
      stepId: this.engine.getCurrentStep()?.id,
      stepIndex: this.engine.getCurrentStepIndex(),
      deliveryMode: this.deliveryMode
    });

    this.publishTeacherState();
  }

  /**
   * Reflects the current delivery mode on the Independent Mode toggle button.
   */
  updateModeToggleUi() {
    const buttons = [
      document.getElementById('independent-mode-toggle'),
      document.getElementById('toolbar-independent-mode-toggle')
    ].filter(Boolean);

    const isIndependent =
      this.deliveryMode === DELIVERY_MODES.INDEPENDENT;

    buttons.forEach((btn) => {
      btn.textContent = isIndependent ? 'On' : 'Off';
      btn.setAttribute(
        'aria-pressed',
        isIndependent ? 'true' : 'false'
      );
    });
  }

  /**
   * Publish the complete current teacher state (skill, step, delivery mode)
   * to followers over the local (same-browser only) BroadcastChannel sync
   * channel. Used both for ongoing step changes and for handshake replies.
   * @param {boolean} [isHandshakeReply]
   */
  publishTeacherState(isHandshakeReply = false) {
    if (!this.channel || !this.engine || !this.selectedSkill) return;
    const step = this.engine.getCurrentStep();
    if (!step) return;

    this.channel.publish({
      command: isHandshakeReply ? LOCAL_LESSON_COMMANDS.TEACHER_STATE : LOCAL_LESSON_COMMANDS.SET_STEP,
      skillId: this.selectedSkill.id,
      stepId: step.id,
      stepIndex: this.engine.getCurrentStepIndex(),
      deliveryMode: this.deliveryMode
    });

    const statusEl = document.getElementById('teacher-sync-status');
    if (statusEl) {
      statusEl.textContent = 'Broadcasting to any connected Classroom Presentation / Student Practice tabs.';
    }
  }

  /**
   * Update Slide view for current active step
   */
  updateSlideView() {
    const slideArea = document.getElementById('slide-content-area');
    if (!slideArea) return;

    const step = this.engine.getCurrentStep();
    const idx = this.engine.getCurrentStepIndex();
    const total = this.engine.getTotalSteps();

    if (!step) return;

    let demoStageHtml = '';
    if (step.demonstration) {
      demoStageHtml = `
        <div class="demo-stage">
          <div class="demo-mini-desktop">
            <div id="demo-mini-window" class="demo-mini-window">
              <div class="demo-mini-titlebar">
                <span style="font-size: 0.65rem; font-weight: bold; color: #334155;">Chrome Skills Trainer</span>
                <div class="demo-mini-controls">
                  <button type="button" id="demo-mini-btn-minimize" class="demo-mini-btn demo-mini-btn-min" tabindex="-1" aria-hidden="true"></button>
                  <button type="button" id="demo-mini-btn-maximize" class="demo-mini-btn demo-mini-btn-max" tabindex="-1" aria-hidden="true">□</button>
                  <button type="button" id="demo-mini-btn-close" class="demo-mini-btn demo-mini-btn-close" tabindex="-1" aria-hidden="true">×</button>
                </div>
              </div>
              <div class="demo-mini-browser-toolbar">
                <button type="button" id="demo-mini-btn-back" class="demo-mini-nav-btn" tabindex="-1" aria-hidden="true">←</button>
                <button type="button" id="demo-mini-btn-forward" class="demo-mini-nav-btn" tabindex="-1" aria-hidden="true">→</button>
                <button type="button" id="demo-mini-btn-reload" class="demo-mini-nav-btn" tabindex="-1" aria-hidden="true">↻</button>
                <span class="demo-mini-address">chrome-skills-trainer.local</span>
              </div>
              <div id="demo-mini-page-label" class="demo-mini-page-label">
                Simulated Web Content
              </div>
            </div>
            <div class="demo-mini-taskbar">
              <button type="button" id="demo-mini-taskbar-btn" class="demo-mini-taskbar-btn" tabindex="-1" aria-hidden="true">
                <span>🌐</span> Chrome
              </button>
            </div>
          </div>
          <p id="demo-caption-mini" class="demo-caption demo-caption-mini" aria-live="polite"></p>
          <button type="button" id="replay-demo-btn" class="replay-demo-btn">
            <span>🔄</span> Replay Demonstration
          </button>
        </div>
      `;
    }

    slideArea.innerHTML = `
      <div>
        <span class="slide-section-badge">${step.section || step.type}</span>
        <div style="font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
          Teacher Lesson Control
        </div>
        <h2 class="slide-title">${step.teacherTitle || step.title}</h2>
        <p class="slide-text">${step.teacherText || ''}</p>

        <div class="teacher-prompt-box">
          <strong>Teacher Prompt / Script:</strong>
          <p>${step.teacherPrompt || ''}</p>
        </div>

        ${demoStageHtml}

        <div class="student-preview-box">
          <strong>Student Instruction Preview:</strong>
          <p>"${step.studentInstruction || ''}"</p>
        </div>
      </div>

      <div class="slide-footer-nav">
        <button type="button" id="slide-btn-prev" class="slide-nav-btn" ${idx === 0 ? 'disabled' : ''}>
          &larr; Previous
        </button>

        <span style="font-weight: 700; color: #64748b; font-size: 0.95rem;">
          Step ${idx + 1} of ${total}
        </span>

        <div class="toolbar-mode-toggle">
          <span class="mode-toggle-label">Independent Mode</span>
          <button type="button" id="toolbar-independent-mode-toggle" class="mode-toggle-btn" aria-pressed="false">
            Off
          </button>
        </div>

        <div class="slide-footer-nav-launchers">
          <a href="presentation.html?skill=${encodeURIComponent(this.selectedSkill.id)}&lesson=active" target="_blank" class="slide-nav-btn primary" title="Open the Classroom Presentation view in a new tab">
            📺 Open Classroom Presentation
          </a>

          <a href="student.html?skill=${encodeURIComponent(this.selectedSkill.id)}&lesson=active&preview=teacher" target="_blank" class="slide-nav-btn primary" title="Open student simulator preview in a new tab">
            🚀 Open Student Practice Preview
          </a>
        </div>

        <button type="button" id="slide-btn-next" class="slide-nav-btn primary" ${idx === total - 1 ? 'disabled' : ''}>
          Next &rarr;
        </button>
      </div>
    `;

    // Attach the shared "Watch It Work" demonstration controller (same
    // module used by Classroom Presentation and Student Practice) to the
    // mini preview window, and stop/clear it when navigating away.
    if (this.teacherDemo) {
      this.teacherDemo.stop();
      this.teacherDemo = null;
    }

    if (step.demonstration) {
      const miniWindow = document.getElementById('demo-mini-window');
      const miniMinimizeBtn = document.getElementById('demo-mini-btn-minimize');
      const miniMaximizeBtn = document.getElementById('demo-mini-btn-maximize');
      const miniCloseBtn = document.getElementById('demo-mini-btn-close');
      const miniTaskbarBtn = document.getElementById('demo-mini-taskbar-btn');
      const miniBackBtn = document.getElementById('demo-mini-btn-back');
      const miniForwardBtn = document.getElementById('demo-mini-btn-forward');
      const miniPageLabel = document.getElementById('demo-mini-page-label');
      const miniCaptionEl = document.getElementById('demo-caption-mini');
      const replayBtn = document.getElementById('replay-demo-btn');

      if (
        miniWindow &&
        miniMinimizeBtn &&
        miniMaximizeBtn &&
        miniCloseBtn &&
        miniTaskbarBtn
      ) {
        const DemonstrationClass = {
          'minimize-cycle': MinimizeDemonstration,
          'maximize-cycle': MaximizeDemonstration,
          'close-reopen-cycle': CloseDemonstration,
          'reload-cycle': ReloadDemonstration,
      'back-forward-cycle': BackForwardDemonstration
        }[step.demonstration] || MinimizeDemonstration;

        this.teacherDemo = new DemonstrationClass({
          windowEl: miniWindow,
          minimizeBtnEl: miniMinimizeBtn,
          maximizeBtnEl: miniMaximizeBtn,
          closeBtnEl: miniCloseBtn,
          taskbarBtnEl: miniTaskbarBtn,
          backBtnEl: miniBackBtn,
          forwardBtnEl: miniForwardBtn,
          reloadBtnEl: document.getElementById('demo-mini-btn-reload'),
          pageLabelEl: miniPageLabel,
          cursorLayer: document.body,
          maximizeBottomInset: 28,
          onCaption: (text) => {
            if (miniCaptionEl) miniCaptionEl.textContent = text;
          }
        });
        this.teacherDemo.play();
      }

      if (replayBtn) {
        replayBtn.onclick = () => {
          if (this.teacherDemo) this.teacherDemo.play();

          if (this.channel) {
            this.channel.publish({
              command: LOCAL_LESSON_COMMANDS.REPLAY_DEMONSTRATION,
              skillId: this.selectedSkill.id,
              stepId: step.id,
              stepIndex: idx,
              deliveryMode: this.deliveryMode
            });
          }
        };
      }
    }

    // Attach prev/next handlers
    const btnPrev = document.getElementById('slide-btn-prev');
    const btnNext = document.getElementById('slide-btn-next');
    const toolbarModeToggle = document.getElementById(
      'toolbar-independent-mode-toggle'
    );

    if (toolbarModeToggle) {
      toolbarModeToggle.onclick = () => {
        const sidebarToggle = document.getElementById(
          'independent-mode-toggle'
        );
        if (sidebarToggle) sidebarToggle.click();
      };
      this.updateModeToggleUi();
    }

    if (btnPrev) btnPrev.onclick = () => this.engine.previousStep();
    if (btnNext) btnNext.onclick = () => this.engine.nextStep();
  }

  /**
   * Update sidebar step list items
   */
  updateSidebarSteps() {
    const listEl = document.getElementById('sidebar-step-list');
    if (!listEl) return;

    const currentIdx = this.engine.getCurrentStepIndex();
    listEl.innerHTML = '';

    this.selectedSkill.lessonSections.forEach((step, idx) => {
      const li = document.createElement('li');
      li.className = `sidebar-step-item ${idx === currentIdx ? 'is-active' : ''}`;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');

      li.innerHTML = `
        <span class="sidebar-step-number">${idx + 1}</span>
        <div class="sidebar-step-info">
          <div class="sidebar-step-name">${step.title}</div>
          <div class="sidebar-step-sec">${step.section || step.type}</div>
        </div>
      `;

      const jumpToStep = () => this.engine.goToStep(idx);
      li.onclick = jumpToStep;
      li.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          jumpToStep();
        }
      };

      listEl.appendChild(li);
    });
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const hub = new LessonHub();
  hub.init();
});
