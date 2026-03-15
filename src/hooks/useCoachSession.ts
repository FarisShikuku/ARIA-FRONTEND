/**
 * useCoachSession.ts
 *
 * CHANGES vs previous version:
 *
 * 1. startSession() NOW CALLS aria.activate('coach') NOT aria.activate()
 *    WHY: aria.activate() with no argument sends 'start_intro' to the backend,
 *    which creates a session with mode=None and fires the home greeting:
 *    "Hi I am ARIA — I run on three modes: General Assistant, Navigation, Coach..."
 *    Wrong context entirely for the coach page.
 *    FIX: activate('coach') sends 'start_coach' — the backend closes any
 *    existing session, creates a fresh session with mode='coach' and sends
 *    only the coach greeting. Same fix pattern as navigation.
 *
 * 2. REMOVED: the start_coach_* sendText call inside startSession
 *    WHY: Previously activate() fired start_intro, THEN sendText sent
 *    start_coach_interview on top — two prompts, two voices.
 *    Now start_coach is the ONLY activation message. The sub-mode is
 *    sent as a follow-up update_context after activation — not as a
 *    second session trigger.
 *
 * 3. useMediaCapture NOW PASSES facingMode='user' (front camera)
 *    WHY: Previously hardcoded facingMode='environment' (rear camera).
 *    Coach page needs the front camera — user faces it for coaching.
 *    Navigation passes 'environment' explicitly.
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

    // FIX: activate('coach') not activate()
    // activate() → 'start_intro' → home greeting fires on coach page
    // activate('coach') → 'start_coach' → backend creates fresh coach session,
    // sends only the coach greeting, no home context bleeds in
    if (aria.introState !== 'active') {
      await aria.activate('coach');
    }

    // Send sub-mode as a follow-up context update — NOT as a second activation.
    // WHY: Previously sent start_coach_interview as a separate control message
    // which the backend treated as a second session trigger. That caused two
    // voices and double context. Now it's just a context shift on the existing
    // coach session — ARIA adjusts her persona for the specific coaching type.
    aria.sendText(JSON.stringify({
      type: 'control',
      action: 'update_context',
      context: {
        page_focus: 'coach',
        instruction: `You are now in ${session.mode} coaching mode. ` +
          COACH_SYSTEM_PROMPTS[session.mode],
      },
    }));

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
  }, [session.mode, aria, startCapture]);

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