# DigiMar Automation — Codebase Audit Report

**Tanggal:** 2026-06-17
**Versi:** Next.js 16 + Supabase (migrasi dari Google Apps Script)
**Status:** Early-stage — foundation solid, **belum production-ready**

---

## Executive Summary

**47 source files** di-audit. Proyek migrasi dari Google Apps Script ke Next.js + Supabase. Foundation bagus (RLS, encryption, struktur folder), tapi ada **4 critical bug, 3 high-severity security vulnerability, 9 dead code/dependency, dan Instagram publishing dipastikan tidak berfungsi** karena platform name mismatch + API endpoint salah.

**Prioritas utama:** Fix 4 critical bug → amankan SSRF + CRON auth → hapus dead dependencies → baru lanjut fitur.

---

## 🔴 CRITICAL BUGS (Akan Crash / Silent Fail)

### 1. Instagram Publishing Broken — Platform Name Mismatch
- **File:** `src/lib/social/types.ts` baris 5, `src/lib/social/publisher.ts` baris 59, `supabase/migrations/00000000000000_init.sql` baris 20
- `types.ts` definisikan `platform: 'instagram' | 'linkedin' | 'threads'`
- `publisher.ts` cek: `if (account.platform === 'instagram')` → panggil `publishToInstagram()`
- **Database CHECK constraint** hanya izinkan: `'meta_ig', 'linkedin', 'threads', 'tiktok'`
- Nilai `'instagram'` **tidak bisa masuk database.** Kalaupun bisa, publisher cek `'instagram'` tapi DB simpan `'meta_ig'` → kondisi selalu `false`
- **Dampak:** Semua post Instagram jatuh ke `else` branch, di-mark `failed` tanpa error visible

### 2. API Endpoint Instagram Salah
- **File:** `src/lib/social/instagram.ts` baris 7
- URL: `https://graph.instagram.com/v25.0/{igUserId}/media`
- Endpoint benar untuk content publishing: **`https://graph.facebook.com/v25.0/{igUserId}/media`**
- `graph.instagram.com` = Instagram Basic Display API (deprecated, tidak support publishing)
- **Dampak:** Semua panggilan Meta API gagal 404 / auth error

### 3. CRON_SECRET Authentication Bypass
- **File:** `src/app/api/publish/process/route.ts` baris 5-8
```ts
if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```
- Jika `CRON_SECRET` tidak di-set (falsy/`undefined`), kondisinya **skip** — semua request bisa trigger `processQueue()`
- `CRON_SECRET` di `.env.local` cuma placeholder
- **Fix:** `if (!process.env.CRON_SECRET || authHeader !== \`Bearer ${process.env.CRON_SECRET}\`)`

### 4. PostScheduler Crash — Non-null Assertion pada Null
- **File:** `src/components/planner/PostScheduler.tsx` baris 180-182
- Fungsi `selectFromGallery()` set `mediaPreview` dan `mediaUrl`, tapi **tidak set `mediaFile`**
- Baris 181: `{Math.round(mediaFile!.size/1024)} KB` — **`mediaFile` null** → crash React render
- **Fix:** Guard dengan `mediaFile?.size` atau set `mediaFile` juga di `selectFromGallery()`

---

## 🔴 HIGH-SEVERITY SECURITY VULNERABILITIES

### 5. SSRF — Arbitrary Internal Network Probing via `/api/ai/models`
- **File:** `src/app/api/ai/models/route.ts` baris 13-23
- User kirim `base_url` dan `api_key`, server fetch `${cleanBaseUrl}/models` tanpa validasi
- Bisa probe: `http://169.254.169.254/` (cloud metadata), `http://localhost:3000/`, `http://10.0.0.1/`, dll.
- **Fix:** Whitelist domain (groq.com, openai.com, openrouter.ai, api.anthropic.com), blokir private IP ranges

### 6. Service Role Client Bypass Semua RLS — Terbuka untuk Salah Pakai
- **File:** `src/lib/supabase/service.ts`
- `createServiceClient()` pakai `SUPABASE_SERVICE_ROLE_KEY` — bypass semua Row-Level Security
- Route mana pun yang import ini dapat full DB access tanpa user scoping
- Saat ini hanya dipakai `publisher.ts` dan `webhooks/meta/route.ts` (legitimate)
- **Risiko:** Jika developer tidak sengaja pakai ini di API route lain, **semua data user terekspos**
- **Fix:** Tambah komentar `@danger` JSDoc, rename ke `createDangerousServiceClient()`, atau restrict via ESLint rule

