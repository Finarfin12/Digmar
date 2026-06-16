# PRD: DigiMar Automation — Migrasi dari Google Apps Script ke Vercel + Supabase

**Versi:** 1.0  
**Tanggal:** 2026-06-16  
**Status:** Draft

---

## 1. Executive Summary

DigiMar Automation (DigiMar Asset Hub / DigiMar Auto-Publisher) adalah dashboard otomatisasi konten media sosial untuk bisnis Indonesia. Saat ini berjalan di **Google Apps Script** dengan **Google Sheets** sebagai database, **Google Drive** sebagai penyimpanan media, dan **Groq API** sebagai satu-satunya AI provider.

Migrasi ini bertujuan memindahkan seluruh sistem ke arsitektur modern:
- **Backend:** Vercel (Next.js API Routes / Serverless Functions)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth (menggantikan PIN + math captcha)
- **AI:** Multi-provider abstraction (Groq, OpenAI, Anthropic, + VPS-based agents)
- **Scheduling:** Vercel Cron Jobs (menggantikan Apps Script time-driven triggers)
- **Frontend:** Next.js (React) — menggantikan `Index.html` monolitik

---

## 2. Current System Architecture (As-Is)

### 2.1 File Inventory

| File | Tipe | Baris | Peran |
|------|------|-------|-------|
| `Kode.gs` | Google Apps Script | 89 | Web app entry point (`doGet`), upload handler |
| `InitSystem.gs` | Google Apps Script | 39 | Bootstrap sheet + Drive folder |
| `Database.gs` | Google Apps Script | 318 | CRUD + analytics + config persistence |
| `API_Groq.gs` | Google Apps Script | 272 | Groq AI integration (LLaMA 3.3 70B) |
| `API_Social.gs` | Google Apps Script | 557 | Meta Graph API + auto-publisher engine |
| `Index.html` | HTML/CSS/JS inline | 974 | Full SPA frontend (5 tab) |
| `JavaScript.html` | JS (legacy) | 312 | Earlier client-side (dead code) |
| `Style.html` | CSS (legacy) | 253 | Earlier stylesheet (dead code) |

### 2.2 Data Model (Google Sheets → Supabase Tables)

#### Sheet: `Unit_Usaha` → Table: `business_units`
| Kolom | Field | Tipe |
|-------|-------|------|
| A | id | UUID (PK, auto) |
| B | brand_name | TEXT |
| C | business_category | TEXT |
| D | ai_system_prompt | TEXT |
| - | user_id | UUID (FK → auth.users) |
| - | created_at | TIMESTAMPTZ |
| - | updated_at | TIMESTAMPTZ |

#### Sheet: `Kredensial_API` → Table: `social_accounts`
| Kolom | Field | Tipe |
|-------|-------|------|
| A | id | UUID (PK, auto) |
| B | business_unit_id | UUID (FK → business_units) |
| C | platform | TEXT (enum: `meta_ig`, `linkedin`, `threads`) |
| D | ig_user_id | TEXT |
| E | access_token | TEXT (ENCRYPTED via pgcrypto/vault) |
| F | token_expiry | TIMESTAMPTZ |
| G | status | TEXT (`active`, `inactive`) |
| - | created_at | TIMESTAMPTZ |
| - | updated_at | TIMESTAMPTZ |

#### Sheet: `Antrean_Posting` → Table: `post_queue`
| Kolom | Field | Tipe |
|-------|-------|------|
| A | id | UUID (PK, auto) |
| B | job_code | TEXT (format: `JOB_yyyyMMddHHmmss_rand`) |
| C | target_accounts | JSONB (array of social_account IDs) |
| D | scheduled_at | TIMESTAMPTZ |
| E | media_urls | JSONB (array of storage URLs) |
| F | caption | TEXT |
| G | status | TEXT (enum: `waiting`, `processing`, `success`, `partial`, `failed`) |
| H | log_messages | JSONB (array of per-account logs) |
| I | post_type | TEXT (enum: `single_image`, `carousel`, `reels`) |
| J | cover_url | TEXT (nullable) |
| - | user_id | UUID (FK → auth.users) |
| - | created_at | TIMESTAMPTZ |
| - | updated_at | TIMESTAMPTZ |

#### Sheet: `Konfigurasi` → Table: `configurations`
| Kolom | Field | Tipe |
|-------|-------|------|
| A | id | UUID (PK, auto) |
| B | key | TEXT (UNIQUE) |
| C | value | TEXT (ENCRYPTED for secrets) |
| - | created_at | TIMESTAMPTZ |
| - | updated_at | TIMESTAMPTZ |

### 2.3 Current API Integrations

| Layanan | Endpoint | Auth |
|---------|----------|------|
| Groq AI | `api.groq.com/openai/v1/chat/completions` | Bearer token |
| Meta Graph API v25.0 | `graph.instagram.com` / `graph.facebook.com` | Access token |
| Google Drive | Upload via `DriveApp.createFile()` | Service account (implicit) |

### 2.4 Current Auth
- **PIN hardcoded:** `1234`
- **Math captcha:** `a + b = ?` (client-side only, trivial)
- **Single-user design:** Tidak ada session, tidak ada multi-user
- **Tidak ada enkripsi token:** Semua access token disimpan plaintext di sheet

---

