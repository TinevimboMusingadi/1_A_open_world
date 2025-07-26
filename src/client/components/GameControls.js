import React from 'react';

/**
 * GameControls - Basic game control buttons with gameplay instructions
 */
function GameControls({ isRunning, onStart, onStop, onReset, disabled = false }) {
  return (
    <div className="flex items-center gap-4">
      {/* Game Controls */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={onStop}
            disabled={disabled}
            className="btn btn-secondary btn-sm"
            title="Stop Game"
          >
            ⏸️ Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={disabled}
            className="btn btn-success btn-sm"
            title="Start Game"
          >
            ▶️ Start
          </button>
        )}
        
        <button
          onClick={onReset}
          disabled={disabled}
          className="btn btn-secondary btn-sm"
          title="Reset Game"
        >
          🔄 Reset
        </button>
      </div>

      {/* Gameplay Instructions */}
      <div className="text-xs text-muted border-l border-white border-opacity-20 pl-4">
        <div className="flex items-center gap-4">
          <span>🎮 <strong>No Controls Yet:</strong> Use AI Chat to add movement/shooting</span>
          <span>💬 <strong>Try:</strong> "Add WASD movement to player"</span>
          <span>🔫 <strong>Then:</strong> "Add shooting with spacebar"</span>
        </div>
      </div>
    </div>
  );
}

export default GameControls; 