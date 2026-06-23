"use client";
import { useState, useEffect, useMemo } from 'react';
import { Sparkles, TrendingUp, Hash, Zap, Loader2, Newspaper, ChevronRight, ExternalLink, MessageSquare, Flame, Globe2, Video, MessageCircle, Bookmark, ArrowUpRight, ArrowDownRight, Activity, BarChart2 } from "lucide-react";
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
  const router = useRouter();

  useEffect(() => {
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) { setUnits(data); if (data.length > 0) setSelectedUnit(data[0].id); }
      });
  }, []);

  const sourceIconFn = (platform: string, icon: string): React.ReactNode => {
    if (icon === 'reddit_hot') return <Flame size={16} className="text-orange-500" />;
    switch (platform) {
      case 'google_news': return <Newspaper size={16} className="text-slate-500" />;
      case 'newsdata': return <Globe2 size={16} className="text-slate-500" />;
      case 'youtube': return <Video size={16} className="text-red-500" />;
      case 'reddit': return <MessageCircle size={16} className="text-orange-500" />;
      case 'google_trends': return <TrendingUp size={16} className="text-blue-500" />;
      default: return <Globe2 size={16} className="text-slate-400" />;
    }
  };

  const generateTrends = async () => {
    if (!selectedUnit) return Swal.fire('Error', 'Pilih Unit Bisnis terlebih dahulu', 'error');

    if (selectedSource === 'serpapi') {
      const result = await Swal.fire({
        title: 'Gunakan Token Premium?',
        text: 'Anda akan menggunakan 1 token SerpApi. Lanjutkan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Analisis',
        cancelButtonText: 'Batal'
      });
      if (!result.isConfirmed) return;
    }

    setLoading(true);
    try {
      const endpoint = selectedSource === 'serpapi' ? '/api/serpapi' : '/api/ai/trends';
      const bodyPayload = selectedSource === 'serpapi'
        ? { business_unit_id: selectedUnit, search_type: 'trends', query: 'Top Trends ID' }
        : { business_unit_id: selectedUnit, source: selectedSource };

      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Gagal');

      if (selectedSource === 'serpapi' && data.data) {
         setTrends(data.data);
      } else {
         setTrends(data);
      }
      
      Swal.fire({ title: 'Berhasil!', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err: unknown) {
      if ((err as Error).message.includes('Limit')) setSelectedSource('mixed');
      Swal.fire('Error', (err as Error).message, 'error');
    } finally { setLoading(false); }
  };

  // Derived Data for Top Metrics and UI
  const sourcesLength = trends?.sources?.length || 0;
  const ideasLength = trends?.ide_konten?.length || 0;
  
  // Extract simple hashtags from titles
  const hashtags = useMemo(() => {
    if (!trends?.sources) return [];
    const stopWords = ['di', 'ke', 'dari', 'yang', 'dan', 'ini', 'itu', 'dengan', 'untuk', 'pada', 'dalam'];
    const wordsCount: Record<string, number> = {};
    trends.sources.forEach((s: SourceItem) => {
      const words = s.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ');
      words.forEach(w => {
        if (w.length > 4 && !stopWords.includes(w)) {
          wordsCount[w] = (wordsCount[w] || 0) + 1;
        }
      });
    });
    return Object.entries(wordsCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => '#' + x[0]);
  }, [trends?.sources]);

  // Mock 7-day velocity chart data
  const chartData = useMemo(() => {
    const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'];
    return days.map((day, i) => ({
      name: day,
      volume: 40 + (i * 15) + Math.floor(Math.random() * 20),
      engagement: 20 + (i * 10) + Math.floor(Math.random() * 15),
    }));
  }, [trends]); // Re-generate slightly on new trend fetch

  const handleCreatePost = (title: string, desc?: string) => {
    Swal.fire({
      title: 'Buat Postingan',
      text: 'Pilih mode pembuatan konten untuk ide ini:',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Auto-Pilot',
      cancelButtonText: 'Manual Draft',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#64748b'
    }).then((result) => {
      const ideaParam = encodeURIComponent(title + (desc ? `\n${desc}` : ''));
      if (result.isConfirmed) {
        router.push('/planner?idea=' + ideaParam + '&mode=autopilot');
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        router.push('/planner?idea=' + ideaParam + '&mode=manual');
      }
    });
  };

  const handleViewInsights = (ide: any) => {
    Swal.fire({
      title: ide.judul,
      html: `
        <div class="text-left mt-4 text-sm text-slate-600 space-y-3">
          <p><strong>Deskripsi:</strong><br/>${ide.deskripsi}</p>
          <p><strong>Format yang disarankan:</strong> <span class="bg-slate-100 px-2 py-1 rounded font-bold">${ide.format || 'Standard'}</span></p>
          <p><strong>Tipe Konten:</strong> <span class="bg-slate-100 px-2 py-1 rounded font-bold">${ide.tipe || 'Edukasi'}</span></p>
        </div>
      `,
      icon: 'info',
      confirmButtonColor: '#16a34a',
      confirmButtonText: 'Tutup'
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
             Trends <Sparkles className="text-green-600 animate-pulse" size={24} />
          </h2>
          <p className="text-slate-500 mt-1 font-medium text-sm">Monitor pergerakan tren & kompetitor untuk inspirasi konten AI Anda.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="w-full md:w-48 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 font-bold text-slate-700 bg-slate-50 text-sm outline-none">
            {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
          </select>
          <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)} className="w-full md:w-48 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 font-bold text-slate-700 bg-slate-50 text-sm outline-none">
            <option value="mixed">All Sources</option>
            <option value="youtube">YouTube</option>
            <option value="google_news">Google News</option>
            <option value="newsdata">Global News</option>
            <option value="reddit">Reddit</option>
            {units.find(u => u.id === selectedUnit)?.use_serpapi && (
              <option value="serpapi">Google Trends (SerpApi)</option>
            )}
          </select>
          <button onClick={generateTrends} disabled={loading || !selectedUnit} className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all disabled:opacity-70 text-sm">
            {loading ? <Loader2 className="animate-spin" size={16}/> : <Zap size={16} />}
            {loading ? 'Analyzing...' : 'Fetch Trends'}
          </button>
        </div>
      </header>

      {!trends && !loading ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-16 text-center shadow-sm">
          <Activity className="mx-auto text-slate-300 mb-4" size={56} />
          <h3 className="text-lg font-bold text-slate-700 mb-2">No Data Monitored</h3>
          <p className="text-slate-500 text-sm">Configure your sources and click "Fetch Trends" to start analyzing.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center space-y-4">
          <Loader2 className="mx-auto animate-spin text-green-600" size={56}/>
          <h3 className="text-lg font-bold text-slate-800">Compiling Market Intelligence...</h3>
          <p className="text-slate-500 text-sm">Our AI is aggregating and filtering thousands of data points.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Topics Tracked</p>
              <h4 className="text-3xl font-black text-slate-900">{sourcesLength}</h4>
              <p className="text-green-600 text-xs font-bold mt-2 flex items-center gap-1"><ArrowUpRight size={12}/> Live Data</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Avg. Engagement</p>
              <h4 className="text-3xl font-black text-slate-900">High</h4>
              <p className="text-green-600 text-xs font-bold mt-2 flex items-center gap-1"><ArrowUpRight size={12}/> Based on sources</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Content Opportunities</p>
              <h4 className="text-3xl font-black text-slate-900">{ideasLength}</h4>
              <p className="text-green-600 text-xs font-bold mt-2 flex items-center gap-1"><Sparkles size={12}/> AI Generated</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Hashtags Monitored</p>
              <h4 className="text-3xl font-black text-slate-900">{hashtags.length}</h4>
              <p className="text-green-600 text-xs font-bold mt-2 flex items-center gap-1"><Hash size={12}/> Extracted</p>
            </div>
          </div>

          {/* Main Grid: Trending List & Hashtags */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900">Trending Topics</h3>
                <span className="text-xs text-slate-400 font-medium">Updated just now</span>
              </div>
              <div className="p-2">
                {(!trends.sources || sourcesLength === 0) ? (
                  <div className="text-center py-10 text-slate-400">
                    <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-sm">Tidak ada sumber data</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {trends.sources.slice(0, 10).map((src: SourceItem, i: number) => {
                      const isRising = i % 3 !== 2; // Mock status: mostly rising, some peaking
                      return (
                        <div key={i} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors group">
                          <span className="text-slate-400 font-bold text-xs w-4">#{i + 1}</span>
                          
                          {/* Sparkline Mock SVG */}
                          <div className="w-12 h-6 hidden sm:flex shrink-0 items-center justify-center">
                            {isRising ? (
                              <svg viewBox="0 0 40 10" className="w-full stroke-green-500 fill-none" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M0 8 L10 6 L15 9 L25 3 L30 5 L40 1" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 40 10" className="w-full stroke-orange-400 fill-none" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M0 2 L10 5 L15 3 L25 8 L30 6 L40 9" />
                              </svg>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                            <a href={src.link} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-800 truncate hover:text-green-700 flex items-center gap-1.5 flex-1">
                              {sourceIconFn(src.platform, src.icon)} {src.title}
                            </a>
                            <div className="flex items-center gap-2 mt-1 sm:mt-0 shrink-0">
                               <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isRising ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                 {isRising ? 'RISING' : 'PEAKING'}
                               </span>
                               {src.score !== undefined && <span className="text-xs text-slate-500 font-medium w-12 text-right">{src.score >= 1000 ? (src.score/1000).toFixed(1)+'k' : src.score}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => handleCreatePost(src.title)} className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap">
                              Create Post
                            </button>
                            <button className="text-slate-300 hover:text-slate-600"><Bookmark size={14}/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900">Top Hashtags</h3>
              </div>
              <div className="p-5 flex flex-wrap gap-2 flex-1 content-start">
                {hashtags.length === 0 ? (
                  <p className="text-sm text-slate-400 w-full text-center py-4">No hashtags found</p>
                ) : (
                  hashtags.map((ht, idx) => (
                    <span key={idx} className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${idx < 3 ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {ht}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Trend Velocity Chart */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><BarChart2 size={16}/> Trend Velocity — Last 7 Days</h3>
               <div className="flex gap-2">
                 <span className="text-[9px] font-bold bg-green-50 text-green-700 px-2 py-1 rounded uppercase">Volume</span>
                 <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase">Engagement</span>
               </div>
            </div>
            <div className="p-5 h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="volume" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#colorVol)" />
                  <Area type="monotone" dataKey="engagement" stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#colorEng)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Content Suggestions (AI Ideas) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><Sparkles className="text-amber-500" size={16}/> Content Suggestions</h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Based on trending data</span>
             </div>
             <div className="p-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {(!trends.ide_konten || ideasLength === 0) ? (
                 <div className="col-span-full text-center py-8 text-slate-400">
                   <p className="text-sm">Tidak ada ide konten yang di-generate.</p>
                 </div>
               ) : (
                 trends.ide_konten.map((ide: any, i: number) => (
                   <div key={i} className="border border-slate-200 rounded-xl p-5 hover:border-green-300 transition-colors flex flex-col justify-between group bg-slate-50/30">
                     <div>
                       <div className="flex gap-2 mb-3">
                         <span className="text-[9px] font-bold text-green-700 uppercase tracking-wider">HIGH OPPORTUNITY</span>
                       </div>
                       <h4 className="text-base font-extrabold text-slate-900 mb-2 leading-tight">{ide.judul}</h4>
                       <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-3 mb-4">{ide.deskripsi}</p>
                       <div className="flex gap-2 mb-6">
                         <span className="text-[9px] font-bold bg-green-50 text-green-700 px-2 py-1 rounded-full uppercase">{ide.format || 'POST'}</span>
                         <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full uppercase">{ide.tipe || 'TIPS'}</span>
                       </div>
                     </div>
                     <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
                       <button onClick={() => handleCreatePost(ide.judul, ide.deskripsi)} className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold px-4 py-2 rounded-lg transition-colors shadow-sm">
                         Create Post
                       </button>
                       <button onClick={() => handleViewInsights(ide)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold px-4 py-2 rounded-lg transition-colors shadow-sm">
                         View Insights
                       </button>
                     </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
