# 🐛 LAPORAN BUG REGRESSION — DigiMar Automation

**Tanggal:** 18 Juni 2026  
**Project:** DigiMar Automation (Next.js 16 + Supabase + TypeScript)  
**Path:** `C:\antigravity\DigiMar automation`  
**Konteks:** Bug yang muncul dari perbaikan keamanan (migrations 12-18 + API hardening)

---

## 📊 RINGKASAN BUG

| Severity | Jumlah | Deskripsi |
|----------|--------|-----------|
| 🔴 **Critical** | 2 | Data corruption / encryption mismatch |
| 🟠 **High** | 8 | Production breakage / data loss / security regression |
| 🟡 **Medium** | 6 | Functional / performance issues |
| 🟢 **Low** | 4 | Minor / cosmetic |
| **TOTAL** | **20 bug** | |

---

## 🔴 CRITICAL (2)

### BUG-C1. Enkripsi TypeScript vs PostgreSQL tidak kompatibel — semua encrypted data tidak bisa dibaca
**File:** `src/lib/crypto/server.ts` vs `supabase/migrations/00000000000016_crypto_revert.sql`  
**Severity:** 🔴 CRITICAL — DATA CORRUPTION

Ada **dua sistem enkripsi paralel yang tidak kompatibel**:

| Layer | Algoritma | Key | Output |
|-------|-----------|-----|--------|
| PostgreSQL `encrypt_value()` (M00→M12→M16) | `pgp_sym_encrypt` | Raw `ENCRYPTION_KEY` string | PGP binary |
| TypeScript `encryptValue()` (`crypto/server.ts`) | `aes-256-gcm` + PBKDF2 | `ENCRYPTION_KEY` di-hash via PBKDF2 | `\x{hex}` format |

**Dampak:** Jika data dienkripsi via PostgreSQL function (`pgp_sym_encrypt`), TypeScript `decryptValue()` akan gagal dengan `"Invalid encrypted data format."` karena tidak bisa parse PGP binary sebagai format `iv:authTag:ciphertext`. **Sebaliknya juga berlaku** — jika TypeScript digunakan untuk enkripsi, PostgreSQL function tidak bisa mendekripsinya.

**Ini berarti SEMUA encrypted tokens di database tidak bisa dibaca oleh aplikasi.** Seluruh fitur yang bergantung pada `decryptValue()` (publishing, analytics, inbox AI reply) akan gagal.

**Fix:** Seragamkan ke satu sistem. Pilih salah satu:
- Semua enkripsi/dekripsi di TypeScript dengan `crypto/server.ts` (hapus PostgreSQL functions)
- Semua enkripsi/dekripsi di PostgreSQL via RPC calls (hapus TypeScript `decryptValue`)

---

### BUG-C2. Migration 16 (`crypto_revert`) — data yang dienkripsi antara M12→M16 tidak bisa didekripsi
**File:** `supabase/migrations/00000000000016_crypto_revert.sql`  
**Severity:** 🔴 CRITICAL — IRREVERSIBLE DATA CORRUPTION

Timeline algoritma enkripsi di migration:

```
M00 (init):    pgp_sym_encrypt  ✅
M12 (patch):   encrypt_iv/AES   ❌  (ganti algoritma)
M16 (revert):  pgp_sym_encrypt  ❌  (balik ke pgp — tapi data yang dienkripsi dengan encrypt_iv tetap ada)
```

**Data yang ditulis antara M12 dan M16 menggunakan `encrypt_iv` dengan hardcoded zero IV.** Saat M16 mengganti fungsi kembali ke `pgp_sym_decrypt`, data tersebut **tidak bisa didekripsi**. M16 tidak melakukan migrasi data (re-encrypt existing rows).

**Fix:** Buat migration yang:
1. Pertahankan `decrypt_value` dengan `encrypt_iv` sebagai temporary fallback
2. Decrypt dan re-encrypt semua affected rows
3. Setelah semua data termigrasi, baru ganti fungsi ke `pgp_sym_encrypt`

