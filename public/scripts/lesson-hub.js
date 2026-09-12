/**
 * lesson-hub.js
 * Teacher Skill Hub controller. Renders skill cards, handles category filters,
 * displays lesson details, and manages URL query parameter synchronization.
 * Supports Teacher Presentation Mode (mode=present).
 */

import { lessonCatalog } from './lesson-catalog.js';
import { LessonEngine } from './lesson-engine.js';

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

    if (!this.mainContainer) return;

    // Replace main container content with presentation player layout
    this.mainContainer.innerHTML = `
      <div class="teacher-present-layout">
        <!-- Main Slide Card -->
        <main class="teacher-slide-card" aria-label="Teacher Presentation Slide">
          <div id="slide-content-area">
            <!-- Dynamically populated by updateSlideView -->
          </div>
        </main>

        <!-- Right Steps Sidebar -->
        <aside class="teacher-steps-sidebar" aria-label="Lesson Steps Sidebar">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <span style="background-color: #3b82f6; color: #ffffff; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
              Local Preview Mode
            </span>
            <a href="teacher.html?skill=${encodeURIComponent(skill.id)}" class="slide-nav-btn" style="padding: 6px 12px; font-size: 0.8rem; text-decoration: none;">
              Exit Lesson
            </a>
          </div>
          <h3 class="sidebar-title">${skill.iconText || '📌'} ${skill.name} Steps</h3>
          <ul id="sidebar-step-list" class="sidebar-step-list">
            <!-- Dynamically populated by updateSidebarSteps -->
          </ul>
        </aside>
      </div>
    `;

    // Listen for step changes
    this.engine.addListener((eventName) => {
      if (eventName === 'lesson:step-changed') {
        this.updateSlideView();
        this.updateSidebarSteps();
      }
    });

    this.updateSlideView();
    this.updateSidebarSteps();
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
    if (step.id === 'step-3-watch-it-work') {
      demoStageHtml = `
        <div class="demo-stage">
          <div class="demo-mini-desktop">
            <div id="demo-mini-window" class="demo-mini-window animating">
              <div class="demo-mini-titlebar">
                <span style="font-size: 0.65rem; font-weight: bold; color: #334155;">Chrome Skills Trainer</span>
                <div class="demo-mini-controls">
                  <span class="demo-mini-btn demo-mini-btn-min"></span>
                  <span class="demo-mini-btn"></span>
                  <span class="demo-mini-btn"></span>
                </div>
              </div>
              <div style="flex: 1; padding: 12px; font-size: 0.75rem; color: #475569; text-align: center; display: flex; align-items: center; justify-content: center;">
                Simulated Web Content
              </div>
            </div>
            <div class="demo-mini-taskbar">
              <div class="demo-mini-taskbar-btn">
                <span>🌐</span> Chrome
              </div>
            </div>
          </div>
          <button type="button" id="replay-demo-btn" class="replay-demo-btn">
            <span>🔄</span> Replay Demonstration
          </button>
        </div>
      `;
    }

    slideArea.innerHTML = `
      <div>
        <span class="slide-section-badge">${step.section || step.type}</span>
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

        <a href="student.html?skill=${encodeURIComponent(this.selectedSkill.id)}&lesson=active&preview=teacher" target="_blank" class="slide-nav-btn primary" title="Open student simulator preview in a new tab">
          🚀 Open Student Preview
        </a>

        <button type="button" id="slide-btn-next" class="slide-nav-btn primary" ${idx === total - 1 ? 'disabled' : ''}>
          Next &rarr;
        </button>
      </div>
    `;

    // Attach replay demo handler
    if (step.id === 'step-3-watch-it-work') {
      const replayBtn = document.getElementById('replay-demo-btn');
      const miniWin = document.getElementById('demo-mini-window');
      if (replayBtn && miniWin) {
        replayBtn.onclick = () => {
          miniWin.classList.remove('animating');
          void miniWin.offsetWidth; // Force reflow
          miniWin.classList.add('animating');
        };
      }
    }

    // Attach prev/next handlers
    const btnPrev = document.getElementById('slide-btn-prev');
    const btnNext = document.getElementById('slide-btn-next');

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
