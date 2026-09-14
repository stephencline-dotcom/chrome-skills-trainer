import { BackForwardDemonstration } from './back-forward-demonstration.js';
import { BrowserNavigator } from './browser-navigator.js';
import { BrowserTabs } from './browser-tabs.js';

export class TabDemonstration extends BackForwardDemonstration {
  constructor(options) {
    super(options);
    this.kind = options.demonstrationType;
    this.savedPermissions = null;
    this.windowEl = options.windowEl;

    // Teacher Control uses the same tab renderer in its smaller preview.
    if (!this.browserNavigator) {
      const strip = document.createElement('div');
      strip.className = 'chrome-tabstrip';
      this.windowEl.querySelector('.demo-mini-titlebar > span')
        .replaceWith(strip);
      this.windowEl.classList.add('tab-demo-mini-window');

      this.browserNavigator = new BrowserNavigator({
        backButton: options.backBtnEl,
        forwardButton: options.forwardBtnEl,
        reloadButton: options.reloadBtnEl,
        addressElement: this.windowEl.querySelector('.demo-mini-address'),
        contentElement: options.pageLabelEl
      });
      this.browserNavigator.init();
      new BrowserTabs({
        browserNavigator: this.browserNavigator,
        windowManager: { close() {} },
        strip
      }).init();
    }
    this.tabs = this.browserNavigator.tabs;
  }

  play() {
    this.stop();
    if (!this.tabs) return;

    const nav = this.browserNavigator;
    this.savedPermissions = {
      enabled: nav.interactionEnabled,
      controls: nav.allowedControls
    };
    nav.setInteractionEnabled(false, []);
    const isNew = this.kind === 'new-tab-cycle';
    this.tabs.resetTabs(isNew ? ['reading'] : ['reading', 'science'], isNew ? 0 : 1);

    const cursor = this.createCursor();
    cursor.style.transform = 'translate(50vw, 55vh)';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const travel = reduced ? 0 : 700;
    const run = this.runId;

    const later = (delay, action) => {
      this.timers.push(window.setTimeout(() => {
        if (run === this.runId) action();
      }, delay));
    };

    const target = () => this.tabs.strip.querySelector(
      isNew ? '[data-simulator-control="new-tab"]' :
      this.kind === 'close-tab-cycle'
        ? '[data-simulator-control="close-tab"]'
        : '[data-simulator-control="switch-tab"]'
    );

    this.onCaption(
      isNew ? 'Reading Corner is already open. Watch the plus button.' :
      this.kind === 'close-tab-cycle'
        ? 'Two tabs are open. Watch the small X on the Science Lab tab.'
        : 'Science Lab is active. Watch the cursor choose Reading Corner.'
    );

    let clickedButton;
    later(400, () => this.moveCursorTo(target(), travel));
    later(600 + travel, () => {
      clickedButton = target();
      cursor.classList.add('is-clicking');
      clickedButton?.classList.add('demo-control-clicked');
    });
    later(900 + travel, () => {
      cursor.classList.remove('is-clicking');
      clickedButton?.classList.remove('demo-control-clicked');

      if (isNew) {
        this.tabs.resetTabs(['reading', 'home'], 1);
        this.onCaption('A new tab opened. Reading Corner is still open beside it.');
      } else if (this.kind === 'close-tab-cycle') {
        this.tabs.resetTabs(['reading'], 0);
        this.onCaption('Only Science Lab closed. Reading Corner and the window stayed open.');
      } else {
        this.tabs.resetTabs(['reading', 'science'], 0);
        this.onCaption('Reading Corner is now active. Science Lab is still open.');
      }
    });

    if (this.kind === 'switch-tab-cycle') {
      later(2300 + travel, () => {
        this.moveCursorTo(target(), travel);
        this.onCaption('Now click Science Lab to switch back.');
      });
      later(2500 + travel * 2, () => cursor.classList.add('is-clicking'));
      later(2800 + travel * 2, () => {
        cursor.classList.remove('is-clicking');
        this.tabs.resetTabs(['reading', 'science'], 1);
        this.onCaption('Both pages stayed open. Clicking a tab chooses which page you see.');
      });
    }

    later(4700 + travel * 2, () => {
      cursor.remove();
      this.cursorEl = null;
    });
  }

  stop() {
    super.stop();
    if (this.savedPermissions) {
      this.browserNavigator.setInteractionEnabled(
        this.savedPermissions.enabled,
        this.savedPermissions.controls
      );
      this.savedPermissions = null;
    }
    this.tabs?.strip.querySelectorAll('.demo-control-clicked')
      .forEach(button => button.classList.remove('demo-control-clicked'));
  }
}
