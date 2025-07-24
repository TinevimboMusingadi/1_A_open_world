/**
 * GameContextBuilder - Builds structured context about the game state for LLM
 * Extracts and formats relevant game information for intelligent code generation
 */
export class GameContextBuilder {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
    this.maxEntitiesInContext = 20; // Limit for context size
    this.maxContextLength = 8000; // Character limit for context
  }

  /**
   * Build comprehensive game context for LLM
   * @param {string} userRequest - User's natural language request
   * @param {Object} options - Additional options
   * @returns {Object} - Structured game context
   */
  buildContext(userRequest, options = {}) {
    const context = {
      // Basic game information
      gameInfo: this.getGameInfo(),
      
      // Entity and component information
      entities: this.getEntityContext(options.includeAllEntities),
      components: this.getComponentTypes(),
      systems: this.getSystemInfo(),
      
      // User request analysis
      userRequest: {
        text: userRequest,
        intent: this.analyzeUserIntent(userRequest),
        entities: this.extractEntityReferences(userRequest),
        components: this.extractComponentReferences(userRequest),
        keywords: this.extractKeywords(userRequest)
      },
      
      // API information
      api: this.getAvailableAPI(),
      
      // Recent changes (if any)
      recentChanges: this.getRecentChanges(),
      
      // Performance constraints
      constraints: this.getConstraints(),
      
      // Examples
      examples: this.getRelevantExamples(userRequest),
      
      // Metadata
      timestamp: Date.now(),
      contextVersion: '1.0'
    };

    // Optimize context size
    return this.optimizeContext(context, userRequest);
  }

  /**
   * Get basic game information
   * @returns {Object} - Game info
   */
  getGameInfo() {
    const engineInfo = this.gameEngine.getInfo();
    const performanceStats = this.gameEngine.getPerformanceStats();

    return {
      version: engineInfo.version,
      running: engineInfo.running,
      paused: engineInfo.paused,
      frameCount: engineInfo.frameCount,
      totalTime: engineInfo.totalTime,
      fps: Math.round(performanceStats.fps),
      entityCount: performanceStats.entityStats.activeEntities,
      systemCount: engineInfo.systems.length
    };
  }

  /**
   * Get entity context information
   * @param {boolean} includeAll - Whether to include all entities
   * @returns {Array} - Entity information
   */
  getEntityContext(includeAll = false) {
    const entities = this.gameEngine.entityManager.getActiveEntities();
    const maxEntities = includeAll ? entities.length : Math.min(entities.length, this.maxEntitiesInContext);
    
    return entities.slice(0, maxEntities).map(entity => ({
      id: entity.id,
      active: entity.active,
      tags: Array.from(entity.tags),
      components: this.getEntityComponents(entity),
      position: this.getEntityPosition(entity),
      bounds: this.getEntityBounds(entity)
    }));
  }

  /**
   * Get components for a specific entity
   * @param {Entity} entity - The entity
   * @returns {Object} - Component information
   */
  getEntityComponents(entity) {
    const components = {};
    
    for (const [type, component] of entity.components) {
      components[type] = {
        enabled: component.enabled,
        data: this.extractComponentData(component, type)
      };
    }
    
    return components;
  }

  /**
   * Extract relevant data from a component
   * @param {Component} component - The component
   * @param {string} type - Component type
   * @returns {Object} - Relevant component data
   */
  extractComponentData(component, type) {
    switch (type) {
      case 'TransformComponent':
        return {
          position: component.position,
          rotation: component.rotation,
          scale: component.scale
        };
      
      case 'RenderComponent':
        return {
          visible: component.visible,
          color: component.color,
          shape: component.shape,
          width: component.width,
          height: component.height,
          opacity: component.opacity
        };
      
      case 'MovementComponent':
        return {
          velocity: component.velocity,
          maxSpeed: component.maxSpeed,
          canMove: component.canMove,
          isGrounded: component.isGrounded
        };
      
      case 'PhysicsComponent':
        return {
          bodyType: component.bodyType,
          mass: component.mass,
          friction: component.friction,
          restitution: component.restitution
        };
      
      case 'PlayerControllerComponent':
        return {
          isMoving: component.isMoving,
          isRunning: component.isRunning,
          moveSpeed: component.moveSpeed
        };
      
      default:
        // Return basic properties for unknown components
        const data = {};
        for (const key in component) {
          if (component.hasOwnProperty(key) && 
              key !== 'entity' && 
              typeof component[key] !== 'function') {
            data[key] = component[key];
          }
        }
        return data;
    }
  }

  /**
   * Get entity position if it has a transform
   * @param {Entity} entity - The entity
   * @returns {Object|null} - Position or null
   */
  getEntityPosition(entity) {
    const transform = entity.getComponent('TransformComponent');
    return transform ? transform.position : null;
  }

  /**
   * Get entity bounds if it has a render component
   * @param {Entity} entity - The entity
   * @returns {Object|null} - Bounds or null
   */
  getEntityBounds(entity) {
    const render = entity.getComponent('RenderComponent');
    const transform = entity.getComponent('TransformComponent');
    
    if (render && transform) {
      return render.getBounds(transform);
    }
    
    return null;
  }

  /**
   * Get available component types
   * @returns {Array} - Component type information
   */
  getComponentTypes() {
    return [
      {
        name: 'TransformComponent',
        description: 'Handles position, rotation, and scale',
        properties: ['position', 'rotation', 'scale'],
        methods: ['setPosition', 'translate', 'setRotation', 'rotate']
      },
      {
        name: 'RenderComponent',
        description: 'Handles visual rendering',
        properties: ['visible', 'color', 'shape', 'width', 'height', 'opacity'],
        methods: ['setVisible', 'setColor', 'setSize', 'addAnimation']
      },
      {
        name: 'MovementComponent',
        description: 'Handles entity movement and physics',
        properties: ['velocity', 'maxSpeed', 'canMove', 'friction'],
        methods: ['move', 'jump', 'addForce', 'stop']
      },
      {
        name: 'PhysicsComponent',
        description: 'Integrates with physics engine',
        properties: ['bodyType', 'mass', 'friction', 'restitution'],
        methods: ['setPosition', 'applyForce', 'setVelocity']
      },
      {
        name: 'PlayerControllerComponent',
        description: 'Handles user input',
        properties: ['keyBindings', 'moveSpeed', 'isMoving'],
        methods: ['isActionPressed', 'getMovementInput']
      }
    ];
  }

  /**
   * Get system information
   * @returns {Array} - System information
   */
  getSystemInfo() {
    return Array.from(this.gameEngine.systems.values()).map(system => ({
      name: system.name,
      enabled: system.enabled,
      priority: system.priority,
      requiredComponents: system.requiredComponents,
      performance: system.getPerformanceStats()
    }));
  }

  /**
   * Analyze user intent from natural language
   * @param {string} userRequest - User's request
   * @returns {Object} - Intent analysis
   */
  analyzeUserIntent(userRequest) {
    const request = userRequest.toLowerCase();
    
    const intents = {
      create: /create|add|spawn|make|generate|build|new/,
      modify: /change|modify|update|edit|alter|adjust|set/,
      delete: /delete|remove|destroy|eliminate/,
      move: /move|teleport|position|place|relocate/,
      animate: /animate|rotation|spin|bounce|wiggle/,
      style: /color|size|shape|appearance|look|visual/,
      physics: /gravity|bounce|collision|physics|force|velocity/,
      behavior: /behavior|ai|movement|action|script/,
      query: /what|how|where|show|list|find|get/
    };

    const detectedIntents = [];
    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(request)) {
        detectedIntents.push(intent);
      }
    }

    return {
      primary: detectedIntents[0] || 'unknown',
      all: detectedIntents,
      confidence: detectedIntents.length > 0 ? 0.8 : 0.2
    };
  }

  /**
   * Extract entity references from user request
   * @param {string} userRequest - User's request
   * @returns {Array} - Detected entity references
   */
  extractEntityReferences(userRequest) {
    const request = userRequest.toLowerCase();
    const entityTerms = [
      'player', 'enemy', 'enemies', 'character', 'object', 'item',
      'platform', 'wall', 'ground', 'projectile', 'bullet',
      'coin', 'powerup', 'obstacle', 'target', 'goal'
    ];

    return entityTerms.filter(term => request.includes(term));
  }

  /**
   * Extract component references from user request
   * @param {string} userRequest - User's request
   * @returns {Array} - Detected component references
   */
  extractComponentReferences(userRequest) {
    const request = userRequest.toLowerCase();
    const componentMap = {
      'TransformComponent': ['position', 'location', 'coordinate', 'move', 'teleport', 'place'],
      'RenderComponent': ['color', 'size', 'shape', 'appearance', 'visual', 'sprite', 'image'],
      'MovementComponent': ['speed', 'velocity', 'movement', 'walk', 'run', 'jump'],
      'PhysicsComponent': ['physics', 'collision', 'bounce', 'gravity', 'force', 'mass'],
      'PlayerControllerComponent': ['control', 'input', 'keyboard', 'mouse', 'player']
    };

    const references = [];
    for (const [component, keywords] of Object.entries(componentMap)) {
      if (keywords.some(keyword => request.includes(keyword))) {
        references.push(component);
      }
    }

    return references;
  }

  /**
   * Extract keywords from user request
   * @param {string} userRequest - User's request
   * @returns {Array} - Important keywords
   */
  extractKeywords(userRequest) {
    const words = userRequest.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Remove common stop words
    const stopWords = new Set(['the', 'and', 'but', 'for', 'with', 'this', 'that', 'can', 'will']);
    return words.filter(word => !stopWords.has(word));
  }

  /**
   * Get available API functions
   * @returns {Object} - API documentation
   */
  getAvailableAPI() {
    return {
      game: {
        createEntity: 'Create a new entity with optional ID',
        getEntity: 'Get entity by ID',
        destroyEntity: 'Destroy entity by ID',
        getEntitiesWithComponents: 'Query entities by component types',
        getEntitiesByTag: 'Get entities with specific tag'
      },
      entity: {
        addComponent: 'Add component to entity',
        getComponent: 'Get component from entity',
        removeComponent: 'Remove component from entity',
        addTag: 'Add tag to entity',
        hasTag: 'Check if entity has tag'
      },
      components: {
        TransformComponent: 'new TransformComponent(x, y, rotation, scaleX, scaleY)',
        RenderComponent: 'new RenderComponent({ color, width, height, shape })',
        MovementComponent: 'new MovementComponent({ speed, maxSpeed })',
        PhysicsComponent: 'new PhysicsComponent({ bodyType, mass, friction })',
        PlayerControllerComponent: 'new PlayerControllerComponent({ moveSpeed })'
      }
    };
  }

  /**
   * Get recent changes made to the game
   * @returns {Array} - Recent changes
   */
  getRecentChanges() {
    // This would be populated by tracking modifications
    // For now, return empty array
    return [];
  }

  /**
   * Get performance and safety constraints
   * @returns {Object} - Constraints
   */
  getConstraints() {
    return {
      maxEntities: 1000,
      maxCodeLines: 50,
      safetyRules: [
        'No infinite loops',
        'No network requests',
        'No file system access',
        'No DOM manipulation outside canvas',
        'Must use provided API functions'
      ],
      performance: {
        targetFPS: 60,
        maxEntitiesPerFrame: 500,
        memoryLimit: '100MB'
      }
    };
  }

  /**
   * Get relevant examples based on user request
   * @param {string} userRequest - User's request
   * @returns {Array} - Code examples
   */
  getRelevantExamples(userRequest) {
    const intent = this.analyzeUserIntent(userRequest);
    const examples = [];

    if (intent.all.includes('create')) {
      examples.push({
        title: 'Create a simple entity',
        code: `// Create a new player entity
const player = game.createEntity('player');
player.addComponent(new TransformComponent(100, 100));
player.addComponent(new RenderComponent({ color: 'blue', width: 32, height: 32 }));
player.addTag('player');`
      });
    }

    if (intent.all.includes('modify')) {
      examples.push({
        title: 'Modify entity properties',
        code: `// Change entity color and position
const entity = game.getEntity('player');
const render = entity.getComponent('RenderComponent');
const transform = entity.getComponent('TransformComponent');

render.setColor('red');
transform.setPosition(200, 150);`
      });
    }

    if (intent.all.includes('physics')) {
      examples.push({
        title: 'Add physics to entity',
        code: `// Add physics component
const entity = game.getEntity('player');
entity.addComponent(new PhysicsComponent({
  bodyType: 'dynamic',
  mass: 1,
  friction: 0.5,
  restitution: 0.3
}));`
      });
    }

    return examples;
  }

  /**
   * Optimize context to fit within size limits
   * @param {Object} context - Full context
   * @param {string} userRequest - User request for prioritization
   * @returns {Object} - Optimized context
   */
  optimizeContext(context, userRequest) {
    // Estimate context size
    const contextString = JSON.stringify(context);
    
    if (contextString.length <= this.maxContextLength) {
      return context;
    }

    // Priority reduction strategies
    const optimized = { ...context };

    // 1. Reduce entity details
    if (optimized.entities.length > 10) {
      optimized.entities = optimized.entities.slice(0, 10);
    }

    // 2. Simplify component data
    optimized.entities = optimized.entities.map(entity => ({
      ...entity,
      components: this.simplifyComponents(entity.components)
    }));

    // 3. Remove less relevant examples
    if (optimized.examples.length > 2) {
      optimized.examples = optimized.examples.slice(0, 2);
    }

    // 4. Truncate recent changes if too many
    if (optimized.recentChanges.length > 5) {
      optimized.recentChanges = optimized.recentChanges.slice(-5);
    }

    return optimized;
  }

  /**
   * Simplify component data for context size optimization
   * @param {Object} components - Component data
   * @returns {Object} - Simplified components
   */
  simplifyComponents(components) {
    const simplified = {};
    
    for (const [type, component] of Object.entries(components)) {
      // Keep only essential properties
      switch (type) {
        case 'TransformComponent':
          simplified[type] = {
            enabled: component.enabled,
            data: {
              position: component.data.position,
              rotation: component.data.rotation
            }
          };
          break;
        
        case 'RenderComponent':
          simplified[type] = {
            enabled: component.enabled,
            data: {
              visible: component.data.visible,
              color: component.data.color,
              shape: component.data.shape
            }
          };
          break;
        
        default:
          simplified[type] = {
            enabled: component.enabled,
            data: {} // Minimal data for other components
          };
      }
    }
    
    return simplified;
  }

  /**
   * Get context size in characters
   * @param {Object} context - Context object
   * @returns {number} - Size in characters
   */
  getContextSize(context) {
    return JSON.stringify(context).length;
  }

  /**
   * Set context size limits
   * @param {number} maxLength - Maximum context length
   * @param {number} maxEntities - Maximum entities in context
   */
  setLimits(maxLength, maxEntities) {
    this.maxContextLength = maxLength;
    this.maxEntitiesInContext = maxEntities;
  }
} 