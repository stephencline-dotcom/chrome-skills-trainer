import { BackForwardDemonstration } from './back-forward-demonstration.js';

export class ReloadDemonstration extends BackForwardDemonstration {
  constructor(options) {
    super(options);
    this.reloadBtnEl = options.reloadBtnEl;
    this.originalDisabled = null;
  }

  play() {
    this.stop();
    if (!this.reloadBtnEl) return;

    const button = this.reloadBtnEl;
    this.originalDisabled = button.disabled;
    this.browserNavigator?.reset(['home', 'noticeboard'], 1);
    button.disabled = true;
    button.dataset.demoAvailable = 'true';

    if (this.pageLabelEl) {
      this.pageLabelEl.textContent = 'Class Noticeboard: earlier message';
    }
    this.onCaption('An updated class message is ready. Watch Reload.');

    const cursor = this.createCursor();
    cursor.style.transform = 'translate(50vw, 55vh)';
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const travel = reduced ? 0 : 700;
    const runId = this.runId;

    const later = (delay, action) => {
      this.timers.push(window.setTimeout(() => {
        if (runId === this.runId) action();
      }, delay));
    };

    later(350, () => {
      this.moveCursorTo(button, travel);
      this.onCaption('Click the circular Reload arrow.');
    });

    later(550 + travel, () => {
      cursor.classList.add('is-clicking');
      button.classList.add('demo-control-clicked');
    });

    later(850 + travel, () => {
      cursor.classList.remove('is-clicking');
      button.classList.remove('demo-control-clicked');

      // Update the page without emitting a student completion event.
      this.browserNavigator?.performReload(false);
      button.disabled = true;

      if (this.pageLabelEl) {
        this.pageLabelEl.textContent =
          'Latest message: Bring your favorite book tomorrow!';
      }
      this.onCaption(
        'The message updated. The address stayed the same: we refreshed this page.'
      );
    });

    later(2700 + travel, () => {
      cursor.remove();
      this.cursorEl = null;
    });
  }

  stop() {
    super.stop();
    if (!this.reloadBtnEl) return;

    this.reloadBtnEl.classList.remove('demo-control-clicked');
    delete this.reloadBtnEl.dataset.demoAvailable;

    if (this.originalDisabled !== null) {
      this.reloadBtnEl.disabled = this.originalDisabled;
      this.originalDisabled = null;
    }
    this.browserNavigator?.updateButtons();
  }
}
