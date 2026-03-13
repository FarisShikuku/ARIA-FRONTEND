'use client';

/**
 * CoachModeSelector.tsx
 *
 * WHY THIS FILE EXISTS:
 * Previously, the coach layout hardcoded "INTERVIEW SESSION" in a tag.
 * Now the user actually chooses their coaching activity type before the session
 * starts. This component renders as an overlay when phase === 'idle' | 'ready'.
 *
 * The 6 modes: Interview, Presentation, Music Performance, MC/Public Speaking,
 * Sermon/Ministry, Negotiation — all requested by the user.
 *
 * On mode select → calls selectMode(mode) → closes and shows coach UI with
 * a "Start Session" button. ARIA hasn't activated yet (no Gemini connection
 * until startSession() is called — avoids wasting tokens on a cold open).
 */

import React from 'react';
import type { CoachMode, CoachModeConfig } from '@/lib/types/coach.types';

const MODES: CoachModeConfig[] = [
  {
    id: 'interview',
    label: 'Interview',
    icon: '💼',
    color: 'cyan',
    description: 'Job interviews, university admissions, media appearances',
    coachFocus: ['Speaking pace', 'Filler words', 'Eye contact', 'Confidence'],
    systemPromptHint: '',
  },
  {
    id: 'presentation',
    label: 'Presentation',
    icon: '📊',
    color: 'amber',
    description: 'Business pitches, keynotes, classroom presentations',
    coachFocus: ['Energy levels', 'Vocal variety', 'Pacing', 'Pause timing'],
    systemPromptHint: '',
  },
  {
    id: 'music',
    label: 'Music Performance',
    icon: '🎤',
    color: 'purple',
    description: 'Singing, live performance, studio delivery',
    coachFocus: ['Breath support', 'Stage presence', 'Audience connection', 'Mic technique'],
    systemPromptHint: '',
  },
  {
    id: 'mc',
    label: 'MC / Public Speaking',
    icon: '🎙️',
    color: 'green',
    description: 'Hosting events, speeches, community talks',
    coachFocus: ['Crowd energy', 'Transitions', 'Voice projection', 'Charisma'],
    systemPromptHint: '',
  },
  {
    id: 'sermon',
    label: 'Sermon / Ministry',
    icon: '✝️',
    color: 'amber',
    description: 'Sermons, religious teachings, spiritual addresses',
    coachFocus: ['Conviction', 'Emotional resonance', 'Scripture delivery', 'Pausing'],
    systemPromptHint: '',
  },
  {
    id: 'negotiation',
    label: 'Negotiation',
    icon: '🤝',
    color: 'cyan',
    description: 'Business deals, salary talks, conflict resolution',
    coachFocus: ['Strategic pauses', 'Tone control', 'Confidence', 'Listening cues'],
    systemPromptHint: '',
  },
];

const COLOR_STYLES = {
  cyan: {
    border: 'border-cyan/30 hover:border-cyan/70',
    bg: 'hover:bg-cyan-ghost',
    dot: 'bg-cyan',
    text: 'text-cyan',
    badge: 'bg-cyan/10 text-cyan border-cyan/20',
    glow: '0 0 20px rgba(0,229,255,0.15)',
  },
  amber: {
    border: 'border-amber/30 hover:border-amber/70',
    bg: 'hover:bg-amber/5',
    dot: 'bg-amber',
    text: 'text-amber',
    badge: 'bg-amber/10 text-amber border-amber/20',
    glow: '0 0 20px rgba(255,171,0,0.15)',
  },
  green: {
    border: 'border-green/30 hover:border-green/70',
    bg: 'hover:bg-green/5',
    dot: 'bg-green',
    text: 'text-green',
    badge: 'bg-green/10 text-green border-green/20',
    glow: '0 0 20px rgba(0,230,118,0.15)',
  },
  purple: {
    border: 'border-purple/30 hover:border-purple/70',
    bg: 'hover:bg-purple/5',
    dot: 'bg-purple',
    text: 'text-purple',
    badge: 'bg-purple/10 text-purple border-purple/20',
    glow: '0 0 20px rgba(224,64,251,0.15)',
  },
};

interface CoachModeSelectorProps {
  onSelect: (mode: CoachMode) => void;
  selectedMode: CoachMode | null;
}

export const CoachModeSelector: React.FC<CoachModeSelectorProps> = ({
  onSelect,
  selectedMode,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 md:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="font-mono text-[10px] tracking-widest uppercase text-cyan mb-3">
          // Select Mode
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
          What are you <span className="text-amber">coaching</span> today?
        </h2>
        <p className="text-text-muted text-sm max-w-md mx-auto">
          ARIA will tailor its real-time feedback, hints, and coaching style to your chosen activity.
        </p>
      </div>

      {/* Mode Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {MODES.map((modeConfig) => {
          const styles = COLOR_STYLES[modeConfig.color];
          const isSelected = selectedMode === modeConfig.id;

          return (
            <button
              key={modeConfig.id}
              onClick={() => onSelect(modeConfig.id)}
              className={`
                group text-left bg-bg-card border rounded-xl p-5 transition-all duration-200
                ${styles.border} ${styles.bg}
                ${isSelected ? `ring-1` : ''}
              `}
              style={{
                boxShadow: isSelected ? styles.glow : undefined,
              }}
            >
              {/* Icon + label */}
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{modeConfig.icon}</span>
                {isSelected && (
                  <span
                    className={`font-mono text-[9px] px-2 py-0.5 rounded-sm border ${styles.badge}`}
                  >
                    SELECTED
                  </span>
                )}
              </div>

              <div className={`font-display text-lg font-semibold mb-1 ${styles.text}`}>
                {modeConfig.label}
              </div>
              <div className="text-text-muted text-xs mb-3 leading-relaxed">
                {modeConfig.description}
              </div>

              {/* Coach focus chips */}
              <div className="flex flex-wrap gap-1">
                {modeConfig.coachFocus.map((focus) => (
                  <span
                    key={focus}
                    className={`font-mono text-[8px] px-1.5 py-0.5 rounded-sm border ${styles.badge}`}
                  >
                    {focus}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA after selection */}
      {selectedMode && (
        <div className="mt-8 flex flex-col items-center gap-2 animate-slide-in-up">
          <p className="font-mono text-[11px] text-text-muted">
            ARIA will coach you on{' '}
            <span className="text-amber">
              {MODES.find(m => m.id === selectedMode)?.label}
            </span>
          </p>
          <p className="font-mono text-[10px] text-text-muted/60">
            Click <strong className="text-text-secondary">Start Session</strong> when you're ready
          </p>
        </div>
      )}
    </div>
  );
};