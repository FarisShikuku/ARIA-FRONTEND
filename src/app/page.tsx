'use client';

/**
 * src/app/page.tsx — HOME PAGE, MODIFIED
 *
 * CHANGES:
 *
 * 1. AriaIntroBar added here (removed from layout.tsx).
 *    WHY: The bar should only appear on the home page, not on every route.
 *    layout.tsx is shared by all pages; rendering it there was the cause of
 *    it appearing on navigate/, coach/, dashboard/ etc.
 *
 * 2. AriaBarSpacer div added (h-11 = 44px).
 *    WHY: AriaIntroBar uses position:fixed so it sits on top of the page
 *    content. Without this spacer the Hero title would be hidden behind the
 *    bar. The spacer pushes all page content down by the bar's height so the
 *    title is always fully visible below the Navbar + bar stack.
 *
 *    Visual stack from top of viewport:
 *      0px  – 64px  : Navbar (fixed, z-50)
 *      64px – 108px : AriaIntroBar (fixed, z-40)
 *      108px+       : Page content (scrolls normally, starts below bar)
 *
 * 3. Everything else (Hero, OnboardingSteps) is unchanged.
 */

import React from 'react';
import { Hero }            from '@/components/home/Hero';
import { OnboardingSteps } from '@/components/home/OnboardingSteps';
import { AriaIntroBar }    from '@/components/home/AriaIntroBar';

export default function HomePage() {
  return (
    <>
      {/* Fixed bar — pinned to viewport at top-16, always visible, never scrolls */}
      <AriaIntroBar />

      {/*
       * Spacer: compensates for the fixed AriaIntroBar (≈44px tall) so the
       * Hero content starts below it and the title is never hidden.
       * Adjust h-11 if the bar's height changes.
       */}
      <div className="h-11" aria-hidden="true" />

      <Hero />
      <OnboardingSteps />
    </>
  );
}