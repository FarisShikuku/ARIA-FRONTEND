/// <reference types="@types/google.maps" />

/**
 * src/hooks/useGoogleMapsRoute.ts
 *
 * WHY THIS FILE EXISTS:
 * Encapsulates all Google Maps Directions API logic in one hook.
 * NavigationHUD and useNavigationSession consume this — no Maps API
 * code lives in components directly.
 *
 * WHAT IT DOES:
 * - Accepts origin (GeolocationCoordinates) + destination (string or LatLng)
 * - Calls Google Maps Directions API via the loaded JS SDK
 * - Returns typed route: steps, total distance, total duration, polyline
 * - Tracks which step is current based on live position proximity
 * - Supports travel modes: WALKING (default), DRIVING, TRANSIT, BICYCLING
 * - Exposes reverse geocode: converts lat/lng → human-readable address string
 *   so ARIA can say "You are at 42 Market Street" instead of raw coordinates
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export type TravelMode = 'WALKING' | 'DRIVING' | 'TRANSIT' | 'BICYCLING'

export interface MapsRouteStep {
  id: string
  instruction: string       // HTML tags stripped
  distance: number          // metres
  duration: number          // seconds
  maneuver: string          // 'turn-left' | 'turn-right' | 'straight' | etc.
  icon: string              // derived from maneuver
  isCurrent: boolean
  startLat: number
  startLng: number
}

export interface MapsRoute {
  steps: MapsRouteStep[]
  totalDistance: string     // e.g. "1.2 km"
  totalDuration: string     // e.g. "15 mins"
  totalDistanceM: number
  totalDurationS: number
  summary: string
}

export interface UseGoogleMapsRouteReturn {
  route: MapsRoute | null
  isLoading: boolean
  error: string | null
  currentAddress: string | null
  travelMode: TravelMode
  setTravelMode: (mode: TravelMode) => void
  calculateRoute: (destination: string) => Promise<void>
  clearRoute: () => void
  reverseGeocode: (lat: number, lng: number) => Promise<string>
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

// Maneuver string → display icon
function maneuverToIcon(maneuver: string): string {
  if (maneuver.includes('left'))       return '↰'
  if (maneuver.includes('right'))      return '↱'
  if (maneuver.includes('uturn'))      return '↩'
  if (maneuver.includes('roundabout')) return '↻'
  if (maneuver.includes('merge'))      return '⤵'
  if (maneuver.includes('ramp'))       return '↗'
  if (maneuver === 'ferry')            return '⛴'
  if (maneuver === 'straight')         return '↑'
  return '▲'
}

// Strip HTML tags from Google Maps step instructions
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Haversine distance in metres between two lat/lng points
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Load the Google Maps JS SDK once
let mapsLoaded = false
let mapsLoading = false
const mapsCallbacks: Array<() => void> = []

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (mapsLoaded) { resolve(); return }
    mapsCallbacks.push(resolve)
    if (mapsLoading) return
    mapsLoading = true

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places,geometry`
    script.async = true
    script.onload = () => {
      mapsLoaded = true
      mapsLoading = false
      mapsCallbacks.forEach(cb => cb())
      mapsCallbacks.length = 0
    }
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(script)
  })
}

export function useGoogleMapsRoute(
  position: GeolocationCoordinates | null
): UseGoogleMapsRouteReturn {
  const [route, setRoute]               = useState<MapsRoute | null>(null)
  const [isLoading, setIsLoading]       = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [currentAddress, setCurrentAddress] = useState<string | null>(null)
  const [travelMode, setTravelMode]     = useState<TravelMode>('WALKING')
  const [mapsReady, setMapsReady]       = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geocoderRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directionsRef  = useRef<any>(null)
  const addressCacheRef = useRef<Map<string, string>>(new Map())
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null)

  // Load Google Maps SDK on mount
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        geocoderRef.current   = new google.maps.Geocoder()
        directionsRef.current = new google.maps.DirectionsService()
        setMapsReady(true)
      })
      .catch(e => setError(e.message))
  }, [])

  // Reverse geocode current position → human-readable address
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    if (addressCacheRef.current.has(key)) return addressCacheRef.current.get(key)!
    if (!geocoderRef.current) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`

    return new Promise((resolve) => {
      geocoderRef.current!.geocode(
        { location: { lat, lng } },
        (results: any, status: any) => {
          if (status === 'OK' && results && results.length > 0) {
            // Try to find a result that is NOT a plus code.
            // Google returns plus codes (JQ43+MJH) for areas with sparse address data.
            // We prefer: street address > neighborhood > sublocality > locality.
            // Walk through all results and pick the most meaningful one.
            let bestAddress: string | null = null

            for (const result of results) {
              const formatted: string = result.formatted_address ?? ''

              // Skip pure plus code results (they look like "JQ43+MJH, City, Country")
              if (/^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(formatted)) continue

              // Extract components for a clean readable address
              const components: any[] = result.address_components ?? []

              const get = (type: string) =>
                components.find((c: any) => c.types.includes(type))?.long_name ?? ''

              const streetNum    = get('street_number')
              const route        = get('route')
              const neighborhood = get('neighborhood')
              const sublocality  = get('sublocality') || get('sublocality_level_1')
              const locality     = get('locality')
              const country      = get('country')

              // Build address from best available components
              if (route) {
                const street = streetNum ? `${streetNum} ${route}` : route
                const area   = sublocality || neighborhood || locality
                bestAddress  = area ? `${street}, ${area}` : street
                break
              } else if (sublocality || neighborhood) {
                bestAddress = `${sublocality || neighborhood}, ${locality || country}`
                break
              } else if (locality) {
                bestAddress = country ? `${locality}, ${country}` : locality
                break
              }
            }

            // Fallback: use formatted_address of first non-plus-code result
            if (!bestAddress) {
              for (const result of results) {
                const formatted: string = result.formatted_address ?? ''
                if (!/^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(formatted)) {
                  bestAddress = formatted
                  break
                }
              }
            }

            // Last resort: strip the plus code prefix from formatted_address
            if (!bestAddress) {
              const raw: string = results[0].formatted_address ?? ''
              bestAddress = raw.replace(/^[A-Z0-9]{4,}\+[A-Z0-9]+,?\s*/, '').trim()
            }

            addressCacheRef.current.set(key, bestAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
            resolve(bestAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
          } else {
            resolve(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
          }
        }
      )
    })
  }, [])

  // Auto reverse-geocode when position changes (throttled — only when moved >20m)
  useEffect(() => {
    if (!position || !mapsReady) return
    const last = lastGeocodedRef.current
    if (last) {
      const dist = haversineM(last.lat, last.lng, position.latitude, position.longitude)
      if (dist < 20) return
    }
    lastGeocodedRef.current = { lat: position.latitude, lng: position.longitude }
    reverseGeocode(position.latitude, position.longitude).then(setCurrentAddress)
  }, [position, mapsReady, reverseGeocode])

  // Update which step is current based on live position
  useEffect(() => {
    if (!route || !position) return
    const { latitude: lat, longitude: lng } = position
    let closestIdx = 0
    let closestDist = Infinity
    route.steps.forEach((step, i) => {
      const d = haversineM(lat, lng, step.startLat, step.startLng)
      if (d < closestDist) { closestDist = d; closestIdx = i }
    })
    setRoute(prev => {
      if (!prev) return prev
      const updated = prev.steps.map((s, i) => ({ ...s, isCurrent: i === closestIdx }))
      return { ...prev, steps: updated }
    })
  }, [position]) // eslint-disable-line react-hooks/exhaustive-deps

  const calculateRoute = useCallback(async (destination: string) => {
    if (!position || !directionsRef.current) {
      setError('GPS or Maps not ready')
      return
    }
    setIsLoading(true)
    setError(null)

    const origin = { lat: position.latitude, lng: position.longitude }

    directionsRef.current.route(
      {
        origin,
        destination,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        travelMode: (window as any).google.maps.TravelMode[travelMode],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unitSystem: (window as any).google.maps.UnitSystem.METRIC,
      },
      (result, status) => {
        setIsLoading(false)
        if (status !== 'OK' || !result) {
          setError(`Could not find route: ${status}`)
          return
        }

        const leg = result.routes[0].legs[0]
        const steps: MapsRouteStep[] = leg.steps.map((step: any, i: number) => ({
          id: String(i),
          instruction: stripHtml(step.instructions),
          distance: step.distance?.value ?? 0,
          duration: step.duration?.value ?? 0,
          maneuver: step.maneuver ?? 'straight',
          icon: maneuverToIcon(step.maneuver ?? ''),
          isCurrent: i === 0,
          startLat: step.start_location.lat(),
          startLng: step.start_location.lng(),
        }))

        setRoute({
          steps,
          totalDistance: leg.distance?.text ?? '',
          totalDuration: leg.duration?.text ?? '',
          totalDistanceM: leg.distance?.value ?? 0,
          totalDurationS: leg.duration?.value ?? 0,
          summary: result.routes[0].summary,
        })
      }
    )
  }, [position, travelMode])

  const clearRoute = useCallback(() => {
    setRoute(null)
    setError(null)
  }, [])

  return {
    route,
    isLoading,
    error,
    currentAddress,
    travelMode,
    setTravelMode,
    calculateRoute,
    clearRoute,
    reverseGeocode,
  }
}