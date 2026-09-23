import { BackForwardDemonstration } from './back-forward-demonstration.js';

/**
 * Animated Bookmarks Bar demonstration.
 * Shows the cursor opening Reading Corner from the saved bookmarks bar
 * without firing the student's real bookmark-open completion event.
 */
export class BookmarksBarDemonstration extends BackForwardDemonstration {
  constructor(options) {
    super(options);

    this.browserNavigator = options.browserNavigator;
    this.bookmarksBarEl = options.bookmarksBarEl;
  }

  async play() {
    this.stop();

    if (!this.browserNavigator || !this.bookmarksBarEl) return;

    const runId = this.runId;
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const travelTime = reducedMotion ? 100 : 650;

    // Always begin on Home with the lesson bookmarks available.
    this.browserNavigator.bookmarkedPages.clear();

    ['reading', 'science', 'art'].forEach((pageId) => {
      this.browserNavigator.bookmarkedPages.add(pageId);
    });

    this.browserNavigator.reset(['home'], 0);
    this.browserNavigator.renderBookmarksBar();

    const readingBookmark =
      this.bookmarksBarEl.querySelector(
        '.chrome-bookmark-item[data-page-id="reading"]'
      );

    if (!readingBookmark) return;

    this.onCaption(
      'The Bookmarks Bar holds webpages we have already saved.'
    );

    const cursor = this.createCursor();
    cursor.style.transform = 'translate(50vw, 55vh)';

    await this.wait(reducedMotion ? 100 : 500, runId);
    if (runId !== this.runId) return;

    this.onCaption(
      'Move to Reading Corner on the Bookmarks Bar.'
    );

    this.moveCursorTo(
      readingBookmark,
      travelTime
    );

    await this.wait(travelTime + 150, runId);
    if (runId !== this.runId) return;

    this.onCaption(
      'Click the bookmark once to open the saved webpage.'
    );

    await this.click(
      readingBookmark,
      runId
    );

    if (runId !== this.runId) return;

    // Show the result without firing browser:bookmark-opened.
    this.browserNavigator.reset(
      ['home', 'reading'],
      1
    );

    this.browserNavigator.renderBookmarksBar();

    this.onCaption(
      'Reading Corner opens right away. The bookmark remembered where to go!'
    );

    await this.wait(
      reducedMotion ? 500 : 1600,
      runId
    );

    if (
      runId === this.runId &&
      this.cursorEl
    ) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }
  }
}
