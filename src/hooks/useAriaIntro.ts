/**
 * useAriaIntro.ts — REWRITTEN
 *
 * WHAT CHANGED AND WHY:
 *
 * 1. ARIA IS NOW A PERSISTENT LIVE AGENT (was: intro-gated)
 *    Old: Mic only started AFTER intro audio finished. If intro never played
 *         or got stuck, the mic never started → user could never be heard.
 *    New: As soon as the WebSocket is 'ready', mic streaming starts immediately.
 *         ARIA listens from the first moment. The intro greeting is just the
 *         first thing ARIA says — it doesn't gate anything.
 *
 * 2. MIC STARTS ON 'ready', NOT AFTER INTRO (was: only after isSpeaking→false)
 *    Old: startListening() was only called inside the isSpeaking transition effect.
 *         If intro audio never arrived (network issue, Gemini delay), mic never started.
 *    New: startListening() is called as soon as geminiState === 'ready'.
 *         ARIA can hear you even while she's speaking her greeting (barge-in works).
 *
 * 3. ECHO CANCELLATION IS HANDLED BY THE BROWSER + WORKLET (not by us gating mic)
 *    The browser's echoCancellation:true in getUserMedia already handles this.
 *    We no longer need to block the mic during speech — that was over-engineering
 *    that silenced user interruptions.
 *
 * 4. INTRO IS JUST A TEXT PROMPT, NOT A STATE MACHINE GATE
 *    The intro prompt is sent once. After that, Gemini is in a conversational loop.
 *    User can ask any question at any time — that's the whole point of the agent.
 *
 * 5. SIMPLIFIED STATE: idle → waiting → active | muted | stopped
 *    Removed 'speaking' and 'interrupted' as intro-specific states — those are
 *    handled by useGeminiLive's isSpeaking flag. introState only tracks whether
 *    the agent session is running, muted, or stopped.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGeminiLive, GeminiState } from './useGeminiLive';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntroState =
  | 'idle'       // No session yet
  | 'waiting'    // Session created, connecting to WebSocket
  | 'active'     // Agent live — mic streaming, ARIA listening + responding
  | 'muted'      // User muted — session open but mic stopped
  | 'paused'     // User paused — mic stopped, resumable
  | 'stopped';   // Session ended

export interface UseAriaIntroReturn {
  introState: IntroState;
  geminiState: GeminiState;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  sessionId: string | null;
  stop: () => void;
  mute: () => void;
  unmute: () => void;
  // Legacy aliases — keep for component compatibility
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

  const introFiredRef = useRef(false);    // ensure intro prompt sent exactly once
  const micStartedRef = useRef(false);    // ensure mic started exactly once

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
        // Non-blocking — page still works without session
      }
    }
    init();
  }, []);

  // ── Step 2: As soon as WS is ready → start mic + send greeting ───────────
  //
  // WHY start mic immediately (not after intro):
  //   ARIA's intro is the first response in a live conversation. The user
  //   should be able to interrupt it ("wait, what does navigation mode do?")
  //   from the very first second. Gating mic on intro completion meant users
  //   had to sit silently through the intro before they could interact.
  //
  // WHY send intro prompt here and not elsewhere:
  //   gemini_service.py creates the session but sends no initial message.
  //   We need to send a text prompt to kick off ARIA's greeting. After that,
  //   Gemini is in its realtime input loop and responds to mic audio directly.
  useEffect(() => {
    if (
      geminiState === 'ready' &&
      introState === 'waiting' &&
      !introFiredRef.current
    ) {
      introFiredRef.current = true;

      // Send greeting prompt — Gemini will respond with audio immediately
      sendControlMessage('start_intro');

      // Start mic streaming right away — user can interrupt from second 1
      if (!micStartedRef.current) {
        micStartedRef.current = true;
        startListening().catch((err) => {
          console.error('[useAriaIntro] Mic failed to start:', err);
        });
      }

      setIntroState('active');
    }

    if (geminiState === 'error') {
      setIntroState('stopped');
    }
  }, [geminiState, introState, sendControlMessage, startListening]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    sendControlMessage('stop_intro');
    stopListening();
    setIntroState('stopped');
    introFiredRef.current = false;
    micStartedRef.current = false;
  }, [sendControlMessage, stopListening]);

  /**
   * mute — stop mic audio, keep Gemini session open.
   * User can unmute and the conversation continues with full context.
   */
  const mute = useCallback(() => {
    stopListening();
    setIntroState('muted');
  }, [stopListening]);

  /**
   * unmute — resume mic streaming instantly (no session reconnect needed).
   */
  const unmute = useCallback(() => {
    startListening().catch(console.error);
    setIntroState('active');
  }, [startListening]);

  // Legacy aliases for component compatibility
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
    stop,
    mute,
    unmute,
    pause,
    resume,
    enableVoice,
    disableVoice,
  };
}