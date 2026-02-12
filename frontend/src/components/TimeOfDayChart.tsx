'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimeOfDayData {
  hour: number;
  avg_delay: number;
  departure_count: number;
}

export default function TimeOfDayChart({ data }: { data: TimeOfDayData[] }) {
  const chartData = data.map(item => ({
    time: `${item.hour.toString().padStart(2, '0')}:00`,
    'Durchschn. Verspätung (s)': Math.round(parseFloat(item.avg_delay.toString())),
    Abfahrten: item.departure_count,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time"
            angle={-45} 
            textAnchor="end"
            height={60}
          />
          <YAxis label={{ value: 'Sekunden', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="Durchschn. Verspätung (s)" 
            stroke="#10b981" 
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
