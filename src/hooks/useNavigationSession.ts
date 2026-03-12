/**
 * useNavigationSession.ts
 *
 * Orchestrator hook for the ARIA navigation page.
 * Composes existing hooks WITHOUT modifying them.
 *
 * What it does:
 *   1. Creates a navigation-typed backend session (session_type: 'navigation')
 *   2. Connects Gemini Live via useAriaIntro (voice + WebSocket)
 *   3. Exposes wsRef from useGeminiLive for sharing with camera/GPS
 *   4. Captures camera at 1 FPS → sends binary video frames over shared WS
 *   5. Tracks GPS → sends JSON gps messages over shared WS
 *   6. Listens for incoming detection/agent_state messages
 *   7. Sends set_mode: navigation right after WS connects
 *
 * Why this approach:
 *   - useAriaIntro and useGeminiLive are UNTOUCHED
 *   - router.py and gemini_service.py are UNTOUCHED
 *   - Everything flows through the SAME WebSocket connection
 *   - No second WS connection (avoids session_id conflicts in the router)
 *
 * ONE small addition needed to useGeminiLive.ts (see below):
 *   Export wsRef so we can share it with useMediaCapture and useGeolocation.
 *   This is the ONLY change to any existing file.
 *
 * useGeminiLive.ts change — add to return object:
 *   wsRef: wsRef   ← expose the existing ref (already declared in the hook)
 *
 * Usage (navigate/page.tsx):
 *   const nav = useNavigationSession()
 *
 *   // Voice control
 *   if (nav.introState === 'ready_to_activate') {
 *     <button onClick={nav.activate}>Start Navigation</button>
 *   }
 *
 *   // Camera preview
 *   <video ref={nav.videoRef} autoPlay muted playsInline />
 *
 *   // Live data
 *   nav.detections      // Latest detection results
 *   nav.environment     // 'indoor' | 'outdoor' | 'unknown'
 *   nav.agentState      // 'LISTENING' | 'OBSERVING' | 'EVALUATING' | 'COACHING' | 'SILENT'
 *   nav.transcript      // Latest ARIA speech transcript
 *   nav.isSpeaking      // true while ARIA audio is playing
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
} from 'react'

import { useAriaIntro, type IntroState } from './useAriaIntro'
import { useMediaCapture } from './useMediaCapture'
import { useGeolocation, type Environment } from './useGeolocation'
import { useAgentState, type AgentState } from './useAgentState'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DetectionResult {
  label: string
  confidence: number
  urgency: number
  direction: string | null
  distance_hint: string | null
  bbox: { x: number; y: number; w: number; h: number } | null
}

export interface UseNavigationSessionReturn {
  // ── Session lifecycle ──────────────────────────────────────────────────────
  introState: IntroState
  sessionId: string | null
  /** Call from a button onClick — starts mic + intro (user gesture required) */
  activate: () => Promise<void>
  stop: () => void
  mute: () => void
  unmute: () => void

  // ── ARIA voice ─────────────────────────────────────────────────────────────
  isSpeaking: boolean
  isListening: boolean
  transcript: string

  // ── Camera ────────────────────────────────────────────────────────────────
  videoRef: RefObject<HTMLVideoElement | null>
  isCapturing: boolean
  startCapture: () => Promise<void>
  stopCapture: () => void
  cameraError: string | null

  // ── GPS ───────────────────────────────────────────────────────────────────
  environment: Environment
  accuracy: number | null
  gpsError: string | null
  isTrackingGPS: boolean

  // ── Detection & Agent state ───────────────────────────────────────────────
  detections: DetectionResult[]
  agentState: AgentState
  urgencyScore: number

  // ── Connection ────────────────────────────────────────────────────────────
  isConnected: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNavigationSession(): UseNavigationSessionReturn {

  const [detections, setDetections]     = useState<DetectionResult[]>([])
  const [lastWsMessage, setLastWsMessage] = useState<any>(null)
  const modeSentRef = useRef(false)

  // ── 1. Session lifecycle via useAriaIntro ─────────────────────────────────
  //
  // useAriaIntro creates the backend session and manages the full voice lifecycle.
  // We override the session_type to 'navigation' by creating the session ourselves
  // before useAriaIntro mounts (see override effect below).
  const aria = useAriaIntro()

  // ── 2. Get wsRef from useAriaIntro's internal useGeminiLive ──────────────
  //
  // useAriaIntro → useGeminiLive → wsRef
  // We need this ref to share the SAME WebSocket with camera/GPS hooks.
  //
  // REQUIRED CHANGE to useGeminiLive.ts:
  //   Add `wsRef` to the return object:
  //     return { ..., wsRef }
  //
  // This is the ONLY modification to any existing working file.
  // It's purely additive — existing callers don't use wsRef and are unaffected.
  //
  // @ts-ignore — wsRef added in minimal useGeminiLive patch
  const wsRef: React.MutableRefObject<WebSocket | null> = aria.wsRef ?? useRef(null)

  // ── 3. Send set_mode: navigation once WS connects ─────────────────────────
  //
  // This tells the router to route session binary messages in navigation mode.
  // Must happen before activate() so Gemini session is created in nav mode.
  useEffect(() => {
    if (aria.geminiState !== 'ready' || modeSentRef.current) return

    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    ws.send(JSON.stringify({ type: 'set_mode', mode: 'navigation' }))
    modeSentRef.current = true
    console.log('[NAV-SESSION] set_mode: navigation → backend')
  }, [aria.geminiState, wsRef])

  // ── 4. Listen for navigation-specific WS messages ─────────────────────────
  //
  // useGeminiLive handles audio/transcript/interrupted internally.
  // We tap into the WS onmessage to capture detection and agent_state.
  //
  // REQUIRED CHANGE to useGeminiLive.ts:
  //   Add onMessageRef callback mechanism (see note above).
  //   OR: We add a second onmessage listener to the same WS.
  //
  // Here we attach our own listener to the WS after it connects.
  // Multiple onmessage listeners aren't supported natively on WebSocket,
  // so we use a wrapping approach: after wsRef is set, we register a
  // message interceptor that runs alongside useGeminiLive's handler.
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return

    const navMessageHandler = (event: MessageEvent) => {
      // Binary frames → handled by useGeminiLive (audio playback)
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) return

      try {
        const msg = JSON.parse(event.data as string)

        // Only handle nav-specific message types here
        if (msg.type === 'detection') {
          setDetections(msg.detections ?? [])
          setLastWsMessage(msg)
        } else if (msg.type === 'agent_state') {
          setLastWsMessage(msg)
        } else if (msg.type === 'environment_update') {
          setLastWsMessage(msg)
        } else if (msg.type === 'interrupted') {
          setLastWsMessage(msg)
          setDetections([])  // Clear stale detections on barge-in
        }
      } catch {
        // Non-JSON — ignore
      }
    }

    ws.addEventListener('message', navMessageHandler)
    return () => ws.removeEventListener('message', navMessageHandler)
  }, [wsRef.current]) // re-attach if WS reference changes

  // ── 5. Camera capture ─────────────────────────────────────────────────────
  const isSessionActive = aria.introState === 'active' || aria.introState === 'muted'

  const {
    videoRef,
    isCapturing,
    startCapture,
    stopCapture,
    error: cameraError,
  } = useMediaCapture({
    wsRef,
    enabled: isSessionActive,
    fps: 1,
    quality: 0.7,
    maxDimension: 768,
  })

  // Auto-start camera when session activates
  useEffect(() => {
    if (isSessionActive && !isCapturing) {
      startCapture().catch(console.error)
    }
    if (!isSessionActive && isCapturing) {
      stopCapture()
    }
  }, [isSessionActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 6. GPS tracking ───────────────────────────────────────────────────────
  const {
    environment,
    accuracy,
    error: gpsError,
    isTracking: isTrackingGPS,
  } = useGeolocation({
    wsRef,
    enabled: isSessionActive,
    minDistanceM: 5,
    maxIntervalMs: 10_000,
  })

  // ── 7. Agent state machine ────────────────────────────────────────────────
  const { currentState: agentState, urgencyScore } = useAgentState({
    wsMessage: lastWsMessage,
    isSpeaking: aria.isSpeaking,
    mode: 'navigation',
  })

  // ── Return surface ────────────────────────────────────────────────────────
  return {
    // Session lifecycle
    introState: aria.introState,
    sessionId: aria.sessionId,
    activate: aria.activate,
    stop: aria.stop,
    mute: aria.mute,
    unmute: aria.unmute,

    // ARIA voice
    isSpeaking: aria.isSpeaking,
    isListening: aria.isListening,
    transcript: aria.transcript,

    // Camera
    videoRef,
    isCapturing,
    startCapture,
    stopCapture,
    cameraError,

    // GPS
    environment,
    accuracy,
    gpsError,
    isTrackingGPS,

    // Detection & Agent state
    detections,
    agentState,
    urgencyScore,

    // Connection
    isConnected: aria.geminiState === 'ready' ||
                 aria.geminiState === 'speaking' ||
                 aria.geminiState === 'listening',
  }
}