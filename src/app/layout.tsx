/**
 * layout.tsx  — MODIFIED
 *
 * WHAT CHANGED vs previous version and WHY:
 *
 * 1. AriaIntroBar MOVED from above <main> to the TOP of <main>
 *    Old: AriaIntroBar was placed between <Navbar /> and <main>, using
 *         position:fixed top:0 z-50, which caused it to overlap the Navbar
 *         and hide the nav links behind it.
 *    New: AriaIntroBar sits as the first child inside <main>, directly below
 *         the Navbar in normal document flow. It no longer uses fixed
 *         positioning to fight the Navbar — it just stacks naturally below it.
 *
 * 2. <main> padding adjusted
 *    Old: pt-16 to clear the Navbar height only.
 *    New: pt-16 still clears the Navbar. AriaIntroBar renders below that as
 *         the first element inside <main>, so page content sits below both.
 *         No extra padding needed — AriaIntroBar pushes content down naturally.
 */

import type { Metadata } from 'next';
import { Outfit, Rajdhani, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { AriaIntroBar } from '@/components/ui/AriaIntroBar';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-outfit',
  display: 'swap',
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-rajdhani',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ARIA — Adaptive Real-time Intelligence Agent',
  description:
    'One unified AI platform. Navigate the world as a visually impaired individual or master every conversation with real-time coaching.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${rajdhani.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          <WebSocketProvider>
            <SettingsProvider>
              {/*
               * Navbar is fixed at top (z-40 or similar in its own styles).
               * It always sits above everything — AriaIntroBar no longer
               * competes with it for the top position.
               */}
              <Navbar />

              <main className="pt-16 md:pt-16">
                {/*
                 * AriaIntroBar sits here as the first element in the page flow,
                 * directly below the Navbar. It renders in normal document flow
                 * so it pushes page content down naturally — no fixed positioning
                 * needed, no overlap with nav links.
                 *
                 * The bar itself should use position:sticky top-16 (or whatever
                 * the Navbar height is) if you want it to stick while scrolling,
                 * or position:relative if you want it to scroll away with the page.
                 * Either way it no longer covers the Navbar.
                 */}
                <AriaIntroBar />

                {children}
              </main>

              <Footer />
            </SettingsProvider>
          </WebSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}