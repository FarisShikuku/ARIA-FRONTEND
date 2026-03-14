'use client';

/**
 * src/app/assist/page.tsx
 *
 * ARIA Assist — Live visual AI assistant for daily tasks.
 * Shows a full-dashboard when active, an immersive idle splash when not.
 */

import React, { useState, useEffect } from 'react';
import { useAssistSession } from '@/hooks/useAssistSession';
import { useAriaContext } from '@/contexts/AriaContext';
import { AssistAgentBar } from '@/components/assist/AssistAgentBar';
import { AssistLayout } from '@/components/assist/AssistLayout';
import { TaskShortcuts } from '@/components/assist/TaskShortcuts';

export default function AssistPage() {
  const { setPageFocus } = useAriaContext();

  // Shift ARIA's persona to Assist-focused on mount
  useEffect(() => {
    setPageFocus('assist');
  }, [setPageFocus]);

  const {
    session,
    videoRef,
    isSpeaking,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    toggleMute,
    toggleCamera,
    flipCamera,
    takeScreenshot,
    downloadScreenshot,
    toggleStep,
    updateSessionNotes,
    exportSession,
    sendQuickTask,
  } = useAssistSession();

  const [inputQuery, setInputQuery] = useState('');
  const [screenshotDismissed, setScreenshotDismissed] = useState(false);

  const handleStart = (query?: string) => {
    setScreenshotDismissed(false);
    startSession(query || inputQuery || undefined);
  };

  const handleQuickTask = (query: string, label: string) => {
    setInputQuery(label);
    sendQuickTask(query);
  };

  const handleDismissScreenshot = () => {
    setScreenshotDismissed(true);
  };

  const isActive = session.phase === 'active' || session.phase === 'paused';
  const transcriptText = session.transcript.length > 0
    ? session.transcript[session.transcript.length - 1]?.text ?? ''
    : '';

  return (
    <>
      {/* Fixed agent bar (below navbar) */}
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

      {/* Page content — pt-12 when bar is visible */}
      <div
        className={`min-h-screen transition-all duration-300 ${isActive ? 'pt-12' : ''}`}
        style={{ background: '#070c07' }}
      >
        {/* ── IDLE / ENDED: splash screen ── */}
        {(session.phase === 'idle' || session.phase === 'ended') && (
          <div className="max-w-3xl mx-auto px-4 py-12">

            {/* Hero */}
            <div className="text-center mb-12">
              {/* Glow orb */}
              <div
                className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center relative"
                style={{
                  background: 'radial-gradient(circle, rgba(52,211,153,0.2) 0%, rgba(52,211,153,0.04) 70%)',
                  boxShadow: '0 0 60px rgba(52,211,153,0.15), 0 0 120px rgba(52,211,153,0.07)',
                  border: '1px solid rgba(52,211,153,0.2)',
                }}
              >
                <span className="text-4xl">✦</span>
                {/* Pulse rings */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '1px solid rgba(52,211,153,0.15)',
                    animation: 'ping 2s ease-out infinite',
                    transform: 'scale(1.3)',
                  }}
                />
              </div>

              <h1
                className="text-4xl font-bold tracking-tight mb-3"
                style={{ color: '#f0fdf4', fontFamily: 'system-ui, sans-serif' }}
              >
                ARIA{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #34d399 0%, #6ee7b7 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Assist
                </span>
              </h1>
              <p className="text-base text-white/40 max-w-md mx-auto leading-relaxed">
                Your live AI assistant for any task. Point your camera, start talking —
                ARIA sees what you see and helps you through it.
              </p>

              {session.phase === 'ended' && (
                <div
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm"
                  style={{
                    background: 'rgba(52,211,153,0.1)',
                    border: '1px solid rgba(52,211,153,0.2)',
                    color: '#34d399',
                  }}
                >
                  ✓ Session ended — start a new one below
                </div>
              )}
            </div>

            {/* Input + start */}
            <div className="mb-10">
              <div className="relative">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
                  placeholder="What do you need help with? Or pick a task below..."
                  className="w-full px-5 py-4 rounded-2xl text-sm outline-none transition-all pr-32"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(52,211,153,0.2)',
                    color: 'rgba(255,255,255,0.85)',
                    caretColor: '#34d399',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(52,211,153,0.45)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(52,211,153,0.2)'; e.target.style.background = 'rgba(255,255,255,0.04)'; }}
                />
                <button
                  onClick={() => handleStart()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, rgba(52,211,153,0.8) 0%, rgba(16,185,129,0.8) 100%)',
                    color: '#0a0f0a',
                  }}
                >
                  Start →
                </button>
              </div>
            </div>

            {/* Quick task shortcuts */}
            <div>
              <p className="text-xs text-white/25 uppercase tracking-widest font-mono mb-4 text-center">
                Or jump straight in
              </p>
              <TaskShortcuts onSelect={handleQuickTask} />
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-10">
              {[
                '📷 Front & back camera',
                '🎤 Live voice',
                '📋 Step breakdown',
                '📸 Screenshot',
                '💾 Save session',
                '🔄 Switch tasks',
              ].map((f) => (
                <span
                  key={f}
                  className="text-xs px-3 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(52,211,153,0.06)',
                    border: '1px solid rgba(52,211,153,0.12)',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── ACTIVE / PAUSED: dashboard ── */}
        {isActive && (
          <div className="px-4 py-4 max-w-7xl mx-auto">
            <AssistLayout
              session={session}
              videoRef={videoRef}
              isSpeaking={isSpeaking}
              onFlipCamera={flipCamera}
              onToggleCamera={toggleCamera}
              onTakeScreenshot={takeScreenshot}
              onDownloadScreenshot={downloadScreenshot}
              onDismissScreenshot={handleDismissScreenshot}
              onToggleStep={toggleStep}
              onUpdateNotes={updateSessionNotes}
              onExport={exportSession}
              onQuickTask={handleQuickTask}
            />
          </div>
        )}
      </div>
    </>
  );
}