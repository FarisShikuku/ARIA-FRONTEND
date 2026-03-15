/**
 * useNavigationSession.ts
 *
 * CHANGES vs previous version:
 *
 * 1. facingMode OPTION ADDED — defaults to 'environment' (rear camera)
 *    WHY: Navigation points the camera at the world for obstacle detection.
 *    Previously useMediaCapture was called with no facingMode, so it defaulted
 *    to 'user' (front camera) — wrong for navigation.
 *    The navigate/page.tsx passes cameraFacing state here, and when the user
 *    presses the flip button the state updates, which changes this prop,
 *    which triggers useMediaCapture to restart the stream with the new camera.
 *
 * 2. hasMultipleCameras EXPORTED
 *    WHY: navigate/page.tsx passes this to NavigationHUD → CameraFeed to
 *    conditionally show the flip button. Single-camera devices never see it.
 *
 * Everything else (activate, GPS, route, detections, agent state) is unchanged.
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import { useAriaIntro, type IntroState } from './useAriaIntro'
import { useMediaCapture } from './useMediaCapture'
import { useGeolocation, type Environment } from './useGeolocation'
import { useAgentState, type AgentState } from './useAgentState'
import { useGoogleMapsRoute, type MapsRoute, type TravelMode } from './useGoogleMapsRoute'

export interface DetectionResult {
  label: string
  confidence: number
  urgency: number
  direction: string | null
  distance_hint: string | null
  bbox: { x: number; y: number; w: number; h: number } | null
}

export interface UseNavigationSessionOptions {
  /** Which camera to open. Default: 'environment' (rear) — points at the world. */
  facingMode?: 'environment' | 'user'
}

export interface UseNavigationSessionReturn {
  introState: IntroState
  sessionId: string | null
  activate: () => Promise<void>
  stop: () => void
  mute: () => void
  unmute: () => void
  pause: () => void
  resume: () => void
  enableVoice: () => void
  disableVoice: () => void
  isSpeaking: boolean
  isListening: boolean
  transcript: string
  videoRef: RefObject<HTMLVideoElement | null>
  isCapturing: boolean
  startCapture: () => Promise<void>
  stopCapture: () => void
  cameraError: string | null
  /** true when the device has more than one camera — show flip button */
  hasMultipleCameras: boolean
  environment: Environment
  position: GeolocationCoordinates | null
  accuracy: number | null
  gpsError: string | null
  isTrackingGPS: boolean
  detections: DetectionResult[]
  agentState: AgentState
  urgencyScore: number
  isConnected: boolean
  route: MapsRoute | null
  currentAddress: string | null
  travelMode: TravelMode
  setTravelMode: (mode: TravelMode) => void
  calculateRoute: (destination: string) => Promise<void>
  clearRoute: () => void
  destination: string | null
  setDestination: (d: string | null) => void
}

