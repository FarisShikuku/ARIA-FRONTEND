'use client';

/**
 * src/app/assist/page.tsx
 *
 * TWO STATES:
 *
 * 1. idle / listening  → ARIA bar at top (auto-started), task shortcut grid visible.
 *                        No video. ARIA introduces itself and waits for task.
 *
 * 2. active / paused   → Shortcut grid hidden. Video feed + transcript shown.
 *                        ARIA bar stays at top with controls.
 *
 * Task selection triggers the idle→active transition (click OR voice via ARIA).
 */

import React, { useEffect } from 'react';
import { useAssistSession } from '@/hooks/useAssistSession';
import { useAriaContext } from '@/contexts/AriaContext';
import { AssistAgentBar } from '@/components/assist/AssistAgentBar';
import { AssistVideoFeed } from '@/components/assist/AssistVideoFeed';
import { AssistTranscript } from '@/components/assist/AssistTranscript';
import { AssistSidebar } from '@/components/assist/AssistSidebar';
import { TaskShortcuts } from '@/components/assist/TaskShortcuts';

export default function AssistPage() {
  const { setPageFocus } = useAriaContext();

  const {
    session,
    videoRef,
    isSpeaking,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    selectTask,
    toggleMute,
    toggleCamera,
    flipCamera,
    takeScreenshot,
    downloadScreenshot,
    toggleStep,
    updateSessionNotes,
    exportSession,
  } = useAssistSession();

  // ── On mount: shift ARIA focus + auto-start voice session ────────────────
  useEffect(() => {
    setPageFocus('assist');
    // Small delay so WS is confirmed open before sending start_assist
    const t = setTimeout(() => { startSession(); }, 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  const transcriptText = session.transcript.length > 0
    ? session.transcript[session.transcript.length - 1]?.text ?? ''
    : '';

  const showShortcuts = session.phase === 'idle' || session.phase === 'listening' || session.phase === 'ended';
  const showVideo     = session.phase === 'active' || session.phase === 'paused';

  // When user clicks a shortcut, selectTask transitions to active + starts video
  const handleSelectTask = (query: string, label: string) => {
    selectTask(query, label);
  };

  const handleDismissScreenshot = () => {
    // handled internally in AssistVideoFeed via onDismissScreenshot
  };

  return (
    <>
      {/* ── Agent bar — always at top (below navbar) ── */}
      <AssistAgentBar
        phase={session.phase}
        taskTitle={session.taskTitle}
        sessionDuration={session.sessionDuration}
        isSpeaking={isSpeaking}
        isMuted={session.isMuted}
        transcript={transcriptText}
        onToggleMute={toggleMute}
        onPause={pauseSession}
        onResume={resumeSession}
        onEnd={endSession}
      />

      {/* ── Page content — always padded for bar (48px) + navbar (64px) ── */}
      <div
        className="min-h-screen"
        style={{ background: '#070c07', paddingTop: '48px' }}
      >

        {/* ── IDLE / LISTENING: shortcut grid ── */}
        {showShortcuts && (
          <div className="max-w-2xl mx-auto px-4 py-10">

            {/* Minimal header */}
            <div className="text-center mb-8">
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, rgba(52,211,153,0.03) 100%)',
                  border: '1px solid rgba(52,211,153,0.15)',
                }}
              >
                <span className="text-2xl">✦</span>
              </div>
              <h1 className="text-2xl font-bold text-white/80 mb-1 tracking-tight">
                ARIA <span style={{ color: '#34d399' }}>Assist</span>
              </h1>
              <p className="text-sm text-white/30 max-w-xs mx-auto">
                {session.phase === 'listening'
                  ? 'Tell me what you need help with, or tap a task below'
                  : 'Your live AI assistant for any task'}
              </p>
            </div>

            {/* Task shortcuts — full grid */}
            <TaskShortcuts onSelect={handleSelectTask} />

            {/* Soft hint */}
            <p className="text-center text-[11px] text-white/20 mt-8 font-mono tracking-wider">
              OR JUST SPEAK TO ARIA
            </p>
          </div>
        )}

        {/* ── ACTIVE / PAUSED: video + transcript + sidebar ── */}
        {showVideo && (
          <div className="flex gap-4 px-4 py-4 max-w-7xl mx-auto">

            {/* Left: video + transcript */}
            <div className="flex flex-col gap-4 flex-1 min-w-0">
              <AssistVideoFeed
                videoRef={videoRef}
                phase={session.phase}
                isCameraOn={session.isCameraOn}
                cameraFacing={session.cameraFacing}
                hasMultipleCameras={session.hasMultipleCameras}
                isSpeaking={isSpeaking}
                taskTitle={session.taskTitle}
                screenshotDataUrl={session.screenshotDataUrl}
                onFlipCamera={flipCamera}
                onToggleCamera={toggleCamera}
                onTakeScreenshot={takeScreenshot}
                onDownloadScreenshot={downloadScreenshot}
                onDismissScreenshot={handleDismissScreenshot}
              />
              <AssistTranscript
                entries={session.transcript}
                isSpeaking={isSpeaking}
              />
            </div>

            {/* Right: sidebar (lg+) */}
            <div className="w-72 shrink-0 hidden lg:flex flex-col" style={{ minHeight: '500px' }}>
              <AssistSidebar
                steps={session.steps}
                timeline={session.timeline}
                sessionNotes={session.sessionNotes}
                sessionDuration={session.sessionDuration}
                taskTitle={session.taskTitle}
                onToggleStep={toggleStep}
                onUpdateNotes={updateSessionNotes}
                onExport={exportSession}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}