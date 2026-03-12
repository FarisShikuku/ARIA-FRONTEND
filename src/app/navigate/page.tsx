'use client'

/**
 * src/app/navigate/page.tsx
 *
 * Navigation mode page — wires useNavigationSession into the existing
 * NavigationHUD component tree.
 *
 * This page:
 *   1. Manages the navigation session lifecycle (start / stop / mute)
 *   2. Shows a "Start Navigation" gate screen until the user clicks activate()
 *      (required for browser mic + camera permissions)
 *   3. Passes live data (detections, agentState, environment, transcript) to
 *      NavigationHUD which renders the existing UI components unchanged
 *   4. Renders the camera <video> element (hidden behind HUD overlay)
 *
 * Existing UI components used (UNCHANGED):
 *   NavigationHUD, AgentStateIndicator, DetectionLog, AriaVoiceCard,
 *   GPSWidget, QuickSOS, CameraFeed, CameraOverlay, HUDPanel, etc.
 *
 * All those components continue to work via props — no changes needed.
 */

import { useEffect, useRef } from 'react'
import { useNavigationSession } from '@/hooks/useNavigationSession'
import { NavigationHUD } from '@/components/navigation/NavigationHUD'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NavigatePage() {
  const nav = useNavigationSession()

  // ── Gate screen: show before user activates ───────────────────────────────
  // useAriaIntro requires a user gesture to start mic + audio context.
  // We show a minimal "Start" screen until introState === 'ready_to_activate'
  // or 'active'. NavigationHUD only mounts after activation.

  const isReady  = nav.introState === 'ready_to_activate'
  const isActive = nav.introState === 'active' ||
                   nav.introState === 'muted'  ||
                   nav.introState === 'paused'

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">

      {/* ── Hidden camera video element ─────────────────────────────────────
          The <video> must be in the DOM so useMediaCapture can draw frames.
          It's visually hidden — CameraFeed component renders its own display
          from the same MediaStream via videoRef. */}
      <video
        ref={nav.videoRef}
        autoPlay
        muted
        playsInline
        className="absolute opacity-0 pointer-events-none w-1 h-1"
        aria-hidden="true"
      />

      {/* ── Pre-activation gate ─────────────────────────────────────────────
          Shown while WS is connecting (introState = 'waiting')
          or once ready (introState = 'ready_to_activate') */}
      {!isActive && (
        <GateScreen
          introState={nav.introState}
          sessionId={nav.sessionId}
          onActivate={nav.activate}
        />
      )}

      {/* ── Main navigation HUD ─────────────────────────────────────────────
          Only mounted after user activates — avoids rendering HUD
          with null/empty data during connection phase */}
      {isActive && (
        <NavigationHUD
          // ── Agent state ──────────────────────────────────────────────────
          agentState={nav.agentState}
          urgencyScore={nav.urgencyScore}

          // ── Voice ────────────────────────────────────────────────────────
          isSpeaking={nav.isSpeaking}
          isListening={nav.isListening}
          transcript={nav.transcript}

          // ── Camera ───────────────────────────────────────────────────────
          videoRef={nav.videoRef}
          isCapturing={nav.isCapturing}

          // ── Detection ────────────────────────────────────────────────────
          detections={nav.detections}

          // ── Location ─────────────────────────────────────────────────────
          environment={nav.environment}
          gpsAccuracy={nav.accuracy}

          // ── Session controls ─────────────────────────────────────────────
          onMute={nav.mute}
          onUnmute={nav.unmute}
          onStop={nav.stop}
          sessionId={nav.sessionId}
        />
      )}
    </div>
  )
}

// ── Gate screen ───────────────────────────────────────────────────────────────

interface GateScreenProps {
  introState: string
  sessionId: string | null
  onActivate: () => Promise<void>
}

function GateScreen({ introState, sessionId, onActivate }: GateScreenProps) {
  const isConnecting    = introState === 'idle' || introState === 'waiting'
  const isReadyToStart  = introState === 'ready_to_activate'
  const isStopped       = introState === 'stopped'

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-8 px-6">

      {/* ARIA logo / heading */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          ARIA Navigation
        </h1>
        <p className="mt-2 text-zinc-400 text-sm">
          Real-time obstacle detection and voice guidance
        </p>
      </div>

      {/* Status indicator */}
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

      {/* Activate button — only shown when WS is ready */}
      {isReadyToStart && (
        <button
          onClick={onActivate}
          className={[
            'px-8 py-4 rounded-2xl text-lg font-semibold',
            'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600',
            'text-white transition-colors duration-150',
            'shadow-lg shadow-emerald-500/30',
            'focus:outline-none focus:ring-4 focus:ring-emerald-500/50',
          ].join(' ')}
          aria-label="Start ARIA navigation — requires microphone and camera access"
        >
          Start Navigation
        </button>
      )}

      {/* Capability info */}
      {isReadyToStart && (
        <p className="text-xs text-zinc-500 text-center max-w-xs">
          Requires microphone and camera access.
          ARIA will guide you with real-time voice alerts.
        </p>
      )}

      {/* Debug: session ID (remove in production) */}
      {sessionId && process.env.NODE_ENV === 'development' && (
        <p className="absolute bottom-4 text-xs text-zinc-700 font-mono">
          session: {sessionId}
        </p>
      )}
    </div>
  )
}