import { BackForwardDemonstration } from './back-forward-demonstration.js';

export class AddressBarDemonstration extends BackForwardDemonstration {
  constructor(options) {
    super(options);

    this.addressBarEl = options.addressBarEl;
    this.addressElement = options.addressElement;
    this.originalAddress = '';
  }

  setAddressText(text) {
    if (!this.addressElement) return;

    if ('value' in this.addressElement) {
      this.addressElement.value = text;
    } else {
      this.addressElement.textContent = text;
    }
  }

  getAddressText() {
    if (!this.addressElement) return '';

    if ('value' in this.addressElement) {
      return this.addressElement.value;
    }

    return this.addressElement.textContent || '';
  }

  typeText(text, startDelay, runId) {
    let typed = '';

    [...text].forEach((character, index) => {
      this.timers.push(
        window.setTimeout(() => {
          if (runId !== this.runId) return;

          typed += character;
          this.setAddressText(typed);
        }, startDelay + index * 95)
      );
    });

    return startDelay + text.length * 95;
  }

  play() {
    this.stop();

    if (
      !this.addressBarEl ||
      !this.addressElement ||
      !this.browserNavigator
    ) {
      return;
    }

    this.browserNavigator.reset(['home'], 0);

    this.originalAddress = this.getAddressText();

    const cursor = this.createCursor();
    cursor.style.transform = 'translate(50vw, 55vh)';

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const travel = reduced ? 0 : 700;
    const runId = this.runId;

    const later = (delay, action) => {
      this.timers.push(
        window.setTimeout(() => {
          if (runId === this.runId) {
            action();
          }
        }, delay)
      );
    };

    this.onCaption(
      'First, click the Address Bar.'
    );

    later(350, () => {
      this.moveCursorTo(
        this.addressBarEl,
        travel
      );

      this.onCaption(
        'Click the Address Bar. The old address is selected.'
      );
    });

    later(550 + travel, () => {
      cursor.classList.add('is-clicking');
      this.addressBarEl.classList.add(
        'demo-control-clicked'
      );
    });

    later(850 + travel, () => {
      cursor.classList.remove('is-clicking');

      this.setAddressText('');

      this.addressBarEl.style.boxShadow =
        '0 0 0 3px rgba(37, 99, 235, 0.35)';

      this.onCaption(
        'Now type the website address: nasa.gov'
      );
    });

    const typingEnds = this.typeText(
      'nasa.gov',
      1100 + travel,
      runId
    );

    later(typingEnds + 250, () => {
      this.onCaption(
        'Press Enter to go to the website.'
      );
    });

    later(typingEnds + 900, () => {
      this.browserNavigator.submitAddress(
        'nasa.gov',
        false
      );

      this.onCaption(
        'Great! Click, type, Enter — Chrome goes to the website.'
      );

      this.addressBarEl.style.boxShadow = '';
      this.addressBarEl.classList.remove(
        'demo-control-clicked'
      );
    });

    later(typingEnds + 2800, () => {
      cursor.remove();
      this.cursorEl = null;
    });
  }

  stop() {
    super.stop();

    if (this.addressBarEl) {
      this.addressBarEl.classList.remove(
        'demo-control-clicked'
      );

      this.addressBarEl.style.boxShadow = '';
    }
  }
}
