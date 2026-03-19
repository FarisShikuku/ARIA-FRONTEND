/**
 * CoachingOverlay.tsx
 *
 * CHANGES vs previous version:
 *
 * 1. REMOVED static fallback hints that always rendered on mobile.
 *    WHY: The static examples (Slow down / Great eye contact / Pause) were shown
 *    unconditionally whenever liveHints was empty — even before session start.
 *    On mobile these three cards stacked on top of the video feed, blocking
 *    the entire right half of the view permanently. Now hints only render when
 *    phase === 'active' AND real metric-driven hints exist.
 *
 * 2. Hint area hidden entirely when not active.
 *    WHY: During idle/ready/paused there is nothing to coach yet. The overlay
 *    area is kept empty so the video feed is fully visible.
 *
 * Everything else (PostureGuide, VideoControls, props) unchanged.
 */

import React from 'react';
import { HintCard }     from './HintCard';
import { PostureGuide } from './PostureGuide';
import { VideoControls } from './VideoControls';
import type { CoachMetrics, CoachSessionPhase } from '@/lib/types/coach.types';

interface CoachingOverlayProps {
  metrics:         CoachMetrics;
  isMicOn:         boolean;
  isMuted:         boolean;
  phase:           CoachSessionPhase;
  onToggleMic:     () => void;
  onToggleCamera:  () => void;
  onToggleMute:    () => void;
  onPause:         () => void;
  onResume:        () => void;
  onEnd:           () => void;
}

export const CoachingOverlay: React.FC<CoachingOverlayProps> = ({
  metrics,
  isMicOn,
  isMuted,
  phase,
  onToggleMic,
  onToggleCamera,
  onToggleMute,
  onPause,
  onResume,
  onEnd,
}) => {
  const isActive = phase === 'active';

  // Only compute and show hints during an active session.
  // No static fallback — empty overlay is correct when not coaching.
  const liveHints: { type: 'warn' | 'good' | 'info'; message: string; subtext: string }[] = [];

  if (isActive) {
    if (metrics.speakingRate > 150) {
      liveHints.push({ type: 'warn', message: 'Slow down', subtext: `${metrics.speakingRate} WPM → target 130` });
    } else if (metrics.speakingRate > 0 && metrics.speakingRate < 100) {
      liveHints.push({ type: 'info', message: 'Pick up pace', subtext: `${metrics.speakingRate} WPM is too slow` });
    }

    if (metrics.eyeContactScore >= 85) {
      liveHints.push({ type: 'good', message: 'Great eye contact ✓', subtext: `Score: ${metrics.eyeContactScore}%` });
    }

    if (metrics.fillerWordCount > 5) {
      liveHints.push({ type: 'warn', message: 'Filler words detected', subtext: `${metrics.fillerWordCount}× this session` });
    }

    if (metrics.confidenceScore >= 80) {
      liveHints.push({ type: 'good', message: 'Strong confidence ✓', subtext: `Score: ${metrics.confidenceScore}/100` });
    }
  }

  return (
    <>
      {/* Coaching hints — top right, only when active AND hints exist */}
      {isActive && liveHints.length > 0 && (
        <div className="absolute right-4 md:right-5 top-4 md:top-5 flex flex-col gap-2 w-[160px] md:w-[200px]">
          {liveHints.slice(0, 3).map((hint, i) => (
            <HintCard key={i} type={hint.type} message={hint.message} subtext={hint.subtext} />
          ))}
        </div>
      )}

      {/* Posture guide — driven by real metrics, only when active */}
      {isActive && (
        <PostureGuide
          postureScore={metrics.postureScore}
          energyScore={metrics.energyScore}
          eyeContactScore={metrics.eyeContactScore}
        />
      )}

      {/* Video controls — always present */}
      <VideoControls
        isMicOn={isMicOn}
        isMuted={isMuted}
        phase={phase}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onToggleMute={onToggleMute}
        onPause={onPause}
        onResume={onResume}
        onEnd={onEnd}
      />
    </>
  );
};