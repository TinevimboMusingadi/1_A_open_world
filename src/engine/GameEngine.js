import { EntityManager } from './EntityManager.js';

/**
 * GameEngine class - Core engine that manages the game loop, systems, and entities
 * This is the main class that ties together the Entity-Component-System architecture
 */
export class GameEngine {
  constructor(options = {}) {
    // Core components
    this.entityManager = new EntityManager();
    this.systems = new Map(); // systemName -> System
    this.systemOrder = []; // Array of system names in execution order
    
    // Engine state
    this.running = false;
    this.paused = false;
    this.frameCount = 0;
    this.totalTime = 0;
    
    // Timing
    this.targetFPS = options.targetFPS || 60;
    this.maxDeltaTime = options.maxDeltaTime || 50; // Max 50ms per frame
    this.lastFrameTime = 0;
    this.deltaTime = 0;
    
    // Performance tracking
    this.performanceStats = {
      fps: 0,
      frameTime: 0,
      systemTimes: new Map(),
      entityCount: 0,
      averageFPS: 0,
      frameHistory: []
    };
    
    // Configuration
    this.debugMode = options.debugMode || false;
    this.enablePerformanceTracking = options.enablePerformanceTracking !== false;
    
    // Callbacks
    this.onBeforeUpdate = options.onBeforeUpdate || null;
    this.onAfterUpdate = options.onAfterUpdate || null;
    this.onBeforeRender = options.onBeforeRender || null;
    this.onAfterRender = options.onAfterRender || null;
    
    // Bind methods for RAF
    this.gameLoop = this.gameLoop.bind(this);
    
    // Initialize RAF ID for stopping
    this.rafId = null;
  }

  /**
   * Initialize the game engine
   */
  initialize() {
    console.log('🎮 Initializing Dynamic Game Engine...');
    
    // Initialize all systems
    for (const [name, system] of this.systems) {
      system.initialize(this.entityManager);
      console.log(`✅ Initialized system: ${name}`);
    }
    
    console.log('🚀 Game Engine ready!');
  }

  /**
   * Add a system to the engine
   * @param {System} system - System to add
   * @returns {GameEngine} - Returns this engine for chaining
   */
  addSystem(system) {
    if (this.systems.has(system.name)) {
      console.warn(`System ${system.name} already exists. Replacing...`);
      this.removeSystem(system.name);
    }

    this.systems.set(system.name, system);
    
    // Insert system in correct priority order
    this.insertSystemInOrder(system);
    
    // Initialize system if engine is already running
    if (this.running) {
      system.initialize(this.entityManager);
    }

    console.log(`➕ Added system: ${system.name} (priority: ${system.priority})`);
    return this;
  }

  /**
   * Remove a system from the engine
   * @param {string} systemName - Name of system to remove
   * @returns {boolean} - True if system was removed
   */
  removeSystem(systemName) {
    const system = this.systems.get(systemName);
    if (!system) return false;

    // Clean up system
    system.destroy();
    
    // Remove from collections
    this.systems.delete(systemName);
    const index = this.systemOrder.indexOf(systemName);
    if (index !== -1) {
      this.systemOrder.splice(index, 1);
    }

    console.log(`➖ Removed system: ${systemName}`);
    return true;
  }

  /**
   * Get a system by name
   * @param {string} systemName - Name of system
   * @returns {System|null} - The system or null if not found
   */
  getSystem(systemName) {
    return this.systems.get(systemName) || null;
  }

  /**
   * Insert system in correct priority order
   * @param {System} system - System to insert
   */
  insertSystemInOrder(system) {
    // Remove if already exists
    const existingIndex = this.systemOrder.indexOf(system.name);
    if (existingIndex !== -1) {
      this.systemOrder.splice(existingIndex, 1);
    }

    // Find correct insertion point
    let insertIndex = this.systemOrder.length;
    for (let i = 0; i < this.systemOrder.length; i++) {
      const otherSystem = this.systems.get(this.systemOrder[i]);
      if (otherSystem && system.priority < otherSystem.priority) {
        insertIndex = i;
        break;
      }
    }

    this.systemOrder.splice(insertIndex, 0, system.name);
  }

  /**
   * Start the game engine
   */
  start() {
    if (this.running) {
      console.warn('Engine is already running');
      return;
    }

    this.running = true;
    this.paused = false;
    this.lastFrameTime = performance.now();
    
    console.log('▶️ Starting game engine...');
    this.rafId = requestAnimationFrame(this.gameLoop);
  }

  /**
   * Stop the game engine
   */
  stop() {
    if (!this.running) return;

    this.running = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    console.log('⏹️ Game engine stopped');
  }

  /**
   * Pause the game engine
   */
  pause() {
    this.paused = true;
    console.log('⏸️ Game engine paused');
  }

  /**
   * Resume the game engine
   */
  resume() {
    if (this.paused) {
      this.paused = false;
      this.lastFrameTime = performance.now(); // Reset timing
      console.log('▶️ Game engine resumed');
    }
  }

