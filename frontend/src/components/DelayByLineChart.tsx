'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DelayData {
  line_name: string;
  transport_type: string;
  avg_delay_seconds: number;
  median_delay_seconds: number;
  total_departures: number;
}

export default function DelayByLineChart({ data }: { data: DelayData[] }) {
  const chartData = data.map(item => ({
    name: item.line_name,
    'Durchschn. Verspätung (s)': Math.round(item.avg_delay_seconds),
    'Median Verspätung (s)': Math.round(item.median_delay_seconds || 0),
    Abfahrten: item.total_departures,
  }));

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45} 
            textAnchor="end"
            height={80}
          />
          <YAxis label={{ value: 'Sekunden', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Durchschn. Verspätung (s)" fill="#f97316" />
          <Bar dataKey="Median Verspätung (s)" fill="#a855f7" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
