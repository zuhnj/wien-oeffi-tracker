'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StopDelayData {
  stop_name: string;
  avg_delay_seconds: number;
  median_delay_seconds: number;
  total_departures: number;
}

export default function DelayByStopChart({ data }: { data: StopDelayData[] }) {
  const chartData = data.map(item => ({
    name: item.stop_name.length > 20 ? item.stop_name.substring(0, 20) + '...' : item.stop_name,
    'Durchschn. Verspätung (s)': Math.round(item.avg_delay_seconds),
    'Median Verspätung (s)': Math.round(item.median_delay_seconds || 0),
    Abfahrten: item.total_departures,
  }));

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 150, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" label={{ value: 'Sekunden', position: 'bottom' }} />
          <YAxis dataKey="name" type="category" width={140} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Durchschn. Verspätung (s)" fill="#f97316" />
          <Bar dataKey="Median Verspätung (s)" fill="#a855f7" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
