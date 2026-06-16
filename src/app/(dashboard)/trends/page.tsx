"use client";
import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Hash, Zap, Loader2, Newspaper, ChevronRight } from "lucide-react";
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';

export default function Trends() {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [trends, setTrends] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUnits(data);
          if (data.length > 0) setSelectedUnit(data[0].id);
        }
      });
  }, []);

  const generateTrends = async () => {
    if (!selectedUnit) return Swal.fire('Error', 'Pilih Unit Bisnis terlebih dahulu', 'error');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/trends', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_unit_id: selectedUnit })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghasilkan tren');
      setTrends(data);
      Swal.fire({ title: 'Berhasil!', text: 'Laporan tren harian berhasil dianalisis oleh AI.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err: unknown) {
      Swal.fire('Error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            Trend Analyzer <Sparkles className="text-amber-500 animate-pulse" size={28} />
          </h2>
          <p className="text-slate-600 mt-2 font-medium text-lg">Analisis berita harian dan ide konten musiman spesifik untuk bisnis Anda.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <select 
            value={selectedUnit} 
            onChange={e => setSelectedUnit(e.target.value)}
            className="w-full md:w-64 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-slate-50 cursor-pointer"
          >
            {units.length === 0 && <option value="" disabled>Belum ada Unit Bisnis</option>}
            {units.map(u => <option key={u.id} value={u.id}>{u.brand_name}</option>)}
          </select>

          <button onClick={generateTrends} disabled={loading || !selectedUnit} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100 whitespace-nowrap">
            {loading ? <Loader2 className="animate-spin" size={20}/> : <Zap size={20} className="fill-white" />}
            <span>{loading ? 'Menganalisis...' : 'Analisis Tren Hari Ini'}</span>
          </button>
        </div>
      </header>
      
      {!trends && !loading ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center">
          <TrendingUp className="mx-auto text-slate-400 mb-4" size={64} />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Mulai Analisis Tren</h3>
          <p className="text-slate-500">Klik tombol di atas untuk memerintahkan AI membaca berita terbaru hari ini dan mencari ide konten yang sedang viral.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center space-y-4">
          <Loader2 className="mx-auto animate-spin text-amber-500" size={64}/>
          <h3 className="text-xl font-bold text-slate-800">Menarik Data dari Google News...</h3>
          <p className="text-slate-500">AI sedang membaca berita Indonesia terkini dan mencocokkannya dengan kategori bisnis Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Kolom Kiri: Berita Real-time & Topik Utama */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-slate-700 shadow-lg p-6 text-white relative overflow-hidden group">
              <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:rotate-12 transition-transform duration-700"><Sparkles size={150}/></div>
              <h3 className="text-amber-400 font-extrabold mb-1 relative z-10 text-sm uppercase tracking-wider">Topik Utama Hari Ini</h3>
              <p className="font-bold text-lg leading-relaxed relative z-10 text-slate-100">
                "{trends.topik_utama_hari_ini}"
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 h-full">
              <h3 className="text-lg font-extrabold flex items-center gap-2 mb-4 text-slate-900">
                <Newspaper className="text-blue-600" /> Sumber Berita Hari Ini
              </h3>
              <div className="space-y-3">
                {trends.berita_sumber?.map((berita: string, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm font-medium text-slate-700 leading-snug">
                    {berita}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-4 text-center font-bold">Sumber: Google News Indonesia RSS</p>
            </div>
          </div>

          {/* Kolom Kanan: Ide Konten AI */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 px-2">
              <Sparkles className="text-amber-500" /> Ide Konten Spesifik Bisnis Anda
            </h3>
            
            <div className="grid gap-4">
              {trends.ide_konten?.map((ide: { judul: string, tipe: string, deskripsi: string, format: string }, i: number) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 transform origin-bottom scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
                  
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                          Ide {i + 1}
                        </span>
                        <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-lg border border-indigo-100">
                          Format: {ide.format}
                        </span>
                      </div>
                      <h4 className="text-xl font-extrabold text-slate-900 mb-2">{ide.judul}</h4>
                      <p className="text-slate-600 font-medium leading-relaxed">{ide.deskripsi}</p>
                    </div>
                    
                    <div className="shrink-0 pt-2 md:pt-0">
                      <button 
                        onClick={() => router.push('/planner')}
                        className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                      >
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
    </div>
  );
}
