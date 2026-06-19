# PRD: Meta API OAuth Flow — Dari Manual Token ke SaaS Broker

**Versi:** 1.0  
**Tanggal:** 2026-06-18  
**Status:** Draft

---

## 1. Masalah Saat Ini

Setiap user DigiMar harus:
1. Bikin Meta App sendiri di developers.facebook.com
2. Tambah Instagram Graph API product
3. Generate token manual di Graph API Explorer
4. Copy-paste token ke Settings → Akun Sosial
5. Kalau mau akses Inbox DM, harus App Review sendiri

**Dampak:**

| Aspek | Masalah |
|-------|---------|
| **Publish** | ✅ Jalan (token punya `instagram_content_publish`) |
| **Inbox DM** | ❌ Butuh `pages_messaging` → App Review tiap user |
| **Onboarding** | Berat — user harus paham Meta Developer |
| **Skalabilitas** | Tiap user urus sendiri → support nightmare |

---

## 2. Alternatif Arsitektur

### A. Bring Your Own App (BYOA) — Saat Ini

```
User A ──► Meta App A ──► Token A ──► DigiMar API
User B ──► Meta App B ──► Token B ──► DigiMar API
User C ──► Meta App C ──► Token C ──► DigiMar API
```

- ✅ Tidak perlu app DigiMar sendiri
- ❌ Tiap user: App Review → berat
- ❌ Token manual → fragile (expired, permission kurang)

### B. SaaS Broker App (Usulan)

```
DigiMar Meta App (1 app, full review) ──► Instagram Graph API
                                            ├── instagram_content_publish ✅
                                            ├── pages_messaging ✅
                                            └── pages_manage_metadata ✅
                                                    │
                     ┌──────────────────────────────────┐
                     │  OAuth Login                      │
                     │  "Login with Facebook"             │
                     └────────────┬─────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                User A        User B        User C
                (Page Token)  (Page Token)  (Page Token)
```

- ✅ Satu App Review — semua user bisa
- ✅ OAuth → no copy-paste token
- ✅ Inbox DM langsung bisa (webhook + conversations API)
- ✅ Token auto-refresh

---

## 3. Arsitektur Detail

### 3.1 Komponen

| Komponen | Tujuan |
|----------|--------|
| **Meta App (Business type)** — bukan Consumer! | Satu app pusat yang punya semua permission. Consumer hanya bisa akses data dasar (nama, email). Business yang bisa akses Instagram Graph API + Pages API. |
| **Facebook Login for Business** | OAuth flow: user login → dapet Page Token |
| **Token Exchange** | User Token → Page Token (long-lived) |
| **Token Storage** | Simpan Page Token + refresh token di `social_accounts` |
| **Webhook (messages)** | DM masuk otomatis ke inbox tanpa polling |
| **Publisher** | Posting via Page Token (sama seperti sekarang) |

### 3.2 Permission yang Dibutuhkan (App Review)

| Permission | Product | Untuk Apa |
|------------|---------|-----------|
| `instagram_basic` | Instagram Graph API | Baca profil IG |
| `instagram_content_publish` | Instagram Graph API | Posting konten |
| `pages_manage_metadata` | Pages API | Setup webhook, baca Page info |
| `pages_messaging` | Pages API | Akses conversations, baca DM |
| `pages_show_list` | Pages API | Daftar Page user |

### 3.3 Flow OAuth

```
1. User klik "Login with Facebook"
       │
2. Redirect ke Meta OAuth Dialog
       │   scope: email, pages_show_list, pages_manage_metadata,
       │          pages_messaging, instagram_basic, instagram_content_publish
       │
3. User login + approve permissions
       │
4. Meta redirect ke /api/auth/meta/callback
       │   code=xxxxx
       │
5. Tukar code → User Token (short-lived, 2 jam)
       │
6. GET /me/accounts → dapet Page List + Page Token
       │
7. Simpan Page Token ke social_accounts
       │   (Page Token long-lived, 60 hari)
       │
8. Redirect ke Settings → akun terhubung
```

