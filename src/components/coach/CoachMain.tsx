/**
 * CoachMain.tsx
 *
 * CHANGES vs previous version:
 * onFlipCamera prop added — passed down from CoachLayout → VideoFeed
 * so the flip button in VideoFeed can switch between front/rear camera.
 */

import React from 'react';
import { VideoFeed } from './VideoFeed';
import { MetricsStrip } from './MetricsStrip';
import type { CoachMetrics, CoachSessionPhase } from '@/lib/types/coach.types';

interface CoachMainProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  metrics: CoachMetrics;
  phase: CoachSessionPhase;
  isMicOn: boolean;
  isCameraOn: boolean;
  isMuted: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onFlipCamera: (facing: 'user' | 'environment') => void;  // NEW
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
      />
      <MetricsStrip metrics={metrics} />
    </div>
  );
};