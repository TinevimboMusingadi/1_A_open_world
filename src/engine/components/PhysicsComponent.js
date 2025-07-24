import { Component } from '../Component.js';

/**
 * PhysicsComponent - Integrates with Matter.js physics engine
 * Provides collision detection, physics simulation, and body management
 */
export class PhysicsComponent extends Component {
  constructor(options = {}) {
    super();
    
    // Physics body reference (will be set by physics system)
    this.body = null;
    
    // Body properties
    this.bodyType = options.bodyType || 'dynamic'; // dynamic, static, kinematic
    this.shape = options.shape || 'rectangle'; // rectangle, circle, polygon
    this.width = options.width || 32;
    this.height = options.height || 32;
    this.radius = options.radius || 16;
    
    // Physical properties
    this.mass = options.mass || 1;
    this.density = options.density || 0.001;
    this.friction = options.friction || 0.1;
    this.frictionAir = options.frictionAir || 0.01;
    this.restitution = options.restitution || 0.3; // Bounciness (0-1)
    
    // Collision properties
    this.isSensor = options.isSensor || false; // True for trigger volumes
    this.collisionFilter = options.collisionFilter || {
      category: 0x0001,
      mask: 0xFFFF,
      group: 0
    };
    
    // Physics flags
    this.affectedByGravity = options.affectedByGravity !== false;
    this.canSleep = options.canSleep !== false;
    this.isStatic = options.bodyType === 'static';
    
    // Collision callbacks
    this.onCollisionStart = options.onCollisionStart || null;
    this.onCollisionEnd = options.onCollisionEnd || null;
    this.onCollisionActive = options.onCollisionActive || null;
    
    // Internal state
    this.isInitialized = false;
    this.collisions = new Set(); // Currently colliding bodies
    this.previousPosition = { x: 0, y: 0 };
    this.previousAngle = 0;
  }

  /**
   * Initialize physics body (called by physics system)
   * @param {Matter.Body} body - The Matter.js body
   */
  initializeBody(body) {
    this.body = body;
    this.isInitialized = true;
    
    // Store reference to this component in the body for collision handling
    this.body.component = this;
    
    // Set initial properties
    this.updateBodyProperties();
  }

  /**
   * Update body properties from component values
   */
  updateBodyProperties() {
    if (!this.body) return;

    // Update physical properties
    this.body.mass = this.mass;
    this.body.density = this.density;
    this.body.friction = this.friction;
    this.body.frictionAir = this.frictionAir;
    this.body.restitution = this.restitution;
    
    // Update collision properties
    this.body.isSensor = this.isSensor;
    this.body.collisionFilter = { ...this.collisionFilter };
    
    // Update body type
    if (this.bodyType === 'static') {
      Matter.Body.setStatic(this.body, true);
    } else {
      Matter.Body.setStatic(this.body, false);
    }
  }

  /**
   * Set position of physics body
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  setPosition(x, y) {
    if (!this.body) return;
    Matter.Body.setPosition(this.body, { x, y });
  }

  /**
   * Set rotation of physics body
   * @param {number} angle - Angle in radians
   */
  setRotation(angle) {
    if (!this.body) return;
    Matter.Body.setAngle(this.body, angle);
  }

  /**
   * Set velocity of physics body
   * @param {number} x - X velocity
   * @param {number} y - Y velocity
   */
  setVelocity(x, y) {
    if (!this.body) return;
    Matter.Body.setVelocity(this.body, { x, y });
  }

  /**
   * Set angular velocity of physics body
   * @param {number} angularVelocity - Angular velocity in radians/second
   */
  setAngularVelocity(angularVelocity) {
    if (!this.body) return;
    Matter.Body.setAngularVelocity(this.body, angularVelocity);
  }

  /**
   * Apply force to the body
   * @param {number} x - X force
   * @param {number} y - Y force
   * @param {Object} point - Point to apply force (optional, defaults to center)
   */
  applyForce(x, y, point = null) {
    if (!this.body) return;
    
    const forcePoint = point || this.body.position;
    Matter.Body.applyForce(this.body, forcePoint, { x, y });
  }

  /**
   * Apply impulse (instant force) to the body
   * @param {number} x - X impulse
   * @param {number} y - Y impulse
   */
  applyImpulse(x, y) {
    if (!this.body) return;
    
    const currentVel = this.body.velocity;
    this.setVelocity(currentVel.x + x, currentVel.y + y);
  }

