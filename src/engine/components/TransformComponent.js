import { Component } from '../Component.js';

/**
 * TransformComponent - Handles position, rotation, and scale
 * Essential component for any entity that has a position in the game world
 */
export class TransformComponent extends Component {
  constructor(x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1) {
    super();
    
    this.position = { x, y };
    this.rotation = rotation; // In radians
    this.scale = { x: scaleX, y: scaleY };
    
    // Previous frame values for interpolation and velocity calculation
    this.previousPosition = { x, y };
    this.previousRotation = rotation;
  }

  /**
   * Set position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  setPosition(x, y) {
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;
    this.position.x = x;
    this.position.y = y;
  }

  /**
   * Translate by offset
   * @param {number} dx - X offset
   * @param {number} dy - Y offset
   */
  translate(dx, dy) {
    this.setPosition(this.position.x + dx, this.position.y + dy);
  }

  /**
   * Set rotation in radians
   * @param {number} rotation - Rotation in radians
   */
  setRotation(rotation) {
    this.previousRotation = this.rotation;
    this.rotation = rotation;
  }

  /**
   * Set rotation in degrees
   * @param {number} degrees - Rotation in degrees
   */
  setRotationDegrees(degrees) {
    this.setRotation(degrees * Math.PI / 180);
  }

  /**
   * Rotate by angle in radians
   * @param {number} deltaRotation - Rotation change in radians
   */
  rotate(deltaRotation) {
    this.setRotation(this.rotation + deltaRotation);
  }

  /**
   * Set scale
   * @param {number} scaleX - X scale
   * @param {number} scaleY - Y scale (optional, defaults to scaleX for uniform scaling)
   */
  setScale(scaleX, scaleY = scaleX) {
    this.scale.x = scaleX;
    this.scale.y = scaleY;
  }

  /**
   * Get velocity based on position change
   * @param {number} deltaTime - Time elapsed since last frame
   * @returns {Object} - Velocity object with x and y components
   */
  getVelocity(deltaTime) {
    if (deltaTime === 0) return { x: 0, y: 0 };
    
    return {
      x: (this.position.x - this.previousPosition.x) / deltaTime,
      y: (this.position.y - this.previousPosition.y) / deltaTime
    };
  }

  /**
   * Get angular velocity based on rotation change
   * @param {number} deltaTime - Time elapsed since last frame
   * @returns {number} - Angular velocity in radians per millisecond
   */
  getAngularVelocity(deltaTime) {
    if (deltaTime === 0) return 0;
    return (this.rotation - this.previousRotation) / deltaTime;
  }

  /**
   * Get distance to another transform
   * @param {TransformComponent} other - Other transform component
   * @returns {number} - Distance between transforms
   */
  distanceTo(other) {
    const dx = this.position.x - other.position.x;
    const dy = this.position.y - other.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get squared distance to another transform (faster than distanceTo)
   * @param {TransformComponent} other - Other transform component
   * @returns {number} - Squared distance between transforms
   */
  distanceSquaredTo(other) {
    const dx = this.position.x - other.position.x;
    const dy = this.position.y - other.position.y;
    return dx * dx + dy * dy;
  }

  /**
   * Get angle to another transform
   * @param {TransformComponent} other - Other transform component
   * @returns {number} - Angle in radians
   */
  angleTo(other) {
    const dx = other.position.x - this.position.x;
    const dy = other.position.y - this.position.y;
    return Math.atan2(dy, dx);
  }

  /**
   * Look at another transform (set rotation to face it)
   * @param {TransformComponent} other - Other transform component
   */
  lookAt(other) {
    this.setRotation(this.angleTo(other));
  }

  /**
   * Get forward direction vector based on current rotation
   * @returns {Object} - Direction vector with x and y components
   */
  getForward() {
    return {
      x: Math.cos(this.rotation),
      y: Math.sin(this.rotation)
    };
  }

  /**
   * Get right direction vector based on current rotation
   * @returns {Object} - Direction vector with x and y components
   */
  getRight() {
    return {
      x: Math.cos(this.rotation + Math.PI / 2),
      y: Math.sin(this.rotation + Math.PI / 2)
    };
  }

  /**
   * Create a copy of this transform
   * @returns {TransformComponent} - New transform with same values
   */
  clone() {
    const clone = new TransformComponent(
      this.position.x,
      this.position.y,
      this.rotation,
      this.scale.x,
      this.scale.y
    );
    clone.previousPosition = { ...this.previousPosition };
    clone.previousRotation = this.previousRotation;
    return clone;
  }

  /**
   * Update previous values (call this each frame)
   */
  update(deltaTime) {
    // This is called by the system to update previous values for next frame
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;
    this.previousRotation = this.rotation;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      data: {
        position: this.position,
        rotation: this.rotation,
        scale: this.scale,
        previousPosition: this.previousPosition,
        previousRotation: this.previousRotation
      }
    };
  }
} 