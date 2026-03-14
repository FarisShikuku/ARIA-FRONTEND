'use client';

/**
 * src/contexts/AriaContext.tsx
 *
 * Lifts useAriaIntro to the layout level so ONE Gemini Live session
 * is shared across Home, Assist, Navigate, Coach — same voice, same
 * connection, but ARIA's focus/persona shifts per page.
 *
 * Usage:
 *   const aria = useAriaContext();
 *   aria.setPageFocus('assist');   // shifts ARIA to Assist persona
 *   aria.setPageFocus('home');     // back to general intro persona
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useAriaIntro, type UseAriaIntroReturn } from '@/hooks/useAriaIntro';

// ── Page focus types ──────────────────────────────────────────────────────────

export type PageFocus = 'home' | 'assist' | 'navigate' | 'coach' | 'dashboard' | 'settings';

// ── Per-page system prompt addenda ────────────────────────────────────────────
// These are SHORT context updates sent to shift ARIA's persona.
// The base system prompt already lives in gemini_service.py on the backend.

const PAGE_CONTEXT: Record<PageFocus, string> = {
  home: `
You are on the ARIA home page. Introduce yourself warmly as ARIA — an AI assistant 
with three modes: Navigate (for visually impaired users), Coach (communication coaching), 
and Assist (help with any daily task). Give a brief overview when asked. 
Keep it friendly and concise.
`.trim(),

  assist: `
You are now in ARIA Assist mode. Stay focused ONLY on helping the user with their 
current task using the camera and microphone. You can see what the user sees.

YOUR ONLY JOB HERE:
- Help with whatever task the user is doing right now (cooking, cleaning, homework, 
  repairs, design, learning, organising, etc.)
- Watch the camera feed and give practical, real-time guidance
- When you understand the task, say "Task: [title]" so it gets captured
- Break tasks into steps when helpful — say "Steps:" followed by numbered steps
- Be encouraging and specific — this is live visual assistance

IF the user asks about Navigate or Coach: briefly explain what they are 
("Navigate helps visually impaired users, Coach helps with presentations and interviews") 
then redirect: "But right now I'm here to help you with your task — what are we working on?"

DO NOT offer navigation assistance or coaching here. Stay in Assist mode.
`.trim(),

  navigate: `
You are in ARIA Navigate mode. Focus entirely on real-time navigation assistance 
for a visually impaired user. Describe obstacles, give directions, read signs.
If asked about other modes, briefly redirect to navigation.
`.trim(),

  coach: `
You are in ARIA Coach mode. Focus entirely on real-time communication coaching.
Observe the user's presentation, interview, or speech and give whisper-style hints.
If asked about other modes, briefly redirect to coaching.
`.trim(),

  dashboard: `
You are on the ARIA dashboard. Help the user understand their session history and stats.
Keep responses brief. If they ask about a specific mode, explain it and suggest going there.
`.trim(),

  settings: `
You are on the ARIA settings page. Help the user configure their preferences.
Keep responses practical and brief.
`.trim(),
};

// ── Context type ──────────────────────────────────────────────────────────────

interface AriaContextType extends UseAriaIntroReturn {
  /** Call this when entering a page to shift ARIA's focus */
  setPageFocus: (focus: PageFocus) => void;
  currentFocus: PageFocus;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AriaContext = createContext<AriaContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export const AriaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const aria = useAriaIntro();
  const currentFocusRef = useRef<PageFocus>('home');
  const [currentFocus, setCurrentFocusState] = React.useState<PageFocus>('home');

  const setPageFocus = useCallback((focus: PageFocus) => {
    if (currentFocusRef.current === focus) return; // no-op if already on this focus
    currentFocusRef.current = focus;
    setCurrentFocusState(focus);

    // Only send context update if the Gemini session is already running.
    // geminiState 'ready' | 'speaking' | 'listening' = session exists.
    // If idle/connecting/error, the context will be applied when start_intro
    // or start_assist fires — both carry their own persona instructions.
    const isSessionLive = ['ready', 'speaking', 'listening'].includes(aria.geminiState);
    if (!isSessionLive) {
      console.log(`[AriaContext] setPageFocus(${focus}) — session not live yet, skipping context send`);
      return;
    }

    const context = PAGE_CONTEXT[focus];
    if (context) {
      aria.sendText(JSON.stringify({
        type: 'control',
        action: 'update_context',
        context: {
          page_focus: focus,
          instruction: context,
        },
      }));
      console.log(`[AriaContext] Page focus shifted to: ${focus}`);
    }
  }, [aria]);

  return (
    <AriaContext.Provider value={{ ...aria, setPageFocus, currentFocus }}>
      {children}
    </AriaContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAriaContext(): AriaContextType {
  const ctx = useContext(AriaContext);
  if (!ctx) throw new Error('useAriaContext must be used inside AriaProvider');
  return ctx;
}