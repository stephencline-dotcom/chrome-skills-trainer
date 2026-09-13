/**
 * window-manager.js
 * Handles all state, positioning, user interactions, dragging, and window controls
 * for the simulated Chrome window inside the simulated Windows desktop environment.
 * Emits custom events for lesson engine tracking and exposes safe public control methods.
 */

export class WindowManager {
  /**
   * @param {Object} elements - DOM element references needed for window management
   */
  constructor(elements) {
    this.desktopWorkspace = elements.desktopWorkspace;
    this.windowEl = elements.windowEl;
    this.titlebarEl = elements.titlebarEl;
    this.btnMinimize = elements.btnMinimize;
    this.btnMaximize = elements.btnMaximize;
    this.btnClose = elements.btnClose;
    this.taskbarBtn = elements.taskbarBtn;

    // Window State
    this.isMinimized = false;
    this.isMaximized = false;
    this.isClosed = false;

    // Interaction Control for Lessons
    this.interactionEnabled = true;
    this.allowedControls = null; // null means all controls allowed

    // Default Restored Bounds
    this.defaultWidth = 860;
    this.defaultHeight = 560;
    this.restoredBounds = {
      left: 0,
      top: 0,
      width: this.defaultWidth,
      height: this.defaultHeight
    };

    // Dragging state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.windowStartX = 0;
    this.windowStartY = 0;

    // Bind event handlers to preserve context
    this.handleMinimize = this.handleMinimize.bind(this);
    this.handleMaximizeToggle = this.handleMaximizeToggle.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleTaskbarClick = this.handleTaskbarClick.bind(this);
    this.handleTitlebarDblClick = this.handleTitlebarDblClick.bind(this);
    this.startDrag = this.startDrag.bind(this);
    this.onDrag = this.onDrag.bind(this);
    this.stopDrag = this.stopDrag.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Helper to dispatch custom events from windowEl & document
   * @param {string} eventName 
   * @param {Object} detail 
   */
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      detail
    });
    this.windowEl.dispatchEvent(event);
    document.dispatchEvent(event);
  }

  /**
   * Checks whether a specific control can be interacted with
   * @param {string} controlId 
   * @returns {boolean}
   */
  canInteract(controlId) {
    if (this.interactionEnabled === false) return false;
    if (Array.isArray(this.allowedControls) && !this.allowedControls.includes(controlId)) return false;
    return true;
  }

  /**
   * Configures interaction permissions for lesson steps
   * @param {boolean} enabled 
   * @param {Array<string>|null} allowedControls 
   */
  setInteractionEnabled(enabled = true, allowedControls = null) {
    this.interactionEnabled = enabled;
    this.allowedControls = allowedControls;
    this.updateDisabledUI();
  }

  /**
   * Updates visual disabled state on window control buttons
   */
  updateDisabledUI() {
    const controls = [
      { el: this.btnMinimize, id: 'btn-minimize' },
      { el: this.btnMaximize, id: 'btn-maximize' },
      { el: this.btnClose, id: 'btn-close' },
      { el: this.taskbarBtn, id: 'taskbar-chrome-btn' }
    ];

    controls.forEach(({ el, id }) => {
      if (!el) return;
      const allowed = this.canInteract(id);
      if (!allowed) {
        el.classList.add('control-disabled');
        el.setAttribute('aria-disabled', 'true');
      } else {
        el.classList.remove('control-disabled');
        el.removeAttribute('aria-disabled');
      }
    });
  }

  /**
   * Initialize event listeners and set initial window position
   */
  init() {
    // Window control buttons listeners
    this.btnMinimize.addEventListener('click', this.handleMinimize);
    this.btnMaximize.addEventListener('click', this.handleMaximizeToggle);
    this.btnClose.addEventListener('click', this.handleClose);

    // Taskbar button listener
    this.taskbarBtn.addEventListener('click', this.handleTaskbarClick);

    // Titlebar double click for Maximize/Restore toggle
    this.titlebarEl.addEventListener('dblclick', this.handleTitlebarDblClick);

    // Titlebar dragging (pointer events for touch & mouse support)
    this.titlebarEl.addEventListener('pointerdown', this.startDrag);

    // Handle viewport resize to clamp window bounds
    window.addEventListener('resize', this.handleResize);

    // Set initial centered restored position
    this.centerWindow();
    this.applyRestoredBounds();
  }

  /**
   * Center the window within the desktop workspace area
   */
  centerWindow() {
    const workspaceWidth = this.desktopWorkspace.clientWidth;
    const workspaceHeight = this.desktopWorkspace.clientHeight;

    // Calculate dynamic size based on available screen space
    const targetWidth = Math.min(this.defaultWidth, Math.max(360, workspaceWidth - 40));
    const targetHeight = Math.min(this.defaultHeight, Math.max(280, workspaceHeight - 40));

    const left = Math.max(0, Math.floor((workspaceWidth - targetWidth) / 2));
    const top = Math.max(0, Math.floor((workspaceHeight - targetHeight) / 2));

    this.restoredBounds = {
      left,
      top,
      width: targetWidth,
      height: targetHeight
    };
  }

  /**
   * Apply stored restored bounds (left, top, width, height) to window inline styles
   */
  applyRestoredBounds() {
    this.windowEl.style.left = `${this.restoredBounds.left}px`;
    this.windowEl.style.top = `${this.restoredBounds.top}px`;
    this.windowEl.style.width = `${this.restoredBounds.width}px`;
    this.windowEl.style.height = `${this.restoredBounds.height}px`;
  }

  /**
   * Save current window inline styles to restoredBounds
   */
  saveCurrentBounds() {
    if (!this.isMaximized && !this.isMinimized && !this.isClosed) {
      this.restoredBounds = {
        left: this.windowEl.offsetLeft,
        top: this.windowEl.offsetTop,
        width: this.windowEl.offsetWidth,
        height: this.windowEl.offsetHeight
      };
    }
  }

  /**
   * Minimize the simulated Chrome window (real Minimize button click - gated
   * by interaction permissions).
   */
  handleMinimize() {
    this.dispatchEvent('window:control-attempt', { control: 'btn-minimize', action: 'minimize', allowed: this.canInteract('btn-minimize') });
    if (!this.canInteract('btn-minimize')) return;
    this.performMinimize();
  }

  /**
   * Core minimize state mutation with NO interaction gating. Used by
   * handleMinimize() (after its own gate check), by the taskbar's own
   * "minimize an open window" fallback, and by lesson code that needs to
   * programmatically set up a step's starting window state. Per-step
   * interaction restrictions (e.g. "only the taskbar button is allowed this
   * step") must never block this from running - they only gate real clicks
   * on the Minimize button itself.
   */
  performMinimize() {
    if (this.isClosed) return;

    this.saveCurrentBounds();
    this.isMinimized = true;

    this.windowEl.classList.add('is-minimized');
    this.windowEl.setAttribute('aria-hidden', 'true');

    // Update Taskbar Button state
    this.taskbarBtn.classList.remove('is-active', 'is-closed');
    this.taskbarBtn.classList.add('is-minimized');
    this.taskbarBtn.setAttribute('aria-label', 'Chrome Skills Trainer (Minimized - Click to Restore)');
    this.taskbarBtn.setAttribute('title', 'Chrome Skills Trainer (Minimized)');

    this.dispatchEvent('window:minimized', { control: 'btn-minimize', action: 'minimize' });
  }


  /**
   * Toggle between Maximize and Restore Down
   */
  handleMaximizeToggle() {
    const action = this.isMaximized ? 'restore' : 'maximize';
    this.dispatchEvent('window:control-attempt', { control: 'btn-maximize', action, allowed: this.canInteract('btn-maximize') });
    if (!this.canInteract('btn-maximize')) return;
    if (this.isClosed) return;

    if (this.isMinimized) {
      // If minimized, restore first then toggle
      this.restoreFromMinimize();
      return;
    }

    if (this.isMaximized) {
      this.restoreDown();
    } else {
      this.maximize();
    }
  }

  /**
   * Expand window to full desktop area above taskbar
   */
  maximize() {
    this.saveCurrentBounds();
    this.isMaximized = true;

    this.windowEl.classList.add('is-maximized');
    this.windowEl.style.left = '0px';
    this.windowEl.style.top = '0px';
    this.windowEl.style.width = '100%';
    this.windowEl.style.height = '100%';

    // Update Maximize/Restore Button UI & Accessibility
    this.btnMaximize.setAttribute('aria-label', 'Restore Down');
    this.btnMaximize.setAttribute('title', 'Restore Down');
    this.btnMaximize.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path fill="none" stroke="currentColor" stroke-width="1.2" d="M4.5 5.5v7h7v-7h-7z M6.5 5.5v-2h7v7h-2"/>
      </svg>
    `;

    this.dispatchEvent('window:maximized', { control: 'btn-maximize', action: 'maximize' });
  }

  /**
   * Return window to its previous restored size and position
   */
  restoreDown() {
    this.isMaximized = false;
    this.windowEl.classList.remove('is-maximized');

    this.applyRestoredBounds();

    // Update Maximize/Restore Button UI & Accessibility
    this.btnMaximize.setAttribute('aria-label', 'Maximize');
    this.btnMaximize.setAttribute('title', 'Maximize');
    this.btnMaximize.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="3.5" y="3.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
      </svg>
    `;

    this.dispatchEvent('window:restored', { control: 'btn-maximize', action: 'restore' });
  }

  /**
   * Restore window from minimized state
   */
  restoreFromMinimize() {
    this.isMinimized = false;
    this.windowEl.classList.remove('is-minimized');
    this.windowEl.removeAttribute('aria-hidden');

    if (this.isMaximized) {
      this.maximize();
    } else {
      this.applyRestoredBounds();
    }

    this.updateTaskbarActiveState();
    this.windowEl.focus();

    this.dispatchEvent('window:taskbar-restored', { control: 'taskbar-chrome-btn', action: 'taskbar-restore' });
    this.dispatchEvent('window:restored', { control: 'taskbar-chrome-btn', action: 'restore' });
  }

  /**
   * Close the simulated Chrome window (real Close button click - gated by
   * interaction permissions).
   */
  handleClose() {
    this.dispatchEvent('window:control-attempt', { control: 'btn-close', action: 'close', allowed: this.canInteract('btn-close') });
    if (!this.canInteract('btn-close')) return;
    this.performClose();
  }

  /**
   * Core close state mutation with NO interaction gating (see performMinimize).
   */
  performClose() {
    this.saveCurrentBounds();
    this.isClosed = true;

    this.windowEl.classList.add('is-closed');
    this.windowEl.setAttribute('aria-hidden', 'true');

    // Update taskbar button to closed / inactive state
    this.taskbarBtn.classList.remove('is-active', 'is-minimized');
    this.taskbarBtn.classList.add('is-closed');
    this.taskbarBtn.setAttribute('aria-label', 'Chrome Skills Trainer (Closed - Click to Open)');
    this.taskbarBtn.setAttribute('title', 'Open Chrome Skills Trainer');

    this.dispatchEvent('window:closed', { control: 'btn-close', action: 'close' });
  }

  /**
   * Open a fresh default simulated Chrome window after close
   */
  openFresh() {
    this.isClosed = false;
    this.isMinimized = false;
    this.isMaximized = false;

    this.windowEl.classList.remove('is-closed', 'is-minimized', 'is-maximized');
    this.windowEl.removeAttribute('aria-hidden');

    // Reset to default centered position
    this.centerWindow();
    this.applyRestoredBounds();

    // Reset Maximize button icon & title
    this.btnMaximize.setAttribute('aria-label', 'Maximize');
    this.btnMaximize.setAttribute('title', 'Maximize');
    this.btnMaximize.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="3.5" y="3.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
      </svg>
    `;

    this.updateTaskbarActiveState();
    this.windowEl.focus();

    this.dispatchEvent('window:opened', { control: 'taskbar-chrome-btn', action: 'open' });
  }

  /**
   * Handle taskbar button click behavior
   */
  handleTaskbarClick() {
    this.dispatchEvent('window:control-attempt', { control: 'taskbar-chrome-btn', action: 'taskbar-click', allowed: this.canInteract('taskbar-chrome-btn') });
    if (!this.canInteract('taskbar-chrome-btn')) return;

    if (this.isClosed) {
      // If closed, open fresh window
      this.openFresh();
    } else if (this.isMinimized) {
      // If minimized, restore window
      this.restoreFromMinimize();
    } else {
      // If window is currently open, clicking taskbar minimizes it. This is
      // the taskbar's own action (already gated above on 'taskbar-chrome-btn'
      // permission) - it must NOT be re-gated on 'btn-minimize' permission,
      // otherwise a step that only allows the taskbar control (e.g. "Bring
      // It Back") would never be able to minimize via the taskbar either.
      this.performMinimize();
    }
  }

  /**
   * Handle double-clicking title bar to toggle maximize/restore
   */
  handleTitlebarDblClick(e) {
    // Ignore double clicks on control buttons or tab actions
    if (e.target.closest('button') || e.target.closest('.chrome-tab-close') || e.target.closest('.chrome-new-tab-btn')) {
      return;
    }
    this.handleMaximizeToggle();
  }

  /**
   * Update taskbar button styling to active open state
   */
  updateTaskbarActiveState() {
    this.taskbarBtn.classList.remove('is-minimized', 'is-closed');
    this.taskbarBtn.classList.add('is-active');
    this.taskbarBtn.setAttribute('aria-label', 'Chrome Skills Trainer (Active Window)');
    this.taskbarBtn.setAttribute('title', 'Chrome Skills Trainer (Active)');
  }

  /**
   * Start dragging the window by title bar (only allowed when restored)
   */
  startDrag(e) {
    if (this.interactionEnabled === false) return;
    // Prevent dragging if window is maximized or minimized or closed
    if (this.isMaximized || this.isMinimized || this.isClosed) return;

    // Prevent dragging when clicking control buttons or tab buttons
    if (e.target.closest('button') || e.target.closest('.chrome-tab-close') || e.target.closest('.chrome-new-tab-btn')) {
      return;
    }

    this.isDragging = true;
    this.windowEl.classList.add('is-dragging');

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.windowStartX = this.windowEl.offsetLeft;
    this.windowStartY = this.windowEl.offsetTop;

    // Capture pointer events on window
    window.addEventListener('pointermove', this.onDrag);
    window.addEventListener('pointerup', this.stopDrag);
    window.addEventListener('pointercancel', this.stopDrag);
  }

  /**
   * Drag move handler - keeps window bounded within desktop workspace
   */
  onDrag(e) {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    let newLeft = this.windowStartX + deltaX;
    let newTop = this.windowStartY + deltaY;

    // Clamp window within visible desktop area
    const workspaceWidth = this.desktopWorkspace.clientWidth;
    const workspaceHeight = this.desktopWorkspace.clientHeight;
    const windowWidth = this.windowEl.offsetWidth;
    const windowHeight = this.windowEl.offsetHeight;

    const maxLeft = workspaceWidth - windowWidth;
    const maxTop = workspaceHeight - windowHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    this.windowEl.style.left = `${newLeft}px`;
    this.windowEl.style.top = `${newTop}px`;
  }

  /**
   * Stop dragging window
   */
  stopDrag() {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.windowEl.classList.remove('is-dragging');

    this.saveCurrentBounds();

    window.removeEventListener('pointermove', this.onDrag);
    window.removeEventListener('pointerup', this.stopDrag);
    window.removeEventListener('pointercancel', this.stopDrag);
  }

  /**
   * Recalculate and clamp window bounds on browser resize
   */
  handleResize() {
    if (this.isMaximized || this.isMinimized || this.isClosed) return;

    const workspaceWidth = this.desktopWorkspace.clientWidth;
    const workspaceHeight = this.desktopWorkspace.clientHeight;
    const windowWidth = this.windowEl.offsetWidth;
    const windowHeight = this.windowEl.offsetHeight;

    let left = this.windowEl.offsetLeft;
    let top = this.windowEl.offsetTop;

    const maxLeft = Math.max(0, workspaceWidth - windowWidth);
    const maxTop = Math.max(0, workspaceHeight - windowHeight);

    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));

    this.windowEl.style.left = `${left}px`;
    this.windowEl.style.top = `${top}px`;
    this.saveCurrentBounds();
  }

  // --- Safe Public API Methods for Lesson Activity Controller ---
  // These call the ungated "perform*" state mutators directly (not the
  // gated "handle*" click handlers), since lesson setup code must be able
  // to place the window in any state regardless of a step's per-control
  // interaction restrictions.

  minimize() {
    this.performMinimize();
  }

  restore() {
    if (this.isMaximized) this.restoreDown();
    else if (this.isMinimized) this.restoreFromMinimize();
  }

  close() {
    this.performClose();
  }

  restoreFromTaskbar() {
    if (this.isMinimized) this.restoreFromMinimize();
    else if (this.isClosed) this.openFresh();
  }

  resetToDefault() {
    this.isClosed = false;
    this.isMinimized = false;
    this.isMaximized = false;
    this.windowEl.classList.remove('is-closed', 'is-minimized', 'is-maximized');
    this.windowEl.removeAttribute('aria-hidden');
    this.btnMaximize.setAttribute('aria-label', 'Maximize');
    this.btnMaximize.setAttribute('title', 'Maximize');
    this.btnMaximize.innerHTML = `
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="3.5" y="3.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
      </svg>
    `;
    this.centerWindow();
    this.applyRestoredBounds();
    this.updateTaskbarActiveState();
  }
}
