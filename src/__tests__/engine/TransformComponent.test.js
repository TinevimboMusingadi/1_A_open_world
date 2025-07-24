import { TransformComponent } from '../../engine/components/TransformComponent.js';

describe('TransformComponent', () => {
  let transform;

  beforeEach(() => {
    transform = new TransformComponent();
  });

  describe('Creation', () => {
    it('should create with default values', () => {
      expect(transform.position).toEqual({ x: 0, y: 0 });
      expect(transform.rotation).toBe(0);
      expect(transform.scale).toEqual({ x: 1, y: 1 });
      expect(transform.previousPosition).toEqual({ x: 0, y: 0 });
    });

    it('should create with custom values', () => {
      const customTransform = new TransformComponent(10, 20, Math.PI / 4, 2, 3);
      
      expect(customTransform.position).toEqual({ x: 10, y: 20 });
      expect(customTransform.rotation).toBe(Math.PI / 4);
      expect(customTransform.scale).toEqual({ x: 2, y: 3 });
    });
  });

  describe('Position Management', () => {
    it('should set position and update previous position', () => {
      transform.setPosition(100, 200);
      
      expect(transform.position).toEqual({ x: 100, y: 200 });
      expect(transform.previousPosition).toEqual({ x: 0, y: 0 });
    });

    it('should translate position correctly', () => {
      transform.setPosition(10, 20);
      transform.translate(5, -10);
      
      expect(transform.position).toEqual({ x: 15, y: 10 });
    });

    it('should track previous position on multiple moves', () => {
      transform.setPosition(10, 20);
      transform.setPosition(30, 40);
      
      expect(transform.previousPosition).toEqual({ x: 10, y: 20 });
      expect(transform.position).toEqual({ x: 30, y: 40 });
    });
  });

  describe('Rotation Management', () => {
    it('should set rotation in radians', () => {
      const angle = Math.PI / 2;
      transform.setRotation(angle);
      
      expect(transform.rotation).toBe(angle);
      expect(transform.previousRotation).toBe(0);
    });

    it('should set rotation in degrees', () => {
      transform.setRotationDegrees(90);
      
      expect(transform.rotation).toBeCloseTo(Math.PI / 2);
    });

    it('should rotate by delta angle', () => {
      transform.setRotation(Math.PI / 4);
      transform.rotate(Math.PI / 4);
      
      expect(transform.rotation).toBeCloseTo(Math.PI / 2);
    });

    it('should track previous rotation', () => {
      transform.setRotation(Math.PI / 4);
      transform.setRotation(Math.PI / 2);
      
      expect(transform.previousRotation).toBeCloseTo(Math.PI / 4);
    });
  });

  describe('Scale Management', () => {
    it('should set uniform scale', () => {
      transform.setScale(2);
      
      expect(transform.scale).toEqual({ x: 2, y: 2 });
    });

    it('should set non-uniform scale', () => {
      transform.setScale(2, 3);
      
      expect(transform.scale).toEqual({ x: 2, y: 3 });
    });
  });

  describe('Velocity Calculations', () => {
    it('should calculate velocity from position change', () => {
      transform.setPosition(0, 0);
      transform.setPosition(10, 20);
      
      const velocity = transform.getVelocity(100); // 100ms
      
      expect(velocity.x).toBe(0.1); // 10 pixels / 100ms = 0.1 px/ms
      expect(velocity.y).toBe(0.2); // 20 pixels / 100ms = 0.2 px/ms
    });

    it('should return zero velocity for zero deltaTime', () => {
      transform.setPosition(0, 0);
      transform.setPosition(10, 20);
      
      const velocity = transform.getVelocity(0);
      
      expect(velocity).toEqual({ x: 0, y: 0 });
    });

    it('should calculate angular velocity', () => {
      transform.setRotation(0);
      transform.setRotation(Math.PI / 2);
      
      const angularVelocity = transform.getAngularVelocity(100);
      
      expect(angularVelocity).toBeCloseTo(Math.PI / 200); // π/2 / 100ms
    });
  });

  describe('Distance Calculations', () => {
    let otherTransform;

    beforeEach(() => {
      otherTransform = new TransformComponent(30, 40);
      transform.setPosition(0, 0);
    });

    it('should calculate distance to another transform', () => {
      const distance = transform.distanceTo(otherTransform);
      
      expect(distance).toBe(50); // 3-4-5 triangle
    });

    it('should calculate squared distance', () => {
      const distanceSquared = transform.distanceSquaredTo(otherTransform);
      
      expect(distanceSquared).toBe(2500); // 50^2
    });
  });

  describe('Direction Calculations', () => {
    let otherTransform;

    beforeEach(() => {
      otherTransform = new TransformComponent(10, 0);
      transform.setPosition(0, 0);
    });

    it('should calculate angle to another transform', () => {
      const angle = transform.angleTo(otherTransform);
      
      expect(angle).toBe(0); // Pointing right (positive X)
    });

    it('should look at another transform', () => {
      transform.lookAt(otherTransform);
      
      expect(transform.rotation).toBe(0);
    });

    it('should get forward direction vector', () => {
      transform.setRotation(0);
      const forward = transform.getForward();
      
      expect(forward.x).toBeCloseTo(1);
      expect(forward.y).toBeCloseTo(0);
    });

    it('should get right direction vector', () => {
      transform.setRotation(0);
      const right = transform.getRight();
      
      expect(right.x).toBeCloseTo(0);
      expect(right.y).toBeCloseTo(1);
    });
  });

  describe('Complex Angle Calculations', () => {
    it('should handle different angles correctly', () => {
      const otherTransform = new TransformComponent(0, 10);
      transform.setPosition(0, 0);
      
      const angle = transform.angleTo(otherTransform);
      expect(angle).toBeCloseTo(Math.PI / 2); // Pointing up (positive Y)
    });

    it('should handle negative positions', () => {
      const otherTransform = new TransformComponent(-10, 0);
      transform.setPosition(0, 0);
      
      const angle = transform.angleTo(otherTransform);
      expect(angle).toBeCloseTo(Math.PI); // Pointing left (negative X)
    });
  });

  describe('Cloning', () => {
    it('should clone transform with same values', () => {
      transform.setPosition(10, 20);
      transform.setRotation(Math.PI / 4);
      transform.setScale(2, 3);
      
      const clone = transform.clone();
      
      expect(clone).not.toBe(transform);
      expect(clone.position).toEqual(transform.position);
      expect(clone.rotation).toBe(transform.rotation);
      expect(clone.scale).toEqual(transform.scale);
      expect(clone.previousPosition).toEqual(transform.previousPosition);
      expect(clone.previousRotation).toBe(transform.previousRotation);
    });
  });

  describe('Update Method', () => {
    it('should update previous values', () => {
      transform.setPosition(10, 20);
      transform.setRotation(Math.PI / 4);
      
      // Manually change current values to simulate frame update
      transform.position.x = 30;
      transform.position.y = 40;
      transform.rotation = Math.PI / 2;
      
      transform.update(16.67);
      
      expect(transform.previousPosition).toEqual({ x: 30, y: 40 });
      expect(transform.previousRotation).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      transform.setPosition(10, 20);
      transform.setRotation(Math.PI / 4);
      transform.setScale(2, 3);
      
      const json = transform.toJSON();
      
      expect(json.type).toBe('TransformComponent');
      expect(json.data.position).toEqual({ x: 10, y: 20 });
      expect(json.data.rotation).toBeCloseTo(Math.PI / 4);
      expect(json.data.scale).toEqual({ x: 2, y: 3 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero distance calculations', () => {
      const sameTransform = new TransformComponent(0, 0);
      
      const distance = transform.distanceTo(sameTransform);
      const distanceSquared = transform.distanceSquaredTo(sameTransform);
      
      expect(distance).toBe(0);
      expect(distanceSquared).toBe(0);
    });

    it('should handle very small movements', () => {
      transform.setPosition(0, 0);
      transform.translate(0.001, 0.001);
      
      expect(transform.position.x).toBeCloseTo(0.001);
      expect(transform.position.y).toBeCloseTo(0.001);
    });
  });
}); 