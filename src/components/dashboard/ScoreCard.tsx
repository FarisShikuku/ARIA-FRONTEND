import React from 'react';

interface ScoreCardProps {
  value: number;
  trend: string;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ value, trend }) => {
  const isEmpty = value === 0;

  return (
    <div className={`rounded-xl p-6 md:p-7 text-center relative overflow-hidden border ${
      isEmpty
        ? 'bg-bg-surface border-border'
        : 'bg-gradient-to-br from-cyan/5 to-cyan/10 border-cyan/20'
    }`}>
      <div className={`font-display text-6xl md:text-7xl font-bold leading-tight ${
        isEmpty ? 'text-text-muted/40' : 'text-cyan glow-text'
      }`}>
        {isEmpty ? '—' : value}
      </div>
      <div className="font-mono text-[10px] tracking-widest text-text-muted uppercase mt-2">
        Overall Performance
      </div>
      <div className={`font-display text-sm mt-3 ${
        isEmpty ? 'text-text-muted/40' : 'text-green'
      }`}>
        {isEmpty ? 'No data yet' : `▲ ${trend} from last session`}
      </div>
    </div>
  );
};