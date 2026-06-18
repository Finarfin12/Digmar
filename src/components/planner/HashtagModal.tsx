import { useState } from 'react';
import { Search, Copy, Loader2, Hash, X, ExternalLink, MessageSquare, TrendingUp, Newspaper, Video, MessageCircle, Flame, Camera, Music, Globe2 } from 'lucide-react';
import Swal from 'sweetalert2';

interface SourceItem {
  title: string;
  platform: string;
  icon: string;
  score?: number;
  comments?: number;
  date: string;
  link: string;
}

interface HashtagData {
  hashtags?: { high?: string[]; medium?: string[]; niche?: string[] };
  instagram_safe?: string[];
  tiktok_trending?: string[];
  seo_keywords?: string[];
  sources?: SourceItem[];
}

interface BusinessUnitOption { id: string; brand_name: string; }

export default function HashtagModal({ onClose, units = [] }: { onClose: () => void; units?: BusinessUnitOption[] }) {
  const [topic, setTopic] = useState('');
  const [businessUnitId, setBusinessUnitId] = useState(units.length > 0 ? units[0].id : '');
  const [selectedSource, setSelectedSource] = useState('mixed');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HashtagData | null>(null);
  const [platformTab, setPlatformTab] = useState<'instagram' | 'tiktok' | 'umum'>('umum');
  const [viewMode, setViewMode] = useState<'hashtags' | 'sources'>('hashtags');
  const selectedBusinessUnitId = businessUnitId || units[0]?.id || '';

  const sourceIconFn = (platform: string, hot?: boolean): React.ReactNode => {
    if (hot) return <Flame size={18} className="text-orange-500" />;
    switch (platform) {
      case 'google_news': return <Newspaper size={18} className="text-slate-500" />;
      case 'newsdata': return <Globe2 size={18} className="text-slate-500" />;
      case 'youtube': return <Video size={18} className="text-red-500" />;
      case 'reddit': return <MessageCircle size={18} className="text-orange-500" />;
      default: return <Globe2 size={18} className="text-slate-400" />;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return Swal.fire('Oops', 'Masukkan topik dulu', 'warning');
    if (!selectedBusinessUnitId) return Swal.fire('Oops', 'Unit Bisnis belum tersedia.', 'warning');
    setLoading(true);
    setData(null);
    try {
      const res = await fetch('/api/ai/hashtags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_unit_id: selectedBusinessUnitId, topic: topic.trim(), source: selectedSource })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal');
      setData(json);
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally { setLoading(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({ title: 'Disalin!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
  };

  const copyAllHashtags = () => {
    if (!data?.hashtags) return;
    const all = [...(data.hashtags.high || []), ...(data.hashtags.medium || []), ...(data.hashtags.niche || [])].join(' ');
    copyToClipboard(all);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex justify-between items-center gap-4 bg-slate-50">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2 min-w-0"><Hash className="text-indigo-600" /> AI Hashtag & Keyword Engine</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 bg-white p-2 rounded-full shadow-sm"><X size={20}/></button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-slate-900">
          <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 mb-8 lg:grid-cols-[minmax(0,1fr)_190px_230px_140px]">
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topik: Kopi Susu Gula Aren" className="w-full p-4 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 text-base sm:text-lg font-medium" />
            <select value={selectedBusinessUnitId} onChange={e => setBusinessUnitId(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 bg-slate-50 cursor-pointer" required>
              <option value="" disabled>Pilih Unit Bisnis</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
            </select>
            <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 bg-slate-50 cursor-pointer">
              <option value="mixed">Campur Semua</option>
              <option value="youtube">YouTube Search</option>
              <option value="google_news">Berita Google</option>
              <option value="newsdata">Berita Global</option>
              <option value="reddit">Reddit (Sentimen Netizen)</option>
            </select>
            <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white px-6 py-4 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition disabled:opacity-60">
              {loading ? <Loader2 className="animate-spin" /> : <Search />} Cari
            </button>
          </form>

          {data && data.hashtags && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setViewMode('hashtags')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'hashtags' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><Hash size={12} className="inline mr-1"/> Hashtags</button>
                  <button onClick={() => setViewMode('sources')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'sources' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><TrendingUp size={12} className="inline mr-1"/> Sumber {(data.sources?.length || 0) > 0 && `(${data.sources!.length})`}</button>
                </div>
                {viewMode === 'hashtags' && (
                  <button onClick={copyAllHashtags} className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm hover:bg-indigo-100"><Copy size={16} /> Salin Semua</button>
                )}
              </div>

              {viewMode === 'sources' ? (
                <div className="space-y-3">
                  {(!data.sources || data.sources.length === 0) ? (
                    <div className="text-center py-8 text-slate-400"><MessageSquare size={40} className="mx-auto mb-2 opacity-50" /><p className="text-sm font-bold">Tidak ada sumber data</p></div>
                  ) : (
                    data.sources.map((src, i) => {
                      const dt = new Date(src.date);
                      const dateStr = isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                      return (
                        <a key={i} href={src.link} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group">
                          <span className="shrink-0 mt-0.5">{sourceIconFn(src.platform, src.icon === '🔥')}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{src.title}</p>
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
                    })
                  )}
                </div>
              ) : (
                <>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setPlatformTab('instagram')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${platformTab === 'instagram' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}><Camera size={12} /> IG (max 5)</button>
                    <button onClick={() => setPlatformTab('tiktok')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${platformTab === 'tiktok' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><Music size={12} /> TikTok</button>
                    <button onClick={() => setPlatformTab('umum')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${platformTab === 'umum' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><Globe2 size={12} /> Umum</button>
                  </div>
                  {platformTab !== 'umum' && <p className="text-xs text-slate-500 -mt-3 font-medium">{platformTab === 'instagram' ? 'Instagram rekomendasi maks. 5 hashtag.' : 'TikTok: 5-15 hashtag optimal.'}</p>}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
                      <div className="text-red-800 font-bold mb-2 flex items-center gap-2"><TrendingUp size={14} /> High Volume</div>
                      <div className="flex flex-wrap gap-2">
                        {data.hashtags.high?.map((tag: string) => (
                          <span onClick={() => copyToClipboard(tag)} key={tag} className="bg-white px-3 py-1.5 rounded-lg text-sm cursor-pointer shadow-sm hover:shadow-md hover:text-indigo-600 border border-red-200 transition-all font-medium text-slate-700">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                      <div className="text-amber-800 font-bold mb-2 flex items-center gap-2"><TrendingUp size={14} /> Medium Volume</div>
                      <div className="flex flex-wrap gap-2">
                        {data.hashtags.medium?.map((tag: string) => (
                          <span onClick={() => copyToClipboard(tag)} key={tag} className="bg-white px-3 py-1.5 rounded-lg text-sm cursor-pointer shadow-sm hover:shadow-md hover:text-indigo-600 border border-amber-200 transition-all font-medium text-slate-700">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                      <div className="text-emerald-800 font-bold mb-2 flex items-center gap-2"><Hash size={14} /> Niche</div>
                      <div className="flex flex-wrap gap-2">
                        {data.hashtags.niche?.map((tag: string) => (
                          <span onClick={() => copyToClipboard(tag)} key={tag} className="bg-white px-3 py-1.5 rounded-lg text-sm cursor-pointer shadow-sm hover:shadow-md hover:text-indigo-600 border border-emerald-200 transition-all font-medium text-slate-700">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {platformTab === 'instagram' && data.instagram_safe && (
                    <div className="bg-pink-50 border border-pink-100 p-4 rounded-2xl">
                      <div className="text-pink-800 font-bold mb-2 flex items-center gap-2"><Camera size={14} /> Instagram-Safe (max 5)</div>
                      <div className="flex flex-wrap gap-2">
                        {data.instagram_safe.map((tag: string) => <span onClick={() => copyToClipboard(tag)} key={tag} className="bg-white px-3 py-1.5 rounded-lg text-sm cursor-pointer shadow-sm hover:shadow-md hover:text-indigo-600 border border-pink-200 transition-all font-medium text-slate-700">{tag}</span>)}
                      </div>
                    </div>
                  )}
                  {platformTab === 'tiktok' && data.tiktok_trending && (
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                      <div className="text-white font-bold mb-2 flex items-center gap-2"><Music size={14} /> TikTok Trending</div>
                      <div className="flex flex-wrap gap-2">
                        {data.tiktok_trending.map((tag: string) => <span onClick={() => copyToClipboard(tag)} key={tag} className="bg-slate-800 px-3 py-1.5 rounded-lg text-sm cursor-pointer shadow-sm hover:shadow-md hover:text-indigo-400 border border-slate-700 transition-all font-medium text-slate-200">{tag}</span>)}
                      </div>
                    </div>
                  )}
                  {data.seo_keywords && (
                    <div className="mt-8 bg-slate-100 p-5 rounded-2xl border border-slate-200">
                      <h4 className="font-extrabold text-slate-800 mb-3 text-lg">Social SEO Keywords</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.seo_keywords.map((kw: string, i: number) => <li key={i} className="text-slate-700 font-medium">{kw}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
