import React from 'react';
import type { DetectionResult } from '@/hooks/useNavigationSession';

// CHANGED: removed hardcoded `detections` array and `Detection` import from @/types.
// Now accepts `detections: DetectionResult[]` prop from useNavigationSession.
// Urgency score (0-1 float) drives the border colour, replacing the old severity string.
// Shows an empty state row when no detections are present.
// All classNames identical to original.

interface DetectionLogProps {
  detections: DetectionResult[];
}

function severityBorder(urgency: number): string {
  if (urgency > 0.6)  return 'border-l-red';
  if (urgency > 0.35) return 'border-l-amber';
  return 'border-l-text-muted';
}

export const DetectionLog: React.FC<DetectionLogProps> = ({ detections }) => {
  if (!detections || detections.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60px]">
        <span className="font-mono text-[10px] text-text-muted">No objects detected</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
      {detections.map((d, i) => (
        <div
          key={`${d.label}-${i}`}
          className={`
            flex items-center justify-between p-1.5 bg-bg-surface rounded-sm font-mono text-[10px]
            animate-slide-in-right border-l-2 ${severityBorder(d.urgency)}
          `}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-text-primary capitalize">{d.label}</span>
            {(d.direction || d.distance_hint) && (
              <span className="text-text-muted text-[9px]">
                {[d.direction, d.distance_hint].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <span className="text-text-muted">{d.confidence.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};