'use client';

import React from 'react';
import { HUDPanel } from './HUDPanel';
import { AgentStateIndicator } from './AgentStateIndicator';
import { GPSWidget } from './GPSWidget';
import { DetectionLog } from './DetectionLog';
import { CameraFeed } from './CameraFeed';
import { ARIAVoiceCard } from './AriaVoiceCard';
import { RouteSteps } from './RouteSteps';
import { HapticPatterns } from './HapticPatterns';
import { QuickSOS } from './QuickSOS';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import type { AgentState } from '@/hooks/useAgentState';
import type { Environment } from '@/hooks/useGeolocation';
import type { DetectionResult } from '@/hooks/useNavigationSession';

// ── Props ─────────────────────────────────────────────────────────────────────

interface NavigationHUDProps {
  agentState: AgentState;
  urgencyScore: number;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCapturing: boolean;
  detections: DetectionResult[];
  environment: Environment;
  gpsAccuracy: number | null;
  onMute: () => void;
  onUnmute: () => void;
  onStop: () => void;
  sessionId: string | null;
}

// AgentState string → 0-based index for AgentStateIndicator
const STATE_INDEX: Record<AgentState, number> = {
  LISTENING:  0,
  OBSERVING:  1,
  EVALUATING: 2,
  COACHING:   3,
  SILENT:     4,
};

// ── Component ─────────────────────────────────────────────────────────────────

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  agentState,
  urgencyScore,
  isSpeaking,
  isListening,
  transcript,
  videoRef,
  isCapturing,
  detections,
  environment,
  gpsAccuracy,
  onMute,
  onUnmute,
  onStop,
  sessionId,
}) => {
  const stateIndex = STATE_INDEX[agentState] ?? 0;

  const envTag   = environment === 'indoor'  ? '● INDOOR MODE'
                 : environment === 'outdoor' ? '● OUTDOOR MODE'
                 : '● DETECTING ENV…';
  const envColor = environment === 'indoor' ? 'amber' : 'cyan';
  const gpsLocked = gpsAccuracy !== null && gpsAccuracy <= 20;

  return (
    <section className="bg-bg-deep border-t border-border px-4 md:px-8 py-12 md:py-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8 md:mb-10">
        <div>
          <div className="section-label">Navigation Mode</div>
          <h2 className="section-title">
            Live <span className="text-cyan">Navigation</span> HUD
          </h2>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <Tag color={envColor}>{envTag}</Tag>
          {gpsLocked && <Tag color="green">GPS LOCKED</Tag>}
          <Button variant="ghost" className="!px-4 !py-2 !text-xs" onClick={onStop}>
            ⚙ End Session
          </Button>
        </div>
      </div>

      {/* 3-column grid — identical layout to original */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4 lg:gap-5">

        {/* Left Panel */}
        <div className="flex flex-col gap-4">
          <HUDPanel title="// Agent State">
            <AgentStateIndicator currentState={stateIndex} />
          </HUDPanel>

          <HUDPanel title="// GPS Signal">
            <GPSWidget environment={environment} accuracy={gpsAccuracy} />
          </HUDPanel>

          <HUDPanel title="// Object Detection">
            <DetectionLog detections={detections} />
          </HUDPanel>
        </div>

        {/* Center Panel */}
        <div className="flex flex-col gap-4">
          <CameraFeed
            videoRef={videoRef}
            isCapturing={isCapturing}
            detections={detections}
          />
          <ARIAVoiceCard isSpeaking={isSpeaking} transcript={transcript} />
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-4">
          <HUDPanel title="// Active Route">
            <RouteSteps />
          </HUDPanel>

          <HUDPanel title="// Haptic Feedback">
            <HapticPatterns agentState={agentState} urgencyScore={urgencyScore} />
          </HUDPanel>

          <HUDPanel title="// Emergency" className="border-red/30">
            <QuickSOS sessionId={sessionId} />
          </HUDPanel>
        </div>
      </div>
    </section>
  );
};