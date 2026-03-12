'use client';

/**
 * AriaIntroBar.tsx — MODIFIED
 *
 * WHAT CHANGED vs previous version and WHY:
 *
 * 1. POSITIONING: fixed top-0 z-50 → sticky top-16 z-40
 *    Old: `fixed top-0 left-0 right-0 z-50`
 *         Anchored to the top of the viewport, overlapping the Navbar entirely
 *         and hiding the nav links behind it.
 *    New: `sticky top-16 z-40`
 *         - sticky: stays in normal document flow below the Navbar
 *         - top-16: sticks at 64px (Navbar height) when scrolling
 *         - z-40: one z-level below Navbar (z-50) so navbar always wins
 *         Nav links are now always fully visible.
 *
 * 2. ANIMATION: translate-y → max-h + opacity
 *    Old: `-translate-y-full` to hide, `translate-y-0` to show.
 *         Transforms break sticky positioning calculation in browsers.
 *    New: `max-h-0 opacity-0 overflow-hidden` to hide,
 *         `max-h-16 opacity-100` to show. Smooth and sticky-compatible.
 *
 * ALL OTHER LOGIC IDENTICAL TO PREVIOUS VERSION.
 */

import React from 'react';
import { useAriaIntro, IntroState } from '@/hooks/useAriaIntro';

function SpeakingWave() {
  return (
    <div className="flex items-center gap-[3px] h-4" aria-hidden="true">
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

function ListeningDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan" />
    </span>
  );
}

function statusLabel(
  state: IntroState,
  isListening: boolean,
  isSpeaking: boolean
): string {
  if (isSpeaking) return 'ARIA is speaking';
  if (isListening && state === 'active') return 'Listening…';
  switch (state) {
    case 'waiting':            return 'Initialising…';
    case 'ready_to_activate':  return 'ARIA — Ready';
    case 'active':             return 'ARIA — Active';
    case 'muted':              return 'ARIA — Muted';
    case 'paused':             return 'Paused';
    default:                   return '';
  }
}

export const AriaIntroBar: React.FC = () => {
  const {
    introState,
    isSpeaking,
    isListening,
    transcript,
    activate,
    pause,
    resume,
    stop,
    mute,
    unmute,
    enableVoice,
    disableVoice,
  } = useAriaIntro();

  if (introState === 'idle') return null;
  if (introState === 'stopped') return null;

  const isPersistentActive = introState === 'active' || introState === 'muted';
  const isVisible =
    introState === 'waiting' ||
    introState === 'ready_to_activate' ||
    introState === 'paused' ||
    introState === 'active' ||
    introState === 'muted' ||
    isSpeaking;

  return (
    <div
      role="region"
      aria-label="ARIA Voice Assistant"
      aria-live="polite"
      className={`
        sticky top-16 left-0 right-0 z-40
        flex items-center justify-between
        px-4 md:px-8
        border-b border-cyan/20
        bg-bg-deep/90 backdrop-blur-md
        transition-all duration-300
        ${isVisible
          ? 'max-h-16 opacity-100 py-2.5'
          : 'max-h-0 opacity-0 overflow-hidden py-0 pointer-events-none'
        }
      `}
    >
      {/* ── Left: status + label ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {isSpeaking && <SpeakingWave />}

        {!isSpeaking && isListening && introState === 'active' && (
          <ListeningDot />
        )}

        {!isSpeaking && introState === 'muted' && (
          <span className="w-2 h-2 rounded-full bg-gray-500" aria-hidden="true" />
        )}

        {introState === 'waiting' && (
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
        )}

        {introState === 'ready_to_activate' && !isSpeaking && (
          <span className="w-2 h-2 rounded-full bg-cyan/60" aria-hidden="true" />
        )}

        <span className="text-xs font-mono text-text-secondary whitespace-nowrap">
          {statusLabel(introState, isListening, isSpeaking)}
        </span>

        {transcript && (isPersistentActive || isSpeaking) && (
          <span className="hidden sm:block text-xs text-text-muted italic max-w-xs truncate">
            "{transcript}"
          </span>
        )}
      </div>

      {/* ── Right: controls ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {introState === 'ready_to_activate' && (
          <button
            onClick={activate}
            className="px-4 py-1.5 rounded-full border border-cyan/60 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 hover:border-cyan transition-colors animate-pulse"
            title="Start ARIA voice agent"
          >
            🎙 Talk to ARIA
          </button>
        )}

        {introState === 'active' && (
          <button
            onClick={mute}
            className="px-3 py-1.5 rounded-full border border-border bg-bg-card text-text-secondary text-xs font-semibold hover:border-amber/40 hover:text-amber transition-colors"
            title="Mute ARIA"
          >
            🔇 Mute
          </button>
        )}

        {introState === 'muted' && (
          <button
            onClick={unmute}
            className="px-3 py-1.5 rounded-full border border-cyan/40 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 transition-colors"
            title="Unmute ARIA"
          >
            🔊 Unmute
          </button>
        )}

        {(isSpeaking || introState === 'waiting') && (
          <>
            <button
              onClick={isListening ? disableVoice : enableVoice}
              title={isListening ? 'Disable voice interrupt' : 'Enable voice interrupt'}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                isListening
                  ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'border-border bg-bg-card text-text-secondary hover:border-cyan/40 hover:text-cyan'
              }`}
            >
              {isListening ? '🎙 On' : '🎙 Off'}
            </button>

            {isSpeaking && (
              <button
                onClick={pause}
                className="px-3 py-1.5 rounded-full border border-amber/40 bg-amber/10 text-amber text-xs font-semibold hover:bg-amber/20 transition-colors"
              >
                ⏸ Pause
              </button>
            )}
          </>
        )}

        {introState === 'paused' && (
          <button
            onClick={resume}
            className="px-3 py-1.5 rounded-full border border-cyan/40 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 transition-colors"
          >
            ▶ Resume
          </button>
        )}

        <button
          onClick={stop}
          className="px-3 py-1.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
          title="Deactivate ARIA voice assistant"
        >
          ✕ {isPersistentActive ? 'Close' : 'Stop'}
        </button>
      </div>
    </div>
  );
};