  /**
   * Scale the body
   * @param {number} scaleX - X scale factor
   * @param {number} scaleY - Y scale factor
   */
  scale(scaleX, scaleY = scaleX) {
    if (!this.body) return;
    Matter.Body.scale(this.body, scaleX, scaleY);
  }

  /**
   * Get current position from physics body
   * @returns {Object} - Position { x, y }
   */
  getPosition() {
    return this.body ? this.body.position : { x: 0, y: 0 };
  }

  /**
   * Get current rotation from physics body
   * @returns {number} - Rotation in radians
   */
  getRotation() {
    return this.body ? this.body.angle : 0;
  }

  /**
   * Get current velocity from physics body
   * @returns {Object} - Velocity { x, y }
   */
  getVelocity() {
    return this.body ? this.body.velocity : { x: 0, y: 0 };
  }

  /**
   * Get current angular velocity from physics body
   * @returns {number} - Angular velocity in radians/second
   */
  getAngularVelocity() {
    return this.body ? this.body.angularVelocity : 0;
  }

  /**
   * Check if body is colliding with another body
   * @param {PhysicsComponent} other - Other physics component
   * @returns {boolean} - True if colliding
   */
  isCollidingWith(other) {
    return this.collisions.has(other.body);
  }

  /**
   * Get all currently colliding bodies
   * @returns {Matter.Body[]} - Array of colliding bodies
   */
  getCollisions() {
    return Array.from(this.collisions);
  }

  /**
   * Handle collision start
   * @param {Matter.Body} otherBody - The other body in collision
   */
  handleCollisionStart(otherBody) {
    this.collisions.add(otherBody);
    
    if (this.onCollisionStart) {
      this.onCollisionStart(otherBody, otherBody.component);
    }
  }

  /**
   * Handle collision end
   * @param {Matter.Body} otherBody - The other body that stopped colliding
   */
  handleCollisionEnd(otherBody) {
    this.collisions.delete(otherBody);
    
    if (this.onCollisionEnd) {
      this.onCollisionEnd(otherBody, otherBody.component);
    }
  }

  /**
   * Handle active collision
   * @param {Matter.Body} otherBody - The other body in active collision
   */
  handleCollisionActive(otherBody) {
    if (this.onCollisionActive) {
      this.onCollisionActive(otherBody, otherBody.component);
    }
  }

  /**
   * Synchronize transform component with physics body
   */
  syncWithTransform() {
    if (!this.body) return;
    
    const transform = this.getSiblingComponent('TransformComponent');
    if (!transform) return;

    // Update transform from physics body
    const pos = this.getPosition();
    const rot = this.getRotation();
    
    // Only update if position/rotation actually changed to avoid feedback loops
    if (Math.abs(pos.x - this.previousPosition.x) > 0.001 ||
        Math.abs(pos.y - this.previousPosition.y) > 0.001) {
      transform.setPosition(pos.x, pos.y);
      this.previousPosition = { ...pos };
    }
    
    if (Math.abs(rot - this.previousAngle) > 0.001) {
      transform.setRotation(rot);
      this.previousAngle = rot;
    }
  }

  /**
   * Update physics component
   * @param {number} deltaTime - Time elapsed since last frame
   */
  update(deltaTime) {
    super.update(deltaTime);
    
    if (!this.isInitialized) return;
    
    // Sync with transform component
    this.syncWithTransform();
  }

  /**
   * Clean up physics body when component is destroyed
   */
  onDetach() {
    if (this.body && this.body.world) {
      // Remove body from physics world
      Matter.World.remove(this.body.world, this.body);
    }
    
    this.body = null;
    this.isInitialized = false;
    this.collisions.clear();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      data: {
        bodyType: this.bodyType,
        shape: this.shape,
        width: this.width,
        height: this.height,
        radius: this.radius,
        mass: this.mass,
        density: this.density,
        friction: this.friction,
        frictionAir: this.frictionAir,
        restitution: this.restitution,
        isSensor: this.isSensor,
        collisionFilter: this.collisionFilter,
        affectedByGravity: this.affectedByGravity,
        canSleep: this.canSleep,
        isStatic: this.isStatic,
        position: this.getPosition(),
        rotation: this.getRotation(),
        velocity: this.getVelocity(),
        angularVelocity: this.getAngularVelocity()
      }
    };
  }
} 