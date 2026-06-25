# Arsitektur AI Agent & Playwright: Competitor Spy

Dokumen ini berisi rangkuman *brainstorming* mengenai potensi penggunaan AI Agent yang mengendalikan *headless browser* (Playwright) untuk memonitor akun sosial media kompetitor secara otonom.

## 🌟 Kekuatan & Keunggulan
Menggunakan Playwright + AI memberikan keuntungan yang tidak bisa didapatkan jika hanya mengandalkan API resmi Meta/TikTok:
1. **Bebas Batasan API**: Bisa membaca angka *followers*, *likes*, dan membedah profil kompetitor mana pun tanpa butuh izin akses (API resmi umumnya melarang keras menarik data kompetitor).
2. **Analisis Kontekstual & Visual (Vision AI)**: AI tidak hanya mengumpulkan data angka, tapi bisa menangkap tangkapan layar (*screenshot*) konten terbaru kompetitor. Vision AI (seperti GPT-4o) dapat menyimpulkan: *"Apakah kompetitor sedang menjalankan kampanye promo akhir tahun?", "Bagaimana estetika warna yang mereka gunakan hari ini?"*
3. **Membaca "Tone of Voice"**: Agent bisa membaca kumpulan *caption* kompetitor secara utuh, lalu memberikan wawasan sentimen (contoh: *"Kompetitor X sedang aktif menggunakan gaya komunikasi edukatif minggu ini."*).

## ⚠️ Tantangan Utama (Bottleneck)
Sistem otomatisasi *browser* memiliki tingkat kesulitan yang tinggi dalam fase implementasi dan perawatannya:
1. **Sistem Anti-Scraping Platform**: Instagram dan TikTok sangat ketat terhadap *bot*. Jika Playwright berjalan dari *server cloud* standar tanpa penyamaran, koneksi akan diblokir (mendapat *captcha* atau blokir IP).
2. **Limitasi Lingkungan Serverless (Vercel)**: Agen AI dan Playwright memerlukan waktu eksekusi bermenit-menit. Ini tidak cocok dijalankan di *Serverless Functions* Vercel yang memiliki batas waktu (timeout) 10-60 detik.
3. **Biaya & Penggunaan Resource**: Menjalankan *browser* memakan banyak RAM, ditambah biaya pemrosesan token *Vision AI* untuk membedah halaman HTML atau *screenshot*.

## ⚙️ Desain Arsitektur Ideal
Agar fitur *Competitor Spy* ini dapat berjalan dengan stabil dan cepat di sisi pengguna, arsitekturnya harus dipisahkan menjadi sistem **Asynchronous Background Job**:

### 1. Infrastruktur Khusus (Worker Server)
Jangan gunakan Vercel. Gunakan VPS mandiri (seperti DigitalOcean) atau layanan otomatisasi awan khusus (*Browserbase*, *Apify*) untuk menampung instansi Playwright.

### 2. Rotasi Proxy Residensial (Residential Proxies)
Playwright harus diarahkan menggunakan koneksi *residential proxy* dan modul *stealth* agar jaringan meta mendeteksi trafik sebagai koneksi manusia/rumahan biasa.

### 3. Eksekusi Background (Cron Jobs)
Hindari eksekusi Playwright saat pengguna memuat halaman (karena akan *loading* sangat lama). 
**Alur kerjanya:**
- **Pukul 02:00 Pagi**: *Cron Job* membangunkan AI Agent.
- **Scraping**: Agent menavigasi ke URL daftar kompetitor, menggulir layar, mengambil tangkapan gambar, dan menyalin struktur teks (*caption*).
- **Sintesis Data**: Data dipompa ke LLM untuk dirangkum menjadi JSON terstruktur (Metrik, Ringkasan Strategi, *Tone of Voice*).
- **Penyimpanan**: JSON diunggah ke dalam *database* (Supabase).

### 4. Dasbor Pengguna (Frontend DigiMar)
Saat pengguna membuka tab "Competitor Spy" di siang hari, sistem (Vercel) cukup menarik JSON bersih dari Supabase. Tidak ada proses *scraping* yang terjadi di siang hari. Waktu *loading* kurang dari 1 detik.

---
> **Kesimpulan:** Fitur ini sangat revolusioner dan dapat menjadi "Killer Feature" DigiMar yang membedakannya dari alat manajemen sosial media pasif. Fokus pengembangan terbesar akan berada pada penguatan **infrastruktur scraping** dan **manajemen proxy**, bukan pada UI dasbornya.
