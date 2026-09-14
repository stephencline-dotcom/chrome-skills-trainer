/**
 * Controls simulated browser pages and Back/Forward history.
 * This never navigates the real browser.
 */
export class BrowserNavigator {
  constructor({
    backButton,
    forwardButton,
    reloadButton,
    addressElement,
    contentElement
  }) {
    this.backButton = backButton;
    this.forwardButton = forwardButton;
    this.reloadButton = reloadButton;
    this.addressElement = addressElement;
    this.contentElement = contentElement;

    this.reloadCount = 0;
    this.history = ['home'];
    this.historyIndex = 0;
    this.interactionEnabled = true;
    this.allowedControls = null;

    this.handleBack = this.handleBack.bind(this);
    this.handleForward = this.handleForward.bind(this);
    this.handleReload = this.handleReload.bind(this);
    this.handleContentClick = this.handleContentClick.bind(this);
  }

  init() {
    this.backButton?.addEventListener('click', this.handleBack);
    this.forwardButton?.addEventListener('click', this.handleForward);
    this.reloadButton?.addEventListener('click', this.handleReload);
    this.contentElement?.addEventListener(
      'click',
      this.handleContentClick
    );

    this.render();
  }

  get currentPageId() {
    return this.history[this.historyIndex] || 'home';
  }

  canUse(control) {
    if (!this.interactionEnabled) return false;

    return !Array.isArray(this.allowedControls) ||
      this.allowedControls.includes(control);
  }

  setInteractionEnabled(enabled = true, allowedControls = null) {
    this.interactionEnabled = enabled;
    this.allowedControls = allowedControls;
    this.updateButtons();
    this.dispatch('browser:permissions-changed');
  }

