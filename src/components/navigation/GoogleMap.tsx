/// <reference types="@types/google.maps" />
'use client';

/**
 * src/components/navigation/GoogleMap.tsx
 *
 * WHY THIS FILE EXISTS:
 * Replaces the static Google Maps iframe in NavigationHUD.
 * The iframe only showed a pinned static location — it did not update
 * as the user moved, had no route line, no destination marker, and
 * was frequently blocked by Google's embed restrictions.
 *
 * This component uses the Google Maps JavaScript API directly:
 * - Live blue dot that moves with every GPS fix
 * - Route polyline drawn when a route is active
 * - Destination marker (red pin)
 * - Auto-centers on user position unless user has panned the map
 * - Dark map style to match the ARIA HUD theme
 */

import React, { useEffect, useRef, useCallback } from 'react'
import type { MapsRoute } from '@/hooks/useGoogleMapsRoute'

interface GoogleMapProps {
  position: GeolocationCoordinates | null
  route: MapsRoute | null
  destination: string | null
}

declare global {
  interface Window { google: typeof google }
}

export const GoogleMap: React.FC<GoogleMapProps> = ({ position, route, destination }) => {
  const mapDivRef       = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef          = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef   = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destMarkerRef   = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef     = useRef<any>(null)
  const userPannedRef   = useRef(false)
  const mapReadyRef     = useRef(false)

  // Dark map style — keeps ARIA theme but shows enough labels to be useful.
  // Previously hid too many features causing a near-empty map.
  // Now: roads visible, place names visible, POIs simplified not hidden.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const darkStyle: any[] = [
    // Base geometry — dark background
    { elementType: 'geometry', stylers: [{ color: '#0d1a0d' }] },

    // All text labels — cyan tint, visible
    { elementType: 'labels.text.fill',   stylers: [{ color: '#a8d5b5' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1a0d' }, { weight: 2 }] },
    { elementType: 'labels.icon',        stylers: [{ visibility: 'on' }] },

    // Roads — clearly visible
    { featureType: 'road',          elementType: 'geometry',        stylers: [{ color: '#1e3a1e' }] },
    { featureType: 'road',          elementType: 'geometry.stroke', stylers: [{ color: '#00e5ff', weight: 0.5, lightness: -30 }] },
    { featureType: 'road',          elementType: 'labels.text.fill',stylers: [{ color: '#00e5ff' }] },
    { featureType: 'road.highway',  elementType: 'geometry',        stylers: [{ color: '#2a5c2a' }] },
    { featureType: 'road.highway',  elementType: 'labels.text.fill',stylers: [{ color: '#7dffb3' }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill',stylers: [{ color: '#80cfa0' }] },
    { featureType: 'road.local',    elementType: 'labels.text.fill',stylers: [{ color: '#6bab80' }] },

    // Water
    { featureType: 'water', elementType: 'geometry',        stylers: [{ color: '#051a0a' }] },
    { featureType: 'water', elementType: 'labels.text.fill',stylers: [{ color: '#4fc3a1' }] },

    // Landscape
    { featureType: 'landscape',       elementType: 'geometry', stylers: [{ color: '#0f200f' }] },
    { featureType: 'landscape.natural',elementType: 'geometry',stylers: [{ color: '#112211' }] },

    // POIs — show simplified, not hidden
    { featureType: 'poi',        stylers: [{ visibility: 'simplified' }] },
    { featureType: 'poi',        elementType: 'labels.text.fill', stylers: [{ color: '#7db87d' }] },
    { featureType: 'poi.park',   elementType: 'geometry',         stylers: [{ color: '#0e1f0e' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'on' }] },

    // Transit — show stops and lines
    { featureType: 'transit',          stylers: [{ visibility: 'simplified' }] },
    { featureType: 'transit.station',  elementType: 'labels.text.fill', stylers: [{ color: '#00e5ff' }] },
    { featureType: 'transit.line',     elementType: 'geometry',          stylers: [{ color: '#1a4a1a' }] },

    // Administrative boundaries — neighborhoods and localities visible
    { featureType: 'administrative',           elementType: 'geometry.stroke',  stylers: [{ color: '#2a5c2a' }] },
    { featureType: 'administrative.locality',  elementType: 'labels.text.fill', stylers: [{ color: '#00e5ff' }] },
    { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#80cfa0' }] },
  ]

  const initMap = useCallback(() => {
    if (!mapDivRef.current || !window.google || mapReadyRef.current) return

    const center = position
      ? { lat: position.latitude, lng: position.longitude }
      : { lat: 0, lng: 0 }

    mapRef.current = new google.maps.Map(mapDivRef.current, {
      center,
      zoom: 16,
      styles: darkStyle,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    })

    // Blue pulsing dot for user location
    userMarkerRef.current = new google.maps.Marker({
      position: center,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#00e5ff',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      title: 'Your location',
      zIndex: 10,
    })

    // Track if user manually pans — stop auto-centering if so
    mapRef.current.addListener('dragstart', () => { userPannedRef.current = true })

    mapReadyRef.current = true
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Init map once Google Maps SDK is ready
  useEffect(() => {
    const tryInit = () => {
      if (window.google?.maps) { initMap(); return }
      const interval = setInterval(() => {
        if (window.google?.maps) { clearInterval(interval); initMap() }
      }, 200)
      return () => clearInterval(interval)
    }
    return tryInit()
  }, [initMap])

  // Update user position marker + re-center if not panned
  useEffect(() => {
    if (!position || !mapRef.current || !userMarkerRef.current) return
    const latlng = new google.maps.LatLng(position.latitude, position.longitude)
    userMarkerRef.current.setPosition(latlng)
    if (!userPannedRef.current) {
      mapRef.current.panTo(latlng)
    }
  }, [position])

  // Draw route polyline + destination marker when route changes
  useEffect(() => {
    if (!mapRef.current || !window.google) return

    // Clear old polyline and marker
    polylineRef.current?.setMap(null)
    destMarkerRef.current?.setMap(null)

    if (!route || !destination) return

    // Build path from step start locations
    const path = route.steps.map(s => ({ lat: s.startLat, lng: s.startLng }))

    polylineRef.current = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#00e5ff',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map: mapRef.current,
    })

    // Destination marker — last step end
    const last = route.steps[route.steps.length - 1]
    if (last) {
      destMarkerRef.current = new google.maps.Marker({
        position: { lat: last.startLat, lng: last.startLng },
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#ff4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
        },
        title: destination,
        zIndex: 9,
      })
    }

    // Fit map to show full route
    const bounds = new google.maps.LatLngBounds()
    path.forEach(p => bounds.extend(p))
    mapRef.current.fitBounds(bounds, { top: 40, right: 20, bottom: 20, left: 20 })
    userPannedRef.current = false
  }, [route, destination])

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-bg-surface">
      <div ref={mapDivRef} className="w-full h-full" />

      {/* Re-center button */}
      {userPannedRef.current && position && (
        <button
          onClick={() => {
            if (mapRef.current && position) {
              mapRef.current.panTo({ lat: position.latitude, lng: position.longitude })
              userPannedRef.current = false
            }
          }}
          className="absolute bottom-3 right-3 bg-bg-deep/90 border border-cyan/40 text-cyan rounded-full px-2.5 py-1 font-mono text-[10px] hover:bg-cyan/20 transition-colors z-10"
        >
          ◉ Re-center
        </button>
      )}

      {/* LIVE badge */}
      {position && (
        <div className="absolute top-2 left-2 bg-black/70 rounded px-1.5 py-0.5 font-mono text-[9px] text-cyan z-10 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
          LIVE
        </div>
      )}
    </div>
  )
}