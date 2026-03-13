'use client';

/**
 * src/app/navigate/page.tsx — MODIFIED
 *
 * CHANGES vs previous version:
 *
 * 1. AUTOSTART — skip gate screen when coming from home page.
 *    WHY: Clicking "Start Navigation" on the home page now navigates to
 *    /navigate?autostart=true. Previously the user would land on this gate
 *    screen and have to click "Start Navigation" again — a redundant step.
 *
 *    Implementation: useSearchParams() reads the `autostart` param.
 *    A useEffect fires once when introState reaches 'ready_to_activate' AND
 *    autostart=true, automatically calling onActivate(). The gate screen is
 *    shown briefly with a "Starting…" label while the session initialises,
 *    then the NavigationHUD mounts as normal.
 *
 *    When navigating to /navigate directly (no param), behaviour is unchanged —
 *    the gate screen shows and the user clicks "Start Navigation" manually.
 *
 * 2. REOPEN LOGIC — restart after "End Session".
 *    WHY: After clicking "End Session" the gate screen shows introState='stopped'
 *    with no way to restart — the user was stuck and had to reload the page.
 *
 *    Implementation: the stopped state now renders a "Start Again" button that
 *    calls onActivate() to begin a new session, and an "← Home" link.
 *    The existing stopped status indicator is kept unchanged.
 *
 * 3. GateScreen "connecting" label updated to show "Starting…" when
 *    autostart is in progress, so the user has feedback that something is
 *    happening after they clicked the home-page button.
 *
 * All other logic (NavigationHUD rendering, isActive check) is unchanged.
 */

import React, { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useNavigationSession }       from '@/hooks/useNavigationSession';
import { NavigationHUD }              from '@/components/navigation/NavigationHUD';

export default function NavigatePage() {
  const nav          = useNavigationSession();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const autostart    = searchParams.get('autostart') === 'true';

  // Track whether we've already fired autostart so it doesn't re-trigger
  const autostartFired = useRef(false);

  useEffect(() => {
    if (autostart && nav.introState === 'ready_to_activate' && !autostartFired.current) {
      autostartFired.current = true;
      nav.activate();
    }
  }, [autostart, nav.introState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive =
    nav.introState === 'active' ||
    nav.introState === 'muted'  ||
    nav.introState === 'paused';

  return (
    <div className="w-full min-h-screen bg-black">
      {!isActive && (
        <GateScreen
          introState={nav.introState}
          sessionId={nav.sessionId}
          autostart={autostart}
          onActivate={nav.activate}
          onHome={() => router.push('/')}
        />
      )}

      {isActive && (
        <NavigationHUD
          agentState={nav.agentState}
          urgencyScore={nav.urgencyScore}
          isSpeaking={nav.isSpeaking}
          isListening={nav.isListening}
          transcript={nav.transcript}
          videoRef={nav.videoRef}
          isCapturing={nav.isCapturing}
          detections={nav.detections}
          environment={nav.environment}
          gpsAccuracy={nav.accuracy}
          onMute={nav.mute}
          onUnmute={nav.unmute}
          onStop={nav.stop}
          sessionId={nav.sessionId}
        />
      )}
    </div>
  );
}

// ── Gate Screen ───────────────────────────────────────────────────────────────

interface GateScreenProps {
  introState: string;
  sessionId:  string | null;
  autostart:  boolean;
  onActivate: () => Promise<void>;
  onHome:     () => void;
}

function GateScreen({ introState, sessionId, autostart, onActivate, onHome }: GateScreenProps) {
  const isConnecting   = introState === 'idle' || introState === 'waiting';
  const isReadyToStart = introState === 'ready_to_activate';
  const isStopped      = introState === 'stopped';

  // When autostart is active and we're still connecting, show "Starting…"
  const connectingLabel = autostart && isConnecting
    ? 'Starting ARIA…'
    : 'Connecting to ARIA…';

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen gap-8 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">ARIA Navigation</h1>
        <p className="mt-2 text-zinc-400 text-sm">Real-time obstacle detection and voice guidance</p>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm">
        {isConnecting && (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-zinc-400">{connectingLabel}</span>
          </>
        )}
        {isReadyToStart && !autostart && (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400">Ready</span>
          </>
        )}
        {/* autostart=true + ready: show "Starting…" while the useEffect fires */}
        {isReadyToStart && autostart && (
          <>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400">Starting…</span>
          </>
        )}
        {isStopped && (
          <>
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-red-400">Session ended</span>
          </>
        )}
      </div>

      {/* Manual start button — shown only when not autostaring */}
      {isReadyToStart && !autostart && (
        <>
          <button
            onClick={onActivate}
            className="px-8 py-4 rounded-2xl text-lg font-semibold bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white transition-colors duration-150 shadow-lg shadow-emerald-500/30 focus:outline-none focus:ring-4 focus:ring-emerald-500/50"
            aria-label="Start ARIA navigation — requires microphone and camera access"
          >
            Start Navigation
          </button>
          <p className="text-xs text-zinc-500 text-center max-w-xs">
            Requires microphone and camera access. ARIA will guide you with real-time voice alerts.
          </p>
        </>
      )}

      {/*
       * REOPEN LOGIC — shown after "End Session" is clicked.
       * "Start Again" creates a new session; "← Home" goes back to the landing page.
       */}
      {isStopped && (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onActivate}
            className="px-8 py-4 rounded-2xl text-lg font-semibold bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white transition-colors duration-150 shadow-lg shadow-emerald-500/30 focus:outline-none focus:ring-4 focus:ring-emerald-500/50"
            aria-label="Start a new ARIA navigation session"
          >
            🔄 Start Again
          </button>
          <button
            onClick={onHome}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
          >
            ← Back to Home
          </button>
        </div>
      )}

      {sessionId && process.env.NODE_ENV === 'development' && (
        <p className="absolute bottom-4 text-xs text-zinc-700 font-mono">
          session: {sessionId}
        </p>
      )}
    </div>
  );
}