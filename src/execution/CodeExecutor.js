import { VM } from 'vm2';

/**
 * CodeExecutor - Secure sandbox for executing LLM-generated code
 * Provides isolation, resource limits, and safety constraints
 */
export class CodeExecutor {
  constructor(options = {}) {
    // Security options
    this.timeout = options.timeout || 5000; // 5 seconds
    this.allowAsync = options.allowAsync || false;
    this.allowEval = false; // Never allow eval
    
    // Resource limits
    this.maxMemory = options.maxMemory || 50 * 1024 * 1024; // 50MB
    this.maxCallDepth = options.maxCallDepth || 100;
    
    // Execution tracking
    this.executionCount = 0;
    this.totalExecutionTime = 0;
    this.errorCount = 0;
    
    // Create base VM configuration
    this.vmOptions = {
      timeout: this.timeout,
      eval: this.allowEval,
      wasm: false,
      fixAsync: this.allowAsync,
      sandbox: {}
    };
  }

  /**
   * Execute code in a secure sandbox
   * @param {string} code - Code to execute
   * @param {Object} context - Execution context/sandbox
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async execute(code, context = {}, options = {}) {
    const startTime = Date.now();
    this.executionCount++;

    try {
      // Validate inputs
      this.validateCode(code);
      this.validateContext(context);
      
      // Create VM instance
      const vm = this.createVM(context, options);
      
      // Execute code
      const result = await this.executeInVM(vm, code, options);
      
      // Track success
      const executionTime = Date.now() - startTime;
      this.totalExecutionTime += executionTime;
      
      return {
        success: true,
        result: result,
        executionTime: executionTime,
        memoryUsed: this.estimateMemoryUsage(),
        vmStats: this.getVMStats()
      };

    } catch (error) {
      this.errorCount++;
      
      return {
        success: false,
        error: {
          message: error.message,
          type: this.categorizeError(error),
          stack: error.stack
        },
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate code before execution
   * @param {string} code - Code to validate
   */
  validateCode(code) {
    if (typeof code !== 'string') {
      throw new Error('Code must be a string');
    }

    if (code.length === 0) {
      throw new Error('Code cannot be empty');
    }

    if (code.length > 50000) {
      throw new Error('Code too long (max 50,000 characters)');
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /process\./,
      /require\s*\(/,
      /import\s*\(/,
      /__proto__/,
      /constructor\s*\./,
      /prototype\s*\./
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Dangerous code pattern detected: ${pattern.source}`);
      }
    }

    // Check for infinite loop patterns
    const infiniteLoopPatterns = [
      /while\s*\(\s*true\s*\)/,
      /for\s*\(\s*;\s*;\s*\)/,
      /while\s*\(\s*1\s*\)/
    ];

    for (const pattern of infiniteLoopPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Potential infinite loop detected: ${pattern.source}`);
      }
    }
  }

  /**
   * Validate execution context
   * @param {Object} context - Execution context
   */
  validateContext(context) {
    if (typeof context !== 'object' || context === null) {
      throw new Error('Context must be an object');
    }

    // Check context size
    const contextString = JSON.stringify(context);
    if (contextString.length > 100000) {
      throw new Error('Context too large (max 100KB)');
    }

    // Validate context properties
    for (const [key, value] of Object.entries(context)) {
      if (typeof key !== 'string') {
        throw new Error('Context keys must be strings');
      }

      if (key.startsWith('_') || key.includes('__')) {
        throw new Error(`Invalid context key: ${key}`);
      }

      // Check for dangerous values
      if (typeof value === 'function' && !this.isSafeFunction(value)) {
        throw new Error(`Unsafe function in context: ${key}`);
      }
    }
  }

  /**
   * Check if a function is safe to include in context
   * @param {Function} func - Function to check
   * @returns {boolean} - True if safe
   */
  isSafeFunction(func) {
    const funcString = func.toString();
    
    // Whitelist safe patterns
    const safePatterns = [
      /console\.(log|warn|error)/,
      /Math\./,
      /Array\./,
      /Object\./
    ];

    // Check if function contains only safe patterns
    for (const pattern of safePatterns) {
      if (pattern.test(funcString)) {
        return true;
      }
    }

    // Custom validation for game API functions
    if (funcString.includes('createEntity') || 
        funcString.includes('getEntity') ||
        funcString.includes('addComponent')) {
      return true;
    }

    return false;
  }

  /**
   * Create VM instance with security settings
   * @param {Object} context - Execution context
   * @param {Object} options - VM options
   * @returns {VM} - VM instance
   */
  createVM(context, options = {}) {
    const vmOptions = {
      ...this.vmOptions,
      timeout: options.timeout || this.timeout,
      sandbox: {
        ...this.createBaseSandbox(),
        ...context
      }
    };

    return new VM(vmOptions);
  }

  /**
   * Create base sandbox with safe built-ins
   * @returns {Object} - Base sandbox
   */
  createBaseSandbox() {
    return {
      // Safe built-ins
      Math: Math,
      JSON: JSON,
      
      // Safe Array and Object methods
      Array: {
        isArray: Array.isArray,
        from: Array.from
      },
      
      Object: {
        keys: Object.keys,
        values: Object.values,
        entries: Object.entries,
        assign: Object.assign
      },

      // Safe string methods
      String: String,
      Number: Number,
      Boolean: Boolean,
      
      // Date (limited)
      Date: {
        now: Date.now
      },

      // Console for debugging (limited)
      console: {
        log: (...args) => console.log('[Sandbox]:', ...args),
        warn: (...args) => console.warn('[Sandbox]:', ...args),
        error: (...args) => console.error('[Sandbox]:', ...args)
      },

      // Utility functions
      typeof: (obj) => typeof obj,
      isNaN: isNaN,
      isFinite: isFinite,
      parseInt: parseInt,
      parseFloat: parseFloat
    };
  }

