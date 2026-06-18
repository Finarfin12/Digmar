# 🔐 LAPORAN AUDIT KEAMANAN & BUG — DigiMar Automation

**Tanggal Audit:** 18 Juni 2026  
**Project:** DigiMar Automation (Next.js 16 + Supabase + TypeScript)  
**Path:** `C:\antigravity\DigiMar automation`  
**Versi:** 0.1.0  
**Status:** Pre-production / Development  

---

## 📊 RINGKASAN EKSEKUTIF

| Kategori | Jumlah |
|----------|--------|
| 🔴 **Critical** | 13 |
| 🟠 **High** | 11 |
| 🟡 **Medium** | 25 |
| 🟢 **Low** | 10 |
| **TOTAL** | **59 temuan** |

---

## 🔴 CRITICAL (13 Temuan)

### C1. `accounts/[id]/DELETE` — Tidak ada verifikasi kepemilikan akun
**File:** `src/app/api/accounts/[id]/route.ts`  
Siapapun yang terautentikasi bisa menghapus `social_account` milik user lain hanya dengan menebak UUID `id`.

```ts
// ⚠️ Query saat ini:
supabase.from('social_accounts').delete().eq('id', id)
// Seharusnya:
supabase.from('social_accounts').delete().eq('id', id).eq('business_unit_id', ...)
```

---

### C2. `analytics/ab-test/GET` — Kebocoran data lintas user
**File:** `src/app/api/analytics/ab-test/route.ts`  
Parameter `business_unit_id` diterima tapi **tidak pernah digunakan** dalam query. Semua data A/B test dari **seluruh user** dikembalikan.

```ts
// ⚠️ business_unit_id divalidasi tapi tidak dipakai:
const { business_unit_id } = Object.fromEntries(url.searchParams);
// Query mengambil SEMUA post_queue dengan ab_test_id != null — tanpa filter user!
```

---

### C3. `inbox/route.ts GET` — Tidak ada verifikasi kepemilikan business unit
**File:** `src/app/api/inbox/route.ts`  
User mana pun bisa membaca semua `social_conversations` dari business unit mana pun.

---

### C4. `inbox/messages/GET` — Tidak ada verifikasi kepemilikan conversation
**File:** `src/app/api/inbox/messages/route.ts`  
User mana pun bisa membaca semua pesan dari conversation mana pun.

---

### C5. `inbox/ai-reply/POST` — Kebocoran full conversation history + pembakaran kredit AI
**File:** `src/app/api/inbox/ai-reply/route.ts`  
User bisa membaca seluruh riwayat percakapan dan memicu AI reply dari conversation milik user lain.

---

### C6. `queue/route.ts` (GET, POST, DELETE) — Tidak ada user scoping sama sekali
**File:** `src/app/api/queue/route.ts`  
Tabel `content_queue` tidak punya kolom `user_id` dan API tidak pernah memverifikasi kepemilikan. Semua item content queue bisa diakses/diubah/dihapus oleh user mana pun.

---

### C7. `queue/schedules/route.ts` — Tidak ada user scoping
**File:** `src/app/api/queue/schedules/route.ts`  
Tabel `posting_schedules` tidak punya kolom `user_id`. Semua jadwal posting global bisa diakses user mana pun.

---

### C8. `units/[id]/route.ts` (GET, PUT, DELETE) — Tidak ada verifikasi kepemilikan
**File:** `src/app/api/units/[id]/route.ts`  
Query hanya `.eq('id', id)` tanpa `.eq('user_id', user.id)`. Siapapun bisa membaca, mengubah, atau menghapus business unit milik user lain.

---

### C9. `webhooks/meta/POST` — Tidak ada verifikasi `X-Hub-Signature-256`
**File:** `src/app/api/webhooks/meta/route.ts`  
Webhook Meta tidak memverifikasi tanda tangan SHA-256. **Siapapun bisa mengirim event palsu**, memicu AI auto-reply, membakar kredit AI, dan posting ke akun Instagram target.

```ts
// ⚠️ Tidak ada pengecekan ini:
// const signature = request.headers.get('X-Hub-Signature-256')
// const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
```

---

