import { LLMService } from '../../llm/LLMService.js';
import { GameEngine } from '../../engine/GameEngine.js';

// Mock dependencies
jest.mock('../../llm/GeminiClient.js', () => ({
  GeminiClient: jest.fn()
}));
jest.mock('../../llm/context/GameContextBuilder.js', () => ({
  GameContextBuilder: jest.fn()
}));

describe('LLMService', () => {
  let gameEngine;
  let llmService;
  let mockGeminiClient;
  let mockContextBuilder;

  beforeEach(() => {
    // Create game engine
    gameEngine = new GameEngine();
    
    // Mock GeminiClient
    mockGeminiClient = {
      generateGameCode: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        requestCount: 5,
        totalTokensUsed: 1000
      }),
      resetStats: jest.fn()
    };

    // Mock GameContextBuilder
    mockContextBuilder = {
      buildContext: jest.fn().mockReturnValue({
        gameInfo: { entityCount: 3 },
        entities: [],
        components: [],
        userRequest: { text: 'test request' }
      }),
      getContextSize: jest.fn().mockReturnValue(1000)
    };

    // Create LLMService with mocked dependencies
    llmService = new LLMService(gameEngine);
    llmService.geminiClient = mockGeminiClient;
    llmService.contextBuilder = mockContextBuilder;
  });

  describe('Constructor', () => {
    it('should create LLMService with default options', () => {
      const service = new LLMService(gameEngine);
      
      expect(service.gameEngine).toBe(gameEngine);
      expect(service.enableSafetyChecks).toBe(true);
      expect(service.maxExecutionTime).toBe(5000);
      expect(service.stats.totalRequests).toBe(0);
    });

    it('should create LLMService with custom options', () => {
      const options = {
        enableSafetyChecks: false,
        maxExecutionTime: 10000,
        onModificationComplete: jest.fn()
      };

      const service = new LLMService(gameEngine, options);
      
      expect(service.enableSafetyChecks).toBe(false);
      expect(service.maxExecutionTime).toBe(10000);
      expect(service.onModificationComplete).toBe(options.onModificationComplete);
    });
  });

  describe('processModificationRequest', () => {
    beforeEach(() => {
      // Mock successful code generation
      mockGeminiClient.generateGameCode.mockResolvedValue({
        success: true,
        code: 'const entity = game.createEntity(); entity.addTag("test");',
        explanation: 'Creates a test entity',
        estimatedTokens: 50
      });
    });

    it('should process valid modification request successfully', async () => {
      const userRequest = 'Create a test entity';
      const result = await llmService.processModificationRequest(userRequest);

      expect(result.success).toBe(true);
      expect(result.userRequest).toBe(userRequest);
      expect(result.generatedCode).toBeDefined();
      expect(result.explanation).toBe('Creates a test entity');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.tokensUsed).toBe(50);
    });

    it('should validate user request input', async () => {
      // Test empty request
      await expect(llmService.processModificationRequest('')).rejects.toThrow('non-empty string');
      
      // Test non-string request
      await expect(llmService.processModificationRequest(123)).rejects.toThrow('non-empty string');
      
      // Test overly long request
      const longRequest = 'a'.repeat(1001);
      await expect(llmService.processModificationRequest(longRequest)).rejects.toThrow('too long');
    });

    it('should build game context for request', async () => {
      const userRequest = 'Create a player';
      await llmService.processModificationRequest(userRequest);

      expect(mockContextBuilder.buildContext).toHaveBeenCalledWith(
        userRequest,
        undefined
      );
    });

    it('should call Gemini client for code generation', async () => {
      const userRequest = 'Create a player';
      await llmService.processModificationRequest(userRequest);

      expect(mockGeminiClient.generateGameCode).toHaveBeenCalledWith(
        userRequest,
        expect.any(Object),
        undefined
      );
    });

    it('should track statistics', async () => {
      const userRequest = 'Create a player';
      await llmService.processModificationRequest(userRequest);

      expect(llmService.stats.totalRequests).toBe(1);
      expect(llmService.stats.successfulExecutions).toBe(1);
      expect(llmService.stats.totalTokensUsed).toBe(50);
    });

    it('should add to execution history', async () => {
      const userRequest = 'Create a player';
      await llmService.processModificationRequest(userRequest);

      expect(llmService.executionHistory).toHaveLength(1);
      expect(llmService.executionHistory[0].userRequest).toBe(userRequest);
    });

    it('should handle Gemini client errors', async () => {
      mockGeminiClient.generateGameCode.mockRejectedValue(new Error('API Error'));
      
      try {
        await llmService.processModificationRequest('Create something');
      } catch (error) {
        expect(error.message).toBe('API Error');
      }

      expect(llmService.stats.failedExecutions).toBe(1);
    });
  });

  describe('performSafetyChecks', () => {
    it('should pass safe code', async () => {
      const safeCode = 'const entity = game.createEntity(); entity.addTag("player");';
      
      await expect(llmService.performSafetyChecks(safeCode, 'Create player')).resolves.toBeUndefined();
    });

    it('should detect dangerous code patterns', async () => {
      const dangerousCodes = [
        'eval("malicious code")',
        'new Function("return 1")',
        'setTimeout(() => {}, 1000)',
        'fetch("http://evil.com")',
        'while (true) { console.log("infinite"); }'
      ];

      for (const code of dangerousCodes) {
        await expect(llmService.performSafetyChecks(code, 'test')).rejects.toThrow('Safety violations');
      }
    });

    it('should detect suspicious user requests', async () => {
      const suspiciousRequests = [
        'hack the game',
        'delete all entities',
        'create infinite enemies'
      ];

      for (const request of suspiciousRequests) {
        await expect(llmService.performSafetyChecks('safe code', request)).rejects.toThrow('Safety violations');
      }
    });

    it('should detect overly complex code', async () => {
      const complexCode = Array(51).fill('console.log("line");').join('\n');
      
      await expect(llmService.performSafetyChecks(complexCode, 'test')).rejects.toThrow('too complex');
    });

    it('should track safety violations', async () => {
      try {
        await llmService.performSafetyChecks('eval("test")', 'test');
      } catch (error) {
        // Expected to throw
      }

      expect(llmService.stats.safetyViolations).toBe(1);
    });

    it('should skip safety checks when disabled', async () => {
      llmService.enableSafetyChecks = false;
      
      // This would normally fail safety checks
      await expect(llmService.performSafetyChecks('eval("test")', 'test')).resolves.toBeUndefined();
    });
  });

  describe('createGameAPI', () => {
    it('should create safe game API', () => {
      const api = llmService.createGameAPI();

      expect(api.createEntity).toBeInstanceOf(Function);
      expect(api.getEntity).toBeInstanceOf(Function);
      expect(api.destroyEntity).toBeInstanceOf(Function);
      expect(api.console).toBeDefined();
      expect(api.Math).toBe(Math);
    });

    it('should validate entity ID in createEntity', () => {
      const api = llmService.createGameAPI();
      
      expect(() => api.createEntity(123)).toThrow('must be a string');
      expect(() => api.createEntity('valid-id')).not.toThrow();
      expect(() => api.createEntity()).not.toThrow();
    });

    it('should validate entity ID in getEntity', () => {
      const api = llmService.createGameAPI();
      
      expect(() => api.getEntity(123)).toThrow('must be a string');
      expect(() => api.getEntity('valid-id')).not.toThrow();
    });

    it('should validate component types in getEntitiesWithComponents', () => {
      const api = llmService.createGameAPI();
      
      expect(() => api.getEntitiesWithComponents('not-array')).toThrow('must be an array');
      expect(() => api.getEntitiesWithComponents(['TransformComponent'])).not.toThrow();
    });
  });

  describe('executeGeneratedCode', () => {
    it('should execute simple safe code', async () => {
      const code = 'const result = 1 + 1; result;';
      const context = {};
      
      const result = await llmService.executeGeneratedCode(code, context);
      
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle execution errors', async () => {
      const code = 'throw new Error("Test error");';
      const context = {};
      
      const result = await llmService.executeGeneratedCode(code, context);
      
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Test error');
    });

    it('should provide execution context', async () => {
      const code = 'console.log("test"); return "executed";';
      const context = {};
      
      const result = await llmService.executeGeneratedCode(code, context);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should categorize different error types', () => {
      const timeoutError = new Error('Request timeout after 5000ms');
      expect(llmService.categorizeError(timeoutError)).toBe('timeout');

      const safetyError = new Error('Safety violations detected');
      expect(llmService.categorizeError(safetyError)).toBe('safety');

      const syntaxError = new Error('Syntax error in code');
      expect(llmService.categorizeError(syntaxError)).toBe('syntax');

      const unknownError = new Error('Unknown error');
      expect(llmService.categorizeError(unknownError)).toBe('unknown');
    });

    it('should categorize execution errors', () => {
      const timeoutError = new Error('Execution timeout after 5000ms');
      expect(llmService.categorizeExecutionError(timeoutError)).toBe('execution_timeout');

      const memoryError = new Error('Memory limit exceeded');
      expect(llmService.categorizeExecutionError(memoryError)).toBe('memory_limit');

      const refError = new Error('variable is not defined');
      expect(llmService.categorizeExecutionError(refError)).toBe('undefined_reference');
    });
  });

  describe('Statistics and History', () => {
    it('should get service statistics', () => {
      llmService.stats.totalRequests = 10;
      llmService.stats.successfulExecutions = 8;
      llmService.stats.totalTokensUsed = 500;

      const stats = llmService.getStats();

      expect(stats.totalRequests).toBe(10);
      expect(stats.successfulExecutions).toBe(8);
      expect(stats.successRate).toBe(80);
      expect(stats.totalTokensUsed).toBe(500);
      expect(stats.geminiStats).toBeDefined();
    });

    it('should manage execution history', () => {
      const result1 = { id: 'req1', success: true };
      const result2 = { id: 'req2', success: false };

      llmService.addToHistory(result1);
      llmService.addToHistory(result2);

      expect(llmService.getHistory()).toHaveLength(2);
      expect(llmService.getHistory(1)).toHaveLength(1);
      expect(llmService.getHistory(1)[0]).toBe(result2); // Most recent
    });

    it('should limit history size', () => {
      // Add more than 50 entries
      for (let i = 0; i < 55; i++) {
        llmService.addToHistory({ id: `req${i}`, success: true });
      }

      expect(llmService.executionHistory.length).toBe(50);
    });

    it('should clear history', () => {
      llmService.addToHistory({ id: 'req1', success: true });
      expect(llmService.executionHistory).toHaveLength(1);

      llmService.clearHistory();
      expect(llmService.executionHistory).toHaveLength(0);
    });

    it('should reset statistics', () => {
      llmService.stats.totalRequests = 10;
      llmService.stats.successfulExecutions = 8;
      llmService.addToHistory({ id: 'req1', success: true });

      llmService.resetStats();

      expect(llmService.stats.totalRequests).toBe(0);
      expect(llmService.stats.successfulExecutions).toBe(0);
      expect(llmService.executionHistory).toHaveLength(0);
    });
  });

  describe('Request Management', () => {
    it('should track pending requests', () => {
      const requestId = 'test-request';
      const requestData = {
        userRequest: 'Create player',
        startTime: Date.now(),
        status: 'processing'
      };

      llmService.pendingRequests.set(requestId, requestData);

      const pending = llmService.getPendingRequests();
      expect(pending).toHaveLength(1);
      expect(pending[0].userRequest).toBe('Create player');
    });

    it('should cancel pending requests', () => {
      const requestId = 'test-request';
      llmService.pendingRequests.set(requestId, { status: 'processing' });

      const cancelled = llmService.cancelRequest(requestId);
      expect(cancelled).toBe(true);
      expect(llmService.pendingRequests.has(requestId)).toBe(false);

      const notCancelled = llmService.cancelRequest('non-existent');
      expect(notCancelled).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should generate unique request IDs', () => {
      const id1 = llmService.generateRequestId();
      const id2 = llmService.generateRequestId();

      expect(id1).toMatch(/^llm_req_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^llm_req_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should sanitize game context', () => {
      const fullContext = {
        gameInfo: { entityCount: 5, systemCount: 3 },
        entities: [{ id: 'test', sensitive: 'data' }],
        userRequest: { text: 'test request' },
        sensitiveData: 'should be removed'
      };

      const sanitized = llmService.sanitizeGameContext(fullContext);

      expect(sanitized.entityCount).toBe(5);
      expect(sanitized.systemCount).toBe(3);
      expect(sanitized.userRequest).toBeDefined();
      expect(sanitized.sensitiveData).toBeUndefined();
      expect(sanitized.entities).toBeUndefined();
    });

    it('should estimate memory usage', () => {
      const memoryUsage = llmService.estimateMemoryUsage();
      expect(typeof memoryUsage).toBe('number');
      expect(memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Event Callbacks', () => {
    it('should invoke callback on modification start', async () => {
      const onStart = jest.fn();
      llmService.onModificationStart = onStart;

      await llmService.processModificationRequest('Create player');

      expect(onStart).toHaveBeenCalledWith(
        expect.stringMatching(/^llm_req_/),
        'Create player'
      );
    });

    it('should invoke callback on modification complete', async () => {
      const onComplete = jest.fn();
      llmService.onModificationComplete = onComplete;

      const result = await llmService.processModificationRequest('Create player');

      expect(onComplete).toHaveBeenCalledWith(
        expect.stringMatching(/^llm_req_/),
        expect.objectContaining({ success: true })
      );
    });

    it('should invoke callback on modification error', async () => {
      const onError = jest.fn();
      llmService.onModificationError = onError;

      mockGeminiClient.generateGameCode.mockRejectedValue(new Error('Test error'));

      try {
        await llmService.processModificationRequest('Create player');
      } catch (error) {
        // Expected to throw
      }

      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/^llm_req_/),
        expect.objectContaining({ success: false })
      );
    });
  });
}); 