"use client";
import { useEffect, useState } from 'react';
import { ArrowRight, PlusCircle, Sparkles, Clock, BarChart3, Loader2, Calendar, Layers, UserCheck } from "lucide-react";
import Link from "next/link";
import PostScheduler from '@/components/planner/PostScheduler';
import StatsCard from '@/components/dashboard/StatsCard';
import QueueWidget from '@/components/dashboard/QueueWidget';
import RecentActivity from '@/components/dashboard/RecentActivity';

interface DashboardData {
  total_posts: number;
  posts_today: number;
  total_units: number;
  total_accounts: number;
  queue: { waiting: number; processing: number; success: number; failed: number };
  monthly_calendar: { date: string; count: number }[];
  recent_activity: { type: string; timestamp: string; message: string }[];
}

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScheduler, setShowScheduler] = useState(false);

  const fetchData = async () => {
    try {
      const [pRes, provRes, uRes, aRes, dRes] = await Promise.all([
        fetch('/api/posts'),
        fetch('/api/providers'),
        fetch('/api/units'),
        fetch('/api/accounts'),
        fetch('/api/dashboard'),
      ]);
      if (pRes.ok) setPosts(await pRes.json());
      if (provRes.ok) setProviders(await provRes.json());
      if (uRes.ok) setUnits(await uRes.json());
      if (aRes.ok) setAccounts(await aRes.json());
      if (dRes.ok) setDashData(await dRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const activeProvider = providers.find(p => p.is_active) || { provider_name: 'Belum Diatur', model: 'N/A' };
  const q = dashData?.queue || { waiting: 0, processing: 0, success: 0, failed: 0 };

  const calendarDays = () => {
    if (!dashData?.monthly_calendar) return [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const postMap = new Map(dashData.monthly_calendar.map(d => [d.date, d.count]));

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return cells.map((day, i) => {
      if (day === null) return { day: null, count: 0, isToday: false };
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        day,
        count: postMap.get(dateStr) || 0,
        isToday: day === now.getDate(),
      };
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-indigo-900 to-blue-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400 opacity-10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3" />
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight">Selamat Datang di DigiMar</h2>
          <p className="text-blue-200 mt-2 text-lg font-medium">Pusat kontrol AI untuk dominasi sosial media Anda.</p>
        </div>
        <button onClick={() => setShowScheduler(!showScheduler)} className="relative z-10 bg-white text-indigo-900 hover:bg-blue-50 font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
          <PlusCircle size={20} />
          <span>{showScheduler ? 'Tutup Form Postingan' : 'Buat Postingan Baru'}</span>
        </button>
      </header>

      {showScheduler && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 md:p-8 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-900">Post Creator Studio</h3>
          </div>
          <PostScheduler units={units} accounts={accounts} onSuccess={() => { fetchData(); setShowScheduler(false); }} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard icon={Clock} label="Antrean" value={loading ? '...' : q.waiting + q.processing} sub={`${q.success} berhasil, ${q.failed} gagal`} color="blue" />
        <StatsCard icon={BarChart3} label="Total Posts" value={loading ? '...' : dashData?.total_posts ?? 0} sub={`${dashData?.posts_today ?? 0} hari ini`} color="emerald" />
        <StatsCard icon={Layers} label="Unit Bisnis" value={loading ? '...' : dashData?.total_units ?? 0} color="amber" />
        <StatsCard icon={UserCheck} label="Akun Sosial" value={loading ? '...' : dashData?.total_accounts ?? 0} color="fuchsia" />
      </div>

      {/* AI Status + Queue + Mini Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 backdrop-blur-xl p-6 rounded-2xl border border-indigo-200 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-indigo-200 opacity-40"><Sparkles size={80} /></div>
          <div className="relative z-10">
            <div className="w-10 h-10 bg-indigo-200 text-indigo-700 rounded-xl flex items-center justify-center mb-3">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} className="animate-pulse" />}
            </div>
            <div className="text-indigo-900 text-xs font-extrabold uppercase tracking-wider mb-1">AI Assistant</div>
            <div className="text-2xl font-black text-indigo-950 capitalize">{loading ? '...' : activeProvider.provider_name}</div>
            <div className="text-indigo-700 text-xs mt-2 font-bold bg-white/60 inline-block px-2 py-1 rounded-md max-w-full truncate border border-indigo-100">
              {loading ? '...' : (activeProvider.model || 'Default')}
            </div>
          </div>
        </div>

        <QueueWidget waiting={q.waiting} processing={q.processing} success={q.success} failed={q.failed} />

        {/* Mini Calendar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
            <Calendar size={14} /> Kalender Post
          </h4>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'].map(d => (
              <div key={d} className="text-[9px] font-bold text-slate-400 py-1">{d}</div>
            ))}
            {calendarDays().map((cell, i) => (
              <div
                key={i}
                className={`text-[10px] font-bold py-1 rounded relative ${!cell.day ? 'text-transparent' : cell.isToday ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {cell.day}
                {cell.count > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${cell.isToday ? 'bg-white' : 'bg-indigo-500'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3 text-[9px] text-slate-500 font-medium items-center justify-center">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-500 rounded-full" /> Ada Post</span>
          </div>
        </div>
      </div>

      {/* Quick Actions + Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-wide mb-4">Quick Actions</h4>
          <div className="space-y-2">
            <Link href="/planner" className="flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-indigo-800 font-bold text-sm transition-colors">
              <span className="flex items-center gap-2"><PlusCircle size={16} /> Buat Post Baru</span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/planner" className="flex items-center justify-between p-3 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-xl text-fuchsia-800 font-bold text-sm transition-colors">
              <span className="flex items-center gap-2"><Sparkles size={16} /> Auto-Pilot Post</span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/analytics" className="flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-emerald-800 font-bold text-sm transition-colors">
              <span className="flex items-center gap-2"><BarChart3 size={16} /> Lihat Analitik</span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/settings" className="flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold text-sm transition-colors">
              <span className="flex items-center gap-2"><Layers size={16} /> Pengaturan</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="md:col-span-2">
          <RecentActivity activities={dashData?.recent_activity || []} />
        </div>
      </div>
    </div>
  );
}
