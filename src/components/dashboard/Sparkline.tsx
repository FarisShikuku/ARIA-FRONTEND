import React from 'react';

export const Sparkline: React.FC = () => {
  return (
    <div className="flex flex-col gap-2">
      <svg className="w-full h-20" viewBox="0 0 100 60" preserveAspectRatio="none">
        {/* Flat baseline — no data */}
        <line
          x1="0" y1="40" x2="100" y2="40"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        {/* Target line */}
        <line
          x1="0" y1="35" x2="100" y2="35"
          stroke="rgba(255,171,0,0.2)"
          strokeWidth="0.8"
          strokeDasharray="3 2"
        />
        <text x="2" y="33" fontSize="4" fill="rgba(255,171,0,0.3)" fontFamily="monospace">
          Target 130
        </text>
      </svg>
      <p className="font-mono text-[10px] text-text-muted/50 text-center">
        Speaking pace data will appear after your first session
      </p>
    </div>
  );
};