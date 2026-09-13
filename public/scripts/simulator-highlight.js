/**
 * simulator-highlight.js
 * Reusable, non-clipping target-control highlight overlay used by both
 * Student Practice and Classroom Presentation.
 *
 * Root cause fix: the simulated Chrome window (#chrome-window) and its
 * ancestors use `overflow: hidden` to render rounded window corners. Adding
 * a highlight class directly to a control button (e.g. a box-shadow ring)
 * gets clipped whenever the ring extends past those container edges - which
 * is exactly what happens for corner controls like Minimize. To avoid this,
 * the highlight ring and label are rendered as `position: fixed` elements
 * appended to <body>, positioned every frame from the target's
 * getBoundingClientRect(). Fixed-position elements are not clipped by
 * non-transformed ancestors with `overflow: hidden`, so the ring is always
 * fully visible regardless of the simulated window's stacking/clipping.
 */

export class SimulatorHighlight {
  constructor() {
    this.ringEl = null;
    this.labelEl = null;
    this.targetEl = null;
    this.rafId = null;
  }

  /**
   * Show a highlight ring (and optional label) around a target element.
   * @param {Element|null} targetEl
   * @param {string} [label]
   */
  show(targetEl, label = '') {
    this.clear();
    if (!targetEl) return;

    this.targetEl = targetEl;

    this.ringEl = document.createElement('div');
    this.ringEl.className = 'simulator-highlight-ring';
    document.body.appendChild(this.ringEl);

    if (label) {
      this.labelEl = document.createElement('div');
      this.labelEl.className = 'simulator-highlight-label';
      this.labelEl.textContent = label;
      document.body.appendChild(this.labelEl);
    }

    this.track();
  }

  /**
   * Continuously repositions the ring/label to follow the target element.
   */
  track() {
    const update = () => {
      if (!this.targetEl || !this.ringEl) return;

      const rect = this.targetEl.getBoundingClientRect();
      const pad = 6;

      this.ringEl.style.left = `${rect.left - pad}px`;
      this.ringEl.style.top = `${rect.top - pad}px`;
      this.ringEl.style.width = `${rect.width + pad * 2}px`;
      this.ringEl.style.height = `${rect.height + pad * 2}px`;

      if (this.labelEl) {
        const labelWidth = this.labelEl.offsetWidth || 0;
        this.labelEl.style.left = `${rect.left + rect.width / 2 - labelWidth / 2}px`;
        this.labelEl.style.top = `${rect.top - pad - 30}px`;
      }

      this.rafId = requestAnimationFrame(update);
    };

    update();
  }

  /**
   * Removes the highlight ring and label from the DOM.
   */
  clear() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.ringEl) {
      this.ringEl.remove();
      this.ringEl = null;
    }
    if (this.labelEl) {
      this.labelEl.remove();
      this.labelEl = null;
    }
    this.targetEl = null;
  }
}
