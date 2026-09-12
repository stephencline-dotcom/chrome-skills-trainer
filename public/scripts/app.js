/**
 * app.js
 * Application entry point for Chrome Skills Trainer student simulator.
 * Initializes WindowManager, system clock, and connects StudentLesson
 * when an active lesson parameter is present.
 */

import { WindowManager } from './window-manager.js';
import { lessonCatalog } from './lesson-catalog.js';
import { StudentLesson } from './student-lesson.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Retrieve DOM element references
  const desktopWorkspace = document.getElementById('desktop-workspace');
  const windowEl = document.getElementById('chrome-window');
  const titlebarEl = document.getElementById('window-titlebar');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');
  const taskbarBtn = document.getElementById('taskbar-chrome-btn');

  // Verify essential simulator DOM elements exist before initializing
  if (!desktopWorkspace || !windowEl || !titlebarEl || !btnMinimize || !btnMaximize || !btnClose || !taskbarBtn) {
    console.error('Chrome Skills Trainer: Missing required DOM elements for simulator initialization.');
    return;
  }

  // Initialize Window Manager
  const windowManager = new WindowManager({
    desktopWorkspace,
    windowEl,
    titlebarEl,
    btnMinimize,
    btnMaximize,
    btnClose,
    taskbarBtn
  });

  windowManager.init();

  // Initialize Taskbar System Clock
  initClock();

  // Check URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const skillId = urlParams.get('skill');
  const lessonMode = urlParams.get('lesson');
  const previewMode = urlParams.get('preview');

  if (skillId) {
    try {
      await lessonCatalog.loadCatalog();
      const skill = lessonCatalog.getSkillById(skillId);

      if (skill && lessonMode === 'active' && skill.hasCompleteLesson) {
        // Initialize Student Lesson Engine Controller
        const studentLesson = new StudentLesson({
          skill,
          windowManager,
          isPreview: previewMode === 'teacher'
        });
        studentLesson.init();
      } else {
        // Default static instruction card for skill
        await updateInstructionCardForSkill(skill, previewMode);
      }
    } catch (err) {
      console.warn('Chrome Skills Trainer: Error setting up student lesson mode.', err);
    }
  }
});

/**
 * Updates the instruction card for non-lesson preview or placeholder skills
 */
async function updateInstructionCardForSkill(skill, previewMode) {
  if (!skill) return;

  const titleEl = document.getElementById('instruction-card-title');
  const bodyEl = document.getElementById('instruction-card-body');
  const badgeEl = document.getElementById('preview-badge');
  const backBannerEl = document.getElementById('teacher-back-banner');
  const backLinkEl = document.getElementById('teacher-back-link');

  if (titleEl) {
    titleEl.textContent = `${skill.iconText ? skill.iconText + ' ' : ''}${skill.name}`;
  }

  if (badgeEl) {
    badgeEl.style.display = 'inline-block';
    badgeEl.textContent = 'Practice Preview';
  }

  if (previewMode === 'teacher' && backBannerEl && backLinkEl) {
    backBannerEl.style.display = 'block';
    backLinkEl.href = `teacher.html?skill=${encodeURIComponent(skill.id)}`;
  }

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <span style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">
          ${skill.category}
        </span>
        <p style="font-size: 0.88rem; line-height: 1.5; color: #374151;">
          ${skill.shortExplanation}
        </p>
        <div style="background-color: #f3f4f6; border-left: 3px solid #2563eb; border-radius: 4px; padding: 10px 12px; font-size: 0.82rem; color: #4b5563; line-height: 1.4;">
          <strong style="color: #1f2937;">Where to practice:</strong><br>
          ${skill.simulatorControl}
        </div>
      </div>
    `;
  }
}

/**
 * Updates the simulated taskbar clock with the current time
 */
function initClock() {
  const clockEl = document.getElementById('system-clock');
  if (!clockEl) return;

  function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const dateStr = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
    clockEl.innerHTML = `<span>${timeStr}</span><span style="font-size: 0.72rem; color: #9ca3af;">${dateStr}</span>`;
  }

  updateTime();
  setInterval(updateTime, 1000);
}
