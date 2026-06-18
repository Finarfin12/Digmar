"use client";
import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Hash, Zap, Loader2, Newspaper, ChevronRight, ExternalLink, MessageSquare, Flame, Globe2, Video, MessageCircle } from "lucide-react";
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';

interface SourceItem {
  title: string;
  platform: string;
  icon: string;
  score?: number;
  comments?: number;
  date: string;
  link: string;
}

export default function Trends() {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('mixed');
  const [trends, setTrends] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'ideas' | 'sources'>('ideas');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) { setUnits(data); if (data.length > 0) setSelectedUnit(data[0].id); }
      });
  }, []);

  const sourceIconFn = (platform: string, icon: string): React.ReactNode => {
    if (icon === 'reddit_hot') return <Flame size={18} className="text-orange-500" />;
    switch (platform) {
      case 'google_news': return <Newspaper size={18} className="text-slate-500" />;
      case 'newsdata': return <Globe2 size={18} className="text-slate-500" />;
      case 'youtube': return <Video size={18} className="text-red-500" />;
      case 'reddit': return <MessageCircle size={18} className="text-orange-500" />;
      default: return <Globe2 size={18} className="text-slate-400" />;
    }
  };

  const generateTrends = async () => {
    if (!selectedUnit) return Swal.fire('Error', 'Pilih Unit Bisnis terlebih dahulu', 'error');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/trends', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_unit_id: selectedUnit, source: selectedSource })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal');
      setTrends(data);
      setViewMode('ideas');
      Swal.fire({ title: 'Berhasil!', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            Trend Analyzer <Sparkles className="text-amber-500 animate-pulse" size={28} />
          </h2>
          <p className="text-slate-600 mt-2 font-medium text-lg">Analisis berita harian dan ide konten musiman untuk bisnis Anda.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="w-full md:w-64 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-slate-50">
            {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
          </select>
          <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)} className="w-full md:w-64 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-slate-50">
            <option value="mixed">Campur Semua</option>
            <option value="youtube">YouTube Trends</option>
            <option value="google_news">Berita Google</option>
            <option value="newsdata">Berita Global</option>
            <option value="reddit">Reddit</option>
          </select>
          <button onClick={generateTrends} disabled={loading || !selectedUnit} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all shadow-md disabled:opacity-70 whitespace-nowrap">
            {loading ? <Loader2 className="animate-spin" size={20}/> : <Zap size={20} className="fill-white" />}
            {loading ? 'Menganalisis...' : 'Analisis Tren'}
          </button>
        </div>
      </header>

      {!trends && !loading ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center">
          <TrendingUp className="mx-auto text-slate-400 mb-4" size={64} />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Mulai Analisis Tren</h3>
          <p className="text-slate-500">Klik tombol di atas untuk menganalisis berita terbaru dan ide konten.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center space-y-4">
          <Loader2 className="mx-auto animate-spin text-amber-500" size={64}/>
          <h3 className="text-xl font-bold text-slate-800">Menarik Data Tren Terkini...</h3>
          <p className="text-slate-500">AI sedang memindai sumber data dan merumuskan ide konten terbaik.</p>
        </div>
      ) : (
        <>
          {/* Toggle: Ide Konten / Sumber Data */}
          <div className="flex justify-center">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('ideas')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'ideas' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'}`}><Sparkles size={14} /> Ide Konten</button>
              <button onClick={() => setViewMode('sources')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'sources' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><Newspaper size={14} /> Sumber Data {(trends.sources?.length || 0) > 0 && `(${trends.sources.length})`}</button>
            </div>
          </div>

          {viewMode === 'sources' ? (
            /* === SOURCE INSPECTOR === */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-extrabold flex items-center gap-2 mb-6 text-slate-900">
                <Newspaper className="text-indigo-600" size={20} /> Data Mentah — Sumber Berita & Diskusi
              </h3>
              {(!trends.sources || trends.sources.length === 0) ? (
                <div className="text-center py-10 text-slate-400">
                  <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold">Tidak ada sumber data untuk ditampilkan</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {trends.sources.map((src: SourceItem, i: number) => {
                    const dt = new Date(src.date);
                    const dateStr = isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                    return (
                      <a key={i} href={src.link} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group">
                        <span className="shrink-0 mt-0.5">{sourceIconFn(src.platform, src.icon)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700">{src.title}</p>
                          <div className="flex gap-3 mt-1 items-center">
                            <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{src.platform}</span>
                            {dateStr && <span className="text-[10px] text-slate-400">{dateStr}</span>}
                            {src.platform === 'reddit' && src.score !== undefined && <span className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5"><TrendingUp size={10}/> {src.score}</span>}
                            {src.platform === 'reddit' && src.comments !== undefined && <span className="text-[10px] text-slate-500 flex items-center gap-0.5"><MessageSquare size={10}/> {src.comments}</span>}
                          </div>
                        </div>
                        <ExternalLink size={14} className="text-slate-300 group-hover:text-indigo-500 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-all" />
                      </a>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-4 text-center font-bold">Sumber: Google News, NewsData.io, YouTube, Reddit</p>
            </div>
          ) : (
            /* === IDE KONTEN === */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-slate-700 shadow-lg p-6 text-white relative overflow-hidden group">
                  <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4"><Sparkles size={150}/></div>
                  <h3 className="text-amber-400 font-extrabold mb-1 relative z-10 text-sm uppercase tracking-wider">Topik Utama Hari Ini</h3>
                  <p className="font-bold text-lg leading-relaxed relative z-10 text-slate-100">"{trends.topik_utama_hari_ini}"</p>
                </div>
              </div>
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 px-2"><Sparkles className="text-amber-500" /> Ide Konten Spesifik Bisnis Anda</h3>
                <div className="grid gap-4 xl:grid-cols-2">
                  {trends.ide_konten?.map((ide: { judul: string, tipe: string, deskripsi: string, format: string }, i: number) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 transform origin-bottom scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />
                      <div className="flex flex-col justify-between h-full gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full uppercase">Ide {i + 1}</span>
                            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-lg border border-indigo-100">Format: {ide.format}</span>
                          </div>
                          <h4 className="text-xl font-extrabold text-slate-900 mb-2">{ide.judul}</h4>
                          <p className="text-slate-600 font-medium leading-relaxed">{ide.deskripsi}</p>
                        </div>
                        <div className="shrink-0 pt-4 mt-auto border-t border-slate-100">
                          <button onClick={() => router.push('/planner')} className="w-full bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                            Jadikan Post <ChevronRight size={18}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
