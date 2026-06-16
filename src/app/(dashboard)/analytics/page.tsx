import { BarChart2, TrendingUp, Users } from "lucide-react";
import AnalyticsChart from "@/components/analytics/Chart";

export default function Analytics() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Analytics Overview</h2>
          <p className="text-slate-500 mt-2">Lacak performa dan statistik akun sosial media Anda secara terpusat.</p>
        </div>
        <div className="hidden md:flex gap-3">
          <select className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium">
            <option>30 Hari Terakhir</option>
            <option>Bulan Ini</option>
            <option>Tahun Ini</option>
          </select>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 hover:shadow-lg transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">+5.2%</span>
          </div>
          <h3 className="text-slate-500 font-semibold mb-1">Total Followers</h3>
          <div className="text-3xl font-black text-slate-800">12,450</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 hover:shadow-lg transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">+12.4%</span>
          </div>
          <h3 className="text-slate-500 font-semibold mb-1">Engagement Rate</h3>
          <div className="text-3xl font-black text-slate-800">4.8%</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden group">
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:rotate-12 transition-transform"><BarChart2 size={120}/></div>
          <h3 className="text-indigo-200 font-medium mb-1 relative z-10">Waktu Posting Terbaik</h3>
          <div className="text-4xl font-black mt-2 mb-4 relative z-10">18:00</div>
          <p className="text-sm text-slate-300 relative z-10">Mayoritas audiens Anda aktif di jam sibuk sore hari.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
        <h3 className="text-xl font-bold text-slate-800 mb-2">Grafik Engagement</h3>
        <p className="text-slate-500 text-sm">Interaksi harian termasuk likes, comments, dan shares.</p>
        <AnalyticsChart />
      </div>
    </div>
  );
}
