import { Component } from '../Component.js';

/**
 * MovementComponent - Handles entity movement and velocity
 * Works with TransformComponent to provide movement functionality
 */
export class MovementComponent extends Component {
  constructor(options = {}) {
    super();
    
    // Velocity
    this.velocity = options.velocity || { x: 0, y: 0 };
    this.acceleration = options.acceleration || { x: 0, y: 0 };
    
    // Movement constraints
    this.maxSpeed = options.maxSpeed || 200; // pixels per second
    this.friction = options.friction || 0.9; // Applied each frame (0-1)
    this.drag = options.drag || 0.98; // Air resistance (0-1)
    
    // Movement properties
    this.speed = options.speed || 100; // Base movement speed
    this.angularVelocity = options.angularVelocity || 0; // radians per second
    this.angularAcceleration = options.angularAcceleration || 0;
    this.maxAngularSpeed = options.maxAngularSpeed || Math.PI * 2; // radians per second
    
    // Movement flags
    this.canMove = options.canMove !== false;
    this.canRotate = options.canRotate !== false;
    this.affectedByFriction = options.affectedByFriction !== false;
    this.affectedByDrag = options.affectedByDrag !== false;
    
    // Ground detection
    this.isGrounded = false;
    this.groundFriction = options.groundFriction || 0.8;
    this.airFriction = options.airFriction || 0.95;
    
    // Forces to apply this frame
    this.forces = [];
    this.impulses = [];
  }

  /**
   * Set velocity
   * @param {number} x - X velocity
   * @param {number} y - Y velocity
   */
  setVelocity(x, y) {
    this.velocity.x = x;
    this.velocity.y = y;
  }

  /**
   * Add to velocity
   * @param {number} x - X velocity to add
   * @param {number} y - Y velocity to add
   */
  addVelocity(x, y) {
    this.velocity.x += x;
    this.velocity.y += y;
    this.clampVelocity();
  }

  /**
   * Set acceleration
   * @param {number} x - X acceleration
   * @param {number} y - Y acceleration
   */
  setAcceleration(x, y) {
    this.acceleration.x = x;
    this.acceleration.y = y;
  }

  /**
   * Add a force to be applied this frame
   * @param {number} x - X force
   * @param {number} y - Y force
   */
  addForce(x, y) {
    this.forces.push({ x, y });
  }

  /**
   * Add an impulse (instant velocity change)
   * @param {number} x - X impulse
   * @param {number} y - Y impulse
   */
  addImpulse(x, y) {
    this.impulses.push({ x, y });
  }

  /**
   * Move in a direction
   * @param {number} x - X direction (-1 to 1)
   * @param {number} y - Y direction (-1 to 1)
   * @param {number} speedMultiplier - Speed multiplier (default 1)
   */
  move(x, y, speedMultiplier = 1) {
    if (!this.canMove) return;

    const moveSpeed = this.speed * speedMultiplier;
    this.addVelocity(x * moveSpeed, y * moveSpeed);
  }

  /**
   * Move forward based on current rotation
   * @param {number} speedMultiplier - Speed multiplier (default 1)
   */
  moveForward(speedMultiplier = 1) {
    const transform = this.getSiblingComponent('TransformComponent');
    if (!transform) return;

    const forward = transform.getForward();
    this.move(forward.x, forward.y, speedMultiplier);
  }

  /**
   * Move backward based on current rotation
   * @param {number} speedMultiplier - Speed multiplier (default 1)
   */
  moveBackward(speedMultiplier = 1) {
    this.moveForward(-speedMultiplier);
  }

  /**
   * Strafe left based on current rotation
   * @param {number} speedMultiplier - Speed multiplier (default 1)
   */
  strafeLeft(speedMultiplier = 1) {
    const transform = this.getSiblingComponent('TransformComponent');
    if (!transform) return;

    const right = transform.getRight();
    this.move(-right.x, -right.y, speedMultiplier);
  }

  /**
   * Strafe right based on current rotation
   * @param {number} speedMultiplier - Speed multiplier (default 1)
   */
  strafeRight(speedMultiplier = 1) {
    const transform = this.getSiblingComponent('TransformComponent');
    if (!transform) return;

    const right = transform.getRight();
    this.move(right.x, right.y, speedMultiplier);
  }

