import React, { useState } from 'react';

export const VideoControls: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 items-center">
      <button className="w-10 h-10 rounded-full border border-border-bright bg-bg-surface/80 text-text-primary text-base hover:border-cyan hover:text-cyan transition-all duration-200 backdrop-blur-md">
        🎤
      </button>
      <button className="w-10 h-10 rounded-full border border-border-bright bg-bg-surface/80 text-text-primary text-base hover:border-cyan hover:text-cyan transition-all duration-200 backdrop-blur-md active">
        📹
      </button>
      <button
        onClick={() => setIsPaused(!isPaused)}
        className={`
          w-13 h-13 rounded-full border-2 text-xl transition-all duration-200 backdrop-blur-md
          ${
            isPaused
              ? 'border-amber bg-bg-surface/80 text-amber'
              : 'border-amber/20 bg-bg-surface/80 text-amber'
          }
        `}
      >
        {isPaused ? '▶' : '⏸'}
      </button>
      <button className="w-10 h-10 rounded-full border border-border-bright bg-bg-surface/80 text-text-primary text-base hover:border-cyan hover:text-cyan transition-all duration-200 backdrop-blur-md">
        🔊
      </button>
      <button className="w-10 h-10 rounded-full border border-red/50 bg-bg-surface/80 text-red text-base hover:bg-red hover:text-white transition-all duration-200 backdrop-blur-md">
        ⏹
      </button>
    </div>
  );
}; 
