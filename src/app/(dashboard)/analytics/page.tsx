"use client";
import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, CheckCircle, Loader2, Calendar } from "lucide-react";
import AnalyticsChart from "@/components/analytics/Chart";

export default function Analytics() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/posts?limit=500')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPosts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const publishedCount = posts.filter(p => p.status === 'success' || p.status === 'published').length;
  const waitingCount = posts.filter(p => p.status === 'waiting').length;
  
  // Calculate best time based on published posts (most frequent hour)
  const hourCounts: Record<number, number> = {};
  posts.filter(p => p.status === 'success' || p.status === 'published').forEach(p => {
    try {
      const hour = new Date(p.scheduled_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    } catch(e){}
  });
  
  let bestHour = 18; // fallback default
  let maxCount = 0;
  Object.keys(hourCounts).forEach(h => {
    if (hourCounts[parseInt(h)] > maxCount) {
      maxCount = hourCounts[parseInt(h)];
      bestHour = parseInt(h);
    }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Analytics Overview</h2>
          <p className="text-slate-600 font-medium mt-2">Lacak performa publikasi sosial media Anda secara aktual.</p>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 hover:shadow-lg transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle size={24} />
            </div>
            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide">TOTAL</span>
          </div>
          <h3 className="text-slate-600 font-bold mb-1">Post Berhasil Tayang</h3>
          <div className="text-4xl font-black text-slate-900">
            {loading ? <Loader2 className="animate-spin text-emerald-500"/> : publishedCount}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 hover:shadow-lg transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar size={24} />
            </div>
            <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide">ANTREAN</span>
          </div>
          <h3 className="text-slate-600 font-bold mb-1">Post Terjadwal (Waiting)</h3>
          <div className="text-4xl font-black text-slate-900">
            {loading ? <Loader2 className="animate-spin text-blue-500"/> : waitingCount}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group border border-indigo-900">
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:rotate-12 transition-transform"><BarChart2 size={120}/></div>
          <h3 className="text-indigo-200 font-bold mb-1 relative z-10">Waktu Posting Terbaik Anda</h3>
          <div className="text-5xl font-black mt-2 mb-4 relative z-10">{bestHour.toString().padStart(2, '0')}:00</div>
          <p className="text-sm text-slate-300 font-medium relative z-10">Berdasarkan riwayat jadwal tersukses Anda sejauh ini.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8">
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">Grafik Publikasi 7 Hari Terakhir</h3>
        <p className="text-slate-600 text-sm font-medium">Tren aktivitas automasi (*auto-posting*) Anda.</p>
        {loading ? (
          <div className="h-72 w-full flex items-center justify-center">
            <Loader2 className="animate-spin text-indigo-500" size={40}/>
          </div>
        ) : (
          <AnalyticsChart posts={posts} />
        )}
      </div>
    </div>
  );
}
