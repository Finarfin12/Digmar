# 🚀 Roadmap & Backlog Fitur DigiMar Automation

Dokumen ini berisi daftar ide fitur baru dan pengembangan (enhancements) untuk platform DigiMar Automation agar menjadi *tool digital marketing* berskala *enterprise*.

## 📌 Prioritas Jangka Pendek (Segera Dikerjakan)

- [x] **Integrasi Provider AI OpenRouter**
  - Mengimplementasikan `lib/ai/providers/openrouter.ts` agar sistem dapat menggunakan berbagai model LLM (seperti Claude, Llama, Gemini) hanya dengan satu API Key.
  - Memperbarui sistem *Factory Pattern* (`factory.ts`) untuk memuat *provider* baru ini.

- [x] **Fase 3: *News-Jacking* & *Seasonal Prediction***
  - Integrasi API Berita Gratis (misal: GNews API / NewsData.io) sebagai *data-feeder* untuk AI.
  - AI dapat merekomendasikan ide konten yang *relatable* dengan berita *viral* hari ini, kondisi cuaca, atau hari libur nasional (konteks tanggal & musim).

## 🤖 Otomatisasi & Media Sosial

- [x] **AI Smart Auto-Reply (Komentar & DM)**
  - Melanjutkan implementasi dari database (`00000000000003_autoreply.sql`).
  - Membangun *endpoint* khusus (contoh: di `/api/webhooks/meta`) yang bisa membaca sentimen pesan masuk dan memberikan respons cerdas secara otomatis menggunakan AI tanpa campur tangan admin.

- [ ] **Ekspansi Multi-Platform**
  - Menyelesaikan integrasi TikTok *Publisher* (skema DB sudah tersedia).
  - Menambahkan *support* untuk **Facebook Pages** dan **Twitter/X** (membuat modul `lib/social/facebook.ts` & `lib/social/twitter.ts`).

## 📈 Peningkatan Pemasaran & Analitik

- [ ] **Hashtag & Keyword Generator Engine**
  - Modul penelitian khusus di halaman *Planner* untuk mencari tagar (*hashtag*) yang sedang tren berdasarkan volume pencarian, bukan hanya mengandalkan tebakan LLM.

- [ ] **Competitor Spy (Analisis Kompetitor)**
  - Fitur analitik di mana pengguna bisa mendaftarkan akun kompetitor (Instagram/TikTok).
  - Sistem melacak secara berkala (cron job): frekuensi *posting* kompetitor dan interaksi (Likes/Comments) tertinggi mereka untuk dipelajari polanya.

## 👥 Tim & Manajemen Konten

- [ ] **Approval Workflow (Alur Persetujuan Tim)**
  - Dukungan kolaborasi *multi-user* (Agensi).
  - Status postingan memiliki alur: `Draft` ➡️ `Menunggu Persetujuan Manajer` ➡️ `Disetujui` ➡️ `Terjadwal/Publish`.

- [ ] **Advanced Media Manager**
  - Menambahkan fitur *in-app image editing* sederhana di bagian *Media Library*.
  - Fungsionalitas dasar seperti *crop* (potong rasio 1:1, 4:5, 9:16), filter, atau *watermark* logo otomatis sebelum *publish*.
