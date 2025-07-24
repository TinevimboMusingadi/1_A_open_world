import 'dotenv/config';
import { GeminiClient } from './GeminiClient.js';
import { GameContextBuilder } from './context/GameContextBuilder.js';

/**
 * LLMService - Main orchestrator for LLM-powered game modifications
 * Combines context building, code generation, and safe execution
 */
export class LLMService {
  constructor(gameEngine, options = {}) {
    this.gameEngine = gameEngine;
    
    // Initialize components
    this.geminiClient = new GeminiClient(
      process.env.GOOGLE_AI_API_KEY,
      {
        model: options.model || 'gemini-2.5-flash-lite',
        temperature: options.temperature || 0.3,
        maxTokens: options.maxTokens || 1024,
        timeout: options.timeout || 30000
      }
    );
    
    this.contextBuilder = new GameContextBuilder(gameEngine);
    
    // Configuration
    this.enableSafetyChecks = options.enableSafetyChecks !== false;
    this.maxExecutionTime = options.maxExecutionTime || 5000; // 5 seconds
    this.maxMemoryUsage = options.maxMemoryUsage || 50 * 1024 * 1024; // 50MB
    
    // State tracking
    this.executionHistory = [];
    this.activeModifications = new Map();
    this.pendingRequests = new Map();
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalTokensUsed: 0,
      averageResponseTime: 0,
      safetyViolations: 0
    };
    
