/**
 * useGeminiLive.ts  — MODIFIED
 *
 * WHAT CHANGED vs previous version and WHY:
 *
 * 1. PLAYBACK AUDIOCONTEXT NOW CREATED INSIDE startListening() [CRITICAL BUG FIX]
 *    Old: createAudioPlayer() called getCtx() lazily from ws.onmessage when
 *         Gemini audio arrived. ws.onmessage fires with no user gesture → browser
 *         blocked new AudioContext({ sampleRate: 24000 }) → "AudioContext not
 *         allowed to start" error → no audio played.
 *    New: createAudioPlayer() gains an initContext() method. startListening()
 *         calls audioPlayer.current.initContext() FIRST, within the same user
 *         gesture call stack as getUserMedia. Both AudioContexts (capture + playback)
 *         are now created in the same user gesture → browser allows both.
 *
 * 2. CAPTURE AUDIOCONTEXT UNCHANGED IN POSITION (still in startListening())
 *    This was already correct — new AudioContext() is inside startListening().
 *    The bug was that useAriaIntro was calling startListening() automatically
 *    without a user gesture. That is fixed in useAriaIntro.ts, not here.
 *    startListening() itself is correct as long as it's called from a click.
 *
 * ALL OTHER LOGIC IS IDENTICAL TO THE PREVIOUS VERSION.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GeminiState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'speaking'
  | 'listening'
  | 'error';

export interface UseGeminiLiveOptions {
  sessionId: string | null;
  enabled?: boolean;
}

export interface UseGeminiLiveReturn {
  state: GeminiState;
  isSpeaking: boolean;
  isListening: boolean;
  isMicStreaming: boolean;
  transcript: string;
  sendControlMessage: (action: string, payload?: Record<string, unknown>) => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  error: string | null;
}

// ── Audio Playback ────────────────────────────────────────────────────────────
//
// CHANGE: Added initContext() method.
//
// WHY: Previously getCtx() created new AudioContext({ sampleRate: 24000 }) lazily
// the first time playPCM16() was called. playPCM16() is called from ws.onmessage
// when Gemini sends audio back — this happens with no user gesture, so the browser
// blocks the AudioContext creation.
//
// FIX: initContext() must be called from within startListening(), which is always
// triggered by a user gesture (button click via useAriaIntro.activate()).
// After initContext() has been called, getCtx() returns the existing context
// without creating a new one — so ws.onmessage calls are safe.

function createAudioPlayer() {
  let audioCtx: AudioContext | null = null;
  let nextPlayTime = 0;

  // ── NEW METHOD ──────────────────────────────────────────────────────────────
  // Call this from within a user gesture (inside startListening) BEFORE any
  // audio arrives from Gemini. Creates the AudioContext while the browser
  // still considers us to be inside a trusted user interaction.
  function initContext() {
    if (!audioCtx) {
      audioCtx = new AudioContext({ sampleRate: 24000 });
      nextPlayTime = audioCtx.currentTime + 0.01;
    } else if (audioCtx.state === 'suspended') {
      // Already created but suspended (e.g. page was backgrounded) — resume it.
      audioCtx.resume();
    }
  }

  function getCtx(): AudioContext {
    // After initContext() has been called in a user gesture, this will always
    // return the existing context — never create a new one autonomously.
    if (!audioCtx) {
      // Fallback: create anyway. Will likely be blocked by browser autoplay
      // policy if we somehow get here outside a user gesture, but we log it.
      console.warn('[AudioPlayer] getCtx() called without prior initContext() — AudioContext may be blocked');
      audioCtx = new AudioContext({ sampleRate: 24000 });
      nextPlayTime = audioCtx.currentTime + 0.01;
    }
    return audioCtx;
  }

  function playPCM16(pcmData: ArrayBuffer): number {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const int16 = new Int16Array(pcmData);
    if (int16.length === 0) return 0;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.01, nextPlayTime);
    source.start(startAt);
    nextPlayTime = startAt + buffer.duration;

    return buffer.duration;
  }

  function stopPlayback() {
    if (audioCtx) {
      nextPlayTime = audioCtx.currentTime + 0.01;
    }
  }

  function close() {
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
      nextPlayTime = 0;
    }
  }

  return { initContext, playPCM16, stopPlayback, close };
}

// ── Binary frame decoder ──────────────────────────────────────────────────────

function extractAudioFromFrame(data: ArrayBuffer): ArrayBuffer | null {
  try {
    if (data.byteLength <= 10) return null;
    const header = new TextDecoder()
      .decode(new Uint8Array(data, 0, 10))
      .replace(/\0/g, '');
    if (header !== 'audio') return null;
    return data.slice(10);
  } catch {
    return null;
  }
}

// ── Audio frame encoder ───────────────────────────────────────────────────────

function buildAudioFrame(pcmBuffer: ArrayBuffer): ArrayBuffer {
  const metaObj = {
    format: 'pcm16le',
    sample_rate: 16000,
    timestamp: Date.now() / 1000,
    size: pcmBuffer.byteLength,
  };
  const metaBytes = new TextEncoder().encode(JSON.stringify(metaObj));

  const total = 10 + 4 + metaBytes.length + pcmBuffer.byteLength;
  const frame = new ArrayBuffer(total);
  const u8 = new Uint8Array(frame);
  const dv = new DataView(frame);

  const headerBytes = new TextEncoder().encode('audio');
  u8.set(headerBytes, 0);
  dv.setUint32(10, metaBytes.length, false);
  u8.set(metaBytes, 14);
  u8.set(new Uint8Array(pcmBuffer), 14 + metaBytes.length);

  return frame;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  'ws://localhost:8000';

const RMS_THRESHOLD = 0.003;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGeminiLive({
  sessionId,
  enabled = true,
}: UseGeminiLiveOptions): UseGeminiLiveReturn {
  const [state, setState] = useState<GeminiState>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioPlayer = useRef(createAudioPlayer());
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micActiveRef = useRef(false);

  // ── Mic streaming ──────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (micActiveRef.current) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      micStreamRef.current = stream;

      // Capture context at browser native rate; worklet downsamples to 16kHz
      const ctx = new AudioContext();
      captureCtxRef.current = ctx;

      // ── CHANGE: Init playback AudioContext here, in the same user gesture ──
      // getUserMedia above is the user gesture anchor. We init the playback
      // AudioContext immediately after so both contexts are created in the same
      // trusted call stack. ws.onmessage → playPCM16 will reuse this context.
      audioPlayer.current.initContext();

      await ctx.audioWorklet.addModule('/worklets/pcm-processor.js');

      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, 'pcm-processor');
      workletNodeRef.current = worklet;

      worklet.port.onmessage = (event) => {
        if (event.data?.type !== 'pcm') return;
        const pcmBuffer = event.data.buffer as ArrayBuffer;

        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) return;

        const int16 = new Int16Array(pcmBuffer);
        let sumSq = 0;
        for (let i = 0; i < int16.length; i++) {
          const n = int16[i] / 0x8000;
          sumSq += n * n;
        }
        const rms = Math.sqrt(sumSq / int16.length);
        if (rms < RMS_THRESHOLD) return;

        ws.send(buildAudioFrame(pcmBuffer));
      };

      source.connect(worklet);

      micActiveRef.current = true;
      setIsListening(true);
      setState('listening');
    } catch (err) {
      console.error('[useGeminiLive] Mic init failed:', err);
      setError('Microphone access denied or unavailable');
    }
  }, []);

  const stopListening = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;

    captureCtxRef.current?.close();
    captureCtxRef.current = null;
    workletNodeRef.current = null;

    micActiveRef.current = false;
    setIsListening(false);

    if (state === 'listening') setState('ready');
  }, [state]);

  // ── WebSocket connection ───────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled || !sessionId) return;

    setState('connecting');
    const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setState('ready');
      setError(null);

      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 30_000);
    };

    ws.onclose = () => {
      setState('idle');
      setIsSpeaking(false);
      setIsListening(false);
      micActiveRef.current = false;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
      setState('error');
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const pcm = extractAudioFromFrame(event.data);
        if (pcm && pcm.byteLength > 0) {
          // Safe: audioPlayer.initContext() was already called in startListening()
          audioPlayer.current.playPCM16(pcm);
          setIsSpeaking(true);
          setState('speaking');

          if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
          speakingTimerRef.current = setTimeout(() => {
            setIsSpeaking(false);
            setState(micActiveRef.current ? 'listening' : 'ready');
          }, 400);
        }
        return;
      }

      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === 'interrupted') {
          audioPlayer.current.stopPlayback();
          setIsSpeaking(false);
          if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
          setState(micActiveRef.current ? 'listening' : 'ready');
        }

        if (msg.type === 'gemini_text') {
          setTranscript(msg.text ?? '');
        }

        if (msg.type === 'transcription') {
          setTranscript(msg.text ?? '');
        }

        if (msg.type === 'error') {
          setError(msg.error);
          setState('error');
        }
      } catch {
        // Not JSON — ignore
      }
    };

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      ws.close();
      audioPlayer.current.close();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      captureCtxRef.current?.close();
    };
  }, [sessionId, enabled]);

  const sendControlMessage = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'control', action, ...payload }));
      }
    },
    []
  );

  return {
    state,
    isSpeaking,
    isListening,
    isMicStreaming: isListening,
    transcript,
    sendControlMessage,
    startListening,
    stopListening,
    error,
  };
}