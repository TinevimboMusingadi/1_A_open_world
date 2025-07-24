import { System } from '../System.js';

/**
 * MovementSystem - Processes entities with movement and transform components
 * Handles physics-based movement, velocity, and position updates
 */
export class MovementSystem extends System {
  constructor() {
    super('MovementSystem');
    this.priority = 10; // Run after input but before rendering
    this.requiredComponents = ['TransformComponent', 'MovementComponent'];
    
    // System configuration
    this.gravity = { x: 0, y: 980 }; // pixels/second²
    this.terminalVelocity = 1000; // pixels/second
    this.enableGravity = true;
  }

  /**
   * Process entities with movement components
   * @param {Entity[]} entities - Entities to process
   * @param {number} deltaTime - Time elapsed since last frame in milliseconds
   */
  process(entities, deltaTime) {
    const deltaSeconds = deltaTime / 1000;

    for (const entity of entities) {
      const transform = entity.getComponent('TransformComponent');
      const movement = entity.getComponent('MovementComponent');

      if (!transform || !movement || !movement.isEnabled()) {
        continue;
      }

      this.updateMovement(entity, transform, movement, deltaSeconds);
    }
  }

  /**
   * Update movement for a single entity
   * @param {Entity} entity - The entity to update
   * @param {TransformComponent} transform - Transform component
   * @param {MovementComponent} movement - Movement component
   * @param {number} deltaSeconds - Time elapsed in seconds
   */
  updateMovement(entity, transform, movement, deltaSeconds) {
    // Skip if movement is disabled
    if (!movement.canMove) return;

    // Apply gravity if enabled and entity is affected by it
    if (this.enableGravity && movement.affectedByFriction) {
      this.applyGravity(movement, deltaSeconds);
    }

    // Apply forces accumulated this frame
    this.applyForces(movement, deltaSeconds);

    // Apply impulses (instant velocity changes)
    this.applyImpulses(movement, deltaSeconds);

    // Apply acceleration to velocity
    this.applyAcceleration(movement, deltaSeconds);

    // Apply friction and drag
    this.applyFriction(movement);
    this.applyDrag(movement);

    // Clamp velocity to maximum speed
    movement.clampVelocity();

    // Update position based on velocity
    this.updatePosition(transform, movement, deltaSeconds);

    // Update rotation if angular movement is enabled
    if (movement.canRotate) {
      this.updateRotation(transform, movement, deltaSeconds);
    }

    // Reset per-frame forces and acceleration
    this.resetFrameForces(movement);

    // Update movement component
    movement.update(deltaTime * 1000); // Convert back to milliseconds
  }

  /**
   * Apply gravity to movement
   * @param {MovementComponent} movement - Movement component
   * @param {number} deltaSeconds - Time elapsed in seconds
   */
  applyGravity(movement, deltaSeconds) {
    if (!movement.isGrounded) {
      movement.acceleration.x += this.gravity.x;
      movement.acceleration.y += this.gravity.y;
    }
  }

  /**
   * Apply accumulated forces
   * @param {MovementComponent} movement - Movement component
   * @param {number} deltaSeconds - Time elapsed in seconds
   */
  applyForces(movement, deltaSeconds) {
    for (const force of movement.forces) {
      movement.acceleration.x += force.x;
      movement.acceleration.y += force.y;
    }
  }

  /**
   * Apply accumulated impulses
   * @param {MovementComponent} movement - Movement component
   * @param {number} deltaSeconds - Time elapsed in seconds
   */
  applyImpulses(movement, deltaSeconds) {
    for (const impulse of movement.impulses) {
      movement.velocity.x += impulse.x;
      movement.velocity.y += impulse.y;
    }
  }