### C10. `webhooks/meta/GET` — Hardcoded fallback verify token
**File:** `src/app/api/webhooks/meta/route.ts`  
```ts
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'digimar_secret_token_123'
```
Token verifikasi memiliki fallback hardcoded yang trivial ditebak.

---

### C11. Enkripsi — Tidak ada Key Derivation Function (KDF)
**File:** `src/lib/crypto/server.ts`  
`ENCRYPTION_KEY` dari environment variable digunakan langsung sebagai kunci AES-256 **tanpa** PBKDF2/HKDF/Argon2. Jika user memakai string 32-karakter yang bisa dibaca manusia, entropinya jauh di bawah 256-bit.

```ts
// ⚠️ Kunci mentah langsung dipakai:
const key = Buffer.from(ENCRYPTION_KEY, 'utf8')  // 32 byte dari string
// Seharusnya:
// const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256')
```

---

### C12. Supabase Migration — `SECURITY DEFINER` tanpa `search_path`
**File:** `supabase/migrations/00000000000000_init.sql`  
Fungsi `encrypt_value()` dan `decrypt_value()` menggunakan `SECURITY DEFINER` tanpa `SET search_path = pg_catalog, pg_temp`. Ini adalah vektor SQL injection yang terdokumentasi di PostgreSQL.

```sql
-- ⚠️ Saat ini:
CREATE OR REPLACE FUNCTION encrypt_value(plaintext TEXT, enc_key TEXT)
RETURNS BYTEA AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seharusnya:
CREATE OR REPLACE FUNCTION encrypt_value(plaintext TEXT, enc_key TEXT)
RETURNS BYTEA
SET search_path = pg_catalog, pg_temp
AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### C13. Supabase Migration — `vision_api_key_encrypted` bertipe TEXT bukan BYTEA
**File:** `supabase/migrations/00000000000008_vision_ai.sql`  
Kolom bernama "encrypted" tapi menggunakan tipe `TEXT`, sedangkan semua kolom terenkripsi lain pakai `BYTEA`. Ini mengindikasikan **API key vision AI akan tersimpan dalam plaintext**.

---

## 🟠 HIGH (11 Temuan)

### H1. `ai/factory.ts` — Plaintext API key fallback bypass enkripsi
**File:** `src/lib/ai/factory.ts:23`  
Saat tidak ada provider di database, kode langsung membaca `process.env.GROQ_API_KEY` sebagai plaintext, melewati seluruh mekanisme enkripsi.

```ts
const apiKey = provider?.api_key_encrypted 
  ? decryptValue(provider.api_key_encrypted) 
  : process.env.GROQ_API_KEY  // ⚠️ plaintext bypass
```

---

### H2. `ai/factory.ts` — SSRF via user-configurable VPS `base_url`
**File:** `src/lib/ai/factory.ts:74-78`  
URL untuk provider VPS diambil dari database (dikonfigurasi user) tanpa validasi. User bisa mengarahkan ke `http://169.254.169.254/` (AWS metadata) atau IP internal.

---

### H3. `social/publisher.ts` — Tidak ada idempotensi publishing
**File:** `src/lib/social/publisher.ts`  
Jika worker crash setelah posting ke platform sosial media tapi **sebelum** update status di database, job yang sama bisa diproses ulang dan menghasilkan **double post**. Tidak ada idempotency key yang dikirim ke API platform (Meta/TikTok).

---

