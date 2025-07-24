import { Component } from '../../engine/Component.js';
import { Entity } from '../../engine/Entity.js';

// Test component that extends Component
class TestComponent extends Component {
  constructor(value = 'test') {
    super();
    this.value = value;
    this.updateCallCount = 0;
    this.attachCallCount = 0;
    this.detachCallCount = 0;
  }

  onAttach(entity) {
    this.attachCallCount++;
  }

  onDetach(entity) {
    this.detachCallCount++;
  }

  update(deltaTime) {
    this.updateCallCount++;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      data: {
        value: this.value,
        updateCallCount: this.updateCallCount
      }
    };
  }
}

// Another test component for sibling testing
class SiblingComponent extends Component {
  constructor() {
    super();
    this.name = 'SiblingComponent';
  }
}

describe('Component', () => {
  let component;
  let entity;

  beforeEach(() => {
    component = new TestComponent();
    entity = new Entity();
  });

  describe('Creation', () => {
    it('should create component with default properties', () => {
      expect(component.entity).toBeNull();
      expect(component.enabled).toBe(true);
    });

    it('should create component with custom properties', () => {
      const customComponent = new TestComponent('custom');
      expect(customComponent.value).toBe('custom');
    });
  });

  describe('Entity Reference', () => {
    it('should have no entity reference initially', () => {
      expect(component.getEntity()).toBeNull();
    });

    it('should get entity reference when attached', () => {
      entity.addComponent(component);
      expect(component.getEntity()).toBe(entity);
    });

    it('should lose entity reference when detached', () => {
      entity.addComponent(component);
      entity.removeComponent('TestComponent');
      expect(component.getEntity()).toBeNull();
    });
  });

  describe('Enable/Disable', () => {
    it('should be enabled by default', () => {
      expect(component.isEnabled()).toBe(true);
    });

    it('should disable component', () => {
      component.disable();
      expect(component.isEnabled()).toBe(false);
    });

    it('should enable component', () => {
      component.disable();
      component.enable();
      expect(component.isEnabled()).toBe(true);
    });
  });

  describe('Lifecycle Methods', () => {
    it('should call onAttach when attached to entity', () => {
      entity.addComponent(component);
      expect(component.attachCallCount).toBe(1);
    });

    it('should call onDetach when detached from entity', () => {
      entity.addComponent(component);
      entity.removeComponent('TestComponent');
      expect(component.detachCallCount).toBe(1);
    });

    it('should call update method', () => {
      component.update(16.67);
      expect(component.updateCallCount).toBe(1);
    });
  });

  describe('Sibling Component Access', () => {
    let siblingComponent;

    beforeEach(() => {
      siblingComponent = new SiblingComponent();
      entity.addComponent(component);
      entity.addComponent(siblingComponent);
    });

    it('should get sibling component', () => {
      const sibling = component.getSiblingComponent('SiblingComponent');
      expect(sibling).toBe(siblingComponent);
    });

    it('should return null for non-existent sibling', () => {
      const sibling = component.getSiblingComponent('NonExistentComponent');
      expect(sibling).toBeNull();
    });

    it('should check if sibling component exists', () => {
      expect(component.hasSiblingComponent('SiblingComponent')).toBe(true);
      expect(component.hasSiblingComponent('NonExistentComponent')).toBe(false);
    });

    it('should return null for sibling when not attached to entity', () => {
      const standaloneComponent = new TestComponent();
      const sibling = standaloneComponent.getSiblingComponent('SiblingComponent');
      expect(sibling).toBeNull();
    });
  });

  describe('Cloning', () => {
    it('should clone component with same properties', () => {
      component.value = 'original';
      component.enabled = false;
      
      const clone = component.clone();
      
      expect(clone).not.toBe(component);
      expect(clone.value).toBe('original');
      expect(clone.enabled).toBe(false);
      expect(clone.entity).toBeNull(); // Entity reference should not be copied
    });

    it('should deep clone object properties', () => {
      component.complexProperty = { nested: { value: 42 } };
      
      const clone = component.clone();
      
      expect(clone.complexProperty).toEqual(component.complexProperty);
      expect(clone.complexProperty).not.toBe(component.complexProperty);
      expect(clone.complexProperty.nested).not.toBe(component.complexProperty.nested);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      component.value = 'serialize_test';
      component.enabled = false;
      
      const json = component.toJSON();
      
      expect(json.type).toBe('TestComponent');
      expect(json.enabled).toBe(false);
      expect(json.data.value).toBe('serialize_test');
    });

    it('should restore from JSON correctly', () => {
      const jsonData = {
        enabled: false,
        data: {
          value: 'restored',
          customProperty: 'custom'
        }
      };
      
      component.fromJSON(jsonData);
      
      expect(component.enabled).toBe(false);
      expect(component.value).toBe('restored');
      expect(component.customProperty).toBe('custom');
    });

    it('should handle partial JSON data', () => {
      component.enabled = true;
      component.value = 'original';
      
      const partialData = {
        enabled: false
      };
      
      component.fromJSON(partialData);
      
      expect(component.enabled).toBe(false);
      expect(component.value).toBe('original'); // Should remain unchanged
    });
  });

  describe('Base Class Behavior', () => {
    it('should handle base methods gracefully', () => {
      const baseComponent = new Component();
      
      // These should not throw errors
      expect(() => {
        baseComponent.onAttach(entity);
        baseComponent.onDetach(entity);
        baseComponent.update(16.67);
      }).not.toThrow();
    });

    it('should have proper inheritance', () => {
      expect(component).toBeInstanceOf(Component);
      expect(component.constructor.name).toBe('TestComponent');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing entity gracefully in sibling methods', () => {
      const standaloneComponent = new TestComponent();
      
      expect(standaloneComponent.getSiblingComponent('AnyComponent')).toBeNull();
      expect(standaloneComponent.hasSiblingComponent('AnyComponent')).toBe(false);
    });

    it('should handle clone of components with circular references', () => {
      // This tests the JSON parse/stringify approach to cloning
      component.circularRef = component; // Create circular reference
      
      expect(() => {
        component.clone();
      }).toThrow(); // Should throw due to circular reference in JSON.stringify
    });
  });
}); 