"use client";
import { useState } from 'react';
import { Target, Search, Loader2, Sparkles, Globe2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

interface SerpSpyProps {
  units: { id: string, brand_name: string, use_serpapi?: boolean }[];
}

export default function SerpSpy({ units }: SerpSpyProps) {
  const [handle, setHandle] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(units[0]?.id || '');
  const [platform, setPlatform] = useState('instagram');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Filter unique units
  const uniqueUnits = Array.from(new Map(units.map(item => [item.id, item])).values());
  const isEnabled = uniqueUnits.find(u => u.id === selectedUnit)?.use_serpapi;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    if (!isEnabled) {
      return Swal.fire('Akses Ditolak', 'Aktifkan SerpApi di menu Pengaturan untuk Unit Bisnis ini.', 'error');
    }

    const confirm = await Swal.fire({
      title: 'Gunakan Token Premium?',
      text: `Pencarian kompetitor @${handle} akan menggunakan 1 token SerpApi. Lanjutkan?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Analisis',
      cancelButtonText: 'Batal'
    });
    if (!confirm.isConfirmed) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/serpapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: selectedUnit,
          search_type: 'competitor',
          query: handle.replace('@', ''),
          platform
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Gagal mengambil data');
      setResult(data.data);
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="z-10 relative lg:w-1/2">
          <h3 className="text-2xl font-black flex items-center gap-2 mb-2"><Globe2 className="text-blue-400"/> SERP Spy (Google Search)</h3>
          <p className="text-blue-100 font-medium">Lacak jejak digital kompetitor Anda langsung dari mesin pencari Google. Temukan pola konten dan ringkasan strategi mereka menggunakan AI.</p>
        </div>
        
        <form onSubmit={handleSearch} className="z-10 relative flex flex-col sm:flex-row w-full lg:w-auto gap-3">
          <select 
            value={selectedUnit} 
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="p-3 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            {uniqueUnits.map(u => (
              <option key={u.id} value={u.id}>{u.brand_name} {u.use_serpapi ? '(Aktif)' : '(Nonaktif)'}</option>
            ))}
          </select>
          <select 
            value={platform} 
            onChange={(e) => setPlatform(e.target.value)}
            className="p-3 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="threads">Threads</option>
            <option value="facebook">Facebook</option>
          </select>
          <div className="relative w-full sm:w-auto flex-1">
            <span className="absolute left-4 top-3.5 text-slate-400 font-bold">@</span>
            <input 
              type="text" 
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="kompetitor" 
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button disabled={loading || !isEnabled} type="submit" className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold transition flex justify-center items-center gap-2 w-full sm:w-auto">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />} Cari
          </button>
        </form>
      </div>

      {!isEnabled && (
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-800">
            Unit Bisnis ini belum mengaktifkan fitur SerpApi. Silakan aktifkan terlebih dahulu di menu <strong>Pengaturan &gt; Pihak Ketiga (API)</strong>.
          </p>
        </div>
      )}

      {loading && (
        <div className="p-12 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={48}/>
          <p className="font-bold text-slate-600">Mencari jejak digital di Google...</p>
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-slate-700 shadow-lg p-6 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4"><Sparkles size={150}/></div>
              <h3 className="text-blue-400 font-extrabold mb-4 relative z-10 text-sm uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={16}/> AI Strategy Summary
              </h3>
              <div className="relative z-10 text-slate-100 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {result.ai_summary || 'Tidak ada ringkasan AI yang dihasilkan untuk pencarian ini.'}
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 px-2">
              <Globe2 className="text-blue-600" /> Hasil Pencarian Organik Google
            </h3>
            {result.organic_results && result.organic_results.length > 0 ? (
              result.organic_results.map((res: any, idx: number) => (
                <a 
                  key={idx} 
                  href={res.link} 
                  target="_blank" 
                  rel="noreferrer"
                  className="block bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
                >
                  <p className="text-sm text-blue-600 font-bold truncate mb-1">{res.link}</p>
                  <h4 className="text-lg font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors mb-2 leading-snug">
                    {res.title}
                  </h4>
                  <p className="text-slate-600 text-sm font-medium leading-relaxed">
                    {res.snippet}
                  </p>
                </a>
              ))
            ) : (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
                <p className="text-slate-500 font-bold">Tidak ada hasil pencarian yang ditemukan.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
