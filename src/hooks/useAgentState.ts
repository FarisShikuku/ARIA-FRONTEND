/**
 * useAgentState.ts — REWRITTEN (real WebSocket event-driven state)
 *
 * WHAT CHANGED vs previous version:
 *
 * Previous version: simulated state transitions with setInterval — completely
 * disconnected from the backend. States cycled on a timer with no connection
 * to what ARIA was actually doing.
 *
 * This version: state is driven entirely by WebSocket messages from the backend.
 *   - 'agent_state' messages from detection_worker.py → update state
 *   - 'detection' messages → transition to EVALUATING while detections exist
 *   - Gemini speaking (isSpeaking) → transition to COACHING
 *   - Default: LISTENING when connected, SILENT when idle
 *
 * The simulation setInterval is REMOVED. If no wsMessage is provided,
 * the state stays at its initial value ('LISTENING') — no fake transitions.
 *
 * API is backward-compatible:
 *   - Same types: AgentState, UseAgentStateProps, return shape
 *   - transitionTo() still works for manual overrides
 *   - urgencyScore still exposed (now driven by detection urgency)
 *   - mode prop kept (no-op currently, reserved for future per-mode logic)
 */

import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentState =
  | 'LISTENING'        // Mic active, waiting for speech or hazard
  | 'OBSERVING'        // Camera frames being sent, scanning environment
  | 'EVALUATING'       // High-urgency detection received, deciding to speak
  | 'COACHING'         // ARIA is speaking (audio playing to user)
  | 'SILENT'           // Cooldown period — accumulating data, not speaking

interface UseAgentStateProps {
  /** Raw JSON message from the WebSocket — drives state transitions */
  wsMessage?: any
  /** Called whenever state changes */
  onStateChange?: (state: AgentState) => void
  /** 'navigation' | 'coach' — reserved for future per-mode logic */
  mode?: 'navigation' | 'coach'
  /** Set to true when Gemini audio is actively playing */
  isSpeaking?: boolean
}

interface UseAgentStateReturn {
  currentState: AgentState
  urgencyScore: number
  transitionTo: (state: AgentState) => void
}

// ── Valid states from backend ─────────────────────────────────────────────────

const VALID_STATES: Set<AgentState> = new Set([
  'LISTENING', 'OBSERVING', 'EVALUATING', 'COACHING', 'SILENT',
])

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAgentState({
  wsMessage,
  onStateChange,
  mode = 'navigation',
  isSpeaking = false,
}: UseAgentStateProps = {}): UseAgentStateReturn {

  const [currentState, setCurrentState] = useState<AgentState>('LISTENING')
  const [urgencyScore, setUrgencyScore] = useState(0)

  const transitionTo = useCallback((newState: AgentState) => {
    setCurrentState(prev => {
      if (prev === newState) return prev  // No change — avoid re-renders
      onStateChange?.(newState)
      return newState
    })
  }, [onStateChange])

  // ── Drive state from isSpeaking (Gemini audio output) ────────────────────
  // When Gemini is speaking, we're in COACHING state regardless of detections.
  // When Gemini stops speaking, return to LISTENING.
  useEffect(() => {
    if (isSpeaking) {
      transitionTo('COACHING')
    } else if (currentState === 'COACHING') {
      // Only auto-return from COACHING — don't override EVALUATING/OBSERVING
      transitionTo('LISTENING')
    }
  }, [isSpeaking]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drive state from WebSocket messages ───────────────────────────────────
  useEffect(() => {
    if (!wsMessage) return

    const { type } = wsMessage

    // agent_state: emitted by detection_worker.py after each frame processed
    // Payload: { type: 'agent_state', state: 'EVALUATING'|'OBSERVING', reason: string }
    if (type === 'agent_state') {
      const newState = wsMessage.state as AgentState
      if (VALID_STATES.has(newState) && !isSpeaking) {
        // Don't override COACHING (Gemini speaking) with a backend state push
        transitionTo(newState)
      }
      return
    }

    // detection: emitted by detection_worker.py with detection results
    // Payload: { type: 'detection', detections: [...], environment: string }
    if (type === 'detection') {
      const detections: any[] = wsMessage.detections ?? []
      if (detections.length === 0) return

      const topUrgency: number = detections[0]?.urgency ?? 0
      setUrgencyScore(topUrgency)

      if (!isSpeaking) {
        if (topUrgency > 0.5) {
          transitionTo('EVALUATING')
        } else if (topUrgency > 0.1) {
          transitionTo('OBSERVING')
        }
      }
      return
    }

    // interrupted: Gemini barge-in — user spoke over ARIA
    if (type === 'interrupted') {
      transitionTo('LISTENING')
      setUrgencyScore(0)
      return
    }

    // environment_update: GPS-triggered indoor/outdoor switch
    // No state change needed — just an informational message
    // (handled by useNavigationSession for environment badge)

  }, [wsMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Decay urgency score when state becomes SILENT or LISTENING ────────────
  useEffect(() => {
    if (currentState === 'SILENT' || currentState === 'LISTENING') {
      setUrgencyScore(0)
    }
  }, [currentState])

  return { currentState, urgencyScore, transitionTo }
}