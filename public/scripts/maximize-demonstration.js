/**
 * Shared visual demonstration of Maximize and Restore Down.
 * Moves a simulated cursor, expands the window, and restores it.
 * It never moves the real pointer or triggers real control events.
 */

const T_START = 300;
const T_MOVE = 650;
const T_PAUSE = 300;
const T_CLICK = 250;
const T_STATE_PAUSE = 900;
const T_END_PAUSE = 1300;

function reducedMotion() {
  return window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  ).matches;
}

export class MaximizeDemonstration {
  constructor({
    windowEl,
    maximizeBtnEl,
    cursorLayer,
    onCaption,
    maximizeBottomInset = 0
  }) {
    this.windowEl = windowEl;
    this.maximizeBtnEl = maximizeBtnEl;
    this.cursorLayer = cursorLayer || document.body;
    this.maximizeBottomInset = maximizeBottomInset;
    this.onCaption =
      typeof onCaption === 'function' ? onCaption : () => {};

    this.cursorEl = null;
    this.timers = [];
    this.originalStyle = null;
    this.originalButtonHtml = maximizeBtnEl.innerHTML;
    this.originalButtonAriaLabel =
      maximizeBtnEl.getAttribute('aria-label');
    this.originalButtonTitle =
      maximizeBtnEl.getAttribute('title');
  }

  centerOf(element) {
    const rect = element.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  ensureCursor() {
    if (this.cursorEl) return this.cursorEl;

    const cursor = document.createElement('div');
    cursor.className = 'demo-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = `
      <svg viewBox="0 0 24 24" width="26" height="26" focusable="false">
        <path
          d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.5 L12 14 L19 14 Z"
          fill="#ffffff"
          stroke="#1e293b"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
      </svg>
      <span class="demo-cursor-click-ring"></span>
    `;

    this.cursorLayer.appendChild(cursor);
    this.cursorEl = cursor;
    return cursor;
  }

  positionCursor(x, y, animate) {
    const cursor = this.ensureCursor();
    cursor.style.transition =
      animate && !reducedMotion()
        ? 'left 0.6s ease, top 0.6s ease'
        : 'none';
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  }

  clickCursor() {
    if (!this.cursorEl) return;
    this.cursorEl.classList.remove('is-clicking');
    void this.cursorEl.offsetWidth;
    this.cursorEl.classList.add('is-clicking');
  }

  after(delay, callback) {
    const timer = window.setTimeout(callback, delay);
    this.timers.push(timer);
  }

  clearTimers() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers = [];
  }

  rememberWindowStyle() {
    if (this.originalStyle) return;

    this.originalStyle = {
      left: this.windowEl.style.left,
      top: this.windowEl.style.top,
      width: this.windowEl.style.width,
      height: this.windowEl.style.height
    };
  }

  showMaximized() {
    this.rememberWindowStyle();
    this.windowEl.classList.add('demo-is-maximized');
    this.windowEl.style.left = '0px';
    this.windowEl.style.top = '0px';
    this.windowEl.style.width = '100%';
    this.windowEl.style.height = this.maximizeBottomInset
      ? `calc(100% - ${this.maximizeBottomInset}px)`
      : '100%';

    this.maximizeBtnEl.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          d="M4.5 5.5v7h7v-7h-7z M6.5 5.5v-2h7v7h-2"
        />
      </svg>
    `;
    this.maximizeBtnEl.setAttribute('aria-label', 'Restore Down');
    this.maximizeBtnEl.setAttribute('title', 'Restore Down');
  }

  showRestored() {
    this.windowEl.classList.remove('demo-is-maximized');

    if (!this.originalStyle) return;

    Object.assign(this.windowEl.style, this.originalStyle);

    this.maximizeBtnEl.innerHTML = this.originalButtonHtml;

    if (this.originalButtonAriaLabel === null) {
      this.maximizeBtnEl.removeAttribute('aria-label');
    } else {
      this.maximizeBtnEl.setAttribute(
        'aria-label',
        this.originalButtonAriaLabel
      );
    }

    if (this.originalButtonTitle === null) {
      this.maximizeBtnEl.removeAttribute('title');
    } else {
      this.maximizeBtnEl.setAttribute(
        'title',
        this.originalButtonTitle
      );
    }
  }

  reset() {
    this.clearTimers();
    this.showRestored();

    if (this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }

    this.originalStyle = null;
    this.onCaption('');
  }

  play() {
    this.reset();
    this.rememberWindowStyle();

    const start = this.centerOf(this.windowEl);
    this.positionCursor(start.x, start.y, false);
    this.onCaption('Click Maximize to fill the desktop.');

    let time = T_START;

    this.after(time, () => {
      const target = this.centerOf(this.maximizeBtnEl);
      this.positionCursor(target.x, target.y, true);
    });
    time += T_MOVE + T_PAUSE;

    this.after(time, () => this.clickCursor());
    time += T_CLICK;

    this.after(time, () => {
      this.showMaximized();
      this.onCaption(
        'Chrome now fills the desktop. The button becomes Restore Down.'
      );
    });
    time += T_STATE_PAUSE;

    this.after(time, () => {
      const target = this.centerOf(this.maximizeBtnEl);
      this.positionCursor(target.x, target.y, true);
      this.onCaption(
        'Click Restore Down to return to the smaller window.'
      );
    });
    time += T_MOVE + T_PAUSE;

    this.after(time, () => this.clickCursor());
    time += T_CLICK;

    this.after(time, () => {
      this.showRestored();
      this.onCaption('Chrome is back to its smaller size.');
    });
    time += T_END_PAUSE;

    this.after(time, () => this.play());
  }

  stop() {
    this.reset();
  }
}
