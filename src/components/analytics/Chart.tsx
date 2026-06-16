"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

import type { PostJob } from '@/types';

export default function AnalyticsChart({ posts }: { posts: PostJob[] }) {
  // Aggregate posts by day
  const dailyData: Record<string, number> = {};
  
  // Initialize last 7 days with 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyData[format(d, 'dd MMM')] = 0;
  }

  // Count published posts
  posts.forEach(p => {
    if (p.status === 'published') {
      try {
        const dateStr = format(parseISO(p.scheduled_at), 'dd MMM');
        if (dailyData[dateStr] !== undefined) {
          dailyData[dateStr] += 1;
        }
      } catch (e) {}
    }
  });

  const chartData = Object.keys(dailyData).map(date => ({
    name: date,
    posts: dailyData[date]
  }));

  return (
    <div className="h-72 w-full mt-6 text-slate-900">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600}} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600}} dx={-10} allowDecimals={false} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#0f172a', fontWeight: 'bold' }}
            formatter={(value) => [`${value} Posts`, 'Berhasil Tayang']}
          />
          <Line type="monotone" dataKey="posts" stroke="#4f46e5" strokeWidth={4} dot={{r: 4, strokeWidth: 2, fill: 'white'}} activeDot={{r: 8, strokeWidth: 0}} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