    // Event callbacks
    this.onModificationStart = options.onModificationStart || null;
    this.onModificationComplete = options.onModificationComplete || null;
    this.onModificationError = options.onModificationError || null;
    this.onSafetyViolation = options.onSafetyViolation || null;
  }

  /**
   * Process a natural language game modification request
   * @param {string} userRequest - User's natural language description
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Modification result
   */
  async processModificationRequest(userRequest, options = {}) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    // Validate input
    if (!userRequest || typeof userRequest !== 'string') {
      throw new Error('User request must be a non-empty string');
    }

    if (userRequest.length > 1000) {
      throw new Error('User request too long. Maximum 1000 characters.');
    }

    this.stats.totalRequests++;
    
    try {
      // Track pending request
      this.pendingRequests.set(requestId, {
        userRequest,
        startTime,
        status: 'processing'
      });

      // Notify start
      if (this.onModificationStart) {
        this.onModificationStart(requestId, userRequest);
      }

      // Build game context
      const gameContext = this.contextBuilder.buildContext(userRequest, options.context);
      
      // Generate code using LLM
      const codeResponse = await this.geminiClient.generateGameCode(
        userRequest, 
        gameContext, 
        options.generation
      );

      // Safety validation
      if (this.enableSafetyChecks) {
        await this.performSafetyChecks(codeResponse.code, userRequest);
      }

      // Execute the generated code
      const executionResult = await this.executeGeneratedCode(
        codeResponse.code,
        gameContext,
        options.execution
      );

      // Create successful result
      const result = {
        id: requestId,
        success: true,
        userRequest: userRequest,
        generatedCode: codeResponse.code,
        explanation: codeResponse.explanation,
        executionResult: executionResult,
        gameContext: this.sanitizeGameContext(gameContext),
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        tokensUsed: codeResponse.estimatedTokens || 0
      };

      // Update statistics
      this.stats.successfulExecutions++;
      this.updateStats(result);

      // Store in history
      this.addToHistory(result);

      // Notify completion
      if (this.onModificationComplete) {
        this.onModificationComplete(requestId, result);
      }

      return result;

    } catch (error) {
      // Handle error
      const errorResult = await this.handleError(error, requestId, userRequest, startTime);
      
      // Notify error
      if (this.onModificationError) {
        this.onModificationError(requestId, errorResult);
      }

      throw error;

    } finally {
      // Clean up pending request
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Perform safety checks on generated code
   * @param {string} code - Generated code to check
   * @param {string} userRequest - Original user request
   */
  async performSafetyChecks(code, userRequest) {
    const violations = [];

    // Check for dangerous patterns (already done in GeminiClient, but double-check)
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, description: 'Code evaluation' },
      { pattern: /Function\s*\(/, description: 'Dynamic function creation' },
      { pattern: /setTimeout|setInterval/, description: 'Timer functions' },
      { pattern: /XMLHttpRequest|fetch/, description: 'Network requests' },
      { pattern: /import\s*\(|require\s*\(/, description: 'Dynamic imports' },
      { pattern: /process\.|global\.|window\./, description: 'Global object access' },
      { pattern: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/, description: 'Infinite loops' }
    ];

    for (const { pattern, description } of dangerousPatterns) {
      if (pattern.test(code)) {
        violations.push(`${description}: ${pattern.source}`);
      }
    }

    // Check code complexity
    const lines = code.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 50) {
      violations.push(`Code too complex: ${lines.length} lines (max 50)`);
    }

    // Check for suspicious user request patterns
    const suspiciousRequests = [
      /hack|exploit|cheat|bypass|break/i,
      /delete\s+all|destroy\s+everything|crash/i,
      /infinite|unlimited|maximum/i
    ];

    for (const pattern of suspiciousRequests) {
      if (pattern.test(userRequest)) {
        violations.push(`Suspicious request pattern: ${pattern.source}`);
      }
    }

    // If violations found, increment counter and potentially block
    if (violations.length > 0) {
      this.stats.safetyViolations++;
      
      if (this.onSafetyViolation) {
        this.onSafetyViolation(violations, code, userRequest);
      }

      // For now, we'll throw an error. In production, you might want to
      // sanitize the code or ask for user confirmation
      throw new Error(`Safety violations detected: ${violations.join(', ')}`);
    }
  }

  /**
   * Execute generated code safely
   * @param {string} code - Code to execute
   * @param {Object} gameContext - Game context
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async executeGeneratedCode(code, gameContext, options = {}) {
    const startTime = Date.now();
    
    try {
      // Create safe execution environment
      const gameAPI = this.createGameAPI();
      const executionContext = this.createExecutionContext(gameAPI);
      
      // Wrap code in error handling
      const wrappedCode = this.wrapCodeForExecution(code);
      
      // Execute with timeout
      const result = await this.executeWithTimeout(
        wrappedCode,
        executionContext,
        options.timeout || this.maxExecutionTime
      );

      return {
        success: true,
        result: result,
        duration: Date.now() - startTime,
        memoryUsed: this.estimateMemoryUsage(),
        entitiesModified: this.getModifiedEntities(),
        componentsChanged: this.getChangedComponents()
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: this.categorizeExecutionError(error),
          stack: error.stack
        },
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Create safe Game API for LLM-generated code
   * @returns {Object} - Safe game API
   */
  createGameAPI() {
    const engine = this.gameEngine;
    
    return {
      // Entity management
      createEntity: (id) => {
        if (typeof id !== 'undefined' && typeof id !== 'string') {
          throw new Error('Entity ID must be a string or undefined');
        }
        return engine.createEntity(id);
      },

      getEntity: (id) => {
        if (typeof id !== 'string') {
          throw new Error('Entity ID must be a string');
        }
        return engine.getEntity(id);
      },

      destroyEntity: (id) => {
        if (typeof id !== 'string') {
          throw new Error('Entity ID must be a string');
        }
        engine.destroyEntity(id);
        return true;
      },

      getEntitiesWithComponents: (componentTypes) => {
        if (!Array.isArray(componentTypes)) {
          throw new Error('Component types must be an array');
        }
        return engine.getEntitiesWithComponents(componentTypes);
      },

      getEntitiesByTag: (tag) => {
        if (typeof tag !== 'string') {
          throw new Error('Tag must be a string');
        }
        return engine.entityManager.getEntitiesByTag(tag);
      },

      // Component creation helpers
      TransformComponent: (x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1) => {
        // Dynamic import to avoid circular dependencies
        return new (eval('TransformComponent'))(x, y, rotation, scaleX, scaleY);
      },

      RenderComponent: (options = {}) => {
        return new (eval('RenderComponent'))(options);
      },

      MovementComponent: (options = {}) => {
        return new (eval('MovementComponent'))(options);
      },

      PhysicsComponent: (options = {}) => {
        return new (eval('PhysicsComponent'))(options);
      },

      PlayerControllerComponent: (options = {}) => {
        return new (eval('PlayerControllerComponent'))(options);
      },

      // Utility functions
      console: {
        log: (...args) => console.log('[LLM Code]:', ...args),
        warn: (...args) => console.warn('[LLM Code]:', ...args),
        error: (...args) => console.error('[LLM Code]:', ...args)
      },

      Math: Math, // Safe math operations
      
      // Game state queries
      getGameStats: () => engine.getPerformanceStats(),
      
      // Safe random number generation
      random: () => Math.random(),
      randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
      randomColor: () => `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
    };
  }

  /**
   * Create execution context with limited scope
   * @param {Object} gameAPI - Safe game API
   * @returns {Object} - Execution context
   */
  createExecutionContext(gameAPI) {
    return {
      game: gameAPI,
      console: gameAPI.console,
      Math: gameAPI.Math,
      
      // Component constructors
      TransformComponent: gameAPI.TransformComponent,
      RenderComponent: gameAPI.RenderComponent,
      MovementComponent: gameAPI.MovementComponent,
      PhysicsComponent: gameAPI.PhysicsComponent,
      PlayerControllerComponent: gameAPI.PlayerControllerComponent
    };
  }

  /**
   * Wrap code for safe execution
   * @param {string} code - Code to wrap
   * @returns {string} - Wrapped code
   */
  wrapCodeForExecution(code) {
    return `
      (function() {
        'use strict';
        try {
          ${code}
        } catch (error) {
          console.error('Execution error:', error.message);
          throw error;
        }
      })();
    `;
  }

  /**
   * Execute code with timeout
   * @param {string} code - Code to execute
   * @param {Object} context - Execution context
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} - Execution result
   */
  async executeWithTimeout(code, context, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Code execution timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Create function with limited context
        const func = new Function(...Object.keys(context), code);
        const result = func(...Object.values(context));
        
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Handle execution errors
   * @param {Error} error - The error that occurred
   * @param {string} requestId - Request identifier
   * @param {string} userRequest - Original user request
   * @param {number} startTime - Request start time
   * @returns {Object} - Error result
   */
  async handleError(error, requestId, userRequest, startTime) {
    this.stats.failedExecutions++;
    
    const errorResult = {
      id: requestId,
      success: false,
      userRequest: userRequest,
      error: {
        message: error.message,
        type: this.categorizeError(error),
        timestamp: Date.now()
      },
      duration: Date.now() - startTime
    };

    // Add to history
    this.addToHistory(errorResult);

    return errorResult;
  }

  /**
   * Categorize different types of errors
   * @param {Error} error - The error to categorize
   * @returns {string} - Error category
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('safety') || message.includes('violation')) return 'safety';
    if (message.includes('syntax')) return 'syntax';
    if (message.includes('reference')) return 'reference';
    if (message.includes('api key') || message.includes('authentication')) return 'authentication';
    if (message.includes('rate limit') || message.includes('quota')) return 'rate_limit';
    if (message.includes('network')) return 'network';
    
    return 'unknown';
  }

  /**
   * Categorize execution errors specifically
   * @param {Error} error - Execution error
   * @returns {string} - Error category
   */
  categorizeExecutionError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'execution_timeout';
    if (message.includes('memory')) return 'memory_limit';
    if (message.includes('not defined')) return 'undefined_reference';
    if (message.includes('not a function')) return 'invalid_function_call';
    
    return 'execution_error';
  }

  /**
   * Estimate memory usage (simplified)
   * @returns {number} - Estimated memory usage in bytes
   */
  estimateMemoryUsage() {
    // This is a simplified estimation
    // In a real implementation, you'd want more sophisticated memory tracking
    const entityCount = this.gameEngine.entityManager.getStats().activeEntities;
    return entityCount * 1000; // Rough estimate: 1KB per entity
  }

  /**
   * Get entities that were modified in the last execution
   * @returns {Array} - Array of modified entity IDs
   */
  getModifiedEntities() {
    // This would track actual modifications during execution
    // For now, return empty array
    return [];
  }

  /**
   * Get components that were changed in the last execution
   * @returns {Array} - Array of changed component types
   */
  getChangedComponents() {
    // This would track actual component changes during execution
    // For now, return empty array
    return [];
  }

  /**
   * Sanitize game context for response (remove sensitive data)
   * @param {Object} context - Full game context
   * @returns {Object} - Sanitized context
   */
  sanitizeGameContext(context) {
    return {
      entityCount: context.gameInfo.entityCount,
      systemCount: context.gameInfo.systemCount,
      userRequest: context.userRequest,
      contextSize: this.contextBuilder.getContextSize(context)
    };
  }

  /**
   * Generate unique request ID
   * @returns {string} - Unique identifier
   */
  generateRequestId() {
    return `llm_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add result to execution history
   * @param {Object} result - Execution result
   */
  addToHistory(result) {
    this.executionHistory.push(result);
    
    // Keep only last 50 executions
    if (this.executionHistory.length > 50) {
      this.executionHistory.shift();
    }
  }

  /**
   * Update service statistics
   * @param {Object} result - Execution result
   */
  updateStats(result) {
    this.stats.totalTokensUsed += result.tokensUsed || 0;
    
    // Update average response time
    const currentAvg = this.stats.averageResponseTime;
    const totalRequests = this.stats.totalRequests;
    this.stats.averageResponseTime = 
      (currentAvg * (totalRequests - 1) + result.duration) / totalRequests;
  }

  /**
   * Get service statistics
   * @returns {Object} - Service statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulExecutions / this.stats.totalRequests) * 100 
        : 0,
      geminiStats: this.geminiClient.getStats(),
      historySize: this.executionHistory.length,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Get execution history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} - Execution history
   */
  getHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this.executionHistory = [];
  }

  /**
   * Reset service statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalTokensUsed: 0,
      averageResponseTime: 0,
      safetyViolations: 0
    };
    
    this.geminiClient.resetStats();
    this.clearHistory();
  }

  /**
   * Get pending requests
   * @returns {Array} - Array of pending request info
   */
  getPendingRequests() {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Cancel a pending request
   * @param {string} requestId - Request ID to cancel
   * @returns {boolean} - True if request was cancelled
   */
  cancelRequest(requestId) {
    return this.pendingRequests.delete(requestId);
  }
} 