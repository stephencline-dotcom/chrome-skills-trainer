import { BackForwardDemonstration } from './back-forward-demonstration.js';

/**
 * Animated Bookmark demonstration.
 * Demonstrates the complete Chrome bookmark flow without firing
 * the student's real lesson-completion event.
 */
export class BookmarkDemonstration extends BackForwardDemonstration {
  constructor(options) {
    super(options);
    this.bookmarkBtnEl = options.bookmarkBtnEl;
  }

  stop() {
    super.stop();

    this.browserNavigator?.hideBookmarkPopup?.();

    if (this.browserNavigator?.bookmarkedPages) {
      this.browserNavigator.bookmarkedPages.delete('reading');
      this.browserNavigator.updateButtons?.();
      this.browserNavigator.renderBookmarksBar?.();
    }
  }

  async play() {
    this.stop();

    if (!this.bookmarkBtnEl || !this.browserNavigator) return;

    const runId = this.runId;
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const travelTime = reducedMotion ? 100 : 650;

    // Always begin the demonstration with Reading Corner not bookmarked.
    this.browserNavigator.bookmarkedPages.delete('reading');
    this.browserNavigator.reset(['home', 'reading'], 1);
    this.browserNavigator.renderBookmarksBar?.();
    this.browserNavigator.hideBookmarkPopup?.();

    this.onCaption(
      'We are on Reading Corner and want to save this page.'
    );

    const cursor = this.createCursor();
    cursor.style.transform = 'translate(50vw, 55vh)';

    await this.wait(reducedMotion ? 100 : 450, runId);
    if (runId !== this.runId) return;

    this.onCaption(
      'The cursor moves to the star at the right side of the Address Bar.'
    );

    this.moveCursorTo(this.bookmarkBtnEl, travelTime);

    await this.wait(travelTime + 150, runId);
    if (runId !== this.runId) return;

    this.onCaption(
      'Click the star to bookmark this page.'
    );

    await this.click(this.bookmarkBtnEl, runId);
    if (runId !== this.runId) return;

    // Change the visual browser state directly. This intentionally avoids
    // sending the student's real browser:bookmarked completion event.
    this.browserNavigator.bookmarkedPages.add('reading');
    this.browserNavigator.updateButtons?.();
    this.browserNavigator.renderBookmarksBar?.();
    this.browserNavigator.showBookmarkSavedPopup?.();

    this.onCaption(
      'The star turns blue and the Bookmark added box appears.'
    );

    await this.wait(reducedMotion ? 250 : 900, runId);
    if (runId !== this.runId) return;

    const doneButton =
      document.querySelector('.bookmark-saved-done');

    if (doneButton) {
      this.onCaption(
        'Click Done to finish saving the bookmark.'
      );

      this.moveCursorTo(doneButton, travelTime);

      await this.wait(travelTime + 150, runId);
      if (runId !== this.runId) return;

      doneButton.classList.add('demo-control-clicked');
      doneButton.click();

      await this.wait(reducedMotion ? 100 : 220, runId);
      doneButton.classList.remove('demo-control-clicked');
    } else {
      this.browserNavigator.hideBookmarkPopup?.();
    }

    if (runId !== this.runId) return;

    this.onCaption(
      'Done! Reading Corner is now saved on the Bookmarks Bar.'
    );

    await this.wait(reducedMotion ? 400 : 1200, runId);

    if (runId === this.runId && this.cursorEl) {
      this.cursorEl.remove();
      this.cursorEl = null;
    }
  }
}
