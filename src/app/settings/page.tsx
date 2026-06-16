export default function Settings() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-gray-900">Pengaturan</h2>
        <p className="text-gray-500 mt-1">Manajemen unit bisnis, akun sosial, dan AI provider.</p>
      </header>
      
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold border-b pb-3 mb-4">Unit Bisnis</h3>
          <p className="text-gray-500 text-sm">Daftar unit bisnis Anda.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold border-b pb-3 mb-4">Akun Sosial</h3>
          <p className="text-gray-500 text-sm">Hubungkan ke Instagram dan Threads.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold border-b pb-3 mb-4">AI Provider</h3>
          <p className="text-gray-500 text-sm">Konfigurasi Groq, OpenAI, Anthropic, dan model VPS lokal.</p>
        </div>
      </div>
    </div>
  );
}
