import React from 'react';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];

export const BarChart: React.FC = () => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1 md:gap-2 h-20">
        {days.map((day) => (
          <div key={day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            {/* All bars at minimum height, greyed out */}
            <div
              className="w-full rounded-t-sm bg-bg-surface border-t border-border/50"
              style={{ height: '8%' }}
            />
            <div className="font-mono text-[8px] text-text-muted/40">{day}</div>
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] text-text-muted/50 text-center">
        Session history will appear here after registration
      </p>
    </div>
  );
};