---

## 🟠 HIGH (8)

### BUG-H1. Rate limiter: header `x-forwarded-for` bisa di-spoof + shared bucket
**File:** `src/lib/utils/rate-limit.ts`  
**Severity:** 🟠 HIGH

```typescript
const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
```

- **Spoofing:** Attacker bisa mengirim header `x-forwarded-for` dengan IP random untuk bypass rate limit sepenuhnya. Setiap request bisa pakai IP berbeda.
- **Shared bucket:** Jika `x-forwarded-for` tidak ada (misal request langsung), semua user share bucket `127.0.0.1`. Satu user kena rate limit = semua user lain juga kena.
- **Memory leak:** `Map` tidak pernah dibersihkan. Di serverless cold start reset, tapi di container long-running memory bocor tanpa batas.

**Fix:** Validasi header (ambil IP pertama dari comma-separated list), tambahkan TTL/eviction, atau migrasi ke Redis/Upstash.

---

### BUG-H2. `Idempotency-Key` header tidak didukung oleh Meta & TikTok API
**File:** `src/lib/social/instagram.ts`, `facebook.ts`, `tiktok.ts`  
**Severity:** 🟠 HIGH

```typescript
headers['Idempotency-Key'] = idempotencyKey;
```

Header ini dikirim ke **semua** API call ke Meta Graph API dan TikTok API. **Kedua platform TIDAK mendokumentasikan dukungan untuk `Idempotency-Key` header.** Beberapa API gateway menolak unknown headers dengan **400 Bad Request**. Jika platform return 400:
1. Publisher retry dengan idempotency key yang **sama** → 400 lagi
2. `retry_count` increment → 3 kali retry → semua gagal
3. Job stuck permanent `status: 'failed'`

**Fix:** Hapus header `Idempotency-Key` dari social media API calls, atau implementasikan idempotensi di level aplikasi (cek `post_queue.log_messages` sebelum publish ulang).

---

### BUG-H3. `posts/route.ts` POST — tidak verifikasi kepemilikan `target_account_ids`
**File:** `src/app/api/posts/route.ts`  
**Severity:** 🟠 HIGH — CROSS-USER POSTING

POST handler memverifikasi user terautentikasi, tapi **tidak memverifikasi bahwa `target_account_ids` milik user tersebut**. User A bisa menjadwalkan post ke social account milik User B dengan menebak UUID.

```typescript
// Line ~60 — hanya fetch account info, tidak cek ownership:
const { data: accountInfo } = await supabase
  .from('social_accounts')
  .select('id, platform, ig_user_id')
  .eq('id', target_account_ids[0])
  .single()
// ❌ Tidak join business_units! Tidak cek user_id!
```

**Fix:** Tambahkan `business_units!inner(user_id).eq('business_units.user_id', user.id)` ke query di atas.

---

### BUG-H4. Migration 15 (`vision_key_bytea_fix`): `USING NULL` menghapus semua existing vision API key
**File:** `supabase/migrations/00000000000015_vision_key_bytea_fix.sql`  
**Severity:** 🟠 HIGH — DATA LOSS

```sql
ALTER TABLE ai_providers
ALTER COLUMN vision_api_key_encrypted TYPE BYTEA USING NULL;
--                                               ^^^^^^^^^
--                                     Semua value yang ada DIHAPUS
```

Jika ada user yang sudah mengkonfigurasi vision AI key antara M08 dan M15, key tersebut **hilang permanen**.

**Fix:** Ganti `USING NULL` dengan `USING convert_to(vision_api_key_encrypted, 'utf8')::bytea` (asumsi data masih plaintext), atau buat backup sebelum konversi.

---

### BUG-H5. Migration 14: tidak drop old storage policies (nama mismatch Indonesia vs Inggris)
**File:** `supabase/migrations/00000000000014_storage_mime_policy.sql`  
**Severity:** 🟠 HIGH — SECURITY REGRESSION