  /**
   * Jump (add upward impulse)
   * @param {number} force - Jump force
   */
  jump(force = 300) {
    if (this.isGrounded) {
      this.addImpulse(0, -force);
      this.isGrounded = false;
    }
  }

  /**
   * Set angular velocity
   * @param {number} angularVelocity - Angular velocity in radians per second
   */
  setAngularVelocity(angularVelocity) {
    this.angularVelocity = angularVelocity;
  }

  /**
   * Rotate by angular velocity
   * @param {number} deltaRadians - Radians to rotate
   */
  rotate(deltaRadians) {
    if (!this.canRotate) return;
    this.angularVelocity += deltaRadians;
    this.clampAngularVelocity();
  }

  /**
   * Stop all movement
   */
  stop() {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.angularVelocity = 0;
  }

  /**
   * Clamp velocity to maximum speed
   */
  clampVelocity() {
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    if (speed > this.maxSpeed) {
      const ratio = this.maxSpeed / speed;
      this.velocity.x *= ratio;
      this.velocity.y *= ratio;
    }
  }

  /**
   * Clamp angular velocity to maximum angular speed
   */
  clampAngularVelocity() {
    this.angularVelocity = Math.max(-this.maxAngularSpeed, Math.min(this.maxAngularSpeed, this.angularVelocity));
  }

  /**
   * Get current speed (magnitude of velocity)
   * @returns {number} - Current speed
   */
  getSpeed() {
    return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
  }

  /**
   * Get velocity direction (normalized)
   * @returns {Object} - Direction vector
   */
  getDirection() {
    const speed = this.getSpeed();
    if (speed === 0) return { x: 0, y: 0 };
    
    return {
      x: this.velocity.x / speed,
      y: this.velocity.y / speed
    };
  }

  /**
   * Update movement physics
   * @param {number} deltaTime - Time elapsed since last frame in milliseconds
   */
  update(deltaTime) {
    super.update(deltaTime);
    
    if (!this.canMove) return;

    const deltaSeconds = deltaTime / 1000;
    const transform = this.getSiblingComponent('TransformComponent');
    
    if (!transform) return;

    // Apply impulses
    for (const impulse of this.impulses) {
      this.velocity.x += impulse.x * deltaSeconds;
      this.velocity.y += impulse.y * deltaSeconds;
    }
    this.impulses.length = 0;

    // Apply forces
    for (const force of this.forces) {
      this.acceleration.x += force.x;
      this.acceleration.y += force.y;
    }
    this.forces.length = 0;

    // Apply acceleration
    this.velocity.x += this.acceleration.x * deltaSeconds;
    this.velocity.y += this.acceleration.y * deltaSeconds;

    // Apply friction
    if (this.affectedByFriction) {
      const frictionValue = this.isGrounded ? this.groundFriction : this.airFriction;
      this.velocity.x *= frictionValue;
      this.velocity.y *= frictionValue;
    }

    // Apply drag
    if (this.affectedByDrag) {
      this.velocity.x *= this.drag;
      this.velocity.y *= this.drag;
    }

    // Clamp velocity
    this.clampVelocity();

    // Update position
    transform.translate(
      this.velocity.x * deltaSeconds,
      this.velocity.y * deltaSeconds
    );

    // Update rotation
    if (this.canRotate && this.angularVelocity !== 0) {
      this.angularVelocity += this.angularAcceleration * deltaSeconds;
      this.clampAngularVelocity();
      transform.rotate(this.angularVelocity * deltaSeconds);
      
      // Apply angular friction
      this.angularVelocity *= 0.95;
    }

    // Reset acceleration (forces are applied per frame)
    this.acceleration.x = 0;
    this.acceleration.y = 0;
    this.angularAcceleration = 0;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      data: {
        velocity: this.velocity,
        acceleration: this.acceleration,
        maxSpeed: this.maxSpeed,
        friction: this.friction,
        drag: this.drag,
        speed: this.speed,
        angularVelocity: this.angularVelocity,
        angularAcceleration: this.angularAcceleration,
        maxAngularSpeed: this.maxAngularSpeed,
        canMove: this.canMove,
        canRotate: this.canRotate,
        affectedByFriction: this.affectedByFriction,
        affectedByDrag: this.affectedByDrag,
        isGrounded: this.isGrounded,
        groundFriction: this.groundFriction,
        airFriction: this.airFriction
      }
    };
  }
} 