### 7. Units GET Tidak Scoped ke User
- **File:** `src/app/api/units/route.ts` baris 9-15
- Query: `.from('business_units').select('*')` — **tidak ada filter `user_id`**
- Hanya mengandalkan RLS di database level
- Inkonsisten: `posts/route.ts` sudah menambah `.eq('user_id', user.id)` secara eksplisit
- **Fix:** Tambah `.eq('user_id', user.id)` sebagai defense-in-depth + konsistensi

---

## 🟡 AUTHENTICATION & AUTHORIZATION GAPS

### 8. Middleware Skip Auth untuk Semua `/api/*`
- **File:** `src/middleware.ts` baris 31
- Komentar: "API routes handle their own auth"
- Masalah: Beberapa API route **tidak ada auth check sama sekali**:
  - `api/ai/models/route.ts` — tidak ada auth (sekaligus SSRF vulnerability)
  - `api/publish/process/route.ts` — bergantung CRON_SECRET (yang bisa kosong)
  - `api/webhooks/meta/route.ts` — intentionally public (webhook), ini OK

### 9. Tidak Ada Rate Limiting
- Tidak ada middleware rate limiting, tidak ada package `rate-limit`
- Endpoint AI (`/api/ai/caption`, `/api/ai/trends`) bisa di-spam → habiskan API credits
- Login page tidak ada brute-force protection
- **Fix:** Tambah `@upstash/ratelimit` atau Vercel Edge rate limiting

### 10. Login Page Tidak Ikut Pattern SSR Auth
- **File:** `src/app/auth/login/page.tsx` baris 18-21
- `createBrowserClient()` dipanggil langsung di komponen, bukan via middleware/session
- Berfungsi tapi tidak ikut best practice `@supabase/ssr`

---

## 🟡 DATABASE SCHEMA ISSUES

### 11. Tidak Ada Foreign Key dari `social_accounts` Langsung ke `user_id`
- `social_accounts` cuma punya FK ke `business_units(id)`, bukan ke `auth.users(id)`
- RLS pakai subquery: `EXISTS (SELECT 1 FROM business_units WHERE...)` — benar tapi mahal di scale besar

### 12. `target_account_ids` JSONB — Tidak Ada Referential Integrity
- `post_queue.target_account_ids` = JSONB array
- Tidak bisa enforce bahwa ID-nya benar-benar ada di `social_accounts`
- Hapus social account tidak akan cascade ke post_queue

### 13. Tabel `configurations` Didefinisikan Tapi 0 Referensi Kode
- Ada di migration `00000000000000_init.sql` dengan full RLS
- Tidak ada satu pun file source yang query tabel ini
- **Dead schema** — hapus atau implementasi

### 14. `updated_at` Tidak Ada Auto-Update Trigger
- Semua tabel punya `updated_at` tapi bergantung aplikasi untuk set manual
- Tidak ada `ON UPDATE` trigger atau `moddatetime` extension

---

## 🟡 TYPE SAFETY & NULL HANDLING

### 15. 30+ Pemakaian `any` di Seluruh Komponen
| File | Jumlah `any` |
|------|-------------|
| `dashboard/page.tsx` | 4x `any[]` |
| `analytics/page.tsx` | 1x `any`, 2x `any[]` |
| `settings/page.tsx` | 3x `any[]` |
| `trends/page.tsx` | 1x `any` |
| `Chart.tsx` | `posts: any[]` |
| `PostScheduler.tsx` | 1x `any`, 2x `any[]` |
| `instagram.ts` | `body?: any` |
| **Total** | **30+ `any` usages** |

> Mengalahkan tujuan TypeScript. Harus diganti dengan interface yang tepat.

### 16. `log_messages` di Types Didefinisikan `any[]`
- **File:** `src/lib/social/types.ts` baris 16
- Seharusnya structured type: `{ time: string; account_id?: string; success?: boolean; error?: string }[]`

---

## 🔴 DEAD CODE & UNUSED DEPENDENCIES

### 17. 8 Library Ter-install Tapi Tidak Digunakan

