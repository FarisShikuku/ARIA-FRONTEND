'use client';

import React, { useEffect } from 'react';
import { useAriaIntro, IntroState } from '@/hooks/useAriaIntro';

// ── Waveform animation while speaking ────────────────────────────────────────
function SpeakingWave() {
  return (
    <div className="flex items-center gap-[3px] h-4">
      {[1, 2, 3, 4, 3, 2, 1].map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-cyan animate-pulse"
          style={{
            height: `${h * 3 + 4}px`,
            animationDelay: `${i * 80}ms`,
            animationDuration: '600ms',
          }}
        />
      ))}
    </div>
  );
}

// ── Status label ─────────────────────────────────────────────────────────────
function statusLabel(state: IntroState, isListening: boolean): string {
  if (isListening) return 'Listening…';
  switch (state) {
    case 'waiting':   return 'Initialising…';
    case 'speaking':  return 'ARIA is speaking';
    case 'paused':    return 'Paused';
    case 'stopped':   return '';
    case 'interrupted': return 'Interrupted';
    default:          return '';
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export const AriaIntroBar: React.FC = () => {
  const {
    introState,
    isSpeaking,
    isListening,
    transcript,
    pause,
    resume,
    stop,
    enableVoice,
    disableVoice,
  } = useAriaIntro();

  // Auto-enable voice when intro starts
  useEffect(() => {
    if (introState === 'speaking') {
      enableVoice();
    }
    if (introState === 'stopped' || introState === 'interrupted') {
      disableVoice();
    }
  }, [introState, enableVoice, disableVoice]);

  // Hide bar when stopped and not speaking
  if (introState === 'stopped' && !isSpeaking) return null;
  if (introState === 'idle') return null;

  const isActive = introState === 'speaking' || introState === 'paused' || introState === 'waiting';

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50
        flex items-center justify-between
        px-4 md:px-8 py-3
        border-b border-cyan/20
        bg-bg-deep/90 backdrop-blur-md
        transition-all duration-300
        ${isActive ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
      `}
    >
      {/* Left: status + wave */}
      <div className="flex items-center gap-3">
        {isSpeaking && <SpeakingWave />}
        {isListening && (
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        )}
        <span className="text-xs font-mono text-text-secondary">
          {statusLabel(introState, isListening)}
        </span>
        {transcript && (
          <span className="hidden sm:block text-xs text-text-muted italic max-w-xs truncate">
            "{transcript}"
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {/* Mic toggle */}
        <button
          onClick={isListening ? disableVoice : enableVoice}
          title={isListening ? 'Disable voice interrupt' : 'Enable voice interrupt'}
          className={`
            px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors
            ${isListening
              ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20'
              : 'border-border bg-bg-card text-text-secondary hover:border-cyan/40 hover:text-cyan'
            }
          `}
        >
          {isListening ? '🎙 On' : '🎙 Off'}
        </button>

        {/* Pause / Resume */}
        {introState === 'speaking' && (
          <button
            onClick={pause}
            className="px-3 py-1.5 rounded-full border border-amber/40 bg-amber/10 text-amber text-xs font-semibold hover:bg-amber/20 transition-colors"
          >
            ⏸ Pause
          </button>
        )}
        {introState === 'paused' && (
          <button
            onClick={resume}
            className="px-3 py-1.5 rounded-full border border-cyan/40 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 transition-colors"
          >
            ▶ Resume
          </button>
        )}

        {/* Stop */}
        <button
          onClick={stop}
          className="px-3 py-1.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
        >
          ✕ Stop
        </button>
      </div>
    </div>
  );
};