import { Component } from '../Component.js';

/**
 * ShooterControllerComponent - Handles shooting mechanics and controls
 */
export class ShooterControllerComponent extends Component {
  constructor(options = {}) {
    super();
    
    // Shooting configuration
    this.fireRate = options.fireRate || 300; // milliseconds between shots
    this.bulletSpeed = options.bulletSpeed || 400;
    this.shootKeys = options.shootKeys || ['Space', 'KeyF'];
    this.autoFire = options.autoFire || false;
    
    // Internal state
    this.lastShotTime = 0;
    this.canShoot = true;
    this.isPressingShoot = false;
    
    // Input handling
    this.keyStates = new Set();
    
    // Shooting direction (default: upward for Space Invaders style)
    this.shootDirection = options.shootDirection || { x: 0, y: -1 };
    this.bulletOffset = options.bulletOffset || { x: 0, y: -20 };
  }

  onAttach(entity) {
    super.onAttach(entity);
    
    if (typeof window !== 'undefined') {
      this.setupInputListeners();
    }
  }

  onDetach(entity) {
    super.onDetach(entity);
    
    if (typeof window !== 'undefined') {
      this.removeInputListeners();
    }
  }

  setupInputListeners() {
    this.keyDownHandler = (event) => {
      if (this.shootKeys.includes(event.code)) {
        this.keyStates.add(event.code);
        this.isPressingShoot = true;
        event.preventDefault();
        
        // Shoot immediately on keydown
        this.tryShoot();
      }
    };
    
    this.keyUpHandler = (event) => {
      if (this.shootKeys.includes(event.code)) {
        this.keyStates.delete(event.code);
        this.isPressingShoot = this.shootKeys.some(key => this.keyStates.has(key));
      }
    };
    
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  removeInputListeners() {
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler);
      window.removeEventListener('keyup', this.keyUpHandler);
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    
    const currentTime = Date.now();
    
    // Check if we can shoot again
    if (currentTime - this.lastShotTime >= this.fireRate) {
      this.canShoot = true;
    }
    
    // Auto-fire if enabled and key is held
    if (this.autoFire && this.isPressingShoot && this.canShoot) {
      this.tryShoot();
    }
  }

  tryShoot() {
    if (!this.canShoot) return false;
    
    const transform = this.getSiblingComponent('TransformComponent');
    if (!transform) return false;
    
    // Calculate bullet spawn position
    const spawnX = transform.position.x + this.bulletOffset.x;
    const spawnY = transform.position.y + this.bulletOffset.y;
    
    // Calculate bullet velocity
    const velocity = {
      x: this.shootDirection.x * this.bulletSpeed,
      y: this.shootDirection.y * this.bulletSpeed
    };
    
    // Fire the bullet
    this.fireBullet(spawnX, spawnY, velocity);
    
    this.canShoot = false;
    this.lastShotTime = Date.now();
    
    return true;
  }

  fireBullet(x, y, velocity) {
    // Create bullet creation event
    const bulletData = {
      position: { x, y },
      velocity: velocity,
      rotation: Math.atan2(velocity.y, velocity.x),
      owner: this.entity.id
    };
    
    // Dispatch bullet creation event
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('shooterCreateBullet', {
        detail: bulletData
      });
      window.dispatchEvent(event);
    }
    
    console.log(`🔫 ${this.entity.id} fired bullet at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  }

  // Set shooting direction (useful for different shooting patterns)
  setShootDirection(x, y) {
    this.shootDirection = { x, y };
  }

  // Enable/disable auto-fire
  setAutoFire(enabled) {
    this.autoFire = enabled;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      data: {
        fireRate: this.fireRate,
        bulletSpeed: this.bulletSpeed,
        shootKeys: this.shootKeys,
        autoFire: this.autoFire,
        shootDirection: this.shootDirection,
        bulletOffset: this.bulletOffset,
        canShoot: this.canShoot
      }
    };
  }
} 