/**
 * useAriaIntro.ts
 *
 * CHANGES vs previous version:
 *
 * 1. activate() NOW ACCEPTS AN OPTIONAL mode PARAMETER
 *    WHY: Previously activate() always sent sendControlMessage('start_intro')
 *    regardless of which page called it. When useNavigationSession called
 *    useAriaIntro() and then activate(), the backend received start_intro which
 *    created a session with mode=None (home) and triggered the home greeting:
 *    "Hi, I am ARIA — I run on three modes: General Assistant, Navigation, Coach..."
 *    Then 1ms later start_navigation arrived and queued on top of the same session.
 *    Result: two full speeches back-to-back — home intro then navigation intro.
 *    Proven in logs at 8:43:58.324 (start_intro) and 8:43:58.325 (start_navigation).
 *
 *    FIX: activate(mode?) accepts an optional mode string.
 *    - activate()              → sends 'start_intro'   (home page, unchanged)
 *    - activate('navigation')  → sends 'start_navigation' (nav page, no home intro)
 *    - activate('coach')       → sends 'start_coach'   (coach page, future use)
 *
 *    useNavigationSession calls activate('navigation') — the home greeting
 *    is never sent. The backend start_navigation handler creates a fresh
 *    Gemini session with mode='navigation' and sends only the nav greeting.
 *
 * 2. UseAriaIntroReturn INTERFACE UPDATED
 *    activate signature changed from () => Promise<void>
 *    to (mode?: string) => Promise<void>
 *    All existing callers (home page AriaIntroBar) pass no argument — unchanged.
 *
 * Everything else is identical to the previous version.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeminiLive, GeminiState } from './useGeminiLive';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntroState =
  | 'idle'
  | 'waiting'
  | 'ready_to_activate'
  | 'active'
  | 'muted'
  | 'paused'
  | 'stopped';

export interface UseAriaIntroReturn {
  introState: IntroState;
  geminiState: GeminiState;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  sessionId: string | null;
  // NEW — passed through from useGeminiLive for useNavigationSession
  sendBinary: (data: ArrayBuffer) => void;
  sendText: (text: string) => void;
  subscribeToMessages: (handler: (msg: any) => void) => () => void;
  activate: (mode?: string) => Promise<void>;  // FIX: mode param added — see file header
  stop: () => void;
  mute: () => void;
  unmute: () => void;
  pause: () => void;
  resume: () => void;
  enableVoice: () => void;
  disableVoice: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAriaIntro(): UseAriaIntroReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [introState, setIntroState] = useState<IntroState>('idle');

  const introFiredRef = useRef(false);
  const micStartedRef = useRef(false);

  const {
    state: geminiState,
    isSpeaking,
    isListening,
    transcript,
    sendControlMessage,
    sendBinary,             // NEW
    sendText,               // NEW
    subscribeToMessages,    // NEW
    startListening,
    stopListening,
  } = useGeminiLive({ sessionId, enabled: !!sessionId });

  // ── Step 1: Create backend session on mount ───────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_type: 'dashboard' }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setSessionId(data.session_id);
        setIntroState('waiting');
      } catch {
        // Non-blocking
      }
    }
    init();
  }, []);

  // ── Step 2: Watch for WS ready ────────────────────────────────────────────

  useEffect(() => {
    if (
      geminiState === 'ready' &&
      introState === 'waiting' &&
      !introFiredRef.current
    ) {
      setIntroState('ready_to_activate');
    }

    if (geminiState === 'error') {
      setIntroState('stopped');
    }
  }, [geminiState, introState]);

  // ── activate() ────────────────────────────────────────────────────────────

  // FIX: activate(mode?) — mode determines which control message is sent.
  // Home page:       activate()              → 'start_intro'
  // Navigation page: activate('navigation')  → 'start_navigation'
  // This prevents home intro from firing on navigation page.
  // Without this fix, activate() always sent 'start_intro' regardless of page,
  // causing the home greeting to play on navigation, then navigation greeting
  // stacked on top = two voices speaking simultaneously.
  const activate = useCallback(async (mode?: string) => {
    if (introFiredRef.current) return;
    if (geminiState !== 'ready' && introState !== 'ready_to_activate') return;

    introFiredRef.current = true;

    if (!micStartedRef.current) {
      micStartedRef.current = true;
      try {
        await startListening();
      } catch (err) {
        console.error('[useAriaIntro] Mic failed to start:', err);
      }
    }

    // FIX: route to the correct backend action based on mode.
    // 'navigation' → start_navigation (creates fresh nav session, nav greeting only)
    // 'coach'      → start_coach      (creates fresh coach session, coach greeting only)
    // undefined    → start_intro      (home page, existing behaviour unchanged)
    if (mode === 'navigation') {
      sendControlMessage('start_navigation', { mode: 'navigation' });
    } else if (mode === 'coach') {
      sendControlMessage('start_coach', { mode: 'coach' });
    } else {
      sendControlMessage('start_intro');
    }

    setIntroState('active');
  }, [geminiState, introState, sendControlMessage, startListening]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    sendControlMessage('stop_intro');
    stopListening();
    setIntroState('stopped');
    introFiredRef.current = false;
    micStartedRef.current = false;
  }, [sendControlMessage, stopListening]);

  const mute = useCallback(() => {
    stopListening();
    setIntroState('muted');
  }, [stopListening]);

  const unmute = useCallback(() => {
    startListening().catch(console.error);
    setIntroState('active');
  }, [startListening]);

  const pause = mute;
  const resume = unmute;

  const enableVoice = useCallback(() => {
    startListening().catch(console.error);
  }, [startListening]);

  const disableVoice = stopListening;

  return {
    introState,
    geminiState,
    isSpeaking,
    isListening,
    transcript,
    sessionId,
    sendBinary,             // NEW
    sendText,               // NEW
    subscribeToMessages,    // NEW
    activate,
    stop,
    mute,
    unmute,
    pause,
    resume,
    enableVoice,
    disableVoice,
  };
}