# Strategi AI Auto-Analysis & Competitive Intelligence — DigiMar Automation

**Tanggal:** 2026-06-16
**Status:** Blueprint / Catatan Teknis

---

## Daftar Isi

1. [Visi: Dari Manual ke Autonomous](#1-visi-dari-manual-ke-autonomous)
2. [Auto-Analysis: Analisis Performa Konten Sendiri](#2-auto-analysis-analisis-performa-konten-sendiri)
3. [Competitive Intelligence: Analisis Kompetitor Otomatis](#3-competitive-intelligence-analisis-kompetitor-otomatis)
4. [Arsitektur Trigger & Scheduling](#4-arsitektur-trigger--scheduling)
5. [Database Schema Additions](#5-database-schema-additions)
6. [AI Prompt Engineering untuk Analysis Tasks](#6-ai-prompt-engineering-untuk-analysis-tasks)
7. [Data Sources & Integration Strategy](#7-data-sources--integration-strategy)
8. [Dashboard: Insight Hub](#8-dashboard-insight-hub)
9. [Implementation Priority](#9-implementation-priority)

---

## 1. Visi: Dari Manual ke Autonomous

Saat ini DigiMar sudah bisa:
- Generate caption & hashtag via AI
- Trend insight mingguan via AI (dengan input manual kategori bisnis + kompetitor)
- Auto-publish ke Instagram

**Target autonomous mode:**
- AI **menganalisis performa postingan sendiri** setiap hari/minggu — engagement rate, top content, jam terbaik posting, sentiment komentar
- AI **memantau kompetitor secara otomatis** — konten terbaru mereka, engagement, tren visual, frekuensi posting
- AI **memberi rekomendasi konten** berdasarkan analisis performa + analisis kompetitor (Apa yang harus diposting besok? Kenapa?)
- User hanya perlu **baca insight report** yang sudah jadi, langsung eksekusi

---

## 2. Auto-Analysis: Analisis Performa Konten Sendiri

### 2.1 Data yang Bisa Diambil dari Meta Graph API

Meta Graph API menyediakan endpoint **Instagram Insights** (untuk Business/Creator accounts):

| Endpoint | Data | Frekuensi Update |
|----------|------|-----------------|
| `{igUserId}/insights?metric=impressions,reach,profile_views` | Metrik akun | Harian |
| `{mediaId}/insights?metric=engagement,impressions,reach,saved` | Metrik per post | After post published |
| `{mediaId}/comments` | Komentar | Real-time |
| `{mediaId}/insights?metric=video_views` | Views (Reels) | Real-time |

### 2.2 Flow Auto-Analysis Harian

```
⏰ Vercel Cron (daily, jam 08:00)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  fetchPerformanceData()                          │
│  1. Ambil semua post 7 hari terakhir             │
│  2. Fetch insights per post via Graph API         │
│  3. Fetch akun-level insights                    │
│  4. Simpan raw data ke performance_metrics table  │
│  5. Simpan comments ke post_comments table       │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  generateDailyReport()                           │
│  1. Ambil performance_metrics 7 hari terakhir    │
│  2. Ambil komentar terbaru                       │
│  3. Kirim ke AI provider untuk analisis:         │
│     - Top 3 post by engagement                   │
│     - Jam posting terbaik (by reach)             │
│     - Analisis sentimen komentar (positive/neg)  │
│     - Pattern: tipe konten mana yang trending?   │
│     - Rekomendasi: apa yang harus di-posting     │
│       besok berdasarkan data?                    │
│  4. Simpan report ke daily_reports table         │
│  5. Notifikasi ke user (opsional: email/webhook) │
└─────────────────────────────────────────────────┘
```

### 2.3 Prompt AI untuk Daily Performance Report

```typescript
// src/lib/ai/reports.ts
export function buildPerformanceReportPrompt(metrics: string, comments: string) {
  return `Kamu adalah analis performa konten profesional untuk Instagram.

Berikut data performa konten 7 hari terakhir:
${metrics}

Ringkasan komentar (100 terbaru):
${comments}

Lakukan analisis dan berikan output dalam JSON:
{
  "overview": "Ringkasan performa minggu ini dalam 2-3 kalimat",
  "top_posts": [
    { "post_id": "...", "engagement_rate": "...", "why_worked": "..." }
  ],
  "best_posting_time": { "day": "...", "hour": "..." },
  "content_type_performance": {
    "reels": "skor 1-10",
    "carousel": "skor 1-10",
    "single_image": "skor 1-10"
  },
  "sentiment_analysis": {
    "positive_pct": 85,
    "neutral_pct": 10,
    "negative_pct": 5,
    "keywords": ["mantap", "keren", "mahal"]
  },
  "tomorrow_recommendation": {
    "content_type": "reels/carousel/single",
    "topic": "...",
    "angle": "...",
    "suggested_time": "14:00 WIB",
    "reason": "Kenapa ini direkomendasikan"
  }
}`;
}
```

---

## 3. Competitive Intelligence: Analisis Kompetitor Otomatis

### 3.1 Pendekatan

Ada dua jalur untuk mengumpulkan data kompetitor:

#### A. Instagram Graph API (Official — Limited)
Instagram Business API hanya memberi data akun sendiri. **Tidak bisa mengakses data kompetitor**. Opsi yang tersedia:
- **Hashtag Search** (`GET /ig_hashtag_search` + `GET /{hashtagId}/top_media`) — ambil top media dari hashtag industri
- **Tagged mentions** — jika akun kita di-tag oleh kompetitor

#### B. Web Scraping / Unofficial APIs (Recommended for MVP)
Karena Meta API tidak menyediakan competitor data, kita perlu pendekatan alternatif:

| Metode | Kelebihan | Kekurangan | Rekomendasi |
|--------|----------|------------|-------------|
| **Apify / BrightData** | Legal scraping, Instagram-ready actors | Berbayar (mulai ~$49/bulan) | ⭐ Production |
| **Instagrapi (Python library)** | Free, powerful | Perlu private Instagram login, risk banned | Research only |
| **RapidAPI Instagram Scraper** | Managed, reliable | Berbayar per request | ⭐ Production |
| **Manual input (current)** | Free, no complexity | Tidak autonomous | MVP awal |
| **Browser automation (Puppeteer)** | Fleksibel | Maintenance tinggi, risk banned | Tidak direkomendasikan |

### 3.2 Arsitektur Competitive Intelligence dengan Apify

```
⏰ Vercel Cron (2x per hari, jam 10:00 & 18:00)
    │
    ▼
┌────────────────────────────────────────────────┐
│  CollectCompetitorData()                        │
│  1. Baca daftar kompetitor dari competitors     │
│     table (username Instagram mereka)           │
│  2. Panggil Apify Actor:                        │
│     "instagram-profile-scraper"                 │
│     Input: { usernames: ["@competitor1", ...] } │
│  3. Dapatkan: latest posts, engagement stats,   │
│     bio, follower count, following count        │
│  4. Simpan raw data ke competitor_snapshots     │
│     table                                       │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│  AnalyzeCompetitorActivity()                    │
│  1. Bandingkan snapshot terbaru dengan minggu   │
│     lalu → delta follower, delta engagement     │
│  2. Ekstrak top content mereka (by likes)       │
│  3. Ekstrak hashtag yang mereka pakai           │
│  4. Analisis posting frequency & timing         │
│  5. Kirim ke AI untuk narasi insight            │
│  6. Simpan ke competitor_reports table           │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│  GenerateCompetitiveReport()                    │
│  1. Gabungkan data kompetitor + data sendiri    │
│  2. AI generate:                                │
│     - Gap analysis (apa yang mereka lakukan     │
│       tapi kita belum?)                         │
│     - Content opportunity analysis              │
│     - Hashtag strategy recommendation           │
│     - Timing strategy recommendation            │
│  3. Simpan + tampilkan di dashboard             │
└────────────────────────────────────────────────┘
```

### 3.3 Prompt AI untuk Competitive Analysis

```typescript
export function buildCompetitiveAnalysisPrompt(
  myMetrics: string,
  competitorData: string
) {
  return `Kamu adalah competitive intelligence analyst.

Data performa akun kita (7 hari):
${myMetrics}

Data kompetitor (diekstrak via scraper):
${competitorData}

Lakukan gap analysis dan berikan output JSON:
{
  "executive_summary": "Ringkasan posisi kita vs kompetitor",
  "competitor_ranking": [
    { "username": "@...", "engagement_score": 85, "strength": "...", "weakness": "..." }
  ],
  "competitive_gaps": [
    {
      "area": "konten/engagement/timing/hashtag",
      "competitor_does": "...",
      "we_dont": "...",
      "opportunity_score": "tinggi/sedang/rendah",
      "recommended_action": "Action konkret yang bisa kita ambil"
    }
  ],
  "hashtag_strategy": {
    "emerging_hashtags": ["#hash1"],
    "overused_hashtags": ["#hash2"],
    "recommended_mix": ["#hash3", "#hash4"]
  },
  "content_blueprint": {
    "what_to_post": "...",
    "format": "reels/carousel",
    "best_timing": "hari, jam",
    "expected_impact": "skenario terbaik"
  }
}`;
}
```

---

## 4. Arsitektur Trigger & Scheduling

### 4.1 Cron Configuration (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/publish/process",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/analysis/performance?scope=daily",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/analysis/competitors?scope=snapshot",
      "schedule": "0 10,18 * * *"
    },
    {
      "path": "/api/analysis/reports?type=weekly",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

**Catatan:** Vercel Hobby plan batas cron 10 detik. Jika analysis butuh > 10 detik, gunakan **Upstash QStash** atau **Trigger.dev** sebagai queue system:

```typescript
// Alternatif: Gunakan QStash untuk long-running analysis
import { Client } from '@upstash/qstash'

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

// Trigger dari Vercel Cron:
await qstash.publishJSON({
  url: 'https://xxx.vercel.app/api/analysis/competitors',
  body: { scope: 'full' }
})
```

### 4.2 Event-Driven Triggers (Realtime)

Selain cron, beberapa analysis bisa dipicu oleh event:

| Trigger | Event | Action |
|---------|-------|--------|
| Post published | Meta webhook `instagram_media_publish` | Mulai polling insights setelah 1 jam |
| Comment baru | Meta webhook `instagram_comment` | Tambah ke `post_comments`, update sentiment |
| Follower milestone | Polling harian | Trigger "growth report" spesial |

---

## 5. Database Schema Additions

### 5.1 Tabel Baru

```sql
-- Performance Metrics (raw data dari Instagram Insights)
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    post_id TEXT,                              -- Instagram media ID (null untuk akun-level)
    metric_date DATE NOT NULL,                 -- Tanggal metric
    metric_type TEXT NOT NULL,                 -- 'post' atau 'account'
    data JSONB NOT NULL,                       -- { impressions: 5000, reach: 3200, engagement: 450, ... }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_metrics_date ON performance_metrics(metric_date);
CREATE INDEX idx_perf_metrics_account ON performance_metrics(social_account_id);

-- Post Comments
CREATE TABLE post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_queue_id UUID REFERENCES post_queue(id) ON DELETE SET NULL,
    instagram_comment_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    reply_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    sentiment TEXT,                            -- 'positive', 'negative', 'neutral' (AI-analyzed)
    sentiment_score FLOAT,                     -- -1.0 to 1.0
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Competitors
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    instagram_username TEXT NOT NULL,           -- e.g., "@competitor_brand"
    display_name TEXT,
    category TEXT,                              -- 'direct_competitor', 'aspirational', 'industry_leader'
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, instagram_username)
);

-- Competitor Data Snapshots (raw scraped data)
CREATE TABLE competitor_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    snapshot_date TIMESTAMPTZ NOT NULL,
    follower_count INTEGER,
    following_count INTEGER,
    total_posts INTEGER,
    avg_engagement_rate FLOAT,
    latest_posts JSONB,                        -- Array of { url, caption, likes, comments, type, hashtags }
    bio TEXT,
    profile_pic_url TEXT,
    raw_data JSONB,                            -- Full scraper response
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitor_snap_date ON competitor_snapshots(competitor_id, snapshot_date);

-- AI-Generated Reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('daily_performance', 'weekly_performance', 'competitor_analysis', 'competitive_gap', 'content_recommendation')),
    period_start DATE,
    period_end DATE,
    report_data JSONB NOT NULL,                -- Structured report output dari AI
    markdown_content TEXT,                     -- Formatted report (untuk rendering)
    provider_used TEXT,
    model_used TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analysis Configurations (per-user preferences)
CREATE TABLE analysis_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enable_daily_performance BOOLEAN DEFAULT true,
    enable_competitor_tracking BOOLEAN DEFAULT true,
    enable_sentiment_analysis BOOLEAN DEFAULT true,
    auto_recommend_content BOOLEAN DEFAULT false,
    competitor_scraping_frequency TEXT DEFAULT 'twice_daily',
    notification_email TEXT,
    notification_webhook TEXT,
    apify_api_key_encrypted BYTEA,
    rapidapi_key_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);
```

### 5.2 RLS Policies

```sql
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owns" ON performance_metrics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_owns" ON competitors FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_owns" ON reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_owns" ON analysis_configs FOR ALL USING (auth.uid() = user_id);

-- competitor_snapshots: user must own the parent competitor
CREATE POLICY "user_owns_parent_competitor" ON competitor_snapshots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM competitors
            WHERE competitors.id = competitor_snapshots.competitor_id
            AND competitors.user_id = auth.uid()
        )
    );

-- post_comments: user must own the parent post_queue
CREATE POLICY "user_owns_parent_post" ON post_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM post_queue
            WHERE post_queue.id = post_comments.post_queue_id
            AND post_queue.user_id = auth.uid()
        )
    );
```

---

## 6. AI Prompt Engineering untuk Analysis Tasks

### 6.1 Prinsip Desain Prompt

Semua prompt analysis menggunakan **provider abstraction layer** yang sudah ada (`src/lib/ai/factory.ts`). Ini artinya analysis bisa jalan di Groq, OpenAI, Anthropic, Gemini, atau VPS — tanpa ganti kode.

**Format wajib:** Setiap prompt harus mewajibkan output **JSON terstruktur 100%** (tidak boleh ada teks di luar JSON). Parsing dilakukan dengan try-catch + fallback extraction seperti yang sudah ada di `parseCaptionPackage_()` sistem lama.

### 6.2 Prompt Catalog

| Prompt | File (src/lib/ai/) | Trigger | Output |
|--------|-------------------|---------|--------|
| `buildCaptionPrompt` | `prompts.ts` (existing) | User click | 3 caption choices + hashtags |
| `buildTrendPrompt` | `prompts.ts` (existing) | User click | Weekly topics + post ideas |
| `buildPerformanceReportPrompt` | `reports.ts` (new) | Daily cron | Performance insight + tomorrow recommendation |
| `buildSentimentAnalysisPrompt` | `reports.ts` (new) | After comment fetch | Sentiment scores per comment |
| `buildCompetitiveAnalysisPrompt` | `reports.ts` (new) | Twice daily cron | Gap analysis + content blueprint |
| `buildWeeklySummaryPrompt` | `reports.ts` (new) | Weekly cron | Executive summary untuk meeting |

### 6.3 Model Selection Strategy

| Task | Recommended Provider | Model | Alasan |
|------|---------------------|-------|--------|
| Caption generation | Groq | llama-3.3-70b-versatile | Fast + cheap + good for creative text |
| Performance analysis | OpenAI/Anthropic | gpt-4o-mini / claude-3-haiku | Need structured data reasoning |
| Competitive gap analysis | OpenAI | gpt-4o | Complex multi-variable reasoning |
| Sentiment analysis | Groq | llama-3.3-70b | Fast, classify only |
| Trend insight | Any | Any | Structured creative task |

**Fallback chain (dari factory.ts):** Jika provider #1 gagal → coba provider #2 → #3. Sistem akan log provider mana yang dipakai di `reports.provider_used`.

---

## 7. Data Sources & Integration Strategy

### 7.1 Layer 1: Meta Graph API (Free / Official)

```
POST /api/analysis/performance
    ↓
fetchInstagramInsights(accountId)
    ↓
GET graph.instagram.com/{accountId}/insights
    ?metric=impressions,reach,profile_views,website_clicks
    &period=day
```

```typescript
// src/lib/social/insights.ts
export async function fetchAccountInsights(accountId: string, accessToken: string) {
  const metrics = ['impressions', 'reach', 'profile_views', 'website_clicks', 'follower_count'];
  const url = `https://graph.instagram.com/v25.0/${accountId}/insights?` +
    `metric=${metrics.join(',')}&period=day&access_token=${accessToken}`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchPostInsights(mediaId: string, accessToken: string) {
  const metrics = ['engagement', 'impressions', 'reach', 'saved', 'video_views'];
  const url = `https://graph.instagram.com/v25.0/${mediaId}/insights?` +
    `metric=${metrics.join(',')}&access_token=${accessToken}`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchPostComments(mediaId: string, accessToken: string): Promise<Comment[]> {
  // Paginated, max 100 per request
  const url = `https://graph.instagram.com/v25.0/${mediaId}/comments?` +
    `fields=id,username,text,timestamp,like_count,replies{username,text}&` +
    `limit=100&access_token=${accessToken}`;
  const res = await fetch(url);
  return res.json().data;
}
```

### 7.2 Layer 2: Apify / RapidAPI (Paid — untuk Competitor Data)

```typescript
// src/lib/social/competitor-scraper.ts
export async function scrapeCompetitorProfiles(
  usernames: string[], 
  apifyToken: string
) {
  const response = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?token=${apifyToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames,
        resultsLimit: 12 // Latest 12 posts per competitor
      })
    }
  );
  const run = await response.json();
  
  // Poll until complete (or use webhook)
  const datasetId = run.data.defaultDatasetId;
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`
  );
  return itemsRes.json();
}
```

### 7.3 Layer 3: AI Sentiment (Any Provider)

```typescript
// src/lib/ai/sentiment.ts
export async function analyzeCommentSentiment(
  comment: string, 
  provider: AIProviderClient
) {
  const prompt = `Analisis sentimen komentar berikut. Hanya kembalikan JSON.

Komentar: "${comment}"

{"sentiment": "positive|negative|neutral", "score": -1.0_sampai_1.0, "keywords": ["kata kunci"]}`;

  const result = await provider.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 100
  });
  
  return JSON.parse(result.choices[0].message.content);
}
```

---

## 8. Dashboard: Insight Hub

### 8.1 Struktur Halaman Baru

Tambahkan tab ke-6 di sidebar: **"Insight"** (atau reformat tab Trend Insight yang sudah ada)

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Insight Hub                              [daily] [weekly]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ Performa Kamu        │  │ Kompetitor Watch            │  │
│  │ 📈 Engagement +12%   │  │ @competitor_1 ⬆ 5 posts     │  │
│  │ 👥 Reach 15.2K       │  │ @competitor_2 ➡ 3 posts    │  │
│  │ ⭐ Top Post: Reels   │  │ @competitor_3 ⬇ 2 posts    │  │
│  │    "Promo Lebaran"   │  │                              │  │
│  └─────────────────────┘  └─────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 Competitive Gap Analysis                          │   │
│  │                                                       │   │
│  │ "Kompetitor Anda unggul di konten behind-the-scenes  │   │
│  │  dengan engagement 3x lebih tinggi. Rekomendasi:     │   │
│  │  buat Reels 'Day in the Life' untuk next posting."   │   │
│  │                                          [Gunakan Ide]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📝 Rekomendasi Konten Besok                          │   │
│  │                                                       │   │
│  │ 📹 Format: Reels                                     │   │
│  │ 🎯 Topik: Behind-the-scenes proses produksi          │   │
│  │ 🕐 Waktu: 15:00 WIB (engagement peak)               │   │
│  │ 📊 Prediksi engagement: 5-8%                        │   │
│  │ 💡 Angle: "Tahukah kamu? Proses pembuatan produk X  │   │
│  │    melalui 12 tahap quality check. Ini rahasianya.." │   │
│  │                                          [Generate ➜]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────┐  ┌────────────────────────────┐   │
│  │ Hashtag Intel        │  │ Sentiment Overview         │   │
│  │ 🔥 #BehindTheScenes  │  │ 😊 78% positive            │   │
│  │ 📈 #LocalPride        │  │ 😐 18% neutral            │   │
│  │ 📉 #OOTD (declining)  │  │ 😞 4% negative            │   │
│  └─────────────────────┘  └────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Component Tree

```
InsightHubPage
├── DateRangeSelector (daily | weekly | monthly)
├── PerformanceSnapshot
│   ├── MetricCards (engagement, reach, followers, posts)
│   └── TopPostHighlight
├── CompetitorWatch
│   ├── CompetitorList (avatar, username, post count, engagement)
│   └── CompetitorDetailDialog (latest posts, hashtag usage)
├── GapAnalysisCard
│   ├── AIInsightText (render markdown)
│   └── ActionButton ("Gunakan Ide" → buka dashboard pre-filled)
├── TomorrowRecommendation
│   ├── RecommendedFormat (icon + label)
│   ├── RecommendedTopic
│   ├── RecommendedTime
│   └── GenerateButton (langsung generate caption)
├── HashtagIntel
│   └── TrendChart (rising / declining hashtags)
└── SentimentOverview
    └── DonutChart (positive/neutral/negative)
```

---

## 9. Implementation Priority

### Phase A: Core Analytics (yang bisa jalan TANPA competitor scraper)
**Estimasi: tanpa input kompetitor**

| # | Task | Dependency |
|---|------|------------|
| A1 | Tambah tabel `performance_metrics`, `post_comments`, `reports` | Database schema |
| A2 | Implementasi `fetchAccountInsights()` + `fetchPostInsights()` | Meta token |
| A3 | API endpoint `POST /api/analysis/performance/collect` | A1, A2 |
| A4 | Prompt `buildPerformanceReportPrompt()` + `buildSentimentAnalysisPrompt()` | Prompt engineering |
| A5 | API endpoint `POST /api/analysis/reports/generate?type=daily` | A3, A4 |
| A6 | Frontend: **Insight Hub** page dengan PerformanceSnapshot + SentimentOverview | A5 |
| A7 | Vercel Cron: daily performance collection (08:00) | vercel.json |

### Phase B: Competitive Intelligence (butuh scraper integration)
**Estimasi: dengan Apify / RapidAPI**

| # | Task | Dependency |
|---|------|------------|
| B1 | Tambah tabel `competitors`, `competitor_snapshots`, `analysis_configs` | Database schema |
| B2 | Settings UI: input competitor Instagram usernames + simpan | A1 |
| B3 | Settings UI: konfigurasi Apify API key (terenkripsi) | A1 |
| B4 | Implementasi `scrapeCompetitorProfiles()` via Apify | Apify token |
| B5 | API endpoint `POST /api/analysis/competitors/collect` | B4 |
| B6 | Prompt `buildCompetitiveAnalysisPrompt()` | Prompt engineering |
| B7 | API endpoint `POST /api/analysis/reports/generate?type=competitive` | B5, B6 |
| B8 | Frontend: CompetitorWatch + GapAnalysisCard components | B7 |
| B9 | Vercel Cron: competitor scraping (10:00, 18:00) | vercel.json |

### Phase C: Autonomous Recommendation Engine
**Goal: "Apa yang harus saya posting besok?" — fully automated**

| # | Task | Dependency |
|---|------|------------|
| C1 | Prompt `buildContentRecommendationPrompt()` yang gabungkan performa + kompetitor | A4, B6 |
| C2 | "Gunakan Ide" button — pre-fill dashboard dengan rekomendasi | C1, Frontend |
| C3 | Auto-subscribe ke kompetitor baru via hashtag analysis | Hashtag search API |
| C4 | Weekly executive summary (cocok untuk meeting) | All above |

### Phase D: Realtime & Advanced
| # | Task |
|---|------|
| D1 | Meta Webhook integration (real-time comment & post event) |
| D2 | AI Auto-reply untuk komentar (via Sentiment → generate response) |
| D3 | Predictive Analytics: ML model prediksi engagement sebelum posting |
| D4 | A/B Testing: auto-post 2 variasi caption ke akun kecil, pilih yang menang |

---

## 10. Kesimpulan & Rekomendasi Teknis

### Yang Bisa Langsung Jalan (Week 1-2):
1. **Performance analysis otomatis** — karena pakai Meta Graph API (free, official), tidak butuh scraper
2. **Sentiment analysis komentar** — AI classify komentar existing, tidak butuh data eksternal
3. **Daily report generation** — gabungkan data performa + sentimen, kirim ke AI
4. **Content recommendation** — AI rekomendasi berdasarkan data sendiri

### Yang Butuh Scraper (Week 3-4):
5. **Competitor monitoring otomatis** — perlu Apify/RapidAPI subscription
6. **Gap analysis** — butuh data kompetitor minimal 2 snapshot untuk delta
7. **Hashtag competitive intelligence** — ekstrak dari scraper output

### Provider Rekomendasi untuk Scraping:

| Provider | Harga | Kualitas | Setup Complexity |
|----------|-------|----------|-----------------|
| **Apify Instagram Scraper** | ~$49/bln (1000 profiles) | ⭐⭐⭐⭐⭐ | Low (pre-built actor) |
| **BrightData** | ~$100/bln (pay per GB) | ⭐⭐⭐⭐⭐ | Medium (proxy network) |
| **RapidAPI Instagram** | ~$30/bln (5000 req) | ⭐⭐⭐ | Low (simple REST API) |
| **Instagrapi (self-host)** | Free | ⭐⭐⭐ | High (manage bot accounts) |

**Rekomendasi untuk MVP:** **Apify** — pre-built actor, tidak perlu maintain bot, reliable, cukup panggil REST API.
