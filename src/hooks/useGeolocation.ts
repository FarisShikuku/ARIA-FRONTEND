/**
 * useGeolocation.ts
 *
 * Tracks the user's GPS position and streams updates to the backend.
 * The backend's gps_handler.py uses accuracy to classify indoor/outdoor.
 *
 * Wire format (JSON over WS):
 *   { type: 'gps', lat, lng, accuracy, speed, bearing }
 *
 * Sends an update when EITHER:
 *   - User has moved more than minDistanceM (default: 5m), OR
 *   - maxIntervalMs has passed since last update (default: 10s)
 *
 * Also classifies environment locally (mirrors gps_handler.py thresholds)
 * so the frontend can show Indoor/Outdoor badge without waiting for backend.
 *
 * Usage:
 *   const { environment, accuracy, isTracking, error } = useGeolocation({
 *     wsRef,
 *     enabled: sessionActive,
 *   })
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Environment = 'outdoor' | 'indoor' | 'unknown'

interface UseGeolocationOptions {
  /** WebSocket ref — shares the same WS as useGeminiLive */
  wsRef: React.MutableRefObject<WebSocket | null>
  /** Only track when true */
  enabled?: boolean
  /** Min distance moved (meters) to trigger a send (default: 5m) */
  minDistanceM?: number
  /** Max ms between sends even if not moved (default: 10000) */
  maxIntervalMs?: number
}

export interface UseGeolocationReturn {
  position: GeolocationCoordinates | null
  environment: Environment
  accuracy: number | null
  isTracking: boolean
  error: string | null
}

// Mirrors gps_handler.py thresholds — keep in sync
const OUTDOOR_MAX_ACCURACY_M = 20   // ≤ 20m  → outdoor
const INDOOR_MIN_ACCURACY_M  = 50   // ≥ 50m  → indoor

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGeolocation({
  wsRef,
  enabled = true,
  minDistanceM = 5,
  maxIntervalMs = 10_000,
}: UseGeolocationOptions): UseGeolocationReturn {

  const [position, setPosition]       = useState<GeolocationCoordinates | null>(null)
  const [environment, setEnvironment] = useState<Environment>('unknown')
  const [accuracy, setAccuracy]       = useState<number | null>(null)
  const [isTracking, setIsTracking]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const watchIdRef     = useRef<number | null>(null)
  const lastSentPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const lastSentTimeRef = useRef<number>(0)
  const updateCountRef  = useRef(0)

  // ── Classify environment from GPS accuracy ────────────────────────────────
  const classifyEnvironment = useCallback((acc: number): Environment => {
    if (acc <= OUTDOOR_MAX_ACCURACY_M) return 'outdoor'
    if (acc >= INDOOR_MIN_ACCURACY_M)  return 'indoor'
    return 'unknown'
  }, [])

  // ── Send GPS update to backend ────────────────────────────────────────────
  const sendGPS = useCallback((coords: GeolocationCoordinates) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    const now = Date.now()
    const last = lastSentPosRef.current
    const timeSinceLast = now - lastSentTimeRef.current

    // Skip if user hasn't moved enough AND interval hasn't elapsed
    if (last) {
      const dist = haversineMeters(
        last.lat, last.lng,
        coords.latitude, coords.longitude,
      )
      if (dist < minDistanceM && timeSinceLast < maxIntervalMs) return
    }

    lastSentPosRef.current = { lat: coords.latitude, lng: coords.longitude }
    lastSentTimeRef.current = now
    updateCountRef.current++

    ws.send(JSON.stringify({
      type:     'gps',
      lat:      coords.latitude,
      lng:      coords.longitude,
      accuracy: coords.accuracy,
      speed:    coords.speed   ?? null,
      bearing:  coords.heading ?? null,
    }))

    const n = updateCountRef.current
    if (n <= 3 || n % 10 === 0) {
      console.log(
        `[GPS] 📍 #${n} → backend: ` +
        `(${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}) ` +
        `accuracy=${coords.accuracy?.toFixed(1)}m ` +
        `env=${classifyEnvironment(coords.accuracy)}`
      )
    }
  }, [wsRef, minDistanceM, maxIntervalMs, classifyEnvironment])

  // ── Start/stop geolocation watch ─────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by this browser')
      return
    }

    setError(null)
    setIsTracking(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = pos.coords
        setPosition(coords)
        setAccuracy(coords.accuracy)
        setEnvironment(classifyEnvironment(coords.accuracy))
        sendGPS(coords)
      },
      (geoError) => {
        console.error('[GPS] ❌ Geolocation error:', geoError.message)
        setError(geoError.message)
        setIsTracking(false)
      },
      {
        enableHighAccuracy: true,   // Essential for indoor/outdoor classification
        timeout: 15_000,
        maximumAge: 5_000,
      },
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setIsTracking(false)
    }
  }, [enabled, sendGPS, classifyEnvironment])

  return { position, environment, accuracy, isTracking, error }
}

// ── Haversine distance ────────────────────────────────────────────────────────

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000  // Earth radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}