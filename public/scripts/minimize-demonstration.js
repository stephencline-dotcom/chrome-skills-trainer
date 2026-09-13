/**
 * minimize-demonstration.js
 * Shared "Watch It Work" cursor demonstration controller used by Classroom
 * Presentation, Teacher Lesson Control's preview, and Student Practice
 * Step 3. Models the complete Minimize behavior with a simulated cursor:
 *
 *   1. Cursor moves toward the Minimize button.
 *   2. Cursor pauses over Minimize.
 *   3. A click animation occurs.
 *   4. The window minimizes toward the taskbar button.
 *   5. Cursor moves down to the taskbar button.
 *   6. Cursor pauses, then clicks the taskbar button.
 *   7. The window restores.
 *   8. Brief pause in the restored state, then the sequence loops.
 *
 * The cursor is a purely visual `position: fixed` overlay (same technique as
 * simulator-highlight.js) - it never moves the real OS mouse pointer, and it
 * never dispatches real click events on the target buttons.
 *
 * Respects `prefers-reduced-motion`: travel is replaced by an instant jump
 * to each stage position while the click indicator and captions still play,
 * so the sequence stays understandable without continuous motion.
 */

const CAPTION_CLICK_MINIMIZE = 'Click Minimize to hide Chrome.';
const CAPTION_STILL_OPEN = 'Chrome is still open in the taskbar.';
const CAPTION_CLICK_TASKBAR = 'Click the taskbar button to bring Chrome back.';

// Stage timings (ms), chained sequentially.
const T_START_PAUSE = 300;
const T_MOVE_TO_MINIMIZE = 650;
const T_PAUSE_AT_MINIMIZE = 300;
const T_CLICK_MINIMIZE = 250;
const T_MINIMIZED_PAUSE = 450;
const T_MOVE_TO_TASKBAR = 650;
const T_PAUSE_AT_TASKBAR = 300;
const T_CLICK_TASKBAR = 250;
const T_RESTORED_PAUSE = 1300;

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class MinimizeDemonstration {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.windowEl - simulated Chrome window element
   * @param {HTMLElement} options.minimizeBtnEl - Minimize button element
   * @param {HTMLElement} options.taskbarBtnEl - Chrome taskbar button element
   * @param {HTMLElement} [options.cursorLayer=document.body] - element the cursor is appended to
   * @param {(caption: string) => void} [options.onCaption] - called with the caption text for the current stage
   */
  constructor({ windowEl, minimizeBtnEl, taskbarBtnEl, cursorLayer, onCaption }) {
    this.windowEl = windowEl;
    this.minimizeBtnEl = minimizeBtnEl;
    this.taskbarBtnEl = taskbarBtnEl;
    this.cursorLayer = cursorLayer || document.body;
    this.onCaption = typeof onCaption === 'function' ? onCaption : () => {};

    this.cursorEl = null;
    this.timers = [];
    this.isPlaying = false;
  }

  emitCaption(text) {
    this.onCaption(text || '');
  }

  ensureCursor() {
    if (this.cursorEl) return this.cursorEl;
    const cursor = document.createElement('div');
    cursor.className = 'demo-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = `
      <svg viewBox="0 0 24 24" width="26" height="26" focusable="false">
        <path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.5 L12 14 L19 14 Z" fill="#ffffff" stroke="#1e293b" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>
      <span class="demo-cursor-click-ring"></span>
    `;
    this.cursorLayer.appendChild(cursor);
    this.cursorEl = cursor;
    return cursor;
  }

  positionCursor(x, y, animate) {
    const cursor = this.ensureCursor();
    cursor.style.transition = animate && !prefersReducedMotion()
      ? 'left 0.6s ease, top 0.6s ease'
      : 'none';
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  }

  centerOf(el) {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  triggerClickAnimation() {
    if (!this.cursorEl) return;
    this.cursorEl.classList.remove('is-clicking');
    // Force reflow so the animation can restart on repeated clicks
    void this.cursorEl.offsetWidth;
    this.cursorEl.classList.add('is-clicking');
  }

  after(delayFromNow, fn) {
    const id = setTimeout(fn, delayFromNow);
    this.timers.push(id);
    return id;
  }

  /** Restores the demonstration's visual state before (re)playing. */
  reset() {
    this.clearTimers();
    this.windowEl.classList.remove('is-minimized');
    if (this.taskbarBtnEl) {
      this.taskbarBtnEl.classList.remove('is-minimized');
      this.taskbarBtnEl.classList.add('is-active');
    }
    if (this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }
    this.emitCaption('');
  }

  clearTimers() {
    this.timers.forEach(id => clearTimeout(id));
    this.timers = [];
  }

  /** Restarts the full demonstration sequence from the beginning. */
  play() {
    this.reset();
    this.isPlaying = true;

    const windowStart = this.centerOf(this.windowEl);
    this.positionCursor(windowStart.x, windowStart.y, false);
    this.emitCaption(CAPTION_CLICK_MINIMIZE);

    let t = T_START_PAUSE;

    this.after(t, () => {
      const target = this.centerOf(this.minimizeBtnEl);
      this.positionCursor(target.x, target.y, true);
    });
    t += T_MOVE_TO_MINIMIZE;

    t += T_PAUSE_AT_MINIMIZE;
    this.after(t, () => {
      this.triggerClickAnimation();
    });
    t += T_CLICK_MINIMIZE;

    this.after(t, () => {
      this.windowEl.classList.add('is-minimized');
      if (this.taskbarBtnEl) {
        this.taskbarBtnEl.classList.remove('is-active');
        this.taskbarBtnEl.classList.add('is-minimized');
      }
      this.emitCaption(CAPTION_STILL_OPEN);
    });
    t += T_MINIMIZED_PAUSE;

    this.after(t, () => {
      const target = this.centerOf(this.taskbarBtnEl);
      this.positionCursor(target.x, target.y, true);
      this.emitCaption(CAPTION_CLICK_TASKBAR);
    });
    t += T_MOVE_TO_TASKBAR;

    t += T_PAUSE_AT_TASKBAR;
    this.after(t, () => {
      this.triggerClickAnimation();
    });
    t += T_CLICK_TASKBAR;

    this.after(t, () => {
      this.windowEl.classList.remove('is-minimized');
      if (this.taskbarBtnEl) {
        this.taskbarBtnEl.classList.remove('is-minimized');
        this.taskbarBtnEl.classList.add('is-active');
      }
      this.emitCaption(CAPTION_CLICK_MINIMIZE);
    });
    t += T_RESTORED_PAUSE;

    // Loop the demonstration so it stays useful for latecomers
    this.after(t, () => this.play());
  }

  /** Stops the demonstration and removes the cursor/visual state. */
  stop() {
    this.isPlaying = false;
    this.reset();
  }
}
