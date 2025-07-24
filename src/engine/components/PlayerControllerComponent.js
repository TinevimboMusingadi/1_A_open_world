import { Component } from '../Component.js';

/**
 * PlayerControllerComponent - Handles user input and player control
 * Translates keyboard/mouse input into entity actions
 */
export class PlayerControllerComponent extends Component {
  constructor(options = {}) {
    super();
    
    // Input configuration
    this.keyBindings = {
      moveLeft: options.moveLeft || ['KeyA', 'ArrowLeft'],
      moveRight: options.moveRight || ['KeyD', 'ArrowRight'],
      moveUp: options.moveUp || ['KeyW', 'ArrowUp'],
      moveDown: options.moveDown || ['KeyS', 'ArrowDown'],
      jump: options.jump || ['Space'],
      run: options.run || ['ShiftLeft', 'ShiftRight'],
      interact: options.interact || ['KeyE'],
      attack: options.attack || ['KeyF'],
      ...options.keyBindings
    };
    
    // Input state
    this.inputState = {
      keys: new Set(),
      mouse: {
        position: { x: 0, y: 0 },
        buttons: new Set(),
        wheel: 0
      }
    };
    
    // Control parameters
    this.moveSpeed = options.moveSpeed || 1.0;
    this.runSpeedMultiplier = options.runSpeedMultiplier || 1.5;
    this.jumpForce = options.jumpForce || 300;
    this.sensitivity = options.sensitivity || 1.0;
    
    // Control flags
    this.enableKeyboard = options.enableKeyboard !== false;
    this.enableMouse = options.enableMouse !== false;
    this.enableGamepad = options.enableGamepad || false;
    
    // Movement state
    this.isMoving = false;
    this.isRunning = false;
    this.lastMoveDirection = { x: 0, y: 0 };
    
    // Events (for custom behavior)
    this.onMoveStart = options.onMoveStart || null;
    this.onMoveStop = options.onMoveStop || null;
    this.onJump = options.onJump || null;
    this.onInteract = options.onInteract || null;
    this.onAttack = options.onAttack || null;
    
    // Input buffer for precise timing
    this.inputBuffer = [];
    this.bufferDuration = 100; // ms
    
    // Dead zone for analog inputs
    this.deadZone = 0.1;
  }

  /**
   * Initialize input listeners
   */
  onAttach(entity) {
    super.onAttach(entity);
    
    if (typeof window !== 'undefined') {
      this.setupInputListeners();
    }
  }

  /**
   * Clean up input listeners
   */
  onDetach(entity) {
    super.onDetach(entity);
    
    if (typeof window !== 'undefined') {
      this.removeInputListeners();
    }
  }

  /**
   * Set up keyboard and mouse event listeners
   */
  setupInputListeners() {
    // Keyboard events
    if (this.enableKeyboard) {
      this.keyDownHandler = (event) => this.handleKeyDown(event);
      this.keyUpHandler = (event) => this.handleKeyUp(event);
      
      window.addEventListener('keydown', this.keyDownHandler);
      window.addEventListener('keyup', this.keyUpHandler);
    }
    
    // Mouse events
    if (this.enableMouse) {
      this.mouseDownHandler = (event) => this.handleMouseDown(event);
      this.mouseUpHandler = (event) => this.handleMouseUp(event);
      this.mouseMoveHandler = (event) => this.handleMouseMove(event);
      this.wheelHandler = (event) => this.handleWheel(event);
      
      window.addEventListener('mousedown', this.mouseDownHandler);
      window.addEventListener('mouseup', this.mouseUpHandler);
      window.addEventListener('mousemove', this.mouseMoveHandler);
      window.addEventListener('wheel', this.wheelHandler);
    }
  }