  dispatch(name, detail = {}) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail
    });

    this.contentElement.dispatchEvent(event);
    return event;
  }

  handleBack() {
    const allowed =
      this.canUse('btn-back') && this.historyIndex > 0;

    const attempt = this.dispatch('browser:control-attempt', {
      control: 'btn-back',
      action: 'back',
      allowed
    });

    if (!allowed || attempt.defaultPrevented) return;

    this.historyIndex -= 1;
    this.render();

    this.dispatch('browser:back', {
      control: 'btn-back',
      action: 'back',
      pageId: this.currentPageId
    });
  }

  handleForward() {
    const allowed =
      this.canUse('btn-forward') &&
      this.historyIndex < this.history.length - 1;

    const attempt = this.dispatch('browser:control-attempt', {
      control: 'btn-forward',
      action: 'forward',
      allowed
    });

    if (!allowed || attempt.defaultPrevented) return;

    this.historyIndex += 1;
    this.render();

    this.dispatch('browser:forward', {
      control: 'btn-forward',
      action: 'forward',
      pageId: this.currentPageId
    });
  }

  handleReload() {
    const allowed = this.canUse('btn-reload');

    const attempt = this.dispatch('browser:control-attempt', {
      control: 'btn-reload',
      action: 'reload',
      allowed
    });

    if (!allowed || attempt.defaultPrevented) return;

    this.performReload();
  }

  // Demo setup can refresh without completing a student activity.
  performReload(emitEvent = true) {
    this.reloadCount += 1;
    this.render();

    if (this.contentElement?.animate) {
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      const cover = document.createElement('div');
      cover.className = 'reload-visual-cue';
      cover.setAttribute('role', 'status');
      cover.textContent = '↻ Refreshing page…';
      this.contentElement.appendChild(cover);

      const animation = cover.animate(
        reducedMotion
          ? [{ opacity: 1 }, { opacity: 1 }]
          : [
              { opacity: 1, offset: 0 },
              { opacity: 1, offset: 0.65 },
              { opacity: 0, offset: 1 }
            ],
        { duration: 1400, fill: 'forwards' }
      );

      animation.onfinish = () => cover.remove();
    }

    if (emitEvent) {
      this.dispatch('browser:reloaded', {
        control: 'btn-reload',
        action: 'reload',
        pageId: this.currentPageId
      });
    }
  }

  handleContentClick(event) {
    const link = event.target.closest('[data-simulated-page]');
    if (!link || !this.contentElement.contains(link)) return;

    event.preventDefault();

    if (!this.canUse('page-links')) {
      this.dispatch('browser:control-attempt', {
        control: 'page-links',
        action: 'navigate',
        allowed: false
      });
      return;
    }

    this.navigate(link.dataset.simulatedPage);
  }

  navigate(pageId) {
    if (!this.getPage(pageId)) return;

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(pageId);
    this.historyIndex = this.history.length - 1;
    this.render();

    this.dispatch('browser:navigated', {
      control: 'page-links',
      action: 'navigate',
      pageId
    });
  }

  reset(history = ['home'], historyIndex = 0) {
    this.reloadCount = 0;
    const validHistory = history.filter(
      (pageId) => this.getPage(pageId)
    );

    this.history = validHistory.length ? validHistory : ['home'];
    this.historyIndex = Math.max(
      0,
      Math.min(historyIndex, this.history.length - 1)
    );

    this.dispatch('browser:reset');
    this.render();
  }

  updateButtons() {
    if (this.backButton) {
      const interactionBlocked = !this.canUse('btn-back');
      this.backButton.disabled =
        interactionBlocked || this.historyIndex <= 0;
      this.backButton.classList.toggle(
        'control-disabled',
        interactionBlocked
      );
    }

    if (this.forwardButton) {
      const interactionBlocked = !this.canUse('btn-forward');
      this.forwardButton.disabled =
        interactionBlocked ||
        this.historyIndex >= this.history.length - 1;
      this.forwardButton.classList.toggle(
        'control-disabled',
        interactionBlocked
      );
    }

    if (this.reloadButton) {
      const interactionBlocked = !this.canUse('btn-reload');
      this.reloadButton.disabled = interactionBlocked;
      this.reloadButton.classList.toggle(
        'control-disabled',
        interactionBlocked
      );
    }
  }

  render() {
    const page = this.getPage(this.currentPageId) ||
      this.getPage('home');

    if (this.addressElement) {
      if ('value' in this.addressElement) {
        this.addressElement.value = page.address;
      } else {
        this.addressElement.textContent = page.address;
      }
    }

    if (this.contentElement) {
      this.contentElement.innerHTML = page.html;
    }

    this.updateButtons();
    this.dispatch('browser:rendered');
  }

  getPage(pageId) {
    return {
      noticeboard: {
        address: 'https://chrome-skills-trainer.local/noticeboard',
        html: `
          <article class="sim-page">
            <span class="sim-page-icon">📌</span>
            <h2>Class Noticeboard</h2>
            <p>${this.reloadCount === 0
              ? 'An updated class message is ready. Reload this page to see it.'
              : 'Latest class message: Bring your favorite book tomorrow!'}</p>
            <p><strong>${this.reloadCount === 0
              ? 'Showing the earlier message'
              : 'Page refreshed · ' + this.reloadCount +
                (this.reloadCount === 1 ? ' time' : ' times')}</strong></p>
            <p>This practice page changes to help you see a refresh.
            Real pages may look the same after reloading.</p>
          </article>
        `
      },
      home: {
        address: 'https://chrome-skills-trainer.local/home',
        html: `
          <div class="sim-page sim-page-home">
            <div class="sim-page-hero">
              <span class="sim-page-icon">🏫</span>
              <div>
                <h2>Student Learning Home</h2>
                <p>Choose a safe practice page to explore.</p>
              </div>
            </div>
            <div class="sim-page-link-grid">
              <button type="button" data-simulated-page="reading">📚 Reading Corner</button>
              <button type="button" data-simulated-page="science">🧪 Science Lab</button>
              <button type="button" data-simulated-page="art">🎨 Art Studio</button>
            </div>
          </div>
        `
      },
      reading: {
        address: 'https://chrome-skills-trainer.local/reading',
        html: `
          <article class="sim-page">
            <span class="sim-page-icon">📚</span>
            <h2>Reading Corner</h2>
            <p>Discover stories, characters, and new words.</p>
            <button type="button" data-simulated-page="story">Open Today’s Story</button>
          </article>
        `
      },
      story: {
        address: 'https://chrome-skills-trainer.local/story',
        html: `
          <article class="sim-page">
            <span class="sim-page-icon">🦉</span>
            <h2>The Helpful Owl</h2>
            <p>An owl helps the forest animals find their way home.</p>
            <button type="button" data-simulated-page="science">Visit Science Lab</button>
          </article>
        `
      },
      science: {
        address: 'https://chrome-skills-trainer.local/science',
        html: `
          <article class="sim-page">
            <span class="sim-page-icon">🧪</span>
            <h2>Science Lab</h2>
            <p>Explore plants, weather, space, and simple experiments.</p>
            <button type="button" data-simulated-page="space">Explore Space</button>
          </article>
        `
      },
      space: {
        address: 'https://chrome-skills-trainer.local/space',
        html: `
          <article class="sim-page">
            <span class="sim-page-icon">🚀</span>
            <h2>Space Explorer</h2>
            <p>Learn about planets, moons, and stars.</p>
            <button type="button" data-simulated-page="home">Return to Learning Home</button>
          </article>
        `
      },
      art: {
        address: 'https://chrome-skills-trainer.local/art',
        html: `
          <article class="sim-page">
            <span class="sim-page-icon">🎨</span>
            <h2>Art Studio</h2>
            <p>Practice colors, patterns, and creative design.</p>
            <button type="button" data-simulated-page="reading">Visit Reading Corner</button>
          </article>
        `
      }
    }[pageId] || null;
  }
}
