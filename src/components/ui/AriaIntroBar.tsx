'use client';

/**
 * AriaIntroBar.tsx — MODIFIED
 *
 * WHAT CHANGED vs previous version and WHY:
 *
 * 1. ADDED 'ready_to_activate' STATE HANDLING [CRITICAL — fixes AudioContext block]
 *    Old: introState === 'ready_to_activate' fell through all visibility checks
 *         and the component returned null → no button was ever shown → user had
 *         no way to trigger a gesture → AudioContext never got created → no audio.
 *    New: 'ready_to_activate' is explicitly included in visibility logic and
 *         renders a "Talk to ARIA" button. This button's onClick IS the user
 *         gesture the browser requires before AudioContext is allowed to start.
 *
 * 2. PULLED activate() FROM useAriaIntro
 *    activate() is now destructured alongside the other controls. It is called
 *    exclusively from the "Talk to ARIA" button's onClick — never automatically.
 *
 * 3. READINESS INDICATOR WHILE WS IS CONNECTING
 *    A subtle pulsing yellow dot is shown during 'waiting' so the user knows
 *    the system is initialising before the button appears.
 *
 * ALL OTHER LOGIC IS IDENTICAL TO THE PREVIOUS VERSION.
 * Location: src/components/ui/AriaIntroBar.tsx
 */

import React from 'react';
import { useAriaIntro, IntroState } from '@/hooks/useAriaIntro';

// ── Waveform (shown when ARIA is speaking) ─────────────────────────────────────

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

// ── Pulsing dot (shown when actively listening) ────────────────────────────────

function ListeningDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan" />
    </span>
  );
}

// ── Status label ───────────────────────────────────────────────────────────────

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

// ── Main component ─────────────────────────────────────────────────────────────

export const AriaIntroBar: React.FC = () => {
  const {
    introState,
    isSpeaking,
    isListening,
    transcript,
    activate,       // NEW — called from "Talk to ARIA" button onClick
    pause,
    resume,
    stop,
    mute,
    unmute,
    enableVoice,
    disableVoice,
  } = useAriaIntro();

  // ── Visibility ─────────────────────────────────────────────────────────────
  // CHANGE: 'ready_to_activate' added — was missing, causing the bar to be
  // invisible exactly when the start button needed to appear.
  if (introState === 'idle') return null;
  if (introState === 'stopped') return null;

  const isTransitioning = introState === 'waiting';
  const isPersistentActive = introState === 'active' || introState === 'muted';
  const isVisible =
    introState === 'waiting' ||
    introState === 'ready_to_activate' ||   // CHANGE: added
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
        fixed top-0 left-0 right-0 z-50
        flex items-center justify-between
        px-4 md:px-8 py-2.5
        border-b border-cyan/20
        bg-bg-deep/90 backdrop-blur-md
        transition-all duration-300
        ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
      `}
    >
      {/* ── Left: status indicator + label ──────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {isSpeaking && <SpeakingWave />}
        {!isSpeaking && isListening && introState === 'active' && <ListeningDot />}
        {!isSpeaking && introState === 'muted' && (
          <span className="w-2 h-2 rounded-full bg-gray-500" aria-hidden="true" />
        )}
        {isTransitioning && (
          <span
            className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"
            aria-hidden="true"
          />
        )}
        {/* Steady cyan dot while waiting for user to tap Start */}
        {introState === 'ready_to_activate' && !isSpeaking && (
          <span
            className="w-2 h-2 rounded-full bg-cyan/60"
            aria-hidden="true"
          />
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

        {/*
         * ── CHANGE: "Talk to ARIA" button ─────────────────────────────────
         *
         * WHY THIS IS THE FIX:
         *   This onClick is the user gesture the browser requires.
         *   activate() → startListening() → new AudioContext() + getUserMedia()
         *   All of that runs synchronously within this click handler's call stack.
         *   The browser sees a trusted interaction and allows both AudioContexts.
         *
         * Shown only in 'ready_to_activate'. Disappears once active.
         */}
        {introState === 'ready_to_activate' && (
          <button
            onClick={activate}
            className="
              px-4 py-1.5 rounded-full
              border border-cyan/60 bg-cyan/10 text-cyan
              text-xs font-semibold
              hover:bg-cyan/20 hover:border-cyan
              transition-colors
              animate-pulse
            "
            title="Start ARIA voice agent"
          >
            🎙 Talk to ARIA
          </button>
        )}

        {/* Mute / Unmute — persistent active state */}
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

        {/* Mic toggle + pause — during intro speech */}
        {(isSpeaking || introState === 'waiting') && (
          <>
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

        {/* Close — always visible while bar is shown */}
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