/**
 * CoachMain.tsx
 *
 * CHANGE vs previous version:
 * hasMultipleCameras prop added — passed down from CoachLayout → VideoFeed.
 * VideoFeed only renders the flip button when this is true, so single-camera
 * devices (laptops, basic phones) never see a useless flip button.
 */

import React from 'react';
import { VideoFeed } from './VideoFeed';
import { MetricsStrip } from './MetricsStrip';
import type { CoachMetrics, CoachSessionPhase } from '@/lib/types/coach.types';

interface CoachMainProps {
  videoRef:           React.RefObject<HTMLVideoElement | null>;
  metrics:            CoachMetrics;
  phase:              CoachSessionPhase;
  isMicOn:            boolean;
  isCameraOn:         boolean;
  isMuted:            boolean;
  onToggleMic:        () => void;
  onToggleCamera:     () => void;
  onToggleMute:       () => void;
  onPause:            () => void;
  onResume:           () => void;
  onEnd:              () => void;
  onFlipCamera:       (facing: 'user' | 'environment') => void;
  /** true when device has > 1 camera — VideoFeed shows/hides flip button */
  hasMultipleCameras: boolean;
}

export const CoachMain: React.FC<CoachMainProps> = ({
  videoRef,
  metrics,
  phase,
  isMicOn,
  isCameraOn,
  isMuted,
  onToggleMic,
  onToggleCamera,
  onToggleMute,
  onPause,
  onResume,
  onEnd,
  onFlipCamera,
  hasMultipleCameras,
}) => {
  return (
    <div className="flex flex-col gap-5">
      <VideoFeed
        videoRef={videoRef}
        isCameraOn={isCameraOn}
        metrics={metrics}
        isMicOn={isMicOn}
        isMuted={isMuted}
        phase={phase}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onToggleMute={onToggleMute}
        onPause={onPause}
        onResume={onResume}
        onEnd={onEnd}
        onFlipCamera={onFlipCamera}
        hasMultipleCameras={hasMultipleCameras}
      />
      <MetricsStrip metrics={metrics} />
    </div>
  );
};