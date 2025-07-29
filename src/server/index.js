import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { GameEngine } from '../engine/GameEngine.js';
import { LLMService } from '../llm/LLMService.js';
import { MovementSystem } from '../engine/systems/MovementSystem.js';
import { ShooterSystem } from '../engine/systems/ShooterSystem.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main Server Class - Orchestrates web server, game engine, and LLM service
 */
class GameServer {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 3000;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Initialize Express app
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIO(this.server, {
      cors: {
        origin: this.isDevelopment ? "*" : false,
        methods: ["GET", "POST"]
      }
    });

    // Initialize game engine and LLM service
    this.gameEngine = new GameEngine();
    this.llmService = new LLMService(this.gameEngine, {
      onModificationStart: this.handleModificationStart.bind(this),
      onModificationComplete: this.handleModificationComplete.bind(this),
      onModificationError: this.handleModificationError.bind(this),
      onSafetyViolation: this.handleSafetyViolation.bind(this)
    });

    // Connected clients
    this.connectedClients = new Map();
    this.gameState = {
      running: false,
      lastUpdate: Date.now(),
      entities: [],
      stats: {}
    };

    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupGameEngine();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: this.isDevelopment ? false : undefined
    }));

    // CORS
    this.app.use(cors({
      origin: this.isDevelopment ? "*" : false
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.isDevelopment ? 1000 : 100, // limit each IP
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Static files
    this.app.use(express.static(path.join(__dirname, '../client/dist')));

    // Logging
    if (this.isDevelopment) {
      this.app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
      });
    }
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        gameRunning: this.gameEngine.running,
        connectedClients: this.connectedClients.size,
        llmStats: this.llmService.getStats()
      });
    });

    // Game state
    this.app.get('/api/game/state', (req, res) => {
      res.json({
        running: this.gameEngine.running,
        entities: this.getSerializableEntities(),
        stats: this.gameEngine.getPerformanceStats(),
        llmStats: this.llmService.getStats()
      });
    });

    // Manual game modifications (REST API)
    this.app.post('/api/game/modify', async (req, res) => {
      try {
        const { request, clientId } = req.body;
        
        if (!request || typeof request !== 'string') {
          return res.status(400).json({ error: 'Request must be a non-empty string' });
        }

        const result = await this.llmService.processModificationRequest(request);
        
        // Broadcast to all clients
        this.broadcastGameUpdate();
        
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: error.message,
          type: 'modification_error'
        });
      }
    });

    // LLM service stats
    this.app.get('/api/llm/stats', (req, res) => {
      res.json(this.llmService.getStats());
    });

    // LLM history
    this.app.get('/api/llm/history', (req, res) => {
      const limit = parseInt(req.query.limit) || 10;
      res.json(this.llmService.getHistory(limit));
    });

    // Game controls
    this.app.post('/api/game/start', (req, res) => {
      this.gameEngine.start();
      this.broadcastGameUpdate();
      res.json({ status: 'started' });
    });

    this.app.post('/api/game/stop', (req, res) => {
      this.gameEngine.stop();
      this.broadcastGameUpdate();
      res.json({ status: 'stopped' });
    });

    this.app.post('/api/game/reset', (req, res) => {
      this.resetGame();
      res.json({ status: 'reset' });
    });

    // Serve React app for all other routes
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
  }

  /**
   * Setup Socket.io event handlers
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      console.log(`Client connected: ${clientId}`);

      // Store client info
      this.connectedClients.set(clientId, {
        id: clientId,
        socket: socket,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      });

      // Send initial game state
      socket.emit('game:state', {
        running: this.gameEngine.running,
        entities: this.getSerializableEntities(),
        stats: this.gameEngine.getPerformanceStats()
      });

      // Handle modification requests
      socket.on('game:modify', async (data) => {
        try {
          const { request } = data;
          
          if (!request || typeof request !== 'string') {
            socket.emit('game:error', { error: 'Request must be a non-empty string' });
            return;
          }

          // Update client activity
          const client = this.connectedClients.get(clientId);
          if (client) {
            client.lastActivity = Date.now();
          }

          // Process modification
          const result = await this.llmService.processModificationRequest(request);
          
          // Send result to requesting client
          socket.emit('game:modification:result', result);
          
          // Broadcast updated game state to all clients
          this.broadcastGameUpdate();

        } catch (error) {
          socket.emit('game:error', {
            error: error.message,
            type: 'modification_error'
          });
        }
      });

      // Handle game control requests
      socket.on('game:start', () => {
        this.gameEngine.start();
        this.broadcastGameUpdate();
      });

      socket.on('game:stop', () => {
        this.gameEngine.stop();
        this.broadcastGameUpdate();
      });

      socket.on('game:reset', () => {
        this.resetGame();
      });

      // Handle ping for connection monitoring
      socket.on('ping', (callback) => {
        callback('pong');
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.connectedClients.delete(clientId);
      });
    });
  }

  /**
   * Setup and configure game engine
   */
  setupGameEngine() {
    // Add core systems
    this.gameEngine.addSystem(new MovementSystem());
    
    // Enable ShooterSystem for full gameplay
    this.gameEngine.addSystem(new ShooterSystem());
    console.log('🎮 Full game systems loaded - Movement & Shooting ready!');

    // Start game loop
    this.gameEngine.initialize();
    
    // Create some demo entities
    this.createDemoWorld();

    // Setup periodic updates
    this.setupPeriodicUpdates();
  }

  /**
   * Create demo world with initial entities
   */
  createDemoWorld() {
    // Import components dynamically to avoid circular dependencies
    import('../engine/components/TransformComponent.js').then(({ TransformComponent }) => {
      import('../engine/components/RenderComponent.js').then(({ RenderComponent }) => {
        import('../engine/components/MovementComponent.js').then(({ MovementComponent }) => {
          import('../engine/components/PlayerControllerComponent.js').then(({ PlayerControllerComponent }) => {
            import('../engine/components/ShooterControllerComponent.js').then(({ ShooterControllerComponent }) => {
          
              // Create Space Invaders style player with default controls
              const player = this.gameEngine.createEntity('player');
              player.addComponent(new TransformComponent(400, 550)); // Bottom center
              player.addComponent(new RenderComponent({
                color: '#00FF00', // Classic green player ship
                width: 40,
                height: 20,
                shape: 'rectangle'
              }));
              player.addComponent(new MovementComponent({ 
                maxSpeed: 300,
                friction: 0.1 // Space-like movement
              }));
              
              // Add default WASD controls
              player.addComponent(new PlayerControllerComponent({
                moveSpeed: 1.0,
                keyBindings: {
                  moveLeft: ['KeyA', 'ArrowLeft'],
                  moveRight: ['KeyD', 'ArrowRight'],
                  moveUp: ['KeyW', 'ArrowUp'],
                  moveDown: ['KeyS', 'ArrowDown']
                }
              }));
              
              // Add default spacebar shooting
              player.addComponent(new ShooterControllerComponent({
                fireRate: 200, // Fast shooting for Space Invaders feel
                bulletSpeed: 500,
                shootKeys: ['Space'],
                autoFire: false,
                shootDirection: { x: 0, y: -1 }, // Shoot upward
                bulletOffset: { x: 0, y: -25 }
              }));
              
              player.addTag('player');

              // Create Space Invaders enemy formation (5x3 grid)
              for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 5; col++) {
                  const enemy = this.gameEngine.createEntity(`enemy-${row}-${col}`);
                  enemy.addComponent(new TransformComponent(
                    150 + col * 80, // Spaced horizontally 
                    100 + row * 60  // Stacked vertically
                  ));
                  
                  // Different enemy types by row (like classic Space Invaders)
                  const enemyTypes = [
                    { color: '#FF0040', points: 30 }, // Top row: Red (hardest)
                    { color: '#FFA500', points: 20 }, // Middle row: Orange  
                    { color: '#FFFF00', points: 10 }  // Bottom row: Yellow (easiest)
                  ];
                  
                  const enemyType = enemyTypes[row];
                  enemy.addComponent(new RenderComponent({
                    color: enemyType.color,
                    width: 30,
                    height: 20,
                    shape: 'rectangle'
                  }));
                  
                  enemy.addComponent(new MovementComponent({ 
                    maxSpeed: 100
                  }));
                  enemy.addTag('enemy');
                  
                  // Add side-to-side movement (classic Space Invaders pattern)
                  const movement = enemy.getComponent('MovementComponent');
                  movement.setVelocity(50, 0); // Move right initially
                }
              }

              // Add some barriers/shields (classic Space Invaders feature)
              for (let i = 0; i < 4; i++) {
                const barrier = this.gameEngine.createEntity(`barrier-${i}`);
                barrier.addComponent(new TransformComponent(
                  100 + i * 200, // Spaced across bottom
                  450             // Above player
                ));
                barrier.addComponent(new RenderComponent({
                  color: '#00FF00',
                  width: 60,
                  height: 40,
                  shape: 'rectangle'
                }));
                barrier.addTag('barrier');
              }

              console.log('🎮 Space Invaders game world created!');
              console.log('🎮 Use WASD to move, SPACEBAR to shoot!');
              
            });
          });
        });
      });
    });
  }

  /**
   * Create basic demo world (fallback if shooter components fail)
   */
  createBasicDemoWorld(TransformComponent, RenderComponent, MovementComponent) {
    // Create a basic player
    const player = this.gameEngine.createEntity('player');
    player.addComponent(new TransformComponent(100, 100));
    player.addComponent(new RenderComponent({
      color: '#4A90E2',
      width: 32,
      height: 32,
      shape: 'rectangle'
    }));
    player.addComponent(new MovementComponent({ maxSpeed: 200 }));
    player.addTag('player');

    // Create one enemy
    const enemy = this.gameEngine.createEntity('enemy');
    enemy.addComponent(new TransformComponent(300, 200));
    enemy.addComponent(new RenderComponent({
      color: '#E74C3C',
      width: 24,
      height: 24,
      shape: 'circle'
    }));
    enemy.addTag('enemy');

    console.log('Basic demo world created - use AI chat to add shooter mechanics!');
  }

  /**
   * Setup periodic game state updates
   */
  setupPeriodicUpdates() {
    // Send game state updates every 100ms (10 FPS)
    setInterval(() => {
      if (this.gameEngine.running && this.connectedClients.size > 0) {
        this.broadcastGameUpdate();
      }
    }, 100);

    // Send performance stats every 5 seconds
    setInterval(() => {
      if (this.connectedClients.size > 0) {
        this.broadcastPerformanceStats();
      }
    }, 5000);
  }

  /**
   * Broadcast game state update to all connected clients
   */
  broadcastGameUpdate() {
    const gameState = {
      running: this.gameEngine.running,
      entities: this.getSerializableEntities(),
      timestamp: Date.now()
    };

    this.io.emit('game:update', gameState);
  }

  /**
   * Broadcast performance statistics
   */
  broadcastPerformanceStats() {
    const stats = {
      game: this.gameEngine.getPerformanceStats(),
      llm: this.llmService.getStats(),
      server: {
        connectedClients: this.connectedClients.size,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    };

    this.io.emit('game:stats', stats);
  }

  /**
   * Get entities in serializable format for client
   */
  getSerializableEntities() {
    const entities = this.gameEngine.entityManager.getAllEntities();
    return entities.map(entity => ({
      id: entity.id,
      active: entity.active,
      tags: Array.from(entity.tags),
      components: this.getSerializableComponents(entity)
    }));
  }

  /**
   * Get components in serializable format
   */
  getSerializableComponents(entity) {
    const components = {};
    
    for (const [type, component] of entity.components) {
      components[type] = {
        enabled: component.enabled,
        data: this.getComponentData(component, type)
      };
    }
    
    return components;
  }

  /**
   * Extract safe component data for client
   */
  getComponentData(component, type) {
    switch (type) {
      case 'TransformComponent':
        return {
          position: component.position,
          rotation: component.rotation,
          scale: component.scale
        };
      
      case 'RenderComponent':
        return {
          visible: component.visible,
          color: component.color,
          shape: component.shape,
          width: component.width,
          height: component.height,
          opacity: component.opacity
        };
      
      case 'MovementComponent':
        return {
          velocity: component.velocity,
          maxSpeed: component.maxSpeed,
          canMove: component.canMove
        };
      
      default:
        // Return basic properties for unknown components
        const data = {};
        for (const key in component) {
          if (component.hasOwnProperty(key) && 
              key !== 'entity' && 
              typeof component[key] !== 'function' &&
              !key.startsWith('_')) {
            data[key] = component[key];
          }
        }
        return data;
    }
  }

  /**
   * Reset game to initial state
   */
  resetGame() {
    this.gameEngine.stop();
    
    // Clear all entities
    const entities = this.gameEngine.entityManager.getAllEntities();
    entities.forEach(entity => {
      this.gameEngine.destroyEntity(entity.id);
    });

    // Recreate demo world
    setTimeout(() => {
      this.createDemoWorld();
      this.broadcastGameUpdate();
    }, 100);
  }

  // LLM Service event handlers
  handleModificationStart(requestId, userRequest) {
    this.io.emit('game:modification:start', {
      requestId,
      userRequest,
      timestamp: Date.now()
    });
  }

  handleModificationComplete(requestId, result) {
    this.io.emit('game:modification:complete', {
      requestId,
      result,
      timestamp: Date.now()
    });
    
    // Broadcast updated game state
    this.broadcastGameUpdate();
  }

  handleModificationError(requestId, error) {
    this.io.emit('game:modification:error', {
      requestId,
      error,
      timestamp: Date.now()
    });
  }

  handleSafetyViolation(violations, code, userRequest) {
    this.io.emit('game:safety:violation', {
      violations,
      userRequest,
      timestamp: Date.now()
    });
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Start game engine
      this.gameEngine.start();
      
      // Start HTTP server
      this.server.listen(this.port, () => {
        console.log(`🚀 Game Server running on port ${this.port}`);
        console.log(`🎮 Game Engine: ${this.gameEngine.running ? 'Running' : 'Stopped'}`);
        console.log(`🤖 LLM Service: Ready`);
        console.log(`🌐 Web Interface: http://localhost:${this.port}`);
        
        if (this.isDevelopment) {
          console.log('🔧 Development mode - CORS enabled for all origins');
        }
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down server...');
    
    // Stop game engine
    this.gameEngine.stop();
    
    // Close socket connections
    this.io.close();
    
    // Close HTTP server
    this.server.close(() => {
      console.log('Server shutdown complete');
      process.exit(0);
    });
  }
}

// Create and start server
const server = new GameServer();

// Handle graceful shutdown
process.on('SIGTERM', () => server.shutdown());
process.on('SIGINT', () => server.shutdown());

// Start server
server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 