# 📐 RENCANA IMPLEMENTASI — 5 Fitur Baru DigiMar Fase 2

**Tanggal:** 18 Juni 2026  
**Project:** DigiMar Automation  

---

## 📊 OVERVIEW

| # | Fitur | Kompleksitas | File Baru | File Edit |
|---|-------|-------------|-----------|-----------|
| 1 | Dashboard Home | 🟡 Medium | 3 | 1 |
| 2 | Bulk CSV Posting | 🟡 Medium | 2 | 2 |
| 3 | Enhanced Analytics | 🟠 High | 2 | 3 |
| 4 | Content Calendar Enhancement | 🟢 Low | 0 | 3 |
| 5 | Auto-Reply DB-First | 🟠 High | 2 | 4 |
| 6 | Multi-Platform Publishing & Caption Override | 🟠 High | 1 | 5 |

**Total: 10 file baru, 18 file edit**

---

## 1. DASHBOARD HOME — Full Analytics Dashboard

### Gambaran
`app/(dashboard)/page.tsx` saat ini kosong. Diganti menjadi full dashboard dengan widget-widget analitik.

### Komponen Baru

#### A. `src/components/dashboard/StatsCard.tsx`
Widget card individual: ikon, label, value, trend (↑/↓), warna.
```
┌─────────────────────┐
│ 📊 Total Posts      │
│ 247                 │
│ ↑ 12% dari kemarin  │
└─────────────────────┘
```

#### B. `src/components/dashboard/QueueWidget.tsx`
Status queue ringkasan: waiting/processing/success/failed progress bar.

#### C. `src/components/dashboard/RecentActivity.tsx`
Feed aktivitas terbaru: post published, comment received, AI reply sent. Dari `post_queue` + `social_conversations`.

### Page: `app/(dashboard)/page.tsx`
Layout:
```
┌──────────────────────────────────────────────────────┐
│  👋 Selamat datang, [user]                            │
│  Ringkasan hari ini                                   │
├─────────────┬─────────────┬─────────────┬─────────────┤
│ StatsCard   │ StatsCard   │ StatsCard   │ StatsCard   │
│ Total Posts │ Engagement  │ AI Credits  │ Queue Pend. │
├───────────────────────────┬───────────────────────────┤
│ Quick Actions             │ Queue Status Widget       │
│ [+ Buat Post]             │ ████░░░░ 12 waiting       │
│ [Auto-Pilot]              │ ██░░░░░░ 3 processing     │
│ [CSV Import]              │ ████████ 45 success       │
│ [Campaign]                │ █░░░░░░░ 2 failed         │
├───────────────────────────┴───────────────────────────┤
│ 📅 Mini Calendar (bulan ini)                           │
│ ┌──┬──┬──┬──┬──┬──┬──┐                                │
│ │  │  │  │● │  │  │  │   ● = ada post                │
│ └──┴──┴──┴──┴──┴──┴──┘                                │
├───────────────────────────────────────────────────────┤
│ 🕐 Recent Activity Feed                                │
│ • 10:30 — Post "Promo Lebaran" published ke IG         │
│ • 09:15 — AI auto-reply ke komentar @customer          │
│ • 08:00 — Campaign "Ramadhan" selesai                  │
└───────────────────────────────────────────────────────┘
```

### API endpoint: `GET /api/dashboard`
```typescript
// Response:
{
  total_posts: number,        // total di post_queue user ini
  posts_today: number,        // scheduled_at hari ini
  queue: {
    waiting: number,
    processing: number,
    success: number,
    failed: number
  },
  engagement: {               // dari analytics (agregat semua akun)
    total_followers: number,
    avg_engagement_rate: number
  },
  recent_activity: [{
    type: 'post_published' | 'comment_received' | 'ai_reply' | 'campaign_completed',
    timestamp: string,
    message: string,
    link?: string
  }],
  monthly_calendar: [{ date: string, count: number }]  // posts per day bulan ini
}
```