M14 mencoba drop old policies dengan nama **Inggris**:
```sql
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
```

Tapi M01 membuat policies dengan nama **Indonesia**:
```sql
"Semua orang bisa melihat media"   (SELECT)
"User login bisa mengunggah"        (INSERT) 
"User bisa menghapus medianya sendiri" (DELETE)
```

**DROP gagal (IF EXISTS = silent no-op). Hasil: 3 old policies (permissive) tetap aktif bersama 4 new policies (restricted). Karena policies di-OR, old permissive policies menang — MIME type restriction M14 tidak efektif sama sekali.**

**Fix:** Drop policies dengan nama Indonesia yang benar:
```sql
DROP POLICY IF EXISTS "Semua orang bisa melihat media" ON storage.objects;
DROP POLICY IF EXISTS "User login bisa mengunggah" ON storage.objects;
DROP POLICY IF EXISTS "User bisa menghapus medianya sendiri" ON storage.objects;
```

---

### BUG-H6. `error-handler.ts` swallow semua error — zero production observability
**File:** `src/lib/utils/error-handler.ts` + `src/lib/utils/logger.ts`  
**Severity:** 🟠 HIGH

Di production (`NODE_ENV !== 'development'`):
1. `logger.ts` suppress semua log — `if (isDevelopment)` guard
2. `error-handler.ts` return generic `"An unexpected internal server error occurred."` — tipe error, stack trace, message asli hilang semua
3. Tidak ada integrasi Sentry, Logtail, atau structured logging apapun

**Dampak:** Setiap error di production **tidak meninggalkan jejak apapun**. Debugging production issue = blind guesswork. Semua error (termasuk 4xx validation) jadi 500.

**Fix:** Kirim error ke external logging service, pertahankan original error message untuk 4xx, tambahkan error categorization.

---

### BUG-H7. Migration 18: `'instagram'` → `'meta_ig'` rename akan gagal jika ada existing data
**File:** `supabase/migrations/00000000000018_platform_constraints.sql`  
**Severity:** 🟠 HIGH — MIGRATION FAILURE

M04 mendefinisikan `competitor_tracking.platform` dengan `DEFAULT 'instagram'` — semua row yang dibuat dengan default tersebut nilainya `'instagram'`. M18 menghapus `'instagram'` dari CHECK constraint, menggantinya dengan `'meta_ig'`. **Saat M18 mencoba `ADD CONSTRAINT`, existing data dengan nilai `'instagram'` akan melanggar CHECK baru → migration gagal total → rollback.**

**Fix:** Tambahkan data migration SEBELUM constraint:
```sql
UPDATE competitor_tracking SET platform = 'meta_ig' WHERE platform = 'instagram';
UPDATE social_conversations SET platform = 'meta_ig' WHERE platform = 'instagram';
```

---

### BUG-H8. Migration 17: `ON DELETE CASCADE` dari `ab_tests` ke `post_queue` — unintended deletion
**File:** `supabase/migrations/00000000000017_ab_tests_fk.sql`  
**Severity:** 🟠 HIGH

```sql
FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE CASCADE;
```

`ON DELETE CASCADE` berarti menghapus `ab_tests` row → menghapus semua `post_queue` yang terkait. Delete chain:
```
auth.users → business_units → ab_tests → post_queue (SEMUA POSTS HILANG!)
```

Padahal `post_queue` tidak punya FK langsung ke `business_units` — deletion path ini **tidak terduga dan destruktif**.

**Fix:** Ubah ke `ON DELETE SET NULL`:
```sql
FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE SET NULL;
```

---

## 🟡 MEDIUM (6)

### BUG-M1. Enkripsi: static salt + tidak ada key rotation
**File:** `src/lib/crypto/server.ts:11`  
**Severity:** 🟡 MEDIUM

