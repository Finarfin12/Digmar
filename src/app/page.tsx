import { ArrowRight, PlusCircle, Sparkles } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500 mt-1">Ringkasan aktivitas dan pembuatan konten baru.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
          <PlusCircle size={20} />
          <span>Buat Post Baru</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-gray-500 text-sm font-medium">Post Mengantre</div>
          <div className="text-4xl font-bold text-gray-900 mt-2">12</div>
          <Link href="/planner" className="text-blue-600 text-sm mt-2 flex items-center gap-1 cursor-pointer hover:underline inline-flex">
            Lihat Planner <ArrowRight size={14} />
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-gray-500 text-sm font-medium">Post Sukses (Bulan Ini)</div>
          <div className="text-4xl font-bold text-gray-900 mt-2">45</div>
          <div className="text-green-600 text-sm mt-2">+12% dari bulan lalu</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100">
          <div className="text-blue-800 text-sm font-medium flex items-center gap-2">
            <Sparkles size={16} /> AI Assistant Status
          </div>
          <div className="text-2xl font-bold text-indigo-900 mt-2">Groq Aktif</div>
          <div className="text-blue-600 text-sm mt-2">Model: llama-3.3-70b-versatile</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-4">Aktivitas Terkini</h3>
        <div className="text-center py-12 text-gray-400">
          Belum ada aktivitas. Silakan buat post baru untuk memulai.
        </div>
      </div>
    </div>
  );
}
