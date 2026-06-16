import { useState } from 'react';
import { Search, Copy, Loader2, Hash, X } from 'lucide-react';
import Swal from 'sweetalert2';

interface HashtagData {
  hashtags?: {
    high?: string[];
    medium?: string[];
    niche?: string[];
  };
  seo_keywords?: string[];
}

export default function HashtagModal({ onClose }: { onClose: () => void }) {
  const [topic, setTopic] = useState('');
  const [selectedSource, setSelectedSource] = useState('mixed');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HashtagData | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    setLoading(true);
    setData(null);
    try {
      const res = await fetch('/api/ai/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, preferred_provider: 'groq', source: selectedSource }) // Default provider
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({ title: 'Disalin!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
  };

  const copyAllHashtags = () => {
    if (!data?.hashtags) return;
    const all = [
      ...(data.hashtags.high || []),
      ...(data.hashtags.medium || []),
      ...(data.hashtags.niche || [])
    ].join(' ');
    copyToClipboard(all);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Hash className="text-indigo-600" /> AI Hashtag & Keyword Engine
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 bg-white p-2 rounded-full shadow-sm"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 text-slate-900">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2 mb-8">
            <input 
              type="text" 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Masukkan topik, misal: 'Kopi Susu Gula Aren'" 
              className="flex-1 p-4 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 text-lg font-medium"
            />
            <select 
              value={selectedSource} 
              onChange={e => setSelectedSource(e.target.value)}
              className="p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 bg-slate-50 cursor-pointer"
            >
              <option value="mixed">Campur Semua</option>
              <option value="youtube">YouTube Search</option>
              <option value="newsdata">Berita Global</option>
            </select>
            <button disabled={loading} type="submit" className="bg-indigo-600 text-white px-8 py-4 md:py-0 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition">
              {loading ? <Loader2 className="animate-spin" /> : <Search />} Cari
            </button>
          </form>

          {data && data.hashtags && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-lg">Hasil Generator:</h4>
                <button onClick={copyAllHashtags} className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm hover:bg-indigo-100">
                  <Copy size={16} /> Salin Semua Hashtag
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
                  <div className="text-red-800 font-bold mb-2 flex items-center gap-2">🔥 High Volume</div>
                  <div className="flex flex-wrap gap-2">
                    {data.hashtags.high?.map(tag => (
                      <span onClick={() => copyToClipboard(tag)} key={tag} className="bg-white px-3 py-1.5 rounded-lg text-sm cursor-pointer shadow-sm hover:shadow-md hover:text-indigo-600 border border-red-200 transition-all font-medium text-slate-700">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                  <div className="text-amber-800 font-bold mb-2 flex items-center gap-2">⚡ Medium Volume</div>
                  <div className="flex flex-wrap gap-2">
                    {data.hashtags.medium?.map(tag => (
                      <span onClick={() => copyToClipboard(tag)} key={tag} className="bg-white px-3 py-1.5 rounded-lg text-sm cursor-pointer shadow-sm hover:shadow-md hover:text-indigo-600 border border-amber-200 transition-all font-medium text-slate-700">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                  <div className="text-emerald-800 font-bold mb-2 flex items-center gap-2">🎯 Niche (Low)</div>
                  <div className="flex flex-wrap gap-2">
                    {data.hashtags.niche?.map(tag => (
                      <span onClick={() => copyToClipboard(tag)} key={tag} className="bg-white px-3 py-1.5 rounded-lg text-sm cursor-pointer shadow-sm hover:shadow-md hover:text-indigo-600 border border-emerald-200 transition-all font-medium text-slate-700">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              {data.seo_keywords && (
                <div className="mt-8 bg-slate-100 p-5 rounded-2xl border border-slate-200">
                  <h4 className="font-extrabold text-slate-800 mb-3 text-lg">Social SEO Keywords (Sisipkan di Caption)</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {data.seo_keywords.map((kw, i) => (
                      <li key={i} className="text-slate-700 font-medium">{kw}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