### Data sources:
- `post_queue` → total posts, queue status, recent activity
- `social_conversations` → recent comments, unread
- `/api/analytics?account_id=` → followers, engagement (dipanggil paralel untuk semua akun user)
- `business_units` → jumlah unit
- `ai_providers` → provider yang aktif

### File yang dibuat/diedit:
| File | Action |
|------|--------|
| `src/components/dashboard/StatsCard.tsx` | NEW |
| `src/components/dashboard/QueueWidget.tsx` | NEW |
| `src/components/dashboard/RecentActivity.tsx` | NEW |
| `src/app/api/dashboard/route.ts` | NEW |
| `src/app/(dashboard)/page.tsx` | EDIT |

---

## 2. BULK CSV POSTING — Full Field Import

### Gambaran
User upload CSV, sistem parsing semua kolom, validasi, batch insert ke `post_queue`.

### Format CSV (Full):
```csv
target_account_ids,scheduled_at,caption,first_comment,media_urls,post_type,cover_url,tone_voice,content_idea
"uuid1,uuid2","2026-06-20 15:00","Promo Ramadhan","Cek link bio","url1,url2","carousel","","profesional",""
```

### Komponen Baru

#### A. `src/components/planner/BulkImportModal.tsx`
Modal dengan:
1. **Upload step**: Drag-and-drop CSV + preview tabel hasil parsing
2. **Validation step**: Tampilkan error per baris (kolom kosong, format salah, UUID invalid)
3. **Import step**: Progress bar, hasil sukses/gagal

### API endpoint: `POST /api/posts/bulk`
```typescript
// Body: FormData dengan file CSV
// Response:
{
  total: 50,
  success: 47,
  failed: 3,
  errors: [
    { row: 12, error: "Invalid scheduled_at format" },
    { row: 23, error: "target_account_ids[0] not found" },
    { row: 45, error: "Caption too long (max 2200 chars)" }
  ],
  inserted_ids: ["uuid1", "uuid2", ...]
}
```

### Flow:
```
CSV file → parse CSV (papaparse) → validasi per row →
  batch insert ke post_queue (10 rows per chunk) →
  return hasil
```

### Validasi per row:
- `target_account_ids`: UUID valid + verifikasi ownership via `social_accounts.business_units.user_id`
- `scheduled_at`: format ISO 8601 valid, > now
- `caption`: 1-2200 karakter
- `media_urls`: URL valid (opsional)
- `post_type`: `single_image | carousel | reels`

### File yang dibuat/diedit:
| File | Action |
|------|--------|
| `src/components/planner/BulkImportModal.tsx` | NEW |
| `src/app/api/posts/bulk/route.ts` | NEW |
| `src/app/(dashboard)/planner/page.tsx` | EDIT (tambah tombol "Import CSV") |
| `src/app/(dashboard)/page.tsx` | EDIT (link ke bulk import dari dashboard) |

---

## 3. ENHANCED ANALYTICS — Real API Data

### Gambaran
Ganti mock data dengan real Instagram/Facebook Insights API. Fetch metrics asli per akun.

### Instagram Insights API
Meta Graph API endpoint yang perlu ditambahkan:
```
GET /{ig_user_id}/insights?metric=reach,impressions,profile_views,follower_count&period=day
GET /{ig_user_id}/media?fields=id,caption,media_type,like_count,comments_count,timestamp,insights.metric(reach,impressions)
```

### Facebook Page Insights
```
GET /{page_id}/insights?metric=page_impressions,page_engaged_users,page_follows
GET /{page_id}/posts?fields=id,message,created_time,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_engaged_users)
```

### File yang diedit:

#### A. `src/app/api/analytics/route.ts`
- Tambahkan `GET /{ig_user_id}/insights` call untuk `chart_data` real
- Tambahkan `/media` endpoint untuk recent posts + engagement
- Hapus mock data fallback (atau jadikan explicit flag)

#### B. `src/lib/social/instagram.ts`
- Tambahkan fungsi `fetchInstagramInsights(igUserId, accessToken, period)` 
- Tambahkan fungsi `fetchInstagramMedia(igUserId, accessToken, limit)`

