/**
 * layout.tsx — UPDATED
 *
 * CHANGE: AriaProvider added.
 *
 * WHY: useAriaIntro was being called independently on each page (home, assist)
 * creating a new Gemini Live session per page. This means voice stops when
 * navigating, and sessions conflict.
 *
 * AriaProvider lifts useAriaIntro to the layout level — ONE shared session
 * for the entire app. Pages call setPageFocus('assist' | 'home' | ...) to
 * shift ARIA's personality without creating a new session.
 */

import type { Metadata } from 'next';
import { Outfit, Rajdhani, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Navbar }           from '@/components/layout/Navbar';
import { Footer }           from '@/components/layout/Footer';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { AuthProvider }      from '@/contexts/AuthContext';
import { SettingsProvider }  from '@/contexts/SettingsContext';
import { AriaProvider }      from '@/contexts/AriaContext';

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

  // ── Favicon & PWA icons ──────────────────────────────────────────────────
  // Drop these files into your /public directory:
  //   /public/favicon.ico          (32×32, ICO format)
  //   /public/favicon-16x16.png
  //   /public/favicon-32x32.png
  //   /public/apple-touch-icon.png (180×180)
  //   /public/icon-192.png         (192×192)
  //   /public/icon-512.png         (512×512)
  //   /public/og-image.png         (1200×630, for social share previews)
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/favicon.ico' },
    ],
  },

  // ── PWA manifest ─────────────────────────────────────────────────────────
  // Create /public/site.webmanifest with the content shown at the bottom of this file
  manifest: '/site.webmanifest',

  // ── Open Graph (Facebook, WhatsApp, LinkedIn previews) ───────────────────
  openGraph: {
    type: 'website',
    url: 'https://aria-frontend-two.vercel.app',
    title: 'ARIA — Adaptive Real-time Intelligence Agent',
    description:
      'Navigate the world. Master every conversation. Built with Gemini Live API on Google Cloud.',
    siteName: 'ARIA',
    images: [
      {
        url: '/og-image.png',   // 1200×630 recommended
        width: 1200,
        height: 630,
        alt: 'ARIA — Adaptive Real-time Intelligence Agent',
      },
    ],
  },

  // ── Twitter / X card ─────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: 'ARIA — Adaptive Real-time Intelligence Agent',
    description:
      'Navigate the world. Master every conversation. Built with Gemini Live API on Google Cloud.',
    images: ['/og-image.png'],
  },

  // ── Theme color (browser chrome on mobile) ────────────────────────────────
  themeColor: '#00e5ff',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${rajdhani.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <AuthProvider>
          <WebSocketProvider>
            <SettingsProvider>
              {/* AriaProvider — ONE shared Gemini Live session for all pages.
                  Pages call setPageFocus() to shift ARIA's persona. */}
              <AriaProvider>
                <Navbar />

                <main className="pt-16 md:pt-16">
                  {children}
                </main>

                <Footer />
              </AriaProvider>
            </SettingsProvider>
          </WebSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}