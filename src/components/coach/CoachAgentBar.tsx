'use client';

/**
 * CoachAgentBar.tsx
 *
 * CHANGE vs previous version:
 *
 * STOP LINGERING ASSIST / HOME SESSION ON MOUNT.
 * WHY: useAriaIntro (used by the home page AriaIntroBar and /assist page) shares
 * a single Gemini Live session via AriaProvider in layout.tsx. When the user
 * navigates home → assist → coach, that session is still alive and speaking
 * because AriaProvider never unmounts (it's in the root layout). CoachAgentBar
 * mounts on the coach page and starts its own separate Gemini session via
 * useCoachSession, resulting in two voice streams playing simultaneously.
 *
 * FIX: On mount, CoachAgentBar calls stop() from useAriaIntro. This sends
 * 'stop_intro' to the backend, stops the microphone stream, and sets
 * introState → 'stopped', silencing the assist/home session immediately.
 * The AriaIntroBar (if visible on another page) would show a "Restart" prompt
 * on return — correct behaviour.
 *
 * stop() is idempotent — calling it when introState is already 'idle' or
 * 'stopped' is a no-op (both sendControlMessage and stopListening check WS
 * readyState before acting). No errors thrown.
 *
 * Everything else — props, canvas waveform, controls — is unchanged.
 */

import React, { useEffect, useRef } from 'react';
import { useRouter }    from 'next/navigation';
import { useAriaIntro } from '@/hooks/useAriaIntro';
import type { CoachMode, CoachSessionPhase } from '@/lib/types/coach.types';

interface CoachAgentBarProps {
  phase:               CoachSessionPhase;
  mode:                CoachMode | null;
  isSpeaking:          boolean;
  isListening:         boolean;
  isMuted:             boolean;
  transcript:          string;
  elapsedSeconds:      number;
  onToggleMute:        () => void;
  onPause:             () => void;
  onResume:            () => void;
  onSwitchToNavigation: () => void;
}

const MODE_LABELS: Record<CoachMode, string> = {
  interview:    'Interview',
  presentation: 'Presentation',
  music:        'Music Performance',
  mc:           'MC / Public Speaking',
  sermon:       'Sermon',
  negotiation:  'Negotiation',
};

const MODE_COLORS: Record<CoachMode, string> = {
  interview:    '#00e5ff',
  presentation: '#ffab00',
  music:        '#e040fb',
  mc:           '#00e676',
  sermon:       '#ff6d00',
  negotiation:  '#ff4081',
};

