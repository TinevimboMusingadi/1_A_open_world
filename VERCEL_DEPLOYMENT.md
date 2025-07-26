# Vercel Deployment Guide

## ⚠️ Important Limitations

**Socket.IO Real-time Features**: This game engine originally uses Socket.IO for real-time multiplayer functionality. However, Vercel's serverless model has limitations for persistent WebSocket connections:

- Serverless functions are stateless
- No persistent connections between requests
- 10-second execution timeout (30s max with Pro plan)

## What Works on Vercel

✅ **Static Frontend**: React game interface
✅ **API Endpoints**: LLM processing, game state management
✅ **Game Engine**: Single-player or turn-based gameplay
❌ **Real-time Multiplayer**: Socket.IO connections won't persist

## Deployment Steps

### 1. Environment Variables

Set these in your Vercel dashboard:

```bash
GEMINI_API_KEY=your_gemini_api_key
NODE_ENV=production
CORS_ORIGIN=https://your-project-name.vercel.app
```

### 2. Domain Configuration

Update `api/index.js` line 17 with your actual Vercel domain:
```javascript
origin: process.env.NODE_ENV === 'production' 
  ? ['https://your-actual-domain.vercel.app'] 
  : ['http://localhost:8080', 'http://localhost:3000'],
```

### 3. Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Alternative Deployment Options

For full real-time multiplayer support, consider:

1. **Railway.app** - Supports persistent Node.js servers
2. **Render.com** - Good for WebSocket applications  
3. **DigitalOcean App Platform** - Supports long-running services
4. **Google Cloud Run** - Container-based deployment

## Modified Architecture

The Vercel version uses:
- **Frontend**: Same React interface
- **Backend**: Stateless API endpoints instead of persistent server
- **Game State**: Request-based instead of real-time updates
- **LLM Integration**: Works via API calls

## Code Changes for Vercel

### Using API Hooks Instead of Socket.IO

For Vercel deployment, replace Socket.IO hooks with API-based alternatives:

```javascript
// Original (Socket.IO - for local development)
import { useSocket } from './hooks/useSocket';
import { useGameState } from './hooks/useGameState';

// Vercel-compatible (API-based)
import { useApiClient } from './hooks/useApiClient';
import { usePollingGameState } from './hooks/usePollingGameState';

// In your component:
function GameComponent() {
  // For local development with Socket.IO
  // const { socket, connected } = useSocket();
  // const { gameState, updateGameState } = useGameState();

  // For Vercel deployment with API polling
  const { connected, sendLLMInstruction } = useApiClient();
  const { gameState, isPolling, refreshGameState } = usePollingGameState(2000); // Poll every 2 seconds

  // Rest of your component logic...
}
```

### Environment Detection

You can automatically switch between Socket.IO and API based on environment:

```javascript
const isVercelDeployment = process.env.VERCEL === '1' || 
                          window.location.hostname.includes('vercel.app');

const useGameInterface = isVercelDeployment ? 
  { useApiClient, usePollingGameState } : 
  { useSocket, useGameState };
```

## Testing Locally

### Vercel Development Environment
```bash
npm run vercel-dev
```

### Regular Development (with Socket.IO)
```bash
npm run dev:full
```

This starts Vercel's development environment locally. 