'use client';

/**
 * src/app/page.tsx — HOME PAGE
 *
 * CHANGES vs previous version:
 *
 * 1. CAMERA WIRED TO ARIA
 *    WHY: HomeCameraFeed previously ran a standalone getUserMedia that displayed
 *    video locally but never sent frames anywhere. ARIA had no visual input on
 *    the home page. Now HomeCameraFeed uses useMediaCapture, which sends
 *    [10-byte "video" header][JPEG] frames over the WebSocket to Gemini.
 *    sendBinary is obtained from AriaIntroBar via the onSessionReady callback —
 *    no duplicate sessions are created.
 *
 * 2. DEFAULT CAMERA: environment (rear) with fallback
 *    WHY: The home page is general assistance — rear camera points at the world
 *    (objects, documents, surroundings) which is more useful than the front cam.
 *    useMediaCapture already handles the fallback: if environment fails (e.g.
 *    laptop with only a front cam), it retries without any facingMode constraint
 *    and uses whatever camera is available.
 *
 * 3. GRACEFUL PERMISSION DENIAL
 *    WHY: Previously HomeCameraFeed returned null on camera denial — zero UI
 *    feedback. Now:
 *    - Camera denied → persistent widget showing a blocked state + retry button
 *    - Mic denied    → persistent banner with clear "ARIA is voice-only" message
 *    - Both denied   → combined banner, strongest wording
 *    The mic check lives inside HomeCameraFeed (home page only) so it doesn't
 *    affect AriaIntroBar on other pages. AriaIntroBar handles its own mic check
 *    internally via navigator.permissions.
 *
 * 4. ARIA CAN CONFIRM CAMERA STATUS
 *    WHY: isCapturing from useMediaCapture is lifted to HomePage and passed to
 *    AriaIntroBar as cameraConnected. The bar shows a "📷 Cam ✓" indicator so
 *    ARIA and the user both have visual confirmation that video is flowing.
 *
 * No other pages or components are affected.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Hero }            from '@/components/home/Hero';
import { OnboardingSteps } from '@/components/home/OnboardingSteps';
import { AriaIntroBar }    from '@/components/home/AriaIntroBar';
import { ModeSelector }    from '@/components/home/ModeSelector';
import { useMediaCapture } from '@/hooks/useMediaCapture';

// ── HomeCameraFeed ─────────────────────────────────────────────────────────────
//
// Renders a small toggleable camera preview in the bottom-right corner.
// Sends frames to Gemini via the sendFrame prop (wired to sendBinary from
// AriaIntroBar's session). Handles camera + mic permission denial gracefully.

interface HomeCameraFeedProps {
  /** sendBinary from AriaIntroBar's session — frames go straight to Gemini */
  sendFrame: (data: ArrayBuffer) => void;
  /** Called whenever capture starts or stops so HomePage can reflect status */
  onStateChange?: (connected: boolean) => void;
}