  /**
   * Main game loop
   * @param {number} currentTime - Current timestamp from RAF
   */
  gameLoop(currentTime) {
    if (!this.running) return;

    // Calculate delta time
    this.deltaTime = Math.min(currentTime - this.lastFrameTime, this.maxDeltaTime);
    this.lastFrameTime = currentTime;
    this.totalTime += this.deltaTime;
    this.frameCount++;

    // Skip frame if paused
    if (this.paused) {
      this.rafId = requestAnimationFrame(this.gameLoop);
      return;
    }

    // Performance tracking start
    const frameStartTime = performance.now();

    try {
      // Pre-update callback
      if (this.onBeforeUpdate) {
        this.onBeforeUpdate(this.deltaTime);
      }

      // Update all systems
      this.updateSystems(this.deltaTime);

      // Process entity destruction queue
      this.entityManager.processDestroyQueue();

      // Post-update callback
      if (this.onAfterUpdate) {
        this.onAfterUpdate(this.deltaTime);
      }

      // Performance tracking
      if (this.enablePerformanceTracking) {
        this.updatePerformanceStats(performance.now() - frameStartTime);
      }

    } catch (error) {
      console.error('Error in game loop:', error);
      
      if (this.debugMode) {
        // In debug mode, pause on error
        this.pause();
        throw error;
      }
    }

    // Schedule next frame
    this.rafId = requestAnimationFrame(this.gameLoop);
  }

  /**
   * Update all systems in priority order
   * @param {number} deltaTime - Time elapsed since last frame
   */
  updateSystems(deltaTime) {
    for (const systemName of this.systemOrder) {
      const system = this.systems.get(systemName);
      
      if (system && system.isEnabled()) {
        const systemStartTime = performance.now();
        
        system.update(deltaTime);
        
        // Track system performance
        if (this.enablePerformanceTracking) {
          const systemTime = performance.now() - systemStartTime;
          this.performanceStats.systemTimes.set(systemName, systemTime);
        }
      }
    }
  }

  /**
   * Update performance statistics
   * @param {number} frameTime - Time taken for this frame
   */
  updatePerformanceStats(frameTime) {
    this.performanceStats.frameTime = frameTime;
    this.performanceStats.fps = 1000 / this.deltaTime;
    this.performanceStats.entityCount = this.entityManager.getStats().activeEntities;

    // Track frame history for average FPS
    this.performanceStats.frameHistory.push(this.performanceStats.fps);
    if (this.performanceStats.frameHistory.length > 60) {
      this.performanceStats.frameHistory.shift();
    }

    // Calculate average FPS
    const sum = this.performanceStats.frameHistory.reduce((a, b) => a + b, 0);
    this.performanceStats.averageFPS = sum / this.performanceStats.frameHistory.length;
  }

  /**
   * Create an entity
   * @param {string} id - Optional entity ID
   * @returns {Entity} - The created entity
   */
  createEntity(id = null) {
    return this.entityManager.createEntity(id);
  }

  /**
   * Destroy an entity
   * @param {string} entityId - Entity ID to destroy
   */
  destroyEntity(entityId) {
    this.entityManager.destroyEntity(entityId);
  }

  /**
   * Get entity by ID
   * @param {string} entityId - Entity ID
   * @returns {Entity|null} - The entity or null
   */
  getEntity(entityId) {
    return this.entityManager.getEntity(entityId);
  }

  /**
   * Get entities with specific components
   * @param {string[]} componentTypes - Component types to match
   * @returns {Entity[]} - Matching entities
   */
  getEntitiesWithComponents(componentTypes) {
    return this.entityManager.getEntitiesWithComponents(componentTypes);
  }

  /**
   * Get performance statistics
   * @returns {Object} - Performance stats
   */
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      systemStats: Array.from(this.systems.values()).map(system => system.getPerformanceStats()),
      entityStats: this.entityManager.getStats(),
      engineStats: {
        running: this.running,
        paused: this.paused,
        frameCount: this.frameCount,
        totalTime: this.totalTime,
        targetFPS: this.targetFPS
      }
    };
  }

  /**
   * Get engine information
   * @returns {Object} - Engine info
   */
  getInfo() {
    return {
      version: '1.0.0',
      running: this.running,
      paused: this.paused,
      frameCount: this.frameCount,
      totalTime: this.totalTime,
      systems: Array.from(this.systems.values()).map(system => system.getInfo()),
      entities: this.entityManager.getDebugInfo()
    };
  }

  /**
   * Reset engine statistics
   */
  resetStats() {
    this.frameCount = 0;
    this.totalTime = 0;
    this.performanceStats.frameHistory = [];
    
    // Reset system stats
    for (const system of this.systems.values()) {
      system.resetPerformanceStats();
    }
  }

  /**
   * Clear all entities and reset engine
   */
  clear() {
    this.entityManager.clear();
    this.resetStats();
    console.log('🧹 Engine cleared');
  }
} 