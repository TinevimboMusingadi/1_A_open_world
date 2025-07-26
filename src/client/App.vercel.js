import React, { useState, useEffect, useCallback } from 'react';
import GameCanvas from './components/GameCanvas.js';
import ChatInterface from './components/ChatInterface.js';
import GameControls from './components/GameControls.js';
import StatsPanel from './components/StatsPanel.js';
import ConnectionStatus from './components/ConnectionStatus.js';
import { useApiClient } from './hooks/useApiClient.js';
import { usePollingGameState } from './hooks/usePollingGameState.js';

/**
 * Vercel-Compatible App Component - Uses API calls instead of Socket.IO
 */
function App() {
  // API client and polling-based game state management
  const { 
    connected, 
    loading,
    error: connectionError,
    sendLLMInstruction,
    startGame,
    stopGame,
    checkHealth
  } = useApiClient();
  
  const {
    gameState,
    gameStats,
    isGameRunning,
    isPolling,
    updateGameState,
    updateStats,
    refreshGameState
  } = usePollingGameState(2000); // Poll every 2 seconds

  // UI state
  const [activePanel, setActivePanel] = useState('chat'); // 'chat', 'stats', 'entities'
  const [showStats, setShowStats] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Initialize connection on mount
  useEffect(() => {
    checkHealth().catch(console.error);
  }, [checkHealth]);

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

  // Game control handlers
  const handleGameStart = useCallback(async () => {
    try {
      await startGame();
      await refreshGameState();
      addNotification({
        type: 'success',
        title: 'Game Started',
        message: 'Game engine is now running',
        icon: '🎮'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Start Failed',
        message: error.message,
        icon: '❌'
      });
    }
  }, [startGame, refreshGameState, addNotification]);

  const handleGameStop = useCallback(async () => {
    try {
      await stopGame();
      await refreshGameState();
      addNotification({
        type: 'info',
        title: 'Game Stopped',
        message: 'Game engine has been stopped',
        icon: '⏹️'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Stop Failed',
        message: error.message,
        icon: '❌'
      });
    }
  }, [stopGame, refreshGameState, addNotification]);

  const handleGameReset = useCallback(async () => {
    try {
      await stopGame();
      await startGame();
      await refreshGameState();
      addNotification({
        type: 'info',
        title: 'Game Reset',
        message: 'Game world has been reset to initial state',
        icon: '🔄'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Reset Failed',
        message: error.message,
        icon: '❌'
      });
    }
  }, [stopGame, startGame, refreshGameState, addNotification]);

  // Chat message handler
  const handleSendMessage = useCallback(async (message) => {
    if (message.trim()) {
      try {
        addNotification({
          type: 'info',
          title: 'Processing Request',
          message: `Working on: "${message}"`,
          icon: '🤖'
        });

        const result = await sendLLMInstruction(message, {
          gameState: gameState
        });

        addNotification({
          type: 'success',
          title: 'Modification Complete',
          message: `Successfully processed: "${message}"`,
          icon: '✅'
        });

        // Refresh game state after modification
        await refreshGameState();
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Modification Failed',
          message: error.message || 'Unknown error occurred',
          icon: '❌'
        });
      }
    }
  }, [sendLLMInstruction, gameState, refreshGameState, addNotification]);

  // Loading state
  if (!connected && !connectionError && loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-lg font-semibold mb-2">Connecting to Game Engine</h2>
          <p className="text-muted">Establishing API connection...</p>
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
          <p className="text-xs text-muted mb-4">Error: {connectionError}</p>
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
            🎮 Dynamic Game Engine <span className="text-xs text-cyan-300">(Vercel)</span>
          </h1>
          <ConnectionStatus 
            connected={connected}
            reconnecting={loading}
            error={connectionError}
          />
          {isPolling && (
            <div className="flex items-center gap-2 text-cyan-400">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              <span className="text-xs">Polling API</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <GameControls
            isRunning={isGameRunning}
            onStart={handleGameStart}
            onStop={handleGameStop}
            onReset={handleGameReset}
            disabled={loading}
          />
          
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowStats(!showStats)}
          >
            {showStats ? '📊' : '📈'} Stats
          </button>
          
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => refreshGameState()}
            disabled={loading}
          >
            🔄 Refresh
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
          
          {/* Bottom Panel Tabs */}
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
                <span>🎮 API-Based (No Socket.IO)</span>
                <span>💬 Type: "Add WASD movement to player"</span>
                <span>🔫 Then: "Add shooting with spacebar"</span>
              </div>
            </div>
            
            {/* Panel Content */}
            <div className="h-80">
              {activePanel === 'chat' && (
                <ChatInterface
                  onSendMessage={handleSendMessage}
                  connected={connected}
                  loading={loading}
                  className="h-full"
                />
              )}
              
              {activePanel === 'entities' && (
                <div className="h-full p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Game Entities</h3>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => refreshGameState()}
                      disabled={loading}
                    >
                      🔄 Refresh
                    </button>
                  </div>
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
              isPolling={isPolling}
              onRefresh={refreshGameState}
            />
          </div>
        )}
      </div>

      {/* Notifications */}
      <NotificationContainer notifications={notifications} />
    </div>
  );
}

// Entity Card Component (same as original)
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
              ({Math.round(Number(transform.position?.x) || 0)}, {Math.round(Number(transform.position?.y) || 0)})
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
              {String(render.shape || 'unknown')} {Number(render.width) || 0}x{Number(render.height) || 0}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Notification Container Component (same as original)
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

// Individual Notification Component (same as original)
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