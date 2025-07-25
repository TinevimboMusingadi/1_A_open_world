import React from 'react';

/**
 * GameControls - Basic game control buttons with gameplay instructions
 */
function GameControls({ isRunning, onStart, onStop, onReset }) {
  return (
    <div className="flex items-center gap-4">
      {/* Game Controls */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={onStop}
            className="btn btn-secondary btn-sm"
            title="Stop Game"
          >
            ⏸️ Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            className="btn btn-success btn-sm"
            title="Start Game"
          >
            ▶️ Start
          </button>
        )}
        
        <button
          onClick={onReset}
          className="btn btn-secondary btn-sm"
          title="Reset Game"
        >
          🔄 Reset
        </button>
      </div>

      {/* Gameplay Instructions */}
      <div className="text-xs text-muted border-l border-white border-opacity-20 pl-4">
        <div className="flex items-center gap-4">
          <span>🎮 <strong>Controls:</strong> WASD to move camera</span>
          <span>💬 <strong>AI Chat:</strong> Use bottom panel to modify game</span>
          <span>🎯 <strong>Try:</strong> "Make player faster" or "Add enemies"</span>
        </div>
      </div>
    </div>
  );
}

export default GameControls; 