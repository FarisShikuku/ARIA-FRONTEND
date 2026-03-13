'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/navigate?autostart=true', label: 'Navigate' },
    { href: '/coach', label: 'Coach' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-bg-deep/92 backdrop-blur-xl border-b border-border z-50 flex items-center px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3 mr-auto">
          <div className="w-9 h-9">
            <svg viewBox="0 0 36 36" fill="none" className="w-full h-full">
              <circle cx="18" cy="18" r="16" stroke="#00e5ff" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5" />
              <circle cx="18" cy="18" r="10" stroke="#00e5ff" strokeWidth="1.5" />
              <circle cx="18" cy="18" r="4" fill="#00e5ff" />
              <line x1="18" y1="2" x2="18" y2="8" stroke="#00e5ff" strokeWidth="1.5" />
              <line x1="18" y1="28" x2="18" y2="34" stroke="#00e5ff" strokeWidth="1.5" />
              <line x1="2" y1="18" x2="8" y2="18" stroke="#00e5ff" strokeWidth="1.5" />
              <line x1="28" y1="18" x2="34" y2="18" stroke="#00e5ff" strokeWidth="1.5" />
            </svg>
          </div>
          <span className="font-display text-2xl font-bold tracking-wider text-text-primary">
            AR<span className="text-cyan">I</span>A
          </span>
        </Link>

        {/* Desktop Navigation */}
        <ul className="hidden md:flex gap-1">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`font-mono text-xs font-medium tracking-wider uppercase px-3.5 py-1.5 rounded-sm transition-all duration-200 relative ${
                  pathname === link.href.split('?')[0]
                    ? 'text-cyan bg-cyan-ghost after:absolute after:bottom-[-1px] after:left-1/2 after:-translate-x-1/2 after:w-5 after:h-0.5 after:bg-cyan after:rounded-full'
                    : 'text-text-secondary hover:text-cyan hover:bg-cyan-ghost'
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 ml-4 md:ml-8">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="w-1.5 h-1.5 rounded-full bg-green" />
              <div className="absolute inset-[-3px] rounded-full bg-green animate-pulse-ring" />
            </div>
            <span className="hidden md:inline font-mono text-xs text-green tracking-wider">LIVE</span>
          </div>
          <span className="tag tag-cyan text-[10px] hidden md:inline-block">v2.0.1</span>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-dim to-cyan/80 border border-border-bright flex items-center justify-center font-display font-bold text-sm text-white cursor-pointer">
            JD
          </div>

          {/* Mobile Hamburger */}
          <button
            className={`md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 ${
              isMenuOpen ? 'open' : ''
            }`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span
              className={`block w-5 h-0.5 bg-text-secondary rounded-sm transition-all duration-200 ${
                isMenuOpen ? 'translate-y-2 rotate-45 bg-cyan' : ''
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-text-secondary rounded-sm transition-all duration-200 ${
                isMenuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-text-secondary rounded-sm transition-all duration-200 ${
                isMenuOpen ? '-translate-y-2 -rotate-45 bg-cyan' : ''
              }`}
            />
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ y: '-110%' }}
            animate={{ y: 0 }}
            exit={{ y: '-110%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-16 left-0 right-0 bg-bg-deep/98 backdrop-blur-xl border-b border-border z-40 p-4 flex flex-col gap-1"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-mono text-sm tracking-wider uppercase p-3 rounded-sm border border-transparent transition-all duration-200 flex items-center gap-2.5 ${
                  pathname === link.href.split('?')[0]
                    ? 'text-cyan bg-cyan-ghost border-cyan/15'
                    : 'text-text-secondary hover:text-cyan hover:bg-cyan-ghost'
                }`}
              >
                {link.label === 'Home' && '⌂'}
                {link.label === 'Navigate' && '◉'}
                {link.label === 'Coach' && '◈'}
                {link.label === 'Dashboard' && '▦'}
                {link.label === 'Settings' && '⚙'}
                <span>{link.label}</span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};