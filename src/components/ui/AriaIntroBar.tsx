'use client';

/**
 * AriaIntroBar.tsx — MODIFIED
 *
 * CHANGES vs previous version:
 *
 * 1. POSITIONING: sticky top-16 → fixed top-16
 *    WHY: "sticky" only works inside its scroll container — when the home
 *    page scrolls, the bar scrolls away. "fixed" pins it to the viewport
 *    permanently below the Navbar (top:64px = top-16), exactly as requested.
 *    The bar never moves regardless of how far the user scrolls.
 *
 * 2. REMOVED: the "✕ Stop / Close" button.
 *    WHY: The bar must be permanent — it should never disappear when the user
 *    clicks anything. Previously clicking "✕" set introState to 'stopped'
 *    which caused the bar to return null. That button is gone. The only
 *    dismiss-like action left is "Mute", which keeps the bar visible.
 *
 * 3. REMOVED: early-return for introState === 'stopped'.
 *    WHY: If the session ends for any reason, the bar should still be visible
 *    (showing a "Restart" prompt) rather than disappearing.
 *
 * 4. ADDED: home-page top-padding helper div (see usage in page.tsx).
 *    The bar is fixed so it overlaps page content. The home page adds
 *    a spacer div of height 44px (the bar's height) below the Navbar so
 *    the Hero title is never hidden behind the bar.
 *
 * All other logic, hooks, and classNames are unchanged.
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

function statusLabel(state: IntroState, isListening: boolean, isSpeaking: boolean): string {
  if (isSpeaking)                               return 'ARIA is speaking';
  if (isListening && state === 'active')        return 'Listening…';
  switch (state) {
    case 'waiting':           return 'Initialising…';
    case 'ready_to_activate': return 'ARIA — Ready';
    case 'active':            return 'ARIA — Active';
    case 'muted':             return 'ARIA — Muted';
    case 'paused':            return 'Paused';
    case 'stopped':           return 'Session ended — tap to restart';
    default:                  return 'ARIA';
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
    mute,
    unmute,
    enableVoice,
    disableVoice,
  } = useAriaIntro();

  // Only truly hide when the hook hasn't initialised yet (idle).
  // 'stopped' now shows a restart prompt instead of disappearing.
  if (introState === 'idle') return null;

  const isPersistentActive = introState === 'active' || introState === 'muted';
  const isStopped          = introState === 'stopped';

  return (
    <div
      role="region"
      aria-label="ARIA Voice Assistant"
      aria-live="polite"
      className={`
        fixed top-16 left-0 right-0 z-40
        flex items-center justify-between
        px-4 md:px-8 py-2.5
        border-b border-cyan/20
        bg-bg-deep/95 backdrop-blur-md
        transition-opacity duration-300
        ${isStopped ? 'opacity-80' : 'opacity-100'}
      `}
    >
      {/* ── Left: status indicator + label + transcript ─────────────────── */}
      <div className="flex items-center gap-3 min-w-0">

        {isSpeaking && <SpeakingWave />}

        {!isSpeaking && isListening && introState === 'active' && <ListeningDot />}

        {!isSpeaking && introState === 'muted' && (
          <span className="w-2 h-2 rounded-full bg-gray-500" aria-hidden="true" />
        )}

        {introState === 'waiting' && (
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
        )}

        {(introState === 'ready_to_activate' || isStopped) && !isSpeaking && (
          <span className="w-2 h-2 rounded-full bg-cyan/60" aria-hidden="true" />
        )}

        <span className="text-xs font-mono text-text-secondary whitespace-nowrap">
          {statusLabel(introState, isListening, isSpeaking)}
        </span>

        {transcript && (isPersistentActive || isSpeaking) && (
          <span className="hidden sm:block text-xs text-text-muted italic max-w-xs truncate">
            &quot;{transcript}&quot;
          </span>
        )}
      </div>

      {/* ── Right: controls — no close/stop button ───────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Restart prompt when session ended */}
        {isStopped && (
          <button
            onClick={activate}
            className="px-4 py-1.5 rounded-full border border-cyan/60 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 hover:border-cyan transition-colors"
            title="Restart ARIA voice agent"
          >
            🔄 Restart ARIA
          </button>
        )}

        {/* Activate prompt */}
        {introState === 'ready_to_activate' && (
          <button
            onClick={activate}
            className="px-4 py-1.5 rounded-full border border-cyan/60 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 hover:border-cyan transition-colors animate-pulse"
            title="Start ARIA voice agent"
          >
            🎙 Talk to ARIA
          </button>
        )}

        {/* Mute when active */}
        {introState === 'active' && (
          <button
            onClick={mute}
            className="px-3 py-1.5 rounded-full border border-border bg-bg-card text-text-secondary text-xs font-semibold hover:border-amber/40 hover:text-amber transition-colors"
            title="Mute ARIA"
          >
            🔇 Mute
          </button>
        )}

        {/* Unmute when muted */}
        {introState === 'muted' && (
          <button
            onClick={unmute}
            className="px-3 py-1.5 rounded-full border border-cyan/40 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 transition-colors"
            title="Unmute ARIA"
          >
            🔊 Unmute
          </button>
        )}

        {/* Voice interrupt toggle + pause while speaking / waiting */}
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

        {/* Resume when paused */}
        {introState === 'paused' && (
          <button
            onClick={resume}
            className="px-3 py-1.5 rounded-full border border-cyan/40 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 transition-colors"
          >
            ▶ Resume
          </button>
        )}

        {/* NOTE: No close/stop button. The bar is permanent on the home page. */}
      </div>
    </div>
  );
};