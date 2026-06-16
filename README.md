# DigiMar Automation Hub

DigiMar adalah platform automasi sosial media tingkat lanjut yang dibangun di atas Next.js dan Supabase. Sistem ini dilengkapi dengan integrasi Multi-AI Provider (Groq, OpenAI, Anthropic, VPS) untuk otomatisasi pembuatan *caption* dan analisis tren, serta mesin publikasi terjadwal ke Instagram dan Threads.

## Arsitektur

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Lucide React
- **Backend API**: Next.js Route Handlers
- **Database**: Supabase PostgreSQL (menggunakan RLS dan pgcrypto)
- **Authentication**: Supabase SSR (Cookies)
- **AI Processing**: Abstraksi Factory Pattern untuk berbagai LLM
- **Publisher Engine**: Meta Graph API (Instagram & Threads) + Vercel Cron

## Cara Instalasi

1. Klon repositori ini.
2. Jalankan `npm install` untuk menginstal dependensi.
3. Salin file `.env.local.example` ke `.env.local` (buat jika belum ada) dan isi dengan kredensial Supabase serta kunci enkripsi (32 karakter acak).
4. Buat tabel dan *database schema* dengan menjalankan SQL pada `supabase/migrations/00000000000000_init.sql` di SQL Editor Supabase Anda.
5. Jalankan aplikasi di mode lokal: `npm run dev`.

## Panduan Penggunaan (Workflow)

1. **Setup Unit Bisnis**: Masuk ke menu Pengaturan dan daftarkan unit bisnis (misalnya "Divisi Marketing A").
2. **Setup Akun Sosial**: Masih di Pengaturan, tambahkan akun Instagram Anda. *Access Token* Meta Anda akan dienkripsi secara otomatis di database menggunakan algoritma AES-256-GCM tingkat *server*.
3. **Setup AI**: Atur kunci API AI Anda (misalnya Groq) sebagai mesin *generator* *caption*.
4. **Jadwalkan Konten**: Melalui Dashboard atau Planner, unggah foto/video. AI akan secara otomatis memunculkan usulan *caption*.
5. **Cron Scheduler**: Secara otomatis, layanan eksternal (misal: cron-job.org) akan memanggil endpoint `/api/publish/process` setiap 5/10 menit untuk mengambil antrean posting dan meneruskannya ke Instagram.

## Deployment ke Vercel

1. Hubungkan repositori GitHub ini ke Vercel.
2. Atur semua *Environment Variables* di *Dashboard* Vercel (samakan dengan isi `.env.local`).
3. (Opsional) Jika menggunakan Vercel Cron, konfigurasikan `vercel.json`. Alternatif gratis adalah menggunakan [cron-job.org](https://cron-job.org) dengan menembak *endpoint*:
   `GET https://[domain-anda].vercel.app/api/publish/process`
   Pastikan Anda menambahkan *Header*: `Authorization: Bearer [CRON_SECRET_ANDA]`.

## Lisensi
Hak Cipta (c) DigiMar Hub.
