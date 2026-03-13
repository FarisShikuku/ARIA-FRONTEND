import React, { useState, useCallback } from 'react';
import type { DetectionResult } from '@/hooks/useNavigationSession';

/**
 * CameraFeed.tsx — MODIFIED
 *
 * CHANGE: Live camera controls added — Pause / Resume / Snapshot.
 *
 * WHY: The camera feed had no runtime controls. Users needed the ability to
 * pause the live video without ending the session (e.g. to inspect a frame),
 * resume it, or take a snapshot for reference.
 *
 * Implementation:
 *   - isPaused local state controls whether the <video> element is paused.
 *   - handlePause/handleResume call videoRef.current.pause() / .play() directly
 *     on the DOM element so the stream stays alive — only rendering is frozen.
 *   - handleSnapshot draws the current video frame to an offscreen canvas and
 *     opens it as a PNG download — no server round-trip needed.
 *   - Controls bar sits at the top-right of the feed as a translucent overlay.
 *     Buttons use the same font-mono / tag styling as the rest of the HUD.
 *   - The LIVE / STANDBY label in the bottom bar now also shows PAUSED state.
 *
 * All existing simulation scene, detection boxes, and HUD overlays are unchanged.
 */

interface CameraFeedProps {
  videoRef:    React.RefObject<HTMLVideoElement | null>;
  isCapturing: boolean;
  detections:  DetectionResult[];
}

