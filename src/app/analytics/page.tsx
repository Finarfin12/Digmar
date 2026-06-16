export default function Analytics() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-gray-900">Analytics</h2>
        <p className="text-gray-500 mt-1">Performa konten dan statistik jadwal.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-64 flex items-center justify-center text-gray-400">
          Grafik Performa
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-64 flex items-center justify-center text-gray-400">
          Waktu Posting Terbaik
        </div>
      </div>
    </div>
  );
}
