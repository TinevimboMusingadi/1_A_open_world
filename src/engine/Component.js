/**
 * Component base class - Foundation for all game components
 * Components contain data and behavior that can be attached to entities
 */
export class Component {
  constructor() {
    this.entity = null; // Reference to the entity this component is attached to
    this.enabled = true;
  }

  /**
   * Called when this component is attached to an entity
   * @param {Entity} entity - The entity this component was attached to
   */
  onAttach(entity) {
    // Override in subclasses for custom attachment behavior
  }

  /**
   * Called when this component is detached from an entity
   * @param {Entity} entity - The entity this component was detached from
   */
  onDetach(entity) {
    // Override in subclasses for custom detachment behavior
  }

  /**
   * Called every frame to update this component
   * @param {number} deltaTime - Time elapsed since last frame in milliseconds
   */
  update(deltaTime) {
    // Override in subclasses for per-frame updates
  }

  /**
   * Enable this component
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable this component
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Check if this component is enabled
   * @returns {boolean} - True if component is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get the entity this component is attached to
   * @returns {Entity|null} - The entity or null if not attached
   */
  getEntity() {
    return this.entity;
  }

  /**
   * Get a sibling component from the same entity
   * @param {string} componentType - The type of component to get
   * @returns {Component|null} - The component or null if not found
   */
  getSiblingComponent(componentType) {
    return this.entity ? this.entity.getComponent(componentType) : null;
  }

  /**
   * Check if the entity has a sibling component
   * @param {string} componentType - The type of component to check for
   * @returns {boolean} - True if the component exists
   */
  hasSiblingComponent(componentType) {
    return this.entity ? this.entity.hasComponent(componentType) : false;
  }

  /**
   * Clone this component (deep copy)
   * @returns {Component} - A new instance of this component
   */
  clone() {
    const cloned = new this.constructor();
    
    // Copy all enumerable properties
    for (const key in this) {
      if (this.hasOwnProperty(key) && key !== 'entity') {
        if (typeof this[key] === 'object' && this[key] !== null) {
          // Deep clone objects
          cloned[key] = JSON.parse(JSON.stringify(this[key]));
        } else {
          cloned[key] = this[key];
        }
      }
    }
    
    return cloned;
  }

  /**
   * Get a JSON representation of this component
   * @returns {Object} - JSON representation
   */
  toJSON() {
    const data = {};
    
    for (const key in this) {
      if (this.hasOwnProperty(key) && key !== 'entity') {
        data[key] = this[key];
      }
    }
    
    return {
      type: this.constructor.name,
      enabled: this.enabled,
      data: data
    };
  }

  /**
   * Restore component state from JSON data
   * @param {Object} data - JSON data to restore from
   */
  fromJSON(data) {
    if (data.enabled !== undefined) {
      this.enabled = data.enabled;
    }
    
    if (data.data) {
      Object.assign(this, data.data);
    }
  }
} 