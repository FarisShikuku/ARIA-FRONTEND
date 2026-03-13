import React, { useState, useCallback, useRef } from 'react';

/**
 * VideoControls.tsx — MODIFIED / REWRITTEN
 *
 * CHANGE: Full live controls added — Pause, Resume, Record, Stop, Snapshot.
 *
 * WHY: The previous VideoControls had static placeholder buttons with no real
 * functionality. Coach sessions need live control over the video feed:
 *   - Pause/Resume to freeze a frame for review without ending the session
 *   - Record to capture the coaching session locally as a WebM file
 *   - Snapshot to save a still frame
 *   - Stop to end the current session
 *
 * Props:
 *   videoRef    — ref to the <video> element in VideoFeed (passed down through
 *                 CoachMain → VideoFeed → VideoControls or directly from CoachLayout)
 *   onStop      — called when the user clicks Stop Session
 *   isCapturing — whether the media stream is currently active
 *
 * Implementation notes:
 *   - Pause/Resume call videoRef.current.pause() / .play() directly.
 *   - Record uses MediaRecorder on the video element's srcObject stream.
 *     Chunks are collected and downloaded as a .webm file when recording stops.
 *   - Snapshot draws the current frame to an offscreen canvas → PNG download.
 *   - All state is local; no external state management needed.
 */

interface VideoControlsProps {
  videoRef:    React.RefObject<HTMLVideoElement | null>;
  isCapturing: boolean;
  onStop?:     () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  videoRef,
  isCapturing,
  onStop,
}) => {
  const [isPaused,   setIsPaused]   = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks   = useRef<Blob[]>([]);

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    videoRef.current?.pause();
    setIsPaused(true);
  }, [videoRef]);

  const handleResume = useCallback(() => {
    videoRef.current?.play().catch(() => {});
    setIsPaused(false);
  }, [videoRef]);

  // ── Snapshot ──────────────────────────────────────────────────────────────
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
    link.download = `aria-coach-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [videoRef]);

  // ── Record / Stop Recording ───────────────────────────────────────────────
  const handleStartRecording = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;

    const stream = video.srcObject as MediaStream;
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    recordedChunks.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `aria-coach-session-${Date.now()}.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    };

    recorder.start(250); // collect a chunk every 250ms
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, [videoRef]);

  const handleStopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-2">

      {/* Left group: playback controls */}
      <div className="flex items-center gap-2">
        {!isPaused ? (
          <button
            onClick={handlePause}
            disabled={!isCapturing}
            title="Pause video"
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[11px] font-medium
              border border-amber/40 text-amber bg-amber/10
              hover:bg-amber/20 transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
            `}
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            onClick={handleResume}
            disabled={!isCapturing}
            title="Resume video"
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[11px] font-medium
              border border-cyan/40 text-cyan bg-cyan/10
              hover:bg-cyan/20 transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
            `}
          >
            ▶ Resume
          </button>
        )}

        <button
          onClick={handleSnapshot}
          disabled={!isCapturing}
          title="Save snapshot"
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[11px] font-medium
            border border-border text-text-secondary bg-bg-surface
            hover:border-cyan/40 hover:text-cyan transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
        >
          📷 Snapshot
        </button>
      </div>

      {/* Center: record indicator */}
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            disabled={!isCapturing}
            title="Start recording session"
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[11px] font-medium
              border border-red/40 text-red-400 bg-red-500/10
              hover:bg-red-500/20 transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed
            `}
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Record
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            title="Stop recording and download"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[11px] font-medium border border-red/60 text-red-300 bg-red-500/20 hover:bg-red-500/30 transition-colors animate-pulse"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-blink" />
            Recording… Stop
          </button>
        )}
      </div>

      {/* Right: end session */}
      <button
        onClick={onStop}
        title="End coaching session"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[11px] font-medium border border-border text-text-muted bg-bg-surface hover:border-red/40 hover:text-red-400 transition-colors"
      >
        ⏹ End Session
      </button>
    </div>
  );
};