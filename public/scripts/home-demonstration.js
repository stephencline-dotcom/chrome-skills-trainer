import { BackForwardDemonstration } from './back-forward-demonstration.js';

/**
 * Animated Home button demonstration.
 * Starts away from Home, clicks the Home button, and returns to
 * Student Learning Home without triggering student lesson completion.
 */
export class HomeDemonstration extends BackForwardDemonstration {
  constructor(options) {
    super(options);
    this.homeBtnEl = options.homeBtnEl;
  }

  showHomeDemoPage(pageId) {
    if (this.browserNavigator) {
      if (pageId === 'reading') {
        this.browserNavigator.reset(['home', 'reading'], 1);
      } else {
        this.browserNavigator.reset(['home', 'reading', 'home'], 2);
      }
    }

    if (this.pageLabelEl) {
      this.pageLabelEl.textContent =
        pageId === 'reading'
          ? 'Reading Corner'
          : 'Student Learning Home';
    }
  }

  async play() {
    this.stop();

    if (!this.homeBtnEl) return;

    const runId = this.runId;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const travelTime = reducedMotion ? 80 : 700;

    this.savedButtonStates.set(
      this.homeBtnEl,
      this.homeBtnEl.disabled
    );

    this.homeBtnEl.disabled = true;
    this.homeBtnEl.dataset.demoAvailable = 'true';

    this.showHomeDemoPage('reading');
    this.onCaption(
      'We are away from our starting page in Reading Corner.'
    );

    const cursor = this.createCursor();
    cursor.style.transform = 'translate(50vw, 55vh)';

    await this.wait(reducedMotion ? 100 : 450, runId);
    if (runId !== this.runId) return;

    this.onCaption(
      'The cursor moves to the little house-shaped Home button.'
    );
    this.moveCursorTo(this.homeBtnEl, travelTime);

    await this.wait(travelTime + 150, runId);
    if (runId !== this.runId) return;

    this.onCaption(
      'Click Home to go straight back to the starting page.'
    );

    await this.click(this.homeBtnEl, runId);
    if (runId !== this.runId) return;

    this.showHomeDemoPage('home');

    this.onCaption(
      'Home brought us straight back to Student Learning Home.'
    );

    await this.wait(reducedMotion ? 500 : 1400, runId);

    if (runId === this.runId && this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }
  }

  stop() {
    super.stop();
    this.homeBtnEl?.classList.remove('demo-control-clicked');
  }
}