#### C. `src/lib/social/facebook.ts`  
- Tambahkan fungsi `fetchFacebookInsights(pageId, accessToken)`

### API endpoint baru: `GET /api/analytics/posts?account_id=`
Untuk best-performing posts (top 10 by engagement):
```typescript
// Response:
{
  posts: [{
    id: string,
    caption: string,
    media_url: string,
    likes: number,
    comments: number,
    reach: number,
    engagement_rate: number,
    published_at: string
  }]
}
```

### Tipe baru: `src/types/index.ts`
```typescript
export interface AnalyticsMetrics {
  followers: number;
  posts: number;
  name: string;
  profile_pic: string;
  reach_7d: number;
  impressions_7d: number;
  engagement_rate: number;
  profile_views_7d: number;
  is_mock: boolean;
}

export interface ChartDataPoint {
  date: string;
  reach: number;
  impressions: number;
  engagement: number;
}

export interface TopPost {
  id: string;
  caption: string;
  media_url: string;
  likes: number;
  comments: number;
  reach: number;
  engagement_rate: number;
  published_at: string;
}
```

### File yang dibuat/diedit:
| File | Action |
|------|--------|
| `src/app/api/analytics/posts/route.ts` | NEW |
| `src/lib/social/analytics.ts` | NEW (shared analytics fetching) |
| `src/app/api/analytics/route.ts` | EDIT (real insights) |
| `src/lib/social/instagram.ts` | EDIT (tambah fetch functions) |
| `src/lib/social/facebook.ts` | EDIT (tambah fetch functions) |

---

## 4. CONTENT CALENDAR ENHANCEMENT

### Gambaran
Kalender yang sudah ada (FullCalendar) ditingkatkan dengan:
- Color-coding per platform (bukan cuma per status)
- Visual queue status (ikon di event)
- View toggle week/month tersimpan di state

### Perubahan di `app/(dashboard)/planner/page.tsx`

#### A. Color-coding per platform
```typescript
const getPlatformColor = (accountIds: string[]) => {
  // Cek platform dari target_account_ids pertama
  const acc = accounts.find(a => a.id === accountIds[0])
  switch (acc?.platform) {
    case 'meta_ig': return '#E1306C'   // Instagram pink
    case 'facebook': return '#1877F2'  // Facebook blue
    case 'tiktok': return '#000000'    // TikTok black
    case 'threads': return '#000000'   // Threads black
    default: return '#3b82f6'
  }
}
```

#### B. Visual queue status
- `waiting`: border putus-putus (dashed)
- `processing`: animasi pulse
- `success`: solid + checkmark
- `failed`: solid merah + X icon
- `partial`: solid oranye

#### C. Filter by platform / unit
Tambahkan dropdown filter:
```
[Semua Platform ▾] [Semua Unit ▾] [Bulan ▾]
```

#### D. Responsive improvements
- Month view: default
- Week view: untuk mobile
- Click date: buka PostScheduler dengan date pre-selected (sudah ada)

### File yang diedit:
| File | Action |
|------|--------|
| `src/app/(dashboard)/planner/page.tsx` | EDIT (color, filter, status icon) |

---

## 5. AUTO-REPLY DB-FIRST + API

### Gambaran
Saat ini `handleSendMessage` di inbox masih mock/TODO. Dibuat sistem:
1. Simpan pesan ke `social_messages` dengan `sender_type: 'brand'` atau `'ai_auto'`
2. Kirim via Meta Graph API
3. Update status kirim di DB
4. Retry jika gagal

### Flow:
```
User/admin click "Kirim" di inbox
  → POST /api/inbox/send
    → Insert ke social_messages (status: 'pending')
    → Kirim ke Meta API (DM atau comment reply)
    → Sukses: update status jadi 'sent', simpan platform_message_id
    → Gagal: update status jadi 'failed', simpan error

Webhook Meta (auto-reply):
  → Comment/DM masuk
  → AI generate reply (existing, sudah jalan)
  → POST ke Meta API (existing, sudah jalan)
  → TAMBAHAN: Insert ke social_messages dengan sender_type: 'ai_auto'
```