function HomeCameraFeed({ sendFrame, onStateChange }: HomeCameraFeedProps) {
  const [isVisible, setIsVisible]       = useState(true);
  const [micPermission, setMicPermission] = useState<PermissionState | 'unknown'>('unknown');

  // ── Camera via useMediaCapture ─────────────────────────────────────────────
  // facingMode: 'environment' = rear camera (points at the world).
  // useMediaCapture's built-in fallback handles devices with only a front cam:
  //   1st attempt → { ideal: 'environment' } (soft constraint, never throws)
  //   2nd attempt → no facingMode at all     (absolute fallback)
  const {
    videoRef,
    isCapturing,
    startCapture,
    stopCapture,
    error: cameraError,
  } = useMediaCapture({
    sendFrame,
    enabled: true,
    fps: 1,           // 1 frame/second is enough for home-page general assistance
    quality: 0.7,
    maxDimension: 512,
    facingMode: 'environment',
  });

  // Start capture once on mount; useMediaCapture handles its own unmount cleanup.
  useEffect(() => {
    startCapture();
    return () => stopCapture();
  // startCapture/stopCapture are stable useCallbacks — this runs exactly once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Propagate capture state upward so HomePage can pass it to AriaIntroBar.
  useEffect(() => {
    onStateChange?.(isCapturing && !cameraError);
  }, [isCapturing, cameraError, onStateChange]);

  // ── Mic permission check ────────────────────────────────────────────────────
  // Mic is managed by useAriaIntro / useGeminiLive, not by this component, but
  // we check its permission state here so we can surface a denial message.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setMicPermission(status.state);
        status.onchange = () => setMicPermission(status.state);
      })
      .catch(() => {/* permissions API not available */});
  }, []);

  const cameraDenied       = !!cameraError;
  const micDenied          = micPermission === 'denied';
  const showPermissionBanner = cameraDenied || micDenied;

  return (
    <>
      {/* ── Permission denial banner ──────────────────────────────────────── */}
      {/* Sits below AriaIntroBar (top-16 ~64px + bar height ~44px = 108px).   */}
      {/* Fixed so it never scrolls away — denial is a persistent state.       */}
      {showPermissionBanner && (
        <div
          className="fixed left-0 right-0 z-[39] flex items-center justify-between gap-3 px-4 md:px-8 py-2 bg-red-950/95 border-b border-red-500/30 backdrop-blur-sm"
          style={{ top: '108px' }}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-red-400 shrink-0 text-sm">⚠</span>
            <span className="text-[11px] font-mono text-red-200 leading-tight">
              {cameraDenied && micDenied
                ? 'Camera & microphone access blocked — ARIA requires both to work. Text chat is not supported.'
                : cameraDenied
                ? 'Camera access blocked — ARIA cannot see. Allow camera in browser settings.'
                : 'Microphone access blocked — ARIA is voice-only. Text chat is not supported. Allow mic in browser settings.'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Retry is useful for camera — lets the user try again after
                granting permission in browser settings without a full reload. */}
            {cameraDenied && (
              <button
                onClick={() => startCapture()}
                className="text-[10px] font-mono text-red-300 border border-red-500/40 px-2.5 py-1 rounded-full hover:bg-red-500/10 transition-colors"
                title="Retry camera access after granting permission in browser settings"
              >
                Retry
              </button>
            )}
            <span className="hidden sm:inline text-[10px] font-mono text-red-400/60">
              Allow in browser settings
            </span>
          </div>
        </div>
      )}

      {/* ── Camera widget — bottom right corner ──────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">

        {/* Toggle button — always visible so user can show/hide the preview */}
        <button
          onClick={() => setIsVisible((v) => !v)}
          className="px-3 py-1.5 rounded-full border border-border bg-bg-card/90 backdrop-blur-sm text-text-secondary text-[11px] font-mono tracking-wider hover:border-cyan/40 hover:text-cyan transition-colors"
          title={isVisible ? 'Hide camera preview' : 'Show camera preview'}
        >
          {isVisible ? '📷 Hide' : '📷 Camera'}
        </button>

        {/* Camera denied state — show blocked widget instead of hiding */}
        {isVisible && cameraDenied && (
          <div className="w-40 h-36 rounded-xl border border-red-500/30 bg-bg-card flex flex-col items-center justify-center gap-2 px-3">
            <span className="text-2xl">🚫</span>
            <span className="text-[10px] font-mono text-red-400 text-center leading-tight">
              Camera blocked
            </span>
            <span className="text-[9px] text-text-muted text-center leading-tight">
              ARIA needs camera to assist you visually
            </span>
            <button
              onClick={() => startCapture()}
              className="mt-0.5 text-[9px] font-mono text-cyan/70 border border-cyan/20 px-2.5 py-0.5 rounded-full hover:bg-cyan/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Live camera preview — rear camera, no mirror flip */}
        {isVisible && !cameraDenied && (
          <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-border bg-bg-card shadow-xl">

            {/* Live / connecting indicator */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCapturing ? 'bg-cyan animate-pulse' : 'bg-yellow-400 animate-pulse'
                }`}
              />
              <span className="text-[9px] font-mono text-cyan/80 tracking-wider">
                {isCapturing ? 'LIVE' : 'STARTING…'}
              </span>
            </div>

            {/* AI connected badge — tells user ARIA is actively receiving video */}
            {isCapturing && (
              <div className="absolute top-2 right-2 z-10">
                <span className="text-[8px] font-mono text-green-400/80 bg-black/40 px-1 py-0.5 rounded">
                  AI ✓
                </span>
              </div>
            )}

            {/* Video element — no scaleX(-1): rear camera is not mirrored */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Caption overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-[9px] text-white/60 font-mono text-center leading-tight">
                {isCapturing ? 'ARIA can see' : 'Connecting camera…'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── HomePage ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [cameraConnected, setCameraConnected] = useState(false);

  // sendBinary from AriaIntroBar's Gemini session.
  // Starts as a no-op — updated once AriaIntroBar fires onSessionReady.
  // Frames sent before the session is ready are silently dropped (fine).
  const sendFrameRef = useRef<(data: ArrayBuffer) => void>(() => {});

  // Stable callback so it doesn't re-render AriaIntroBar on every render.
  const handleAriaSessionReady = useCallback((sendBinary: (data: ArrayBuffer) => void) => {
    sendFrameRef.current = sendBinary;
  }, []);

  // Stable sendFrame wrapper — reads the latest sendBinary from the ref.
  // Stable reference means useMediaCapture's sendFrameRef updates correctly
  // without causing restarts.
  const sendFrame = useCallback((data: ArrayBuffer) => {
    sendFrameRef.current(data);
  }, []);

  return (
    <>
      {/* Fixed ARIA bar — visible immediately on render, even before session init */}
      <AriaIntroBar
        onSessionReady={handleAriaSessionReady}
        cameraConnected={cameraConnected}
      />

      {/* Spacer for fixed AriaIntroBar (~44px) */}
      <div className="h-11" aria-hidden="true" />

      {/* Camera feed — rear by default, wired to ARIA via sendFrame */}
      <HomeCameraFeed
        sendFrame={sendFrame}
        onStateChange={setCameraConnected}
      />

      <Hero />
      <ModeSelector />
      <OnboardingSteps />
    </>
  );
}