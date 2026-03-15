/**
 * useCoachSession.ts
 *
 * CHANGES vs previous version:
 *
 * 1. ARIA ACTIVATES ON PAGE OPEN, NOT ON startSession()
 *    WHY: Previously activate('coach') was called inside startSession(), which
 *    only fires when the user clicks "Start Session" after picking a mode.
 *    Logs show the user sat on the page for 26 seconds with zero voice activity.
 *    FIX: activate('coach') is now called automatically when introState becomes
 *    'ready_to_activate' — same pattern as navigate/page.tsx. ARIA greets the
 *    user immediately on page open: "Coach mode ready. Tell me what you are
 *    practising today." startSession() no longer calls activate() at all.
 *
 * 2. update_context REMOVED FROM startSession()
 *    WHY: Logs prove this caused the double voice.
 *    At 6:34:30.483 coach greeting was sent. At 6:34:30.483 update_context also
 *    fired — same millisecond. Gemini received the context update while still
 *    generating the greeting, treated it as a new user turn, and repeated the
 *    entire greeting a second time (Turn 1: 41 responses, Turn 2: 39 responses —
 *    identical speech twice). The update_context is removed entirely.
 *    The coach system prompt addendum already exists in gemini_service.py's
 *    _ARIA_COACH_ADDENDUM — no separate context injection needed.
 *
 * 3. facingMode='user' (front camera default) — unchanged from previous fix
 *
 * Everything else is identical.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAriaIntro } from './useAriaIntro';
import { useAgentState, AgentState } from './useAgentState';
import { useMediaCapture } from './useMediaCapture';
import type {
  CoachMode,
  CoachSessionState,
  CoachMetrics,
  HintEvent,
  CoachSessionPhase,
} from '@/lib/types/coach.types';
import { DEFAULT_METRICS } from '@/lib/types/coach.types';

// ── Coach mode system prompts ─────────────────────────────────────────────────

const COACH_SYSTEM_PROMPTS: Record<CoachMode, string> = {
  interview: `You are ARIA in Coach Mode for an interview session. Your role is to help the user ace their interview.
Monitor their speaking pace (target 120-140 WPM), detect filler words (um, uh, like, you know), 
observe eye contact and confidence posture. Give whisper-style hints at exactly the right moment — 
never interrupt a strong answer. Say things like "Slow down", "Great answer — pause before next", 
"Make eye contact", "You're using 'um' a lot — take a breath". 
If the user asks about navigation, tell them: "Navigation mode is available — you can switch to it from the navbar. 
I'm here to focus on your interview right now. Ready to continue?"`,

  presentation: `You are ARIA in Coach Mode for a presentation. Help the user deliver a compelling, clear, high-energy presentation.
Focus on: pacing, vocal variety, pausing for emphasis, energy levels, and slide transition cues.
Give hints like "Add more energy here", "Great pause — let that point land", "Speed up — you're losing momentum".
If the user asks about navigation: "Navigation mode is one tap away in the navbar — I'm your presentation coach right now. Let's keep going!"`,

  music: `You are ARIA in Coach Mode for a music performance. Help the singer or musician with their stage presence and delivery.
Focus on: breathing technique, performance energy, engagement with the audience, mic technique, stage confidence.
Give hints like "Project more", "Great breath support", "Connect with the audience — look up", "Hold that note with confidence".
If the user asks about navigation: "Navigation is available in the navbar — I'm focused on your performance right now. You're doing great!"`,

  mc: `You are ARIA in Coach Mode for MC / public speaking. Help the user command the room with confidence and charisma.
Focus on: crowd energy, transition phrases, humor timing, voice projection, pacing between segments.
Give hints like "Pick up the energy", "Great crowd moment", "Slow down on the announcement", "Project to the back of the room".
If the user asks about navigation: "Navigation is a tap away in the navbar — right now I'm your MC coach. The crowd is yours!"`,

  sermon: `You are ARIA in Coach Mode for a sermon or ministry delivery. Help the speaker deliver a powerful, moving message.
Focus on: passion and conviction in delivery, pausing for reflection moments, connecting emotionally, clarity of key points.
Give hints like "Let that scripture breathe — pause", "Great conviction here", "Bring your volume up — project faith", "Slow down on the key message".
If the user asks about navigation: "Navigation mode is available in the navbar — I'm here to support your message delivery right now. Carry on."`,

  negotiation: `You are ARIA in Coach Mode for a negotiation. Help the user negotiate with confidence, clarity, and strategic calm.
Focus on: confident tone (not aggressive), strategic pauses, clear value statements, listening cues, managing emotional tone.
Give hints like "Pause — let them respond", "Strong position — hold it", "Lower your pace — you sound rushed", "Great anchor — now be silent".
If the user asks about navigation: "Navigation mode is just a tap away in the navbar — I'm helping you win this negotiation right now."`,
};

// ── Mode intro messages ───────────────────────────────────────────────────────

const MODE_INTROS: Record<CoachMode, string> = {
  interview: "start_coach_interview",
  presentation: "start_coach_presentation",
  music: "start_coach_music",
  mc: "start_coach_mc",
  sermon: "start_coach_sermon",
  negotiation: "start_coach_negotiation",
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseCoachSessionReturn {
  // Session state
  session: CoachSessionState;

  // Agent
  agentState: AgentState;
  urgencyScore: number;

  // Media
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCapturing: boolean;

  // AI
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;

  // Actions
  selectMode: (mode: CoachMode) => void;
  startSession: () => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  flipCamera: (facing: 'user' | 'environment') => void;  // NEW
  switchToNavigation: () => void;
}

export function useCoachSession(): UseCoachSessionReturn {
  const [session, setSession] = useState<CoachSessionState>({
    phase: 'idle',
    mode: null,
    sessionId: null,
    startTime: null,
    elapsedSeconds: 0,
    metrics: { ...DEFAULT_METRICS },
    events: [],
    isMuted: false,
    isCameraOn: false,
    isMicOn: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventIdRef = useRef(0);

  // ── Aria intro (Gemini Live session) ─────────────────────────────────────
  const aria = useAriaIntro();

  // ── Agent state driven by WS messages ────────────────────────────────────
  const [lastWsMessage, setLastWsMessage] = useState<any>(null);

  // ── Camera facing mode state ──────────────────────────────────────────────
  // Default 'user' (front camera). User can flip via the button in VideoFeed.
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    if (!aria.subscribeToMessages) return;
    const unsub = aria.subscribeToMessages((msg) => {
      setLastWsMessage(msg);
      handleWsMessage(msg);
    });
    return unsub;
  }, [aria.subscribeToMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  const { currentState: agentState, urgencyScore, transitionTo } = useAgentState({
    wsMessage: lastWsMessage,
    mode: 'coach',
    isSpeaking: aria.isSpeaking,
  });

  // ── Media capture — front camera for coach (user faces it) ──────────────
  const { videoRef, isCapturing, startCapture, stopCapture } = useMediaCapture({
    sendFrame: aria.sendBinary,
    enabled: session.isCameraOn && session.phase === 'active',
    facingMode,  // dynamic — changes when user taps flip button
  });

  // ── Auto-activate on page open ────────────────────────────────────────────
  // FIX 1: Activate ARIA as soon as the WS is ready — not waiting for mode select.
  // WHY: Previously aria.activate('coach') was only called inside startSession()
  // which fires only when user clicks "Start Session". Logs show 26s of silence
  // before any voice activity because the user was still on the mode selector.
  // Now ARIA greets immediately: "Coach mode ready. Tell me what you're practising."
  const activatedRef = useRef(false);
  useEffect(() => {
    if (aria.introState === 'ready_to_activate' && !activatedRef.current) {
      activatedRef.current = true;
      aria.activate('coach');
    }
  }, [aria.introState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle WS messages from backend ──────────────────────────────────────
  const handleWsMessage = useCallback((msg: any) => {
    if (!msg?.type) return;

    if (msg.type === 'coach_metrics') {
      setSession(prev => ({
        ...prev,
        metrics: { ...prev.metrics, ...msg.metrics },
      }));
    }

    if (msg.type === 'coach_hint') {
      const newEvent: HintEvent = {
        id: `evt_${++eventIdRef.current}`,
        time: formatElapsed(Date.now()),
        message: msg.hint,
        type: `${msg.category} · ${msg.hint_type}`,
        color: msg.hint_type === 'good' ? 'green' : msg.hint_type === 'warn' ? 'amber' : 'cyan',
        hintType: msg.hint_type,
        timestamp: msg.timestamp ?? Date.now(),
      };
      setSession(prev => ({
        ...prev,
        events: [newEvent, ...prev.events].slice(0, 50), // keep last 50
      }));
    }

    if (msg.type === 'mode_switch_request') {
      // Backend is telling us user asked to switch modes
      if (msg.target_mode === 'navigation') {
        switchToNavigation();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (session.phase === 'active') {
      timerRef.current = setInterval(() => {
        setSession(prev => ({
          ...prev,
          elapsedSeconds: prev.startTime
            ? Math.floor((Date.now() - prev.startTime) / 1000)
            : prev.elapsedSeconds + 1,
        }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session.phase]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectMode = useCallback((mode: CoachMode) => {
    setSession(prev => ({ ...prev, mode, phase: 'ready' }));
  }, []);

  const startSession = useCallback(async () => {
    if (!session.mode) return;

    // FIX 1: Do NOT call activate() here anymore.
    // activate('coach') is now called automatically on page open via the
    // ready_to_activate useEffect above. By the time the user picks a mode
    // and clicks Start Session, ARIA is already active and speaking.
    // Calling activate() again here would create a second session.

    // FIX 2: Do NOT send update_context here.
    // Logs proved (6:34:30.483) that sending update_context at the same moment
    // the coach greeting was being generated caused Gemini to repeat the entire
    // greeting a second time — two identical speeches back-to-back.
    // The coach system prompt in gemini_service.py (_ARIA_COACH_ADDENDUM) already
    // contains all coaching constraints. No additional context injection needed.

    // Start front camera
    await startCapture();

    setSession(prev => ({
      ...prev,
      phase: 'active',
      startTime: Date.now(),
      sessionId: aria.sessionId,
      isMicOn: true,
      isCameraOn: true,
    }));
  }, [session.mode, aria.sessionId, startCapture]);

  const pauseSession = useCallback(() => {
    aria.pause();
    setSession(prev => ({ ...prev, phase: 'paused' }));
  }, [aria]);

  const resumeSession = useCallback(() => {
    aria.resume();
    setSession(prev => ({ ...prev, phase: 'active' }));
  }, [aria]);

  const endSession = useCallback(() => {
    aria.stop();
    stopCapture();
    if (timerRef.current) clearInterval(timerRef.current);
    setSession(prev => ({ ...prev, phase: 'ended' }));
  }, [aria, stopCapture]);

  const toggleMute = useCallback(() => {
    if (session.isMuted) {
      aria.unmute();
    } else {
      aria.mute();
    }
    setSession(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, [session.isMuted, aria]);

  const toggleCamera = useCallback(() => {
    if (session.isCameraOn) {
      stopCapture();
    } else {
      startCapture();
    }
    setSession(prev => ({ ...prev, isCameraOn: !prev.isCameraOn }));
  }, [session.isCameraOn, startCapture, stopCapture]);

  const toggleMic = useCallback(() => {
    if (session.isMicOn) {
      aria.disableVoice();
    } else {
      aria.enableVoice();
    }
    setSession(prev => ({ ...prev, isMicOn: !prev.isMicOn }));
  }, [session.isMicOn, aria]);

  const switchToNavigation = useCallback(() => {
    aria.sendText(JSON.stringify({
      type: 'control',
      action: 'mode_switch',
      target_mode: 'navigation',
    }));
    if (typeof window !== 'undefined') {
      window.location.href = '/navigate?autostart=true';
    }
  }, [aria]);

  // FIX: flipCamera — updates facingMode state which triggers useMediaCapture
  // to restart the stream with the new camera via the facingMode useEffect
  const flipCamera = useCallback((facing: 'user' | 'environment') => {
    setFacingMode(facing);
  }, []);

  return {
    session,
    agentState,
    urgencyScore,
    videoRef,
    isCapturing,
    isSpeaking: aria.isSpeaking,
    isListening: aria.isListening,
    transcript: aria.transcript,
    selectMode,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    toggleMute,
    toggleCamera,
    toggleMic,
    flipCamera,
    switchToNavigation,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(timestamp: number): string {
  const d = new Date(timestamp);
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function formatSessionTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}