### API endpoint baru: `POST /api/inbox/send`
```typescript
// Body:
{
  conversation_id: string,
  message: string,
  media_url?: string,       // untuk kirim gambar
  reply_to_comment_id?: string,  // kalau balas komentar spesifik
  sender_type: 'brand' | 'ai_auto'  // default: 'brand'
}

// Flow:
1. Verifikasi conversation ownership
2. Insert ke social_messages:
   {
     conversation_id,
     sender_type: body.sender_type || 'brand',
     content: message,
     status: 'pending',
     created_at: NOW()
   }
3. Ambil social_conversation → social_account → decrypt access_token
4. Jika type === 'dm':
   POST graph.facebook.com/v18.0/me/messages
   { recipient: { id: customer_id }, message: { text: message } }
5. Jika type === 'comment':
   POST graph.facebook.com/v18.0/{comment_id}/replies
   { message }
6. Update social_messages:
   status: 'sent',
   platform_message_id: response.id,
   sent_at: NOW()
7. Return { success: true, message_id, platform_message_id }

// Error handling:
- Jika Meta API gagal → retry 2x dengan backoff 2s/4s
- Jika masih gagal → status: 'failed', error_message, biarkan user retry manual
```

### Perubahan di `app/api/webhooks/meta/route.ts`
Setelah berhasil kirim balasan (existing code), tambahkan:
```typescript
// Insert ke social_messages untuk tracking
await supabase.from('social_messages').insert({
  conversation_id: conversation.id,
  sender_type: 'ai_auto',
  content: replyText,
  platform_message_id: response.id,
  sent_at: new Date().toISOString(),
  status: 'sent'
})
```

### Migration: `00000000000020_inbox_tracking.sql`
```sql
ALTER TABLE social_messages
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent' 
    CHECK (status IN ('pending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;
```

### Perubahan di inbox page
`handleSendMessage` di `inbox/page.tsx`:
- Ganti mock Swal dengan `POST /api/inbox/send`
- Loading state saat mengirim
- Error handling dengan retry button

### File yang dibuat/diedit:
| File | Action |
|------|--------|
| `supabase/migrations/00000000000020_inbox_tracking.sql` | NEW |
| `src/app/api/inbox/send/route.ts` | NEW |
| `src/app/(dashboard)/inbox/page.tsx` | EDIT (handleSendMessage real) |
| `src/app/api/webhooks/meta/route.ts` | EDIT (insert to social_messages) |
| `src/app/api/inbox/ai-reply/route.ts` | EDIT (opsional: simpan reply ke DB) |

---

## 📁 STRUKTUR FILE FINAL — SEMUA 5 FITUR

```
File BARU (9):
  src/components/dashboard/StatsCard.tsx
  src/components/dashboard/QueueWidget.tsx
  src/components/dashboard/RecentActivity.tsx
  src/app/api/dashboard/route.ts
  src/components/planner/BulkImportModal.tsx
  src/app/api/posts/bulk/route.ts
  src/app/api/analytics/posts/route.ts
  src/lib/social/analytics.ts
  src/app/api/inbox/send/route.ts
  supabase/migrations/00000000000020_inbox_tracking.sql  (10 files baru)

File EDIT (13):
  src/app/(dashboard)/page.tsx                  ← Dashboard Home
  src/app/(dashboard)/planner/page.tsx           ← Calendar + Bulk button
  src/app/api/analytics/route.ts                 ← Real insights
  src/lib/social/instagram.ts                    ← fetchInsights + fetchMedia
  src/lib/social/facebook.ts                     ← fetchInsights
  src/app/(dashboard)/inbox/page.tsx             ← Real send
  src/app/api/webhooks/meta/route.ts             ← Insert to social_messages
  src/app/api/inbox/ai-reply/route.ts            ← Opsional: simpan reply ke DB
  src/types/index.ts                             ← Tambah AnalyticsMetrics, ChartDataPoint, TopPost
```

---

