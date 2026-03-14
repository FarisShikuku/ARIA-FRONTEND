'use client';

/**
 * src/components/navigation/NavigationHUD.tsx
 *
 * CHANGES vs previous version:
 *
 * 1. GOOGLE MAPS REPLACES IFRAME
 *    WHY: The iframe was static — it pinned one location and never updated.
 *    Google Maps embed API also blocks without proper referrer config.
 *    Now uses GoogleMap component with live blue dot, route polyline,
 *    destination marker. Updates on every GPS fix.
 *
 * 2. DESTINATION SEARCH ADDED TO LEFT PANEL
 *    WHY: User needs to enter a destination to get routing. DestinationSearch
 *    includes Places Autocomplete, transport mode selector, and route summary.
 *
 * 3. ROUTESTEPS NOW RECEIVES REAL STEPS FROM GOOGLE DIRECTIONS
 *    WHY: Previously RouteSteps had hardcoded San Francisco data.
 *    Now receives live steps from useGoogleMapsRoute via useNavigationSession.
 *
 * 4. HEADER CONTROLS REMOVED — MOVED TO NavigationAgentBar
 *    WHY: Mute/End controls live in the fixed floating bar at the top.
 *    The HUD header shows only read-only status tags.
 */

import React from 'react';
import { HUDPanel } from './HUDPanel';
import { GPSWidget } from './GPSWidget';
import { DetectionLog } from './DetectionLog';
import { CameraFeed } from './CameraFeed';
import { ARIAVoiceCard } from './AriaVoiceCard';
import { RouteSteps } from './RouteSteps';
import { HapticPatterns } from './HapticPatterns';
import { QuickSOS } from './QuickSOS';
import { GoogleMap } from './GoogleMap';
import { DestinationSearch } from './DestinationSearch';
import { Tag } from '@/components/ui/Tag';
import type { AgentState } from '@/hooks/useAgentState';
import type { Environment } from '@/hooks/useGeolocation';
import type { DetectionResult } from '@/hooks/useNavigationSession';
import type { MapsRoute, TravelMode } from '@/hooks/useGoogleMapsRoute';

interface NavigationHUDProps {
  agentState: AgentState;
  urgencyScore: number;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCapturing: boolean;
  detections: DetectionResult[];
  environment: Environment;
  gpsAccuracy: number | null;
  position: GeolocationCoordinates | null;
  sessionId: string | null;
  // Route props
  route: MapsRoute | null;
  currentAddress: string | null;
  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;
  calculateRoute: (destination: string) => Promise<void>;
  clearRoute: () => void;
  destination: string | null;
  routeLoading?: boolean;
  routeError?: string | null;
}

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  agentState,
  urgencyScore,
  isSpeaking,
  isListening,
  transcript,
  videoRef,
  isCapturing,
  detections,
  environment,
  gpsAccuracy,
  position,
  sessionId,
  route,
  currentAddress,
  travelMode,
  setTravelMode,
  calculateRoute,
  clearRoute,
  destination,
  routeLoading = false,
  routeError = null,
}) => {
  const gpsLocked = gpsAccuracy !== null && gpsAccuracy <= 20;
  const envColor = environment === 'indoor' ? 'amber' : 'cyan';
  const envTag =
    environment === 'indoor'  ? '● INDOOR MODE'  :
    environment === 'outdoor' ? '● OUTDOOR MODE' :
    '● DETECTING ENV…';

  const latLng = position
    ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
    : null;

  return (
    <section className="bg-bg-deep border-t border-border px-4 md:px-8 py-12 md:py-16">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <div className="section-label">Navigation Mode</div>
          <h2 className="section-title">
            Live <span className="text-cyan">Navigation</span> HUD
          </h2>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <Tag color={envColor}>{envTag}</Tag>
          {gpsLocked && <Tag color="green">GPS LOCKED</Tag>}
          {route && <Tag color="cyan">ROUTE ACTIVE</Tag>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4 lg:gap-5">

        {/* Left panel — map + destination search + detection */}
        <div className="flex flex-col gap-4">

          <HUDPanel title="Current Location">
            <div className="flex flex-col gap-3">
              {/* Live Google Map */}
              <div className="w-full h-52 rounded-lg overflow-hidden border border-border bg-bg-surface">
                <GoogleMap
                  position={position}
                  route={route}
                  destination={destination}
                />
              </div>

              {/* Address + coords */}
              {currentAddress && (
                <div className="font-mono text-[10px] text-text-secondary leading-relaxed">
                  📍 {currentAddress}
                </div>
              )}
              {latLng && !currentAddress && (
                <div className="font-mono text-[10px] text-text-muted">{latLng}</div>
              )}

              <GPSWidget environment={environment} accuracy={gpsAccuracy} />
            </div>
          </HUDPanel>

          {/* Destination search */}
          <HUDPanel title="Get Directions">
            <DestinationSearch
              onSearch={calculateRoute}
              onClear={clearRoute}
              onModeChange={setTravelMode}
              travelMode={travelMode}
              route={route}
              isLoading={routeLoading}
              error={routeError ?? null}
            />
          </HUDPanel>

          <HUDPanel title="Object Detection">
            <DetectionLog detections={detections} />
          </HUDPanel>

        </div>

        {/* Center panel — camera + ARIA voice */}
        <div className="flex flex-col gap-4">
          <CameraFeed
            videoRef={videoRef}
            isCapturing={isCapturing}
            detections={detections}
          />
          <ARIAVoiceCard isSpeaking={isSpeaking} transcript={transcript} />
        </div>

        {/* Right panel — route steps + haptic + SOS */}
        <div className="flex flex-col gap-4">
          <HUDPanel title="Active Route">
            <RouteSteps steps={route?.steps} />
          </HUDPanel>

          <HUDPanel title="Haptic Feedback">
            <HapticPatterns agentState={agentState} urgencyScore={urgencyScore} />
          </HUDPanel>

          <HUDPanel title="Emergency" className="border-red/30">
            <QuickSOS sessionId={sessionId} />
          </HUDPanel>
        </div>

      </div>
    </section>
  );
};