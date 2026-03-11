'use client';

/**
 * AriaIntroBar.tsx  — MODIFIED
 *
 * WHAT CHANGED vs original and WHY:
 *
 * 1. PERSISTENT VISIBILITY (was: hidden after intro ends)
 *    Old: if (introState === 'stopped' && !isSpeaking) return null
 *         → Bar disappeared when intro finished → user couldn't control ARIA
 *    New: Bar stays visible in 'active' and 'muted' states
 *         → Persistent control surface for the ongoing voice agent
 *
 * 2. MUTE/UNMUTE BUTTON (new)
 *    'active' state shows a Mute button (stops mic streaming)
 *    'muted'  state shows an Unmute button (resumes mic streaming)
 *    Satisfies requirement: "should be interrupted until user mute it or closes it"
 *
 * 3. ACTIVE STATE UI (new)
 *    Shows a subtle pulsing indicator when ARIA is in persistent listening mode
 *    Shows "Listening…" label with mic icon
 *    Transcript is shown when ARIA speaks in response to user questions
 *
 * 4. CLOSE BUTTON now calls stop() not just hiding the bar
 *    WHY: Previously ✕ only stopped intro. Now it cleanly stops the session.
 */

import React, { useEffect } from 'react';
import { useAriaIntro, IntroState } from '@/hooks/useAriaIntro';

// ── Waveform (shown when ARIA is speaking) ────────────────────────────────────

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

// ── Pulsing dot (shown when actively listening) ───────────────────────────────

function ListeningDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan" />
    </span>
  );
}

// ── Status label ──────────────────────────────────────────────────────────────

function statusLabel(state: IntroState, isListening: boolean, isSpeaking: boolean): string {
  if (isSpeaking) return 'ARIA is speaking';
  if (isListening && state === 'active') return 'Listening…';
  switch (state) {
    case 'waiting':     return 'Initialising…';
    case 'speaking':    return 'ARIA is speaking';
    case 'active':      return 'ARIA — Ready';
    case 'muted':       return 'ARIA — Muted';
    case 'paused':      return 'Paused';
    case 'interrupted': return 'Interrupted';
    default:            return '';
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
    mute,
    unmute,
    enableVoice,
    disableVoice,
  } = useAriaIntro();

  // Auto-enable voice when intro starts speaking
  // Auto-disable when fully stopped
  useEffect(() => {
    if (introState === 'speaking') {
      enableVoice();
    }
    if (introState === 'stopped' || introState === 'interrupted') {
      disableVoice();
    }
  }, [introState, enableVoice, disableVoice]);

  // ── Visibility logic ──────────────────────────────────────────────────────
  //
  // CHANGED: bar now stays visible in 'active' and 'muted' states.
  // It only disappears in 'idle' and fully 'stopped' states.
  if (introState === 'idle') return null;
  if (introState === 'stopped') return null;

  const isTransitioning = introState === 'waiting';
  const isPersistentActive = introState === 'active' || introState === 'muted';
  const isVisible =
    introState === 'speaking' ||
    introState === 'paused' ||
    introState === 'waiting' ||
    introState === 'active' ||
    introState === 'muted' ||
    introState === 'interrupted';

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
      {/* ── Left: status + waveform / dot ─────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {isSpeaking && <SpeakingWave />}
        {!isSpeaking && isListening && introState === 'active' && <ListeningDot />}
        {!isSpeaking && introState === 'muted' && (
          <span className="w-2 h-2 rounded-full bg-gray-500" aria-hidden="true" />
        )}
        {isTransitioning && (
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
        )}

        <span className="text-xs font-mono text-text-secondary whitespace-nowrap">
          {statusLabel(introState, isListening, isSpeaking)}
        </span>

        {/* Transcript — shown while ARIA speaks in active mode */}
        {transcript && isPersistentActive && (
          <span className="hidden sm:block text-xs text-text-muted italic max-w-xs truncate">
            "{transcript}"
          </span>
        )}

        {/* Transcript during intro */}
        {transcript && introState === 'speaking' && (
          <span className="hidden sm:block text-xs text-text-muted italic max-w-xs truncate">
            "{transcript}"
          </span>
        )}
      </div>

      {/* ── Right: controls ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* ── Persistent active state controls ─────────────────────────── */}
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

        {/* ── Intro-phase controls ──────────────────────────────────────── */}
        {(introState === 'speaking' || introState === 'waiting') && (
          <>
            {/* Mic toggle for barge-in during intro */}
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

            {introState === 'speaking' && (
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

        {/* Stop/close — always visible except when already stopped */}
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