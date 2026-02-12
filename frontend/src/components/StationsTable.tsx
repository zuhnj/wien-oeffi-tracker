'use client';

import { useState, useMemo } from 'react';

interface StationDelayStats {
  stop_name: string;
  avg_delay_seconds: number;
  median_delay_seconds: number;
  p95_delay_seconds: number;
  total_departures: number;
}

interface StationsTableProps {
  data: StationDelayStats[];
}

type SortField = 'stop_name' | 'avg_delay_seconds' | 'median_delay_seconds' | 'p95_delay_seconds' | 'total_departures';
type SortDirection = 'asc' | 'desc';

export default function StationsTable({ data }: StationsTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('avg_delay_seconds');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(station =>
      station.stop_name.toLowerCase().includes(search.toLowerCase())
    );

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return multiplier * aVal.localeCompare(bVal);
      }
      return multiplier * (Number(aVal) - Number(bVal));
    });

    return filtered;
  }, [data, search, sortField, sortDirection]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Station suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-600">
          {filteredAndSortedData.length} von {data.length} Stationen
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th
                onClick={() => handleSort('stop_name')}
                className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center gap-2">
                  Station <SortIcon field="stop_name" />
                </div>
              </th>
              <th
                onClick={() => handleSort('avg_delay_seconds')}
                className="px-4 py-3 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center justify-end gap-2">
                  Ø Verspätung <SortIcon field="avg_delay_seconds" />
                </div>
              </th>
              <th
                onClick={() => handleSort('median_delay_seconds')}
                className="px-4 py-3 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center justify-end gap-2">
                  Median <SortIcon field="median_delay_seconds" />
                </div>
              </th>
              <th
                onClick={() => handleSort('p95_delay_seconds')}
                className="px-4 py-3 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center justify-end gap-2">
                  P95 <SortIcon field="p95_delay_seconds" />
                </div>
              </th>
              <th
                onClick={() => handleSort('total_departures')}
                className="px-4 py-3 text-right text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center justify-end gap-2">
                  Abfahrten <SortIcon field="total_departures" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map((station, idx) => (
              <tr
                key={station.stop_name}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-900">{station.stop_name}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-700">
                  {formatTime(station.avg_delay_seconds)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-700">
                  {formatTime(station.median_delay_seconds)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-700">
                  {formatTime(station.p95_delay_seconds)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-700">
                  {station.total_departures.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
