'use client';

/**
 * src/hooks/useAssistSession.ts
 *
 * Full session logic for the ARIA Assist page.
 * Manages: WebSocket/Gemini session, mic, camera (front/back), screenshots,
 * transcript, task timeline, step breakdown, session notes, save/export.
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { useAriaContext } from '@/contexts/AriaContext';
import { useMediaCapture } from '@/hooks/useMediaCapture';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssistSessionPhase =
  | 'idle'        // page just loaded, session not started
  | 'listening'   // ARIA session active, mic on, awaiting task selection
  | 'active'      // task selected — video feed showing, ARIA helping
  | 'paused'      // manually paused
  | 'ended';      // session finished

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
  sessionDuration: number;   // seconds
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
  const [phase, setPhase] = useState<AssistSessionPhase>('idle');
  const [taskTitle, setTaskTitle] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  // ── Shared ARIA session from context ─────────────────────────────────────
  const aria = useAriaContext();

  // ── Media capture — videoRef is owned here and returned for <video> element
  const { videoRef, isCapturing, startCapture, stopCapture } = useMediaCapture({
    sendFrame: aria.sendBinary,
  });

  // ── Detect multiple cameras ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const cams = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(cams.length > 1);
      // Default to back camera if available
      if (cams.length > 0) setCameraFacing('environment');
    }).catch(() => {});
  }, []);

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

    // Auto-extract task title: "Task: [title]"
    const titleMatch = text.match(/Task:\s*(.+?)(?:\.|$)/i);
    if (titleMatch && titleMatch[1] && !taskTitle) {
      setTaskTitle(titleMatch[1].trim());
      addTimelineEvent(titleMatch[1].trim(), 'info');
    }

    // Auto-extract steps: "Steps:\n1. ...\n2. ..."
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

    // Add to transcript
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
    // Handle any assist-specific backend messages here
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
    const event: TimelineEvent = {
      id: `ev-${Date.now()}`,
      text,
      timestamp: Date.now(),
      type,
    };
    setTimeline((prev) => [...prev, event]);
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

  const startSession = useCallback(async (initialQuery?: string) => {
    try {
      // ── Step 1: Start mic so ARIA can hear the user
      // enableVoice() calls startListening() internally which opens the
      // AudioContext and starts streaming PCM to the backend.
      await aria.enableVoice();

      // ── Step 2: Send start_assist to backend.
      // This tells the router to:
      //   a) set session mode to "assist" (video skips object detection)
      //   b) send an Assist-focused greeting to Gemini (makes ARIA speak first)
      //   c) create a Gemini session if one doesn't exist yet
      // We wait 200ms for the mic AudioContext to settle before sending.
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      aria.sendText(JSON.stringify({
        type: 'control',
        action: 'start_assist',
        initial_query: initialQuery || '',
      }));

      // ── Step 3: Start video capture (camera → backend frames)
      await startCapture();

      // ── Step 4: Update UI state
      setPhase('active');
      setSessionDuration(0);
      setTranscript([]);
      setSteps([]);
      setTimeline([]);
      setTaskTitle(initialQuery ? formatTitle(initialQuery) : '');
      addTimelineEvent(
        initialQuery ? `Task: "${initialQuery}"` : 'Session started — show ARIA your task',
        'info'
      );
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
    addTimelineEvent('Session ended', 'info');
    if (timerRef.current) clearInterval(timerRef.current);
  }, [aria, stopCapture]);

  // selectTask — called when user clicks a shortcut OR ARIA detects a task from voice.
  // Transitions from 'listening' to 'active': starts video and sets the task title.
  const selectTask = useCallback(async (query: string, label: string) => {
    setTaskTitle(label);
    addTimelineEvent(`Task selected: "${label}"`, 'info');

    // Send task to backend so ARIA starts helping immediately
    aria.sendText(JSON.stringify({
      type: 'control',
      action: 'start_assist',
      initial_query: query,
    }));

    // Start video capture now that a task is active
    try {
      await startCapture();
    } catch (err) {
      console.error('[ASSIST] Camera start error:', err);
    }

    setPhase('active');
    setSessionDuration(0);
  }, [aria, startCapture]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      aria.unmute();
    } else {
      aria.mute();
    }
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

  const flipCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    // Stop current capture and restart with new facing
    stopCapture();
    setTimeout(async () => {
      await startCapture();
    }, 300);
  }, [cameraFacing, startCapture, stopCapture]);

  const takeScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setScreenshotDataUrl(dataUrl);
    addTimelineEvent('Screenshot captured', 'good');
  }, []);

  const downloadScreenshot = useCallback(() => {
    if (!screenshotDataUrl) return;
    const a = document.createElement('a');
    a.href = screenshotDataUrl;
    a.download = `aria-assist-${Date.now()}.jpg`;
    a.click();
  }, [screenshotDataUrl]);

  const toggleStep = useCallback((stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => s.id === stepId ? { ...s, done: !s.done } : s)
    );
    const step = steps.find((s) => s.id === stepId);
    if (step && !step.done) {
      addTimelineEvent(`✓ ${step.text}`, 'good');
    }
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aria-assist-${taskTitle || 'session'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, steps, timeline, sessionNotes, taskTitle, sessionDuration]);

  const sendQuickTask = useCallback((task: string) => {
    // If already active, just update the task title and notify ARIA
    if (phase === 'active' || phase === 'paused') {
      setTaskTitle(task);
      aria.sendText(JSON.stringify({
        type: 'control',
        action: 'update_context',
        context: { new_task: task },
      }));
      addTimelineEvent(`Task switched: "${task}"`, 'info');
    }
    // Otherwise handled by selectTask
  }, [phase, aria]); // eslint-disable-line

  return {
    // State
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
      hasMultipleCameras,
      sessionDuration,
      screenshotDataUrl,
    } as AssistSessionState,

    // Refs
    videoRef,
    isCapturing,

    // Aria state
    isSpeaking: aria.isSpeaking,
    isListening: aria.isListening,
    ariaState: aria.geminiState,

    // Actions
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

function formatTitle(query: string): string {
  return query.length > 40 ? query.slice(0, 37) + '...' : query;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}