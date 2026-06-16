# 🌐 Repositori Sumber Data Internet Gratis (API Alternatif)

Dokumen ini memuat daftar sumber data pihak ketiga dan API *free-tier* yang dapat dieksploitasi secara legal untuk mengambil informasi tren, sentimen audiens, dan berita internet secara *real-time* tanpa perlu berlangganan mahal. Data dari sumber-sumber ini sangat ideal untuk disuntikkan ke dalam sistem AI (LLM) sebagai konteks *live*.

---

## 1. Reddit JSON (Social Sentiment & Diskusi)
Reddit adalah tempat orang berdiskusi opini mentah secara nyata. Hebatnya, Reddit menyediakan akses JSON publik tanpa perlu *API Key* sama sekali.

- **URL Endpoint**: `https://www.reddit.com/search.json?q=[KATA_KUNCI]&sort=new`
- **Contoh Kasus Penggunaan**: Membaca sentimen orang terhadap merek "Kopi Susu". AI bisa mengekstrak teks keluhan atau pujian konsumen terbaru dan membuat ide konten yang langsung menjawab keluhan tersebut.
- **Biaya**: 100% Gratis (Terdapat *Rate Limit* ringan).

## 2. YouTube Data API v3 (Video Trends)
YouTube menyediakan API resmi yang sangat *powerful* dengan kuota gratis yang sangat besar.

- **Kapasitas Gratis**: 10.000 Unit Kuota / Hari.
- **Contoh Kasus Penggunaan**: Mencari 5 video paling viral hari ini terkait kata kunci tertentu. Sistem mengambil **Judul, Tags, dan Deskripsi** video tersebut, lalu menyuruh AI untuk me-*rewrite* ide video YouTube tersebut menjadi naskah (skrip) TikTok/Reels berdurasi 30 detik untuk pengguna.
- **Cara Akses**: Mendaftar gratis di Google Cloud Console.

## 3. Wikipedia API (Factual & Educational Content)
Sangat berguna untuk pembuatan konten bergaya *infografis* atau edukasi fakta.

- **URL Endpoint**: `https://id.wikipedia.org/w/api.php?action=query&prop=extracts&titles=[KATA_KUNCI]&format=json`
- **Contoh Kasus Penggunaan**: Ketika pengguna merencanakan kalender konten peringatan hari besar (misal: "Hari Pahlawan"), sistem memanggil API Wikipedia. AI menyaring paragraf sejarah dari Wikipedia menjadi *caption* Instagram yang ringkas, valid secara fakta, dan menarik.
- **Biaya**: 100% Gratis & *Open Source*.

## 4. DuckDuckGo Search / HTML Scraping (Web Browsing)
Karena mesin pencari utama (Google) memblokir keras upaya *scraping* pencarian standar tanpa membayar API SerpApi, *developer* sering menggunakan mesin alternatif.

- **Pendekatan**: Menggunakan *package* Node.js non-resmi (seperti `duckduckgo-search`) untuk mengekstrak 10 artikel web teratas yang mendiskusikan produk kompetitor.
- **Kekurangan**: Rawan diblokir jika *request* terlalu brutal. Harus diakses dari VPS / diatur *delay*-nya.

## 5. Aggregator Berita RSS (RSS Feeds)
Mayoritas raksasa media berita masih menyediakan standar RSS kuno yang sangat mudah diurai (di-*parse*) ke format JSON.

- **Sumber Lokal (Indonesia)**:
  - `https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id` (Google News ID)
  - `https://www.detik.com/rss` (Atau portal lainnya yang memfasilitasi XML/RSS).
- **Contoh Kasus Penggunaan**: Teknik **Newsjacking**. AI memantau RSS berita terkini, jika ada kejadian nasional, AI akan membuat *draft* postingan empati atau *meme* (jika sesuai karakter *brand*) dan memasukkannya ke dasbor rekomendasi tren.

---

> [!TIP]
> **Rekomendasi Arsitektur Masa Depan:**
> Saat aplikasi berkembang, sangat direkomendasikan untuk tidak menggantungkan semua fitur *fetching* pada satu API. Gabungkan setidaknya 2-3 sumber gratis di atas ke dalam fungsi `Promise.all()` di Next.js API Routes (seperti yang telah kita lakukan di `/api/ai/trends`). Jika API satu mati atau melampaui limit kuota harian, aplikasi masih memiliki sumber data cadangan dari API yang lain.
