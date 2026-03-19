import React from 'react';

const fillerWords = ['um', 'uh', 'like', 'you know'];

export const FillerWordsList: React.FC = () => {
  return (
    <div className="flex flex-col gap-2">
      {fillerWords.map((word) => (
        <div key={word} className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-text-muted/40 min-w-[50px]">{word}</span>
          <div className="flex-1 h-1.5 bg-bg-surface rounded-sm overflow-hidden">
            {/* Empty bar */}
            <div className="h-full w-0 bg-border rounded-sm" />
          </div>
          <span className="font-mono text-[10px] text-text-muted/40 min-w-[24px] text-right">
            0×
          </span>
        </div>
      ))}
      <p className="font-mono text-[10px] text-text-muted/50 text-center mt-1">
        Requires an active session
      </p>
    </div>
  );
};