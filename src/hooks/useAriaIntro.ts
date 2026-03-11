/**
 * useAriaIntro.ts — MODIFIED
 *
 * WHAT CHANGED vs previous version and WHY:
 *
 * 1. REMOVED AUTO-START OF MIC ON geminiState === 'ready' [CRITICAL BUG FIX]
 *    Old: The effect that watched geminiState called startListening() automatically
 *         the moment the WebSocket connected and became 'ready'. This happened on
 *         page load with no user gesture → new AudioContext() inside startListening()
 *         was blocked by the browser's autoplay policy → "AudioContext not allowed
 *         to start" error → no mic, no audio playback.
 *    New: The geminiState effect no longer calls startListening() or sendControlMessage.
 *         It only advances introState to 'ready_to_activate' so the UI knows it can
 *         show the start button. Nothing audio-related happens until activate().
 *
 * 2. ADDED activate() — THE SINGLE USER GESTURE ENTRY POINT [NEW]
 *    activate() must be called from a button's onClick handler (or equivalent
 *    user gesture). It does three things in order:
 *      a) Sends the intro prompt to Gemini (text — no audio context needed)
 *      b) Calls startListening() which creates BOTH AudioContexts (capture + playback)
 *         within the user gesture call stack — browser allows this
 *      c) Sets introState to 'active'
 *    This is the ONLY place startListening() is called. All other paths (unmute,
 *    resume) also originate from user interaction so they were already fine.
 *
 * 3. NEW introState VALUE: 'ready_to_activate'
 *    Sits between 'waiting' and 'active'. Means: WebSocket is connected and Gemini
 *    is ready, but the user hasn't clicked start yet. The UI should show its
 *    "Talk to ARIA" / start button when introState === 'ready_to_activate'.
 *    Components that only checked for 'active' are unaffected.
 *
 * 4. activate() IS IDEMPOTENT
 *    introFiredRef and micStartedRef guards remain. Double-clicking the start
 *    button won't create two sessions or two mic streams.
 *
 * UNCHANGED:
 *   - Session creation on mount (no audio — fine before user gesture)
 *   - WebSocket connection (no audio — fine before user gesture)
 *   - stop(), mute(), unmute(), pause(), resume() logic
 *   - All return values except: introState gains 'ready_to_activate',
 *     and activate() is added to the return object
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeminiLive, GeminiState } from './useGeminiLive';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntroState =
  | 'idle'               // No session yet
  | 'waiting'            // Session created, connecting to WebSocket
  | 'ready_to_activate'  // NEW: WS connected, waiting for user gesture to start audio
  | 'active'             // Agent live — mic streaming, ARIA listening + responding
  | 'muted'              // User muted — session open but mic stopped
  | 'paused'             // User paused — mic stopped, resumable
  | 'stopped';           // Session ended

export interface UseAriaIntroReturn {
  introState: IntroState;
  geminiState: GeminiState;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  sessionId: string | null;
  activate: () => Promise<void>;  // NEW: call from onClick — starts mic + intro
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
    startListening,
    stopListening,
  } = useGeminiLive({ sessionId, enabled: !!sessionId });

  // ── Step 1: Create backend session on mount ───────────────────────────────
  // No audio here — safe before user gesture.
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

  // ── Step 2: Watch for WS ready → advance to 'ready_to_activate' ──────────
  //
  // CHANGE: This effect no longer calls startListening() or sendControlMessage.
  // It only advances introState so the UI can show the start button.
  // Audio starts only when the user clicks that button → activate().
  useEffect(() => {
    if (
      geminiState === 'ready' &&
      introState === 'waiting' &&
      !introFiredRef.current
    ) {
      // WS is live — tell the UI it can show the start button.
      // Do NOT start mic or send any audio-related commands here.
      setIntroState('ready_to_activate');
    }

    if (geminiState === 'error') {
      setIntroState('stopped');
    }
  }, [geminiState, introState]);

  // ── activate() — MUST be called from a user gesture (onClick) ────────────
  //
  // This is the single entry point for all audio. By the time this runs,
  // the browser has a trusted user interaction on the call stack, so:
  //   • getUserMedia() will be granted without a permission prompt (after first allow)
  //   • new AudioContext() inside startListening() will be allowed
  //   • audioPlayer.initContext() inside startListening() will be allowed
  const activate = useCallback(async () => {
    // Guard: only fire once, and only when WS is ready
    if (introFiredRef.current) return;
    if (geminiState !== 'ready' && introState !== 'ready_to_activate') return;

    introFiredRef.current = true;

    // ── CHANGE: startListening BEFORE sendControlMessage ───────────────────
    // Old order: sendControlMessage('start_intro') → startListening()
    // Problem: backend got start_intro, created Gemini session, Gemini sent
    // the greeting audio in ~300ms — before getUserMedia resolved (~100-500ms).
    // playPCM16 fired with no AudioContext yet → warning + silent playback.
    //
    // New order: startListening() first → initContext() runs synchronously
    // at its top (before any await) → AudioContext exists immediately →
    // then sendControlMessage → Gemini audio arrives safely into ready context.
    if (!micStartedRef.current) {
      micStartedRef.current = true;
      try {
        await startListening();
      } catch (err) {
        console.error('[useAriaIntro] Mic failed to start:', err);
        // Don't block — session is still live for text/transcript
      }
    }

    // Send greeting now — AudioContext is ready to receive the response
    sendControlMessage('start_intro');

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