### H4. `supabase/service.ts` — `createServiceClient()` diekspor dari lib generik
**File:** `src/lib/supabase/service.ts`  
Fungsi dengan `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS) diekspor dari direktori `lib/` tanpa guard. Bisa tidak sengaja di-import dari client component.

---

### H5. `ai/models/POST` — Endpoint tanpa autentikasi
**File:** `src/app/api/ai/models/route.ts`  
Siapapun (termasuk yang tidak login) bisa menggunakan endpoint ini sebagai proxy untuk memeriksa model dari provider AI, berpotensi membakar kredit API.

---

### H6. Supabase Migration — Denormalisasi `user_id` tanpa constraint konsistensi
**File:** Migrasi `05_content_library`, `06_chatbot_rules`  
Tabel `media_assets`, `caption_templates`, `hashtag_banks`, `chatbot_rules` menyimpan **keduanya** `user_id` dan `business_unit_id`, tapi tidak ada CHECK constraint yang memastikan `user_id = (SELECT user_id FROM business_units WHERE id = business_unit_id)`. Bisa terjadi inkonsistensi data.

---

### H7. Supabase Storage — Tidak ada UPDATE policy
**File:** `supabase/migrations/00000000000001_storage.sql`  
Bucket `digimar-media` punya policy SELECT, INSERT, DELETE — tapi **tidak ada UPDATE**. User tidak bisa mengganti/replace media yang sudah diupload.

---

### H8. Multiple API routes — Tidak ada verifikasi kepemilikan `business_unit_id`
**File:** `ai/best-time`, `ai/trends`, `ai/caption`, `campaigns/generate`, `posts/autopilot`, `posts/ab-test`, `chatbot/rules`, `library/hashtags`, `library/captions`, `media/upload`  
Semua route ini memverifikasi bahwa user terautentikasi, tapi tidak memverifikasi bahwa `business_unit_id` yang diberikan adalah milik user tersebut.

---

### H9. `posts/route.ts POST` — `target_account_ids` tidak diverifikasi kepemilikannya
**File:** `src/app/api/posts/route.ts`  
User bisa menjadwalkan post ke `social_account` milik user lain dengan memberikan `target_account_ids` yang tidak dimilikinya.

---

### H10. Frontend — Tidak ada Content Security Policy
**File:** `next.config.ts`  
Konfigurasi Next.js benar-benar kosong. Tidak ada header: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`.

---

### H11. Frontend — Tidak ada CSRF protection
Semua `POST`/`PUT`/`DELETE` request dari client menggunakan `fetch()` tanpa CSRF token. Bergantung sepenuhnya pada SameSite cookie Supabase.

---

## 🟡 MEDIUM (25 Temuan)

### M1. `analytics/GET` — Decrypted access token di URL query string
**File:** `src/app/api/analytics/route.ts`  
Token Instagram yang sudah didekripsi disisipkan ke URL query string (`?access_token=...`). Meski tidak dikirim ke client, ini akan tercatat di server log Facebook/Meta.

---

### M2. `media/upload/POST` — Tidak ada validasi tipe file & batas ukuran
**File:** `src/app/api/media/upload/route.ts`  
User bisa upload file apa pun (`.html`, `.js`, `.exe`) ke bucket publik `digimar-media`. Tidak ada batasan ukuran — bisa menghabiskan storage.

---

### M3. `providers/route.ts POST` & `providers/vision/POST` — Tidak ada validasi `base_url`
**File:** `src/app/api/providers/route.ts`, `src/app/api/providers/vision/route.ts`  
Berbeda dengan `ai/models` yang punya whitelist domain, endpoint ini menerima URL apa pun — **risiko SSRF**.

---

### M4. `media/canvas/POST` — `logo_url` bisa dipakai untuk SSRF
**File:** `src/app/api/media/canvas/route.ts`  
Satori/ImageResponse mem-fetch `logo_url` yang diberikan user. Bisa diarahkan ke internal service.

---

### M5. `social/publisher.ts` — SELECT-then-UPDATE race condition
**File:** `src/lib/social/publisher.ts`  
Dua worker `processQueue()` yang berjalan bersamaan akan SELECT 5 job yang sama sebelum locking. Wastes resources dan bisa menyebabkan job tertunda.

---

### M6. `social/publisher.ts` — Tidak ada retry/backoff
**File:** `src/lib/social/publisher.ts`  
Job yang gagal langsung `status: 'failed'` permanen. Tidak ada retry count, exponential backoff, atau dead-letter queue.

---

### M7. `social/facebook.ts` & `social/instagram.ts` — Full error propagation ke database
**File:** `src/lib/social/facebook.ts`, `social/instagram.ts`, `social/tiktok.ts`  
Raw error message dari API Meta/TikTok disimpan di kolom `log_messages` JSONB tanpa sanitasi. Secara teori bisa mengandung data sensitif.

---

### M8. `social/instagram.ts` — Hardcoded polling timeout untuk Reels
**File:** `src/lib/social/instagram.ts:76-88`  
Polling status Reels: 10 iterasi × 5 detik = 50 detik total. Tidak ada backoff, tidak bisa dikonfigurasi.

---

