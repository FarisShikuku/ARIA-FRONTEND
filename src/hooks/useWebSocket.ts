import { useEffect, useState, useCallback, useRef } from 'react';

interface WebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enabled?: boolean;
}

interface WebSocketReturn {
  isConnected: boolean;
  lastMessage: any;
  latency: number;
  sendMessage: (data: any) => void;
  sendAudioChunk: (audioData: ArrayBuffer) => void;
  error: Error | null;
}

export function useWebSocket(options: WebSocketOptions = {}): WebSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.aria.com/ws',
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    enabled = true
  } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [latency, setLatency] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    
    try {
      // Check if WebSocket is supported
      if (typeof WebSocket === 'undefined') {
        setError(new Error('WebSocket not supported in this environment'));
        return;
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Start ping-pong latency measurement
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const pingTime = Date.now();
            ws.send(JSON.stringify({ type: 'ping', timestamp: pingTime }));
          }
        }, 5000);
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        // Only attempt reconnect if enabled and within limits
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        // Don't log the error object directly as it may contain circular references
        setError(new Error('WebSocket connection failed'));
        // Silent fail - don't console.error
      };

      ws.onmessage = (event) => {
        try {
          // Try to parse as JSON first
          const data = JSON.parse(event.data);
          
          // Handle pong response for latency
          if (data.type === 'pong') {
            setLatency(Date.now() - data.timestamp);
          } else {
            setLastMessage(data);
          }
        } catch {
          // Handle binary data or non-JSON messages
          setLastMessage(event.data);
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('WebSocket connection failed'));
    }
  }, [url, reconnectInterval, maxReconnectAttempts, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
    // Silently fail if not connected - no warning
  }, []);

  const sendAudioChunk = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData);
    }
    // Silently fail if not connected
  }, []);

  return { 
    isConnected, 
    lastMessage, 
    latency, 
    sendMessage, 
    sendAudioChunk,
    error
  };
}