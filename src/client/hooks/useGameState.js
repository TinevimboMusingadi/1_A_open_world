import { useState, useCallback } from 'react';

/**
 * Custom hook for managing game state
 */
export function useGameState() {
  const [gameState, setGameState] = useState({
    running: false,
    entities: [],
    timestamp: null
  });

  const [gameStats, setGameStats] = useState({
    game: null,
    llm: null,
    server: null
  });

  // Update game state from server
  const updateGameState = useCallback((newState) => {
    setGameState(prevState => ({
      ...prevState,
      ...newState,
      timestamp: Date.now()
    }));
  }, []);

  // Update statistics from server
  const updateStats = useCallback((newStats) => {
    setGameStats(newStats);
  }, []);

  // Computed values
  const isGameRunning = gameState.running;
  const entityCount = gameState.entities?.length || 0;
  const playerEntity = gameState.entities?.find(entity => 
    entity.tags.includes('player')
  );
  const enemyEntities = gameState.entities?.filter(entity => 
    entity.tags.includes('enemy')
  ) || [];
  const platformEntities = gameState.entities?.filter(entity => 
    entity.tags.includes('platform')
  ) || [];

  return {
    gameState,
    gameStats,
    isGameRunning,
    entityCount,
    playerEntity,
    enemyEntities,
    platformEntities,
    updateGameState,
    updateStats
  };
} 