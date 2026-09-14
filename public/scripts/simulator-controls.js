/**
 * simulator-controls.js
 * Shared, stable lookup mapping between lesson "targetControl" values and the
 * simulated Chrome window controls. Both Student Practice and Classroom
 * Presentation use `data-simulator-control` attributes (not fragile ids,
 * classes, or button text) to locate the actual control element.
 */

// Canonical control keys used across the simulator markup
export const SIMULATOR_CONTROL_KEYS = {
  MINIMIZE: 'minimize',
  MAXIMIZE: 'maximize',
  CLOSE: 'close',
  CHROME_TASKBAR: 'chrome-taskbar',
  BACK: 'back',
  FORWARD: 'forward',
  RELOAD: 'reload'
};

// Maps legacy skills.json `targetControl` values to stable control keys
const TARGET_CONTROL_TO_KEY = {
  'btn-minimize': SIMULATOR_CONTROL_KEYS.MINIMIZE,
  'btn-maximize': SIMULATOR_CONTROL_KEYS.MAXIMIZE,
  'btn-close': SIMULATOR_CONTROL_KEYS.CLOSE,
  'taskbar-chrome-btn': SIMULATOR_CONTROL_KEYS.CHROME_TASKBAR,
  'btn-back': SIMULATOR_CONTROL_KEYS.BACK,
  'btn-forward': SIMULATOR_CONTROL_KEYS.FORWARD,
  'btn-reload': SIMULATOR_CONTROL_KEYS.RELOAD
};

// Human-friendly callout labels for highlighted controls
const CONTROL_LABELS = {
  [SIMULATOR_CONTROL_KEYS.MINIMIZE]: 'Minimize',
  [SIMULATOR_CONTROL_KEYS.MAXIMIZE]: 'Maximize',
  [SIMULATOR_CONTROL_KEYS.CLOSE]: 'Close',
  [SIMULATOR_CONTROL_KEYS.CHROME_TASKBAR]: 'Chrome Taskbar',
  [SIMULATOR_CONTROL_KEYS.BACK]: 'Back',
  [SIMULATOR_CONTROL_KEYS.FORWARD]: 'Forward',
  [SIMULATOR_CONTROL_KEYS.RELOAD]: 'Reload'
};

/**
 * Converts a skills.json `targetControl` value into a stable control key.
 * Returns null for non-control values (e.g. "sequence", "quiz-minimize", null).
 * @param {string|null} targetControl
 * @returns {string|null}
 */
export function targetControlToControlKey(targetControl) {
  return TARGET_CONTROL_TO_KEY[targetControl] || null;
}

/**
 * Finds the simulator control element using the stable data attribute.
 * @param {string} controlKey - one of SIMULATOR_CONTROL_KEYS
 * @param {ParentNode} [root=document]
 * @returns {Element|null}
 */
export function getSimulatorControlElement(controlKey, root = document) {
  if (!controlKey) return null;
  return root.querySelector(`[data-simulator-control="${controlKey}"]`);
}

/**
 * Gets the human-friendly label for a control key.
 * @param {string} controlKey
 * @returns {string}
 */
export function getControlLabel(controlKey) {
  return CONTROL_LABELS[controlKey] || '';
}
