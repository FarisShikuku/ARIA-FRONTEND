import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface QuickSOSProps {
  sessionId: string | null;
}

export const QuickSOS: React.FC<QuickSOSProps> = ({ sessionId }) => {
  const [showNotice, setShowNotice] = useState(false);

  const handleSOS = () => {
    setShowNotice(true);
  };

  return (
    <>
      <Button variant="danger" fullWidth className="!py-3" onClick={handleSOS}>
        🆘 SOS — EMERGENCY
      </Button>

      {showNotice ? (
        <div className="mt-2.5 rounded-lg border border-amber/30 bg-amber/5 px-3 py-2.5 text-center">
          <p className="font-mono text-[11px] text-amber leading-snug">
            ⚠ Registration required
          </p>
          <p className="font-mono text-[10px] text-text-muted mt-1 leading-relaxed">
            Create an account and add emergency contacts in{' '}
            <a
              href="/settings"
              className="text-cyan underline underline-offset-2 hover:text-cyan/80 transition-colors"
            >
              Settings
            </a>{' '}
            before SOS can dispatch.
          </p>
          <button
            onClick={() => setShowNotice(false)}
            className="mt-2 font-mono text-[9px] text-text-muted hover:text-text-secondary transition-colors"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <p className="font-mono text-[10px] text-text-muted mt-2.5 text-center">
          Voice trigger: &quot;Call emergency&quot;
          <br />
          GPS + SMS dispatch ready
        </p>
      )}
    </>
  );
};