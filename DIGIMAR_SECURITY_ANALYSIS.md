# DigiMar Automation – Security & Stability Analysis

**Tanggal:** 2026-06-25  
**Proyek:** DigiMar Automation (Next.js 16 + Supabase)  
**Tujuan:** Identifikasi kritikalitas keamanan, stabilitas, dan kualitas kode serta memberikan rekomendasi perbaikan terukur.

---


## Ringkasan Eksekutif

Audit kode menunjukkan fondasi yang kuat (RLS, enkripsi pgcrypto, abstraksi provider) tetapi terdapat **9 masalah kritis** yang mencegah fungsionalitas inti (terutama publishing Instagram) dan membuka celah keamanan serius. Jika tidak segera diperbaiki, proyek tidak siap untuk produksi.

## Masalah Kritikal (Harus Diperbaiki Sekarang)

| No | Masalah | Lokasi | Dampak | Perbaikan |
|----|---------|--------|--------|-----------|
| 1 | **Instagram Publishing Broken – Platform Name Mismatch** | `src/lib/social/types.ts`, `src/lib/social/publisher.ts`, `supabase/migrations/00000000000000_init.sql` | Semua post Instagram gagal silenziously karena nilai enum `'instagram'` tidak cocok dengan constraint DB (`'meta_ig'`). | Sinkronkan enum: ubah `types.ts` dan `publisher.ts` menjadi `'meta_ig'` **atau** tambahkan `'instagram'` ke constraint DB. |
| 2 | **Instagram API Endpoint Salah** | `src/lib/social/instagram.ts` line 7 | Menggunakan `graph.instagram.com/v25.0` (Basic Display) yang tidak mendukung publishing. Harus `graph.facebook.com/v25.0`. | Ganti base URL menjadi `https://graph.facebook.com/v25.0`. |
| 3 | **CRON_SECRET Authentication Bypass** | `src/app/api/publish/process/route.ts` lines 5‑8 | Jika `CRON_SECRET` tidak di‑set (placeholder), pengecekan auth dilewati → siapa saja bisa memicu `processQueue()`. | Ganti kondisi menjadi: `if (!process.env.CRON_SECRET || authHeader !== \`Bearer ${process.env.CRON_SECRET}\`)`. |
| 4 | **PostScheduler Crash – Non‑null Assertion on Null** | `src/components/planner/PostScheduler.tsx` lines 180‑182 | `mediaFile` tidak di‑set saat memilih galeri, menyebabkan `mediaFile!.size` me‑throw dan crash render. | Ganti dengan `mediaFile?.size` atau set `mediaFile` dalam `selectFromGallery()`. |
| 5 | **SSRF via `/api/ai/models`** | `src/app/api/ai/models/route.ts` lines 13‑23 | Pengguna bisa mengirimkan `base_url` arbitrari (mis. `http://169.254.169.254/`) untuk memindai jaringan internal. | Terapkan whitelist domain (`groq.com`, `openai.com`, `openrouter.ai`, `api.anthropic.com`) dan blokir rentang IP pribadi (RFC1918, link‑local, dsb). |
| 6 | **Service Role Client Bypass RLS** | `src/lib/supabase/service.ts` | `createServiceClient()` menggunakan `SUPABASE_SERVICE_ROLE_KEY` yang melewati seluruh RLS. Jika digunakan di route lain, data semua user terekspos. | Tambah komentar `@danger`, ubah nama menjadi `createDangerousServiceClient()`, atau batasi via ESLint rule agar hanya dipakai di file yang sah. |
| 7 | **Units GET Tidak Di‑scope ke User** | `src/app/api/units/route.ts` lines 9‑15 | Query `.from('business_units').select('*')` tanpa filter `user_id`. Meskipun RLS aktif di DB, sebaiknya defense‑in‑depth. | Tambah `.eq('user_id', user.id)` untuk konsistensi dengan endpoint lain seperti `posts/route.ts`. |
| 8 | **.env.local Semua Nilai Placeholder** | `.env.local` | Semua kunci kunci (ENCRYPTION_KEY, CRON_SECRET, API key) masih placeholder → fungsi enkripsi/gagal, auth bypass. | Isi nilai sebenarnya (generate acak 32‑byte untuk ENCRYPTION_KEY, 16‑byte untuk ENCRYPTION_SALT, dan secret yang kuat untuk CRON_SECRET). |
| 9 | **.gitignore Blokir File Kritial** | `.gitignore` | Pola `*.md` dan `supabase/**/*.sql` mencegah komit dokumentasi dan migrasi DB → risiko hilangnya sejarah dan tidak dapat reproducir skema. | Hapus kedua pola tersebut dari `.gitignore`. |


