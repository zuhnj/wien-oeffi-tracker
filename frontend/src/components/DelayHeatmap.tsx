// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import map components (client-side only)
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

interface StationDelay {
  name: string;
  latitude: number;
  longitude: number;
  avg_delay: number;
  median_delay: number;
  departure_count: number;
}

interface DelayHeatmapProps {
  data: StationDelay[];
}

export default function DelayHeatmap({ data }: DelayHeatmapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !data || data.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-100 rounded-lg">
        <p className="text-gray-500">Karte wird geladen...</p>
      </div>
    );
  }

  // Vienna center coordinates
  const viennaCenter = [48.2082, 16.3738] as [number, number];

  // Color coding based on average delay
  const getColor = (avgDelay: number): string => {
    if (avgDelay === null || avgDelay === undefined) return '#808080'; // Gray for no data
    if (avgDelay < 30) return '#10b981'; // Green: < 30s (on time)
    if (avgDelay < 60) return '#f59e0b'; // Orange: 30-60s (slightly delayed)
    if (avgDelay < 180) return '#f97316'; // Dark orange: 1-3 min
    if (avgDelay < 300) return '#ef4444'; // Red: 3-5 min
    return '#dc2626'; // Dark red: > 5 min
  };

  const getRadius = (delayCount: number): number => {
    // Radius based on number of departures tracked
    return Math.min(15, Math.max(8, delayCount / 20));
  };

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden shadow-md">
      {/* @ts-ignore - Leaflet types issue with Next.js */}
      <MapContainer
        center={viennaCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {data.map((station, idx) => (
          <CircleMarker
            key={`${station.name}-${idx}`}
            center={[station.latitude, station.longitude]}
            radius={getRadius(station.departure_count)}
            fillColor={getColor(station.avg_delay)}
            color="#fff"
            weight={2}
            opacity={1}
            fillOpacity={0.8}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-gray-900">{station.name}</h3>
                <div className="mt-2 text-sm space-y-1">
                  <p>
                    <span className="font-medium">Ø Verspätung:</span>{' '}
                    <span className={`font-bold ${station.avg_delay < 60 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.round(station.avg_delay)}s
                    </span>
                    {' '}({Math.round(station.avg_delay / 60)} Min)
                  </p>
                  <p>
                    <span className="font-medium">Median:</span> {Math.round(station.median_delay)}s
                  </p>
                  <p>
                    <span className="font-medium">Abfahrten:</span> {station.departure_count}
                  </p>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
        <h4 className="text-sm font-semibold mb-2 text-gray-900">Pünktlichkeit</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
            <span>&lt; 30s (pünktlich)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
            <span>30-60s</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#f97316' }}></div>
            <span>1-3 Min</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
            <span>3-5 Min</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#dc2626' }}></div>
            <span>&gt; 5 Min</span>
          </div>
        </div>
      </div>
    </div>
  );
}
