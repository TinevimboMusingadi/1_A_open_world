import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * GeminiClient - Interface for Google Gemini API
 * Handles all communication with the Gemini language model for code generation
 */
export class GeminiClient {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('API key is required for GeminiClient');
    }

    // Initialize the Google AI client
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Configuration
    this.model = options.model || 'gemini-2.5-flash-lite';
    this.maxTokens = options.maxTokens || 2048;
    this.temperature = options.temperature || 0.7;
    this.timeout = options.timeout || 30000; // 30 seconds
    
    // Request tracking
    this.requestCount = 0;
    this.totalTokensUsed = 0;
    this.requestHistory = [];
    
    // Error handling
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
    
    // Initialize the model
    this.generativeModel = this.genAI.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature: this.temperature,
      }
    });
  }

  /**
   * Generate content using Gemini API
   * @param {string} prompt - The prompt to send to the model
   * @param {Object} options - Additional options for this request
   * @returns {Promise<Object>} - Response object with generated content
   */
  async generateContent(prompt, options = {}) {
    const startTime = Date.now();
    
    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a non-empty string');
    }

    if (prompt.length > 30000) {
      throw new Error('Prompt too long. Maximum length is 30,000 characters');
    }

    // Request configuration
    const requestConfig = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      ...options
    };

    // Track request
    this.requestCount++;
    const requestId = this.generateRequestId();

    try {
      // Make API call with retry logic
      const response = await this.makeRequestWithRetry(requestConfig, requestId);
      
      // Process response
      const processedResponse = this.processResponse(response, requestId, startTime);
      
      // Store in history
      this.addToHistory(requestId, prompt, processedResponse, startTime);
      
      return processedResponse;

    } catch (error) {
      const errorResponse = this.handleError(error, requestId, prompt, startTime);
      this.addToHistory(requestId, prompt, errorResponse, startTime);
      throw error;
    }
  }

  /**
   * Generate code specifically for game modifications
   * @param {string} userRequest - Natural language description of desired change
   * @param {Object} gameContext - Current game state context
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Generated code response
   */
  async generateGameCode(userRequest, gameContext, options = {}) {
    const systemPrompt = this.buildGameCodePrompt(userRequest, gameContext);
    
    const response = await this.generateContent(systemPrompt, {
      temperature: options.temperature || 0.3, // Lower temperature for code generation
      maxOutputTokens: options.maxTokens || 1024,
      ...options
    });

    // Parse and validate the generated code
    return this.parseCodeResponse(response, userRequest, gameContext);
  }

  /**
   * Make API request with retry logic
   * @param {Object} requestConfig - Request configuration
   * @param {string} requestId - Unique request identifier
   * @returns {Promise<Object>} - API response
   */
  async makeRequestWithRetry(requestConfig, requestId) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // Add timeout to the request
        const response = await Promise.race([
          this.generativeModel.generateContent(requestConfig),
          this.createTimeout(this.timeout)
        ]);

        return response;

      } catch (error) {
        lastError = error;
        
        // Don't retry on certain types of errors
        if (this.shouldNotRetry(error)) {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Process API response
   * @param {Object} response - Raw API response
   * @param {string} requestId - Request identifier
   * @param {number} startTime - Request start time
   * @returns {Object} - Processed response
   */
  processResponse(response, requestId, startTime) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Extract text from response
    const text = response.response?.text() || '';
    
    // Calculate token usage (estimate)
    const estimatedTokens = Math.ceil(text.length / 4);
    this.totalTokensUsed += estimatedTokens;

    return {
      id: requestId,
      text: text,
      success: true,
      duration: duration,
      estimatedTokens: estimatedTokens,
      timestamp: endTime,
      model: this.model,
      finishReason: response.response?.candidates?.[0]?.finishReason || 'unknown'
    };
  }

  /**
   * Build a specialized prompt for game code generation
   * @param {string} userRequest - User's natural language request
   * @param {Object} gameContext - Current game state
   * @returns {string} - Formatted prompt
   */
  buildGameCodePrompt(userRequest, gameContext) {
    return `You are a game development AI assistant that generates JavaScript code for a 2D game engine.

GAME CONTEXT:
- Engine: Entity-Component-System architecture
- Available Components: ${gameContext.availableComponents?.join(', ') || 'TransformComponent, RenderComponent, MovementComponent, PhysicsComponent, PlayerControllerComponent'}
- Current Entities: ${gameContext.entityCount || 0} entities
- Available Systems: ${gameContext.availableSystems?.join(', ') || 'MovementSystem'}

USER REQUEST: "${userRequest}"

GUIDELINES:
1. Generate only safe, executable JavaScript code
2. Use the provided game API functions
3. Include error handling
4. Keep code concise and focused
5. Add helpful comments explaining the changes
6. Return code wrapped in \`\`\`javascript blocks

AVAILABLE API FUNCTIONS:
- game.createEntity(id?) - Create new entity
- game.getEntity(id) - Get entity by ID
- game.getEntitiesWithComponents([componentTypes]) - Query entities
- entity.addComponent(component) - Add component to entity
- entity.getComponent(type) - Get component from entity
- entity.addTag(tag) - Add tag to entity

SAFETY RULES:
- No infinite loops
- No network requests
- No file system access
- No DOM manipulation outside game canvas
- Maximum 50 lines of code

Generate the code:`;
  }

  /**
   * Parse and validate generated code response
   * @param {Object} response - API response
   * @param {string} userRequest - Original user request
   * @param {Object} gameContext - Game context
   * @returns {Object} - Parsed code response
   */
  parseCodeResponse(response, userRequest, gameContext) {
    const text = response.text;
    
    // Extract JavaScript code blocks
    const codeBlocks = this.extractCodeBlocks(text);
    
    if (codeBlocks.length === 0) {
      throw new Error('No code blocks found in response');
    }

    const mainCode = codeBlocks[0]; // Use the first code block
    
    // Basic validation
    this.validateGeneratedCode(mainCode);

    return {
      ...response,
      code: mainCode,
      explanation: this.extractExplanation(text, codeBlocks),
      userRequest: userRequest,
      codeBlocks: codeBlocks.length,
      validated: true
    };
  }

  /**
   * Extract JavaScript code blocks from response text
   * @param {string} text - Response text
   * @returns {string[]} - Array of code blocks
   */
  extractCodeBlocks(text) {
    const codeBlockRegex = /```(?:javascript|js)?\n?([\s\S]*?)```/gi;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push(match[1].trim());
    }

    return blocks;
  }

  /**
   * Extract explanation text (non-code content)
   * @param {string} text - Full response text
   * @param {string[]} codeBlocks - Extracted code blocks
   * @returns {string} - Explanation text
   */
  extractExplanation(text, codeBlocks) {
    let explanation = text;
    
    // Remove code blocks to get explanation
    explanation = explanation.replace(/```(?:javascript|js)?\n?[\s\S]*?```/gi, '');
    
    return explanation.trim();
  }

  /**
   * Basic validation of generated code
   * @param {string} code - Generated code
   */
  validateGeneratedCode(code) {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /XMLHttpRequest/,
      /fetch\s*\(/,
      /import\s*\(/,
      /require\s*\(/,
      /process\./,
      /global\./,
      /window\./,
      /document\./
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Generated code contains dangerous pattern: ${pattern.source}`);
      }
    }

    // Check code length
    if (code.split('\n').length > 50) {
      throw new Error('Generated code exceeds 50 lines limit');
    }

    // Check for infinite loop patterns
    const infiniteLoopPatterns = [
      /while\s*\(\s*true\s*\)/,
      /for\s*\(\s*;\s*;\s*\)/
    ];

    for (const pattern of infiniteLoopPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Generated code contains potential infinite loop: ${pattern.source}`);
      }
    }
  }

  /**
   * Handle API errors
   * @param {Error} error - The error that occurred
   * @param {string} requestId - Request identifier
   * @param {string} prompt - Original prompt
   * @param {number} startTime - Request start time
   * @returns {Object} - Error response object
   */
  handleError(error, requestId, prompt, startTime) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    let errorType = 'unknown';
    let userMessage = 'An unexpected error occurred';

    // Categorize error types
    if (error.message?.includes('API key')) {
      errorType = 'authentication';
      userMessage = 'Invalid API key or authentication failed';
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      errorType = 'rate_limit';
      userMessage = 'API rate limit exceeded. Please try again later';
    } else if (error.message?.includes('timeout')) {
      errorType = 'timeout';
      userMessage = 'Request timed out. Please try again';
    } else if (error.message?.includes('network')) {
      errorType = 'network';
      userMessage = 'Network error. Please check your connection';
    }

    return {
      id: requestId,
      success: false,
      error: {
        type: errorType,
        message: error.message,
        userMessage: userMessage
      },
      duration: duration,
      timestamp: endTime
    };
  }

  /**
   * Check if error should not be retried
   * @param {Error} error - The error to check
   * @returns {boolean} - True if should not retry
   */
  shouldNotRetry(error) {
    const nonRetryableErrors = [
      'API key',
      'authentication',
      'invalid request',
      'malformed'
    ];

    return nonRetryableErrors.some(pattern => 
      error.message?.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Create a timeout promise
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} - Promise that rejects after timeout
   */
  createTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Delay execution
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise} - Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   * @returns {string} - Unique identifier
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add request to history
   * @param {string} requestId - Request identifier
   * @param {string} prompt - Original prompt
   * @param {Object} response - Response object
   * @param {number} startTime - Request start time
   */
  addToHistory(requestId, prompt, response, startTime) {
    this.requestHistory.push({
      id: requestId,
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      response: response,
      timestamp: startTime
    });

    // Keep only last 100 requests
    if (this.requestHistory.length > 100) {
      this.requestHistory.shift();
    }
  }

  /**
   * Get client statistics
   * @returns {Object} - Usage statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      totalTokensUsed: this.totalTokensUsed,
      averageTokensPerRequest: this.requestCount > 0 ? Math.round(this.totalTokensUsed / this.requestCount) : 0,
      historySize: this.requestHistory.length,
      model: this.model,
      configuration: {
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        timeout: this.timeout,
        retryAttempts: this.retryAttempts
      }
    };
  }

  /**
   * Clear request history
   */
  clearHistory() {
    this.requestHistory = [];
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.requestCount = 0;
    this.totalTokensUsed = 0;
    this.clearHistory();
  }
} 