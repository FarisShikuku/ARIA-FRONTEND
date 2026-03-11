'use client';

/**
 * HeroLeft.tsx  — MODIFIED
 *
 * WHAT CHANGED and WHY:
 *
 * Removed: `import { AriaIntroBar } from './AriaIntroBar'`
 * Removed: `<AriaIntroBar />` JSX render
 *
 * WHY:
 *   AriaIntroBar was previously mounted here (in the home page hero section).
 *   It has now been moved to src/app/layout.tsx so it persists across ALL pages
 *   (navigate, coach, dashboard, settings, etc.) without remounting.
 *
 *   Keeping it here AND in layout.tsx would cause:
 *     - Two useAriaIntro instances running simultaneously
 *     - Two separate Gemini Live sessions created for the same page load
 *     - Double audio playback (ARIA speaking over herself)
 *     - Two mic streams competing, causing echo and confusion
 *
 *   layout.tsx is the single source of truth for AriaIntroBar.
 *   HeroLeft.tsx has no awareness of the voice agent — it's purely visual.
 *
 * Everything else is unchanged.
 */

import React from 'react';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export const HeroLeft: React.FC = () => {
  const router = useRouter();

  return (
    <div className="flex flex-col justify-center px-4 md:px-8 lg:px-16 xl:px-20 py-16 lg:py-20 relative z-10 animate-fade-in">
      <div className="flex flex-wrap gap-3 mb-6">
        <Tag color="cyan">AI-Powered</Tag>
        <Tag color="amber">Real-Time</Tag>
        <Tag color="green">Gemini Live</Tag>
      </div>

      <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[0.9] tracking-wider text-text-primary mb-2 glow-text">
        AR<span className="text-cyan">I</span>A
      </h1>

      <h2 className="font-display text-base sm:text-lg lg:text-xl font-normal tracking-widest text-text-secondary uppercase mb-8">
        Adaptive Real-time Intelligence Agent
      </h2>

      <p className="text-base font-light leading-relaxed text-text-secondary max-w-md mb-12">
        One unified AI platform. Navigate the world as a visually impaired individual — or master every
        conversation with real-time coaching. Powered by Gemini Live API, built on Next.js + Python FastAPI
        WebSocket.
      </p>

      <div className="flex flex-wrap gap-4 mb-12">
        <Button variant="primary" onClick={() => router.push('/navigate')}>
          ◉ Start Navigation
        </Button>
        <Button variant="ghost" onClick={() => router.push('/coach')}>
          ◈ Launch Coach
        </Button>
      </div>

      <div className="flex flex-wrap gap-8 md:gap-10 pt-8 border-t border-border">
        <div className="text-center md:text-left">
          <div className="font-display text-3xl md:text-4xl font-bold text-cyan leading-tight">285M+</div>
          <div className="font-mono text-[10px] tracking-wider text-text-muted uppercase">Users Served</div>
        </div>
        <div className="text-center md:text-left">
          <div className="font-display text-3xl md:text-4xl font-bold text-cyan leading-tight">&lt;200ms</div>
          <div className="font-mono text-[10px] tracking-wider text-text-muted uppercase">WS Latency</div>
        </div>
        <div className="text-center md:text-left">
          <div className="font-display text-3xl md:text-4xl font-bold text-cyan leading-tight">5</div>
          <div className="font-mono text-[10px] tracking-wider text-text-muted uppercase">Agent States</div>
        </div>
        <div className="text-center md:text-left">
          <div className="font-display text-3xl md:text-4xl font-bold text-cyan leading-tight">2</div>
          <div className="font-mono text-[10px] tracking-wider text-text-muted uppercase">AI Modes</div>
        </div>
      </div>
    </div>
  );
};