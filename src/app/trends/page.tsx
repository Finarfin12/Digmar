import { Sparkles } from "lucide-react";

export default function Trends() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          Trend Insight <Sparkles className="text-yellow-500" size={24} />
        </h2>
        <p className="text-gray-500 mt-1">Analisis tren terkini dan ide konten yang disarankan oleh AI.</p>
      </header>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 min-h-[400px] flex items-center justify-center text-gray-400">
        Pilih unit bisnis untuk memuat laporan tren mingguan.
      </div>
    </div>
  );
}
