
'use client';

/**
 * CoachLayout.tsx — UPDATED
 *
 * WHAT CHANGED:
 * Previously had zero props — all data (session type, timer, tags) was
 * hardcoded static strings. Now accepts all live session props from
 * coach/page.tsx and passes them down to CoachMain and CoachSidebar.
 *
 * The "Start Session" overlay is rendered here when phase === 'ready'
 * so the user sees the coach UI behind it and knows what they're starting.
 */

import React from 'react';
import { CoachMain } from './CoachMain';
import { CoachSidebar } from './CoachSidebar';
import { Tag } from '@/components/ui/Tag';
import type { CoachMode, CoachMetrics, HintEvent, CoachSessionPhase } from '@/lib/types/coach.types';
import type { AgentState } from '@/hooks/useAgentState';

const MODE_LABELS: Record<CoachMode, string> = {
  interview: 'Interview Session',
  presentation: 'Presentation',
  music: 'Music Performance',
  mc: 'MC / Public Speaking',
  sermon: 'Sermon',
  negotiation: 'Negotiation',
};

interface CoachLayoutProps {
  mode: CoachMode | null;
  phase: CoachSessionPhase;
  agentState: AgentState;
  metrics: CoachMetrics;
  events: HintEvent[];
  elapsedSeconds: number;
  isMicOn: boolean;
  isCameraOn: boolean;
  isMuted: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onStart: () => Promise<void>;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onChangeMode: () => void;
  onFlipCamera: (facing: 'user' | 'environment') => void;  // NEW
}

export const CoachLayout: React.FC<CoachLayoutProps> = ({
  mode,
  phase,
  agentState,
  metrics,
  events,
  elapsedSeconds,
  isMicOn,
  isCameraOn,
  isMuted,
  videoRef,
  onStart,
  onPause,
  onResume,
  onEnd,
  onToggleMic,
  onToggleCamera,
  onToggleMute,
  onChangeMode,
  onFlipCamera,
}) => {
  const isActive = phase === 'active';
  const isPaused = phase === 'paused';
  const isReady  = phase === 'ready';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <section className="relative bg-bg-void border-t border-border px-4 md:px-8 py-12 md:py-16">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <div className="section-label text-amber">Coach Mode</div>
          <h2 className="section-title">
            Real-time <span className="text-amber">Performance</span> Coaching
          </h2>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          {mode && (
            <Tag color="amber">
              ● {MODE_LABELS[mode].toUpperCase()}
            </Tag>
          )}
          {isActive && <Tag color="green">RECORDING</Tag>}
          {isPaused && <Tag color="amber">PAUSED</Tag>}
          {isReady  && <Tag color="cyan">READY</Tag>}
          {(isActive || isPaused) && (
            <span className="font-mono text-sm text-cyan">{formatTime(elapsedSeconds)}</span>
          )}

          {/* Change mode button */}
          <button
            onClick={onChangeMode}
            className="font-mono text-[10px] tracking-wider uppercase px-3 py-1 rounded-sm border border-border-bright text-text-muted hover:text-cyan hover:border-cyan hover:bg-cyan-ghost transition-all"
          >
            Change Mode
          </button>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <CoachMain
          videoRef={videoRef}
          metrics={metrics}
          phase={phase}
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          isMuted={isMuted}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onToggleMute={onToggleMute}
          onPause={onPause}
          onResume={onResume}
          onEnd={onEnd}
          onFlipCamera={onFlipCamera}
        />
        <CoachSidebar
          agentState={agentState}
          events={events}
          clarityScore={metrics.clarityScore}
          energyScore={metrics.energyScore}
          impactScore={metrics.impactScore}
        />
      </div>

      {/* ── Start Session overlay (shown when phase === 'ready') ─────────── */}
      {isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-void/80 backdrop-blur-sm rounded-xl z-10">
          <div className="flex flex-col items-center gap-4 text-center px-8">
            <div className="font-mono text-[10px] tracking-widest uppercase text-amber">
              // Ready to Coach
            </div>
            <p className="text-text-muted text-sm max-w-xs">
              ARIA will activate and begin coaching you in real time. Make sure your camera and mic are ready.
            </p>
            <button
              onClick={onStart}
              className="px-8 py-3 rounded-md bg-amber/15 border border-amber/50 text-amber hover:bg-amber/25 font-mono text-sm tracking-wider uppercase transition-all duration-200 glow-box-amber"
            >
              ▶ Start Session
            </button>
          </div>
        </div>
      )}
    </section>
  );
};