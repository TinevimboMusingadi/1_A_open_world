/**
 * Entity class - Core of the Entity-Component-System architecture
 * An entity is a unique identifier that can have components attached to it
 */
export class Entity {
  constructor(id = null) {
    this.id = id || Entity.generateId();
    this.components = new Map();
    this.active = true;
    this.tags = new Set();
  }

  /**
   * Generate a unique ID for entities
   */
  static generateId() {
    return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a component to this entity
   * @param {Component} component - The component to add
   * @returns {Entity} - Returns this entity for method chaining
   */
  addComponent(component) {
    if (!component || typeof component !== 'object' || !component.constructor || !component.constructor.name) {
      throw new Error('Invalid component: must have a constructor name');
    }

    const componentType = component.constructor.name;
    this.components.set(componentType, component);
    component.entity = this;
    
    // Call component's onAttach if it exists
    if (typeof component.onAttach === 'function') {
      component.onAttach(this);
    }

    return this;
  }

  /**
   * Remove a component from this entity
   * @param {string} componentType - The type of component to remove
   * @returns {boolean} - True if component was removed, false if not found
   */
  removeComponent(componentType) {
    const component = this.components.get(componentType);
    if (component) {
      // Call component's onDetach if it exists
      if (typeof component.onDetach === 'function') {
        component.onDetach(this);
      }
      
      component.entity = null;
      return this.components.delete(componentType);
    }
    return false;
  }

  /**
   * Get a component by its type
   * @param {string} componentType - The type of component to get
   * @returns {Component|null} - The component or null if not found
   */
  getComponent(componentType) {
    return this.components.get(componentType) || null;
  }

  /**
   * Check if entity has a specific component
   * @param {string} componentType - The type of component to check for
   * @returns {boolean} - True if entity has the component
   */
  hasComponent(componentType) {
    return this.components.has(componentType);
  }

  /**
   * Check if entity has all specified components
   * @param {string[]} componentTypes - Array of component types to check
   * @returns {boolean} - True if entity has all components
   */
  hasComponents(componentTypes) {
    return componentTypes.every(type => this.hasComponent(type));
  }

  /**
   * Get all components attached to this entity
   * @returns {Component[]} - Array of all components
   */
  getAllComponents() {
    return Array.from(this.components.values());
  }

  /**
   * Add a tag to this entity
   * @param {string} tag - The tag to add
   * @returns {Entity} - Returns this entity for method chaining
   */
  addTag(tag) {
    this.tags.add(tag);
    return this;
  }

  /**
   * Remove a tag from this entity
   * @param {string} tag - The tag to remove
   * @returns {boolean} - True if tag was removed
   */
  removeTag(tag) {
    return this.tags.delete(tag);
  }

  /**
   * Check if entity has a specific tag
   * @param {string} tag - The tag to check for
   * @returns {boolean} - True if entity has the tag
   */
  hasTag(tag) {
    return this.tags.has(tag);
  }

  /**
   * Activate this entity
   */
  activate() {
    this.active = true;
  }

  /**
   * Deactivate this entity
   */
  deactivate() {
    this.active = false;
  }

  /**
   * Check if entity is active
   * @returns {boolean} - True if entity is active
   */
  isActive() {
    return this.active;
  }

  /**
   * Destroy this entity and clean up its components
   */
  destroy() {
    // Call onDetach for all components
    for (const component of this.components.values()) {
      if (typeof component.onDetach === 'function') {
        component.onDetach(this);
      }
      component.entity = null;
    }
    
    this.components.clear();
    this.tags.clear();
    this.active = false;
  }

  /**
   * Get a JSON representation of this entity
   * @returns {Object} - JSON representation
   */
  toJSON() {
    const componentData = {};
    for (const [type, component] of this.components.entries()) {
      componentData[type] = component.toJSON ? component.toJSON() : component;
    }

    return {
      id: this.id,
      active: this.active,
      tags: Array.from(this.tags),
      components: componentData
    };
  }
} 