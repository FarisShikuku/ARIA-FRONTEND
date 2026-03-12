import React from 'react';
import { Tag } from '@/components/ui/Tag';
import type { AgentState } from '@/hooks/useAgentState';

// CHANGED: added agentState and urgencyScore props.
// Active pattern now driven by real agent state instead of hardcoded "Turn Right".
// EVALUATING + high urgency → Obstacle active.
// COACHING (ARIA speaking) → Turn Right active.
// SILENT → Stop active.
// Otherwise → no pattern active (all standby).
// All classNames, layout, text: identical to original.

interface HapticPatternsProps {
  agentState: AgentState;
  urgencyScore: number;
}

type PatternId = 'turn_right' | 'stop' | 'obstacle';

function resolveActive(state: AgentState, urgency: number): PatternId | null {
  if (state === 'EVALUATING' && urgency > 0.5) return 'obstacle';
  if (state === 'COACHING')                    return 'turn_right';
  if (state === 'SILENT')                      return 'stop';
  return null;
}

const patterns: { id: PatternId; label: string }[] = [
  { id: 'turn_right', label: '⟫⟫⟫ Turn Right' },
  { id: 'stop',       label: '▐▐ Stop'         },
  { id: 'obstacle',   label: '▓▓▓ Obstacle'    },
];

export const HapticPatterns: React.FC<HapticPatternsProps> = ({ agentState, urgencyScore }) => {
  const active = resolveActive(agentState, urgencyScore);

  return (
    <div className="flex flex-col gap-2">
      {patterns.map((p) => {
        const isActive = p.id === active;
        return (
          <div
            key={p.id}
            className={`flex items-center justify-between p-2 border-l-2 bg-bg-surface rounded-sm transition-all duration-300 ${
              isActive ? 'border-cyan' : 'border-text-muted opacity-50'
            }`}
          >
            <span className="text-[11px] text-text-primary">{p.label}</span>
            {isActive ? (
              <Tag color="cyan" className="!text-[8px]">Active</Tag>
            ) : (
              <span className="font-mono text-[10px] text-text-muted">Standby</span>
            )}
          </div>
        );
      })}
    </div>
  );
};