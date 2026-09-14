/**
 * Shared animated Back then Forward demonstration.
 * Used by Student Practice, Classroom Presentation, and Teacher Control.
 */
export class BackForwardDemonstration {
  constructor({
    backBtnEl,
    forwardBtnEl,
    browserNavigator = null,
    pageLabelEl = null,
    cursorLayer = document.body,
    onCaption = () => {}
  }) {
    this.backBtnEl = backBtnEl;
    this.forwardBtnEl = forwardBtnEl;
    this.browserNavigator = browserNavigator;
    this.pageLabelEl = pageLabelEl;
    this.cursorLayer = cursorLayer;
    this.onCaption = onCaption;

    this.cursorEl = null;
    this.timers = [];
    this.runId = 0;
    this.savedButtonStates = new Map();
  }

  wait(milliseconds, runId) {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        if (runId === this.runId) resolve();
      }, milliseconds);

      this.timers.push(timer);
    });
  }

  createCursor() {
    const cursor = document.createElement('div');
    cursor.className = 'demo-cursor back-forward-demo-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = `
      <svg viewBox="0 0 32 32" width="30" height="30">
        <path
          d="M5 3 L25 18 L16 19 L21 28 L16 30 L11 21 L5 27 Z"
          fill="#ffffff"
          stroke="#111827"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </svg>
      <span class="demo-cursor-click-ring"></span>
    `;

    this.cursorLayer.appendChild(cursor);
    this.cursorEl = cursor;
    return cursor;
  }

  moveCursorTo(element, duration = 700) {
    if (!this.cursorEl || !element) return;

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    this.cursorEl.style.transition =
      `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    this.cursorEl.style.transform =
      `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  showPage(index) {
    const pages = ['home', 'reading', 'story'];

    if (this.browserNavigator) {
      this.browserNavigator.reset(pages, index);
    }

    // Availability controls appearance; disabled prevents real clicks.
    [
      [this.backBtnEl, index > 0],
      [this.forwardBtnEl, index < pages.length - 1]
    ].forEach(([button, available]) => {
      if (!button) return;
      if (!this.savedButtonStates.has(button)) {
        this.savedButtonStates.set(button, button.disabled);
      }
      button.dataset.demoAvailable = String(available);
      button.disabled = true;
    });

    if (this.pageLabelEl) {
      const labels = [
        'Student Learning Home',
        'Reading Corner',
        'Today’s Story'
      ];
      this.pageLabelEl.textContent = labels[index];
    }
  }

  async click(element, runId) {
    if (!this.cursorEl || !element || runId !== this.runId) return;

    this.cursorEl.classList.add('is-clicking');
    element.classList.add('demo-control-clicked');

    await this.wait(260, runId);

    if (runId !== this.runId) return;
    this.cursorEl.classList.remove('is-clicking');
    element.classList.remove('demo-control-clicked');
  }

  async play() {
    this.stop();

    const runId = this.runId;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const travelTime = reducedMotion ? 80 : 700;

    this.showPage(2);
    this.onCaption('We are viewing Today’s Story.');

    const cursor = this.createCursor();
    cursor.style.transform = 'translate(50vw, 55vh)';

    await this.wait(reducedMotion ? 100 : 450, runId);
    if (runId !== this.runId) return;

    this.onCaption('The cursor moves to the Back button.');
    this.moveCursorTo(this.backBtnEl, travelTime);
    await this.wait(travelTime + 150, runId);
    if (runId !== this.runId) return;

    this.onCaption('Click Back to return to Reading Corner.');
    await this.click(this.backBtnEl, runId);
    if (runId !== this.runId) return;
    this.showPage(1);

    await this.wait(reducedMotion ? 250 : 900, runId);
    if (runId !== this.runId) return;

    this.onCaption('Now the cursor moves to the Forward button.');
    this.moveCursorTo(this.forwardBtnEl, travelTime);
    await this.wait(travelTime + 150, runId);
    if (runId !== this.runId) return;

    this.onCaption('Click Forward to revisit Today’s Story.');
    await this.click(this.forwardBtnEl, runId);
    if (runId !== this.runId) return;
    this.showPage(2);

    this.onCaption(
      'Back returned to the previous page, and Forward brought the page back.'
    );

    await this.wait(reducedMotion ? 500 : 1400, runId);
    if (runId === this.runId && this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }
  }

  stop() {
    this.runId += 1;
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers = [];

    this.savedButtonStates.forEach((disabled, button) => {
      button.disabled = disabled;
      delete button.dataset.demoAvailable;
    });
    this.savedButtonStates.clear();
    this.browserNavigator?.updateButtons();

    this.backBtnEl?.classList.remove('demo-control-clicked');
    this.forwardBtnEl?.classList.remove('demo-control-clicked');

    if (this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }
  }
}