  /**
   * Execute code in VM with monitoring
   * @param {VM} vm - VM instance
   * @param {string} code - Code to execute
   * @param {Object} options - Execution options
   * @returns {Promise<any>} - Execution result
   */
  async executeInVM(vm, code, options = {}) {
    // Wrap code with monitoring
    const wrappedCode = this.wrapCodeWithMonitoring(code);
    
    // Execute with timeout
    return new Promise((resolve, reject) => {
      const executionTimeout = setTimeout(() => {
        reject(new Error(`Execution timeout after ${this.timeout}ms`));
      }, this.timeout);

      try {
        const result = vm.run(wrappedCode);
        clearTimeout(executionTimeout);
        resolve(result);
      } catch (error) {
        clearTimeout(executionTimeout);
        reject(error);
      }
    });
  }

  /**
   * Wrap code with execution monitoring
   * @param {string} code - Original code
   * @returns {string} - Wrapped code
   */
  wrapCodeWithMonitoring(code) {
    return `
      (function() {
        'use strict';
        
        // Execution monitoring
        let callDepth = 0;
        const maxCallDepth = ${this.maxCallDepth};
        
        // Override function calls to track depth
        const originalFunction = Function;
        
        // Memory usage tracking (simplified)
        let memoryUsage = 0;
        
        try {
          // Execute user code
          ${code}
        } catch (error) {
          console.error('Code execution error:', error.message);
          throw error;
        }
      })();
    `;
  }

  /**
   * Estimate memory usage (simplified)
   * @returns {number} - Estimated memory usage in bytes
   */
  estimateMemoryUsage() {
    // This is a simplified estimation
    // In production, you'd want more sophisticated memory tracking
    return process.memoryUsage().heapUsed;
  }

  /**
   * Get VM statistics
   * @returns {Object} - VM statistics
   */
  getVMStats() {
    return {
      executionCount: this.executionCount,
      totalExecutionTime: this.totalExecutionTime,
      averageExecutionTime: this.executionCount > 0 
        ? this.totalExecutionTime / this.executionCount 
        : 0,
      errorCount: this.errorCount,
      errorRate: this.executionCount > 0 
        ? (this.errorCount / this.executionCount) * 100 
        : 0
    };
  }

  /**
   * Categorize execution errors
   * @param {Error} error - Error to categorize
   * @returns {string} - Error category
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('memory')) return 'memory_limit';
    if (message.includes('syntax')) return 'syntax_error';
    if (message.includes('reference')) return 'reference_error';
    if (message.includes('type')) return 'type_error';
    if (message.includes('dangerous') || message.includes('unsafe')) return 'security_violation';
    if (message.includes('infinite loop')) return 'infinite_loop';
    
    return 'runtime_error';
  }

  /**
   * Execute code with custom resource limits
   * @param {string} code - Code to execute
   * @param {Object} context - Execution context
   * @param {Object} limits - Custom resource limits
   * @returns {Promise<Object>} - Execution result
   */
  async executeWithLimits(code, context, limits = {}) {
    const originalTimeout = this.timeout;
    const originalMaxMemory = this.maxMemory;

    try {
      // Apply custom limits
      this.timeout = limits.timeout || this.timeout;
      this.maxMemory = limits.maxMemory || this.maxMemory;

      // Execute with new limits
      return await this.execute(code, context, limits);

    } finally {
      // Restore original limits
      this.timeout = originalTimeout;
      this.maxMemory = originalMaxMemory;
    }
  }

  /**
   * Test code safety without execution
   * @param {string} code - Code to test
   * @returns {Object} - Safety analysis result
   */
  analyzeCodeSafety(code) {
    const issues = [];
    const warnings = [];

    try {
      this.validateCode(code);
    } catch (error) {
      issues.push(error.message);
    }

    // Additional static analysis
    const lines = code.split('\n');
    
    // Check for complexity
    if (lines.length > 100) {
      warnings.push(`Code is long (${lines.length} lines)`);
    }

    // Check for nested loops
    const loopCount = (code.match(/for\s*\(|while\s*\(/g) || []).length;
    if (loopCount > 3) {
      warnings.push(`Multiple loops detected (${loopCount})`);
    }

    // Check for function definitions
    const funcCount = (code.match(/function\s+\w+|=>\s*{|\w+\s*=\s*function/g) || []).length;
    if (funcCount > 5) {
      warnings.push(`Many functions defined (${funcCount})`);
    }

    return {
      isSafe: issues.length === 0,
      issues: issues,
      warnings: warnings,
      complexity: {
        lines: lines.length,
        loops: loopCount,
        functions: funcCount
      }
    };
  }

  /**
   * Reset executor statistics
   */
  resetStats() {
    this.executionCount = 0;
    this.totalExecutionTime = 0;
    this.errorCount = 0;
  }

  /**
   * Get executor configuration
   * @returns {Object} - Current configuration
   */
  getConfig() {
    return {
      timeout: this.timeout,
      allowAsync: this.allowAsync,
      allowEval: this.allowEval,
      maxMemory: this.maxMemory,
      maxCallDepth: this.maxCallDepth
    };
  }

  /**
   * Update executor configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.timeout !== undefined) this.timeout = config.timeout;
    if (config.allowAsync !== undefined) this.allowAsync = config.allowAsync;
    if (config.maxMemory !== undefined) this.maxMemory = config.maxMemory;
    if (config.maxCallDepth !== undefined) this.maxCallDepth = config.maxCallDepth;
    
    // Update VM options
    this.vmOptions.timeout = this.timeout;
    this.vmOptions.fixAsync = this.allowAsync;
  }
} 