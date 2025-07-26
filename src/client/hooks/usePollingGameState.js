import { useState, useEffect, useCallback, useRef } from 'react';
import { useApiClient } from './useApiClient';

/**
 * Custom hook for polling-based game state management (Vercel-compatible)
 */
export function usePollingGameState(pollingInterval = 1000) {
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

  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef(null);
  const { connected, getGameState, checkHealth } = useApiClient();

  // Start polling for game state updates
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current || !connected) return;

    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const newState = await getGameState();
        setGameState(prevState => ({
          ...prevState,
          ...newState,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error polling game state:', error);
        // Don't stop polling on error, just log it
      }
    }, pollingInterval);
  }, [connected, getGameState, pollingInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Toggle polling based on connection status
  useEffect(() => {
    if (connected && !isPolling) {
      startPolling();
    } else if (!connected && isPolling) {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [connected, isPolling, startPolling, stopPolling]);

  // Check health on mount
  useEffect(() => {
    checkHealth().catch(console.error);
  }, [checkHealth]);

  // Manual refresh function
  const refreshGameState = useCallback(async () => {
    try {
      const newState = await getGameState();
      setGameState(prevState => ({
        ...prevState,
        ...newState,
        timestamp: Date.now()
      }));
      return newState;
    } catch (error) {
      console.error('Error refreshing game state:', error);
      throw error;
    }
  }, [getGameState]);

  // Update game state manually (for immediate updates after actions)
  const updateGameState = useCallback((newState) => {
    setGameState(prevState => ({
      ...prevState,
      ...newState,
      timestamp: Date.now()
    }));
  }, []);

  // Update statistics
  const updateStats = useCallback((newStats) => {
    setGameStats(newStats);
  }, []);

  // Computed values
  const isGameRunning = gameState.running;
  const entityCount = gameState.entities?.length || 0;
  const playerEntity = gameState.entities?.find(entity => 
    entity.tags && entity.tags.includes('player')
  );
  const enemyEntities = gameState.entities?.filter(entity => 
    entity.tags && entity.tags.includes('enemy')
  ) || [];
  const platformEntities = gameState.entities?.filter(entity => 
    entity.tags && entity.tags.includes('platform')
  ) || [];

  return {
    gameState,
    gameStats,
    isGameRunning,
    entityCount,
    playerEntity,
    enemyEntities,
    platformEntities,
    isPolling,
    connected,
    updateGameState,
    updateStats,
    refreshGameState,
    startPolling,
    stopPolling
  };
} 