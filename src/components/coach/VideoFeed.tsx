/**
 * VideoFeed.tsx
 *
 * CHANGES vs previous version:
 *
 * 1. FRONT CAMERA IS DEFAULT ON MOBILE
 *    WHY: Coach page needs the user facing the camera. Previously hardcoded
 *    facingMode='environment' in useMediaCapture showed the rear camera.
 *    useMediaCapture now defaults to 'user' (front) — this file just receives
 *    the live videoRef and renders it.
 *
 * 2. FLIP CAMERA BUTTON ADDED
 *    WHY: User may want to show their environment (rear) or switch back to
 *    front. The flip button toggles facingMode between 'user' and 'environment'
 *    which triggers useMediaCapture to restart the stream with the new camera.
 *    onFlipCamera prop passed up to useCoachSession → useMediaCapture.
 *
 * 3. video element no longer mirrors on rear camera
 *    WHY: scaleX(-1) mirror looks correct for front camera (selfie view) but
 *    wrong for rear camera (flips real world). Mirror only applies when facing='user'.
 */

import React, { useState } from 'react';
import { CoachingOverlay } from './CoachingOverlay';
import type { CoachMetrics, CoachSessionPhase } from '@/lib/types/coach.types';

interface VideoFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraOn: boolean;
  metrics: CoachMetrics;
  isMicOn: boolean;
  isMuted: boolean;
  phase: CoachSessionPhase;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onFlipCamera?: (facing: 'user' | 'environment') => void;  // NEW
}

export const VideoFeed: React.FC<VideoFeedProps> = ({
  videoRef,
  isCameraOn,
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
  onFlipCamera,
}) => {
  const isPaused = phase === 'paused';

  // FIX: track which camera is active so we can show flip button and
  // apply mirror transform only on front camera
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const handleFlip = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    onFlipCamera?.(next);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden aspect-video bg-black glow-box-amber border border-amber/20">

      {/* ── Real camera feed ─────────────────────────────────────────────── */}
      {isCameraOn && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          // Mirror only on front camera — rear camera should not be mirrored
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />
      )}

      {/* ── Fallback: camera off ──────────────────────────────────────────── */}
      {!isCameraOn && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1520] to-[#050d14] flex items-center justify-center">
          <div className="relative flex flex-col items-center opacity-60">
            <div className="w-15 h-15 rounded-full bg-cyan-ghost border border-cyan/20 mb-1" />
            <div className="w-20 h-25 bg-cyan-ghost/50 border border-cyan/10 rounded-t-[40px] rounded-b-2xl" />
          </div>
          <div className="absolute top-1/2 left-[42%] w-4 h-4">
            <div className="absolute inset-0 border border-cyan rounded-full animate-pulse-ring" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-cyan rounded-full" />
          </div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-bg-surface/80 backdrop-blur-md border border-border rounded-full px-3 py-1">
            <span className="text-xs">📷</span>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">CAMERA OFF</span>
          </div>
        </div>
      )}

      {/* ── Dark scrim for readability ────────────────────────────────────── */}
      {isCameraOn && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      )}

      {/* ── Flip camera button — top left, only when camera is on ────────── */}
      {isCameraOn && (
        <button
          onClick={handleFlip}
          title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
          className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full px-2.5 py-1 font-mono text-[10px] hover:bg-black/80 transition-colors"
        >
          🔄 {facingMode === 'user' ? 'Rear' : 'Front'}
        </button>
      )}

      {/* ── Camera label — top right ─────────────────────────────────────── */}
      {isCameraOn && (
        <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2 py-0.5 font-mono text-[9px] text-white/70">
          {facingMode === 'user' ? '📱 FRONT' : '🌍 REAR'}
        </div>
      )}

      {/* ── Coaching overlays ────────────────────────────────────────────── */}
      <CoachingOverlay
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
      />

      {/* ── Paused overlay ───────────────────────────────────────────────── */}
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl">⏸</span>
            <span className="font-mono text-xs text-amber tracking-wider">SESSION PAUSED</span>
          </div>
        </div>
      )}
    </div>
  );
};