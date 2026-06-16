import { PlusCircle } from "lucide-react";

export default function Planner() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Planner</h2>
          <p className="text-gray-500 mt-1">Jadwal konten dan antrean posting.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
          <PlusCircle size={20} />
          <span>Jadwalkan Post</span>
        </button>
      </header>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 min-h-[500px] flex items-center justify-center text-gray-400">
        Kalender interaktif akan ditampilkan di sini.
      </div>
    </div>
  );
}
