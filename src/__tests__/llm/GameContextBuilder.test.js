import { GameContextBuilder } from '../../llm/context/GameContextBuilder.js';
import { GameEngine } from '../../engine/GameEngine.js';
import { Entity } from '../../engine/Entity.js';
import { TransformComponent } from '../../engine/components/TransformComponent.js';
import { RenderComponent } from '../../engine/components/RenderComponent.js';
import { MovementComponent } from '../../engine/components/MovementComponent.js';

describe('GameContextBuilder', () => {
  let gameEngine;
  let contextBuilder;
  let mockEntity;

  beforeEach(() => {
    // Create mock game engine
    gameEngine = new GameEngine();
    
    // Create mock entity with components
    mockEntity = new Entity('test-entity');
    mockEntity.addComponent(new TransformComponent(100, 200, 0, 1, 1));
    mockEntity.addComponent(new RenderComponent({ 
      color: 'red', 
      width: 32, 
      height: 32, 
      shape: 'rectangle' 
    }));
    mockEntity.addTag('player');

    // Add entity to engine
    gameEngine.entityManager.addEntity(mockEntity);

    // Create context builder
    contextBuilder = new GameContextBuilder(gameEngine);
  });

  describe('Constructor', () => {
    it('should create GameContextBuilder with default limits', () => {
      expect(contextBuilder.gameEngine).toBe(gameEngine);
      expect(contextBuilder.maxEntitiesInContext).toBe(20);
      expect(contextBuilder.maxContextLength).toBe(8000);
    });

    it('should allow setting custom limits', () => {
      contextBuilder.setLimits(5000, 10);
      
      expect(contextBuilder.maxContextLength).toBe(5000);
      expect(contextBuilder.maxEntitiesInContext).toBe(10);
    });
  });

  describe('buildContext', () => {
    it('should build comprehensive context', () => {
      const context = contextBuilder.buildContext('Create a blue enemy');

      expect(context).toHaveProperty('gameInfo');
      expect(context).toHaveProperty('entities');
      expect(context).toHaveProperty('components');
      expect(context).toHaveProperty('systems');
      expect(context).toHaveProperty('userRequest');
      expect(context).toHaveProperty('api');
      expect(context).toHaveProperty('constraints');
      expect(context).toHaveProperty('examples');
      expect(context).toHaveProperty('timestamp');
      expect(context.contextVersion).toBe('1.0');
    });

    it('should analyze user request', () => {
      const context = contextBuilder.buildContext('Create a red player with physics');

      expect(context.userRequest.text).toBe('Create a red player with physics');
      expect(context.userRequest.intent.primary).toBe('create');
      expect(context.userRequest.intent.all).toContain('create');
      expect(context.userRequest.entities).toContain('player');
      expect(context.userRequest.components).toContain('PhysicsComponent');
      expect(context.userRequest.keywords).toContain('red');
    });
  });

  describe('getGameInfo', () => {
    it('should return basic game information', () => {
      gameEngine.frameCount = 100;
      gameEngine.totalTime = 5000;

      const gameInfo = contextBuilder.getGameInfo();

      expect(gameInfo.version).toBeDefined();
      expect(gameInfo.running).toBe(false); // Engine not started
      expect(gameInfo.frameCount).toBe(100);
      expect(gameInfo.totalTime).toBe(5000);
      expect(gameInfo.entityCount).toBe(1); // Our test entity
    });
  });

  describe('getEntityContext', () => {
    it('should return entity information', () => {
      const entities = contextBuilder.getEntityContext();

      expect(entities).toHaveLength(1);
      expect(entities[0].id).toBe('test-entity');
      expect(entities[0].active).toBe(true);
      expect(entities[0].tags).toContain('player');
      expect(entities[0].components).toHaveProperty('TransformComponent');
      expect(entities[0].components).toHaveProperty('RenderComponent');
    });

    it('should include entity position and bounds', () => {
      const entities = contextBuilder.getEntityContext();
      const entity = entities[0];

      expect(entity.position).toEqual({ x: 100, y: 200 });
      expect(entity.bounds).toHaveProperty('x');
      expect(entity.bounds).toHaveProperty('y');
      expect(entity.bounds).toHaveProperty('width');
      expect(entity.bounds).toHaveProperty('height');
    });

    it('should limit entities when too many', () => {
      // Add more entities
      for (let i = 0; i < 25; i++) {
        const entity = new Entity(`entity-${i}`);
        entity.addComponent(new TransformComponent(i * 10, i * 10));
        gameEngine.entityManager.addEntity(entity);
      }

      const entities = contextBuilder.getEntityContext();
      expect(entities.length).toBeLessThanOrEqual(20);
    });

    it('should include all entities when requested', () => {
      // Add more entities
      for (let i = 0; i < 25; i++) {
        const entity = new Entity(`entity-${i}`);
        entity.addComponent(new TransformComponent(i * 10, i * 10));
        gameEngine.entityManager.addEntity(entity);
      }

      const entities = contextBuilder.getEntityContext(true);
      expect(entities.length).toBe(26); // 25 + 1 original
    });
  });

  describe('extractComponentData', () => {
    it('should extract TransformComponent data', () => {
      const transform = new TransformComponent(10, 20, Math.PI / 4, 2, 2);
      const data = contextBuilder.extractComponentData(transform, 'TransformComponent');

      expect(data.position).toEqual({ x: 10, y: 20 });
      expect(data.rotation).toBeCloseTo(Math.PI / 4);
      expect(data.scale).toEqual({ x: 2, y: 2 });
    });

    it('should extract RenderComponent data', () => {
      const render = new RenderComponent({ 
        color: 'blue', 
        width: 64, 
        height: 32, 
        opacity: 0.8 
      });
      const data = contextBuilder.extractComponentData(render, 'RenderComponent');

      expect(data.color).toBe('blue');
      expect(data.width).toBe(64);
      expect(data.height).toBe(32);
      expect(data.opacity).toBe(0.8);
    });

    it('should extract MovementComponent data', () => {
      const movement = new MovementComponent({ 
        maxSpeed: 200, 
        speed: 100 
      });
      movement.velocity = { x: 50, y: -30 };
      movement.isGrounded = true;

      const data = contextBuilder.extractComponentData(movement, 'MovementComponent');

      expect(data.velocity).toEqual({ x: 50, y: -30 });
      expect(data.maxSpeed).toBe(200);
      expect(data.canMove).toBe(true);
      expect(data.isGrounded).toBe(true);
    });

    it('should handle unknown component types', () => {
      const customComponent = {
        enabled: true,
        customProperty: 'value',
        entity: mockEntity, // Should be excluded
        someMethod: () => {} // Should be excluded
      };

      const data = contextBuilder.extractComponentData(customComponent, 'CustomComponent');

      expect(data.customProperty).toBe('value');
      expect(data.entity).toBeUndefined();
      expect(data.someMethod).toBeUndefined();
    });
  });

  describe('getComponentTypes', () => {
    it('should return component type information', () => {
      const componentTypes = contextBuilder.getComponentTypes();

      expect(componentTypes).toHaveLength(5);
      
      const transformType = componentTypes.find(c => c.name === 'TransformComponent');
      expect(transformType).toBeDefined();
      expect(transformType.description).toContain('position');
      expect(transformType.properties).toContain('position');
      expect(transformType.methods).toContain('setPosition');
    });
  });

  describe('analyzeUserIntent', () => {
    it('should detect create intent', () => {
      const intent = contextBuilder.analyzeUserIntent('Create a new enemy');
      
      expect(intent.primary).toBe('create');
      expect(intent.all).toContain('create');
      expect(intent.confidence).toBe(0.8);
    });

    it('should detect modify intent', () => {
      const intent = contextBuilder.analyzeUserIntent('Change the player color to red');
      
      expect(intent.primary).toBe('modify');
      expect(intent.all).toContain('modify');
    });

    it('should detect multiple intents', () => {
      const intent = contextBuilder.analyzeUserIntent('Create and move the player');
      
      expect(intent.all).toContain('create');
      expect(intent.all).toContain('move');
    });

    it('should handle unknown intent', () => {
      const intent = contextBuilder.analyzeUserIntent('This is confusing text');
      
      expect(intent.primary).toBe('unknown');
      expect(intent.confidence).toBe(0.2);
    });
  });

  describe('extractEntityReferences', () => {
    it('should extract entity references', () => {
      const entities = contextBuilder.extractEntityReferences('Create a player and three enemies');
      
      expect(entities).toContain('player');
      expect(entities).toContain('enemies');
    });

    it('should handle no entity references', () => {
      const entities = contextBuilder.extractEntityReferences('Change the color to blue');
      
      expect(entities).toHaveLength(0);
    });
  });

  describe('extractComponentReferences', () => {
    it('should extract component references', () => {
      const components = contextBuilder.extractComponentReferences('Change position and add physics');
      
      expect(components).toContain('TransformComponent');
      expect(components).toContain('PhysicsComponent');
    });

    it('should detect visual references', () => {
      const components = contextBuilder.extractComponentReferences('Change the color and size');
      
      expect(components).toContain('RenderComponent');
    });
  });

  describe('extractKeywords', () => {
    it('should extract meaningful keywords', () => {
      const keywords = contextBuilder.extractKeywords('Create a fast red player character');
      
      expect(keywords).toContain('create');
      expect(keywords).toContain('fast');
      expect(keywords).toContain('red');
      expect(keywords).toContain('player');
      expect(keywords).toContain('character');
    });

    it('should filter out stop words', () => {
      const keywords = contextBuilder.extractKeywords('The red and blue objects that can move');
      
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('and');
      expect(keywords).not.toContain('that');
      expect(keywords).not.toContain('can');
      expect(keywords).toContain('red');
      expect(keywords).toContain('blue');
      expect(keywords).toContain('objects');
      expect(keywords).toContain('move');
    });

    it('should filter out short words', () => {
      const keywords = contextBuilder.extractKeywords('A big red box is on the ground');
      
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('on');
      expect(keywords).toContain('big');
      expect(keywords).toContain('red');
      expect(keywords).toContain('box');
      expect(keywords).toContain('ground');
    });
  });

  describe('getAvailableAPI', () => {
    it('should return API documentation', () => {
      const api = contextBuilder.getAvailableAPI();

      expect(api).toHaveProperty('game');
      expect(api).toHaveProperty('entity');
      expect(api).toHaveProperty('components');
      
      expect(api.game.createEntity).toBeDefined();
      expect(api.entity.addComponent).toBeDefined();
      expect(api.components.TransformComponent).toBeDefined();
    });
  });

  describe('getRelevantExamples', () => {
    it('should return create examples for create requests', () => {
      const examples = contextBuilder.getRelevantExamples('Create a new player');
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0].title).toContain('Create');
      expect(examples[0].code).toContain('createEntity');
    });

    it('should return modify examples for modify requests', () => {
      const examples = contextBuilder.getRelevantExamples('Change the color');
      
      expect(examples.length).toBeGreaterThan(0);
      const modifyExample = examples.find(ex => ex.title.includes('Modify'));
      expect(modifyExample).toBeDefined();
      expect(modifyExample.code).toContain('getComponent');
    });

    it('should return physics examples for physics requests', () => {
      const examples = contextBuilder.getRelevantExamples('Add gravity and collision');
      
      expect(examples.length).toBeGreaterThan(0);
      const physicsExample = examples.find(ex => ex.title.includes('physics'));
      expect(physicsExample).toBeDefined();
      expect(physicsExample.code).toContain('PhysicsComponent');
    });
  });

  describe('optimizeContext', () => {
    it('should return context as-is if within limits', () => {
      const smallContext = {
        gameInfo: { version: '1.0' },
        entities: [{ id: 'test' }],
        examples: [{ title: 'Test', code: 'test()' }]
      };

      const optimized = contextBuilder.optimizeContext(smallContext, 'test');
      expect(optimized).toEqual(smallContext);
    });

    it('should reduce entities when context is too large', () => {
      // Create a large context
      const largeContext = {
        entities: Array(50).fill().map((_, i) => ({
          id: `entity-${i}`,
          components: {
            TransformComponent: { 
              enabled: true, 
              data: { position: { x: i, y: i }, rotation: 0, scale: { x: 1, y: 1 } }
            }
          }
        })),
        examples: Array(10).fill().map((_, i) => ({
          title: `Example ${i}`,
          code: `console.log('This is a very long example ${i} with lots of text to make it large');`
        })),
        gameInfo: { version: '1.0' },
        recentChanges: Array(20).fill().map((_, i) => ({ change: `Change ${i}` }))
      };

      const optimized = contextBuilder.optimizeContext(largeContext, 'test');
      
      expect(optimized.entities.length).toBeLessThanOrEqual(10);
      expect(optimized.examples.length).toBeLessThanOrEqual(2);
      expect(optimized.recentChanges.length).toBeLessThanOrEqual(5);
    });
  });

  describe('simplifyComponents', () => {
    it('should simplify TransformComponent data', () => {
      const components = {
        TransformComponent: {
          enabled: true,
          data: {
            position: { x: 10, y: 20 },
            rotation: Math.PI / 4,
            scale: { x: 2, y: 2 },
            previousPosition: { x: 5, y: 15 },
            previousRotation: 0
          }
        }
      };

      const simplified = contextBuilder.simplifyComponents(components);
      
      expect(simplified.TransformComponent.data.position).toBeDefined();
      expect(simplified.TransformComponent.data.rotation).toBeDefined();
      expect(simplified.TransformComponent.data.scale).toBeUndefined();
      expect(simplified.TransformComponent.data.previousPosition).toBeUndefined();
    });

    it('should simplify RenderComponent data', () => {
      const components = {
        RenderComponent: {
          enabled: true,
          data: {
            visible: true,
            color: 'red',
            shape: 'rectangle',
            width: 32,
            height: 32,
            opacity: 1.0,
            animations: [],
            effects: []
          }
        }
      };

      const simplified = contextBuilder.simplifyComponents(components);
      
      expect(simplified.RenderComponent.data.visible).toBeDefined();
      expect(simplified.RenderComponent.data.color).toBeDefined();
      expect(simplified.RenderComponent.data.shape).toBeDefined();
      expect(simplified.RenderComponent.data.width).toBeUndefined();
      expect(simplified.RenderComponent.data.animations).toBeUndefined();
    });

    it('should handle unknown components with minimal data', () => {
      const components = {
        CustomComponent: {
          enabled: true,
          data: {
            prop1: 'value1',
            prop2: 'value2',
            prop3: 'value3'
          }
        }
      };

      const simplified = contextBuilder.simplifyComponents(components);
      
      expect(simplified.CustomComponent.enabled).toBe(true);
      expect(simplified.CustomComponent.data).toEqual({});
    });
  });

  describe('getContextSize', () => {
    it('should return context size in characters', () => {
      const context = { test: 'value', number: 123 };
      const size = contextBuilder.getContextSize(context);
      
      expect(size).toBeGreaterThan(0);
      expect(size).toBe(JSON.stringify(context).length);
    });
  });
}); 