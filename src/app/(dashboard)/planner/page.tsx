import { Calendar as CalendarIcon, PlusCircle, ChevronLeft, ChevronRight } from "lucide-react";

export default function Planner() {
  const days = Array.from({ length: 35 }, (_, i) => i + 1);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Content Planner</h2>
            <p className="text-slate-500 text-sm">Seret dan lepas jadwal postingan Anda.</p>
          </div>
        </div>
        <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all transform hover:scale-105 active:scale-95">
          <PlusCircle size={18} /> Buat Jadwal Baru
        </button>
      </header>
      
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-800">Agustus 2026</h3>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><ChevronLeft size={20}/></button>
            <button className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-800 font-medium transition-colors">Hari Ini</button>
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><ChevronRight size={20}/></button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => (
            <div key={day} className="py-3 text-center">{day}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 grid-rows-5 bg-slate-200 gap-px">
          {days.map((day, idx) => (
            <div key={idx} className="min-h-[120px] bg-white p-2 hover:bg-slate-50 transition-colors cursor-pointer group">
              <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${day === 16 ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 group-hover:bg-slate-200'}`}>
                {day > 31 ? '' : day}
              </div>
              
              {/* Mock Events */}
              {day === 12 && (
                <div className="mt-2 bg-amber-100 text-amber-800 text-xs font-semibold p-1.5 rounded border border-amber-200 truncate shadow-sm transition-transform hover:scale-105 cursor-grab">
                  10:00 Promosi Produk
                </div>
              )}
              {day === 16 && (
                <div className="mt-2 bg-emerald-100 text-emerald-800 text-xs font-semibold p-1.5 rounded border border-emerald-200 truncate shadow-sm transition-transform hover:scale-105 cursor-grab">
                  15:00 Edukasi Tips
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