## 🔧 IMPLEMENTATION ORDER

### Sprint 1: Dashboard + Calendar
1. `GET /api/dashboard` + dashboard page + 3 komponen
2. Calendar enhancement (color per platform + filter + status icon)

### Sprint 2: Analytics Real Data  
3. `lib/social/analytics.ts` + edit `instagram.ts`/`facebook.ts` untuk Insights API
4. Edit `analytics/route.ts` ganti mock → real data
5. `GET /api/analytics/posts` untuk top posts

### Sprint 3: Bulk CSV + Auto-Reply
6. `POST /api/posts/bulk` + BulkImportModal + validasi CSV
7. Migration inbox tracking + `POST /api/inbox/send`
8. Edit inbox page + webhook meta untuk DB-first tracking

---

## 🔐 KEAMANAN

- Semua endpoint baru: auth + ownership check (pola existing)
- CSV import: validasi UUID + verifikasi ownership `target_account_ids`
- Send message: verifikasi conversation ownership sebelum kirim
- Analytics Insights: token di-decrypt server-side, tidak pernah ke client
- Rate limiting: ditambahkan di endpoint bulk dan send

---

*Rencana implementasi — 6 fitur, 10 file baru, 18 file edit, 4 sprint.*

---

## 6. MULTI-PLATFORM PUBLISHING & CAPTION OVERRIDE

### Gambaran

Saat ini `PostScheduler` hanya bisa memilih **satu akun** sebagai target publish, sehingga konten yang sama di 3 platform harus dibuat 3 jadwal terpisah. Fitur ini menyelesaikan masalah tersebut sekaligus memungkinkan caption yang berbeda per platform.

### A. Multi-Select Akun Tujuan (Opsi A)

Ganti `<select>` single dengan **checkbox grid per platform** di bagian "Unit & Akun Tujuan":

```
┌─────────────────────────────────────────────┐
│ Akun Tujuan (centang semua yang ingin diisi) │
│                                             │
│ ☑️  📸  DigiMar_IG  (Instagram)              │
│ ☑️  🎵  DigiMar_TK  (TikTok)                │
│ ☐   👥  DigiMar_FB  (Facebook)              │
│ ☐   🧵  DigiMar_TH  (Threads)               │
└─────────────────────────────────────────────┘
```

- Setiap baris: **ikon platform** + nama akun + platform badge berwarna
- Akun yang belum terhubung: tampil **disabled** + label "Tambah di Pengaturan"
- Auto-select semua akun jika hanya ada satu

**Perubahan state:**
```typescript
// Sebelum
const [formAccount, setFormAccount] = useState<string>('');

// Sesudah
const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
```

**Perubahan payload:**
```typescript
// Sebelum: target_account_ids: [formAccount]
// Sesudah: target_account_ids: selectedAccounts  // langsung array multi-platform
```

### B. Per-Platform Caption Override (Opsi C)

Accordion yang muncul di bawah "Caption Final" **hanya jika mode = Advanced dan lebih dari 1 platform dipilih**:

```
Caption Final (dipakai jika tidak di-override)
[textarea utama]

▼ Override Caption Per-Platform (opsional)
┌──────────────────────────────────────────────┐
│ 📸 Instagram  [counter: 0/2200]              │
│ [textarea] ⚠️ Jika > 5 hashtag, reach turun  │
├──────────────────────────────────────────────┤
│ 🎵 TikTok     [counter: 0/150]               │
│ [textarea] 💡 Hook di baris pertama          │
├──────────────────────────────────────────────┤
│ 👥 Facebook                                  │
│ [textarea]                                   │
└──────────────────────────────────────────────┘
```

**State baru:**
```typescript
const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
// { 'uuid-ig-account': 'Caption IG...', 'uuid-tiktok-account': 'Caption TikTok...' }
```

**Logic publisher (fallback):**
```typescript
const caption = job.platform_captions?.[account.id] || job.caption;
```

### C. Setting Preferensi Mode Publish

Di halaman **Pengaturan**, tambahkan section **"Mode Publish Konten"**:

