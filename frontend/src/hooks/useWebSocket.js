import { useState, useEffect, useCallback, useRef } from 'react';

const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL = 30000;

export function useWebSocket(url) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('tg_token');
    if (!token) {
      console.log('[WS] No auth token, skipping connection');
      return;
    }

    try {
      setConnectionState('connecting');
      const wsUrl = `${url}?token=${token}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;

        // Start heartbeat
        heartbeatRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'pong') {
            setLastMessage(data);
          }
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WS] Error:', error);
        setConnectionState('error');
      };

      wsRef.current.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');

        // Clear heartbeat
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }

        // Attempt reconnection
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`[WS] Reconnecting... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_INTERVAL);
        } else {
          setConnectionState('failed');
          console.log('[WS] Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('[WS] Connection error:', error);
      setConnectionState('error');
    }
  }, [url]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    setIsConnected(false);
    setConnectionState('disconnected');
  }, []);

  // Send message
  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Send location update
  const sendLocationUpdate = useCallback((latitude, longitude, accuracy) => {
    return sendMessage({
      type: 'location_update',
      data: { latitude, longitude, accuracy, timestamp: Date.now() }
    });
  }, [sendMessage]);

  // Send SOS trigger
  const sendSOSTrigger = useCallback((incidentId) => {
    return sendMessage({
      type: 'sos_trigger',
      data: { incident_id: incidentId, timestamp: Date.now() }
    });
  }, [sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionState,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    sendLocationUpdate,
    sendSOSTrigger
  };
}

// Hook for subscribing to specific message types
export function useWebSocketSubscription(ws, messageType, callback) {
  useEffect(() => {
    if (!ws.lastMessage) return;
    
    if (ws.lastMessage.type === messageType) {
      callback(ws.lastMessage.data);
    }
  }, [ws.lastMessage, messageType, callback]);
}

export default useWebSocket;
