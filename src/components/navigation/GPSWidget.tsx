import React from 'react';
import type { Environment } from '@/hooks/useGeolocation';

interface GPSWidgetProps {
  environment: Environment;
  accuracy: number | null;
}

export const GPSWidget: React.FC<GPSWidgetProps> = ({ environment, accuracy }) => {
  const isLocked      = accuracy !== null && accuracy <= 20;
  const accuracyLabel = accuracy !== null ? `±${Math.round(accuracy)}m accuracy` : 'Acquiring…';

  const envTagClass = environment === 'indoor'  ? 'tag-amber'
                    : environment === 'outdoor' ? 'tag-green'
                    : 'tag-cyan';
  const envLabel    = environment === 'indoor'  ? 'INDOOR'
                    : environment === 'outdoor' ? 'OUTDOOR'
                    : 'DETECTING…';

  return (
    <>
      <div className="bg-bg-surface border border-border rounded-md p-4">
        <div className="font-mono text-[9px] text-text-muted tracking-wider uppercase mb-1.5">
          GPS Signal
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="relative">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isLocked ? 'bg-green shadow-[0_0_6px_#00e676]' : 'bg-amber'
              }`}
            />
            {isLocked && (
              <div className="absolute inset-[-3px] rounded-full bg-green/50 animate-pulse-ring" />
            )}
          </div>
          <span className={`font-mono text-[10px] ${isLocked ? 'text-green' : 'text-amber'}`}>
            {accuracyLabel}
          </span>
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <span className={`tag ${envTagClass} !text-[9px]`}>{envLabel}</span>
        <span className="tag tag-cyan !text-[9px]">AUTO-DETECT</span>
      </div>
    </>
  );
};