export function useNavigationSession(
  { facingMode = 'environment' }: UseNavigationSessionOptions = {}
): UseNavigationSessionReturn {

  const [detections, setDetections] = useState<DetectionResult[]>([])
  const [lastWsMessage, setLastWsMessage] = useState<any>(null)
  const [destination, setDestination] = useState<string | null>(null)

  const aria = useAriaIntro()

  useEffect(() => {
    const unsubscribe = aria.subscribeToMessages((msg: any) => {
      if (!msg?.type) return
      const { type } = msg
      if (type === 'detection') {
        setDetections(msg.detections ?? [])
        setLastWsMessage(msg)
      } else if (type === 'agent_state') {
        setLastWsMessage(msg)
      } else if (type === 'environment_update') {
        setLastWsMessage(msg)
      } else if (type === 'interrupted') {
        setLastWsMessage(msg)
        setDetections([])
      }
    })
    return unsubscribe
  }, [aria.subscribeToMessages])

  const isSessionActive = aria.introState === 'active' || aria.introState === 'muted'

  const {
    videoRef,
    isCapturing,
    startCapture,
    stopCapture,
    error: cameraError,
    hasMultipleCameras,   // ← NEW: surfaced from useMediaCapture
  } = useMediaCapture({
    sendFrame: aria.sendBinary,
    enabled: isSessionActive,
    fps: 1,
    quality: 0.7,
    maxDimension: 768,
    facingMode,   // ← NEW: 'environment' by default; updates when user flips camera
  })

  useEffect(() => {
    if (isSessionActive && !isCapturing) {
      startCapture().catch(console.error)
    }
    if (!isSessionActive && isCapturing) {
      stopCapture()
    }
  }, [isSessionActive]) // eslint-disable-line react-hooks/exhaustive-deps

  const gpsTextSender = useCallback((msg: object) => {
    aria.sendText(JSON.stringify(msg))
  }, [aria.sendText])

  const {
    position,
    environment,
    accuracy,
    error: gpsError,
    isTracking: isTrackingGPS,
  } = useGeolocation({
    sendText: gpsTextSender,
    enabled: isSessionActive,
    minDistanceM: 5,
    maxIntervalMs: 10_000,
  })

  const { currentState: agentState, urgencyScore } = useAgentState({
    wsMessage: lastWsMessage,
    isSpeaking: aria.isSpeaking,
    mode: 'navigation',
  })

  const {
    route,
    isLoading: routeLoading,
    error: routeError,
    currentAddress,
    travelMode,
    setTravelMode,
    calculateRoute: calcRoute,
    clearRoute,
  } = useGoogleMapsRoute(position)

  const addressAnnouncedRef = useRef(false)
  useEffect(() => {
    if (!currentAddress || addressAnnouncedRef.current || !isSessionActive) return
    addressAnnouncedRef.current = true
    aria.sendText(JSON.stringify({
      type: 'control',
      action: 'update_context',
      context: {
        instruction: `The user's current location is: ${currentAddress}. ` +
          `Announce this to them now: say "You are currently at ${currentAddress}." ` +
          `Then wait for their next instruction.`,
      },
    }))
  }, [currentAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  const routeAnnouncedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!route || !destination) return
    if (routeAnnouncedRef.current === destination) return
    routeAnnouncedRef.current = destination
    const first = route.steps[0]?.instruction ?? 'Follow the route on screen'
    aria.sendText(JSON.stringify({
      type: 'control',
      action: 'update_context',
      context: {
        instruction: `A route to "${destination}" has been calculated. ` +
          `Total: ${route.totalDistance}, estimated ${route.totalDuration}. ` +
          `Tell the user: "Route found. ${route.totalDistance}, about ${route.totalDuration}. ` +
          `First: ${first}" — then guide them step by step as they move.`,
      },
    }))
  }, [route]) // eslint-disable-line react-hooks/exhaustive-deps

  const calculateRoute = useCallback(async (dest: string) => {
    setDestination(dest)
    await calcRoute(dest)
  }, [calcRoute])

  return {
    introState: aria.introState,
    sessionId: aria.sessionId,
    activate: () => aria.activate('navigation'),
    stop: aria.stop,
    mute: aria.mute,
    unmute: aria.unmute,
    pause: aria.pause,
    resume: aria.resume,
    enableVoice: aria.enableVoice,
    disableVoice: aria.disableVoice,
    isSpeaking: aria.isSpeaking,
    isListening: aria.isListening,
    transcript: aria.transcript,
    videoRef,
    isCapturing,
    startCapture,
    stopCapture,
    cameraError,
    hasMultipleCameras,   // ← NEW
    environment,
    position,
    accuracy,
    gpsError,
    isTrackingGPS,
    detections,
    agentState,
    urgencyScore,
    isConnected: aria.geminiState === 'ready' ||
                 aria.geminiState === 'speaking' ||
                 aria.geminiState === 'listening',
    route,
    currentAddress,
    travelMode,
    setTravelMode,
    calculateRoute,
    clearRoute,
    destination,
    setDestination,
  }
}