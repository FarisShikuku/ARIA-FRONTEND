'use client';

/**
 * src/app/navigate/page.tsx — MODIFIED
 *
 * CHANGE: When autostart=true (coming from home CTA or navbar link), the
 * gate screen is never shown at all. Instead a minimal full-screen init
 * overlay is displayed while permissions are requested and the session
 * starts, then the NavigationHUD appears directly.
 *
 * The gate screen (with its manual "Start Navigation" button) is now only
 * shown when the user navigates to /navigate with no autostart param — e.g.
 * a direct URL visit or a back-navigation where intent is ambiguous.
 *
 * WHY: Clicking "Start Navigation" on the home page or "Navigation" in the
 * navbar already expresses the user's intent. Making them click a second
 * "Start Navigation" button on the navigate page is a redundant step, and
 * for a blind user reading with a screen reader it's a significant barrier.
 */

import React, { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter }          from 'next/navigation';
import { useNavigationSession }                from '@/hooks/useNavigationSession';
import { NavigationHUD }                       from '@/components/navigation/NavigationHUD';

// ── Default export: Suspense shell (required by Next.js for useSearchParams) ──

export default function NavigatePage() {
  return (
    <Suspense fallback={<FullScreenLoader label="Loading…" />}>
      <NavigateContent />
    </Suspense>
  );
}

// ── Inner component ───────────────────────────────────────────────────────────

function NavigateContent() {
  const nav          = useNavigationSession();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const autostart    = searchParams.get('autostart') === 'true';

  const autostartFired = useRef(false);

  // Auto-activate as soon as the session is ready — no user interaction needed.
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

  const isStopped = nav.introState === 'stopped';

  // ── Autostart path: never show the gate screen ───────────────────────────
  if (autostart) {
    if (isActive) {
      return (
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
      );
    }

    // Session ended — show restart / home options (no "Start Navigation" button)
    if (isStopped) {
      return <StoppedScreen onRestart={nav.activate} onHome={() => router.push('/')} />;
    }

    // Still initialising / requesting permissions — show a thin loader only
    return (
      <FullScreenLoader
        label={
          nav.introState === 'idle' || nav.introState === 'waiting'
            ? 'Requesting permissions…'
            : 'Starting ARIA…'
        }
      />
    );
  }

  // ── Manual path: /navigate with no autostart param ───────────────────────
  return (
    <div className="w-full min-h-screen bg-black">
      {!isActive && (
        <GateScreen
          introState={nav.introState}
          sessionId={nav.sessionId}
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

// ── Shared UI pieces ──────────────────────────────────────────────────────────

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen gap-4 px-6 bg-black">
      <div className="w-10 h-10 rounded-full border-2 border-cyan/20 border-t-cyan animate-spin" />
      <p className="font-mono text-sm text-zinc-400 animate-pulse">{label}</p>
      <p className="text-xs text-zinc-600 text-center max-w-xs">
        Allow microphone and camera access when prompted
      </p>
    </div>
  );
}

function StoppedScreen({
  onRestart,
  onHome,
}: {
  onRestart: () => Promise<void>;
  onHome: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen gap-8 px-6 bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">Session Ended</h1>
        <p className="mt-2 text-zinc-400 text-sm">ARIA navigation has stopped</p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onRestart}
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
    </div>
  );
}

// ── Manual gate screen (only shown without autostart param) ──────────────────

interface GateScreenProps {
  introState: string;
  sessionId:  string | null;
  onActivate: () => Promise<void>;
  onHome:     () => void;
}

function GateScreen({ introState, sessionId, onActivate, onHome }: GateScreenProps) {
  const isConnecting   = introState === 'idle' || introState === 'waiting';
  const isReadyToStart = introState === 'ready_to_activate';
  const isStopped      = introState === 'stopped';

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen gap-8 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">ARIA Navigation</h1>
        <p className="mt-2 text-zinc-400 text-sm">Real-time obstacle detection and voice guidance</p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {isConnecting && (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-zinc-400">Connecting to ARIA…</span>
          </>
        )}
        {isReadyToStart && (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400">Ready</span>
          </>
        )}
        {isStopped && (
          <>
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-red-400">Session ended</span>
          </>
        )}
      </div>

      {isReadyToStart && (
        <>
          <button
            onClick={onActivate}
            className="px-8 py-4 rounded-2xl text-lg font-semibold bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white transition-colors duration-150 shadow-lg shadow-emerald-500/30 focus:outline-none focus:ring-4 focus:ring-emerald-500/50"
            aria-label="Start ARIA navigation — requires microphone and camera access"
          >
            Start Navigation
          </button>
          <p className="text-xs text-zinc-500 text-center max-w-xs">
            Requires microphone and camera access.
          </p>
        </>
      )}

      {isStopped && (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onActivate}
            className="px-8 py-4 rounded-2xl text-lg font-semibold bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white transition-colors duration-150 shadow-lg shadow-emerald-500/30 focus:outline-none focus:ring-4 focus:ring-emerald-500/50"
          >
            🔄 Start Again
          </button>
          <button onClick={onHome} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2">
            ← Back to Home
          </button>
        </div>
      )}

      {sessionId && process.env.NODE_ENV === 'development' && (
        <p className="absolute bottom-4 text-xs text-zinc-700 font-mono">session: {sessionId}</p>
      )}
    </div>
  );
}