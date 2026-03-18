'use client';

/**
 * AriaIntroBar.tsx
 *
 * CHANGES vs previous version:
 *
 * 1. IDLE STATE: no longer returns null.
 *    WHY: The bar was invisible for ~500ms while /api/v1/sessions/start was
 *    in-flight, causing a layout jump when it appeared. Now shows a "Starting…"
 *    loading state immediately — the bar occupies its fixed position from the
 *    first render, matching the behaviour of every other navbar element.
 *
 * 2. NEW PROP: onSessionReady(sendBinary)
 *    WHY: The home page needs to wire the camera feed (HomeCameraFeed) to the
 *    Gemini session so ARIA can see video. AriaIntroBar owns the session via
 *    useAriaIntro(), so it exposes sendBinary via this callback once the session
 *    transitions out of idle. The callback fires once. Callers that don't need
 *    camera (other pages) simply omit the prop — backward compatible.
 *
 * 3. NEW PROP: cameraConnected (optional boolean)
 *    WHY: Gives the bar a way to show a subtle camera status indicator so ARIA
 *    and the user both have visual confirmation that the camera feed is live.
 *    Undefined = no indicator shown (backward compatible with other pages).
 *
 * 4. INTERNAL: mic permission check via navigator.permissions
 *    WHY: When the user denies microphone, startListening() fails silently in
 *    useAriaIntro — there was zero UI feedback. Now the bar detects 'denied'
 *    state and surfaces a persistent inline warning with "How to allow" text,
 *    making clear that ARIA is voice-only and text chat is not supported.
 *
 * Everything else (positioning, state machine, controls, accessibility)
 * is unchanged from the previous version.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAriaIntro, IntroState } from '@/hooks/useAriaIntro';

// ── Sub-components (unchanged) ────────────────────────────────────────────────

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
  if (isListening)                              return 'Listening…';
  switch (state) {
    case 'idle':              return 'Starting…';
    case 'waiting':           return 'Initialising…';
    case 'ready_to_activate': return 'ARIA — Ready';
    case 'active':            return 'ARIA — Active';
    case 'muted':             return 'ARIA — Muted';
    case 'paused':            return 'Paused';
    case 'stopped':           return 'Session ended — tap to restart';
    default:                  return 'ARIA';
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AriaIntroBarProps {
  /**
   * Called once when the session transitions out of idle, exposing the
   * sendBinary function so the home page can wire its camera feed to Gemini.
   * Optional — omit on pages that don't need camera access from this bar.
   */
  onSessionReady?: (sendBinary: (data: ArrayBuffer) => void) => void;

  /**
   * Whether the home-page camera feed is actively capturing and sending frames.
   * When provided, a subtle indicator is shown in the bar.
   * Undefined = no indicator (backward compatible).
   */
  cameraConnected?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AriaIntroBar: React.FC<AriaIntroBarProps> = ({
  onSessionReady,
  cameraConnected,
}) => {
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
    sendBinary,
  } = useAriaIntro();

  // ── Mic permission detection ─────────────────────────────────────────────
  const [micPermission, setMicPermission] = useState<PermissionState | 'unknown'>('unknown');

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setMicPermission(status.state);
        status.onchange = () => setMicPermission(status.state);
      })
      .catch(() => {/* permissions API not supported — stay 'unknown' */});
  }, []);

  const micDenied = micPermission === 'denied';

  // ── Fire onSessionReady once when session becomes available ──────────────
  const sessionReadyFiredRef = useRef(false);

  useEffect(() => {
    if (
      introState !== 'idle' &&
      sendBinary &&
      onSessionReady &&
      !sessionReadyFiredRef.current
    ) {
      sessionReadyFiredRef.current = true;
      onSessionReady(sendBinary);
    }
  }, [introState, sendBinary, onSessionReady]);

  // ── Derived state (unchanged) ─────────────────────────────────────────────
  const isActuallyActive  = isSpeaking || isListening;
  const isStopped         = introState === 'stopped' && !isActuallyActive;
  const isPersistentActive = introState === 'active' || introState === 'muted' || isActuallyActive;

  // ── Shared bar wrapper classNames ─────────────────────────────────────────
  const barClass = `
    fixed top-16 left-0 right-0 z-40
    flex items-center justify-between
    px-4 md:px-8 py-2.5
    border-b border-cyan/20
    bg-bg-deep/95 backdrop-blur-md
    transition-opacity duration-300
  `;

  // ── IDLE: show loading state immediately — never return null ──────────────
  if (introState === 'idle') {
    return (
      <div
        role="region"
        aria-label="ARIA Voice Assistant"
        aria-live="polite"
        className={barClass + ' opacity-70'}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full bg-cyan/40 animate-pulse"
            aria-hidden="true"
          />
          <span className="text-xs font-mono text-text-muted">
            ARIA — Starting…
          </span>
        </div>
      </div>
    );
  }

  // ── Normal render ─────────────────────────────────────────────────────────
  return (
    <div
      role="region"
      aria-label="ARIA Voice Assistant"
      aria-live="polite"
      className={barClass + (isStopped ? ' opacity-80' : ' opacity-100')}
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

        {/* Camera connected indicator — only shown when prop is provided */}
        {cameraConnected !== undefined && (
          <span
            className={`hidden md:flex items-center gap-1 text-[10px] font-mono ${
              cameraConnected ? 'text-cyan/50' : 'text-text-muted/40'
            }`}
            title={cameraConnected ? 'Camera feed active — ARIA can see' : 'Camera not connected'}
          >
            <span>📷</span>
            <span>{cameraConnected ? 'Cam ✓' : 'Cam ✗'}</span>
          </span>
        )}

        {/* Mic denied warning — persistent, inline */}
        {micDenied && (
          <span
            className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 bg-red-950/40 shrink-0"
            title="ARIA is voice-only. Microphone access is required."
          >
            🎤 Mic blocked — allow in browser settings
          </span>
        )}
      </div>

      {/* ── Right: controls (unchanged) ─────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {isStopped && (
          <button
            onClick={() => activate()}
            className="px-4 py-1.5 rounded-full border border-cyan/60 bg-cyan/10 text-cyan text-xs font-semibold hover:bg-cyan/20 hover:border-cyan transition-colors"
            title="Restart ARIA voice agent"
          >
            🔄 Restart ARIA
          </button>
        )}

        {introState === 'ready_to_activate' && (
          <button
            onClick={() => activate()}
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
      </div>
    </div>
  );
};