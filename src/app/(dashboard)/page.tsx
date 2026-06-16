"use client";
import { useEffect, useState } from 'react';
import { ArrowRight, PlusCircle, Sparkles, Activity, Clock, BarChart3, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import PostScheduler from '@/components/planner/PostScheduler';

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduler, setShowScheduler] = useState(false);

  const fetchData = async () => {
    try {
      const [pRes, provRes, uRes, aRes] = await Promise.all([
        fetch('/api/posts'),
        fetch('/api/providers'),
        fetch('/api/units'),
        fetch('/api/accounts')
      ]);
      if(pRes.ok) setPosts(await pRes.json());
      if(provRes.ok) setProviders(await provRes.json());
      if(uRes.ok) setUnits(await uRes.json());
      if(aRes.ok) setAccounts(await aRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const waitingCount = posts.filter(p => p.status === 'waiting').length;
  const successCount = posts.filter(p => p.status === 'success' || p.status === 'published').length;
  const activeProvider = providers.find(p => p.is_active) || { provider_name: 'Belum Diatur', model: 'N/A' };
  
  const latestPostsWithLogs = [...posts]
    .filter(p => p.log_messages && p.log_messages.length > 0)
    .sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  
  const latestLogPost = latestPostsWithLogs.length > 0 ? latestPostsWithLogs[0] : null;
  const latestLog = latestLogPost ? latestLogPost.log_messages[latestLogPost.log_messages.length - 1] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-indigo-900 to-blue-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400 opacity-10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3"></div>
        
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight">Selamat Datang di DigiMar</h2>
          <p className="text-blue-200 mt-2 text-lg font-medium">Pusat kontrol AI untuk dominasi sosial media Anda.</p>
        </div>
        <button onClick={() => setShowScheduler(!showScheduler)} className="relative z-10 bg-white text-indigo-900 hover:bg-blue-50 font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
          <PlusCircle size={20} />
          <span>{showScheduler ? 'Tutup Form Postingan' : 'Buat Postingan Baru'}</span>
        </button>
      </header>

      {/* Scheduler Section (Toggleable) */}
      {showScheduler && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 md:p-8 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-900">Post Creator Studio</h3>
          </div>
          <PostScheduler 
            units={units} 
            accounts={accounts} 
            onSuccess={() => {
              fetchData();
              setShowScheduler(false);
            }} 
          />
        </div>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-lg transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Clock size={100} /></div>
          <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
            <Clock size={24} />
          </div>
          <div className="text-slate-600 text-sm font-bold uppercase tracking-wider relative z-10">Antrean Post</div>
          <div className="text-5xl font-black text-slate-900 mt-2 mb-4 relative z-10">
            {loading ? <Loader2 className="animate-spin text-blue-500" size={32}/> : waitingCount}
          </div>
          <Link href="/planner" className="text-blue-700 text-sm font-bold flex items-center gap-1 group-hover:text-blue-800 transition-colors relative z-10">
            Kelola di Planner <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-lg transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><BarChart3 size={100} /></div>
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
            <BarChart3 size={24} />
          </div>
          <div className="text-slate-600 text-sm font-bold uppercase tracking-wider relative z-10">Post Berhasil</div>
          <div className="text-5xl font-black text-slate-900 mt-2 mb-4 relative z-10">
            {loading ? <Loader2 className="animate-spin text-emerald-500" size={32}/> : successCount}
          </div>
          <Link href="/analytics" className="text-emerald-700 text-sm font-bold flex items-center gap-1 relative z-10">
            Lihat Analitik <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 backdrop-blur-xl p-6 rounded-2xl border border-indigo-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-lg transition-all relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-indigo-200 group-hover:rotate-12 transition-transform opacity-40">
            <Sparkles size={120} />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-indigo-200 text-indigo-700 rounded-xl flex items-center justify-center mb-4">
              {loading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24} className="animate-pulse" />}
            </div>
            <div className="text-indigo-900 text-sm font-extrabold uppercase tracking-wider mb-2">AI Assistant Status</div>
            <div className="text-3xl font-black text-indigo-950 mt-2 capitalize truncate">
              {loading ? 'Memuat...' : activeProvider.provider_name}
            </div>
            <div className="text-indigo-800 text-sm mt-3 font-bold bg-white/60 inline-block px-3 py-1.5 rounded-md truncate max-w-full border border-indigo-100">
              Model: {loading ? '...' : (activeProvider.model || 'Default API')}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8">
        <h3 className="text-xl font-extrabold text-slate-900 mb-6 flex items-center gap-2">
          Aktivitas Eksekusi Terkini (Cron Log)
        </h3>
        
        {loading ? (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="animate-spin text-slate-400 mb-4" size={32}/>
            <p className="text-slate-600 font-bold">Memuat log aktivitas...</p>
          </div>
        ) : latestLog ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl mt-1 ${latestLog.includes('error') || latestLog.includes('gagal') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {latestLog.includes('error') || latestLog.includes('gagal') ? <AlertCircle size={24}/> : <CheckCircle2 size={24}/>}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg">
                  Job Code: {latestLogPost?.job_code || 'Unknown'}
                </h4>
                <p className="text-slate-600 mt-2 font-mono text-sm bg-white p-3 rounded border border-slate-200">
                  {latestLog}
                </p>
                <p className="text-slate-500 text-sm font-medium mt-3">
                  Terakhir diperbarui: {new Date(latestLogPost?.updated_at).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-slate-50">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-400 mb-4 shadow-sm">
              <Clock size={32} />
            </div>
            <p className="text-slate-700 font-bold text-lg">Belum ada aktivitas cron terbaru.</p>
            <p className="text-slate-500 text-sm mt-1 font-medium">Sistem akan mencatat log di sini saat jadwal posting dieksekusi.</p>
          </div>
        )}
      </div>
    </div>
  );
}
