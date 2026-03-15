'use client';

/**
 * src/hooks/useAssistSession.ts
 *
 * CHANGES vs previous version:
 *
 * 1. facingMode STATE DRIVES useMediaCapture — rear camera by default
 *    WHY: Previously useMediaCapture was called with no facingMode so it
 *    defaulted to 'user' (front camera) — wrong for Assist which points the
 *    camera at a physical task. Now facingMode state defaults to 'environment'
 *    and is passed directly into useMediaCapture. When it changes, useMediaCapture
 *    restarts the stream automatically via its own facingMode useEffect.
 *
 * 2. flipCamera REWRITTEN — no more manual getUserMedia call
 *    WHY: The old flipCamera manually called navigator.mediaDevices.getUserMedia
 *    and then called startCapture() on top of it, resulting in two concurrent
 *    streams and a double-capture bug. The fix is simple: just update cameraFacing
 *    state → useMediaCapture sees the new facingMode prop → restarts stream cleanly.
 *
 * 3. REMOVED redundant camera detection useEffect
 *    WHY: useMediaCapture now detects and returns hasMultipleCameras itself
 *    (probed after getUserMedia permission is granted when labels are available).
 *    The manual enumerateDevices() call in the old useEffect was running before
 *    permission was granted, so device labels were hidden and the count was
 *    unreliable. Now we rely on useMediaCapture's detection instead.
 *
 * 4. hasMultipleCameras now comes from useMediaCapture (not local state)
 *
 * Everything else (session state, transcript parsing, task steps, timer,
 * screenshot, export) is unchanged.
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { useAriaContext } from '@/contexts/AriaContext';
import { useMediaCapture } from '@/hooks/useMediaCapture';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssistSessionPhase =
  | 'idle'        // page just loaded, nothing started yet
  | 'listening'   // ARIA on, video on, camera context sent, waiting for task pick
  | 'active'      // task selected — shortcuts hidden, ARIA focused on task
  | 'paused'      // manually paused
  | 'ended';      // session ended — show restart button

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'aria';
  text: string;
  timestamp: number;
}

export interface TaskStep {
  id: string;
  text: string;
  done: boolean;
}

export interface TimelineEvent {
  id: string;
  text: string;
  timestamp: number;
  type: 'info' | 'step' | 'warn' | 'good';
}

export interface AssistSessionState {
  phase: AssistSessionPhase;
  taskTitle: string;
  transcript: TranscriptEntry[];
  steps: TaskStep[];
  timeline: TimelineEvent[];
  sessionNotes: string;
  isMuted: boolean;
  isCameraOn: boolean;
  cameraFacing: 'environment' | 'user';
  hasMultipleCameras: boolean;
  sessionDuration: number;
  screenshotDataUrl: string | null;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const ASSIST_SYSTEM_PROMPT = `
You are ARIA in Assist Mode — a live, visual AI assistant helping the user with any real-world task.
The user is sharing their camera so you can see what they're working on.

YOUR ROLE:
- Watch what the user is doing and proactively help them
- When you understand the task (from what you see or hear), suggest a concise title for it (say "Task: [title]" so I can extract it)
- Break complex tasks into clear numbered steps when helpful — say "Steps:" followed by numbered lines
- Give encouraging, practical, short guidance — this is a live voice assistant, not a chatbot
- If you see a problem or a better way to do something, say so naturally
- Celebrate progress: "Great, that's done — next step is..."

TASK TYPES you may assist with:
Cooking, Cleaning, Home repair, Homework/assignments, Design work,
Learning something new, Using a device or tool, Organizing/arranging,
Crafts and DIY, Exercise, Shopping decisions, Writing, and anything else.

VOICE RULES:
- Keep responses to 1–3 sentences unless the user asks for more
- Never use markdown formatting — speak in natural sentences
- You can see the camera — describe what you observe if relevant
- Say "Task: [short title]" early when you understand what's happening
- Say "Steps:" followed by numbered steps when giving a breakdown
`.trim();

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAssistSession() {
  const [phase, setPhase]               = useState<AssistSessionPhase>('idle');
  const [taskTitle, setTaskTitle]       = useState('');
  const [transcript, setTranscript]     = useState<TranscriptEntry[]>([]);
  const [steps, setSteps]               = useState<TaskStep[]>([]);
  const [timeline, setTimeline]         = useState<TimelineEvent[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isMuted, setIsMuted]           = useState(false);
  const [isCameraOn, setIsCameraOn]     = useState(true);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  // FIX: cameraFacing state drives useMediaCapture — default rear camera
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const phaseRef      = useRef<AssistSessionPhase>('idle');

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const aria = useAriaContext();

  // FIX: pass cameraFacing as facingMode — useMediaCapture handles stream restart
  // when cameraFacing changes (via its own facingMode useEffect).
  // hasMultipleCameras is now sourced from useMediaCapture (reliable post-permission).
  const {
    videoRef,
    isCapturing,
    startCapture,
    stopCapture,
    hasMultipleCameras,   // ← from useMediaCapture, not local state
  } = useMediaCapture({
    sendFrame: aria.sendBinary,
    facingMode: cameraFacing,   // ← drives camera selection
  });

  // ── Subscribe to WS messages ──────────────────────────────────────────────
  useEffect(() => {
    if (!aria.subscribeToMessages) return;
    const unsub = aria.subscribeToMessages((msg: any) => {
      handleWsMessage(msg);
    });
    return unsub;
  }, [aria.subscribeToMessages]); // eslint-disable-line

  // ── Parse ARIA transcript for task title and steps ────────────────────────
  useEffect(() => {
    if (!aria.transcript) return;

    const text = aria.transcript;

    const titleMatch = text.match(/Task:\s*(.+?)(?:\.|$)/i);
    if (titleMatch && titleMatch[1]) {
      const detectedTitle = titleMatch[1].trim();
      if (!taskTitle) {
        setTaskTitle(detectedTitle);
        addTimelineEvent(`Task: "${detectedTitle}"`, 'info');
        if (phaseRef.current === 'listening' || phaseRef.current === 'idle') {
          setPhase('active');
          setSessionDuration(0);
        }
      }
    }

    const stepsMatch = text.match(/Steps?:\s*((?:\d+\..+\n?)+)/i);
    if (stepsMatch) {
      const lines = stepsMatch[1]
        .split('\n')
        .map((l) => l.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
      if (lines.length > 0) {
        setSteps(lines.map((l, i) => ({
          id: `step-${Date.now()}-${i}`,
          text: l,
          done: false,
        })));
        addTimelineEvent(`${lines.length} steps identified`, 'step');
      }
    }

    const entry: TranscriptEntry = {
      id: `t-${Date.now()}`,
      role: 'aria',
      text,
      timestamp: Date.now(),
    };
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscript([...transcriptRef.current]);
  }, [aria.transcript]); // eslint-disable-line

  function handleWsMessage(msg: any) {
    if (!msg?.type) return;
    if (msg.type === 'transcription' && msg.role === 'user') {
      const entry: TranscriptEntry = {
        id: `t-${Date.now()}`,
        role: 'user',
        text: msg.text,
        timestamp: Date.now(),
      };
      transcriptRef.current = [...transcriptRef.current, entry];
      setTranscript([...transcriptRef.current]);
    }
  }

  function addTimelineEvent(text: string, type: TimelineEvent['type'] = 'info') {
    setTimeline((prev) => [...prev, {
      id: `ev-${Date.now()}`,
      text,
      timestamp: Date.now(),
      type,
    }]);
  }

  // ── Session timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'active' || phase === 'listening') {
      timerRef.current = setInterval(() => {
        setSessionDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    try {
      await aria.enableVoice();
      await startCapture();
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      aria.sendText(JSON.stringify({
        type: 'control',
        action: 'start_assist',
        initial_query: '',
        camera_active: true,
      }));
      setPhase('listening');
      setSessionDuration(0);
      setTranscript([]);
      setSteps([]);
      setTimeline([]);
      setTaskTitle('');
      transcriptRef.current = [];
    } catch (err) {
      console.error('[ASSIST] startSession error:', err);
    }
  }, [aria, startCapture]); // eslint-disable-line

  const pauseSession = useCallback(() => {
    aria.pause();
    setPhase('paused');
    addTimelineEvent('Session paused', 'info');
  }, [aria]);

  const resumeSession = useCallback(async () => {
    aria.resume();
    setPhase('active');
    addTimelineEvent('Session resumed', 'info');
  }, [aria]);

  const endSession = useCallback(async () => {
    aria.stop();
    stopCapture();
    setPhase('ended');
    setTaskTitle('');
    setTranscript([]);
    setSteps([]);
    setTimeline([]);
    setSessionDuration(0);
    transcriptRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
    addTimelineEvent('Session ended', 'info');
  }, [aria, stopCapture]);

  const selectTask = useCallback((query: string, label: string) => {
    setTaskTitle(label);
    addTimelineEvent(`Task: "${label}"`, 'info');
    aria.sendText(JSON.stringify({
      type: 'control',
      action: 'start_assist',
      initial_query: query,
      camera_active: true,
    }));
    setPhase('active');
    setSessionDuration(0);
  }, [aria]);

  const toggleMute = useCallback(() => {
    if (isMuted) { aria.unmute(); } else { aria.mute(); }
    setIsMuted((m) => !m);
  }, [isMuted, aria]);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      stopCapture();
      setIsCameraOn(false);
    } else {
      await startCapture();
      setIsCameraOn(true);
    }
  }, [isCameraOn, startCapture, stopCapture]);

  // FIX: flipCamera — just update cameraFacing state.
  // useMediaCapture watches its facingMode prop and restarts the stream cleanly.
  // The old version manually called getUserMedia + startCapture() which created
  // two concurrent streams. This version is one line.
  const flipCamera = useCallback(() => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  const takeScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setScreenshotDataUrl(canvas.toDataURL('image/jpeg', 0.9));
    addTimelineEvent('Screenshot captured', 'good');
  }, [videoRef]); // eslint-disable-line

  const downloadScreenshot = useCallback(() => {
    if (!screenshotDataUrl) return;
    const a = document.createElement('a');
    a.href = screenshotDataUrl;
    a.download = `aria-assist-${Date.now()}.jpg`;
    a.click();
  }, [screenshotDataUrl]);

  const toggleStep = useCallback((stepId: string) => {
    setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, done: !s.done } : s));
    const step = steps.find((s) => s.id === stepId);
    if (step && !step.done) addTimelineEvent(`✓ ${step.text}`, 'good');
  }, [steps]);

  const updateSessionNotes = useCallback((notes: string) => {
    setSessionNotes(notes);
  }, []);

  const exportSession = useCallback(() => {
    const completedSteps = steps.filter((s) => s.done).length;
    const content = [
      `ARIA Assist Session`,
      `Task: ${taskTitle || 'Untitled'}`,
      `Duration: ${formatDuration(sessionDuration)}`,
      `Date: ${new Date().toLocaleString()}`,
      ``,
      `── TRANSCRIPT ──`,
      ...transcript.map((t) =>
        `[${t.role.toUpperCase()}] ${new Date(t.timestamp).toLocaleTimeString()}: ${t.text}`
      ),
      ``,
      `── STEPS (${completedSteps}/${steps.length} completed) ──`,
      ...steps.map((s) => `${s.done ? '✓' : '○'} ${s.text}`),
      ``,
      `── TIMELINE ──`,
      ...timeline.map((e) =>
        `${new Date(e.timestamp).toLocaleTimeString()}: ${e.text}`
      ),
      ``,
      `── NOTES ──`,
      sessionNotes || '(none)',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `aria-assist-${taskTitle || 'session'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, steps, timeline, sessionNotes, taskTitle, sessionDuration]);

  const sendQuickTask = useCallback((task: string) => {
    if (phase === 'active' || phase === 'paused') {
      setTaskTitle(task);
      aria.sendText(JSON.stringify({
        type: 'control',
        action: 'update_context',
        context: { new_task: task },
      }));
      addTimelineEvent(`Task switched: "${task}"`, 'info');
    }
  }, [phase, aria]); // eslint-disable-line

  return {
    session: {
      phase,
      taskTitle,
      transcript,
      steps,
      timeline,
      sessionNotes,
      isMuted,
      isCameraOn,
      cameraFacing,
      hasMultipleCameras,   // ← from useMediaCapture (reliable)
      sessionDuration,
      screenshotDataUrl,
    } as AssistSessionState,

    videoRef,
    isCapturing,

    isSpeaking:  aria.isSpeaking,
    isListening: aria.isListening,
    ariaState:   aria.geminiState,

    startSession,
    pauseSession,
    resumeSession,
    endSession,
    selectTask,
    toggleMute,
    toggleCamera,
    flipCamera,
    takeScreenshot,
    downloadScreenshot,
    toggleStep,
    updateSessionNotes,
    exportSession,
    sendQuickTask,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}