/**
 * System base class - Foundation for all game systems
 * Systems contain logic that operates on entities with specific components
 */
export class System {
  constructor(name = 'System') {
    this.name = name;
    this.enabled = true;
    this.priority = 0; // Lower numbers execute first
    this.requiredComponents = []; // Component types this system needs
    this.entityManager = null; // Set by engine when system is added
    
    // Performance tracking
    this.lastUpdateTime = 0;
    this.averageUpdateTime = 0;
    this.updateCount = 0;
  }

  /**
   * Initialize the system (called when added to engine)
   * @param {EntityManager} entityManager - The entity manager
   */
  initialize(entityManager) {
    this.entityManager = entityManager;
    this.onInitialize();
  }

  /**
   * Override in subclasses for custom initialization
   */
  onInitialize() {
    // Override in subclasses
  }

  /**
   * Update the system (called every frame)
   * @param {number} deltaTime - Time elapsed since last frame in milliseconds
   */
  update(deltaTime) {
    if (!this.enabled) return;

    const startTime = performance.now();
    
    // Get entities that match this system's requirements
    const entities = this.getRelevantEntities();
    
    // Process entities
    this.process(entities, deltaTime);
    
    // Track performance
    const endTime = performance.now();
    this.updatePerformanceStats(endTime - startTime);
  }

  /**
   * Override in subclasses to implement system logic
   * @param {Entity[]} entities - Entities that match system requirements
   * @param {number} deltaTime - Time elapsed since last frame
   */
  process(entities, deltaTime) {
    // Override in subclasses
  }

  /**
   * Get entities that have all required components
   * @returns {Entity[]} - Array of matching entities
   */
  getRelevantEntities() {
    if (!this.entityManager) return [];
    
    return this.entityManager.getEntitiesWithComponents(this.requiredComponents);
  }

  /**
   * Check if an entity matches this system's requirements
   * @param {Entity} entity - Entity to check
   * @returns {boolean} - True if entity matches requirements
   */
  matchesEntity(entity) {
    if (!entity || !entity.isActive()) return false;
    
    return entity.hasComponents(this.requiredComponents);
  }

  /**
   * Enable the system
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable the system
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Check if system is enabled
   * @returns {boolean} - True if enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Set system priority (lower numbers execute first)
   * @param {number} priority - Priority value
   */
  setPriority(priority) {
    this.priority = priority;
  }

  /**
   * Get system priority
   * @returns {number} - Priority value
   */
  getPriority() {
    return this.priority;
  }

  /**
   * Set required components for this system
   * @param {string[]} components - Array of component type names
   */
  setRequiredComponents(components) {
    this.requiredComponents = [...components];
  }

  /**
   * Add a required component type
   * @param {string} componentType - Component type name
   */
  addRequiredComponent(componentType) {
    if (!this.requiredComponents.includes(componentType)) {
      this.requiredComponents.push(componentType);
    }
  }

  /**
   * Remove a required component type
   * @param {string} componentType - Component type name
   */
  removeRequiredComponent(componentType) {
    const index = this.requiredComponents.indexOf(componentType);
    if (index !== -1) {
      this.requiredComponents.splice(index, 1);
    }
  }

  /**
   * Update performance statistics
   * @param {number} updateTime - Time taken for this update
   */
  updatePerformanceStats(updateTime) {
    this.lastUpdateTime = updateTime;
    this.updateCount++;
    
    // Calculate rolling average
    const alpha = 0.1; // Smoothing factor
    this.averageUpdateTime = this.averageUpdateTime * (1 - alpha) + updateTime * alpha;
  }

  /**
   * Get performance statistics
   * @returns {Object} - Performance stats
   */
  getPerformanceStats() {
    return {
      name: this.name,
      lastUpdateTime: this.lastUpdateTime,
      averageUpdateTime: this.averageUpdateTime,
      updateCount: this.updateCount,
      enabled: this.enabled
    };
  }

  /**
   * Clean up system resources
   */
  destroy() {
    this.entityManager = null;
    this.enabled = false;
    this.onDestroy();
  }

  /**
   * Override in subclasses for custom cleanup
   */
  onDestroy() {
    // Override in subclasses
  }

  /**
   * Get system information
   * @returns {Object} - System info
   */
  getInfo() {
    return {
      name: this.name,
      enabled: this.enabled,
      priority: this.priority,
      requiredComponents: [...this.requiredComponents],
      performance: this.getPerformanceStats()
    };
  }

  /**
   * Reset performance statistics
   */
  resetPerformanceStats() {
    this.lastUpdateTime = 0;
    this.averageUpdateTime = 0;
    this.updateCount = 0;
  }

  toString() {
    return `${this.name} (enabled: ${this.enabled}, priority: ${this.priority})`;
  }
} 