### M9. `social/tiktok.ts` — Fallback `publish_id` hardcoded
**File:** `src/lib/social/tiktok.ts:42`  
```ts
data.data?.publish_id || data.data?.post_id || 'tiktok_pending_id'
```
String `'tiktok_pending_id'` adalah placeholder. Jika TikTok mengubah response shape, fake ID disimpan tanpa error.

---

### M10. `social/tiktok.ts` — Tidak ada polling status setelah upload
Berbeda dengan Instagram, TikTok tidak dipolling setelah upload. Job dianggap sukses meski upload mungkin gagal di sisi TikTok.

---

### M11. `utils/job-code.ts` — `Math.random()` tidak cryptographically secure
**File:** `src/lib/utils/job-code.ts`  
Job code hanya 4 karakter random + timestamp. Mudah ditebak jika dipakai untuk otorisasi.

---

### M12. Double hex encoding di enkripsi
**File:** `src/lib/crypto/server.ts:19-21`  
`Buffer.from(combined, 'utf8').toString('hex')` — encoding ganda menambah kompleksitas dan potensi bug.

---

### M13. Tidak ada key rotation untuk enkripsi
**File:** `src/lib/crypto/server.ts`  
Satu static key. Tidak ada versioning, tidak ada cara rotasi tanpa re-enkripsi semua data.

---

### M14. Supabase Migration — Missing CHECK pada `platform` di beberapa tabel
**File:** Migrasi `04_competitors`, `11_inbox`  
`competitor_tracking.platform` dan `social_conversations.platform` tidak punya CHECK constraint. Bisa menerima nilai arbitrer.

---

### M15. Supabase Migration — `social_conversations.ai_sentiment` tidak ada CHECK
**File:** Migrasi `00000000000011_inbox.sql`  
Komentar di SQL mencantumkan nilai valid (`positif`, `negatif`, `netral`, `keluhan`, `tanya_harga`) tapi tidak ada constraint.

---

### M16. Supabase Migration — Tidak ada UNIQUE constraint untuk mencegah duplikat
5 tabel tidak punya UNIQUE constraint pada kombinasi kunci bisnis:
- `competitor_tracking` (`user_id, handle, platform`)
- `caption_templates` (`user_id, business_unit_id, title`)
- `chatbot_rules` (`business_unit_id, trigger_keyword`)
- `posting_schedules` (`business_unit_id, day_of_week, time_of_day`)
- `social_conversations` (`account_id, platform, customer_id, type`)

---

### M17. Supabase Migration — Tidak ada `updated_at` trigger di semua tabel
Lebih dari 10 tabel punya kolom `updated_at` tapi **tidak ada** trigger otomatis. Harus di-set manual di setiap UPDATE.

---

### M18. Supabase Migration — Beberapa tabel tidak punya `updated_at`
`posting_schedules`, `content_queue`, `media_assets`, `competitor_tracking`, `social_messages` punya `created_at` tapi tidak punya `updated_at`.

---

### M19. Supabase Migration — Double-join RLS di `social_messages`
**File:** Migrasi `00000000000011_inbox.sql`  
Setiap akses ke `social_messages` butuh join melalui `social_conversations` → `business_units`. Bisa jadi bottleneck performa.

---

### M20. Supabase Migration — `ab_test_id` tidak ada FK
**File:** Migrasi `00000000000010_ab_testing.sql`  
Kolom `ab_test_id` di `post_queue` tidak mereferensi tabel A/B test manapun. Tidak ada tabel `ab_tests` yang dibuat.

---

### M21. Frontend — `middleware.ts` mengecualikan API routes dari auth
**File:** `src/middleware.ts:32`  
Middleware hanya memproteksi page routes. Endpoint API harus melakukan auth sendiri. Tidak ada defense-in-depth jika salah satu endpoint lupa.

---

### M22. Frontend — Tidak ada AbortController pada fetch requests
Semua `fetch()` di `useEffect` tidak punya cleanup. Rapid navigation bisa menyebabkan race condition dan memory leak.

---

### M23. Frontend — Hardcoded external image URLs
**File:** `src/app/(dashboard)/inbox/page.tsx:135`, `src/components/planner/PostScheduler.tsx:190`  
Background image dari `i.pinimg.com` dan avatar dari `ui-avatars.com` di-hardcode. Tanpa CSP, ini membuka pintu untuk resource dari domain eksternal.

