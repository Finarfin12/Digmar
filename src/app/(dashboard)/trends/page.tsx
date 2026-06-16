import { Sparkles, TrendingUp, Hash, Zap } from "lucide-react";

export default function Trends() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            Trend Insight <Sparkles className="text-amber-500 animate-pulse" size={28} />
          </h2>
          <p className="text-slate-500 mt-2 text-lg">Analisis cerdas dan ide konten musiman dari AI.</p>
        </div>
        <button className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm transform hover:scale-105">
          <Zap size={20} className="fill-amber-500" />
          <span>Generate Laporan Baru</span>
        </button>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800">
              <TrendingUp className="text-blue-500" /> Topik Populer Minggu Ini
            </h3>
            <div className="space-y-4">
              {['Tips Digital Marketing 2026', 'Trik Menggunakan AI untuk Bisnis', 'Strategi Reels Instagram Cepat Viral'].map((topic, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                  <span className="font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{topic}</span>
                  <button className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-bold">Buat Konten</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 shadow-sm p-8 relative overflow-hidden group">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700"><Sparkles size={150}/></div>
            <h3 className="text-xl font-bold text-amber-900 mb-4 relative z-10">Ide Konten Musiman</h3>
            <p className="text-amber-800 leading-relaxed relative z-10">
              Menjelang akhir tahun, tingkatkan *engagement* dengan mengadakan *giveaway* bertema resolusi tahun baru. Gunakan format Carousel untuk menceritakan perjalanan brand Anda selama tahun ini, dan akhiri dengan CTA (*Call to Action*) yang kuat.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-slate-800">
              <Hash className="text-pink-500" /> Rekomendasi Hashtag
            </h3>
            <div className="flex flex-wrap gap-2">
              {['#digitalmarketing', '#bisnisonline', '#tipsbisnis', '#marketing2026', '#ai', '#startupindo', '#contentcreator'].map((tag, i) => (
                <span key={i} className="bg-pink-50 text-pink-600 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-pink-100 cursor-pointer transition-colors border border-pink-100">
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
