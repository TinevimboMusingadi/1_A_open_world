import { System } from '../System.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { MovementComponent } from '../components/MovementComponent.js';

/**
 * ShooterSystem - Handles shooting mechanics and bullet management
 */
export class ShooterSystem extends System {
  constructor() {
    super('ShooterSystem');
    this.requiredComponents = ['ShooterControllerComponent', 'TransformComponent'];
    this.priority = 15;
    
    // Bullet management
    this.bullets = new Map(); // bulletId -> bullet data
    this.nextBulletId = 1;
    this.maxBullets = 50; // Limit total bullets
    this.bulletsUpdatedThisFrame = false; // Prevent multiple bullet updates per frame
    
    // Listen for bullet creation events
    if (typeof window !== 'undefined') {
      window.addEventListener('shooterCreateBullet', this.handleBulletCreation.bind(this));
    }
  }

  initialize(entityManager) {
    super.initialize(entityManager);
    console.log('🔫 ShooterSystem initialized');
  }

  update(deltaTime) {
    // Reset bullet update flag for this frame
    this.bulletsUpdatedThisFrame = false;
    
    // Call parent update which processes all relevant entities
    super.update(deltaTime);
  }

  process(entity, deltaTime) {
    // Safety check: ensure entity has getComponent method
    if (!entity || typeof entity.getComponent !== 'function') {
      console.warn('ShooterSystem: Invalid entity received', entity);
      return;
    }

    const shooter = entity.getComponent('ShooterControllerComponent');
    const transform = entity.getComponent('TransformComponent');
    
    // Only process if entity has both required components
    if (!shooter || !transform) {
      return;
    }

    // Update shooter component
    try {
      shooter.update(deltaTime);
    } catch (error) {
      console.warn('Error updating shooter component:', error);
    }
    
    // Update bullets (only do this once per frame, not per entity)
    if (!this.bulletsUpdatedThisFrame) {
      this.updateBullets(deltaTime);
      this.cleanupBullets();
      this.bulletsUpdatedThisFrame = true;
    }
  }

  handleBulletCreation(event) {
    const bulletData = event.detail;
    this.createBullet(bulletData);
  }

  createBullet(bulletData) {
    // Limit total bullets
    if (this.bullets.size >= this.maxBullets) {
      // Remove oldest bullet
      const oldestId = this.bullets.keys().next().value;
      this.destroyBullet(oldestId);
    }

    const bulletId = `bullet_${this.nextBulletId++}`;
    
    // Create bullet entity
    const bullet = this.entityManager.createEntity(bulletId);
    
    // Add Transform component
    const transform = new TransformComponent(
      bulletData.position.x,
      bulletData.position.y,
      bulletData.rotation
    );
    bullet.addComponent(transform);
    
    // Add Render component (small yellow circle)
    const render = new RenderComponent({
      color: '#FFD700',
      shape: 'circle',
      width: 4,
      height: 4,
      visible: true
    });
    bullet.addComponent(render);
    
    // Add Movement component
    const movement = new MovementComponent({
      maxSpeed: Math.sqrt(bulletData.velocity.x ** 2 + bulletData.velocity.y ** 2)
    });
    movement.setVelocity(bulletData.velocity.x, bulletData.velocity.y);
    bullet.addComponent(movement);
    
    // Add bullet to our tracking
    this.bullets.set(bulletId, {
      id: bulletId,
      entity: bullet,
      createdTime: Date.now(),
      owner: bulletData.owner,
      damage: 10
    });
    
    bullet.addTag('bullet');
    
    console.log(`🔫 Created bullet ${bulletId} from ${bulletData.owner}`);
  }

  updateBullets(deltaTime) {
    for (const [bulletId, bulletData] of this.bullets.entries()) {
      const bullet = bulletData.entity;
      const transform = bullet.getComponent('TransformComponent');
      
      if (!transform) {
        this.destroyBullet(bulletId);
        continue;
      }
      
      // Check bounds (remove bullets that go off screen)
      const x = transform.position.x;
      const y = transform.position.y;
      const bounds = 1000; // Screen bounds
      
      if (Math.abs(x) > bounds || Math.abs(y) > bounds) {
        this.destroyBullet(bulletId);
        continue;
      }
      
      // Check collision with enemies
      this.checkBulletCollisions(bulletData);
    }
  }

  checkBulletCollisions(bulletData) {
    const bulletTransform = bulletData.entity.getComponent('TransformComponent');
    if (!bulletTransform) return;
    
    // Get all entities with the 'enemy' tag
    const enemies = this.entityManager.getEntitiesByTag('enemy');
    
    for (const enemy of enemies) {
      if (enemy.id === bulletData.owner) continue; // Don't hit owner
      
      const enemyTransform = enemy.getComponent('TransformComponent');
      const enemyRender = enemy.getComponent('RenderComponent');
      
      if (!enemyTransform || !enemyRender) continue;
      
      // Simple collision detection (distance-based)
      const dx = bulletTransform.position.x - enemyTransform.position.x;
      const dy = bulletTransform.position.y - enemyTransform.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const collisionRadius = Math.max(enemyRender.width, enemyRender.height) / 2;
      
      if (distance < collisionRadius) {
        // Hit! 
        this.handleBulletHit(bulletData, enemy);
        return; // Bullet is destroyed, no need to check more
      }
    }
  }

  handleBulletHit(bulletData, target) {
    console.log(`💥 Bullet ${bulletData.id} hit ${target.id}!`);
    
    // Destroy bullet
    this.destroyBullet(bulletData.id);
    
    // Damage target (for now, just change color to show hit)
    const render = target.getComponent('RenderComponent');
    if (render) {
      const originalColor = render.color;
      render.setColor('#FFFFFF'); // Flash white
      
      // Restore color after a short time
      setTimeout(() => {
        if (render && render.entity) {
          render.setColor(originalColor);
        }
      }, 100);
    }
    
    // Create hit effect
    this.createHitEffect(target.getComponent('TransformComponent').position);
  }

  createHitEffect(position) {
    // Create a small explosion effect
    const effectId = `effect_${Date.now()}`;
    const effect = this.entityManager.createEntity(effectId);
    
    const transform = new TransformComponent(position.x, position.y);
    effect.addComponent(transform);
    
    const render = new RenderComponent({
      color: '#FF6B6B',
      shape: 'circle',
      width: 16,
      height: 16,
      opacity: 0.8
    });
    effect.addComponent(render);
    
    effect.addTag('effect');
    
    // Remove effect after a short time
    setTimeout(() => {
      this.entityManager.destroyEntity(effectId);
    }, 200);
  }

  destroyBullet(bulletId) {
    const bulletData = this.bullets.get(bulletId);
    if (bulletData) {
      this.entityManager.destroyEntity(bulletId);
      this.bullets.delete(bulletId);
    }
  }

  cleanupBullets() {
    const currentTime = Date.now();
    const maxBulletLifetime = 5000; // 5 seconds
    
    for (const [bulletId, bulletData] of this.bullets.entries()) {
      if (currentTime - bulletData.createdTime > maxBulletLifetime) {
        this.destroyBullet(bulletId);
      }
    }
  }



  getInfo() {
    return {
      ...super.getInfo(),
      bulletsActive: this.bullets.size,
      maxBullets: this.maxBullets
    };
  }
} 