### 3.4 Webhook Setup

Setelah OAuth sukses, sistem otomatis subscribe webhook ke Page user:

```
1. POST /{page_id}/subscribed_apps
   → Subscribe semua field (messages, conversations, comments)
   
2. Data masuk via POST /api/webhooks/meta:
   - comments → social_conversations (type: comment)
   - messages → social_conversations (type: dm)
```

### 3.5 Token Refresh

Page Token kedaluwarsa 60 hari. Flow refresh:

```
1. Cron job harian: cek social_accounts.expires_at
2. Kalau < 7 hari lagi: POST /oauth/access_token
   ?grant_type=fb_exchange_token
   &fb_exchange_token={page_token}
   → dapet token baru
3. Update social_accounts
```

---

## 4. Tahapan Implementasi

### Fase 1: Meta App Setup (Sekali)

- [ ] Buat Meta App baru tipe **Business** (bukan Consumer — Consumer tidak bisa akses Instagram Graph API)
- [ ] Ikat ke **Business Manager / Verified Business Account**
- [ ] Tambah **Facebook Login for Business** product
- [ ] Tambah **Instagram Graph API** product

### Fase 2: Backend — OAuth & Token

- [ ] Endpoint `GET /api/auth/meta` — redirect ke OAuth
- [ ] Endpoint `GET /api/auth/meta/callback` — handle code → token
- [ ] Endpoint `GET /api/auth/meta/refresh` — refresh token
- [ ] Cron-based token refresh (cek expired setiap hari)

### Fase 3: Backend — Webhook + API

- [ ] Auto-subscribe webhook ke Page user setelah OAuth
- [ ] Webhook DM handler (sudah ada, perlu tested)
- [ ] Backfill endpoint (sudah ada, via Page Token)

### Fase 4: Frontend — Settings

- [ ] Ganti form "Input Token Manual" → tombol "Login with Facebook"
- [ ] Tampilkan daftar Page yang terhubung
- [ ] Status token (kadaluwarsa / expired)

### Fase 5: Migrasi User Existing

- [ ] User lama tetap bisa pakai token manual (backward compat)
- [ ] Opsi "Upgrade to OAuth" di Settings

---

## 5. Database Changes

```sql
-- Tambah kolom ke social_accounts
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS page_id TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS page_name TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'manual'; -- 'manual' | 'oauth'
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS auth_source TEXT DEFAULT 'direct'; -- 'direct' | 'broker'
```

---

## 6. Risk & Mitigasi

| Risk | Dampak | Mitigasi |
|------|--------|----------|
| App Review ditolak | Semua user kena | Siapkan dokumentasi + video demo yang jelas |
| Token expired | Publish gagal | Cron refresh + notifikasi ke user |
| OAuth redirect mismatch | Login gagal | Test di staging dulu |
| Backward compat | User lama bingung | Jaga backward compat 3 bulan |
| Permintaan izin terlalu banyak | User curiga | Minimal permission: hanya yang dibutuhkan |

---

## 7. Timeline Estimasi

| Fase | Durasi | Dependency |
|------|--------|-----------|
| Fase 1: App Setup | 1 hari | Email Meta terverifikasi |
| Fase 2: OAuth Backend | 2-3 hari | App review submitted |
| Fase 3: Webhook + API | 2 hari | App review submitted |
| Fase 4: Frontend | 2-3 hari | Backend selesai |
| Fase 5: Migrasi | 1 hari | Fase 4 selesai |
| **App Review** | **1-7 hari** | Fase 1 selesai |

**Catatan:** App Review jalan paralel dengan development. Bisa mulai coding Fase 2-3 sambil nunggu review.

---

## 8. Referensi

- [Instagram Graph API — Messaging](https://developers.facebook.com/docs/instagram-api/guides/messaging/)
- [Facebook Login for Business — Page Access Tokens](https://developers.facebook.com/docs/facebook-login/access-tokens#pagetokens)
- [Handover Protocol / Page Inbox](https://developers.facebook.com/docs/messenger-platform/handover-protocol)
