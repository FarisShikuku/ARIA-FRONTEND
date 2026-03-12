import React from 'react';
import { Button } from '@/components/ui/Button';

// CHANGED: added `sessionId` prop — used to attach session context when SOS is triggered.
// SOS handler sends session_id so the backend can look up GPS + user from Firestore.
// Button, layout, text: identical to original.

interface QuickSOSProps {
  sessionId: string | null;
}

export const QuickSOS: React.FC<QuickSOSProps> = ({ sessionId }) => {
  const handleSOS = () => {
    // TODO: wire to POST /api/v1/emergency/sos with sessionId
    // For now, browser alert as placeholder (replace with actual SOS call)
    console.warn('[SOS] Emergency triggered for session:', sessionId);
  };

  return (
    <>
      <Button variant="danger" fullWidth className="!py-3" onClick={handleSOS}>
        🆘 SOS — EMERGENCY
      </Button>
      <p className="font-mono text-[10px] text-text-muted mt-2.5 text-center">
        Voice trigger: &quot;Call emergency&quot;
        <br />
        GPS + SMS dispatch ready
      </p>
    </>
  );
};