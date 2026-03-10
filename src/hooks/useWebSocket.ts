import { useEffect, useState, useCallback, useRef } from 'react';

interface WebSocketOptions {
  sessionId?: string;              // session ID from /api/v1/sessions/start
  token?: string;                  // optional auth token (omit for anonymous)
  baseUrl?: string;                // base wss:// URL — defaults to NEXT_PUBLIC_WS_URL
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
    sessionId,
    token,
    baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://aria-backend-1075490776634.us-central1.run.app',
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    enabled = true,
  } = options;

  // Build the full WS URL only when we have a sessionId.
  // Token is appended as a query param when provided (optional — backend accepts anonymous).
  const url = sessionId
    ? `${baseUrl}/ws/${sessionId}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : null;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [latency, setLatency] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Don't connect without a sessionId or if disabled
    if (!enabled || !url) return;

    // Avoid double-connecting
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
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

        // Ping-pong latency measurement every 5 s
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const pingTime = Date.now();
            ws.send(JSON.stringify({ type: 'ping', timestamp: pingTime }));
          }
        }, 5000);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Reconnect unless we exceeded the limit or were cleanly closed (1000)
        if (
          enabled &&
          event.code !== 1000 &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = () => {
        setError(new Error('WebSocket connection failed'));
      };

      ws.onmessage = (event) => {
        // Binary frames (audio from Gemini) — pass straight through
        if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
          setLastMessage(event.data);
          return;
        }

        try {
          const data = JSON.parse(event.data as string);

          // Handle pong for latency measurement
          if (data.type === 'pong' && typeof data.timestamp === 'number') {
            setLatency(Date.now() - data.timestamp);
          } else {
            setLastMessage(data);
          }
        } catch {
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
      // Clean up on unmount or when url/enabled changes
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        typeof data === 'string' ? data : JSON.stringify(data)
      );
    }
  }, []);

  const sendAudioChunk = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Prefix with 10-byte "audio" header to match backend binary protocol
      const header = new Uint8Array(10);
      const encoder = new TextEncoder();
      const headerBytes = encoder.encode('audio');
      header.set(headerBytes);

      const frame = new Uint8Array(10 + audioData.byteLength);
      frame.set(header, 0);
      frame.set(new Uint8Array(audioData), 10);

      wsRef.current.send(frame.buffer);
    }
  }, []);

  return {
    isConnected,
    lastMessage,
    latency,
    sendMessage,
    sendAudioChunk,
    error,
  };
}