| Package | Terpasang | Digunakan? |
|---------|----------|-----------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | ✅ | ❌ Tidak ada drag-drop di komponen manapun |
| `@tanstack/react-query` | ✅ | ❌ Semua fetching pakai `fetch()` mentah |
| `sonner` | ✅ | ❌ Semua notifikasi pakai `sweetalert2` |
| `react-markdown` | ✅ | ❌ Tidak ada rendering markdown |
| `sweetalert2-react-content` | ✅ | ❌ Pakai `sweetalert2` langsung |
| `@fullcalendar` | ✅ | ✅ Dipakai di planner page |

### 18. Fungsi & Komponen Mati

| Item | Definisi | Dipakai? |
|------|---------|---------|
| `buildCaptionPrompt()` | `src/lib/ai/prompts.ts` | ❌ Route build prompt inline |
| `buildTrendPrompt()` | `src/lib/ai/prompts.ts` | ❌ Route build prompt inline |
| `AnalyticsChart` | `src/components/analytics/Chart.tsx` (default export) | ❌ Tidak ada import |
| `date-fns/locale/id` | `Chart.tsx` baris 3 | ❌ Di-import, tidak dipakai |

---

## 🔴 ARCHITECTURE & CODE QUALITY

### 19. Duplikasi 95% di 3 Provider File
- **File:** `src/lib/ai/providers/groq.ts`, `openai.ts`, `vps.ts`
- Ketiganya identik — beda cuma di constructor `baseURL` default
- `VPSClient` cuma tambah `timeout: 30000`
- **~80 baris kode duplikat**
- **Fix:** Satu class `OpenAICompatibleClient({ baseURL, apiKey, model, timeout? })`

### 20. Settings Page — 531 Baris Monolitik
- **File:** `src/app/(dashboard)/settings/page.tsx`
- 3 tab dalam 1 file, 20+ `useState` hooks, 3 form handler, 3 delete handler
- **Fix:** Split ke `UnitsTab.tsx`, `SocialTab.tsx`, `AITab.tsx`

### 21. PostScheduler — 420 Baris, Tight Coupling ke Supabase
- **File:** `src/components/planner/PostScheduler.tsx`
- Import `createClient` langsung, auth calls, storage calls
- Gallery modal inline, media upload + AI + scheduling = 1 komponen
- **Fix:** Ekstrak `MediaGallery.tsx`, `CaptionGenerator.tsx`, pindahkan Supabase calls ke hooks

---

## 🟡 PERFORMANCE ISSUES

### 22. Tidak Ada `React.memo` di Semua Komponen
- `Sidebar`, `Chart`, `PostScheduler`, semua page — tanpa memoization
- `Sidebar` re-render setiap navigasi

### 23. Dashboard 4 Parallel Fetch Setiap Mount
- **File:** `src/app/(dashboard)/page.tsx` baris 18-25
- `Promise.all` untuk posts, providers, units, accounts — tanpa cache
- `@tanstack/react-query` ter-install tapi tidak dipakai

### 24. `@fullcalendar` Loaded Eagerly
- ~500KB bundle, seharusnya `dynamic(() => import(...))` karena bukan landing page

---

## 🔴 CONFIGURATION & INFRASTRUCTURE

### 25. `.env.local` — Semua Nilai Placeholder
- `ENCRYPTION_KEY=your-32-character-encryption-key-here-xxx` (37 karakter, harus 32 — error runtime)
- `CRON_SECRET=your-random-cron-secret-here` (tidak ada nilai real → auth bypass)
- Semua API key kosong

### 26. `.gitignore` Blokir File Kritis
- `*.md` — **semua markdown** (PRD, catatan, CLAUDE.md) tidak masuk git
- `supabase/**/*.sql` — **MIGRASI DATABASE TIDAK DI-COMMIT** — ini sangat berbahaya!

### 27. `next.config.ts` Kosong
- Tidak ada `images.domains` untuk Supabase Storage
- Tidak ada security headers (CSP, X-Frame-Options, dll.)
- Tidak ada `experimental` config

---

## 🟡 ERROR HANDLING GAPS

### 28. JSON Parse AI Error — Raw Content Hilang
- **File:** `api/ai/caption/route.ts` baris 53-56, `api/ai/trends/route.ts` baris 87-91
- `console.error()` log raw AI response, tapi HTTP response hanya `"Format AI tidak valid. Coba lagi."`
- Response asli yang malformed hanya ada di server log — sulit debug tanpa akses log

