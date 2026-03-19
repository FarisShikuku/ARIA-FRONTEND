'use client';

import React from 'react';
import { ChartCard }       from './ChartCard';
import { ScoreCard }       from './ScoreCard';
import { Sparkline }       from './Sparkline';
import { BarChart }        from './BarChart';
import { FillerWordsList } from './FillerWordsList';
import { NavigationStats } from './NavigationStats';
import { SystemStatusBar } from './SystemStatusBar';
import { UserLocationMap } from './UserLocationMap';
import { Tag }             from '@/components/ui/Tag';

function RegistrationNotice() {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber/25 bg-amber/5 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-amber text-base shrink-0">🔒</span>
        <div>
          <p className="text-xs font-semibold text-amber leading-tight">
            Registration required to unlock session data
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Create an account to save sessions, track progress, and view real analytics.
          </p>
        </div>
      </div>
      <a
        href="/settings"
        className="shrink-0 px-3 py-1.5 rounded-full border border-amber/40 bg-amber/10 text-amber text-[11px] font-semibold hover:bg-amber/20 transition-colors whitespace-nowrap"
      >
        Set up account →
      </a>
    </div>
  );
}

export const DashboardGrid: React.FC = () => {
  return (
    <section className="bg-bg-deep border-t border-border px-4 md:px-8 py-12 md:py-16">
      {/* ── System status bar ── */}
      <SystemStatusBar />

      {/* ── Section header ── */}
      <div className="mb-8 md:mb-10">
        <div className="section-label">Analytics</div>
        <h2 className="section-title">
          Session <span className="text-cyan">Dashboard</span>
        </h2>
      </div>

      {/* ── Registration notice ── */}
      <RegistrationNotice />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">

        {/* Overall Score */}
        <ChartCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="chart-title">Session Score</div>
              <div className="chart-subtitle">No session yet</div>
            </div>
            <Tag color="amber">—</Tag>
          </div>
          <ScoreCard value={0} trend="—" />
        </ChartCard>

        {/* Speaking Pace Chart */}
        <ChartCard wide className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="chart-title">Speaking Pace Over Session</div>
              <div className="chart-subtitle">No session data</div>
            </div>
            <Tag color="amber">— WPM</Tag>
          </div>
          <Sparkline />
        </ChartCard>

        {/* Filler Words Breakdown */}
        <ChartCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="chart-title">Filler Words</div>
              <div className="chart-subtitle">No session data</div>
            </div>
            <Tag color="amber">—</Tag>
          </div>
          <FillerWordsList />
        </ChartCard>

        {/* Performance History */}
        <ChartCard wide className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="chart-title">Performance History</div>
              <div className="chart-subtitle">No sessions recorded</div>
            </div>
            <Tag color="amber">—</Tag>
          </div>
          <BarChart />
        </ChartCard>

        {/* Navigation Stats */}
        <ChartCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="chart-title">Navigation Stats</div>
              <div className="chart-subtitle">No sessions recorded</div>
            </div>
          </div>
          <NavigationStats />
        </ChartCard>

        {/* User Location Map */}
        <ChartCard wide className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="chart-title">Current Location</div>
              <div className="chart-subtitle">Live · Device GPS</div>
            </div>
            <Tag color="cyan">Maps</Tag>
          </div>
          <UserLocationMap />
        </ChartCard>

      </div>
    </section>
  );
};