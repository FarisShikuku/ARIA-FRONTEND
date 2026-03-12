import React from 'react';
import { Waveform } from '@/components/ui/Waveform';
import { Tag } from '@/components/ui/Tag';

// CHANGED: added isSpeaking and transcript props.
// When isSpeaking=false: shows LISTENING tag + pulse dot instead of Waveform.
// When transcript is empty: shows idle fallback message.
// All styling, layout, classNames are identical to the original.

interface ARIAVoiceCardProps {
  isSpeaking: boolean;
  transcript: string;
}

export const ARIAVoiceCard: React.FC<ARIAVoiceCardProps> = ({ isSpeaking, transcript }) => {
  const displayText = transcript?.trim() ||
    (isSpeaking
      ? '…'
      : 'Listening for voice input and camera context…');

  return (
    <div className="bg-gradient-to-br from-cyan/6 to-transparent border border-cyan/20 rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-base font-bold text-cyan tracking-wider">⬡ ARIA</div>
        {isSpeaking ? (
          <>
            <Waveform />
            <Tag color="cyan">SPEAKING</Tag>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan/50 animate-pulse" />
            <Tag color="green">LISTENING</Tag>
          </div>
        )}
      </div>
      <p className="text-sm leading-relaxed text-text-secondary italic">
        &quot;{displayText}&quot;
      </p>
    </div>
  );
};