```typescript
const salt = process.env.ENCRYPTION_SALT || 'digimar-static-salt-v1'
```

- Salt hardcoded di source code — jika bocor, attacker bisa precompute rainbow table
- `ENCRYPTION_SALT` tidak didefinisikan di `.env.local` → fallback ke static
- Tidak ada key versioning — tidak bisa rotasi tanpa re-enkripsi semua data

### BUG-M2. Publisher: stuck `processing` jobs tidak pernah direcover
**File:** `src/lib/social/publisher.ts`  
**Severity:** 🟡 MEDIUM

Jika publish sukses ke platform tapi `supabase.update()` gagal (network blip), job tetap `status: 'processing'`. Query utama filter `eq('status', 'waiting')` — processing jobs jadi invisible forever. Tidak ada reaper/housekeeping.

### BUG-M3. Rate limiter thresholds terlalu ketat
**File:** `src/lib/utils/rate-limit.ts`  
**Severity:** 🟡 MEDIUM

| Endpoint | Limit | Terlalu ketat? |
|----------|-------|----------------|
| `ai-caption` | 5/min | ⚠️ Power user generate 1 caption per 12 detik |
| `ai-hashtags` | 5/min | ⚠️ Sama |
| `ai-trends` | 5/min | ⚠️ Sama |
| `campaigns-generate` | 3/min | ⚠️ 20 detik antar campaign generation |

### BUG-M4. SSRF protection tidak cover IPv6 private ranges
**File:** `src/lib/utils/url.ts`  
**Severity:** 🟡 MEDIUM

`isValidExternalUrl()` hanya blokir IPv4 private ranges. IPv6 private (`fc00::/7`, `fe80::/10`) dan domain internal (`.local`, `.internal`) lolos. Attacker bisa bypass SSRF via `http://[fc00::1]:8080/` atau `http://internal-server.local/`.

### BUG-M5. `queue/process/route.ts` CRON_SECRET handling tidak konsisten
**File:** `src/app/api/queue/process/route.ts`  
**Severity:** 🟡 MEDIUM

```typescript
// publish/process: ✅ cek eksistensi
if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`)

