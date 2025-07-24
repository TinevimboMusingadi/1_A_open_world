import { Component } from '../Component.js';

/**
 * RenderComponent - Handles visual rendering of entities
 * Contains information about how an entity should be drawn
 */
export class RenderComponent extends Component {
  constructor(options = {}) {
    super();
    
    // Basic rendering properties
    this.visible = options.visible !== false;
    this.opacity = options.opacity !== undefined ? options.opacity : 1.0;
    this.color = options.color || '#ffffff';
    this.zIndex = options.zIndex || 0; // For layering
    
    // Shape properties
    this.shape = options.shape || 'rectangle'; // rectangle, circle, sprite, polygon
    this.width = options.width || 32;
    this.height = options.height || 32;
    this.radius = options.radius || 16; // For circles
    
    // Visual effects
    this.fill = options.fill !== false;
    this.stroke = options.stroke || false;
    this.strokeColor = options.strokeColor || '#000000';
    this.strokeWidth = options.strokeWidth || 1;
    
    // Sprite properties
    this.sprite = options.sprite || null; // Image or sprite sheet
    this.spriteFrame = options.spriteFrame || { x: 0, y: 0, width: 32, height: 32 };
    
    // Animation properties
    this.animations = new Map();
    this.currentAnimation = null;
    this.animationFrame = 0;
    this.animationTime = 0;
    
    // Offset from entity position (useful for centering)
    this.offset = options.offset || { x: 0, y: 0 };
    
    // Effects
    this.effects = [];
  }

  /**
   * Set visibility
   * @param {boolean} visible - Whether the entity should be visible
   */
  setVisible(visible) {
    this.visible = visible;
  }

  /**
   * Set opacity
   * @param {number} opacity - Opacity value (0.0 to 1.0)
   */
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(1, opacity));
  }

  /**
   * Set color
   * @param {string} color - Color in any CSS format
   */
  setColor(color) {
    this.color = color;
  }

  /**
   * Set size for rectangles
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   */
  setSize(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
   * Set radius for circles
   * @param {number} radius - Radius in pixels
   */
  setRadius(radius) {
    this.radius = radius;
  }

  /**
   * Set sprite
   * @param {HTMLImageElement|string} sprite - Image object or URL
   * @param {Object} frame - Frame information { x, y, width, height }
   */
  setSprite(sprite, frame = null) {
    this.sprite = sprite;
    if (frame) {
      this.spriteFrame = frame;
    }
    this.shape = 'sprite';
  }

  /**
   * Add an animation
   * @param {string} name - Animation name
   * @param {Object} animation - Animation data
   */
  addAnimation(name, animation) {
    this.animations.set(name, {
      frames: animation.frames || [],
      frameTime: animation.frameTime || 100, // ms per frame
      loop: animation.loop !== false,
      ...animation
    });
  }

  /**
   * Play an animation
   * @param {string} name - Animation name
   * @param {boolean} restart - Whether to restart if already playing
   */
  playAnimation(name, restart = false) {
    if (!this.animations.has(name)) {
      console.warn(`Animation '${name}' not found`);
      return;
    }

    if (this.currentAnimation !== name || restart) {
      this.currentAnimation = name;
      this.animationFrame = 0;
      this.animationTime = 0;
    }
  }

  /**
   * Stop current animation
   */
  stopAnimation() {
    this.currentAnimation = null;
    this.animationFrame = 0;
    this.animationTime = 0;
  }

  /**
   * Add a visual effect
   * @param {Object} effect - Effect configuration
   */
  addEffect(effect) {
    this.effects.push({
      duration: effect.duration || 1000,
      startTime: Date.now(),
      ...effect
    });
  }

  /**
   * Remove expired effects
   */
  updateEffects() {
    const now = Date.now();
    this.effects = this.effects.filter(effect => {
      const elapsed = now - effect.startTime;
      return elapsed < effect.duration;
    });
  }

  /**
   * Get current sprite frame based on animation
   * @returns {Object} - Current frame data
   */
  getCurrentFrame() {
    if (!this.currentAnimation || !this.animations.has(this.currentAnimation)) {
      return this.spriteFrame;
    }

    const animation = this.animations.get(this.currentAnimation);
    if (animation.frames.length === 0) {
      return this.spriteFrame;
    }

    const frameIndex = Math.floor(this.animationFrame) % animation.frames.length;
    return animation.frames[frameIndex];
  }

  /**
   * Update animation state
   * @param {number} deltaTime - Time elapsed since last frame
   */
  update(deltaTime) {
    super.update(deltaTime);
    
    // Update effects
    this.updateEffects();
    
    // Update animation
    if (this.currentAnimation && this.animations.has(this.currentAnimation)) {
      const animation = this.animations.get(this.currentAnimation);
      this.animationTime += deltaTime;
      
      if (this.animationTime >= animation.frameTime) {
        this.animationFrame += this.animationTime / animation.frameTime;
        this.animationTime = this.animationTime % animation.frameTime;
        
        // Handle non-looping animations
        if (!animation.loop) {
          const maxFrame = animation.frames.length - 1;
          if (this.animationFrame >= maxFrame) {
            this.animationFrame = maxFrame;
            this.stopAnimation();
          }
        }
      }
    }
  }

  /**
   * Get render bounds (useful for culling)
   * @param {TransformComponent} transform - Entity's transform
   * @returns {Object} - Bounds { x, y, width, height }
   */
  getBounds(transform) {
    const x = transform.position.x + this.offset.x;
    const y = transform.position.y + this.offset.y;
    
    switch (this.shape) {
      case 'circle':
        return {
          x: x - this.radius,
          y: y - this.radius,
          width: this.radius * 2,
          height: this.radius * 2
        };
      
      case 'sprite':
        const frame = this.getCurrentFrame();
        return {
          x: x - frame.width / 2,
          y: y - frame.height / 2,
          width: frame.width,
          height: frame.height
        };
      
      default: // rectangle
        return {
          x: x - this.width / 2,
          y: y - this.height / 2,
          width: this.width,
          height: this.height
        };
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      data: {
        visible: this.visible,
        opacity: this.opacity,
        color: this.color,
        zIndex: this.zIndex,
        shape: this.shape,
        width: this.width,
        height: this.height,
        radius: this.radius,
        fill: this.fill,
        stroke: this.stroke,
        strokeColor: this.strokeColor,
        strokeWidth: this.strokeWidth,
        spriteFrame: this.spriteFrame,
        offset: this.offset,
        currentAnimation: this.currentAnimation,
        animationFrame: this.animationFrame,
        animationTime: this.animationTime,
        animations: Array.from(this.animations.entries())
      }
    };
  }
} 