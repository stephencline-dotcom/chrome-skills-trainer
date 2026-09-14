const T_START = 300;
const T_MOVE = 650;
const T_PAUSE = 300;
const T_CLICK = 250;
const T_STATE = 850;
const T_END = 1300;

function reducedMotion() {
  return window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  ).matches;
}

export class CloseDemonstration {
  constructor({
    windowEl,
    closeBtnEl,
    taskbarBtnEl,
    cursorLayer,
    onCaption
  }) {
    this.windowEl = windowEl;
    this.closeBtnEl = closeBtnEl;
    this.taskbarBtnEl = taskbarBtnEl;
    this.cursorLayer = cursorLayer || document.body;
    this.onCaption =
      typeof onCaption === 'function' ? onCaption : () => {};
    this.cursorEl = null;
    this.timers = [];
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
    this.timers.push(window.setTimeout(callback, delay));
  }

  clearTimers() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers = [];
  }

  showClosed() {
    this.windowEl.classList.add('is-closed');
    this.taskbarBtnEl.classList.remove('is-active', 'is-minimized');
    this.taskbarBtnEl.classList.add('is-closed');
  }

  showOpen() {
    this.windowEl.classList.remove('is-closed');
    this.taskbarBtnEl.classList.remove('is-closed', 'is-minimized');
    this.taskbarBtnEl.classList.add('is-active');
  }

  reset() {
    this.clearTimers();
    this.showOpen();

    if (this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }

    this.onCaption('');
  }

  play() {
    this.reset();

    const start = this.centerOf(this.windowEl);
    this.positionCursor(start.x, start.y, false);
    this.onCaption('Click the X to close Chrome.');

    let time = T_START;

    this.after(time, () => {
      const target = this.centerOf(this.closeBtnEl);
      this.positionCursor(target.x, target.y, true);
    });
    time += T_MOVE + T_PAUSE;

    this.after(time, () => this.clickCursor());
    time += T_CLICK;

    this.after(time, () => {
      this.showClosed();
      this.onCaption('Chrome is closed, not minimized.');
    });
    time += T_STATE;

    this.after(time, () => {
      const target = this.centerOf(this.taskbarBtnEl);
      this.positionCursor(target.x, target.y, true);
      this.onCaption('Click Chrome on the taskbar to open a fresh window.');
    });
    time += T_MOVE + T_PAUSE;

    this.after(time, () => this.clickCursor());
    time += T_CLICK;

    this.after(time, () => {
      this.showOpen();
      this.onCaption('A fresh Chrome window is open.');
    });
    time += T_END;

    this.after(time, () => this.play());
  }

  stop() {
    this.reset();
  }
}
