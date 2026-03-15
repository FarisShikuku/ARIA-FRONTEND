'use client';

/**
 * src/components/assist/AssistVideoFeed.tsx
 *
 * CHANGES vs previous version:
 *
 * 1. DEFAULT IS REAR CAMERA (environment)
 *    Assist points the camera at a physical task (reading a label, navigating
 *    a form, etc.) — rear camera is correct. The cameraFacing prop defaults to
 *    'environment' in the parent hook (useAssistSession / useMediaCapture).
 *    This component reflects whatever facing mode is active; it does not own
 *    the camera state.
 *
 * 2. FLIP BUTTON — only shown when hasMultipleCameras === true
 *    Single-camera devices (laptops, basic phones) never see the flip button.
 *    The button label shows what camera you'll switch TO, not what's active.
 *
 * 3. video element is NOT mirrored on rear camera
 *    scaleX(-1) only applies when cameraFacing === 'user' (selfie / front).
 *    Rear camera shows the real world — mirroring it would be wrong.
 *
 * Everything else (screenshot preview, speaking ring, paused overlay, task
 * title badge, ARIA speaking badge) is unchanged.
 */

import React from 'react';
import type { AssistSessionPhase } from '@/hooks/useAssistSession';

interface AssistVideoFeedProps {
  videoRef:             React.RefObject<HTMLVideoElement | null>;
  phase:                AssistSessionPhase;
  isCameraOn:           boolean;
  /** Current active camera. Default: 'environment' (rear). */
  cameraFacing:         'environment' | 'user';
  /** Show flip button only when the device has > 1 camera input */
  hasMultipleCameras:   boolean;
  isSpeaking:           boolean;
  taskTitle:            string;
  screenshotDataUrl:    string | null;
  onFlipCamera:         () => void;
  onToggleCamera:       () => void;
  onTakeScreenshot:     () => void;
  onDownloadScreenshot: () => void;
  onDismissScreenshot:  () => void;
}

