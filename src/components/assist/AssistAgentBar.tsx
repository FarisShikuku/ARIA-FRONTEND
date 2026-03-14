'use client';

/**
 * src/components/assist/AssistAgentBar.tsx
 *
 * Always visible below the navbar on the Assist page (top: 64px).
 *
 * idle      → flat waveform, "Say something or pick a task below"
 * listening → animated waveform, ARIA speaking/listening, mute + end controls
 * active    → full controls: mute / pause / end, task title, timer
 * paused    → PAUSED badge + resume button
 */

import React, { useEffect, useRef } from 'react';
import { AssistSessionPhase, formatDuration } from '@/hooks/useAssistSession';

interface AssistAgentBarProps {
  phase: AssistSessionPhase;
  taskTitle: string;
  sessionDuration: number;
  isSpeaking: boolean;
  isMuted: boolean;
  transcript: string;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export const AssistAgentBar: React.FC<AssistAgentBarProps> = ({
  phase, taskTitle, sessionDuration, isSpeaking, isMuted,
  transcript, onToggleMute, onPause, onResume, onEnd,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(phase);
  const speakingRef = useRef(isSpeaking);
  const mutedRef = useRef(isMuted);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { speakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { mutedRef.current = isMuted; }, [isMuted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let t = 0;
    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width; const H = canvas.height;
      const bars = 28; const barW = 2;
      const gap = (W - bars * barW) / (bars + 1);
      const p = phaseRef.current;
      const speaking = speakingRef.current;
      const muted = mutedRef.current;
      for (let i = 0; i < bars; i++) {
        const x = gap + i * (barW + gap);
        let h = 2; let alpha = 0.12;
        if (!muted && p !== 'idle' && p !== 'ended') {
          if (speaking) { h = (Math.sin(t*3+i*0.5)*0.5+0.5)*(H*0.8)+3; alpha = 0.9; }
          else if (p === 'listening') { h = (Math.sin(t*0.8+i*0.6)*0.5+0.5)*(H*0.22)+2; alpha = 0.3; }
          else { h = (Math.sin(t*1.2+i*0.8)*0.5+0.5)*(H*0.16)+2; alpha = 0.3; }
        }
        ctx.fillStyle = `rgba(52,211,153,${alpha})`;
        ctx.beginPath(); ctx.roundRect(x,(H-h)/2,barW,h,1); ctx.fill();
      }
      t += 0.04;
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const isIdle = phase === 'idle' || phase === 'ended';
  const isListening = phase === 'listening';
  const isActive = phase === 'active' || phase === 'paused';

  return (
    <div
      className="fixed left-0 right-0 z-40 flex items-center px-4 gap-3"
      style={{
        top: '64px', height: '48px',
        background: 'rgba(7,12,7,0.96)',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${isIdle ? 'rgba(52,211,153,0.06)' : 'rgba(52,211,153,0.16)'}`,
        boxShadow: '0 2px 20px rgba(0,0,0,0.5)',
        transition: 'border-color 0.4s',
      }}
    >
      {/* Left: dot + ARIA label + status */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <div className="relative flex items-center justify-center w-2 h-2">
          <div className="w-1.5 h-1.5 rounded-full"
            style={{ background: isIdle ? 'rgba(52,211,153,0.25)' : '#34d399' }} />
          {!isIdle && !isMuted && (
            <div className="absolute inset-[-3px] rounded-full opacity-30"
              style={{ background: '#34d399', animation: 'ping 2s ease-out infinite' }} />
          )}
        </div>

        <span className="text-[11px] font-mono font-bold tracking-widest uppercase shrink-0"
          style={{ color: isIdle ? 'rgba(52,211,153,0.3)' : '#34d399' }}>
          ARIA
        </span>

        <span className="text-white/10 text-xs shrink-0">|</span>

        {isIdle && (
          <span className="text-[11px] text-white/25 font-light truncate">
            Say something or pick a task below
          </span>
        )}
        {isListening && !isSpeaking && (
          <span className="text-[11px] text-white/35 italic truncate">Listening…</span>
        )}
        {isListening && isSpeaking && (
          <span className="text-[11px] font-medium truncate max-w-[200px]"
            style={{ color: '#34d399cc' }}>
            {transcript || 'Speaking…'}
          </span>
        )}
        {isActive && (
          <span className="text-[11px] font-medium truncate max-w-[160px]"
            style={{ color: '#34d399bb' }}>
            {taskTitle || 'Assist'}
          </span>
        )}
        {phase === 'paused' && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
            style={{ background:'rgba(251,191,36,0.1)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.2)' }}>
            PAUSED
          </span>
        )}
      </div>

      {/* Center: waveform + active transcript */}
      <div className="flex-1 flex items-center gap-3 min-w-0 overflow-hidden">
        <canvas ref={canvasRef} width={96} height={32} className="shrink-0" />
        {isActive && transcript && (
          <span className="text-[11px] text-white/35 truncate italic font-light">
            {transcript}
          </span>
        )}
      </div>

      {/* Right: controls */}
      {!isIdle && (
        <div className="flex items-center gap-2 shrink-0">
          {isActive && (
            <span className="text-[11px] font-mono text-white/25 tabular-nums">
              {formatDuration(sessionDuration)}
            </span>
          )}

          {/* Mute */}
          <button onClick={onToggleMute}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-105"
            style={{
              background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.08)',
              border: `1px solid ${isMuted ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.18)'}`,
            }}
            title={isMuted ? 'Unmute' : 'Mute'}>
            <span className="text-xs">{isMuted ? '🔇' : '🎤'}</span>
          </button>

          {/* Pause/Resume — active only */}
          {isActive && (phase === 'active' ? (
            <button onClick={onPause}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}
              title="Pause">
              <span className="text-xs">⏸</span>
            </button>
          ) : (
            <button onClick={onResume}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-105"
              style={{ background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.22)' }}
              title="Resume">
              <span className="text-xs">▶</span>
            </button>
          ))}

          {/* End */}
          <button onClick={onEnd}
            className="px-2.5 h-7 rounded-full flex items-center gap-1 text-[11px] font-medium transition-all hover:brightness-110"
            style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', color:'#f87171' }}>
            <span className="text-[9px]">■</span> End
          </button>
        </div>
      )}
    </div>
  );
};