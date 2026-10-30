import React, { useEffect, useState } from 'react';
import { Loader2, Beaker, Trophy, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

export default function ABTestAnalytics({ unitId }: { unitId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchABTests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/analytics/ab-test?business_unit_id=${unitId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json.data || []);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unitId) {
      fetchABTests();
    }
  }, [unitId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
        <Loader2 className="animate-spin text-fuchsia-600 mb-4" size={48} />
        <p className="font-bold text-slate-600">Menganalisis hasil A/B Test...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200 flex items-center gap-3">
        <AlertCircle size={24} />
        <p className="font-bold">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 flex flex-col items-center">
        <div className="w-20 h-20 bg-fuchsia-100 text-fuchsia-600 rounded-full flex items-center justify-center mb-4">
          <Beaker size={36} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Belum ada A/B Test</h3>
        <p className="text-slate-500 max-w-md text-center">Buat A/B Test dari halaman Planner dengan mengklik tombol &quot;A/B Test Mode&quot; untuk membandingkan 2 gaya postingan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-fuchsia-50 p-4 rounded-2xl border border-fuchsia-200 text-fuchsia-900">
        <div className="flex items-center gap-3">
          <Beaker size={24} />
          <div>
            <h3 className="font-extrabold text-lg">A/B Testing Lab</h3>
            <p className="text-sm font-medium opacity-80">Menampilkan simulasi perbandingan performa varian postingan.</p>
          </div>
        </div>
        <button onClick={fetchABTests} className="p-2 bg-white rounded-xl shadow-sm hover:shadow hover:bg-slate-50 transition-all text-fuchsia-700">
          <RefreshCw size={20} />
        </button>
      </div>

      {data.map((test, index) => (
        <div key={test.ab_test_id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
            <div className="font-bold text-slate-700 flex items-center gap-2">
              <span className="bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded">Test #{data.length - index}</span>
              Dibuat: {new Date(test.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
            </div>
            {test.status_a === 'waiting' && test.status_b === 'waiting' && (
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">Menunggu Penayangan</span>
            )}
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Variant A */}
              <div className={`p-5 rounded-2xl border-2 transition-all ${test.winner === 'A' ? 'border-emerald-400 bg-emerald-50/30 shadow-md shadow-emerald-100' : 'border-slate-200'}`}>
                {test.winner === 'A' && (
                  <div className="absolute -mt-8 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Trophy size={14} /> Pemenang
                  </div>
                )}
                <div className="flex gap-4">
                  {test.variant_a.image ? (
                    <img src={test.variant_a.image} alt="A" className="w-24 h-24 rounded-xl object-cover border border-slate-200" />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">No Image</div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-black text-slate-800 mb-2">Varian A</h4>
                    <p className="text-xs text-slate-600 italic mb-4 line-clamp-3">{test.variant_a.caption_snippet}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                        <span className="block text-slate-500 text-[10px] uppercase font-bold">Likes</span>
                        <span className="font-black text-slate-800">{test.variant_a.metrics.likes}</span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                        <span className="block text-slate-500 text-[10px] uppercase font-bold">Comments</span>
                        <span className="font-black text-slate-800">{test.variant_a.metrics.comments}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variant B */}
              <div className={`p-5 rounded-2xl border-2 transition-all ${test.winner === 'B' ? 'border-emerald-400 bg-emerald-50/30 shadow-md shadow-emerald-100' : 'border-slate-200'}`}>
                {test.winner === 'B' && (
                  <div className="absolute -mt-8 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Trophy size={14} /> Pemenang
                  </div>
                )}
                <div className="flex gap-4">
                  {test.variant_b.image ? (
                    <img src={test.variant_b.image} alt="B" className="w-24 h-24 rounded-xl object-cover border border-slate-200" />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">No Image</div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-black text-slate-800 mb-2">Varian B</h4>
                    <p className="text-xs text-slate-600 italic mb-4 line-clamp-3">{test.variant_b.caption_snippet}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                        <span className="block text-slate-500 text-[10px] uppercase font-bold">Likes</span>
                        <span className="font-black text-slate-800">{test.variant_b.metrics.likes}</span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                        <span className="block text-slate-500 text-[10px] uppercase font-bold">Comments</span>
                        <span className="font-black text-slate-800">{test.variant_b.metrics.comments}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Conclusion */}
            <div className="mt-6 bg-gradient-to-r from-indigo-50 to-fuchsia-50 rounded-2xl p-5 border border-indigo-100/50">
              <h4 className="text-sm font-extrabold text-indigo-900 mb-2 flex items-center gap-2">
                <TrendingUp size={16} className="text-fuchsia-600" />
                Kesimpulan AI
              </h4>
              <p className="text-indigo-950 font-medium text-sm leading-relaxed">
                {test.ai_conclusion}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
