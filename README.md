# DigiMar Automation Hub

DigiMar adalah platform automasi sosial media tingkat lanjut yang dibangun di atas Next.js dan Supabase. Sistem ini dilengkapi dengan integrasi Multi-AI Provider (Groq, OpenAI, Anthropic, VPS) untuk otomatisasi pembuatan *caption* dan analisis tren, serta mesin publikasi terjadwal ke Instagram dan Threads.

## Kebutuhan Environment Variables (Vercel & Lokal)

Sebelum melakukan *deploy* ke Vercel atau menjalankan secara lokal, Anda wajib mengatur *Environment Variables* berikut:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_ID].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR_SERVICE_ROLE_KEY]"

# Security & Encryption
# Wajib diisi dengan tepat 32 karakter acak (digunakan untuk mengenkripsi token Instagram)
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef" 

# Cron Authorization
# Token bebas buatan Anda sendiri untuk mengamankan API Cron
CRON_SECRET="KunciRahasiaCronDigiMar2026"

# Instagram Graph API
INSTAGRAM_API_VERSION="v25.0"

# Fallback AI (Opsional jika belum dikonfigurasi di DB)
DEFAULT_AI_PROVIDER="groq"
DEFAULT_AI_MODEL="llama-3.3-70b-versatile"
GROQ_API_KEY="gsk_..." 
```

## Tutorial Deploy ke Vercel

1. Buka [Vercel](https://vercel.com) dan buat *Project* baru.
2. *Import* repositori GitHub Anda (`Finarfin12/Digmar`).
3. Pada halaman konfigurasi sebelum klik "Deploy", buka menu **Environment Variables**.
4. Masukkan seluruh *keys* dan *values* dari *Environment Variables* di atas satu per satu.
5. Klik **Deploy** dan tunggu hingga selesai. Vercel akan memberikan domain publik untuk Anda (misalnya: `https://digmar.vercel.app`).

## Tutorial Setup cron-job.org

Agar aplikasi dapat mem-posting secara otomatis tanpa campur tangan Anda, kita menggunakan layanan gratis dari **cron-job.org**.

1. Buka [cron-job.org](https://cron-job.org/) dan buat akun / masuk.
2. Klik tombol **"Create cronjob"** di *dashboard* mereka.
3. Di kolom **URL**, masukkan endpoint *process* aplikasi Anda di Vercel:
   `https://[DOMAIN-VERCEL-ANDA].vercel.app/api/publish/process`
4. Pada bagian **Execution schedule**, atur sesuai keinginan Anda (direkomendasikan: setiap **5 menit** atau **10 menit**).
5. Centang / buka bagian **Advanced settings**.
6. Gulir ke bawah hingga menemukan bagian **HTTP Headers**.
7. Tambahkan *header* baru:
   - Header: `Authorization`
   - Value: `Bearer KunciRahasiaCronDigiMar2026` *(Pastikan value ini sama persis dengan variabel CRON_SECRET yang Anda pasang di Vercel, ditambah kata "Bearer " di depannya)*.
8. Simpan dengan mengklik **"Create"**.
9. Selesai! cron-job.org sekarang akan secara otomatis "memeriksa" antrean postingan di *database* Anda setiap beberapa menit dan meneruskannya ke Instagram secara otomatis.

## Panduan Penggunaan (Workflow Utama)

1. **Setup Unit Bisnis**: Masuk ke menu Pengaturan dan daftarkan unit bisnis (misalnya "Divisi Marketing A").
2. **Setup Akun Sosial**: Masih di Pengaturan, tambahkan akun Instagram Anda. *Access Token* Instagram Anda akan dienkripsi secara otomatis menggunakan AES-256-GCM.
3. **Setup AI**: Atur kunci API AI Anda (misalnya Groq) sebagai mesin *generator* *caption*.
4. **Jadwalkan Konten**: Melalui Dashboard atau Planner, unggah foto/video. AI akan secara otomatis memunculkan usulan *caption*, jadwalkan tanggal tayang, dan Cron akan menanganinya dari sana.

## Lisensi
Hak Cipta (c) DigiMar Hub.
