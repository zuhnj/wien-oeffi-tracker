'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface TrendData {
  hour: Date | string;
  avg_delay: number;
  departure_count: number;
}

export default function HourlyTrendChart({ data }: { data: TrendData[] }) {
  const chartData = data.map(item => ({
    time: format(new Date(item.hour), 'dd.MM HH:mm', { locale: de }),
    'Durchschn. Verspätung (s)': Math.round(parseFloat(item.avg_delay.toString())),
    Abfahrten: item.departure_count,
  }));

  // Sample every 6th point if there are more than 50 data points
  const sampledData = chartData.length > 50 
    ? chartData.filter((_, i) => i % 6 === 0) 
    : chartData;

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={sampledData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            angle={-45} 
            textAnchor="end"
            height={80}
          />
          <YAxis label={{ value: 'Sekunden', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="Durchschn. Verspätung (s)" 
            stroke="#f97316" 
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
