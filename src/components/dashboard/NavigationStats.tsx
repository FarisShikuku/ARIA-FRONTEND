import React from 'react';

const stats = [
  { label: 'Routes completed',  value: '0' },
  { label: 'Distance navigated', value: '0 km' },
  { label: 'Hazards avoided',   value: '0' },
  { label: 'SOS triggers',      value: '0' },
];

export const NavigationStats: React.FC = () => {
  return (
    <div className="flex flex-col gap-2.5">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="flex justify-between items-center p-2.5 bg-bg-surface rounded-sm"
        >
          <span className="text-xs text-text-muted/50">{label}</span>
          <span className="font-display text-xl font-bold text-text-muted/30">{value}</span>
        </div>
      ))}
      <p className="font-mono text-[10px] text-text-muted/50 text-center mt-0.5">
        Requires an active navigation session
      </p>
    </div>
  );
};