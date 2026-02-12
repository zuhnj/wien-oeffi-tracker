'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface WeekdayData {
  day_of_week: number;
  day_name: string;
  avg_delay: number;
  departure_count: number;
}

export default function WeekdayChart({ data }: { data: WeekdayData[] }) {
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  
  const chartData = data.map(item => ({
    name: dayNames[parseInt(item.day_of_week.toString())],
    'Durchschn. Verspätung (s)': Math.round(parseFloat(item.avg_delay.toString())),
    Abfahrten: item.departure_count,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45} 
            textAnchor="end"
            height={60}
          />
          <YAxis label={{ value: 'Sekunden', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Durchschn. Verspätung (s)" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
