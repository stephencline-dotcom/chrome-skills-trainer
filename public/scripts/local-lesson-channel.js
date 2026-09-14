/**
 * local-lesson-channel.js
 * LOCAL, SAME-BROWSER ONLY synchronization between a Teacher Control tab and
 * its followers (a Classroom Presentation tab and/or a Student Practice
 * tab), using the browser BroadcastChannel API.
 *
 * This is explicitly NOT the future remote classroom synchronization system.
 * It only works when tabs are open in the same browser profile and does not
 * represent, simulate, or prepare real multi-device student synchronization.
 * The command/state shape below (skillId, stepId, stepIndex, deliveryMode)
 * is intentionally the same shape a future shared classroom state document
 * would use, so this local transport can be swapped out later.
 *
 * Provides a graceful fallback: if BroadcastChannel is unavailable, publish()
 * and subscribe() become safe no-ops and isAvailable() returns false so
 * callers can inform the user that live local following is unavailable.
 */

const CHANNEL_NAME = 'chrome-skills-trainer-local-lesson-sync-v1';

// Supported local sync commands
export const LOCAL_LESSON_COMMANDS = {
  SET_STEP: 'set-step',
  SET_LESSON: 'set-lesson',
  SET_DELIVERY_MODE: 'set-delivery-mode',
  RESET_LESSON: 'reset-lesson',
  REPLAY_DEMONSTRATION: 'replay-demonstration',
  // Local handshake: a follower (Classroom Presentation or Student Practice)
  // announces itself, and Teacher Control responds with the full current
  // state so the follower never has to guess/assume Step 1.
  FOLLOWER_READY: 'follower-ready',
  TEACHER_STATE: 'teacher-state',
  REQUEST_STEP_CHANGE: 'request-step-change'
};

// Delivery modes. Structured as plain string constants (rather than a
// boolean) so this can later be sourced from shared/remote classroom state
// without changing call sites.
export const DELIVERY_MODES = {
  TEACHER_LED: 'teacher-led',
  INDEPENDENT: 'independent'
};

export class LocalLessonChannel {
  constructor() {
    this.channel = null;
    this.available = typeof BroadcastChannel !== 'undefined';

    if (this.available) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
      } catch (err) {
        console.warn('LocalLessonChannel: BroadcastChannel failed to initialize.', err);
        this.available = false;
        this.channel = null;
      }
    }
  }

  /**
   * @returns {boolean} whether local same-browser tab sync is available
   */
  isAvailable() {
    return this.available && !!this.channel;
  }

  /**
   * Publish a local sync message. No-op if BroadcastChannel is unavailable.
   * @param {Object} message
   * @param {string} message.command - one of LOCAL_LESSON_COMMANDS
   * @param {string} [message.skillId]
   * @param {string} [message.stepId]
   * @param {number} [message.stepIndex]
   */
  publish(message) {
    if (!this.isAvailable()) return;
    try {
      this.channel.postMessage({
        ...message,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn('LocalLessonChannel: failed to publish message.', err);
    }
  }

  /**
   * Subscribe to incoming local sync messages.
   * @param {(data: Object) => void} handler
   * @returns {() => void} unsubscribe function
   */
  subscribe(handler) {
    if (!this.isAvailable() || typeof handler !== 'function') {
      return () => {};
    }
    const listener = (event) => handler(event.data);
    this.channel.addEventListener('message', listener);
    return () => this.channel.removeEventListener('message', listener);
  }

  /**
   * Closes the underlying BroadcastChannel connection.
   */
  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}