---

### M24. Frontend — `console.error(err)` di production path
**File:** ~30+ lokasi di semua page/component  
Error detail di-log ke browser console. Di production, ini bisa membocorkan struktur API dan stack trace.

---

### M25. `ai/factory.ts` — Tidak ada timeout untuk provider AI non-VPS
**File:** `src/lib/ai/factory.ts`  
Hanya VPS yang punya `timeout: 30000`. Groq/OpenAI/OpenRouter tidak punya timeout — request bisa hang permanen.

---

## 🟢 LOW (10 Temuan)

### L1. `.env.local` — Semua kredensial kosong / placeholder
**File:** `.env.local`  
Semua environment variable masih kosong atau placeholder. Ini normal untuk development, tapi harus dipastikan terisi sebelum production.

---

### L2. General — `err.message` langsung diekspos di response 500
Semua API endpoint mengembalikan `err.message` di response error. Bisa membocorkan detail internal.

---

### L3. General — Tidak ada rate limiting
Tidak ada rate limiting di endpoint manapun. Bisa dieksploitasi untuk brute force atau resource exhaustion.

---

### L4. General — Tidak ada Zod schema validation
Semua validasi input adalah pengecekan presence manual (`if (!field)`). Tidak ada schema validation library yang digunakan.

---

### L5. Supabase Migration — Inkonsistensi `gen_random_uuid` vs `uuid_generate_v4`
Migrasi 04 pakai `gen_random_uuid()` sementara yang lain pakai `uuid_generate_v4()`.

---

### L6. Supabase — `FOR ALL` policy memberi hak DELETE ke semua tabel
User bisa hard-delete data mereka sendiri tanpa soft-delete atau audit log.

---

### L7. Supabase Storage — Tidak ada validasi MIME type
User bisa upload file dengan tipe apa pun ke bucket publik.

---

### L8. Frontend — `dangerouslySetInnerHTML` (2 instance, hardcoded CSS)
**File:** `src/app/(dashboard)/planner/page.tsx`, `src/components/planner/ImageEditor.tsx`  
Keduanya adalah CSS statis, bukan user input — risiko rendah.

---

### L9. Frontend — `inbox/page.tsx`: Mock send (TODO)
**File:** `src/app/(dashboard)/inbox/page.tsx:107-123`  
"TODO: Connect to actual Send API" — tombol kirim pesan hanya mock/optimistic UI, tidak benar-benar mengirim.

---

### L10. `social/facebook.ts` — Field `ig_user_id` dipakai untuk Facebook Page ID
**File:** `src/lib/social/facebook.ts`  
Nama field menyesatkan: `ig_user_id` (seharusnya Instagram) dipakai untuk menyimpan Facebook Page ID. Bisa menyebabkan bug maintenance.

---

## 📋 REKOMENDASI PERBAIKAN — BERDASARKAN PRIORITAS

### 🔴 PRIORITAS 0 — Harus diperbaiki sebelum production

| # | Temuan | Perbaikan |
|---|--------|-----------|
| C1-C8 | **API tidak verifikasi kepemilikan data** | Tambahkan `eq('user_id', user.id)` atau join `business_units` di SEMUA query yang mengambil/mengubah data spesifik user |
| C9 | Webhook Meta tidak verifikasi signature | Tambahkan verifikasi `X-Hub-Signature-256` dengan HMAC-SHA256 |
| C10 | Hardcoded webhook verify token | Hapus fallback, throw error jika env var tidak ada |
| C11 | Tidak ada KDF untuk enkripsi | Gunakan PBKDF2/HKDF untuk derive kunci dari `ENCRYPTION_KEY` |
| C12 | SECURITY DEFINER tanpa search_path | Tambahkan `SET search_path = pg_catalog, pg_temp` ke fungsi PostgreSQL |
| C13 | vision_api_key_encrypted TEXT | Ubah ke `BYTEA` dan enkripsi via pgcrypto |
| H10 | Tidak ada CSP / security headers | Tambahkan `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS` |

### 🟠 PRIORITAS 1 — Perbaikan penting