### 29. Publisher Optimistic Locking — Silent Fail
- **File:** `src/lib/social/publisher.ts` baris 19-26
- Concurrent cron calls akan bikin `.single()` return error → `lockError` → `continue` — benar, tapi **tidak ada logging** untuk track seberapa sering ini terjadi

### 30. Reels Polling Block Queue 50 Detik
- **File:** `src/lib/social/instagram.ts` baris 47-56
- `for (i=0; i<10; i++) { await sleep(5000) }` — blocking loop
- Post lain tidak diproses selama menunggu reel selesai
- Saat ini moot (karena bug #1 + #2), tapi **arsitektur berbahaya** untuk production

---

## 🟢 WHAT'S GOOD / WELL DONE

- ✅ **RLS policies** — semua tabel di-protect per user
- ✅ **pgcrypto encryption** — token + API key terenkripsi di database
- ✅ **Provider abstraction pattern** (`factory.ts`) solid, tinggal rapikan duplikasi
- ✅ **Zod validation** di beberapa endpoint untuk input validation
- ✅ **Optimistic locking** di `publisher.ts` — mencegah double-processing
- ✅ **Struktur folder Next.js App Router** rapi dan scalable
- ✅ **TypeScript strict mode** enabled di `tsconfig.json`
- ✅ **Separation of concerns** antara `lib/supabase/client.ts`, `server.ts`, `service.ts` — jelas level aksesnya

---

## 📊 STATISTIK

| Kategori | 🔴 Critical (harus diperbaiki sekarang) | 🟡 Medium/High (harus diperbaiki sebelum production) |
|----------|----------------------------------------|-----------------------------------------------------|
| **Bug (crash / silent fail)** | 4 | 2 |
| **Security vulnerability** | 3 | 2 |
| **Dead code / unused deps** | 0 | 9 |
| **Architecture / duplication** | 0 | 4 |
| **Type safety** | 0 | 2 |
| **Performance** | 0 | 2 |
| **Config / infrastructure** | 2 | 2 |
| **Error handling** | 0 | 3 |
| **TOTAL** | **9** | **26** |

---

## 🎯 PRIORITY FIX ORDER

### Blok 1: Bug Kritikal (harus difix duluan)
1. **Samakan platform name** — ubah `types.ts` dan `publisher.ts` ke `'meta_ig'`, atau tambahkan `'instagram'` di DB constraint
2. **Fix Instagram endpoint** — ganti `graph.instagram.com` ke `graph.facebook.com` di `instagram.ts`
3. **Fix CRON_SECRET check** — `if (!process.env.CRON_SECRET || authHeader !== ...)`
4. **Fix PostScheduler null crash** — guard `mediaFile?.size`

### Blok 2: Keamanan
5. **SSRF protection** — whitelist domain di `/api/ai/models`
6. **Scope units GET** — tambah `.eq('user_id', user.id)`
7. **Tambah rate limiting** — minimal untuk endpoint AI

### Blok 3: Cleanup
8. **Hapus dead dependencies** — `@dnd-kit`, `@tanstack/react-query`, `sonner`, `react-markdown`, `sweetalert2-react-content`
9. **Gabung 3 provider client** jadi 1 class `OpenAICompatibleClient`
10. **Fix `.gitignore`** — hapus `*.md`, hapus `supabase/**/*.sql`

### Blok 4: Quality
11. **Ganti 30+ `any`** dengan interface yang tepat
12. **Split `settings/page.tsx`** ke 3 komponen tab
13. **Split `PostScheduler.tsx`** — ekstrak gallery + caption generator
14. **Pakai `@tanstack/react-query`** atau hapus dari deps

---

## Kesimpulan

**Foundation solid, execution belum selesai.** RLS + encryption + provider abstraction = pondasi yang benar. Bug critical membuat fitur utama (Instagram publishing) tidak berfungsi sama sekali. Dead dependencies dan duplikasi menambah technical debt yang tidak perlu.

**Estimasi fix critical bugs:** 2-3 jam.
**Estimasi cleanup + hardening:** 1-2 hari.
**Setelah itu** baru layak lanjut ke feature development (competitive intelligence, scraping, AI agent).
