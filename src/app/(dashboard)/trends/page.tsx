"use client";
import { useState } from 'react';
import { Sparkles, TrendingUp, Hash, Zap, Loader2 } from "lucide-react";
import Swal from 'sweetalert2';

export default function Trends() {
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState({
    topics: ['Tips Digital Marketing 2026', 'Trik Menggunakan AI untuk Bisnis', 'Strategi Reels Instagram Cepat Viral'],
    seasonal_idea: 'Menjelang akhir tahun, tingkatkan engagement dengan mengadakan giveaway bertema resolusi tahun baru. Gunakan format Carousel untuk menceritakan perjalanan brand Anda selama tahun ini.',
    hashtags: ['#digitalmarketing', '#bisnisonline', '#tipsbisnis', '#marketing2026', '#ai', '#startupindo', '#contentcreator']
  });

  const generateTrends = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/trends', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghasilkan tren');
      setTrends(data);
      Swal.fire({ title: 'Berhasil!', text: 'Laporan tren berhasil diperbarui oleh AI.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            Trend Insight <Sparkles className="text-amber-500 animate-pulse" size={28} />
          </h2>
          <p className="text-slate-600 mt-2 font-medium text-lg">Analisis cerdas dan ide konten musiman dari AI.</p>
        </div>
        <button onClick={generateTrends} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all shadow-md transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100">
          {loading ? <Loader2 className="animate-spin" size={20}/> : <Zap size={20} className="fill-white" />}
          <span>{loading ? 'AI Sedang Menganalisis...' : 'Generate Laporan Baru'}</span>
        </button>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8">
            <h3 className="text-xl font-extrabold flex items-center gap-2 mb-6 text-slate-900">
              <TrendingUp className="text-blue-600" /> Topik Populer Saat Ini
            </h3>
            <div className="space-y-4">
              {trends.topics.map((topic, i) => (
                <div key={i} className="p-5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-white hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                  <span className="font-extrabold text-slate-800 group-hover:text-blue-700 transition-colors text-lg">{topic}</span>
                  <button className="text-sm bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-bold shadow-sm">Jadikan Konten</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-md p-8 relative overflow-hidden group">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700"><Sparkles size={150}/></div>
            <h3 className="text-xl font-black text-amber-950 mb-4 relative z-10 flex items-center gap-2"><Sparkles className="text-amber-600" size={20}/> Ide Konten Musiman</h3>
            <p className="text-amber-900 font-medium leading-relaxed relative z-10 text-lg">
              {trends.seasonal_idea}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8 h-full">
            <h3 className="text-lg font-extrabold flex items-center gap-2 mb-6 text-slate-900">
              <Hash className="text-pink-600" /> Rekomendasi Hashtag
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {trends.hashtags.map((tag, i) => (
                <span key={i} className="bg-pink-50 text-pink-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-pink-100 hover:scale-105 transform cursor-pointer transition-all border border-pink-200 shadow-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
