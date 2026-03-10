import { useEffect, useRef, useCallback, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GeminiState = 'idle' | 'connecting' | 'ready' | 'speaking' | 'listening' | 'error';

export interface UseGeminiLiveOptions {
  sessionId: string | null;
  enabled?: boolean;
}

export interface UseGeminiLiveReturn {
  state: GeminiState;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  sendControlMessage: (action: string, payload?: Record<string, unknown>) => void;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

// ── PCM16LE audio playback via Web Audio API ─────────────────────────────────

function createAudioPlayer() {
  let audioCtx: AudioContext | null = null;
  let nextPlayTime = 0;

  function getCtx(): AudioContext {
    if (!audioCtx) {
      audioCtx = new AudioContext({ sampleRate: 24000 });
      nextPlayTime = audioCtx.currentTime;
    }
    return audioCtx;
  }

  function playPCM16(pcmData: ArrayBuffer) {
    const ctx = getCtx();
    // Resume suspended context — browser blocks audio until a user gesture
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
    const startAt = Math.max(ctx.currentTime, nextPlayTime);
    source.start(startAt);
    nextPlayTime = startAt + buffer.duration;
    return buffer.duration;
  }

  function stop() {
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
      nextPlayTime = 0;
    }
  }

  function resume() {
    if (audioCtx?.state === 'suspended') audioCtx.resume();
  }

  function suspend() {
    if (audioCtx?.state === 'running') audioCtx.suspend();
  }

  return { playPCM16, stop, resume, suspend };
}

// ── Decode binary frame from backend ─────────────────────────────────────────
//
// manager.send_bytes() produces:
//   [10 bytes] message_type header e.g. "audio\x00\x00\x00\x00\x00"
//   [rest    ] raw PCM16LE @ 24 kHz
//
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

// ── Hook ──────────────────────────────────────────────────────────────────────

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000';

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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Connect WebSocket ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return;

    setState('connecting');
    const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setState('ready');
      setError(null);

      // Heartbeat every 30s — backend times out after 90s without one
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 30000);
    };

    ws.onclose = () => {
      setState('idle');
      setIsSpeaking(false);
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
      // Binary = [10-byte "audio" header][raw PCM16LE]
      if (event.data instanceof ArrayBuffer) {
        const pcm = extractAudioFromFrame(event.data);
        if (pcm && pcm.byteLength > 0) {
          audioPlayer.current.playPCM16(pcm);
          setIsSpeaking(true);
          setState('speaking');
          if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
          speakingTimerRef.current = setTimeout(() => {
            setIsSpeaking(false);
            setState('ready');
          }, 800);
        }
        return;
      }

      // Text frames = JSON control messages
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'interrupted') {
          setIsSpeaking(false);
          setState('ready');
          audioPlayer.current.stop();
          audioPlayer.current = createAudioPlayer();
        }
        if (msg.type === 'gemini_text') {
          setTranscript(msg.text ?? '');
        }
        if (msg.type === 'error') {
          setError(msg.error);
        }
      } catch {
        // not JSON — ignore
      }
    };

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      ws.close();
      audioPlayer.current.stop();
    };
  }, [sessionId, enabled]);

  // ── Send JSON control message ─────────────────────────────────────────────
  const sendControlMessage = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'control', action, ...payload }));
      }
    },
    []
  );

  // ── Voice input (barge-in / interrupt) ───────────────────────────────────
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript;
      setTranscript(text);

      if (last.isFinal && text.trim()) {
        sendControlMessage('barge_in', { text, timestamp: Date.now() });
        audioPlayer.current.stop();
        audioPlayer.current = createAudioPlayer();
        setIsSpeaking(false);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
    setState('listening');
  }, [sendControlMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    if (state === 'listening') setState('ready');
  }, [state]);

  return {
    state,
    isSpeaking,
    isListening,
    transcript,
    sendControlMessage,
    startListening,
    stopListening,
    error,
  };
}