const ATTEMPT_KEY = 'chromeQuickAssessmentAttemptV1';

const QUESTION_IDS = [
  'minimize-restore',
  'maximize-restore',
  'close-reopen',
  'back-forward',
  'reload',
  'home',
  'address-bar',
  'tabs',
  'bookmark',
  'bookmarks-bar'
];

const QUESTION_TEXT = {
  'minimize-restore':
    'Minimize Chrome, then bring it back.',
  'maximize-restore':
    'Make Chrome fill the screen, then return it to normal size.',
  'close-reopen':
    'Close Chrome, then open it again.',
  'back-forward':
    'Go Back, then go Forward again.',
  'reload':
    'Reload this webpage.',
  'home':
    'Go back to the Home page.',
  'address-bar':
    'Type nasa.gov in the Address Bar, then press Enter.',
  'tabs':
    'Open a new tab, switch to the other tab, then close the extra tab.',
  'bookmark':
    'Bookmark this page.',
  'bookmarks-bar':
    'Open Science Lab from the Bookmarks Bar.'
};

const WATCHED_EVENTS = [
  'window:minimized',
  'window:maximized',
  'window:restored',
  'window:taskbar-restored',
  'window:closed',
  'window:opened',
  'browser:back',
  'browser:forward',
  'browser:navigated',
  'browser:reloaded',
  'browser:address-submitted',
  'browser:tab-opened',
  'browser:tab-switched',
  'browser:tab-closed',
  'browser:bookmarked',
  'browser:bookmark-opened'
];

function secureShuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    let randomValue;

    if (globalThis.crypto?.getRandomValues) {
      const buffer = new Uint32Array(1);
      globalThis.crypto.getRandomValues(buffer);
      randomValue = buffer[0] / 4294967296;
    } else {
      randomValue = Math.random();
    }

    const j = Math.floor(randomValue * (i + 1));

    [result[i], result[j]] =
      [result[j], result[i]];
  }

  return result;
}

export class AssessmentController {
  constructor({
    skill,
    windowManager,
    browserNavigator,
    browserTabs
  }) {
    this.skill = skill;
    this.windowManager = windowManager;
    this.browserNavigator = browserNavigator;
    this.browserTabs = browserTabs;

    this.titleEl =
      document.getElementById(
        'instruction-card-title'
      );

    this.bodyEl =
      document.getElementById(
        'instruction-card-body'
      );

    this.stepBadgeEl =
      document.getElementById(
        'instruction-step-badge'
      );

    this.modeBarEl =
      document.getElementById(
        'student-mode-bar'
      );

    this.attempt = null;
    this.settingUp = false;
    this.locked = false;
    this.openedTabId = null;

    this.handleAssessmentEvent =
      this.handleAssessmentEvent.bind(this);
  }

  init() {
    WATCHED_EVENTS.forEach(eventName => {
      document.addEventListener(
        eventName,
        this.handleAssessmentEvent
      );
    });

    this.windowManager
      .setInteractionEnabled(true, null);

    this.browserNavigator
      .setInteractionEnabled(true, null);

    this.renderAssessmentModeBar();
    this.restoreOrJoin();
  }

  loadStoredAttempt() {
    try {
      const raw =
        sessionStorage.getItem(
          ATTEMPT_KEY
        );

      if (!raw) return null;

      const value = JSON.parse(raw);

      if (
        value?.assessmentId !==
        this.skill.assessmentId
      ) {
        return null;
      }

      if (
        !Array.isArray(value.order) ||
        value.order.length !==
        QUESTION_IDS.length
      ) {
        return null;
      }

      return value;
    } catch {
      return null;
    }
  }

  saveAttempt() {
    if (!this.attempt) return;

    sessionStorage.setItem(
      ATTEMPT_KEY,
      JSON.stringify(this.attempt)
    );
  }

