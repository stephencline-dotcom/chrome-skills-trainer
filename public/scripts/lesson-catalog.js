/**
 * lesson-catalog.js
 * Shared ES Module that fetches, validates, caches, and provides query methods
 * for the data-driven skills catalog (skills.json).
 */

class LessonCatalog {
  constructor() {
    this.skills = [];
    this.categories = [];
    this.isLoaded = false;
    this.loadPromise = null;
  }

  /**
   * Loads and validates skills.json. Caches result after first call.
   * @returns {Promise<LessonCatalog>}
   */
  async loadCatalog() {
    if (this.isLoaded) {
      return this;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        const response = await fetch('/data/skills.json');
        if (!response.ok) {
          throw new Error(`HTTP error fetching skills.json: ${response.status}`);
        }
        const data = await response.json();
        
        // Validate catalog shape
        if (!data || !Array.isArray(data.skills)) {
          throw new Error('Invalid skills.json catalog format: missing "skills" array.');
        }

        this.categories = Array.isArray(data.categories) ? data.categories : [];
        this.skills = data.skills.filter(skill => this.validateSkillRecord(skill));
        this.isLoaded = true;
        return this;
      } catch (error) {
        console.error('LessonCatalog load error:', error);
        this.skills = [];
        this.categories = [];
        this.isLoaded = false;
        this.loadPromise = null;
        throw error;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Basic validation for a skill record
   * @param {Object} skill 
   * @returns {boolean}
   */
  validateSkillRecord(skill) {
    return (
      skill &&
      typeof skill.id === 'string' &&
      typeof skill.name === 'string' &&
      typeof skill.category === 'string' &&
      typeof skill.shortExplanation === 'string' &&
      Array.isArray(skill.lessonSections)
    );
  }

  /**
   * Get all skills in catalog
   * @returns {Array}
   */
  getAllSkills() {
    return this.skills;
  }

  /**
   * Get skills filtered by category
   * @param {string} category 
   * @returns {Array}
   */
  getSkillsByCategory(category) {
    if (!category || category === 'All Skills') {
      return this.skills;
    }
    return this.skills.filter(s => s.category.toLowerCase() === category.toLowerCase());
  }

  /**
   * Find a skill by its lowercase kebab-case ID
   * @param {string} id 
   * @returns {Object|null}
   */
  getSkillById(id) {
    if (!id || typeof id !== 'string') return null;
    const cleanId = id.trim().toLowerCase();
    return this.skills.find(s => s.id.toLowerCase() === cleanId) || null;
  }

  /**
   * Get list of unique category names
   * @returns {Array<string>}
   */
  getCategories() {
    if (this.categories.length > 0) {
      return ['All Skills', ...this.categories];
    }
    const unique = Array.from(new Set(this.skills.map(s => s.category)));
    return ['All Skills', ...unique];
  }
}

// Singleton instance export
export const lessonCatalog = new LessonCatalog();
