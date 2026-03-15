import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-bg-deep border-t border-border px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-3">

      {/* Left — branding */}
      <div className="flex items-center gap-2">
        {/* Gemini Live "spark" icon */}
        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 2C10 2 11.5 7 14 9C16.5 11 18 10 18 10C18 10 16.5 11 14 13C11.5 15 10 20 10 20C10 20 8.5 15 6 13C3.5 11 2 10 2 10C2 10 3.5 11 6 9C8.5 7 10 2 10 2Z"
            fill="#00e5ff"
            opacity="0.9"
          />
        </svg>
        <span className="font-mono text-[11px] text-text-secondary tracking-wider">
          ARIA powered by{' '}
          <span className="text-cyan">Gemini Live</span>
        </span>
      </div>

      {/* Right — team credit */}
      <p className="font-mono text-[10px] text-text-muted tracking-wider">
        &copy; {new Date().getFullYear()}{' '}
        <span className="text-text-secondary">Sphere Solution Developers</span> Team
      </p>

    </footer>
  );
};