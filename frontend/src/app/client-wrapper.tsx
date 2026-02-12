'use client';

import { useState } from 'react';
import TransportTypeFilter, { TransportType } from '@/components/TransportTypeFilter';
import StationsTable from '@/components/StationsTable';
import StatsOverview from '@/components/StatsOverview';
import DelayByLineChart from '@/components/DelayByLineChart';
import DelayByStopChart from '@/components/DelayByStopChart';
import HourlyTrendChart from '@/components/HourlyTrendChart';
import WeekdayChart from '@/components/WeekdayChart';
import TimeOfDayChart from '@/components/TimeOfDayChart';
import DelayHeatmap from '@/components/DelayHeatmap';

interface ClientWrapperProps {
  initialData: {
    overallStats: any;
    lineStats: any[];
    stopStats: any[];
    hourlyTrends: any[];
    weekdayStats: any[];
    timeOfDayStats: any[];
    stationDelays: any[];
  };
}

export default function ClientWrapper({ initialData }: ClientWrapperProps) {
  const [transportFilter, setTransportFilter] = useState<TransportType>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState(initialData);

  const handleFilterChange = async (newFilter: TransportType) => {
    setTransportFilter(newFilter);
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/stats?filter=${newFilter}`);
      const newData = await response.json();
      setData(newData);
    } catch (error) {
      console.error('Failed to fetch filtered data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        {/* Transport Type Filter */}
        <TransportTypeFilter value={transportFilter} onChange={handleFilterChange} />

        {/* Loading State */}
        {isLoading && (
          <div className="mt-4 text-center text-gray-600">
            Lade gefilterte Daten...
          </div>
        )}

        {/* Overall Stats */}
        <div className="mt-8">
          <StatsOverview stats={data.overallStats} />
        </div>

        {/* Charts Grid */}
        <div className="mt-8 space-y-8">
          {/* Delay Heatmap */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              🗺️ Verspätungs-Heatmap Wien
            </h2>
            <DelayHeatmap data={data.stationDelays} />
          </div>

          {/* Stations Table */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📊 Alle Stationen
            </h2>
            <StationsTable data={data.stopStats} />
          </div>

          {/* Hourly Trend */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Durchschnittliche Verspätung (Letzte 7 Tage)
            </h2>
            <HourlyTrendChart data={data.hourlyTrends} />
          </div>

          {/* Delay by Line */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Verspätung pro Linie (Top 20)
            </h2>
            <DelayByLineChart data={data.lineStats} />
          </div>

          {/* Delay by Stop */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Verspätung pro Haltestelle (Top 15)
            </h2>
            <DelayByStopChart data={data.stopStats} />
          </div>

          {/* Weekday Stats */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Verspätung nach Wochentag
            </h2>
            <WeekdayChart data={data.weekdayStats} />
          </div>

          {/* Time of Day Stats */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Verspätung nach Tageszeit
            </h2>
            <TimeOfDayChart data={data.timeOfDayStats} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>Datenquellen: Wiener Linien OGD Realtime API + ÖBB HAFAS | Letzte Aktualisierung: {new Date().toLocaleString('de-AT')}</p>
        </footer>
      </main>
    </div>
  );
}
