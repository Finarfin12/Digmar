import { ArrowRight, PlusCircle, Sparkles, Activity, Clock, BarChart3 } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-indigo-900 to-blue-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        {/* Abstract shapes for premium feel */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400 opacity-10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3"></div>
        
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight">Selamat Datang di DigiMar</h2>
          <p className="text-blue-200 mt-2 text-lg">Pusat kontrol AI untuk dominasi sosial media Anda.</p>
        </div>
        <button className="relative z-10 bg-white text-indigo-900 hover:bg-blue-50 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
          <PlusCircle size={20} />
          <span>Buat Postingan Baru</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-all group">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Clock size={24} />
          </div>
          <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Antrean Post</div>
          <div className="text-5xl font-black text-slate-800 mt-2 mb-4">12</div>
          <Link href="/planner" className="text-blue-600 text-sm font-semibold flex items-center gap-1 group-hover:text-blue-700 transition-colors">
            Lihat Jadwal di Planner <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-all group">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BarChart3 size={24} />
          </div>
          <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Post Berhasil</div>
          <div className="text-5xl font-black text-slate-800 mt-2 mb-4">45</div>
          <div className="text-emerald-600 text-sm font-semibold flex items-center gap-1">
            <Activity size={16} /> +12% dari bulan lalu
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 backdrop-blur-xl p-6 rounded-2xl border border-indigo-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-all relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-indigo-100 group-hover:rotate-12 transition-transform opacity-50">
            <Sparkles size={120} />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Sparkles size={24} className="animate-pulse" />
            </div>
            <div className="text-indigo-800 text-sm font-bold uppercase tracking-wider mb-2">AI Assistant Status</div>
            <div className="text-3xl font-black text-indigo-900 mt-2">Groq Aktif</div>
            <div className="text-indigo-600 text-sm mt-3 font-medium bg-white/50 inline-block px-3 py-1 rounded-full">
              Model: llama-3.3-70b
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          Aktivitas Terkini
        </h3>
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
            <Clock size={32} />
          </div>
          <p className="text-slate-500 font-medium">Belum ada aktivitas cron terbaru.</p>
          <p className="text-slate-400 text-sm mt-1">Sistem akan mencatat log saat konten berhasil diposting.</p>
        </div>
      </div>
    </div>
  );
}