  /**
   * Apply acceleration to velocity
   * @param {MovementComponent} movement - Movement component
   * @param {number} deltaSeconds - Time elapsed in seconds
   */
  applyAcceleration(movement, deltaSeconds) {
    movement.velocity.x += movement.acceleration.x * deltaSeconds;
    movement.velocity.y += movement.acceleration.y * deltaSeconds;

    // Clamp to terminal velocity if gravity is enabled
    if (this.enableGravity && Math.abs(movement.velocity.y) > this.terminalVelocity) {
      movement.velocity.y = Math.sign(movement.velocity.y) * this.terminalVelocity;
    }
  }

  /**
   * Apply friction to velocity
   * @param {MovementComponent} movement - Movement component
   */
  applyFriction(movement) {
    if (!movement.affectedByFriction) return;

    const frictionValue = movement.isGrounded ? movement.groundFriction : movement.airFriction;
    movement.velocity.x *= frictionValue;
    movement.velocity.y *= frictionValue;
  }

  /**
   * Apply drag to velocity
   * @param {MovementComponent} movement - Movement component
   */
  applyDrag(movement) {
    if (!movement.affectedByDrag) return;

    movement.velocity.x *= movement.drag;
    movement.velocity.y *= movement.drag;
  }

  /**
   * Update entity position
   * @param {TransformComponent} transform - Transform component
   * @param {MovementComponent} movement - Movement component
   * @param {number} deltaSeconds - Time elapsed in seconds
   */
  updatePosition(transform, movement, deltaSeconds) {
    const deltaX = movement.velocity.x * deltaSeconds;
    const deltaY = movement.velocity.y * deltaSeconds;

    // Only update if there's actual movement
    if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
      transform.translate(deltaX, deltaY);
    }
  }

  /**
   * Update entity rotation
   * @param {TransformComponent} transform - Transform component
   * @param {MovementComponent} movement - Movement component
   * @param {number} deltaSeconds - Time elapsed in seconds
   */
  updateRotation(transform, movement, deltaSeconds) {
    if (Math.abs(movement.angularVelocity) > 0.001) {
      // Apply angular acceleration
      movement.angularVelocity += movement.angularAcceleration * deltaSeconds;
      
      // Clamp angular velocity
      movement.clampAngularVelocity();
      
      // Update rotation
      const deltaRotation = movement.angularVelocity * deltaSeconds;
      transform.rotate(deltaRotation);
      
      // Apply angular friction
      movement.angularVelocity *= 0.95;
    }
  }

  /**
   * Reset per-frame forces and acceleration
   * @param {MovementComponent} movement - Movement component
   */
  resetFrameForces(movement) {
    movement.forces.length = 0;
    movement.impulses.length = 0;
    movement.acceleration.x = 0;
    movement.acceleration.y = 0;
    movement.angularAcceleration = 0;
  }

  /**
   * Set gravity for the system
   * @param {number} x - X gravity component
   * @param {number} y - Y gravity component
   */
  setGravity(x, y) {
    this.gravity.x = x;
    this.gravity.y = y;
  }

  /**
   * Enable or disable gravity
   * @param {boolean} enabled - Whether gravity is enabled
   */
  setGravityEnabled(enabled) {
    this.enableGravity = enabled;
  }

  /**
   * Set terminal velocity
   * @param {number} velocity - Maximum velocity in pixels/second
   */
  setTerminalVelocity(velocity) {
    this.terminalVelocity = velocity;
  }

  /**
   * Get system configuration
   * @returns {Object} - System configuration
   */
  getConfiguration() {
    return {
      gravity: { ...this.gravity },
      terminalVelocity: this.terminalVelocity,
      enableGravity: this.enableGravity
    };
  }

  /**
   * Apply configuration to system
   * @param {Object} config - Configuration object
   */
  applyConfiguration(config) {
    if (config.gravity) {
      this.setGravity(config.gravity.x, config.gravity.y);
    }
    
    if (config.terminalVelocity !== undefined) {
      this.setTerminalVelocity(config.terminalVelocity);
    }
    
    if (config.enableGravity !== undefined) {
      this.setGravityEnabled(config.enableGravity);
    }
  }
} 