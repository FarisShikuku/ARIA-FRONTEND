'use client';

/**
 * src/app/coach/page.tsx
 *
 * CHANGE vs previous version:
 *
 * hasMultipleCameras passed to CoachLayout → CoachMain → VideoFeed
 * WHY: VideoFeed only renders the flip button when hasMultipleCameras is true.
 * Previously it was always shown (even on laptops with one camera).
 * useCoachSession now exposes hasMultipleCameras from useMediaCapture.
 *
 * Everything else unchanged.
 */

import React from 'react';
import { CoachAgentBar } from '@/components/coach/CoachAgentBar';
import { CoachModeSelector } from '@/components/coach/CoachModeSelector';
import { CoachLayout } from '@/components/coach/CoachLayout';
import { useCoachSession } from '@/hooks/useCoachSession';

export default function CoachPage() {
  const coach = useCoachSession();
  const { session, agentState, isSpeaking, isListening, transcript, videoRef } = coach;

  const showSelector = session.phase === 'idle' || session.phase === 'selecting';
  const showCoachUI  = session.phase === 'ready' || session.phase === 'active' || session.phase === 'paused';
  const showEnded    = session.phase === 'ended';

  return (
    <>
      {/* ── Permanent floating AI control bar ────────────────────────────── */}
      <CoachAgentBar
        phase={session.phase}
        mode={session.mode}
        isSpeaking={isSpeaking}
        isListening={isListening}
        isMuted={session.isMuted}
        transcript={transcript}
        elapsedSeconds={session.elapsedSeconds}
        onToggleMute={coach.toggleMute}
        onPause={coach.pauseSession}
        onResume={coach.resumeSession}
        onSwitchToNavigation={coach.switchToNavigation}
      />

      {/* ── pt-12 clears the 48px CoachAgentBar ──────────────────────────── */}
      <div className="pt-12">

        {/* ── Phase: Mode Selection ─────────────────────────────────────── */}
        {showSelector && (
          <CoachModeSelector
            onSelect={(mode) => { coach.selectMode(mode); }}
            selectedMode={session.mode}
          />
        )}

        {/* ── Phase: Ready / Active / Paused ────────────────────────────── */}
        {showCoachUI && (
          <div className="relative">
            <CoachLayout
              mode={session.mode}
              phase={session.phase}
              agentState={agentState}
              metrics={session.metrics}
              events={session.events}
              elapsedSeconds={session.elapsedSeconds}
              isMicOn={session.isMicOn}
              isCameraOn={session.isCameraOn}
              isMuted={session.isMuted}
              videoRef={videoRef}
              onStart={coach.startSession}
              onPause={coach.pauseSession}
              onResume={coach.resumeSession}
              onEnd={coach.endSession}
              onToggleMic={coach.toggleMic}
              onToggleCamera={coach.toggleCamera}
              onToggleMute={coach.toggleMute}
              onChangeMode={() => coach.selectMode(session.mode!)}
              onFlipCamera={coach.flipCamera}
              hasMultipleCameras={coach.hasMultipleCameras}
            />
          </div>
        )}

        {/* ── Phase: Session Ended ───────────────────────────────────────── */}
        {showEnded && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-8">
            <div className="font-mono text-[10px] tracking-widest uppercase text-green mb-2">
              // Session Complete
            </div>
            <h2 className="font-display text-3xl font-bold text-text-primary text-center">
              Great work! Session ended.
            </h2>
            <p className="text-text-muted text-sm text-center max-w-sm">
              Your session has been saved. Check the Dashboard for your full analytics and coaching trends.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 rounded-md border border-cyan/40 text-cyan hover:bg-cyan-ghost font-mono text-xs tracking-wider uppercase transition-all"
              >
                New Session
              </button>
              <a
                href="/dashboard"
                className="px-6 py-2.5 rounded-md bg-cyan/10 border border-cyan/30 text-cyan hover:bg-cyan/20 font-mono text-xs tracking-wider uppercase transition-all"
              >
                View Dashboard →
              </a>
            </div>
          </div>
        )}

      </div>
    </>
  );
}