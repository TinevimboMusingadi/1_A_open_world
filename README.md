# Dynamic Game Engine with LLM Integration Called open World.

A research project that creates a dynamic game engine using LLMs to modify gameplay in real-time based on natural language descriptions.

## 🎮 Concept


This project enables users to:
- Start with a default 2D platformer game world
- Describe changes they want in natural language ("make gravity work backwards", "add flying enemies")
- Watch as an LLM generates code to modify the game in real-time
- Experience dynamic gameplay that evolves based on their descriptions

## 🏗️ Architecture

### Core Components

1. **Game Engine** (`src/engine/`)
   - Entity-Component-System architecture
   - 2D physics simulation using Matter.js
   - Canvas-based rendering

2. **LLM Integration** (`src/llm/`)
   - Google Gemini 2.5 Flash integration
   - Context engineering for game modifications
   - Code generation and validation

3. **Code Execution** (`src/execution/`)
   - Sandboxed code execution using VM2
   - Security constraints and resource limits
   - Safe API exposure to generated code

4. **Web Interface** (`src/client/`)
   - HTML5 Canvas game rendering
   - Real-time chat interface for modifications
   - Socket.io for live updates

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Google AI API key

### Installation
```bash
npm install
```

### Environment Setup
Create a `.env` file:
```
GOOGLE_AI_API_KEY=your_api_key_here
PORT=3000
```

### Development
```bash
npm run dev        # Start development server
npm test           # Run tests
npm run test:watch # Run tests in watch mode
```

### Production
```bash
npm run build      # Build for production
npm start          # Start production server
```

## 🧪 Testing

The project includes comprehensive testing:
- Unit tests for game engine components
- Integration tests for LLM code generation
- Security tests for code execution sandbox
- End-to-end tests for user interactions

```bash
npm test           # Run all tests
npm run test:coverage  # Generate coverage report
```

## 📁 Project Structure

```
src/
├── engine/         # Core game engine
│   ├── entities/   # Entity definitions
│   ├── components/ # ECS components
│   ├── systems/    # Game systems
│   └── physics/    # Physics integration
├── llm/           # LLM integration
│   ├── context/   # Context engineering
│   ├── generation/ # Code generation
│   └── validation/ # Code validation
├── execution/     # Code execution sandbox
├── api/          # Game API for LLM-generated code
├── server/       # Express server
├── client/       # Frontend application
└── __tests__/    # Test files
```

## 🔧 Development Phases

### Phase 1: Foundation ✅
- [x] Project setup and dependencies
- [x] Basic Entity-Component-System
- [x] 2D physics integration
- [x] Testing infrastructure

### Phase 2: LLM Integration
- [ ] Google Gemini API integration
- [ ] Context engineering system
- [ ] Code generation pipeline
- [ ] Security sandbox

### Phase 3: User Interface
- [ ] Web interface with game canvas
- [ ] Real-time chat system
- [ ] User experience enhancements

## 🛡️ Security

This project implements multiple security layers:
- VM2 sandboxing for code execution
- Resource limits (CPU, memory, time)
- API whitelisting for safe game modifications
- Input validation and sanitization
- Rate limiting for API calls

## 🎯 Example Usage

```
User: "Make all enemies move twice as fast"
LLM generates: game.entities.filter(e => e.hasComponent('Enemy')).forEach(e => e.speed *= 2)
Result: All enemy entities now move at double speed
```