## Kerentanan Keamanan Tinggi (Harus Diperbaiki Sebelum Produksi)

| No | Masalah | Lokasi | Dampak | Perbaikan |
|----|---------|--------|--------|-----------|
| 10 | **Middleware Skip Auth untuk Semua `/api/*`** | `src/middleware.ts` line 31 | Beberapa API route tidak memiliki auth check sama sekali (mis. `/api/ai/models` – jugaSSRF). | Hapus komentar yang menySkip auth, atau tambahkan logika auth spesial untuk endpoint yang memang public (webhook). |
| 11 | **Tidak Ada Rate Limiting** | – | Endpoint AI (`/api/ai/caption`, `/api/ai/trends`) bisa di‑spam → habis kreditan AI; login page rentan brute‑force. | Tambah middleware rate limiting (mis. `@upstash/ratelimit` atau Vercel Edge RL). |
| 12 | **Login Page Bukan SSR Auth Pattern** | `src/app/auth/login/page.tsx` lines 18‑21 | Menggunakan `createBrowserClient()` langsung di komponen – bekerja tetapi tidak mengikuti best practice `@supabase/ssr`. | Ganti dengan pendekatan SSR (middleware + `createServerComponentClient`). |
| 13 | **Units GET Tanpa User Filter** (lihat #7 di atas) | – | – | – |
| 14 | **JSON Parse AI Error – Hilang Raw Content** | `api/ai/caption/route.ts` lines 53‑56; `api/ai/trends/route.ts` lines 87‑91 | Log mentah hanya di server; respons pengguna tidak menunjukkan detail error → sulit debug tanpa akses log. | Sertakan snippet respons (dengan censure data sensitif) dalam response error atau log terstruktur yang terlihat. |
| 15 | **Publisher Optimistic Locking – Silent Fail** | `src/lib/social/publisher.ts` lines 19‑26 | Konflik cron di‑handle dengan `continue` tanpa log → tidak terdeteksi seberapa sering terjadi. | Tambah log saat `lockError` terjadi (mis. `console.warn` atau struktur logging). |
| 16 | **Reels Polling Block Queue 50 Detik** | `src/lib/social/instagram.ts` lines 47‑56 | Loop blocking mencegah proses post lain selama menunggu reel selesai. | Gunakan background job atau non‑blocking polling (mis. menggunakan job queue atau webhook). |


## Masalah Kualitas & Teknis

| No | Masalah | Dampak | Rekomendasi |
|----|---------|--------|-------------|
| 17 | **8 Library Ter‑install Tapi Tidak Digunakan** (`@dnd‑kit/*`, `@tanstack/react-query`, `sonner`, `react‑markdown`, `sweetalert2‑react‑content`) | Menambah bundle size dan kompleksitas. | Hapus dari `package.json` jika memang tidak digunakan, atau mulai gunakan sesuai kebutuhan. |
| 18 | **Duplikasi 95% di 3 Provider File** (`groq.ts`, `openai.ts`, `vps.ts`) | ~80 baris duplikasi → risiko inkonsistensi. | Ekstrak kelas generik `OpenAICompatibleClient({baseURL, apiKey, model, timeout?})`. |
| 19 | **Settings Page – 531 Baris Monolitik** | Sulit dipelihara, rebah pada bug. | Pisahkan menjadi komponen tab: `UnitsTab.tsx`, `SocialTab.tsx`, `AITab.tsx`. |
| 20 | **PostScheduler – 420 Baris, Tight Coupling ke Supabase** | Sulit diuji, logika tercampur. | Ekstrak `MediaGallery.tsx`, `CaptionGenerator.tsx`, pindahkan panggilan Supabase ke custom hook. |
| 21 | **30+ Penggunaan `any` di TypeScript** | Mengalahkan tujuan type safety. | Ganti dengan interface/typedef yang tepat (lihat tabel di AUDIT_KODE.md). |
| 22 | **Tidak Ada `React.memo` di Komponen Utama** | Re‑render tidak perlu, terutama Sidebar dan Chart. | Tambah `React.memo` atau gunakan `useMemo`/`useCallback`. |
| 23 | **Dashboard 4 Parallel Fetch Setiap Mount Tanpa Cache** | Berat pada server dan lambat UI. | Manfaatkan `@tanstack/react-query` atau implementasi sederhana dengan `useSWR`/`swr`. |
| 24 | **`@fullcalendar` Dimuat Secara Eager (~500 KB)** | Membebani bundle awal. | Gunakan dynamic import: `dynamic(() => import('...'), { ssr: false })`. |
| 25 | **Missing Security Headers** (CSP, X‑Frame‑Options, dll.) | Membuka risiko click‑jacking, XSS, dsb. | Tambah middleware atau konfigurasi di `next.config.ts` (mis. `next-headers` atau plugin). |
| 26 | **Tidak Ada `updated_at` Auto‑Update Trigger** | Bergantung pada aplikasi untuk men‑set kolom; rentan tidak ter‑update. | Tambahkan trigger di database atau gunakan extension `moddatetime`. |


## Rencana Prioritas Perbaikan

### Blok 1 – Bug Kritikal (0‑3 jam)
1. Sinkronkan nama platform Instagram (`types.ts`, `publisher.ts`, constraint DB).
2. Perbaiki endpoint Instagram API (`graph.facebook.com`).
3. Perbaiki logika `CRON_SECRET` check.
4. Guard `mediaFile?.size` di `PostScheduler`.

### Blok 2 – Keamanan Tinggi (3‑6 jam)
5. Terapkan whitelist domain + blokir IP pribadi di `/api/ai/models`.
6. Tambah `.eq('user_id', user.id)` ke `/api/units/route`.
7. Aktifkan rate limiting (mulai dengan endpoint AI dan login).
8. Isi nilai sebenarnya di `.env.local` (ENCRYPTION_KEY, ENCRYPTION_SALT, CRON_SECRET, API keys).
9. Hapus pola `*.md` dan `supabase/**/*.sql` dari `.gitignore`.

### Blok 3 – Hardening & Quality (6‑12 jam)
10. Perbaiki middleware auth agar tidak melewatkan API yang seharusnya dilindungi.
11. Ganti layanan Supabase service dengan nama berperingatan atau batasi penggunaannya.
12. Tambah logging untuk optimistic lock dan reels polling.
13. Perbaiki error handling AI untuk menyertakan cuplikan response.
14. Non‑blocking reels polling (gunakan background job atau webhook).

### Blok 4 – Refactor & Optimisasi (1‑2 hari)
15. Hapus dependensi tidak použíkan atau mulai manfaatkan.
16. Gabungkan tiga provider client menjadi satu kelas generik.
17. Bagi `settings/page.tsx` menjadi komponen tab terpisah.
18. Bagi `PostScheduler.tsx` menjadi komponen lebih kecil + hook Supabase.
19. Ganti penggunaan `any` dengan tipe yang tepat.
20. Tambahkan `React.memo` di komponen yang dire‑render sering.
21. Manfaatkan `@tanstack/react-query` atau SWR untuk data fetching.
22. Gunakan dynamic import untuk `@fullcalendar`.
23. Tambahkan security headers (CSP, X‑Frame‑Options, dll.).
24. Tambahkan trigger `updated_at` atau gunakan `moddatetime` extension.

### Blok 5 – Dokumentasi & Pelatihan (Opsional)
25. Perbarui `README.md` dengan panduan setup `.env` dan proses deploy.
26. Tambahkan dokumentasi arsitektur (ARN diagram) ke `docs/`.
27. Buat checklist pre‑deploy yang mencakup semua poin di atas.


## Kesimpulan

Fondasi teknis DigiMar Automation sudah solid (RLS, enkripsi, abstraksi provider). Namun, sejumlah **bug kritis** dan **kecelakaan keamanan** saat ini mencegah sistem berfungsi secara aman dan dapat diandalkan. Dengan menyelesaikan prioritas di atas—terutama menyinkronkan nama platform, memperbaiki endpoint Instagram, menutup bocoran auth CRON_SECRET, dan mencegah SSRF—proyek akan segera siap untuk tahap pengujian dan produksi. Selanjutnya, perbaikan kualitas kode dan optimisasi akan meningkatkan keandalan, keamanan, dan pengalaman pengguna pada jangka panjang.

---  
*Disarankan untuk melakukan code review ulang setelah setiap batch perbaikan, serta menjalankan kembali audit keamanan (mis. dengan nástroj seperti npm audit, Snyk, atau Trivy) sebelum merilis ke produksi.*