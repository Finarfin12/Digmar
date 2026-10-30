import { useState, useEffect } from 'react';
import { Target, Search, Trash2, TrendingUp, Users, Loader2, Heart, MessageCircle } from 'lucide-react';
import Swal from 'sweetalert2';

import { logger } from '@/lib/utils/logger'
export default function CompetitorSpy() {
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const fetchCompetitors = async () => {
    try {
      const res = await fetch('/api/competitors');
      if (res.ok) setCompetitors(await res.json());
    } catch (e) {
      logger.error(e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle) return;
    setLoading(true);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.replace('@', ''), platform: 'instagram' })
      });
      if (!res.ok) throw new Error(await res.text());
      setHandle('');
      fetchCompetitors();
      Swal.fire({ title: 'Berhasil!', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await Swal.fire({ title: 'Hapus kompetitor?', icon: 'warning', showCancelButton: true });
    if (!res.isConfirmed) return;
    await fetch(`/api/competitors?id=${id}`, { method: 'DELETE' });
    fetchCompetitors();
  };

  if (fetching) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="z-10 relative">
          <h3 className="text-2xl font-black flex items-center gap-2 mb-2"><Target className="text-pink-500"/> Competitor Spy</h3>
          <p className="text-slate-300 font-medium">Lacak performa akun rival untuk menemukan pola winning content di niche Anda.</p>
        </div>
        <form onSubmit={handleAdd} className="z-10 relative flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <span className="absolute left-4 top-3.5 text-slate-400 font-bold">@</span>
            <input 
              type="text" 
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="username_kompetitor" 
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-pink-500 outline-none"
            />
          </div>
          <button disabled={loading} type="submit" className="bg-pink-600 hover:bg-pink-500 text-white px-6 rounded-xl font-bold transition flex items-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />} Analisis
          </button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {competitors.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 font-medium bg-white rounded-3xl border border-slate-200">
            Belum ada kompetitor yang dilacak. Tambahkan satu untuk memulai.
          </div>
        ) : competitors.map(comp => (
          <div key={comp.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm relative group">
            <button onClick={() => handleDelete(comp.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={20} /></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-amber-500 flex items-center justify-center text-white font-black text-xl">
                {comp.handle.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-extrabold text-lg text-slate-900">@{comp.handle}</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{comp.platform}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1"><Users size={12}/> Followers</p>
                <p className="text-xl font-black text-slate-900">{(comp.metrics_json?.followers || 0).toLocaleString()}</p>
              </div>
              <div className="bg-pink-50 rounded-2xl p-4 border border-pink-100">
                <p className="text-pink-600 text-xs font-bold uppercase mb-1 flex items-center gap-1"><TrendingUp size={12}/> ER</p>
                <p className="text-xl font-black text-pink-700">{comp.metrics_json?.engagement_rate || '0%'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-extrabold text-slate-800 border-b pb-2">Top Performing Posts</p>
              <div className="space-y-3">
                {Array.isArray(comp.top_posts_json) && comp.top_posts_json.map((post: any, i: number) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 relative group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="bg-pink-100 text-pink-700 text-[10px] font-black px-2 py-0.5 rounded uppercase">Post {i + 1}</span>
                      <span className="font-extrabold text-pink-600 text-xs flex items-center gap-1"><Heart size={12}/> {(post.likes || 0).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed italic line-clamp-3">&ldquo;{post.caption || 'No caption'}&rdquo;</p>
                    {post.comments && <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase flex items-center gap-1"><MessageCircle size={10}/> {(post.comments || 0).toLocaleString()} Komentar</p>}
                  </div>
                ))}
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 font-bold mt-6 text-center">Diperbarui: {new Date(comp.last_scraped_at).toLocaleString('id-ID')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
