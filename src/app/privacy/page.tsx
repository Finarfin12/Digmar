import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black text-slate-900 mb-6">Kebijakan Privasi (Privacy Policy)</h1>
        
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-2">1. Pendahuluan</h2>
            <p>Selamat datang di DigiMar. Kami sangat menghargai privasi Anda dan berkomitmen untuk melindungi data pribadi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan menjaga informasi Anda saat menggunakan layanan omnichannel Smart Inbox kami.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-2">2. Informasi yang Kami Kumpulkan</h2>
            <p>Untuk menyediakan layanan Inbox dan Auto-Reply, kami mengumpulkan data yang dibagikan melalui platform terintegrasi (seperti Meta/Instagram), yang mencakup:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Nama pengguna (username) dan ID publik dari media sosial.</li>
              <li>Isi pesan Direct Message (DM) dan komentar yang ditujukan kepada akun bisnis Anda.</li>
              <li>Token akses (Access Token) yang Anda berikan secara sukarela untuk menghubungkan akun.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-2">3. Penggunaan Informasi</h2>
            <p>Informasi yang dikumpulkan murni digunakan untuk:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Menampilkan riwayat percakapan pelanggan di satu layar (Smart Inbox).</li>
              <li>Memproses balasan otomatis (AI Auto-Reply) sesuai pengaturan instruksi Anda.</li>
              <li>Tidak ada data pelanggan Anda yang dijual atau dibagikan ke pihak ketiga mana pun.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-2">4. Penghapusan Data Pengguna</h2>
            <p>Jika Anda atau pelanggan Anda ingin menghapus data percakapan yang tersimpan di sistem kami, Anda dapat melakukannya kapan saja dengan mengirimkan email permintaan penghapusan data ke admin kami atau langsung memutuskan koneksi aplikasi dari pengaturan Meta Anda. Kami akan menghapus seluruh data yang terkait secara permanen.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