function urgencyColors(urgency: number) {
  if (urgency > 0.6)  return { border: 'border-red',   text: 'text-red',   bg: 'bg-red-dim'   };
  if (urgency > 0.35) return { border: 'border-amber', text: 'text-amber', bg: 'bg-amber-dim' };
  return                      { border: 'border-green', text: 'text-green', bg: 'bg-green-dim' };
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ videoRef, isCapturing, detections }) => {
  const topDetection   = detections?.[0] ?? null;
  const hasHighUrgency = topDetection && topDetection.urgency > 0.6;

  // ── Live control state ────────────────────────────────────────────────────
  const [isPaused, setIsPaused] = useState(false);

  const handlePause = useCallback(() => {
    videoRef.current?.pause();
    setIsPaused(true);
  }, [videoRef]);

  const handleResume = useCallback(() => {
    videoRef.current?.play().catch(() => {/* autoplay policy — ignored */});
    setIsPaused(false);
  }, [videoRef]);

  const handleSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a');
    link.download = `aria-snapshot-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [videoRef]);

  // Status label for bottom bar
  const feedStatus = !isCapturing ? 'STANDBY' : isPaused ? 'PAUSED' : 'LIVE';
  const feedDotColor = !isCapturing ? 'text-white/30' : isPaused ? 'text-amber' : 'text-red';

  return (
    <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-black glow-box">

      {/* ── Simulated scene ───────────────────────────────────────────────── */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isCapturing ? 'opacity-0' : 'opacity-100'
        } bg-[radial-gradient(ellipse_60%_60%_at_50%_60%,rgba(0,30,50,0.8)_0%,#000_100%)]`}
      >
        {/* Buildings left */}
        <div className="absolute bottom-[48%] left-0 w-[18%] h-[100px] bg-[#0a1a24] border border-cyan/10">
          <div className="grid grid-cols-3 gap-1 p-1.5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`h-2 ${i % 2 === 0 ? 'bg-amber/40' : 'bg-cyan/15'} rounded-[1px]`} />
            ))}
          </div>
        </div>
        <div className="absolute bottom-[48%] left-[19%] h-[65px] w-[12%] bg-[#0a1a24] border border-cyan/10">
          <div className="grid grid-cols-3 gap-1 p-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`h-2 ${i === 1 ? 'bg-amber/40' : 'bg-cyan/15'} rounded-[1px]`} />
            ))}
          </div>
        </div>
        {/* Buildings right */}
        <div className="absolute bottom-[48%] right-0 w-[18%] h-[120px] bg-[#0a1a24] border border-cyan/10">
          <div className="grid grid-cols-3 gap-1 p-1.5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`h-2 ${i % 2 === 0 ? 'bg-amber/40' : 'bg-cyan/15'} rounded-[1px]`} />
            ))}
          </div>
        </div>
        <div className="absolute bottom-[48%] right-[19%] h-[75px] w-[10%] bg-[#0a1a24] border border-cyan/10">
          <div className="grid grid-cols-3 gap-1 p-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`h-2 ${i % 2 === 0 ? 'bg-amber/40' : 'bg-cyan/15'} rounded-[1px]`} />
            ))}
          </div>
        </div>
        {/* Horizon + road */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d]">
          <div className="absolute left-1/2 top-0 bottom-0 w-1.5 -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,#ffcc00_0px,#ffcc00_30px,transparent_30px,transparent_60px)] opacity-70" />
        </div>
        <div className="absolute bottom-0 left-0 w-[22%] h-[40%] bg-[#222] border-t-2 border-[#333]" />
        <div className="absolute bottom-0 right-0 w-[22%] h-[40%] bg-[#222] border-t-2 border-[#333]" />
        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan to-transparent opacity-40 animate-scan" />
        {!isCapturing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[11px] text-cyan/50 animate-pulse">Initialising camera…</span>
          </div>
        )}
      </div>

      {/* ── Real camera stream ───────────────────────────────────────────── */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          isCapturing ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ── HUD overlay ──────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner brackets */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan/60" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan/60" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan/60" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan/60" />

        {/* Detection boxes */}
        {detections.map((d, i) => {
          if (!d.bbox) return null;
          const c = urgencyColors(d.urgency);
          const { x, y, w, h } = d.bbox;
          return (
            <div
              key={`${d.label}-${i}`}
              className={`absolute border ${c.border} rounded-sm`}
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
            >
              <div className={`absolute -top-4 left-0 font-mono text-[9px] ${c.text} ${c.bg} px-1.5 py-0.5 rounded-sm whitespace-nowrap`}>
                {d.urgency > 0.6 ? '⚠ ' : ''}{d.label.toUpperCase()} {Math.round(d.confidence * 100)}%
              </div>
            </div>
          );
        })}

        {/* High-urgency alert */}
        {hasHighUrgency && topDetection && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-dim border border-red/50 rounded-full px-4 py-1.5 font-mono text-[11px] font-medium text-red tracking-wider flex items-center gap-2 animate-slide-in-up">
            <div className="w-2 h-2 rounded-full bg-red animate-blink" />
            {topDetection.label.toUpperCase()}
            {topDetection.direction ? ` — ${topDetection.direction.toUpperCase()}` : ''}
          </div>
        )}

        {/* Pause overlay indicator */}
        {isPaused && isCapturing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="font-mono text-lg text-amber tracking-widest flex items-center gap-2">
              <span className="text-2xl">⏸</span> PAUSED
            </div>
          </div>
        )}

        {/* Navigation arrow */}
        {!isPaused && (
          <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 text-3xl text-cyan animate-float">▲</div>
        )}

        {/* Info bar */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/90 to-transparent flex items-end px-4 pb-2 gap-4">
          <div className={`font-mono text-[9px] flex items-center gap-1 ${feedDotColor}`}>
            <span>●</span>
            {feedStatus}
          </div>
          <div className="font-mono text-[9px] text-white/50">📷 1 FPS</div>
          <div className="hidden sm:block font-mono text-[9px] text-white/50">🧠 Gemini Vision</div>
          <div className="hidden md:block font-mono text-[9px] text-white/50">☁ Cloud Run</div>
          <div className="ml-auto font-mono text-[9px] text-white/50">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      {/* ── Live controls — pointer-events enabled ────────────────────────
          Positioned top-right, inside the feed. Only shown when camera is
          active so they don't clutter the standby scene.                  */}
      {isCapturing && (
        <div className="absolute top-3 right-10 flex items-center gap-1.5 z-10">
          {!isPaused ? (
            <button
              onClick={handlePause}
              title="Pause camera feed"
              className="flex items-center gap-1 px-2.5 py-1 rounded-sm font-mono text-[10px] font-medium bg-black/60 border border-amber/40 text-amber hover:bg-amber/20 transition-colors backdrop-blur-sm"
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={handleResume}
              title="Resume camera feed"
              className="flex items-center gap-1 px-2.5 py-1 rounded-sm font-mono text-[10px] font-medium bg-black/60 border border-cyan/40 text-cyan hover:bg-cyan/20 transition-colors backdrop-blur-sm"
            >
              ▶ Resume
            </button>
          )}
          <button
            onClick={handleSnapshot}
            title="Save snapshot"
            className="flex items-center gap-1 px-2.5 py-1 rounded-sm font-mono text-[10px] font-medium bg-black/60 border border-border text-text-secondary hover:border-cyan/40 hover:text-cyan transition-colors backdrop-blur-sm"
          >
            📷 Snap
          </button>
        </div>
      )}
    </div>
  );
};