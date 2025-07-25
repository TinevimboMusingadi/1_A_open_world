import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

/**
 * Custom hook for managing Socket.io connection
 */
export function useSocket(url = null) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    // Determine socket URL
    const socketUrl = url || (
      process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:3000'
    );

    console.log('Connecting to socket server:', socketUrl);

    // Create socket connection
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setSocket(newSocket);
      setConnected(true);
      setConnectionError(null);
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
      
      // Only show error for unexpected disconnections
      if (reason !== 'io client disconnect') {
        setConnectionError(`Disconnected: ${reason}`);
        handleReconnection();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionError(`Connection failed: ${error.message}`);
      setConnected(false);
      handleReconnection();
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnection attempt', attemptNumber);
      setReconnecting(true);
      reconnectAttemptsRef.current = attemptNumber;
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      setConnectionError(`Reconnection failed: ${error.message}`);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      setConnectionError('Reconnection failed after maximum attempts');
      setReconnecting(false);
    });

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.close();
    };
  }, [url]);

  // Handle manual reconnection with backoff
  const handleReconnection = () => {
    if (reconnectTimeoutRef.current) return; // Already trying to reconnect

    const maxAttempts = 5;
    const baseDelay = 1000;
    
    if (reconnectAttemptsRef.current >= maxAttempts) {
      setConnectionError('Maximum reconnection attempts reached');
      return;
    }

    const delay = baseDelay * Math.pow(2, reconnectAttemptsRef.current);
    setReconnecting(true);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      reconnectTimeoutRef.current = null;
      
      if (socket && !socket.connected) {
        socket.connect();
      }
    }, delay);
  };

  // Manual disconnect
  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    }
  };

  // Send ping to test connection
  const ping = () => {
    return new Promise((resolve) => {
      if (socket && connected) {
        const startTime = Date.now();
        socket.emit('ping', () => {
          const latency = Date.now() - startTime;
          resolve(latency);
        });
      } else {
        resolve(null);
      }
    });
  };

  return {
    socket,
    connected,
    connectionError,
    reconnecting,
    reconnectAttempts: reconnectAttemptsRef.current,
    disconnect,
    ping
  };
} 