```
⚙️  Mode Publish Konten

● Mode Cepat (Opsi A)
  Pilih beberapa akun, 1 caption untuk semua.
  Cocok untuk konten yang sama di semua platform.

○ Mode Lanjutan (Opsi A + C)
  Multi-select akun + caption berbeda per platform.
  Cocok untuk optimasi konten per platform.
```

- Default: **Mode Cepat** agar tidak membingungkan pengguna baru
- Disimpan di tabel `configurations` yang sudah ada: `key = 'publish_mode'`
- **Tidak butuh migrasi DB baru** untuk preferensi ini

### D. Hashtag Platform-Aware (Instagram max 5)

Instagram per update 2024 membatasi **maksimal 5 hashtag** untuk jangkauan optimal.

**Perubahan di HashtagModal:** Tampilkan hasil dalam **3 tab**:

| Tab | Platform | Jumlah Hashtag |
|-----|----------|----------------|
| 📸 Instagram | meta_ig | Maks **5** |
| 🎵 TikTok | tiktok | Bebas, rekomendasi 5–15 |
| 🌐 Umum | semua | 5 (aman untuk semua platform) |

**Peringatan otomatis di PostScheduler:**
```
⚠️ Caption Instagram mengandung 8 hashtag. Instagram merekomendasikan maksimal 5.
```

### DB Migration: `supabase/migrations/00000000000020_platform_captions.sql`
```sql
ALTER TABLE post_queue
  ADD COLUMN IF NOT EXISTS platform_captions JSONB DEFAULT '{}';
-- Berisi: { "uuid-akun-id": "teks caption override per platform" }
```

### Urutan Eksekusi (Sprint 4)
```
1. Migration 00000000000020 → tambah kolom platform_captions
2. API posts/route.ts → terima & simpan platform_captions
3. publisher.ts → baca platform_captions, fallback ke caption utama
4. Settings → tambah radio button Mode Publish, simpan ke configurations
5. PostScheduler → baca preferensi, ubah formAccount → selectedAccounts[]
6. PostScheduler → ganti <select> dengan Checkbox Grid
7. PostScheduler → accordion Per-Platform Caption (mode advanced only)
8. PostScheduler → character counter + peringatan hashtag Instagram
9. HashtagModal + hashtags/route.ts → output per-platform, tab UI
```

### File yang dibuat/diedit:
| File | Action |
|------|--------|
| `supabase/migrations/00000000000020_platform_captions.sql` | NEW |
| `src/components/planner/PostScheduler.tsx` | EDIT (checkbox multi-select, accordion, counter) |
| `src/app/api/posts/route.ts` | EDIT (terima platform_captions) |
| `src/app/api/posts/[id]/route.ts` | EDIT (update platform_captions) |
| `src/lib/social/publisher.ts` | EDIT (baca platform_captions per akun) |
| `src/components/planner/HashtagModal.tsx` | EDIT (tab per platform) |
| `src/app/api/ai/hashtags/route.ts` | EDIT (output per platform) |
| `src/app/(dashboard)/settings/page.tsx` | EDIT (tambah Mode Publish preference) |

### Verification Plan
- Centang 3 akun → pastikan `target_account_ids` di DB berisi 3 UUID
- Ganti ke Mode Lanjutan di Pengaturan → accordion override caption muncul
- Isi override TikTok berbeda → publish → cek `platform_captions` di DB
- Publisher: pastikan tiap akun menerima caption yang benar (bukan semua sama)
- Ketik 6 hashtag di caption Instagram → peringatan ⚠️ muncul otomatis
- Hashtag Engine → 3 tab (Instagram | TikTok | Umum) dengan set hashtag berbeda

---

### Sprint 4: Multi-Platform Publishing
9. Migration platform_captions + API posts update
10. PostScheduler overhaul (checkbox + accordion + counter)
11. Settings Mode Publish preference
12. HashtagModal tab per platform + API hashtag platform-aware

---

*Rencana implementasi — 6 fitur, 10 file baru, 18 file edit, 4 sprint.*