export const CoachAgentBar: React.FC<CoachAgentBarProps> = ({
  phase,
  mode,
  isSpeaking,
  isListening,
  isMuted,
  transcript,
  elapsedSeconds,
  onToggleMute,
  onPause,
  onResume,
  onSwitchToNavigation,
}) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const router       = useRouter();

  // ── Kill any running assist / home session when coach page opens ──────────
  // useAriaIntro connects to the shared AriaProvider session. stop() is safe
  // to call even if already idle — it guards on WS readyState internally.
  const { stop: stopAriaIntro } = useAriaIntro();

  useEffect(() => {
    stopAriaIntro();
    // Only fire on mount — dependency array intentionally empty.
    // stopAriaIntro is a stable useCallback reference, won't change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPaused  = phase === 'paused';
  const isActive  = phase === 'active';
  const modeColor = mode ? MODE_COLORS[mode] : '#00e5ff';

  // ── Waveform canvas animation (unchanged) ─────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (isSpeaking && !isMuted) {
        const bars = 28;
        const barW = 2;
        const gap  = (W - bars * barW) / (bars + 1);

        for (let i = 0; i < bars; i++) {
          const x      = gap + i * (barW + gap);
          const phase1 = (i / bars) * Math.PI * 2;
          const amp    = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 + phase1));
          const barH   = 4 + amp * (H - 8);

          ctx.fillStyle    = modeColor;
          ctx.globalAlpha  = 0.6 + amp * 0.4;
          ctx.beginPath();
          ctx.roundRect(x, (H - barH) / 2, barW, barH, 1);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        t += 0.04;
      } else if (isListening && !isMuted) {
        const bars = 28;
        const barW = 2;
        const gap  = (W - bars * barW) / (bars + 1);

        for (let i = 0; i < bars; i++) {
          const x    = gap + i * (barW + gap);
          const amp  = 0.1 + 0.15 * Math.abs(Math.sin(t * 1.2 + i * 0.3));
          const barH = 2 + amp * 12;

          ctx.fillStyle   = modeColor;
          ctx.globalAlpha = 0.25 + amp * 0.3;
          ctx.beginPath();
          ctx.roundRect(x, (H - barH) / 2, barW, barH, 1);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        t += 0.02;
      } else {
        ctx.strokeStyle = modeColor;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isSpeaking, isListening, isMuted, modeColor]);

  // ── Helpers (unchanged) ───────────────────────────────────────────────────
  const formatTime = (s: number) => {
    const m   = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const statusText = (() => {
    if (phase === 'idle' || phase === 'selecting') return 'Select a coaching mode to begin';
    if (phase === 'ready')   return 'Ready — tap Start Session to activate ARIA';
    if (isMuted)             return 'Muted — ARIA is watching silently';
    if (isPaused)            return 'Session paused';
    if (isSpeaking && transcript) return transcript;
    if (isSpeaking)          return 'ARIA is speaking…';
    if (isListening)         return 'Listening…';
    return 'ARIA Coach is ready';
  })();

  // ── Render (unchanged) ────────────────────────────────────────────────────
  return (
    <div
      className="fixed left-0 right-0 z-40 bg-bg-deep/95 backdrop-blur-xl border-b border-border"
      style={{ top: '64px' }}
    >
      <div className="flex items-center gap-3 px-4 md:px-8 h-12">

        {/* Left: Mode badge */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: modeColor,
                boxShadow: isActive ? `0 0 6px ${modeColor}` : 'none',
              }}
            />
            <span
              className="font-mono text-[10px] tracking-widest uppercase hidden sm:inline"
              style={{ color: modeColor }}
            >
              ARIA Coach
            </span>
          </div>

          {mode && (
            <span
              className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-sm border hidden md:inline"
              style={{
                color:           modeColor,
                borderColor:     `${modeColor}30`,
                backgroundColor: `${modeColor}10`,
              }}
            >
              {MODE_LABELS[mode]}
            </span>
          )}

          {isActive && (
            <span className="font-mono text-[10px] text-text-muted">
              {formatTime(elapsedSeconds)}
            </span>
          )}
        </div>

        {/* Center: Waveform + transcript */}
        <div className="flex-1 flex items-center gap-3 min-w-0 overflow-hidden">
          <canvas ref={canvasRef} width={120} height={32} className="shrink-0" />
          <p className="font-mono text-[11px] text-text-muted truncate" title={statusText}>
            {statusText}
          </p>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5 shrink-0">

          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute ARIA' : 'Mute ARIA'}
            className={`
              w-8 h-8 rounded-full border flex items-center justify-center text-sm
              transition-all duration-200
              ${isMuted
                ? 'border-red/50 text-red bg-red/10 hover:bg-red/20'
                : 'border-border-bright text-text-secondary hover:border-cyan hover:text-cyan hover:bg-cyan-ghost'
              }
            `}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          {isActive && (
            <button
              onClick={onPause}
              title="Pause session"
              className="w-8 h-8 rounded-full border border-amber/40 text-amber bg-amber/10 hover:bg-amber/20 flex items-center justify-center text-xs transition-all duration-200"
            >
              ⏸
            </button>
          )}
          {isPaused && (
            <button
              onClick={onResume}
              title="Resume session"
              className="w-8 h-8 rounded-full border border-green/40 text-green bg-green/10 hover:bg-green/20 flex items-center justify-center text-xs transition-all duration-200"
            >
              ▶
            </button>
          )}

          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

          <button
            onClick={onSwitchToNavigation}
            title="Switch to Navigation mode"
            className="hidden sm:flex items-center gap-1.5 px-2.5 h-7 rounded-sm border border-border-bright text-text-muted hover:border-cyan hover:text-cyan hover:bg-cyan-ghost font-mono text-[9px] tracking-wider uppercase transition-all duration-200"
          >
            <span>◉</span>
            <span className="hidden lg:inline">Navigate</span>
          </button>
        </div>
      </div>
    </div>
  );
};