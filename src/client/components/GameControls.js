import React from 'react';

/**
 * GameControls - Basic game control buttons
 */
function GameControls({ isRunning, onStart, onStop, onReset }) {
  return (
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
  );
}

export default GameControls; 