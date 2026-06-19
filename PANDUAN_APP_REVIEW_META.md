# 📘 Panduan Jitu Lolos Meta App Review & Verifikasi Bisnis

Dokumen ini berisi rangkuman strategi rahasia dan langkah praktis untuk menembus proses **Business Verification** dan **App Review** di Dasbor Developer Meta, khususnya bagi *developer* individu atau UMKM yang tidak memiliki entitas PT/CV atau dokumen tagihan rumah.

---

## 🏗️ 1. Strategi Lolos Verifikasi Bisnis (Tanpa PT/CV)

Meta mewajibkan semua *Business App* untuk diverifikasi. Jika Anda bekerja sendiri (solo *developer*) atau merintis dari kos/kantor orang lain, ikuti jalur ini:

### A. Dapatkan Legalitas Instan (NIB Perorangan)
Anda tidak perlu mendaftarkan PT atau CV yang mahal. Gunakan sistem pemerintah:
1. Buka situs [OSS Indonesia](https://oss.go.id/).
2. Buat akun dan pilih skala usaha **UMK (Usaha Mikro Kecil) - Perorangan**.
3. Isi data diri menggunakan KTP dan nomor telepon aktif.
4. Pilih bidang usaha yang umum (contoh: *Jasa Pembuatan Web*, *Pemrograman*, atau *Perdagangan Eceran*).
5. Terbitkan **Sertifikat NIB (Nomor Induk Berusaha)**. Dokumen PDF ini adalah bukti sah legalitas bisnis Anda di mata hukum dan Meta internasional.

### B. Siapkan Dokumen Pembuktian Alamat (Tanpa Tagihan Listrik)
Meta sering meminta tagihan listrik/air atas nama Anda untuk mencocokkan alamat tempat tinggal. Jika Anda tinggal di mess kantor atau kos, gunakan alternatif perbankan:
1. **e-Statement (Rekening Koran):** Buka aplikasi *Mobile Banking* Anda (BCA, Mandiri, Jenius, Jago, dll) dan *download* mutasi rekening bulanan berbentuk PDF.
2. Pastikan di bagian atas (Kop) PDF tersebut tercetak **Nama Lengkap** dan **Alamat** yang persis sama dengan KTP dan NIB Anda.
3. *Tips Keamanan:* Anda diizinkan untuk menyensor (mencoret hitam) nominal saldo dan riwayat transaksi pada PDF tersebut. Meta hanya ingin melihat kop surat, logo bank, nama, dan alamat Anda.
4. NPWP Pribadi juga dapat digunakan sebagai dokumen pendukung alternatif.

### C. Proses Pengajuan di Dasbor Meta
- Saat diminta nama bisnis, masukkan nama yang tertera di NIB.
- *Upload* KTP dan NIB sebagai dokumen identitas perusahaan.
- *Upload* e-Statement Bank sebagai dokumen bukti alamat.
- Gunakan domain kustom (contoh: `.web.id`, `.com`, atau `.co.id`). **Jangan gunakan domain gratisan** seperti `.vercel.app` atau `.gmail.com`.

---

## 🎥 2. Strategi Lolos App Review (Permissions)

Untuk mendapatkan izin kelas berat seperti `pages_messaging` dan `instagram_manage_messages`, Anda harus meyakinkan *Reviewer* (Manusia asli dari Meta).

### A. Persiapan "Sandbox" (Lingkungan Uji Coba)
- Buat 1 akun email dan *password dummy* di dalam aplikasi DigiMar Anda.
- Siapkan instruksi berbahasa Inggris langkah demi langkah cara login menggunakan akun *dummy* tersebut.

### B. Membuat Video *Screencast* yang Tidak Bisa Dibantah
Video adalah penentu utama (durasi 2-4 menit). Rekam adegan berikut secara berurutan:
1. **Login OAuth:** Rekam layar Anda mengklik tombol "Login with Facebook" di DigiMar dan tunjukkan *popup* persetujuan (otorisasi) dari Facebook.
2. **Pengujian Inbox Masuk:** Sorot layar HP Anda yang sedang mengirim DM ke Instagram target, lalu langsung sorot layar komputer Anda yang menunjukkan pesan tersebut masuk secara *real-time* ke dasbor DigiMar.
3. **Pengujian Balasan:** Ketik balasan dari dasbor DigiMar di komputer, lalu sorot layar HP Anda yang menunjukkan balasan tersebut diterima di aplikasi Instagram.

> [!WARNING]
> Reviewer Meta tidak peduli seberapa bagus UI Anda. Mereka **WAJIB** melihat bukti visual bahwa data dari API Meta benar-benar ditarik dan ditampilkan/digunakan di dalam aplikasi Anda!

### C. Menulis Justifikasi (Alasan Permintaan Izin)
Gunakan pendekatan B2B (Fokus pada manfaat bagi entitas bisnis klien):
> *"Aplikasi kami adalah B2B Omni-channel platform. Kami menggunakan izin `instagram_manage_messages` agar klien kami (UMKM) dapat mengonsolidasikan dan membalas ribuan pesan masuk dari berbagai saluran ke dalam satu dasbor terpadu kami secara efisien tanpa harus berpindah-pindah aplikasi."*

---

> [!TIP]
> Tetap bersabar! Seringkali pengajuan pertama ditolak karena alasan kecil. Jika ditolak, baca komentar dari *reviewer* baik-baik, perbaiki video/dokumen Anda, dan langsung *submit* ulang!