  restoreOrJoin() {
    const stored =
      this.loadStoredAttempt();

    if (stored) {
      this.attempt = stored;

      if (stored.finished) {
        this.showFinalScreen(
          stored.score,
          !!stored.saved
        );
        return;
      }

      // If the page was refreshed in the middle of a
      // multi-action question, that question is lost.
      if (
        Number(stored.substep) > 0
      ) {
        this.attempt.currentIndex += 1;
        this.attempt.substep = 0;
        this.attempt.openedTabId = null;
        this.saveAttempt();
      }

      if (
        this.attempt.currentIndex >=
        this.attempt.order.length
      ) {
        this.finishAssessment();
        return;
      }

      this.startCurrentQuestion();
      return;
    }

    this.showJoinScreen();
  }

  renderAssessmentModeBar() {
    if (!this.modeBarEl) return;

    this.modeBarEl.style.display = 'flex';

    this.modeBarEl.innerHTML = `
      <div class="student-mode-bar-left">
        <span class="student-mode-badge is-independent">
          Quick Assessment
        </span>
        <span class="student-mode-sync-status">
          Work on your own screen.
        </span>
      </div>
    `;
  }

  showJoinScreen() {
    document
      .getElementById(
        'assessment-join-overlay'
      )
      ?.remove();

    const overlay =
      document.createElement('div');

    overlay.id =
      'assessment-join-overlay';

    overlay.className =
      'assessment-overlay';

    overlay.innerHTML = `
      <div class="assessment-join-card">
        <div class="assessment-flag">
          🏁
        </div>

        <h1>Quick Chrome Assessment</h1>

        <p class="assessment-join-help">
          Enter your class code and your name.
        </p>

        <form id="assessment-join-form">
          <label for="assessment-class-code">
            Class Code
          </label>

          <input
            id="assessment-class-code"
            type="text"
            maxlength="5"
            autocomplete="off"
            spellcheck="false"
            placeholder="ABCDE"
            required
          >

          <label for="assessment-student-name">
            Your Name
          </label>

          <input
            id="assessment-student-name"
            type="text"
            maxlength="80"
            autocomplete="off"
            placeholder="Type your name"
            required
          >

          <button
            type="submit"
            id="assessment-start-btn"
          >
            Start Assessment
          </button>

          <p
            id="assessment-join-message"
            class="assessment-join-message"
            aria-live="polite"
          ></p>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const codeInput =
      overlay.querySelector(
        '#assessment-class-code'
      );

    codeInput?.addEventListener(
      'input',
      () => {
        codeInput.value =
          codeInput.value
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ''
            )
            .slice(0, 5);
      }
    );

    overlay
      .querySelector(
        '#assessment-join-form'
      )
      ?.addEventListener(
        'submit',
        event => {
          event.preventDefault();
          this.joinAssessment(overlay);
        }
      );

    codeInput?.focus();
  }

  async joinAssessment(overlay) {
    const code =
      overlay
        .querySelector(
          '#assessment-class-code'
        )
        ?.value
        .trim()
        .toUpperCase() || '';

    const name =
      overlay
        .querySelector(
          '#assessment-student-name'
        )
        ?.value
        .trim() || '';

    const button =
      overlay.querySelector(
        '#assessment-start-btn'
      );

    const message =
      overlay.querySelector(
        '#assessment-join-message'
      );

    if (!code || !name) {
      message.textContent =
        'Enter your class code and name.';
      return;
    }

    button.disabled = true;
    message.textContent =
      'Checking your class...';

    try {
      const response = await fetch(
        '/api/assessment-join',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            code,
            name
          })
        }
      );

      const result =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Unable to join assessment.'
        );
      }

      overlay.remove();

      if (result.completed) {
        this.attempt = {
          assessmentId:
            this.skill.assessmentId,
          token: result.token,
          className:
            result.className,
          studentName:
            result.studentName,
          order:
            secureShuffle(
              QUESTION_IDS
            ),
          currentIndex:
            QUESTION_IDS.length,
          score:
            Number(result.score) || 0,
          substep: 0,
          openedTabId: null,
          finished: true,
          saved: true
        };

        this.saveAttempt();

        this.showFinalScreen(
          this.attempt.score,
          true
        );

        return;
      }

      this.attempt = {
        assessmentId:
          this.skill.assessmentId,
        token: result.token,
        className:
          result.className,
        studentName:
          result.studentName,
        order:
          secureShuffle(
            QUESTION_IDS
          ),
        currentIndex: 0,
        score: 0,
        substep: 0,
        openedTabId: null,
        finished: false,
        saved: false
      };

      this.saveAttempt();

      this.startCurrentQuestion();
    } catch (error) {
      message.textContent =
        error.message;

      button.disabled = false;
    }
  }

  get currentQuestionId() {
    return this.attempt?.order?.[
      this.attempt.currentIndex
    ] || null;
  }

  startCurrentQuestion() {
    if (!this.attempt) return;

    if (
      this.attempt.currentIndex >=
      this.attempt.order.length
    ) {
      this.finishAssessment();
      return;
    }

    this.settingUp = true;
    this.locked = false;

    this.attempt.substep = 0;
    this.attempt.openedTabId = null;

    this.openedTabId = null;

    const questionId =
      this.currentQuestionId;

    this.resetForQuestion(
      questionId
    );

    this.renderQuestion(
      questionId
    );

    this.saveAttempt();

    window.setTimeout(() => {
      this.settingUp = false;
    }, 80);
  }

  resetForQuestion(questionId) {
    this.windowManager
      .setInteractionEnabled(
        true,
        null
      );

    this.browserNavigator
      .setInteractionEnabled(
        true,
        null
      );

    this.windowManager
      .resetToDefault();

    this.browserNavigator
      .hideBookmarkPopup?.();

    this.browserNavigator
      .bookmarkedPages
      .clear();

    this.browserNavigator
      .renderBookmarksBar();

    switch (questionId) {
      case 'back-forward':
        this.browserNavigator.reset(
          ['home', 'science'],
          1
        );
        break;

      case 'reload':
        this.browserNavigator.reset(
          ['science'],
          0
        );
        break;

      case 'home':
        this.browserNavigator.reset(
          ['home', 'reading'],
          1
        );
        break;

      case 'address-bar':
        this.browserNavigator.reset(
          ['home'],
          0
        );
        break;

      case 'tabs':
        this.browserNavigator.reset(
          ['home'],
          0
        );

        this.browserTabs.resetTabs(
          ['home'],
          0
        );
        break;

      case 'bookmark':
        this.browserNavigator.reset(
          ['reading'],
          0
        );
        break;

      case 'bookmarks-bar':
        this.browserNavigator.reset(
          ['home'],
          0
        );

        this.browserNavigator
          .bookmarkedPages
          .add('reading');

        this.browserNavigator
          .bookmarkedPages
          .add('science');

        this.browserNavigator
          .bookmarkedPages
          .add('art');

        this.browserNavigator
          .renderBookmarksBar();
        break;

      default:
        this.browserNavigator.reset(
          ['home'],
          0
        );
        break;
    }
  }

  renderQuestion(questionId) {
    const index =
      this.attempt.currentIndex;

    const total =
      this.attempt.order.length;

    const questionText =
      QUESTION_TEXT[questionId];

    if (this.titleEl) {
      this.titleEl.textContent =
        'Chrome Skills Check';
    }

    if (this.stepBadgeEl) {
      this.stepBadgeEl.style.display =
        'inline-block';

      this.stepBadgeEl.textContent =
        `Question ${index + 1} of ${total}`;
    }

    if (this.bodyEl) {
      this.bodyEl.innerHTML = `
        <div class="assessment-task">
          <div class="assessment-task-number">
            ${index + 1}
          </div>

          <div class="assessment-task-main">
            <div class="assessment-task-label">
              DO THIS
            </div>

            <div class="assessment-task-text">
              ${questionText}
            </div>

            ${
              questionId === 'address-bar'
                ? `
                  <div class="assessment-enter-reminder">
                    <span class="assessment-enter-key">
                      ENTER ↵
                    </span>
                    <span>
                      Press Enter after typing nasa.gov
                    </span>
                  </div>
                `
                : ''
            }

            <button
              type="button"
              class="assessment-listen-btn"
            >
              🔊 Listen to Directions
            </button>

            <div class="assessment-one-try">
              One try — then the assessment moves on.
            </div>
          </div>
        </div>
      `;

      this.bodyEl
        .querySelector(
          '.assessment-listen-btn'
        )
        ?.addEventListener(
          'click',
          () => {
            this.speakQuestion(
              questionId
            );
          }
        );
    }
  }

  speakQuestion(questionId) {
    const text =
      QUESTION_TEXT[questionId];

    if (
      !text ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const spokenText =
      text.replace(
        /nasa\.gov/gi,
        'NASA dot gov'
      );

    const speech =
      new SpeechSynthesisUtterance(
        spokenText
      );

    speech.rate = 0.78;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(
      speech
    );
  }

  isExpectedHome(event) {
    return (
      event.type ===
        'browser:navigated' &&
      event.detail?.action ===
        'home' &&
      event.detail?.pageId ===
        'home'
    );
  }

  handleAssessmentEvent(event) {
    if (
      !this.attempt ||
      this.attempt.finished ||
      this.settingUp ||
      this.locked
    ) {
      return;
    }

    const questionId =
      this.currentQuestionId;

    if (!questionId) return;

    switch (questionId) {
      case 'minimize-restore':
        this.handleSequence(
          event,
          [
            ['window:minimized'],
            [
              'window:taskbar-restored',
              'window:restored'
            ]
          ]
        );
        break;

      case 'maximize-restore':
        this.handleSequence(
          event,
          [
            ['window:maximized'],
            ['window:restored']
          ]
        );
        break;

      case 'close-reopen':
        this.handleSequence(
          event,
          [
            ['window:closed'],
            ['window:opened']
          ]
        );
        break;

      case 'back-forward':
        this.handleSequence(
          event,
          [
            ['browser:back'],
            ['browser:forward']
          ]
        );
        break;

      case 'reload':
        this.completeFromSingleEvent(
          event,
          event.type ===
            'browser:reloaded'
        );
        break;

      case 'home':
        this.completeFromSingleEvent(
          event,
          this.isExpectedHome(event)
        );
        break;

      case 'address-bar':
        this.completeFromSingleEvent(
          event,
          event.type ===
            'browser:address-submitted' &&
          event.detail?.pageId ===
            'nasa'
        );
        break;

      case 'tabs':
        this.handleTabsQuestion(
          event
        );
        break;

      case 'bookmark':
        this.completeFromSingleEvent(
          event,
          event.type ===
            'browser:bookmarked'
        );
        break;

      case 'bookmarks-bar':
        this.handleBookmarksBarQuestion(
          event
        );
        break;

      default:
        break;
    }
  }

  handleSequence(
    event,
    expectedSteps
  ) {
    const substep =
      Number(
        this.attempt.substep
      ) || 0;

    const expected =
      expectedSteps[substep] || [];

    if (
      expected.includes(event.type)
    ) {
      const next =
        substep + 1;

      if (
        next >=
        expectedSteps.length
      ) {
        this.completeQuestion(true);
      } else {
        this.attempt.substep = next;
        this.saveAttempt();
      }

      return;
    }

    this.completeQuestion(false);
  }

  completeFromSingleEvent(
    event,
    isCorrect
  ) {
    // Every watched success action counts as
    // the student's one attempt.
    if (!WATCHED_EVENTS.includes(
      event.type
    )) {
      return;
    }

    this.completeQuestion(
      !!isCorrect
    );
  }

  handleTabsQuestion(event) {
    const substep =
      Number(
        this.attempt.substep
      ) || 0;

    if (
      substep === 0 &&
      event.type ===
        'browser:tab-opened'
    ) {
      this.openedTabId =
        event.detail?.tabId || null;

      this.attempt.openedTabId =
        this.openedTabId;

      this.attempt.substep = 1;
      this.saveAttempt();
      return;
    }

    if (
      substep === 1 &&
      event.type ===
        'browser:tab-switched' &&
      event.detail?.tabId !==
        this.attempt.openedTabId
    ) {
      this.attempt.substep = 2;
      this.saveAttempt();
      return;
    }

    if (
      substep === 2 &&
      event.type ===
        'browser:tab-closed' &&
      event.detail?.tabId ===
        this.attempt.openedTabId
    ) {
      this.completeQuestion(true);
      return;
    }

    this.completeQuestion(false);
  }

  handleBookmarksBarQuestion(event) {
    // Clicking a bookmark first performs the
    // page navigation, then emits bookmark-opened.
    // Ignore that internal navigation event.
    if (
      event.type ===
        'browser:navigated' &&
      event.detail?.action ===
        'navigate'
    ) {
      return;
    }

    const correct =
      event.type ===
        'browser:bookmark-opened' &&
      event.detail?.pageId ===
        'science';

    this.completeQuestion(
      correct
    );
  }

  completeQuestion(correct) {
    if (this.locked) return;

    this.locked = true;

    if (correct) {
      this.attempt.score += 1;
    }

    this.attempt.currentIndex += 1;
    this.attempt.substep = 0;
    this.attempt.openedTabId = null;

    this.saveAttempt();

    this.showQuestionFeedback(
      correct
    );

    window.setTimeout(() => {
      document
        .getElementById(
          'assessment-feedback'
        )
        ?.remove();

      if (
        this.attempt.currentIndex >=
        this.attempt.order.length
      ) {
        this.finishAssessment();
      } else {
        this.startCurrentQuestion();
      }
    }, 750);
  }

  showQuestionFeedback(correct) {
    document
      .getElementById(
        'assessment-feedback'
      )
      ?.remove();

    const feedback =
      document.createElement('div');

    feedback.id =
      'assessment-feedback';

    feedback.className =
      `assessment-feedback ${
        correct
          ? 'is-correct'
          : 'is-next'
      }`;

    feedback.innerHTML =
      correct
        ? '<strong>✓</strong><span>Got it!</span>'
        : '<strong>→</strong><span>Next question</span>';

    document.body.appendChild(
      feedback
    );
  }

  async finishAssessment() {
    if (!this.attempt) return;

    this.attempt.finished = true;
    this.attempt.substep = 0;

    this.saveAttempt();

    this.windowManager
      .setInteractionEnabled(
        false,
        []
      );

    this.browserNavigator
      .setInteractionEnabled(
        false,
        []
      );

    this.showFinalScreen(
      this.attempt.score,
      false,
      true
    );

    try {
      const response = await fetch(
        '/api/assessment-score',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            token:
              this.attempt.token,
            score:
              this.attempt.score
          })
        }
      );

      const result =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Score could not be sent.'
        );
      }

      this.attempt.saved = true;
      this.saveAttempt();

      this.showFinalScreen(
        this.attempt.score,
        true
      );
    } catch (error) {
      this.showFinalScreen(
        this.attempt.score,
        false,
        false,
        error.message
      );
    }
  }

  showFinalScreen(
    score,
    saved = false,
    saving = false,
    errorMessage = ''
  ) {
    document
      .getElementById(
        'assessment-final-overlay'
      )
      ?.remove();

    document
      .getElementById(
        'assessment-join-overlay'
      )
      ?.remove();

    const overlay =
      document.createElement('div');

    overlay.id =
      'assessment-final-overlay';

    overlay.className =
      'assessment-overlay assessment-final-overlay';

    const percent =
      Math.round(
        (Number(score) / 10) * 100
      );

    let statusText =
      'Keep this screen open for your teacher.';

    if (saving) {
      statusText =
        'Saving your score...';
    } else if (saved) {
      statusText =
        'Your score was sent to your teacher.';
    } else if (errorMessage) {
      statusText =
        'Keep this screen open. Your teacher can still see your score here.';
    }

    overlay.innerHTML = `
      <div class="assessment-final-card">
        <div class="assessment-finish-icon">
          🏁
        </div>

        <div class="assessment-student-name">
          ${this.escapeHtml(
            this.attempt?.studentName ||
            ''
          )}
        </div>

        <h1>Assessment Complete!</h1>

        <div class="assessment-final-score">
          ${Number(score)} / 10
        </div>

        <div class="assessment-final-percent">
          ${percent}%
        </div>

        <p class="assessment-final-status">
          ${this.escapeHtml(statusText)}
        </p>

        <p class="assessment-final-class">
          ${this.escapeHtml(
            this.attempt?.className ||
            ''
          )}
        </p>
      </div>
    `;

    document.body.appendChild(
      overlay
    );
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
