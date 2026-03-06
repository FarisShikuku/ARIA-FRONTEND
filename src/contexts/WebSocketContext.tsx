'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: any;
  latency: number;
  sendMessage: (message: any) => void;
  sendAudioChunk: (audioData: ArrayBuffer) => void;
  error: Error | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    // Return fallback instead of throwing error
    return {
      isConnected: false,
      lastMessage: null,
      latency: 0,
      sendMessage: () => {},
      sendAudioChunk: () => {},
      error: null
    };
  }
  return context;
};

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const sessionId = user?.uid || 'anonymous';

  // Only enable WebSocket if we have a session ID and are in browser environment
  const enabled = typeof window !== 'undefined' && 
                !window.location.hostname.includes('vercel.app') && 
                !!sessionId;

  const { isConnected, lastMessage, latency, sendMessage, sendAudioChunk, error } = useWebSocket({
    enabled,
    url: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.aria.com/ws'
  });

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        lastMessage,
        latency,
        sendMessage,
        sendAudioChunk,
        error
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