export const AssistVideoFeed: React.FC<AssistVideoFeedProps> = ({
  videoRef,
  phase,
  isCameraOn,
  cameraFacing,
  hasMultipleCameras,
  isSpeaking,
  taskTitle,
  screenshotDataUrl,
  onFlipCamera,
  onToggleCamera,
  onTakeScreenshot,
  onDownloadScreenshot,
  onDismissScreenshot,
}) => {
  // Show controls whenever session is running (not idle/ended)
  const sessionOn = phase === 'listening' || phase === 'active' || phase === 'paused';

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{ background: '#080d08' }}
    >
      {/* 16:9 aspect ratio wrapper */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>

        {/* ── Live video ─────────────────────────────────────────────────
            Mirror (scaleX(-1)) only on front camera.
            Rear camera shows the real world — never mirror it.          */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform:  cameraFacing === 'user' ? 'scaleX(-1)' : 'none',
            opacity:    isCameraOn && sessionOn ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />

        {/* ── Camera off / not started placeholder ─────────────────────── */}
        {(!isCameraOn || !sessionOn) && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #080d08 0%, #0c1a0f 100%)',
            }}
          >
            {/* Subtle grid */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(52,211,153,0.06) 1px, transparent 1px), ' +
                  'linear-gradient(90deg, rgba(52,211,153,0.06) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <div className="relative z-10 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 mx-auto"
                style={{
                  background: 'rgba(52,211,153,0.08)',
                  border:     '1px solid rgba(52,211,153,0.15)',
                }}
              >
                <span className="text-3xl">{!isCameraOn ? '🚫' : '📷'}</span>
              </div>
              <p className="text-sm font-medium" style={{ color: 'rgba(52,211,153,0.7)' }}>
                {!sessionOn ? 'Waiting for ARIA…' : 'Camera off'}
              </p>
              {sessionOn && !isCameraOn && (
                <button
                  onClick={onToggleCamera}
                  className="mt-3 px-4 py-1.5 rounded-full text-xs font-medium transition-all hover:brightness-110"
                  style={{
                    background: 'rgba(52,211,153,0.15)',
                    border:     '1px solid rgba(52,211,153,0.25)',
                    color:      '#34d399',
                  }}
                >
                  Turn camera on
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Gradient scrim for overlay readability ───────────────────── */}
        {isCameraOn && sessionOn && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 25%, ' +
                'transparent 65%, rgba(0,0,0,0.55) 100%)',
            }}
          />
        )}

        {/* ── ARIA speaking ring ───────────────────────────────────────── */}
        {isSpeaking && sessionOn && (
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              boxShadow:  'inset 0 0 0 2px rgba(52,211,153,0.45)',
              animation:  'pulse 1.2s ease-in-out infinite',
            }}
          />
        )}

        {/* ── Task title (top-left) ────────────────────────────────────── */}
        {taskTitle && sessionOn && (
          <div
            className="absolute top-3 left-3 px-2.5 py-1.5 rounded-lg"
            style={{
              background:     'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              border:         '1px solid rgba(52,211,153,0.2)',
            }}
          >
            <span className="text-xs font-medium" style={{ color: '#34d399' }}>
              {taskTitle}
            </span>
          </div>
        )}

        {/* ── ARIA speaking badge (top-right) ──────────────────────────── */}
        {isSpeaking && sessionOn && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{
              background:     'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              border:         '1px solid rgba(52,211,153,0.25)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#34d399', animation: 'pulse 1s infinite' }}
            />
            <span className="text-[11px] font-medium" style={{ color: '#34d399' }}>ARIA</span>
          </div>
        )}

        {/* ── Camera controls (bottom-right) ───────────────────────────── */}
        {sessionOn && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">

            {/* Screenshot — only when camera is on */}
            {isCameraOn && (
              <button
                onClick={onTakeScreenshot}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{
                  background:     'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(10px)',
                  border:         '1px solid rgba(255,255,255,0.18)',
                }}
                title="Screenshot"
              >
                <span className="text-base">📸</span>
              </button>
            )}

            {/* Flip camera — only on multi-camera devices, only when camera on */}
            {hasMultipleCameras && isCameraOn && (
              <button
                onClick={onFlipCamera}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{
                  background:     'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(10px)',
                  border:         '1px solid rgba(255,255,255,0.18)',
                }}
                title={cameraFacing === 'environment' ? 'Switch to front camera' : 'Switch to rear camera'}
              >
                <span className="text-base">🔄</span>
              </button>
            )}

            {/* Camera on/off — always visible during session */}
            <button
              onClick={onToggleCamera}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{
                background:     isCameraOn ? 'rgba(0,0,0,0.6)' : 'rgba(239,68,68,0.35)',
                backdropFilter: 'blur(10px)',
                border:         `1px solid ${isCameraOn ? 'rgba(255,255,255,0.18)' : 'rgba(239,68,68,0.5)'}`,
              }}
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              <span className="text-base">{isCameraOn ? '📷' : '🚫'}</span>
            </button>
          </div>
        )}

        {/* ── Camera facing badge (bottom-left) ────────────────────────── */}
        {sessionOn && isCameraOn && (
          <div className="absolute bottom-3 left-3">
            <span
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded"
              style={{
                background: 'rgba(0,0,0,0.45)',
                color:      'rgba(255,255,255,0.4)',
                border:     '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {cameraFacing === 'environment' ? '↩ BACK' : '↪ FRONT'}
            </span>
          </div>
        )}

        {/* ── Paused overlay ───────────────────────────────────────────── */}
        {phase === 'paused' && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">⏸</div>
              <p className="text-sm font-medium text-white/60">Paused</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Screenshot preview overlay ───────────────────────────────────── */}
      {screenshotDataUrl && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-20"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
        >
          <img
            src={screenshotDataUrl}
            alt="Screenshot"
            className="max-w-full rounded-xl object-contain"
            style={{ maxHeight: '68%' }}
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={onDownloadScreenshot}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:brightness-110"
              style={{
                background: 'rgba(52,211,153,0.18)',
                border:     '1px solid rgba(52,211,153,0.3)',
                color:      '#34d399',
              }}
            >
              ⬇ Download
            </button>
            <button
              onClick={onDismissScreenshot}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white/45 transition-all hover:text-white/75"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border:     '1px solid rgba(255,255,255,0.09)',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};