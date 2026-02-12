import { Suspense } from 'react';
import { 
  getOverallStats, 
  getDelayStatsByLine, 
  getDelayStatsByStop,
  getHourlyTrends,
  getWeekdayStats,
  getTimeOfDayStats,
  getStationDelays
} from '@/lib/db';
import ClientWrapper from './client-wrapper';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

async function DashboardContent() {
  const [
    overallStats,
    lineStats,
    stopStats,
    hourlyTrends,
    weekdayStats,
    timeOfDayStats,
    stationDelays,
  ] = await Promise.all([
    getOverallStats(7),
    getDelayStatsByLine(7),
    getDelayStatsByStop(7),
    getHourlyTrends(7),
    getWeekdayStats(30),
    getTimeOfDayStats(7),
    getStationDelays(7),
  ]);

  return (
    <ClientWrapper
      initialData={{
        overallStats,
        lineStats,
        stopStats,
        hourlyTrends,
        weekdayStats,
        timeOfDayStats,
        stationDelays,
      }}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Laden...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
