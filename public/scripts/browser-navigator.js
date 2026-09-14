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
    this.searchQuery = '';
    this.history = ['home'];
    this.historyIndex = 0;
    this.interactionEnabled = true;
    this.allowedControls = null;

    this.handleBack = this.handleBack.bind(this);
    this.handleForward = this.handleForward.bind(this);
    this.handleReload = this.handleReload.bind(this);
    this.handleAddressFocus = this.handleAddressFocus.bind(this);
    this.handleAddressClick = this.handleAddressClick.bind(this);
    this.handleAddressKeyDown = this.handleAddressKeyDown.bind(this);
    this.handleContentClick = this.handleContentClick.bind(this);
  }

  init() {
    this.backButton?.addEventListener('click', this.handleBack);
    this.forwardButton?.addEventListener('click', this.handleForward);
    this.reloadButton?.addEventListener('click', this.handleReload);
    this.addressElement?.addEventListener(
      'focus',
      this.handleAddressFocus
    );
    this.addressElement?.addEventListener(
      'click',
      this.handleAddressClick
    );
    this.addressElement?.addEventListener(
      'keydown',
      this.handleAddressKeyDown
    );
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

  handleAddressFocus() {
    const allowed = this.canUse('btn-address-bar');

    const attempt = this.dispatch('browser:control-attempt', {
      control: 'btn-address-bar',
      action: 'address-focus',
      allowed
    });

    if (!allowed || attempt.defaultPrevented) {
      this.addressElement?.blur();
      return;
    }

    this.addressElement?.select();
  }

  handleAddressClick() {
    if (!this.canUse('btn-address-bar')) return;
    this.addressElement?.select();
  }

  handleAddressKeyDown(event) {
    if (event.key !== 'Enter') return;

    event.preventDefault();

    const allowed = this.canUse('btn-address-bar');

    const attempt = this.dispatch('browser:control-attempt', {
      control: 'btn-address-bar',
      action: 'address-submit',
      allowed
    });

    if (!allowed || attempt.defaultPrevented) return;

    this.submitAddress(this.addressElement?.value || '');
  }

  submitAddress(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return;

    const normalized = value
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');

    const directPages = {
      'chrome-skills-trainer.local/home': 'home',
      'chrome-skills-trainer.local/reading': 'reading',
      'chrome-skills-trainer.local/story': 'story',
      'chrome-skills-trainer.local/science': 'science',
      'chrome-skills-trainer.local/space': 'space',
      'chrome-skills-trainer.local/art': 'art',
      'chrome-skills-trainer.local/noticeboard': 'noticeboard',
      'nasa.gov': 'nasa',
      'www.nasa.gov': 'nasa'
    };

    let pageId = directPages[normalized] || null;
    let action = 'address-go';

    if (!pageId) {
      this.searchQuery = value;
      pageId = 'search';
      action = 'address-search';
    }

    this.history = this.history.slice(
      0,
      this.historyIndex + 1
    );
    this.history.push(pageId);
    this.historyIndex = this.history.length - 1;

    this.render();

    this.dispatch('browser:address-submitted', {
      control: 'btn-address-bar',
      action,
      pageId,
      value
    });
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
    this.searchQuery = '';
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

    if (this.addressElement && 'readOnly' in this.addressElement) {
      const interactionBlocked =
        !this.canUse('btn-address-bar');

      this.addressElement.readOnly = interactionBlocked;

      this.addressElement
        .closest('.chrome-address-bar')
        ?.classList.toggle(
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
    const safeSearchQuery =
      this.escapeHtml(this.searchQuery);

    return {
      search: {
        address:
          'https://www.google.com/search?q=' +
          encodeURIComponent(this.searchQuery),
        html: `
          <div
            style="
              min-height: 100%;
              background: white;
              font-family: Arial, Helvetica, sans-serif;
              color: #202124;
              padding: 20px 32px 36px;
            "
          >
            <div
              style="
                display: flex;
                align-items: center;
                gap: 18px;
                padding-bottom: 14px;
                border-bottom: 1px solid #dadce0;
              "
            >
              <div
                style="
                  font-size: 24px;
                  font-weight: 700;
                  letter-spacing: -1px;
                "
              >
                <span style="color:#4285f4;">G</span><span style="color:#ea4335;">o</span><span style="color:#fbbc05;">o</span><span style="color:#4285f4;">g</span><span style="color:#34a853;">l</span><span style="color:#ea4335;">e</span>
              </div>

              <div
                style="
                  flex: 1;
                  max-width: 640px;
                  border: 1px solid #dfe1e5;
                  border-radius: 24px;
                  padding: 10px 16px;
                  box-shadow: 0 1px 4px rgba(32,33,36,.15);
                  font-size: 15px;
                "
              >
                ${safeSearchQuery}
              </div>
            </div>

            <div
              style="
                max-width: 720px;
                padding-top: 18px;
              "
            >
              <div
                style="
                  color: #70757a;
                  font-size: 12px;
                  margin-bottom: 18px;
                "
              >
                Simulated search results
              </div>

              ${
                this.searchQuery.trim().toLowerCase() ===
                'ocean animals'
                  ? `
                    <section
                      style="
                        margin-bottom: 24px;
                      "
                    >
                      <div
                        style="
                          font-size: 13px;
                          color: #4d5156;
                          margin-bottom: 4px;
                        "
                      >
                        kids.oceanexplorer.local › animals
                      </div>

                      <h2
                        style="
                          color: #1a0dab;
                          font-size: 20px;
                          font-weight: 500;
                          margin: 0 0 6px;
                        "
                      >
                        Amazing Ocean Animals
                      </h2>

                      <p
                        style="
                          margin: 0;
                          color: #4d5156;
                          line-height: 1.5;
                          font-size: 14px;
                        "
                      >
                        Explore whales, dolphins, sharks,
                        sea turtles, octopuses, and other
                        animals that live in Earth's oceans.
                      </p>
                    </section>

                    <section
                      style="
                        margin: 4px 0 26px;
                      "
                    >
                      <h3
                        style="
                          margin: 0 0 12px;
                          font-size: 18px;
                          font-weight: 500;
                        "
                      >
                        Images for ocean animals
                      </h3>

                      <div
                        style="
                          display: grid;
                          grid-template-columns:
                            repeat(4, minmax(0, 1fr));
                          gap: 10px;
                        "
                      >
                        <div
                          style="
                            height: 105px;
                            border-radius: 10px;
                            background:
                              linear-gradient(
                                #6dd5ed,
                                #1b75bb
                              );
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 52px;
                          "
                        >
                          🐋
                        </div>

                        <div
                          style="
                            height: 105px;
                            border-radius: 10px;
                            background:
                              linear-gradient(
                                #74ebd5,
                                #2b7a78
                              );
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 52px;
                          "
                        >
                          🐢
                        </div>

                        <div
                          style="
                            height: 105px;
                            border-radius: 10px;
                            background:
                              linear-gradient(
                                #89f7fe,
                                #1e5799
                              );
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 52px;
                          "
                        >
                          🐙
                        </div>

                        <div
                          style="
                            height: 105px;
                            border-radius: 10px;
                            background:
                              linear-gradient(
                                #a1c4fd,
                                #194a7a
                              );
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 52px;
                          "
                        >
                          🦈
                        </div>
                      </div>
                    </section>

                    <section
                      style="
                        margin-bottom: 24px;
                      "
                    >
                      <div
                        style="
                          font-size: 13px;
                          color: #4d5156;
                          margin-bottom: 4px;
                        "
                      >
                        seaturtles.local › learn
                      </div>

                      <h2
                        style="
                          color: #1a0dab;
                          font-size: 20px;
                          font-weight: 500;
                          margin: 0 0 6px;
                        "
                      >
                        Sea Turtle Facts for Kids
                      </h2>

                      <p
                        style="
                          margin: 0;
                          color: #4d5156;
                          line-height: 1.5;
                          font-size: 14px;
                        "
                      >
                        Sea turtles breathe air, swim long
                        distances, and return to beaches to
                        lay their eggs.
                      </p>
                    </section>

                    <section
                      style="
                        margin-bottom: 24px;
                      "
                    >
                      <div
                        style="
                          font-size: 13px;
                          color: #4d5156;
                          margin-bottom: 4px;
                        "
                      >
                        marinelife.local › octopus
                      </div>

                      <h2
                        style="
                          color: #1a0dab;
                          font-size: 20px;
                          font-weight: 500;
                          margin: 0 0 6px;
                        "
                      >
                        Meet the Giant Pacific Octopus
                      </h2>

                      <p
                        style="
                          margin: 0;
                          color: #4d5156;
                          line-height: 1.5;
                          font-size: 14px;
                        "
                      >
                        Octopuses have eight arms, excellent
                        camouflage, and are known for solving
                        problems.
                      </p>
                    </section>
                  `
                  : `
                    <section
                      style="
                        margin-bottom: 24px;
                      "
                    >
                      <div
                        style="
                          font-size: 13px;
                          color: #4d5156;
                          margin-bottom: 4px;
                        "
                      >
                        studentresearch.local › search
                      </div>

                      <h2
                        style="
                          color: #1a0dab;
                          font-size: 20px;
                          font-weight: 500;
                          margin: 0 0 6px;
                        "
                      >
                        Learn about ${safeSearchQuery}
                      </h2>

                      <p
                        style="
                          margin: 0;
                          color: #4d5156;
                          line-height: 1.5;
                          font-size: 14px;
                        "
                      >
                        This simulated result helps you
                        practice using Chrome to search for
                        information about ${safeSearchQuery}.
                      </p>
                    </section>

                    <section>
                      <div
                        style="
                          font-size: 13px;
                          color: #4d5156;
                          margin-bottom: 4px;
                        "
                      >
                        classroomguide.local › topics
                      </div>

                      <h2
                        style="
                          color: #1a0dab;
                          font-size: 20px;
                          font-weight: 500;
                          margin: 0 0 6px;
                        "
                      >
                        Student Guide: ${safeSearchQuery}
                      </h2>

                      <p
                        style="
                          margin: 0;
                          color: #4d5156;
                          line-height: 1.5;
                          font-size: 14px;
                        "
                      >
                        Explore safe classroom information
                        related to your search.
                      </p>
                    </section>
                  `
              }

              <div
                style="
                  margin-top: 28px;
                  padding: 11px 13px;
                  background: #f8f9fa;
                  border: 1px solid #dadce0;
                  border-radius: 8px;
                  color: #5f6368;
                  font-size: 11px;
                "
              >
                Practice simulation: these results are
                created inside Chrome Skills Trainer and do
                not connect to the real internet.
              </div>
            </div>
          </div>
        `
      },
      nasa: {
        address: 'https://www.nasa.gov',
        html: `
          <div
            style="
              min-height: 100%;
              background: #f5f7fa;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
            "
          >
            <header
              style="
                background: #071a33;
                color: white;
                padding: 12px 22px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
              "
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  gap: 12px;
                "
              >
                <div
                  style="
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: #0b3d91;
                    border: 2px solid white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    font-weight: 800;
                    letter-spacing: 1px;
                  "
                >
                  NASA
                </div>

                <div>
                  <div
                    style="
                      font-size: 22px;
                      font-weight: 800;
                    "
                  >
                    NASA
                  </div>
                  <div
                    style="
                      font-size: 11px;
                      opacity: 0.75;
                    "
                  >
                    Simulated Practice Website
                  </div>
                </div>
              </div>

              <nav
                style="
                  display: flex;
                  gap: 18px;
                  font-size: 13px;
                  font-weight: 600;
                "
              >
                <span>Explore</span>
                <span>Missions</span>
                <span>Earth</span>
                <span>Space</span>
              </nav>
            </header>

            <section
              style="
                position: relative;
                min-height: 235px;
                overflow: hidden;
                background:
                  linear-gradient(
                    135deg,
                    #071a33 0%,
                    #102a56 45%,
                    #000814 100%
                  );
                color: white;
                padding: 30px 34px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 28px;
              "
            >
              <div
                style="
                  position: absolute;
                  inset: 0;
                  opacity: 0.85;
                  pointer-events: none;
                "
              >
                <svg
                  viewBox="0 0 1000 350"
                  preserveAspectRatio="xMidYMid slice"
                  style="
                    width: 100%;
                    height: 100%;
                    display: block;
                  "
                  aria-hidden="true"
                >
                  <rect width="1000" height="350" fill="#071426"/>

                  <g fill="#ffffff">
                    <circle cx="70" cy="45" r="2"/>
                    <circle cx="150" cy="90" r="1.4"/>
                    <circle cx="230" cy="42" r="1.8"/>
                    <circle cx="310" cy="115" r="1.2"/>
                    <circle cx="395" cy="55" r="2"/>
                    <circle cx="475" cy="96" r="1.5"/>
                    <circle cx="565" cy="36" r="1.8"/>
                    <circle cx="650" cy="110" r="1.3"/>
                    <circle cx="735" cy="52" r="2"/>
                    <circle cx="820" cy="88" r="1.5"/>
                    <circle cx="915" cy="42" r="2"/>
                    <circle cx="965" cy="125" r="1.2"/>
                    <circle cx="115" cy="205" r="1.4"/>
                    <circle cx="275" cy="245" r="1.6"/>
                    <circle cx="410" cy="210" r="1.2"/>
                    <circle cx="535" cy="270" r="1.8"/>
                    <circle cx="690" cy="225" r="1.4"/>
                    <circle cx="895" cy="255" r="1.8"/>
                  </g>

                  <defs>
                    <radialGradient id="earthGlow">
                      <stop offset="0%" stop-color="#8fd3ff"/>
                      <stop offset="68%" stop-color="#2364aa"/>
                      <stop offset="100%" stop-color="#12345b"/>
                    </radialGradient>

                    <clipPath id="earthClip">
                      <circle cx="800" cy="200" r="122"/>
                    </clipPath>
                  </defs>

                  <circle
                    cx="800"
                    cy="200"
                    r="134"
                    fill="#2d80d3"
                    opacity="0.18"
                  />

                  <circle
                    cx="800"
                    cy="200"
                    r="122"
                    fill="url(#earthGlow)"
                  />

                  <g
                    clip-path="url(#earthClip)"
                    fill="#68a357"
                    opacity="0.95"
                  >
                    <ellipse
                      cx="755"
                      cy="145"
                      rx="65"
                      ry="30"
                      transform="rotate(-18 755 145)"
                    />
                    <ellipse
                      cx="850"
                      cy="205"
                      rx="72"
                      ry="38"
                      transform="rotate(22 850 205)"
                    />
                    <ellipse
                      cx="770"
                      cy="255"
                      rx="45"
                      ry="24"
                      transform="rotate(8 770 255)"
                    />
                  </g>

                  <ellipse
                    cx="770"
                    cy="150"
                    rx="105"
                    ry="22"
                    fill="#ffffff"
                    opacity="0.18"
                    transform="rotate(-12 770 150)"
                  />
                </svg>
              </div>

              <div
                style="
                  position: relative;
                  z-index: 1;
                  max-width: 460px;
                "
              >
                <div
                  style="
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    color: #9ecbff;
                    margin-bottom: 8px;
                  "
                >
                  Featured
                </div>

                <h2
                  style="
                    margin: 0 0 12px;
                    font-size: 34px;
                    line-height: 1.05;
                    color: white;
                  "
                >
                  Explore Our Universe
                </h2>

                <p
                  style="
                    margin: 0;
                    max-width: 420px;
                    font-size: 16px;
                    line-height: 1.55;
                    color: #e5eefb;
                  "
                >
                  Discover planets, stars, Earth science,
                  spacecraft, and the people who explore space.
                </p>
              </div>
            </section>

            <main
              style="
                padding: 24px 28px 30px;
              "
            >
              <h3
                style="
                  margin: 0 0 16px;
                  font-size: 22px;
                "
              >
                Explore NASA
              </h3>

              <div
                style="
                  display: grid;
                  grid-template-columns:
                    repeat(3, minmax(0, 1fr));
                  gap: 14px;
                "
              >
                <article
                  style="
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow:
                      0 2px 8px rgba(15, 23, 42, 0.14);
                  "
                >
                  <div
                    style="
                      height: 92px;
                      background:
                        linear-gradient(
                          145deg,
                          #8d321f,
                          #d76a3c,
                          #4c1d16
                        );
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 48px;
                    "
                  >
                    🔴
                  </div>

                  <div style="padding: 14px;">
                    <strong>Explore Mars</strong>
                    <p
                      style="
                        margin: 7px 0 0;
                        font-size: 13px;
                        line-height: 1.4;
                        color: #475569;
                      "
                    >
                      Learn about rovers, craters,
                      and the Red Planet.
                    </p>
                  </div>
                </article>

                <article
                  style="
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow:
                      0 2px 8px rgba(15, 23, 42, 0.14);
                  "
                >
                  <div
                    style="
                      height: 92px;
                      background:
                        linear-gradient(
                          145deg,
                          #155e75,
                          #38bdf8,
                          #14532d
                        );
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 48px;
                    "
                  >
                    🌎
                  </div>

                  <div style="padding: 14px;">
                    <strong>Earth Science</strong>
                    <p
                      style="
                        margin: 7px 0 0;
                        font-size: 13px;
                        line-height: 1.4;
                        color: #475569;
                      "
                    >
                      See how scientists study
                      our planet from space.
                    </p>
                  </div>
                </article>

                <article
                  style="
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow:
                      0 2px 8px rgba(15, 23, 42, 0.14);
                  "
                >
                  <div
                    style="
                      height: 92px;
                      background:
                        linear-gradient(
                          145deg,
                          #172554,
                          #312e81,
                          #020617
                        );
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 48px;
                    "
                  >
                    🚀
                  </div>

                  <div style="padding: 14px;">
                    <strong>Space Missions</strong>
                    <p
                      style="
                        margin: 7px 0 0;
                        font-size: 13px;
                        line-height: 1.4;
                        color: #475569;
                      "
                    >
                      Discover spacecraft traveling
                      across our solar system.
                    </p>
                  </div>
                </article>
              </div>

              <div
                style="
                  margin-top: 20px;
                  padding: 12px 14px;
                  border-left: 4px solid #0b3d91;
                  background: #eaf2ff;
                  border-radius: 6px;
                  font-size: 12px;
                  color: #334155;
                "
              >
                This is a simulated practice page inside
                Chrome Skills Trainer. No real NASA website
                was opened.
              </div>
            </main>
          </div>
        `
      },
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
