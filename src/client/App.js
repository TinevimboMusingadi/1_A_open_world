import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import GameCanvas from './components/GameCanvas.js';
import ChatInterface from './components/ChatInterface.js';
import GameControls from './components/GameControls.js';
import StatsPanel from './components/StatsPanel.js';
import ConnectionStatus from './components/ConnectionStatus.js';
import { useSocket } from './hooks/useSocket.js';
import { useGameState } from './hooks/useGameState.js';

/**
 * Main App Component - Orchestrates the entire game interface
 */
function App() {
  // Socket connection and game state management
  const { 
    socket, 
    connected, 
    connectionError,
    reconnecting 
  } = useSocket();
  
  const {
    gameState,
    gameStats,
    isGameRunning,
    updateGameState,
    updateStats
  } = useGameState();

  // UI state
  const [activePanel, setActivePanel] = useState('chat'); // 'chat', 'stats', 'entities'
  const [showStats, setShowStats] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Game state updates
    socket.on('game:update', updateGameState);
    socket.on('game:stats', updateStats);

    // Modification events
    socket.on('game:modification:start', handleModificationStart);
    socket.on('game:modification:complete', handleModificationComplete);
    socket.on('game:modification:error', handleModificationError);
    socket.on('game:safety:violation', handleSafetyViolation);

    // Error handling
    socket.on('game:error', handleGameError);

    return () => {
      socket.off('game:update');
      socket.off('game:stats');
      socket.off('game:modification:start');
      socket.off('game:modification:complete');
      socket.off('game:modification:error');
      socket.off('game:safety:violation');
      socket.off('game:error');
    };
  }, [socket, updateGameState, updateStats]);

  // Notification handlers
  const addNotification = useCallback((notification) => {
    const id = Date.now();
    const newNotification = { ...notification, id, timestamp: Date.now() };
    
    setNotifications(prev => [...prev, newNotification]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const handleModificationStart = useCallback((data) => {
    addNotification({
      type: 'info',
      title: 'Processing Request',
      message: `Working on: "${data.userRequest}"`,
      icon: '🤖'
    });
  }, [addNotification]);

  const handleModificationComplete = useCallback((data) => {
    addNotification({
      type: 'success',
      title: 'Modification Complete',
      message: `Successfully processed: "${data.result.userRequest}"`,
      icon: '✅'
    });
  }, [addNotification]);

  const handleModificationError = useCallback((data) => {
    addNotification({
      type: 'error',
      title: 'Modification Failed',
      message: data.error.error || 'Unknown error occurred',
      icon: '❌'
    });
  }, [addNotification]);

  const handleSafetyViolation = useCallback((data) => {
    addNotification({
      type: 'warning',
      title: 'Safety Violation',
      message: `Request blocked: ${data.violations.join(', ')}`,
      icon: '🛡️'
    });
  }, [addNotification]);

  const handleGameError = useCallback((data) => {
    addNotification({
      type: 'error',
      title: 'Game Error',
      message: data.error || 'Unknown error occurred',
      icon: '🚨'
    });
  }, [addNotification]);

  // Game control handlers
  const handleGameStart = useCallback(() => {
    if (socket) {
      socket.emit('game:start');
    }
  }, [socket]);

  const handleGameStop = useCallback(() => {
    if (socket) {
      socket.emit('game:stop');
    }
  }, [socket]);

  const handleGameReset = useCallback(() => {
    if (socket) {
      socket.emit('game:reset');
      addNotification({
        type: 'info',
        title: 'Game Reset',
        message: 'Game world has been reset to initial state',
        icon: '🔄'
      });
    }
  }, [socket, addNotification]);

  // Chat message handler
  const handleSendMessage = useCallback((message) => {
    if (socket && message.trim()) {
      socket.emit('game:modify', { request: message });
      
      addNotification({
        type: 'info',
        title: 'Request Sent',
        message: `Sent: "${message}"`,
        icon: '📤'
      });
    }
  }, [socket, addNotification]);

  // Loading state
  if (!connected && !connectionError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-lg font-semibold mb-2">Connecting to Game Engine</h2>
          <p className="text-muted">Establishing real-time connection...</p>
        </div>
      </div>
    );
  }

  // Connection error state
  if (connectionError && !connected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-6 card">
          <h2 className="text-lg font-semibold mb-2 text-error">Connection Failed</h2>
          <p className="text-muted mb-4">Unable to connect to the game server</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-bg-primary to-bg-secondary">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white border-opacity-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">
            🎮 Dynamic Game Engine
          </h1>
          <ConnectionStatus 
            connected={connected}
            reconnecting={reconnecting}
            error={connectionError}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <GameControls
            isRunning={isGameRunning}
            onStart={handleGameStart}
            onStop={handleGameStop}
            onReset={handleGameReset}
          />
          
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowStats(!showStats)}
          >
            {showStats ? '📊' : '📈'} Stats
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Game Canvas Area */}
        <div className="flex-1 flex flex-col">
          <GameCanvas 
            gameState={gameState}
            className="flex-1"
          />
          
          {/* Bottom Panel Tabs - Make Chat More Prominent */}
          <div className="border-t border-white border-opacity-10 bg-gradient-to-r from-blue-900 to-purple-900 bg-opacity-20">
            <div className="flex items-center justify-between px-4 py-1">
              <div className="flex">
                <button
                  className={`px-6 py-3 text-sm font-medium transition rounded-t-lg ${
                    activePanel === 'chat'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-muted hover:text-primary hover:bg-panel'
                  }`}
                  onClick={() => setActivePanel('chat')}
                >
                  💬 AI Chat - Modify Game Here!
                </button>
                <button
                  className={`px-4 py-3 text-sm font-medium transition rounded-t-lg ml-2 ${
                    activePanel === 'entities'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-muted hover:text-primary hover:bg-panel'
                  }`}
                  onClick={() => setActivePanel('entities')}
                >
                  🎯 Entities ({gameState.entities?.length || 0})
                </button>
              </div>
              
              {/* Quick Help */}
              <div className="text-xs text-cyan-300 flex items-center gap-4">
                <span>🎮 WASD: Move Camera</span>
                <span>🔫 Use AI Chat to add shooter controls!</span>
              </div>
            </div>
            
            {/* Panel Content */}
            <div className="h-80">
              {activePanel === 'chat' && (
                <ChatInterface
                  onSendMessage={handleSendMessage}
                  connected={connected}
                  className="h-full"
                />
              )}
              
              {activePanel === 'entities' && (
                <div className="h-full p-4 overflow-auto">
                  <h3 className="font-semibold mb-3">Game Entities</h3>
                  {gameState.entities?.length > 0 ? (
                    <div className="space-y-2">
                      {gameState.entities.map(entity => (
                        <EntityCard key={entity.id} entity={entity} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted text-center py-8">
                      No entities in the game world
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Sidebar */}
        {showStats && (
          <div className="w-80 border-l border-white border-opacity-10">
            <StatsPanel 
              gameStats={gameStats}
              gameState={gameState}
            />
          </div>
        )}
      </div>

      {/* Notifications */}
      <NotificationContainer notifications={notifications} />
    </div>
  );
}

// Entity Card Component
function EntityCard({ entity }) {
  const transform = entity.components?.TransformComponent?.data;
  const render = entity.components?.RenderComponent?.data;
  
  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <span className="font-mono">{entity.id}</span>
        <div className="flex gap-1">
          {entity.tags.map(tag => (
            <span key={tag} className="status status-info text-xs">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="panel-content text-sm">
        {transform && (
          <div className="mb-2">
            <span className="text-muted">Position:</span>{' '}
            <span className="font-mono">
              ({Math.round(transform.position?.x || 0)}, {Math.round(transform.position?.y || 0)})
            </span>
          </div>
        )}
        {render && (
          <div className="flex items-center gap-2">
            <span className="text-muted">Render:</span>
            <div 
              className="w-4 h-4 rounded border"
              style={{ backgroundColor: render.color || '#666' }}
            />
            <span className="font-mono text-xs">
              {render.shape} {render.width}x{render.height}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Notification Container Component
function NotificationContainer({ notifications }) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(notification => (
        <Notification key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

// Individual Notification Component
function Notification({ notification }) {
  const typeStyles = {
    success: 'border-green-500 bg-green-500 bg-opacity-10',
    error: 'border-red-500 bg-red-500 bg-opacity-10',
    warning: 'border-orange-500 bg-orange-500 bg-opacity-10',
    info: 'border-blue-500 bg-blue-500 bg-opacity-10'
  };

  return (
    <div className={`
      panel border-l-4 p-4 animate-slide-in
      ${typeStyles[notification.type] || typeStyles.info}
    `}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{notification.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{notification.title}</h4>
          <p className="text-xs text-muted mt-1 break-words">
            {notification.message}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App; 