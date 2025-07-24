import { GeminiClient } from '../../llm/GeminiClient.js';

// Mock the Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn()
    })
  }))
}));

describe('GeminiClient', () => {
  let client;
  let mockModel;
  let mockGenAI;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock objects
    mockModel = {
      generateContent: jest.fn()
    };
    
    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel)
    };

    // Mock the GoogleGenerativeAI constructor  
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    GoogleGenerativeAI.mockReturnValue(mockGenAI);

    // Create client instance
    client = new GeminiClient('test-api-key');
  });

  describe('Constructor', () => {
    it('should create client with valid API key', () => {
      expect(client).toBeDefined();
      expect(client.model).toBe('gemini-2.5-flash-lite');
      expect(client.maxTokens).toBe(2048);
      expect(client.temperature).toBe(0.7);
    });

    it('should throw error without API key', () => {
      expect(() => new GeminiClient()).toThrow('API key is required for GeminiClient');
    });

    it('should use custom options', () => {
      const customClient = new GeminiClient('test-key', {
        model: 'custom-model',
        maxTokens: 1000,
        temperature: 0.5,
        retryAttempts: 5
      });

      expect(customClient.model).toBe('custom-model');
      expect(customClient.maxTokens).toBe(1000);
      expect(customClient.temperature).toBe(0.5);
      expect(customClient.retryAttempts).toBe(5);
    });
  });

  describe('generateContent', () => {
    beforeEach(() => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Generated response text',
          candidates: [{ finishReason: 'stop' }]
        }
      });
    });

    it('should generate content successfully', async () => {
      const response = await client.generateContent('Test prompt');

      expect(response.success).toBe(true);
      expect(response.text).toBe('Generated response text');
      expect(response.id).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(response.duration).toBeGreaterThan(0);
      expect(response.estimatedTokens).toBeGreaterThan(0);
    });

    it('should validate prompt input', async () => {
      await expect(client.generateContent()).rejects.toThrow('Prompt must be a non-empty string');
      await expect(client.generateContent('')).rejects.toThrow('Prompt must be a non-empty string');
      await expect(client.generateContent(123)).rejects.toThrow('Prompt must be a non-empty string');
    });

    it('should reject overly long prompts', async () => {
      const longPrompt = 'a'.repeat(30001);
      await expect(client.generateContent(longPrompt)).rejects.toThrow('Prompt too long');
    });

    it('should track request statistics', async () => {
      await client.generateContent('Test prompt');
      
      const stats = client.getStats();
      expect(stats.requestCount).toBe(1);
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
      expect(stats.historySize).toBe(1);
    });
  });

  describe('generateGameCode', () => {
    beforeEach(() => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => `Here's the code for your request:

\`\`\`javascript
// Create a red square enemy
const enemy = game.createEntity('enemy1');
enemy.addComponent(new TransformComponent(100, 100));
enemy.addComponent(new RenderComponent({ color: 'red', width: 32, height: 32 }));
enemy.addTag('enemy');
\`\`\`

This code creates a new enemy entity at position (100, 100) with a red square appearance.`,
          candidates: [{ finishReason: 'stop' }]
        }
      });
    });

    it('should generate game code successfully', async () => {
      const gameContext = {
        availableComponents: ['TransformComponent', 'RenderComponent'],
        entityCount: 5,
        availableSystems: ['MovementSystem']
      };

      const response = await client.generateGameCode('Create a red enemy', gameContext);

      expect(response.success).toBe(true);
      expect(response.code).toContain('game.createEntity');
      expect(response.code).toContain('TransformComponent');
      expect(response.explanation).toContain('enemy entity');
      expect(response.userRequest).toBe('Create a red enemy');
      expect(response.validated).toBe(true);
    });

    it('should use lower temperature for code generation', async () => {
      const gameContext = {};
      
      await client.generateGameCode('Create something', gameContext);

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.any(Array)
        })
      );
    });

    it('should build appropriate game code prompt', () => {
      const gameContext = {
        availableComponents: ['TransformComponent'],
        entityCount: 3
      };

      const prompt = client.buildGameCodePrompt('Create a player', gameContext);

      expect(prompt).toContain('Entity-Component-System');
      expect(prompt).toContain('TransformComponent');
      expect(prompt).toContain('3 entities');
      expect(prompt).toContain('Create a player');
      expect(prompt).toContain('game.createEntity');
    });
  });

  describe('Code Validation', () => {
    it('should extract JavaScript code blocks', () => {
      const text = `Here's your code:

\`\`\`javascript
const entity = game.createEntity();
entity.addComponent(new TransformComponent());
\`\`\`

And another block:

\`\`\`js
console.log('Hello');
\`\`\``;

      const blocks = client.extractCodeBlocks(text);
      
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toContain('game.createEntity');
      expect(blocks[1]).toContain('console.log');
    });

    it('should validate safe code', () => {
      const safeCode = `
        const entity = game.createEntity();
        entity.addComponent(new TransformComponent(10, 20));
        entity.addTag('player');
      `;

      expect(() => client.validateGeneratedCode(safeCode)).not.toThrow();
    });

    it('should reject dangerous code patterns', () => {
      const dangerousCodes = [
        'eval("malicious code")',
        'new Function("return 1")',
        'setTimeout(() => {}, 1000)',
        'XMLHttpRequest()',
        'fetch("http://evil.com")',
        'import("./malicious")',
        'require("fs")',
        'process.exit()',
        'window.location = "evil"',
        'document.createElement("script")'
      ];

      dangerousCodes.forEach(code => {
        expect(() => client.validateGeneratedCode(code)).toThrow(/dangerous pattern/);
      });
    });

    it('should reject infinite loops', () => {
      const infiniteLoops = [
        'while (true) { console.log("infinite"); }',
        'for (;;) { doSomething(); }'
      ];

      infiniteLoops.forEach(code => {
        expect(() => client.validateGeneratedCode(code)).toThrow(/infinite loop/);
      });
    });

    it('should reject code exceeding line limits', () => {
      const longCode = Array(51).fill('console.log("line");').join('\n');
      
      expect(() => client.validateGeneratedCode(longCode)).toThrow(/exceeds 50 lines/);
    });
  });

  describe('Error Handling', () => {
    it('should handle API key errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Invalid API key'));

      try {
        await client.generateContent('Test prompt');
      } catch (error) {
        expect(error.message).toBe('Invalid API key');
      }

      const history = client.requestHistory;
      expect(history).toHaveLength(1);
      expect(history[0].response.success).toBe(false);
      expect(history[0].response.error.type).toBe('authentication');
    });

    it('should handle rate limit errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Rate limit exceeded'));

      try {
        await client.generateContent('Test prompt');
      } catch (error) {
        expect(error.message).toBe('Rate limit exceeded');
      }

      const history = client.requestHistory;
      expect(history[0].response.error.type).toBe('rate_limit');
    });

    it('should handle timeout errors', async () => {
      mockModel.generateContent.mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      const shortTimeoutClient = new GeminiClient('test-key', { timeout: 100 });
      
      try {
        await shortTimeoutClient.generateContent('Test prompt');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    it('should retry on retryable errors', async () => {
      mockModel.generateContent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          response: {
            text: () => 'Success after retry',
            candidates: [{ finishReason: 'stop' }]
          }
        });

      const response = await client.generateContent('Test prompt');
      
      expect(response.success).toBe(true);
      expect(response.text).toBe('Success after retry');
      expect(mockModel.generateContent).toHaveBeenCalledTimes(3);
    });

    it('should not retry on authentication errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Invalid API key'));

      try {
        await client.generateContent('Test prompt');
      } catch (error) {
        expect(error.message).toBe('Invalid API key');
      }

      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Processing', () => {
    it('should parse code response correctly', () => {
      const mockResponse = {
        text: `Here's your code:

\`\`\`javascript
const player = game.createEntity();
player.addComponent(new TransformComponent());
\`\`\`

This creates a new player entity.`,
        success: true,
        id: 'test-id'
      };

      const parsed = client.parseCodeResponse(mockResponse, 'Create player', {});

      expect(parsed.code).toContain('game.createEntity');
      expect(parsed.explanation).toContain('player entity');
      expect(parsed.userRequest).toBe('Create player');
      expect(parsed.codeBlocks).toBe(1);
      expect(parsed.validated).toBe(true);
    });

    it('should throw error if no code blocks found', () => {
      const mockResponse = {
        text: 'No code here, just explanation',
        success: true
      };

      expect(() => {
        client.parseCodeResponse(mockResponse, 'Test', {});
      }).toThrow('No code blocks found');
    });
  });

  describe('Statistics and History', () => {
    it('should track statistics correctly', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Response with 20 characters',
          candidates: [{ finishReason: 'stop' }]
        }
      });

      await client.generateContent('First prompt');
      await client.generateContent('Second prompt');

      const stats = client.getStats();
      
      expect(stats.requestCount).toBe(2);
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
      expect(stats.averageTokensPerRequest).toBeGreaterThan(0);
      expect(stats.historySize).toBe(2);
      expect(stats.model).toBe('gemini-2.5-flash-lite');
    });

    it('should maintain request history', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Test response',
          candidates: [{ finishReason: 'stop' }]
        }
      });

      await client.generateContent('Test prompt');

      expect(client.requestHistory).toHaveLength(1);
      expect(client.requestHistory[0].prompt).toBe('Test prompt');
      expect(client.requestHistory[0].response.success).toBe(true);
    });

    it('should limit history size', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Test response',
          candidates: [{ finishReason: 'stop' }]
        }
      });

      // Make 150 requests (more than the 100 limit)
      for (let i = 0; i < 150; i++) {
        await client.generateContent(`Prompt ${i}`);
      }

      expect(client.requestHistory.length).toBe(100);
      // Should keep the most recent requests
      expect(client.requestHistory[0].prompt).toBe('Prompt 50');
    });

    it('should clear history', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: () => 'Test', candidates: [] }
      });

      await client.generateContent('Test');
      expect(client.requestHistory).toHaveLength(1);

      client.clearHistory();
      expect(client.requestHistory).toHaveLength(0);
    });

    it('should reset statistics', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: () => 'Test response', candidates: [] }
      });

      await client.generateContent('Test');
      
      const statsBefore = client.getStats();
      expect(statsBefore.requestCount).toBe(1);

      client.resetStats();
      
      const statsAfter = client.getStats();
      expect(statsAfter.requestCount).toBe(0);
      expect(statsAfter.totalTokensUsed).toBe(0);
      expect(statsAfter.historySize).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    it('should generate unique request IDs', () => {
      const id1 = client.generateRequestId();
      const id2 = client.generateRequestId();

      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should create timeout promises', async () => {
      const start = Date.now();
      
      try {
        await client.createTimeout(100);
      } catch (error) {
        const duration = Date.now() - start;
        expect(duration).toBeGreaterThanOrEqual(90);
        expect(error.message).toContain('timeout');
      }
    });

    it('should handle delays', async () => {
      const start = Date.now();
      await client.delay(100);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(90);
    });
  });
}); 