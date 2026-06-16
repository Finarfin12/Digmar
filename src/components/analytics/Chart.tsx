"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Jan', engagement: 4000 },
  { name: 'Feb', engagement: 3000 },
  { name: 'Mar', engagement: 5000 },
  { name: 'Apr', engagement: 4500 },
  { name: 'Mei', engagement: 6000 },
  { name: 'Jun', engagement: 8000 },
];

export default function AnalyticsChart() {
  return (
    <div className="h-72 w-full mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dx={-10} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Line type="monotone" dataKey="engagement" stroke="#4f46e5" strokeWidth={4} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 8}} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