  /**
   * Remove input event listeners
   */
  removeInputListeners() {
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler);
      window.removeEventListener('keyup', this.keyUpHandler);
    }
    
    if (this.mouseDownHandler) {
      window.removeEventListener('mousedown', this.mouseDownHandler);
      window.removeEventListener('mouseup', this.mouseUpHandler);
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      window.removeEventListener('wheel', this.wheelHandler);
    }
  }

  /**
   * Handle key down events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyDown(event) {
    this.inputState.keys.add(event.code);
    
    // Add to input buffer
    this.addToInputBuffer('keydown', event.code);
    
    // Prevent default for game keys
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }
  }

  /**
   * Handle key up events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyUp(event) {
    this.inputState.keys.delete(event.code);
    
    // Add to input buffer
    this.addToInputBuffer('keyup', event.code);
  }

  /**
   * Handle mouse down events
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseDown(event) {
    this.inputState.mouse.buttons.add(event.button);
    this.addToInputBuffer('mousedown', event.button);
  }

  /**
   * Handle mouse up events
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseUp(event) {
    this.inputState.mouse.buttons.delete(event.button);
    this.addToInputBuffer('mouseup', event.button);
  }

  /**
   * Handle mouse move events
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseMove(event) {
    this.inputState.mouse.position.x = event.clientX;
    this.inputState.mouse.position.y = event.clientY;
  }

  /**
   * Handle mouse wheel events
   * @param {WheelEvent} event - Wheel event
   */
  handleWheel(event) {
    this.inputState.mouse.wheel = event.deltaY;
  }

  /**
   * Add input to buffer for timing-sensitive actions
   * @param {string} type - Input type
   * @param {string|number} key - Key or button
   */
  addToInputBuffer(type, key) {
    this.inputBuffer.push({
      type,
      key,
      timestamp: Date.now()
    });
  }

  /**
   * Check if a key is a game control key
   * @param {string} code - Key code
   * @returns {boolean} - True if it's a game key
   */
  isGameKey(code) {
    for (const binding of Object.values(this.keyBindings)) {
      if (binding.includes(code)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if any key in a binding is pressed
   * @param {string} action - Action name
   * @returns {boolean} - True if any bound key is pressed
   */
  isActionPressed(action) {
    const keys = this.keyBindings[action];
    if (!keys) return false;
    
    return keys.some(key => this.inputState.keys.has(key));
  }

  /**
   * Check if action was just pressed (in input buffer)
   * @param {string} action - Action name
   * @returns {boolean} - True if action was just pressed
   */
  wasActionJustPressed(action) {
    const keys = this.keyBindings[action];
    if (!keys) return false;
    
    const now = Date.now();
    return this.inputBuffer.some(input => 
      input.type === 'keydown' &&
      keys.includes(input.key) &&
      (now - input.timestamp) < this.bufferDuration
    );
  }

  /**
   * Get movement input vector
   * @returns {Object} - Movement vector { x, y }
   */
  getMovementInput() {
    let x = 0;
    let y = 0;
    
    if (this.isActionPressed('moveLeft')) x -= 1;
    if (this.isActionPressed('moveRight')) x += 1;
    if (this.isActionPressed('moveUp')) y -= 1;
    if (this.isActionPressed('moveDown')) y += 1;
    
    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const length = Math.sqrt(x * x + y * y);
      x /= length;
      y /= length;
    }
    
    return { x, y };
  }

  /**
   * Update player control
   * @param {number} deltaTime - Time elapsed since last frame
   */
  update(deltaTime) {
    super.update(deltaTime);
    
    // Clean up old input buffer entries
    const now = Date.now();
    this.inputBuffer = this.inputBuffer.filter(input => 
      (now - input.timestamp) < this.bufferDuration
    );
    
    // Get components
    const movement = this.getSiblingComponent('MovementComponent');
    const physics = this.getSiblingComponent('PhysicsComponent');
    
    // Handle movement
    const moveInput = this.getMovementInput();
    const isCurrentlyMoving = moveInput.x !== 0 || moveInput.y !== 0;
    
    // Check for movement state changes
    if (isCurrentlyMoving && !this.isMoving) {
      this.isMoving = true;
      if (this.onMoveStart) this.onMoveStart();
    } else if (!isCurrentlyMoving && this.isMoving) {
      this.isMoving = false;
      if (this.onMoveStop) this.onMoveStop();
    }
    
    // Apply movement
    if (isCurrentlyMoving && movement) {
      this.isRunning = this.isActionPressed('run');
      const speedMultiplier = this.isRunning ? this.runSpeedMultiplier : 1.0;
      
      movement.move(
        moveInput.x,
        moveInput.y,
        this.moveSpeed * speedMultiplier
      );
      
      this.lastMoveDirection = moveInput;
    }
    
    // Handle jump
    if (this.wasActionJustPressed('jump')) {
      if (movement && movement.jump) {
        movement.jump(this.jumpForce);
        if (this.onJump) this.onJump();
      } else if (physics) {
        physics.applyImpulse(0, -this.jumpForce);
        if (this.onJump) this.onJump();
      }
    }
    
    // Handle other actions
    if (this.wasActionJustPressed('interact')) {
      if (this.onInteract) this.onInteract();
    }
    
    if (this.wasActionJustPressed('attack')) {
      if (this.onAttack) this.onAttack();
    }
    
    // Reset mouse wheel
    this.inputState.mouse.wheel = 0;
  }

  /**
   * Get current input state
   * @returns {Object} - Current input state
   */
  getInputState() {
    return {
      ...this.inputState,
      movement: this.getMovementInput(),
      isMoving: this.isMoving,
      isRunning: this.isRunning,
      lastMoveDirection: this.lastMoveDirection
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      data: {
        keyBindings: this.keyBindings,
        moveSpeed: this.moveSpeed,
        runSpeedMultiplier: this.runSpeedMultiplier,
        jumpForce: this.jumpForce,
        sensitivity: this.sensitivity,
        enableKeyboard: this.enableKeyboard,
        enableMouse: this.enableMouse,
        enableGamepad: this.enableGamepad,
        isMoving: this.isMoving,
        isRunning: this.isRunning,
        lastMoveDirection: this.lastMoveDirection
      }
    };
  }
} 