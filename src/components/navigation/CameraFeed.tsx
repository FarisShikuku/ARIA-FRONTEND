import React from 'react';
import type { DetectionResult } from '@/hooks/useNavigationSession';

// CHANGED: added videoRef, isCapturing, detections props.
// When isCapturing=true: renders real <video> over the simulated scene.
// Detection boxes use real bbox coordinates from detection_worker instead of hardcoded.
// When no detections: no alert banner (was always showing hardcoded VEHICLE alert).
// Simulated scene below the video is kept intact as a background/fallback.
// Camera info bar updated: 1 FPS + Gemini Vision instead of hardcoded 30 FPS + TFLite.
// All other classNames, HUD corners, scanline animation: identical to original.

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCapturing: boolean;
  detections: DetectionResult[];
}

function urgencyColors(urgency: number) {
  if (urgency > 0.6) return { border: 'border-red',   text: 'text-red',   bg: 'bg-red-dim'   };
  if (urgency > 0.35) return { border: 'border-amber', text: 'text-amber', bg: 'bg-amber-dim' };
  return                      { border: 'border-green', text: 'text-green', bg: 'bg-green-dim' };
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ videoRef, isCapturing, detections }) => {
  const topDetection = detections?.[0] ?? null;
  const hasHighUrgency = topDetection && topDetection.urgency > 0.6;

  return (
    <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-black glow-box">

      {/* ── Simulated scene (original, kept as background/fallback) ────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_60%,rgba(0,30,50,0.8)_0%,#000_100%)]">
        {/* Buildings */}
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
        {/* Horizon */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent" />
        {/* Road */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d]">
          <div className="absolute left-1/2 top-0 bottom-0 w-1.5 -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,#ffcc00_0px,#ffcc00_30px,transparent_30px,transparent_60px)] opacity-70" />
        </div>
        {/* Sidewalks */}
        <div className="absolute bottom-0 left-0 w-[22%] h-[40%] bg-[#222] border-t-2 border-[#333]" />
        <div className="absolute bottom-0 right-0 w-[22%] h-[40%] bg-[#222] border-t-2 border-[#333]" />
        {/* Scanline */}
        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan to-transparent opacity-40 animate-scan" />
      </div>

      {/* ── Real camera stream (overlays the simulated scene when active) ─── */}
      {isCapturing && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* ── HUD Overlay (pointer-events-none — identical to original) ──────── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corners */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan/60" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan/60" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan/60" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan/60" />

        {/* ── Real detection boxes (replace hardcoded ones) ─────────────────── */}
        {detections.map((d, i) => {
          if (!d.bbox) return null;
          const c = urgencyColors(d.urgency);
          const { x, y, w, h } = d.bbox;
          return (
            <div
              key={`${d.label}-${i}`}
              className={`absolute border ${c.border} rounded-sm`}
              style={{
                left:   `${x * 100}%`,
                top:    `${y * 100}%`,
                width:  `${w * 100}%`,
                height: `${h * 100}%`,
              }}
            >
              <div className={`absolute -top-4 left-0 font-mono text-[9px] ${c.text} ${c.bg} px-1.5 py-0.5 rounded-sm whitespace-nowrap`}>
                {d.urgency > 0.6 ? '⚠ ' : ''}{d.label.toUpperCase()} {Math.round(d.confidence * 100)}%
              </div>
            </div>
          );
        })}

        {/* Alert banner — only when a real high-urgency detection exists */}
        {hasHighUrgency && topDetection && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-dim border border-red/50 rounded-full px-4 py-1.5 font-mono text-[11px] font-medium text-red tracking-wider flex items-center gap-2 animate-slide-in-up">
            <div className="w-2 h-2 rounded-full bg-red animate-blink" />
            {topDetection.label.toUpperCase()}
            {topDetection.direction ? ` — ${topDetection.direction.toUpperCase()}` : ''}
          </div>
        )}

        {/* Navigation arrow */}
        <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 text-3xl text-cyan animate-float">
          ▲
        </div>

        {/* Camera Info Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/90 to-transparent flex items-end px-4 pb-2 gap-4">
          <div className="font-mono text-[9px] text-white/50 flex items-center gap-1">
            <span className={isCapturing ? 'text-red' : 'text-white/30'}>●</span>
            {isCapturing ? 'LIVE' : 'STANDBY'}
          </div>
          <div className="font-mono text-[9px] text-white/50">📷 1 FPS</div>
          <div className="hidden sm:block font-mono text-[9px] text-white/50">🧠 Gemini Vision</div>
          <div className="hidden md:block font-mono text-[9px] text-white/50">☁ Cloud Run</div>
          <div className="ml-auto font-mono text-[9px] text-white/50">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};