| # | Temuan | Perbaikan |
|---|--------|-----------|
| H1 | Plaintext API key fallback | Hapus fallback ke `GROQ_API_KEY`, hapus hardcoded default provider/model |
| H2 | SSRF via VPS base_url | Tambahkan validasi URL: blokir private IP, whitelist domain pattern |
| H3 | Tidak ada idempotensi publishing | Tambahkan idempotency key dan `SELECT ... FOR UPDATE` di publisher |
| H4 | Service role client diekspor publik | Pindahkan ke direktori server-only, tambahkan eslint rule |
| H8 | Tidak verifikasi business_unit_id di puluhan route | Tambahkan join `business_units` untuk verifikasi `user_id` |

### 🟡 PRIORITAS 2 — Perbaikan dalam sprint berikutnya

| # | Temuan | Perbaikan |
|---|--------|-----------|
| M1-M9 | Social media integration improvements | Gunakan header Bearer (bukan query string), tambahkan retry + backoff, validasi response |
| M12-M13 | Enkripsi hardening | Sederhanakan hex encoding, rencanakan key rotation |
| M14-M20 | Database hardening | Tambahkan CHECK, UNIQUE constraints, updated_at trigger |
| M25 | Timeout AI provider | Tambahkan timeout ke semua provider |
| H11 | CSRF protection | Pastikan Supabase session cookie SameSite=Strict |
| M21 | Middleware exclude API | Pertimbangkan shared auth helper untuk consistency |

### 🟢 PRIORITAS 3 — Improvement jangka panjang

| # | Temuan | Perbaikan |
|---|--------|-----------|
| L2-L4 | Validasi & error handling | Implementasi Zod schema, centralized error handler, rate limiting |
| L9 | Mock send di inbox | Implementasi API kirim pesan sebenarnya |
| L7 | Storage validation | Tambahkan MIME type checking di storage policy |
| Semua | Monitoring | Tambahkan logging terstruktur dan alerting untuk anomali keamanan |

---

## 🔧 QUICK WINS (Bisa diperbaiki dalam 1 sesi)

1. **Tambahkan `eq('user_id', user.id)`** di seluruh API route yang saat ini tidak punya ownership check
2. **Verifikasi X-Hub-Signature-256** di webhook Meta
3. **Hapus hardcoded fallback** `'digimar_secret_token_123'` dan `''` (empty API key)
4. **Tambah security headers** di `next.config.ts`
5. **Fix `SET search_path = pg_catalog, pg_temp`** di fungsi PostgreSQL
6. **Ubah `vision_api_key_encrypted` ke BYTEA** dengan migration baru

---

## ✅ HAL POSITIF YANG SUDAH BAIK

- ✅ RLS diaktifkan di **semua 14 tabel** Supabase
- ✅ Token akses disimpan terenkripsi (BYTEA via pgcrypto) di database
- ✅ `access_token_encrypted` tidak pernah dikirim ke client (diganti `has_token: boolean`)
- ✅ Service role key hanya dipakai di `/webhooks` dan `/queue/process` (scoped dengan benar)
- ✅ SSRF protection di endpoint `/ai/models` dengan whitelist domain
- ✅ `CRON_SECRET` untuk otentikasi cron jobs
- ✅ Tidak ada hardcoded secret di client-side code
- ✅ Tidak ada localStorage/sessionStorage untuk data sensitif
- ✅ Semua user content di-render via JSX (auto-escaped)
- ✅ Cascade delete chain terstruktur dengan baik

---

## 📈 REKOMENDASI ARSITEKTUR

1. **Centralized authorization helper** — Buat fungsi `verifyOwnership(userId, businessUnitId)` yang dipakai di semua route
2. **API middleware pattern** — Pertimbangkan higher-order function untuk API handler yang otomatis inject auth check
3. **Audit logging** — Semua operasi destruktif (DELETE, update token, publish) sebaiknya dicatat ke tabel audit terpisah
4. **Encryption key management** — Gunakan Supabase Vault atau environment variable per-environment dengan rotasi berkala
5. **Automated security scanning** — Integrasikan dependency scanning (npm audit) dan SAST ke CI/CD pipeline

---

*Laporan dibuat oleh audit otomatis — semua temuan berbasis analisis kode statis. Disarankan untuk melakukan penetration testing dinamis sebelum production.*
