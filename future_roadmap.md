# 🚀 Future Roadmap: DigiMar Fase 2

Dokumen ini berisi catatan dan ide untuk pengembangan fitur tingkat lanjut (Fase 2) dari DigiMar Automation, yang direncanakan ketika sistem sudah siap untuk monetisasi skala penuh atau kebutuhan enterprise yang lebih kompleks.

## 1. Integrasi Photorealistic Image AI Provider (Berbayar)

### Latar Belakang
Saat ini DigiMar menggunakan `Satori` (HTML-to-Image) yang 100% gratis, super cepat, dan sangat baik untuk membuat aset tipografi yang rapi secara instan (AI Canvas). Namun, ia memiliki keterbatasan dalam menghasilkan gambar fotorealistik seperti foto produk asli atau ilustrasi kompleks.

### Konsep Fitur
Menambahkan dukungan integrasi API untuk AI Image Generation pihak ketiga seperti:
- **DALL-E 3** (via OpenAI)
- **Stable Diffusion** (via Stability AI)
- **Leonardo AI** / **Midjourney API**

### Cara Kerja (Rencana Implementasi)
1. **Pengaturan Provider Baru (Settings):**
   - Menambahkan tab "Image AI Provider" di halaman Settings agar admin/user bisa memasukkan API Key khusus untuk generator gambar.
2. **Opsi Render di Planner & Auto-Pilot:**
   - Menambahkan *toggle* / saklar: **"Gunakan Render Realistis (Memotong Kuota API)"**.
   - Jika *toggle* dimatikan: Sistem menggunakan Satori (Gratis & Cepat).
   - Jika *toggle* dinyalakan: Sistem merangkai *prompt* gambar (misal: "Foto sinematik secangkir kopi...") dan memanggil API DALL-E, lalu mengunggah hasilnya ke Supabase Storage.

### Potensi Bisnis (Monetisasi)
Adanya 2 tipe rendering ini memungkinkan pemilik agensi (pengguna DigiMar) untuk membuat strategi *Pricing*:
- **Paket Standard:** Pelanggan mendapatkan desain infografis/kanvas berbasis warna dan tipografi (Gratis di sisi modal server).
- **Paket Premium:** Pelanggan mendapatkan gambar fotorealistik. Agensi dapat menagihkan margin harga yang lebih tinggi untuk menutupi biaya API gambar tersebut (berkisar Rp 500 - Rp 1.500 per *generate*).

---
*Catatan: Ide ini disimpan sebagai pengingat jangka panjang dan belum diimplementasikan pada basis kode saat ini.*
