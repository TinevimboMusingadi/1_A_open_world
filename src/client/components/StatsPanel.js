import React from 'react';

function StatsPanel({ gameStats, gameState }) {
  const game = gameStats?.game;
  const llm = gameStats?.llm;
  const server = gameStats?.server;

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <h2 className="font-semibold text-lg">📊 Statistics</h2>

      {/* Game Engine Stats */}
      <div className="panel">
        <div className="panel-header">
          🎮 Game Engine
        </div>
        <div className="panel-content space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={gameState?.running ? 'text-success' : 'text-muted'}>
              {gameState?.running ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Entities:</span>
            <span>{gameState?.entities?.length || 0}</span>
          </div>
          {game && (
            <>
              <div className="flex justify-between">
                <span>FPS:</span>
                <span>{Math.round(game.fps || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frame Time:</span>
                <span>{(game.frameTime || 0).toFixed(1)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Systems:</span>
                <span>{game.systemStats?.activeSystems || 0}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* LLM Stats */}
      <div className="panel">
        <div className="panel-header">
          🤖 AI Assistant
        </div>
        <div className="panel-content space-y-2 text-sm">
          {llm ? (
            <>
              <div className="flex justify-between">
                <span>Requests:</span>
                <span>{typeof llm.totalRequests === 'number' ? llm.totalRequests : (llm.totalRequests || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Success Rate:</span>
                <span className="text-success">
                  {typeof llm.successRate === 'number' ? llm.successRate.toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tokens Used:</span>
                <span>{typeof llm.totalTokensUsed === 'number' ? llm.totalTokensUsed : (llm.totalTokensUsed || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Response:</span>
                <span>{typeof llm.averageResponseTime === 'number' ? llm.averageResponseTime.toFixed(0) : (llm.averageResponseTime || 0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Safety Blocks:</span>
                <span className={llm.safetyViolations > 0 ? 'text-warning' : 'text-muted'}>
                  {typeof llm.safetyViolations === 'number' ? llm.safetyViolations : (llm.safetyViolations || 0)}
                </span>
              </div>
            </>
          ) : (
            <div className="text-muted">No data available</div>
          )}
        </div>
      </div>

      {/* Server Stats */}
      <div className="panel">
        <div className="panel-header">
          🖥️ Server
        </div>
        <div className="panel-content space-y-2 text-sm">
          {server ? (
            <>
              <div className="flex justify-between">
                <span>Connected:</span>
                <span>{server.connectedClients || 0} clients</span>
              </div>
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span>{formatUptime(server.uptime || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Memory:</span>
                <span>{formatMemory(server.memory?.heapUsed || 0)}</span>
              </div>
            </>
          ) : (
            <div className="text-muted">No data available</div>
          )}
        </div>
      </div>

      {/* Entity Breakdown */}
      {gameState?.entities && gameState.entities.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            🎯 Entities
          </div>
          <div className="panel-content space-y-2 text-sm">
            {getEntityStats(gameState.entities).map(({ tag, count, color }) => (
              <div key={tag} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded border"
                    style={{ backgroundColor: color }}
                  />
                  <span className="capitalize">{tag}</span>
                </div>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatMemory(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}

function getEntityStats(entities) {
  const tagCounts = {};
  const tagColors = {
    player: '#4A90E2',
    enemy: '#E74C3C',
    platform: '#8B4513',
    collectible: '#F5A623',
    default: '#ffffff'
  };

  entities.forEach(entity => {
    entity.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return Object.entries(tagCounts).map(([tag, count]) => ({
    tag,
    count,
    color: tagColors[tag] || tagColors.default
  }));
}

export default StatsPanel; 