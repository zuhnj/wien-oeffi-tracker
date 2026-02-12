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
import StatsOverview from '@/components/StatsOverview';
import DelayByLineChart from '@/components/DelayByLineChart';
import DelayByStopChart from '@/components/DelayByStopChart';
import HourlyTrendChart from '@/components/HourlyTrendChart';
import WeekdayChart from '@/components/WeekdayChart';
import TimeOfDayChart from '@/components/TimeOfDayChart';
import DelayHeatmap from '@/components/DelayHeatmap';

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🚊 Wien Öffi-Pünktlichkeits-Tracker
          </h1>
          <p className="mt-2 text-gray-600">
            Echtzeit-Analyse der Pünktlichkeit von Wiener Öffis (Wiener Linien + ÖBB S-Bahn)
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Stats */}
        <StatsOverview stats={overallStats} />

        {/* Charts Grid */}
        <div className="mt-8 space-y-8">
          {/* Delay Heatmap */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              🗺️ Verspätungs-Heatmap Wien
            </h2>
            <DelayHeatmap data={stationDelays} />
          </div>

          {/* Hourly Trend */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Durchschnittliche Verspätung (Letzte 7 Tage)
            </h2>
            <HourlyTrendChart data={hourlyTrends} />
          </div>

          {/* Delay by Line */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Verspätung pro Linie (Top 20)
            </h2>
            <DelayByLineChart data={lineStats.slice(0, 20)} />
          </div>

          {/* Delay by Stop */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Verspätung pro Haltestelle (Top 15)
            </h2>
            <DelayByStopChart data={stopStats.slice(0, 15)} />
          </div>

          {/* Two column grid for smaller charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Weekday Analysis */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Verspätung nach Wochentag
              </h2>
              <WeekdayChart data={weekdayStats} />
            </div>

            {/* Time of Day Analysis */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Verspätung nach Tageszeit
              </h2>
              <TimeOfDayChart data={timeOfDayStats} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-600">
            Datenquellen: Wiener Linien OGD Realtime API & ÖBB HAFAS
            {' | '}
            Letzte Aktualisierung: {new Date().toLocaleString('de-AT')}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Lade Daten...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
