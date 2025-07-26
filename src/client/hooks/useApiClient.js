import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for API-based communication (Vercel-compatible alternative to Socket.IO)
 */
export function useApiClient(baseUrl = null) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Determine API base URL
  const apiUrl = baseUrl || (
    process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3000'
  );

  // Generic API request function
  const apiRequest = useCallback(async (endpoint, options = {}) => {
    try {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      const response = await fetch(`${apiUrl}${endpoint}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setError(null);
      return data;
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        throw err;
      }
    }
  }, [apiUrl]);

  // Health check to test connection
  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest('/api/health');
      setConnected(result.status === 'ok');
      return result;
    } catch (err) {
      setConnected(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Get game state
  const getGameState = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest('/api/game/state');
      return result.state;
    } catch (err) {
      console.error('Failed to get game state:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Send LLM modification request
  const sendLLMInstruction = useCallback(async (instruction, context = {}) => {
    try {
      setLoading(true);
      const result = await apiRequest('/api/llm/modify', {
        method: 'POST',
        body: JSON.stringify({
          instruction,
          context
        })
      });
      return result.result;
    } catch (err) {
      console.error('Failed to send LLM instruction:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Start game (if API supports it)
  const startGame = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest('/api/game/start', {
        method: 'POST'
      });
      return result;
    } catch (err) {
      console.error('Failed to start game:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Stop game (if API supports it)
  const stopGame = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest('/api/game/stop', {
        method: 'POST'
      });
      return result;
    } catch (err) {
      console.error('Failed to stop game:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Send player input
  const sendPlayerInput = useCallback(async (input) => {
    try {
      const result = await apiRequest('/api/game/input', {
        method: 'POST',
        body: JSON.stringify(input)
      });
      return result;
    } catch (err) {
      console.error('Failed to send player input:', err);
      throw err;
    }
  }, [apiRequest]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    connected,
    loading,
    error,
    checkHealth,
    getGameState,
    sendLLMInstruction,
    startGame,
    stopGame,
    sendPlayerInput,
    cleanup,
    apiRequest // For custom API calls
  };
} 