import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { LLMService } from '../src/llm/LLMService.js';
import { GameEngine } from '../src/engine/GameEngine.js';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.vercel.app'] // Replace with your actual domain
    : ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Initialize game engine and LLM service
const gameEngine = new GameEngine();
const llmService = new LLMService(gameEngine);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

app.post('/api/llm/modify', async (req, res) => {
  try {
    const { instruction, context } = req.body;
    
    if (!instruction) {
      return res.status(400).json({ error: 'Instruction is required' });
    }

    const result = await llmService.processInstruction(instruction, context);
    
    res.json({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('LLM modification error:', error);
    res.status(500).json({ 
      error: 'Failed to process LLM instruction',
      message: error.message 
    });
  }
});

app.get('/api/game/state', (req, res) => {
  try {
    const state = gameEngine.getGameState();
    res.json({
      success: true,
      state: state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Game state error:', error);
    res.status(500).json({ 
      error: 'Failed to get game state',
      message: error.message 
    });
  }
});

app.post('/api/game/start', (req, res) => {
  try {
    gameEngine.start();
    const state = gameEngine.getGameState();
    res.json({
      success: true,
      message: 'Game started',
      state: state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Game start error:', error);
    res.status(500).json({ 
      error: 'Failed to start game',
      message: error.message 
    });
  }
});

app.post('/api/game/stop', (req, res) => {
  try {
    gameEngine.stop();
    const state = gameEngine.getGameState();
    res.json({
      success: true,
      message: 'Game stopped',
      state: state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Game stop error:', error);
    res.status(500).json({ 
      error: 'Failed to stop game',
      message: error.message 
    });
  }
});

app.post('/api/game/input', (req, res) => {
  try {
    const input = req.body;
    // Process player input through game engine
    // This would depend on your game engine's input handling
    gameEngine.processInput(input);
    const state = gameEngine.getGameState();
    
    res.json({
      success: true,
      message: 'Input processed',
      state: state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Game input error:', error);
    res.status(500).json({ 
      error: 'Failed to process input',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

export default app; 