// queue/process: ❌ tidak cek eksistensi
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
```

Jika `CRON_SECRET` undefined, `queue/process` membandingkan dengan `"Bearer undefined"`. Bisa tidak sengaja menerima request dengan header `Authorization: Bearer undefined`.

### BUG-M6. Double retry: retry di level platform + retry di level publisher
**File:** `src/lib/social/publisher.ts`, `facebook.ts`, `instagram.ts`, `tiktok.ts`  
**Severity:** 🟡 MEDIUM

Satu 500 error memicu 3 platform-level retry × 3 publisher-level retry = **12 API calls** untuk satu error transient. Memboroskan API rate limit.

---

## 🟢 LOW (4)

| ID | Temuan | File |
|----|--------|------|
| BUG-L1 | `posts/autopilot` — 2 AI calls tanpa partial recovery: caption sukses + best-time gagal = semua hilang | `api/posts/autopilot/route.ts` |
| BUG-L2 | `chatbot/rules` GET — filter `business_unit_id` dari user lain return empty, bukan 403 | `api/chatbot/rules/route.ts` |
| BUG-L3 | `ai/factory.ts` — timeout 30s mungkin terlalu pendek untuk vision AI / complex caption | `lib/ai/factory.ts` |
| BUG-L4 | `ENCRYPTION_KEY` placeholder 33 karakter, `ENCRYPTION_SALT` belum diisi | `.env.local` |

---

## 🔧 PRIORITAS PERBAIKAN

### 🔴 PRIORITAS 0 — HARUS SEGERA DIPERBAIKI

| ID | Bug | Fix |
|----|-----|-----|
| C1 | Enkripsi TS vs PG tidak kompatibel | Seragamkan ke satu sistem: semua di TS atau semua di PG |
| C2 | Data terenkripsi M12→M16 undecryptable | Migration: decrypt dengan `encrypt_iv` → re-encrypt dengan `pgp_sym` sebelum ganti fungsi |
| H3 | `posts/route.ts` bisa posting ke akun orang lain | Tambahkan ownership join `business_units!inner(user_id)` |
| H4 | `USING NULL` hapus vision API keys | Ganti `USING NULL` dengan `USING convert_to(..., 'utf8')::bytea` |
| H5 | Storage MIME policy tidak efektif | Drop policies dengan nama Indonesia |
| H7 | Migration 18 gagal karena data `'instagram'` | Data migration `UPDATE ... SET platform = 'meta_ig'` |
| H8 | Cascade delete `ab_tests` → `post_queue` | `ON DELETE SET NULL` |

### 🟠 PRIORITAS 1

| ID | Bug | Fix |
|----|-----|-----|
| H1 | Rate limiter spoofable + shared bucket | Validasi header, TTL eviction, atau Redis |
| H2 | `Idempotency-Key` header tidak didukung platform | Hapus header dari social media API calls |
| H6 | Zero production observability | Integrasi Sentry/Logtail, jangan suppress error type |

### 🟡 PRIORITAS 2

| ID | Bug | Fix |
|----|-----|-----|
| M1 | Static salt + no key rotation | Set `ENCRYPTION_SALT` di env, tambahkan key versioning |
| M2 | Stuck `processing` jobs | Tambahkan reaper job untuk cleanup orphaned processing |
| M3 | Rate limit terlalu ketat | Naikkan limit: caption 20/min, trends 10/min |
| M4 | IPv6 SSRF bypass | Tambahkan `fc00::/7`, `fe80::/10`, `.local`, `.internal` |
| M5 | CRON_SECRET inconsistency | Samakan check di `queue/process` |
| M6 | Double retry | Hapus platform-level retry, hanya pakai publisher-level |

---

## 📊 MATRIKS DAMPAK BUG

| Bug | Data Loss | Security | Availability | Functionality |
|-----|-----------|----------|-------------|---------------|
| C1 | 🔴 Semua encrypted data | 🟠 Token tidak bisa dibaca | 🔴 Semua fitur publish/inbox gagal | 🔴 |
| C2 | 🔴 Data M12→M16 permanen | 🟡 Token tertentu | 🟡 Partial | 🟠 |
| H1 | - | 🟠 Rate limit bypass | 🟡 Legitimate user diblok | 🟡 |
| H2 | - | 🟡 | 🔴 Publish gagal permanen | 🔴 |
| H3 | - | 🔴 Cross-user posting | - | 🟠 |
| H4 | 🔴 Vision API keys | - | 🟡 | 🟡 |
| H5 | - | 🔴 MIME policy inert | - | - |
| H6 | - | 🟡 | 🟡 | 🟠 Debug impossible |
| H7 | - | - | 🔴 Migration gagal | 🔴 |
| H8 | 🔴 Posts ikut terhapus | - | 🟡 | 🟠 |

---

## ✅ HAL YANG SUDAH BENAR (NO REGRESSION)

- ✅ Semua ownership checks di API routes — tidak ada false-positive 403
- ✅ Semua import utilities benar — tidak ada broken import
- ✅ Semua `.single()` digunakan dengan benar — tidak ada array return bugs
- ✅ Supabase client separation (server vs service) — tidak ada cross-contamination
- ✅ Next.js 15 `await params` pattern — semua benar
- ✅ Migration ordering — tidak ada dependency conflict antar migration 15-18
- ✅ `ab_tests` RLS policy — konsisten dengan pola existing
- ✅ Platform CHECK constraint naming — defensive `DROP IF EXISTS` handles edge cases

---

*Laporan bug regression — fokus pada bug yang muncul dari perbaikan keamanan (migrations 12-18 + API hardening). Bug pre-existing tidak dicakup.*