## 3. Target Architecture (To-Be)

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Edge + Serverless)                │
│                                                                  │
│  ┌──────────────┐   ┌──────────────────────────────────────────┐│
│  │ Next.js App  │   │          API Routes (/api/*)              ││
│  │ (React SPA)  │   │                                           ││
│  │              │   │  /api/auth/*       → Supabase Auth        ││
│  │  5 Tabs UI   │   │  /api/units/*      → Business Units CRUD  ││
│  │  - Dashboard │   │  /api/accounts/*   → Social Accounts CRUD ││
│  │  - Planner   │   │  /api/posts/*      → Post Queue CRUD      ││
│  │  - Analytics │   │  /api/ai/*         → AI Provider Proxy    ││
│  │  - Trends    │   │  /api/publish/*    → Social Publishing    ││
│  │  - Settings  │   │  /api/media/*      → File Upload Handler  ││
│  │              │   │  /api/analytics/*  → Analytics Aggregation ││
│  │              │   │  /api/config/*     → Configuration CRUD   ││
│  └──────────────┘   └──────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐│
│  │   Vercel Cron Jobs   │   │        Edge Middleware           ││
│  │   - process-queue    │   │   - Auth check via Supabase      ││
│  │     (every 1 min)    │   │   - Rate limiting                ││
│  └──────────────────────┘   └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│    SUPABASE     │   │   AI PROVIDERS       │   │   VPS (optional) │
│                 │   │                      │   │                  │
│ • PostgreSQL    │   │ • Groq Cloud         │   │ • Self-hosted    │
│ • Auth (OAuth   │   │ • OpenAI             │   │   AI agents      │
│   + Magic Link) │   │ • Anthropic          │   │ • Custom models  │
│ • Storage (S3)  │   │ • Google Gemini      │   │ • Private API    │
│ • Realtime      │   │ • VPS endpoint       │   │   endpoints      │
│ • Row-Level     │   │   (custom)           │   │                  │
│   Security      │   │                      │   │                  │
└─────────────────┘   └──────────────────────┘   └──────────────────┘
```

---

## 4. Database Migration: Google Sheets → Supabase

### 4.1 Schema Design

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Business Units
CREATE TABLE business_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    business_category TEXT NOT NULL DEFAULT '',
    ai_system_prompt TEXT NOT NULL DEFAULT 'Kamu adalah asisten marketing profesional...',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social Accounts (tokens encrypted via pgcrypto)
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('meta_ig', 'linkedin', 'threads')),
    ig_user_id TEXT NOT NULL,
    access_token_encrypted BYTEA NOT NULL,
    token_expiry TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post Queue
CREATE TABLE post_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_code TEXT NOT NULL UNIQUE,
    target_account_ids JSONB NOT NULL DEFAULT '[]',
    scheduled_at TIMESTAMPTZ NOT NULL,
    media_urls JSONB NOT NULL DEFAULT '[]',
    caption TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'waiting' 
        CHECK (status IN ('waiting', 'processing', 'success', 'partial', 'failed')),
    log_messages JSONB NOT NULL DEFAULT '[]',
    post_type TEXT NOT NULL DEFAULT 'single_image' 
        CHECK (post_type IN ('single_image', 'carousel', 'reels')),
    cover_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Provider Configurations
CREATE TABLE ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL CHECK (provider_name IN ('groq', 'openai', 'anthropic', 'gemini', 'vps')),
    api_key_encrypted BYTEA,
    base_url TEXT,
    model TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 1,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider_name)
);

-- System Configurations
CREATE TABLE configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, key)
);

-- Indexes
CREATE INDEX idx_post_queue_status_scheduled ON post_queue(status, scheduled_at);
CREATE INDEX idx_post_queue_user ON post_queue(user_id);
CREATE INDEX idx_social_accounts_unit ON social_accounts(business_unit_id);
CREATE INDEX idx_ai_providers_user ON ai_providers(user_id, is_active);
```

### 4.2 Row-Level Security (RLS)

```sql
-- All tables are user-scoped
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "Users see own data" ON business_units
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own data" ON social_accounts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM business_units 
            WHERE business_units.id = social_accounts.business_unit_id 
            AND business_units.user_id = auth.uid()
        )
    );

CREATE POLICY "Users see own data" ON post_queue
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own data" ON ai_providers
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own data" ON configurations
    FOR ALL USING (auth.uid() = user_id);
```

### 4.3 Encryption Strategy

Token dan API key disimpan terenkripsi menggunakan **pgcrypto** dengan server-side encryption key yang disimpan di environment variable `ENCRYPTION_KEY`.

```sql
-- Helper functions
CREATE OR REPLACE FUNCTION encrypt_value(plaintext TEXT, enc_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(plaintext, enc_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_value(ciphertext BYTEA, enc_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(ciphertext, enc_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.4 Media Storage → Supabase Storage

| Google Drive | Supabase Storage |
|-------------|-----------------|
| `DigiMar Assets/` folder | Bucket: `digimar-media` |
| `ANYONE_WITH_LINK` sharing | Public bucket dengan signed URLs |
| `drive.google.com/uc?export=download&id={id}` | `{SUPABASE_URL}/storage/v1/object/public/digimar-media/{path}` |

---

## 5. Backend Migration: Apps Script → Vercel (Next.js API Routes)

### 5.1 Project Structure (Next.js App Router)

```
digimar-next/
├── .env.local                      # Environment variables
├── next.config.js
├── package.json
├── supabase/
│   ├── migrations/                 # Database migrations
│   └── config.toml
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Dashboard (Beranda)
│   │   ├── dashboard/              
│   │   │   ├── planner/page.tsx    # Planner tab
│   │   │   ├── analytics/page.tsx  # Analytics tab
│   │   │   ├── trends/page.tsx     # Trend Insight tab
│   │   │   └── settings/page.tsx   # Settings tab
│   │   └── auth/
│   │       └── callback/route.ts   # Auth callback
│   ├── api/
│   │   ├── auth/                   # Supabase Auth proxy
│   │   ├── units/                  # CRUD business units
│   │   │   ├── route.ts           # GET (list), POST (create)
│   │   │   └── [id]/route.ts      # GET, PUT, DELETE
│   │   ├── accounts/              # CRUD social accounts
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── posts/                 # Post queue management
│   │   │   ├── route.ts           # GET (list), POST (schedule)
│   │   │   └── [id]/route.ts      # GET, PUT (reschedule), DELETE
│   │   ├── ai/                    # AI provider proxy
│   │   │   ├── caption/route.ts   # POST → generate caption
│   │   │   ├── trends/route.ts    # POST → generate trend insight
│   │   │   └── providers/route.ts # GET/POST manage providers
│   │   ├── publish/               # Publishing endpoints
│   │   │   ├── process/route.ts   # POST → manual queue processing
│   │   │   └── webhook/route.ts   # Meta webhook (future)
│   │   ├── media/                 # File upload
│   │   │   ├── upload/route.ts    # POST → upload to Supabase Storage
│   │   │   └── [path]/route.ts    # GET → serve media
│   │   ├── analytics/
│   │   │   └── dashboard/route.ts # GET → aggregated analytics
│   │   └── config/                # System configuration
│   │       └── route.ts           # GET/PUT
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser client
│   │   │   ├── server.ts          # Server client (service role)
│   │   │   └── middleware.ts      
│   │   ├── ai/
│   │   │   ├── providers/         # AI provider implementations
│   │   │   │   ├── groq.ts
│   │   │   │   ├── openai.ts
│   │   │   │   ├── anthropic.ts
│   │   │   │   ├── gemini.ts
│   │   │   │   └── vps.ts
│   │   │   ├── factory.ts        # Provider factory/router
│   │   │   ├── caption.ts        # Caption generation logic
│   │   │   └── trends.ts         # Trend insight logic
│   │   ├── social/
│   │   │   ├── meta.ts           # Meta Graph API client
│   │   │   ├── publisher.ts      # Publishing orchestrator
│   │   │   └── types.ts          # Social API types
│   │   ├── crypto/
│   │   │   └── server.ts         # pgcrypto wrapper
│   │   └── utils/
│   │       ├── job-code.ts       # JOB_yyyyMMddHHmmss_rand generator
│   │       ├── format.ts         # Date/response formatting
│   │       └── validation.ts     # Zod schemas
│   ├── components/
│   │   ├── ui/                   # Shared UI components
│   │   ├── dashboard/            # Dashboard components
│   │   ├── planner/              # Calendar + drag-drop
│   │   ├── trends/               # Trend insight components
│   │   └── settings/             # Settings forms
│   └── types/
│       └── index.ts              # Shared TypeScript types
├── middleware.ts                  # Auth middleware
└── vercel.json                   # Cron job config
```

### 5.2 API Route Mapping

| Apps Script (`google.script.run`) | Next.js API Route |
|------------------------------------|-------------------|
| `getDaftarUnitUsaha()` | `GET /api/units` |
| `getDaftarAkun(unitId)` | `GET /api/accounts?unit_id={id}` |
| `getDaftarAntrean()` | `GET /api/posts?limit=10` |
| `getDashboardAnalytics()` | `GET /api/analytics/dashboard` |
| `simpanUnitUsaha(formData)` | `POST /api/units` |
| `simpanKredensialApi(formData)` | `POST /api/accounts` |
| `generateCaptionFromGroq(unitId, context, tone)` | `POST /api/ai/caption` |
| `generateTrendInsight(unitId, category, competitors)` | `POST /api/ai/trends` |
| `uploadImageToDrive(fileData)` | `POST /api/media/upload` |
| `uploadMediaToDrive(fileData)` | `POST /api/media/upload` |
| `schedulePost(postData)` | `POST /api/posts` |
| `reschedulePost(jobId, newTime)` | `PUT /api/posts/{id}` |
| `checkSystemStatus()` | `GET /api/config` |
| `processQueue()` (trigger) | Vercel Cron: `GET /api/publish/process` |

### 5.3 Scheduling: Apps Script Triggers → Vercel Cron

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/publish/process",
      "schedule": "* * * * *"
    }
  ]
}
```

**Catatan:** Vercel Cron memiliki batasan:
- Maksimal durasi: 10 detik (Hobby), 60 detik (Pro)
- Rate limit: 1 invocation per menit per project (Hobby)

**Mitigasi:** Gunakan **Upstash QStash** atau **Trigger.dev** sebagai alternatif jika dibutuhkan interval lebih cepat atau durasi lebih panjang.

---

## 6. AI Provider Abstraction Layer (NILAI TAMBAH UTAMA)

### 6.1 Arsitektur Multi-Provider

```
┌──────────────────────────────────────────────────────┐
│                    /api/ai/*                          │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              AI Provider Factory                 │ │
│  │  (src/lib/ai/factory.ts)                        │ │
│  │                                                  │ │
│  │  1. Baca konfigurasi provider dari ai_providers  │ │
│  │  2. Cari provider aktif dengan priority terendah │ │
│  │  3. Instantiate provider client                 │ │
│  │  4. Route request ke provider yang tepat        │ │
│  │  5. Fallback ke provider berikutnya jika gagal  │ │
│  └──────────┬──────────┬──────────┬────────────────┘ │
│             │          │          │                   │
│     ┌───────▼──┐ ┌─────▼───┐ ┌───▼──────┐            │
│     │  Groq    │ │ OpenAI  │ │ Anthropic│   ...      │
│     │  Client  │ │ Client  │ │ Client   │            │
│     └───────┬──┘ └─────┬───┘ └───┬──────┘            │
│             │          │          │                   │
└─────────────┼──────────┼──────────┼───────────────────┘
              │          │          │
              ▼          ▼          ▼
        api.groq.com  api.openai.com  api.anthropic.com
```

### 6.2 Provider Configuration (via Settings UI)

```typescript
// src/lib/ai/providers/types.ts
interface AIProviderConfig {
  provider_name: 'groq' | 'openai' | 'anthropic' | 'gemini' | 'vps';
  api_key_encrypted?: string;
  base_url?: string;       // Untuk VPS: https://my-vps:8000/v1
  model?: string;           // Default model
  is_active: boolean;
  priority: number;         // 1 = primary, 2 = fallback, dst.
  config: {
    temperature?: number;
    max_tokens?: number;
    system_prompt_override?: string;
  };
}
```

### 6.3 Provider Implementations

#### Groq (Primary — existing)
```typescript
// src/lib/ai/providers/groq.ts
// Model: llama-3.3-70b-versatile
// Endpoint: https://api.groq.com/openai/v1/chat/completions
// Auth: Bearer token
// Compatibility: OpenAI-compatible SDK
```

#### OpenAI
```typescript
// src/lib/ai/providers/openai.ts
// Model: gpt-4o / gpt-4o-mini
// Endpoint: https://api.openai.com/v1/chat/completions
// Auth: Bearer token
```

#### Anthropic
```typescript
// src/lib/ai/providers/anthropic.ts
// Model: claude-3-5-sonnet / claude-3-haiku
// Endpoint: https://api.anthropic.com/v1/messages
// Auth: x-api-key header
```

#### Google Gemini
```typescript
// src/lib/ai/providers/gemini.ts
// Model: gemini-pro / gemini-flash
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// Auth: API key query param
```

#### VPS Provider (Custom)
```typescript
// src/lib/ai/providers/vps.ts
// Model: User-defined (e.g., llama3-self-hosted, mixtral, custom fine-tune)
// Endpoint: User-configured base_url (e.g., https://my-vps.example.com:8000/v1)
// Auth: Bearer token (user-configured)
// Protocol: OpenAI-compatible API (gunakan Ollama, vLLM, llama.cpp server, LiteLLM, dll.)
```

### 6.4 Provider Factory

```typescript
// src/lib/ai/factory.ts
export async function getAIProvider(userId: string, preferredProvider?: string) {
  // 1. Query ai_providers table ordered by priority
  // 2. Filter active providers
  // 3. Jika preferredProvider diberikan, gunakan itu dulu
  // 4. Instantiate client dengan konfigurasi dari database
  // 5. Return { client, model, temperature, max_tokens }
}

export async function generateCaption(params: {
  userId: string;
  businessUnitId: string;
  promptContext: string;
  toneVoice: string;
  preferredProvider?: string;
}) {
  const { client, model, temperature, max_tokens } = await getAIProvider(userId, preferredProvider);
  const unit = await getBusinessUnit(businessUnitId);
  
  return client.chat.completions.create({
    model,
    temperature: temperature || 0.85,
    max_tokens: max_tokens || 1600,
    messages: [
      { role: 'system', content: unit.ai_system_prompt },
      { role: 'user', content: buildCaptionPrompt(promptContext, toneVoice) }
    ]
  });
}
```

### 6.5 Prompt Preservation (migrasi dari API_Groq.gs)

Semua prompt engineering yang ada di `API_Groq.gs` harus dipreservasi 1:1. Perbedaannya hanya pada layer abstraksi — prompt yang sama dikirim ke provider manapun yang dipilih user.

**Prompt Caption (dari API_Groq.gs baris 93-151):** System prompt bisnis unit + instruksi menghasilkan 3 pilihan caption, hashtag, keyword cloud, dan rekomendasi storytelling musiman.

**Prompt Trend Insight (dari API_Groq.gs baris 163-239):** Instruksi menghasilkan topik mingguan, angle konten unik, hashtag/keyword, dan 5 ide postingan siap pakai.

### 6.6 Configuration UI (Settings Tab)

Tambahkan section baru di halaman Settings:

```
┌─────────────────────────────────────────────────────┐
│  ⚙️ Konfigurasi AI Provider                         │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Provider  │ Status  │ Priority │ Model       │  │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ 🟢 Groq   │ Active  │    1     │ llama-3.3.. │✏️│ │
│  │ ⚪ OpenAI │ Inactive│    2     │ gpt-4o      │✏️│ │
│  │ 🟢 VPS    │ Active  │    3     │ mixtral-8x7b│✏️│ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [+ Tambah Provider]                                 │
│                                                      │
│  ┌─ VPS Configuration ─────────────────────────────┐ │
│  │  Base URL: [https://my-vps:8000/v1         ]    │ │
│  │  API Key:  [••••••••••••••••••••••••       ]    │ │
│  │  Model:    [llama3-70b-custom              ]    │ │
│  │  Default Temperature: [0.85]                    │ │
│  │  Default Max Tokens:  [1600]                    │ │
│  │  ☑ Use as fallback when primary fails           │ │
│  │  [Test Connection]  [Save]                      │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 7. Auth Migration: PIN → Supabase Auth

### 7.1 Auth Methods

| Fitur | Current (Apps Script) | Target (Supabase Auth) |
|-------|----------------------|----------------------|
| Login method | PIN `1234` + math captcha | Email/Password + Magic Link |
| Session | None | JWT (auto-refresh) |
| Multi-user | ❌ Single user | ✅ Full multi-tenant |
| Social login | ❌ | ✅ Google OAuth (optional) |
| Password reset | ❌ | ✅ Built-in |
| Rate limiting | ❌ | ✅ Via Supabase + middleware |

### 7.2 Implementation

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: Request) {
  const { supabase, response } = createServerClient(request)
  const { data: { session } } = await supabase.auth.getSession()
  
  // Redirect unauthenticated users (except API routes & auth pages)
  if (!session && !request.url.includes('/auth') && !request.url.includes('/api/')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  
  return response
}
```

### 7.3 Auth UI

Gunakan **Supabase Auth UI** (pre-built React components) untuk halaman login/register yang clean dan aman. Tidak perlu membangun custom auth UI dari nol untuk MVP.

---

## 8. Frontend Migration: Index.html → Next.js

### 8.1 Technology Stack

| Layer | Current | Target |
|-------|---------|--------|
| Framework | Vanilla HTML/CSS/JS inline | Next.js 14+ (App Router) |
| Language | JavaScript (no types) | TypeScript (strict) |
| Styling | Inline CSS + custom classes | Tailwind CSS |
| State Management | Global variables | React hooks / Zustand |
| HTTP Client | `google.script.run` | TanStack Query + fetch |
| Icons | Boxicons CDN | Lucide React |
| Alerts | SweetAlert2 CDN | Sonner (toast) + custom dialog |
| Charts | None currently | Recharts (untuk Analytics) |
| Markdown | Marked.js CDN | react-markdown |
| Drag & Drop | Native HTML5 DnD | @dnd-kit/core |
| File Upload | Native FileReader | react-dropzone |

### 8.2 Component Tree

```
Layout
├── Sidebar (Navigation)
│   ├── Logo + Brand
│   ├── NavItem: Beranda
│   ├── NavItem: Planner
│   ├── NavItem: Analytics
│   ├── NavItem: Trend Insight
│   ├── NavItem: Settings
│   └── User Menu (avatar, logout)
├── Dashboard Page
│   ├── BusinessUnitSelector
│   ├── PostTypeSelector (SingleImage | Carousel | Reels)
│   ├── MediaDropzone (with preview)
│   ├── MediaPreviewGrid (size/duration warnings)
│   ├── ToneVoiceSelector
│   ├── ContextInput
│   ├── GenerateCaptionButton
│   ├── CaptionResults (3 choices + hashtags)
│   ├── InstagramMockup (preview)
│   ├── ScheduleDateTimePicker
│   └── ScheduleButton (with progress)
├── Planner Page
│   ├── MonthCalendar (density heatmap)
│   ├── DayDetailPanel
│   ├── DragDropReschedule (via @dnd-kit)
│   └── ManualRescheduleForm
├── Analytics Page
│   ├── MonthlySummaryCards
│   ├── BestPostingHourChart (Recharts)
│   ├── PerUnitBreakdown
│   ├── StatusBreakdown
│   └── TopPostHighlight
├── Trend Insight Page
│   ├── TopicIdeasList
│   ├── ContentAngles
│   ├── HashtagCloud
│   ├── SeasonalStorytellingCards
│   ├── FiveReadyPostIdeas
│   └── CompetitorWatch (input + results)
└── Settings Page
    ├── BusinessUnitsManager
    │   ├── UnitList
    │   └── AddEditUnitForm
    ├── SocialAccountsManager
    │   ├── AccountList (by unit)
    │   └── AddEditAccountForm
    └── AIProvidersManager (NEW)
        ├── ProviderList (dengan status, priority, model)
        ├── AddEditProviderForm
        └── TestConnectionButton
```

### 8.3 State Management dengan TanStack Query

```typescript
// Example: Fetch business units
const { data: units, isLoading } = useQuery({
  queryKey: ['business-units'],
  queryFn: () => fetch('/api/units').then(r => r.json())
})

// Example: Generate caption
const captionMutation = useMutation({
  mutationFn: (params: CaptionParams) => 
    fetch('/api/ai/caption', { 
      method: 'POST', 
      body: JSON.stringify(params) 
    }).then(r => r.json())
})
```

---

## 9. API Endpoint Specifications

### 9.1 POST /api/ai/caption

```typescript
// Request
{
  business_unit_id: string;       // UUID
  prompt_context: string;         // Brief konteks (e.g., "Promo lebaran diskon 50%")
  tone_voice: 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational';
  preferred_provider?: string;    // 'groq' | 'openai' | 'anthropic' | 'gemini' | 'vps'
}

// Response
{
  captions: [
    { id: 1, text: "...", hashtags: "..." },
    { id: 2, text: "...", hashtags: "..." },
    { id: 3, text: "...", hashtags: "..." }
  ],
  keyword_cloud: ["keyword1", "keyword2", ...],
  seasonal_storytelling: "...",
  total_tokens: 1234,
  provider_used: "groq",
  model_used: "llama-3.3-70b-versatile"
}
```

### 9.2 POST /api/ai/trends

```typescript
// Request
{
  business_unit_id: string;
  category: string;
  competitor_accounts?: string[];
  preferred_provider?: string;
}

// Response
{
  week_topics: string[],
  content_angles: string[],
  hashtag_keyword_map: Record<string, string[]>,
  seasonal_ideas: string,
  post_ideas: Array<{ title: string, angle: string, format: string }>,
  provider_used: string,
  model_used: string
}
```

### 9.3 POST /api/posts (Schedule)

```typescript
// Request
{
  business_unit_id: string;
  target_account_ids: string[];     // UUID array
  scheduled_at: string;             // ISO 8601
  media_urls: string[];             // Supabase Storage URLs
  caption: string;
  post_type: 'single_image' | 'carousel' | 'reels';
  cover_url?: string;
}

// Response
{
  job_code: "JOB_20260616_143022_a1b2c3",
  status: "waiting",
  scheduled_at: "2026-06-16T14:30:22Z"
}
```

### 9.4 POST /api/media/upload

```typescript
// Request: multipart/form-data
// - file: File (image/jpeg, image/png, video/mp4)
// - max_size: 100MB (video), 10MB (image)

// Response
{
  url: "https://xxx.supabase.co/storage/v1/object/public/digimar-media/user-id/filename.jpg",
  path: "user-id/filename.jpg",
  size: 2456789,
  mime_type: "image/jpeg"
}
```

### 9.5 Public Media Access

Supabase Storage bucket dikonfigurasi sebagai **public** sehingga Instagram/Meta dapat mengunduh media untuk diproses, identik dengan pola `ANYONE_WITH_LINK` di Google Drive.

---

## 10. Publishing Engine (Meta Graph API v25.0)

### 10.1 Preservasi Logika dari API_Social.gs

Semua logika publishing di `API_Social.gs` harus dimigrasi 1:1 ke `src/lib/social/meta.ts`:

1. **Token type detection:** `isInstagramLoginToken_()` → check prefix `IGQ`/`IGQV`/`IGS`
2. **Single image:** POST container → wait 3s → POST publish
3. **Carousel:** POST individual children → POST carousel container → POST publish
4. **Reels:** POST video container → poll status (max 10×, 6s interval) → POST publish
5. **Error handling:** Log per-account, status `partial` jika sebagian gagal

### 10.2 Concurrency & Locking

Apps Script menggunakan `LockService.getScriptLock()` (30s timeout). Di Vercel:

```typescript
// Gunakan Supabase advisory lock untuk mencegah concurrent processing
async function acquireProcessingLock(): Promise<boolean> {
  const { data } = await supabase.rpc('pg_try_advisory_lock', { lock_id: 1 })
  return data === true
}

async function releaseProcessingLock(): Promise<void> {
  await supabase.rpc('pg_advisory_unlock', { lock_id: 1 })
}
```

Atau alternatif: gunakan **Upstash Redis** sebagai distributed lock untuk multi-instance Vercel.

### 10.3 Vercel Cron untuk processQueue

```typescript
// src/app/api/publish/process/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Acquire lock
  const locked = await acquireProcessingLock()
  if (!locked) {
    return Response.json({ message: 'Already processing' })
  }

  try {
    const jobs = await getDueJobs()
    for (const job of jobs) {
      await processJob(job)
    }
    return Response.json({ processed: jobs.length })
  } finally {
    await releaseProcessingLock()
  }
}
```

---

## 11. VPS Integration (AI Agent & Model Hosting)

### 11.1 Use Case

User dapat menghubungkan DigiMar ke VPS pribadi yang menjalankan:
- **Ollama** — self-hosted LLM (Llama 3, Mistral, Gemma, dll.)
- **vLLM** — high-throughput inference server
- **llama.cpp server** — lightweight inference
- **LiteLLM Proxy** — unified proxy untuk multiple self-hosted models
- **Custom AI Agents** — agent berbasis LangChain/AutoGen dengan tools khusus

### 11.2 Konfigurasi VPS Provider

Di halaman Settings → AI Providers, user dapat menambahkan VPS provider:

```
Provider Name: VPS (Custom)
Base URL: https://my-vps.example.com:8000/v1
API Key: sk-custom-key-xxxxxxxx
Model: llama3-70b-custom-finetune
Temperature: 0.85
Max Tokens: 1600
```

### 11.3 VPS Provider Implementation

```typescript
// src/lib/ai/providers/vps.ts
import OpenAI from 'openai'

export function createVPSClient(baseURL: string, apiKey: string) {
  return new OpenAI({
    baseURL,           // e.g., https://my-vps:8000/v1
    apiKey,            // Custom API key configured on VPS
    timeout: 30000,    // 30s timeout (VPS mungkin lebih lambat)
  })
}
```

Karena VPS provider menggunakan OpenAI-compatible API, kita bisa menggunakan SDK OpenAI yang sama dengan Groq — hanya berbeda `baseURL`.

### 11.4 Keamanan VPS

- Gunakan **HTTPS** (Let's Encrypt via Nginx reverse proxy atau Caddy)
- **API key authentication** di VPS endpoint
- **Firewall:** Allow hanya dari IP Vercel (bisa dikonfigurasi via Vercel Secure Compute jika diperlukan)
- **VPN/wireguard tunnel** untuk koneksi yang lebih aman (opsional, untuk production)

---

## 12. Implementation Phases

### Phase 1: Foundation (Database + Auth + Core Setup)
**Goal:** Supabase siap, Next.js project berdiri, auth berfungsi, database schema deployed.

- [ ] Buat project Supabase (database + auth + storage)
- [ ] Jalankan migration SQL (semua tabel, RLS, encryption helpers)
- [ ] Setup Supabase Storage bucket `digimar-media` (public)
- [ ] Init Next.js project dengan TypeScript + Tailwind
- [ ] Install dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `openai`, `zod`, `@tanstack/react-query`
- [ ] Setup Supabase Auth UI (login/register/logout)
- [ ] Implement middleware untuk route protection
- [ ] Setup environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET`

### Phase 2: Core CRUD + Migrasi Data
**Goal:** Semua operasi CRUD (business units, accounts, posts) berfungsi via API routes, data lama bisa diimpor.

- [ ] `GET/POST /api/units` + `GET/PUT/DELETE /api/units/[id]`
- [ ] `GET/POST /api/accounts` + `GET/PUT/DELETE /api/accounts/[id]`
- [ ] `GET/POST /api/posts` + `GET/PUT/DELETE /api/posts/[id]`
- [ ] Encryption helpers untuk access token (pgcrypto)
- [ ] Data migration script: export dari Google Sheets → import ke Supabase
- [ ] `POST /api/media/upload` (Supabase Storage)
- [ ] `GET /api/config` + `PUT /api/config`

### Phase 3: AI Provider Abstraction
**Goal:** Multi-provider AI fully functional — Groq + OpenAI + Anthropic + Gemini + VPS.

- [ ] `src/lib/ai/providers/groq.ts` — implementasi Groq client
- [ ] `src/lib/ai/providers/openai.ts` — implementasi OpenAI client
- [ ] `src/lib/ai/providers/anthropic.ts` — implementasi Anthropic client
- [ ] `src/lib/ai/providers/gemini.ts` — implementasi Gemini client
- [ ] `src/lib/ai/providers/vps.ts` — implementasi custom VPS client
- [ ] `src/lib/ai/factory.ts` — provider factory + fallback logic
- [ ] `src/lib/ai/caption.ts` — caption generation (preserve prompt dari API_Groq.gs)
- [ ] `src/lib/ai/trends.ts` — trend insight generation
- [ ] `POST /api/ai/caption`
- [ ] `POST /api/ai/trends`
- [ ] `GET/POST /api/ai/providers` — manage provider configurations

### Phase 4: Social Publishing Engine
**Goal:** Auto-publisher fully functional — publish ke Instagram via Meta Graph API.

- [ ] `src/lib/social/meta.ts` — Meta Graph API client (v25.0)
- [ ] `src/lib/social/publisher.ts` — Publishing orchestrator (single/carousel/reels)
- [ ] Advisory lock mechanism (pg_try_advisory_lock atau Redis)
- [ ] `POST /api/publish/process` — manual trigger
- [ ] `vercel.json` cron configuration
- [ ] Auth header verification for cron endpoint

### Phase 5: Frontend (Next.js UI)
**Goal:** Full SPA frontend menggantikan `Index.html` dengan UI modern.

- [ ] Layout + Sidebar navigasi
- [ ] Dashboard page (Beranda): unit selector, post type, media upload, caption generation, mockup, schedule
- [ ] Planner page: calendar view, drag-drop reschedule
- [ ] Analytics page: statistik bulanan, chart, breakdown
- [ ] Trend Insight page: AI insight display, markdown rendering
- [ ] Settings page: units, accounts, AI providers management
- [ ] Toast notifications (Sonner)
- [ ] Loading states + error handling
- [ ] Responsive design (mobile + desktop)

### Phase 6: Testing & Polish
- [ ] Unit tests untuk lib/ai/ — mock provider responses
- [ ] Integration tests untuk API routes
- [ ] End-to-end test: upload → schedule → process → publish
- [ ] Error handling edge cases (token expired, rate limit, network failure)
- [ ] Performance optimization (image optimization via next/image)

### Phase 7: VPS Connection & Advanced Features
- [ ] VPS provider testing endpoint (`POST /api/ai/providers/test`)
- [ ] Health check monitoring untuk VPS endpoint
- [ ] LinkedIn dan Threads publishing (saat ini placeholder)
- [ ] Meta webhook untuk real-time post status
- [ ] Multi-user collaboration (opsional)

---

## 13. Environment Variables

```bash
# .env.local
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Encryption (untuk access token + API keys di database)
ENCRYPTION_KEY=32-char-random-string-here-xxx

# Vercel Cron
CRON_SECRET=random-secret-for-cron-auth

# Default AI Provider (opsional)
DEFAULT_AI_PROVIDER=groq
DEFAULT_AI_MODEL=llama-3.3-70b-versatile

# Akses Meta Graph API (no keys needed — per-account tokens disimpan di DB)
META_API_VERSION=v25.0

# Supabase Storage
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://xxxxx.supabase.co/storage/v1/object/public/digimar-media
```

---

## 14. Dependencies

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "openai": "^4.x",
    "@anthropic-ai/sdk": "^0.x",
    "@google/generative-ai": "^0.x",
    "zod": "^3.x",
    "@tanstack/react-query": "^5.x",
    "@dnd-kit/core": "^6.x",
    "@dnd-kit/sortable": "^8.x",
    "react-dropzone": "^14.x",
    "react-markdown": "^9.x",
    "recharts": "^2.x",
    "sonner": "^1.x",
    "lucide-react": "^0.x",
    "date-fns": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tailwindcss": "^3.x",
    "@types/react": "^18.x",
    "@types/node": "^20.x",
    "vitest": "^1.x",
    "@testing-library/react": "^14.x"
  }
}
```

---

## 15. Risk Assessment & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Vercel Cron timeout (10s Hobby) | Queue tidak terproses tepat waktu | Upgrade ke Pro (60s) atau gunakan Upstash QStash |
| Supabase rate limit pada free tier | Upload/download lambat | Pantau usage, upgrade jika perlu |
| Meta token expiration mendadak | Post gagal | Implementasi token refresh flow + notifikasi expiring tokens |
| Encrypted data corruption | Token hilang | Backup database reguler + export encrypted data |
| VPS endpoint unreachable | AI generation gagal | Provider fallback chain (VPS → Groq → OpenAI) |
| Concurrent cron invocation (multi-instance Vercel) | Double posting | Advisory lock via Supabase/Redis |
| Breaking changes Meta Graph API | Publishing error | Version pinning (`v25.0`), monitor changelog |

---

## 16. Migration Checklist

### Data Migration (Google Sheets → Supabase)

1. **Export dari Google Sheets:**
   - Download semua sheet sebagai CSV
   - `Unit_Usaha.csv`, `Kredensial_API.csv`, `Antrean_Posting.csv`, `Konfigurasi.csv`

2. **Transform data:**
   - Map kolom sheet ke kolom database
   - Generate UUID untuk setiap row (id)
   - Enkripsi access token dan API key dengan `encrypt_value()`
   - Konversi format tanggal dari Sheets ke ISO 8601
   - Map status: `Menunggu` → `waiting`, `Diproses` → `processing`, dst.

3. **Import ke Supabase:**
   - Gunakan Supabase dashboard SQL editor atau script Node.js
   - Insert ke tabel yang sesuai dengan RLS disabled sementara
   - Verify row counts match

4. **Media Migration (Google Drive → Supabase Storage):**
   - Download semua file dari folder `DigiMar Assets`
   - Upload ke Supabase Storage bucket `digimar-media`
   - Update URL di `post_queue.media_urls`

### Verification

- [ ] Semua business units ter-migrasi dengan user_id yang benar
- [ ] Semua social accounts terenkripsi dengan benar
- [ ] Semua post queue jobs memiliki status yang akurat
- [ ] Semua media dapat diakses via Supabase Storage URL
- [ ] Groq caption generation menghasilkan output yang sama dengan sistem lama
- [ ] Meta Graph API publishing berhasil untuk single image, carousel, dan reels
- [ ] Vercel cron berjalan setiap menit dan memproses queue

---

## 17. Success Criteria

1. ✅ **Semua 5 tab berfungsi** di Next.js UI dengan experience yang sama atau lebih baik
2. ✅ **Multi-provider AI** berfungsi: Groq (existing), OpenAI, Anthropic, Gemini, + VPS custom endpoint
3. ✅ **Publishing ke Instagram** via Meta Graph API berfungsi untuk semua post type
4. ✅ **Auto-publisher** berjalan via Vercel Cron setiap 1 menit
5. ✅ **Auth yang aman** via Supabase Auth (bukan PIN hardcoded)
6. ✅ **Token terenkripsi** di database (bukan plaintext di sheet)
7. ✅ **Data lama ter-migrasi** tanpa kehilangan
8. ✅ **VPS endpoint** dapat dikonfigurasi dan digunakan sebagai AI provider

---

## Appendix A: Perbandingan Arsitektur

| Aspek | Current (Apps Script) | Target (Vercel + Supabase) |
|-------|----------------------|---------------------------|
| **Runtime** | Google Apps Script (V8) | Node.js 20+ (Vercel serverless) |
| **Database** | Google Sheets (flat file) | PostgreSQL (relational, indexed) |
| **Storage** | Google Drive (public folder) | Supabase Storage (S3-compatible) |
| **Auth** | PIN `1234` + math captcha | Supabase Auth (email/password + magic link) |
| **Security** | Plaintext tokens in sheets | pgcrypto encrypted tokens + RLS |
| **AI** | Groq only | Multi-provider (Groq, OpenAI, Anthropic, Gemini, VPS) |
| **Scheduling** | Apps Script time-driven triggers | Vercel Cron / Upstash QStash |
| **Frontend** | Vanilla HTML/CSS/JS (inline) | React + TypeScript + Tailwind |
| **Type Safety** | None | TypeScript strict mode |
| **Testing** | Manual | Vitest + React Testing Library |
| **Multi-user** | No | Yes (via Supabase Auth + RLS) |
| **Deployment** | Manual copy-paste ke Apps Script editor | `git push` → Vercel auto-deploy |
| **Versioning** | Manual backup | Git + GitHub |

## Appendix B: Prompt Template Preservation

Prompt AI yang ada di `API_Groq.gs` harus dipreservasi persis. Format output JSON yang di-parse oleh `parseCaptionPackage_()` juga harus tetap kompatibel:

```json
{
  "pilihan_1": { "caption": "...", "hashtag": "..." },
  "pilihan_2": { "caption": "...", "hashtag": "..." },
  "pilihan_3": { "caption": "...", "hashtag": "..." },
  "keyword_cloud": ["word1", "word2", "..."],
  "cerita_musiman": "..."
}
```
