'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: any;
  latency: number;
  sendMessage: (message: any) => void;
  sendAudioChunk: (audioData: ArrayBuffer) => void;
  sessionId: string | null;
  error: Error | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  lastMessage: null,
  latency: 0,
  sendMessage: () => {},
  sendAudioChunk: () => {},
  sessionId: null,
  error: null,
});

export const useWebSocketContext = (): WebSocketContextType =>
  useContext(WebSocketContext);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<Error | null>(null);
  const startedRef = useRef(false); // prevent double-call in React Strict Mode

  // ── 1. Start a backend session on mount ───────────────────────────────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const startSession = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ||
          'https://aria-backend-1075490776634.us-central1.run.app';

        const res = await fetch(`${apiUrl}/api/v1/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_type: 'dashboard' }),
        });

        if (!res.ok) {
          throw new Error(`Session start failed: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.session_id) {
          throw new Error('Session start response missing session_id');
        }

        setSessionId(data.session_id);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to start session');
        console.error('[WebSocketContext] session start error:', e.message);
        setSessionError(e);
      }
    };

    startSession();
  }, []);

  // ── 2. Connect WebSocket once we have a sessionId ─────────────────────────
  // No token needed — backend accepts anonymous connections.
  const ws = useWebSocket({
    sessionId: sessionId ?? undefined,
    enabled: !!sessionId,
  });

  // ── 3. Merge session error with any WS error ──────────────────────────────
  const error = sessionError ?? ws.error;

  return (
    <WebSocketContext.Provider
      value={{
        ...ws,
        sessionId,
        error,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};