import { Entity } from '../../engine/Entity.js';
import { Component } from '../../engine/Component.js';

// Mock component for testing
class MockComponent extends Component {
  constructor(name = 'MockComponent') {
    super();
    this.name = name;
    this.onAttachCalled = false;
    this.onDetachCalled = false;
  }

  onAttach(entity) {
    this.onAttachCalled = true;
  }

  onDetach(entity) {
    this.onDetachCalled = true;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      data: { name: this.name }
    };
  }
}

describe('Entity', () => {
  let entity;

  beforeEach(() => {
    entity = new Entity();
  });

  describe('Creation', () => {
    it('should create entity with unique ID', () => {
      const entity1 = new Entity();
      const entity2 = new Entity();
      
      expect(entity1.id).toBeDefined();
      expect(entity2.id).toBeDefined();
      expect(entity1.id).not.toBe(entity2.id);
    });

    it('should create entity with custom ID', () => {
      const customId = 'custom_entity_id';
      const entity = new Entity(customId);
      
      expect(entity.id).toBe(customId);
    });

    it('should initialize with default properties', () => {
      expect(entity.active).toBe(true);
      expect(entity.components).toBeInstanceOf(Map);
      expect(entity.tags).toBeInstanceOf(Set);
      expect(entity.components.size).toBe(0);
      expect(entity.tags.size).toBe(0);
    });
  });

  describe('Component Management', () => {
    let mockComponent;

    beforeEach(() => {
      mockComponent = new MockComponent();
    });

    it('should add component successfully', () => {
      const result = entity.addComponent(mockComponent);
      
      expect(result).toBe(entity); // Should return entity for chaining
      expect(entity.hasComponent('MockComponent')).toBe(true);
      expect(entity.getComponent('MockComponent')).toBe(mockComponent);
      expect(mockComponent.entity).toBe(entity);
      expect(mockComponent.onAttachCalled).toBe(true);
    });

    it('should throw error when adding invalid component', () => {
      expect(() => {
        entity.addComponent(null);
      }).toThrow('Invalid component: must have a constructor name');

      expect(() => {
        entity.addComponent({});
      }).toThrow('Invalid component: must have a constructor name');
    });

    it('should remove component successfully', () => {
      entity.addComponent(mockComponent);
      
      const result = entity.removeComponent('MockComponent');
      
      expect(result).toBe(true);
      expect(entity.hasComponent('MockComponent')).toBe(false);
      expect(entity.getComponent('MockComponent')).toBeNull();
      expect(mockComponent.entity).toBeNull();
      expect(mockComponent.onDetachCalled).toBe(true);
    });

    it('should return false when removing non-existent component', () => {
      const result = entity.removeComponent('NonExistentComponent');
      
      expect(result).toBe(false);
    });

    it('should check if entity has component', () => {
      expect(entity.hasComponent('MockComponent')).toBe(false);
      
      entity.addComponent(mockComponent);
      expect(entity.hasComponent('MockComponent')).toBe(true);
    });

    it('should check if entity has multiple components', () => {
      const component1 = new MockComponent('Component1');
      const component2 = new MockComponent('Component2');
      
      entity.addComponent(component1);
      entity.addComponent(component2);
      
      expect(entity.hasComponents(['MockComponent'])).toBe(true);
      expect(entity.hasComponents(['NonExistent'])).toBe(false);
    });

    it('should get all components', () => {
      const component1 = new MockComponent('Component1');
      
      // Create a different component type to avoid collision
      class AnotherMockComponent extends Component {
        constructor(name = 'AnotherMockComponent') {
          super();
          this.name = name;
        }
      }
      const component2 = new AnotherMockComponent('Component2');
      
      entity.addComponent(component1);
      entity.addComponent(component2);
      
      const allComponents = entity.getAllComponents();
      expect(allComponents).toHaveLength(2);
      expect(allComponents).toContain(component1);
      expect(allComponents).toContain(component2);
    });
  });

  describe('Tag Management', () => {
    it('should add tags successfully', () => {
      const result = entity.addTag('player');
      
      expect(result).toBe(entity); // Should return entity for chaining
      expect(entity.hasTag('player')).toBe(true);
    });

    it('should remove tags successfully', () => {
      entity.addTag('player');
      
      const result = entity.removeTag('player');
      
      expect(result).toBe(true);
      expect(entity.hasTag('player')).toBe(false);
    });

    it('should return false when removing non-existent tag', () => {
      const result = entity.removeTag('nonExistent');
      
      expect(result).toBe(false);
    });

    it('should handle multiple tags', () => {
      entity.addTag('player');
      entity.addTag('enemy');
      entity.addTag('movable');
      
      expect(entity.hasTag('player')).toBe(true);
      expect(entity.hasTag('enemy')).toBe(true);
      expect(entity.hasTag('movable')).toBe(true);
      expect(entity.hasTag('nonExistent')).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should activate and deactivate entity', () => {
      expect(entity.isActive()).toBe(true);
      
      entity.deactivate();
      expect(entity.isActive()).toBe(false);
      
      entity.activate();
      expect(entity.isActive()).toBe(true);
    });
  });

  describe('Destruction', () => {
    it('should destroy entity and clean up components', () => {
      const component1 = new MockComponent('Component1');
      const component2 = new MockComponent('Component2');
      
      entity.addComponent(component1);
      entity.addComponent(component2);
      entity.addTag('player');
      
      entity.destroy();
      
      expect(entity.isActive()).toBe(false);
      expect(entity.components.size).toBe(0);
      expect(entity.tags.size).toBe(0);
      expect(component1.entity).toBeNull();
      expect(component2.entity).toBeNull();
      expect(component1.onDetachCalled).toBe(true);
      expect(component2.onDetachCalled).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const component = new MockComponent('TestComponent');
      entity.addComponent(component);
      entity.addTag('player');
      entity.addTag('movable');
      
      const json = entity.toJSON();
      
      expect(json.id).toBe(entity.id);
      expect(json.active).toBe(true);
      expect(json.tags).toEqual(['player', 'movable']);
      expect(json.components.MockComponent).toBeDefined();
      expect(json.components.MockComponent.data.name).toBe('TestComponent');
    });

    it('should handle empty entity serialization', () => {
      const json = entity.toJSON();
      
      expect(json.id).toBe(entity.id);
      expect(json.active).toBe(true);
      expect(json.tags).toEqual([]);
      expect(json.components).toEqual({});
    });
  });

  describe('Method Chaining', () => {
    it('should support method chaining for fluent API', () => {
      const component = new MockComponent();
      
      const result = entity
        .addComponent(component)
        .addTag('player')
        .addTag('movable');
      
      expect(result).toBe(entity);
      expect(entity.hasComponent('MockComponent')).toBe(true);
      expect(entity.hasTag('player')).toBe(true);
      expect(entity.hasTag('movable')).toBe(true);
    });
  });

  describe('Static Methods', () => {
    it('should generate unique IDs', () => {
      const id1 = Entity.generateId();
      const id2 = Entity.generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^entity_\d+_[a-z0-9]+$/);
    });
  });
}); 