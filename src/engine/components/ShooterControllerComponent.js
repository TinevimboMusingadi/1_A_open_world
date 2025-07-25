import { Component } from '../Component.js';

/**
 * ShooterControllerComponent - Handles shooter game mechanics
 * Movement, shooting, and basic combat controls
 */
export class ShooterControllerComponent extends Component {
  constructor(options = {}) {
    super();
    
    // Movement settings
    this.moveSpeed = options.moveSpeed || 150;
    this.rotationSpeed = options.rotationSpeed || 3;
    
    // Shooting settings
    this.fireRate = options.fireRate || 300; // ms between shots
    this.lastShotTime = 0;
    this.bulletSpeed = options.bulletSpeed || 400;
    this.canShoot = options.canShoot !== false;
    
    // Input state
    this.inputState = {
      moveForward: false,
      moveBackward: false,
      moveLeft: false,
      moveRight: false,
      rotateLeft: false,
      rotateRight: false,
      shoot: false
    };
    
    // Key bindings
    this.keyBindings = {
      'KeyW': 'moveForward',
      'KeyS': 'moveBackward', 
      'KeyA': 'moveLeft',
      'KeyD': 'moveRight',
      'ArrowLeft': 'rotateLeft',
      'ArrowRight': 'rotateRight',
      'Space': 'shoot',
      'LeftClick': 'shoot'
    };
    
    // Event handlers (bound methods)
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  onAttach(entity) {
    super.onAttach(entity);
    
    // Add event listeners (only in browser)
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('mousedown', this.handleMouseDown);
      window.addEventListener('mouseup', this.handleMouseUp);
    }
  }

  onDetach(entity) {
    super.onDetach(entity);
    
    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('mousedown', this.handleMouseDown);
      window.removeEventListener('mouseup', this.handleMouseUp);
    }
  }

  handleKeyDown(event) {
    const action = this.keyBindings[event.code];
    if (action && this.inputState.hasOwnProperty(action)) {
      this.inputState[action] = true;
      event.preventDefault();
    }
  }

  handleKeyUp(event) {
    const action = this.keyBindings[event.code];
    if (action && this.inputState.hasOwnProperty(action)) {
      this.inputState[action] = false;
      event.preventDefault();
    }
  }

  handleMouseDown(event) {
    if (event.button === 0) { // Left click
      this.inputState.shoot = true;
      event.preventDefault();
    }
  }

  handleMouseUp(event) {
    if (event.button === 0) { // Left click
      this.inputState.shoot = false;
      event.preventDefault();
    }
  }

  update(deltaTime) {
    if (!this.enabled || !this.entity) return;

    const transform = this.entity.getComponent('TransformComponent');
    const movement = this.entity.getComponent('MovementComponent');
    
    if (!transform || !movement) return;

    // Handle movement
    this.handleMovement(transform, movement, deltaTime);
    
    // Handle rotation
    this.handleRotation(transform, deltaTime);
    
    // Handle shooting
    if (this.canShoot) {
      this.handleShooting(transform, deltaTime);
    }
  }

  handleMovement(transform, movement, deltaTime) {
    let moveX = 0;
    let moveY = 0;

    // Get movement direction based on input
    if (this.inputState.moveForward) moveY -= 1;
    if (this.inputState.moveBackward) moveY += 1;
    if (this.inputState.moveLeft) moveX -= 1;
    if (this.inputState.moveRight) moveX += 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.707; // Math.sqrt(2) / 2
      moveY *= 0.707;
    }

    // Apply movement speed
    const velocityX = moveX * this.moveSpeed;
    const velocityY = moveY * this.moveSpeed;

    // Set velocity on movement component
    movement.setVelocity(velocityX, velocityY);
  }

  handleRotation(transform, deltaTime) {
    let rotationDelta = 0;

    if (this.inputState.rotateLeft) rotationDelta -= 1;
    if (this.inputState.rotateRight) rotationDelta += 1;

    if (rotationDelta !== 0) {
      const rotationChange = rotationDelta * this.rotationSpeed * (deltaTime / 1000);
      transform.rotate(rotationChange);
    }
  }

  handleShooting(transform, deltaTime) {
    if (!this.inputState.shoot) return;

    const currentTime = Date.now();
    if (currentTime - this.lastShotTime < this.fireRate) return;

    this.lastShotTime = currentTime;
    this.createBullet(transform);
  }

  createBullet(transform) {
    // This would typically be handled by a game system
    // For now, we'll emit an event or call a callback
    const bulletData = {
      position: { ...transform.position },
      rotation: transform.rotation,
      velocity: {
        x: Math.cos(transform.rotation) * this.bulletSpeed,
        y: Math.sin(transform.rotation) * this.bulletSpeed
      },
      owner: this.entity.id
    };

    // Emit bullet creation event
    if (this.onShoot) {
      this.onShoot(bulletData);
    }

    // Also dispatch custom event for systems to listen
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shooterCreateBullet', { 
        detail: bulletData 
      }));
    }
  }

  // Utility methods
  isMoving() {
    return this.inputState.moveForward || 
           this.inputState.moveBackward || 
           this.inputState.moveLeft || 
           this.inputState.moveRight;
  }

  isShooting() {
    return this.inputState.shoot;
  }

  setMoveSpeed(speed) {
    this.moveSpeed = Math.max(0, speed);
  }

  setFireRate(rate) {
    this.fireRate = Math.max(50, rate); // Minimum 50ms between shots
  }

  setBulletSpeed(speed) {
    this.bulletSpeed = Math.max(100, speed);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      moveSpeed: this.moveSpeed,
      rotationSpeed: this.rotationSpeed,
      fireRate: this.fireRate,
      bulletSpeed: this.bulletSpeed,
      canShoot: this.canShoot,
      isMoving: this.isMoving(),
      isShooting: this.isShooting()
    };
  }
} 