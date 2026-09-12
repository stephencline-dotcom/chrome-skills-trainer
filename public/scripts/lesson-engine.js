/**
 * lesson-engine.js
 * Shared ES module that manages lesson state, step progression,
 * step completion tracking, and event emission for lesson players.
 */

export class LessonEngine {
  /**
   * @param {Object} skill - Skill object loaded from skills.json
   */
  constructor(skill) {
    this.skill = skill;
    this.steps = Array.isArray(skill?.lessonSections) ? skill.lessonSections : [];
    this.currentStepIndex = 0;
    this.completedSteps = new Set();
    this.listeners = [];
  }

  /**
   * Add a listener for lesson engine events
   * @param {Function} callback 
   */
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * Remove a listener
   * @param {Function} callback 
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * Helper to notify listeners and dispatch custom DOM events
   * @param {string} eventName 
   * @param {Object} detail 
   */
  emit(eventName, detail = {}) {
    const payload = {
      skill: this.skill,
      step: this.getCurrentStep(),
      stepIndex: this.currentStepIndex,
      totalSteps: this.getTotalSteps(),
      isCompleted: this.isStepCompleted(this.getCurrentStep()?.id),
      canAdvance: this.canAdvance(),
      ...detail
    };

    this.listeners.forEach(cb => {
      try {
        cb(eventName, payload);
      } catch (err) {
        console.error('LessonEngine listener error:', err);
      }
    });

    const customEvent = new CustomEvent(eventName, { bubbles: true, detail: payload });
    document.dispatchEvent(customEvent);
  }

  /**
   * Gets the current step record
   * @returns {Object|null}
   */
  getCurrentStep() {
    if (this.steps.length === 0) return null;
    return this.steps[this.currentStepIndex] || null;
  }

  /**
   * Gets current 0-based step index
   * @returns {number}
   */
  getCurrentStepIndex() {
    return this.currentStepIndex;
  }

  /**
   * Gets total number of steps in lesson
   * @returns {number}
   */
  getTotalSteps() {
    return this.steps.length;
  }

  /**
   * Checks if a step ID has been completed
   * @param {string} stepId 
   * @returns {boolean}
   */
  isStepCompleted(stepId) {
    if (!stepId) return false;
    return this.completedSteps.has(stepId);
  }

  /**
   * Marks a step completed or incomplete
   * @param {string} stepId 
   * @param {boolean} completed 
   */
  setStepCompleted(stepId, completed = true) {
    const targetStep = stepId ? this.steps.find(s => s.id === stepId) : this.getCurrentStep();
    if (!targetStep) return;

    if (completed) {
      this.completedSteps.add(targetStep.id);
    } else {
      this.completedSteps.delete(targetStep.id);
    }

    this.emit('lesson:step-completed', { stepId: targetStep.id, completed });

    if (this.completedSteps.size === this.steps.length) {
      this.emit('lesson:completed');
    }
  }

  /**
   * Determines if user can advance to the next step
   * @returns {boolean}
   */
  canAdvance() {
    const step = this.getCurrentStep();
    if (!step) return false;

    // Presentation-only steps (no required interaction) can advance freely
    if (step.allowStudentInteraction === false) {
      return true;
    }

    // Step requires student interaction - must be marked completed first
    return this.isStepCompleted(step.id);
  }

  /**
   * Advance to the next step
   * @returns {boolean} Success
   */
  nextStep() {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.emit('lesson:step-changed', { direction: 'next' });
      return true;
    }
    return false;
  }

  /**
   * Go back to the previous step
   * @returns {boolean} Success
   */
  previousStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.emit('lesson:step-changed', { direction: 'prev' });
      return true;
    }
    return false;
  }

  /**
   * Go directly to a specific 0-based step index
   * @param {number} index 
   * @returns {boolean} Success
   */
  goToStep(index) {
    if (typeof index === 'number' && index >= 0 && index < this.steps.length) {
      this.currentStepIndex = index;
      this.emit('lesson:step-changed', { direction: 'direct', index });
      return true;
    }
    return false;
  }

  /**
   * Reset lesson back to initial step 0
   */
  resetLesson() {
    this.currentStepIndex = 0;
    this.completedSteps.clear();
    this.emit('lesson:step-changed', { direction: 'reset' });
  }
}
