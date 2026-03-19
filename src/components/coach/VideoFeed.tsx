/**
 * VideoFeed.tsx — Coach
 *
 * CHANGES vs previous version:
 *
 * 1. VIDEO ELEMENT ALWAYS RENDERED — no longer gated on isCameraOn.
 *    WHY: Previously the video element was wrapped in {isCameraOn && ...},
 *    so it only appeared after the user clicked the camera icon. useMediaCapture
 *    in the parent starts the stream on mount and sets videoRef.current.srcObject,
 *    but without a mounted video element that stream had nowhere to display.
 *    The user had to click the camera icon (onToggleCamera → setIsCameraOn(true))
 *    just to see a feed that was already streaming.
 *
 *    FIX: The <video> element is always mounted. isCameraOn now only controls
 *    whether the stream is visible (opacity) and whether the "CAMERA OFF"
 *    placeholder is shown — it no longer gates the element itself.
 *    The parent starts capture on mount; the video appears immediately.
 *
 * 2. Camera-off placeholder shown as overlay, not a replacement.
 *    WHY: Previously the placeholder replaced the video element entirely,
 *    meaning the stream could not attach. Now it overlays above the (running)
 *    video element so toggling camera on again instantly reveals the live feed
 *    without needing to re-attach the stream.
 *
 * 3. Mirror logic, flip button, and facing badge unchanged.
 */

import React, { useState } from 'react';
import { CoachingOverlay } from './CoachingOverlay';
import type { CoachMetrics, CoachSessionPhase } from '@/lib/types/coach.types';

interface VideoFeedProps {
  videoRef:            React.RefObject<HTMLVideoElement | null>;
  isCameraOn:          boolean;
  metrics:             CoachMetrics;
  isMicOn:             boolean;
  isMuted:             boolean;
  phase:               CoachSessionPhase;
  onToggleMic:         () => void;
  onToggleCamera:      () => void;
  onToggleMute:        () => void;
  onPause:             () => void;
  onResume:            () => void;
  onEnd:               () => void;
  onFlipCamera?:       (facing: 'user' | 'environment') => void;
  hasMultipleCameras?: boolean;
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
  hasMultipleCameras = false,
}) => {
  const isPaused = phase === 'paused';
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const handleFlip = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    onFlipCamera?.(next);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden aspect-video bg-black glow-box-amber border border-amber/20">

      {/* ── Video element — always mounted so the stream can attach on load ── */}
      {/* Visibility controlled by isCameraOn; stream is managed by parent.    */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
        style={{
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          opacity: isCameraOn ? 1 : 0,
        }}
      />

      {/* ── Camera off placeholder — overlays the hidden video, not a replacement ── */}
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

      {/* ── Dark scrim for overlay readability ───────────────────────────── */}
      {isCameraOn && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      )}

      {/* ── Flip button — only on multi-camera devices ───────────────────── */}
      {isCameraOn && hasMultipleCameras && onFlipCamera && (
        <button
          onClick={handleFlip}
          title={facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'}
          className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full px-2.5 py-1 font-mono text-[10px] hover:bg-black/80 transition-colors"
        >
          🔄 {facingMode === 'user' ? 'Rear' : 'Front'}
        </button>
      )}

      {/* ── Camera facing badge ───────────────────────────────────────────── */}
      {isCameraOn && (
        <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2 py-0.5 font-mono text-[9px] text-white/70">
          {facingMode === 'user' ? '↪ FRONT' : '↩ REAR'}
        </div>
      )}

      {/* ── Coaching overlays ─────────────────────────────────────────────── */}
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

      {/* ── Paused overlay ────────────────────────────────────────────────── */}
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