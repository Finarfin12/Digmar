# Strategi AI-Powered Scraper dengan Akun Sosial Media — DigiMar Automation

**Tanggal:** 2026-06-16
**Status:** Blueprint / Riset Teknis

---

## 1. Konsep Dasar

Menggantikan layanan scraper berbayar (Apify/RapidAPI) dengan **AI agent yang mengoperasikan akun fake sosial media** untuk mengakses dan menganalisis data kompetitor secara langsung — persis seperti manusia yang melihat profil dan konten kompetitor.

```
┌────────────────────────────────────────────────────────────────────┐
│                       VPS / Server (24/7)                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │                   AI Scraper Agent                         │    │
│  │                                                            │    │
│  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │    │
│  │  │ Browser     │    │  AI Vision   │    │  Data Parser  │  │    │
│  │  │ Automation  │───▶│  + LLM       │───▶│  → database   │  │    │
│  │  │ (Playwright)│    │  (screenshot │    │               │  │    │
│  │  │             │    │   + DOM)     │    │               │  │    │
│  │  └─────────────┘    └──────────────┘    └──────────────┘  │    │
│  │         │                                                  │    │
│  └─────────┼──────────────────────────────────────────────────┘    │
│            │                                                        │
│            ▼                                                        │
│  ┌─────────────────────────────────────────────────┐              │
│  │        Proxy Layer (Rotating Residential IP)    │              │
│  │        - BrightData / IPRoyal / Smartproxy       │              │
│  └─────────────────────────────────────────────────┘              │
│            │                                                        │
└────────────┼────────────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │   Instagram     │
    │   (competitor   │
    │    profiles)    │
    └─────────────────┘
```

---

## 2. Arsitektur Detail

### 2.1 Akun Fake sebagai "Observation Node"

Setiap akun fake adalah **pair of eyes** yang dimiliki sistem. Akun ini:

- **TIDAK** memposting konten
- **TIDAK** follow banyak akun
- **HANYA** melihat profil kompetitor + scroll feed mereka
- **HANYA** membaca dan "mengamati"

Konsep: Akun fake ini seolah "orang biasa" yang iseng lihat-lihat profil. Tidak ada interaksi mencurigakan.

### 2.2 Komponen Teknis

| Komponen | Teknologi | Peran |
|----------|-----------|-------|
| **Browser Engine** | Playwright (headful, bukan headless) | Membuka Instagram seperti manusia |
| **Proxy** | Rotating residential IP (BrightData / IPRoyal) | Setiap akun fake punya IP residensial berbeda |
| **Session Manager** | Playwright `persistentContext` | Simpan cookies/login state tiap akun |
| **AI Vision** | GPT-4o / Claude Vision / Groq LLaMA Vision | Baca screenshot untuk ekstrak data |
| **AI DOM Parser** | LLM + JSON mode | Parse HTML/JSON dari page |
| **Orchestrator** | Node.js scheduler | Atur kapan scraping jalan, akun mana, target apa |
| **Anti-Detect** | playwright-stealth / undetected-playwright | Hindari bot detection Instagram |

### 2.3 Data yang Bisa Diambil

| Data | Metode | Akurasi |
|------|--------|---------|
| Jumlah follower | Baca DOM / AI vision screenshot | 100% |
| Jumlah following | Baca DOM / AI vision screenshot | 100% |
| Jumlah post | Baca DOM | 100% |
| Latest 12 post (thumbnail) | Scroll profil → AI lihat | 90% |
| Caption per post | Buka post → baca DOM | 100% |
| Likes & comments count | Buka post → baca DOM | 100% |
| Hashtag di caption | AI ekstrak dari caption text | 98% |
| Engagement rate | Kalkulasi: (likes+comments)/followers | Kalkulasi |
| Posting frequency | Bandingkan timestamp antar post | Kalkulasi |
| Story highlights | Buka story → AI lihat cover | 70% (limited) |
| Bio & website link | Baca DOM | 100% |

---

## 3. Alur Scraping Per Kompetitor

```
⏰ Vercel Cron trigger → kirim job ke VPS
    │
    ▼
┌────────────────────────────────────────────────┐
│ STEP 1: Pilih Akun Fake                        │
│ - Cek pool akun fake yang available            │
│ - Pilih akun yang "rested" (> 2 jam idle)      │
│ - Cek IP residensial sudah rotate              │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ STEP 2: Login + Warm-up                        │
│ - Buka instagram.com                           │
│ - Jika session ada → langsung ke feed          │
│ - Jika tidak → login dengan kredensial         │
│ - "Warm-up": scroll feed 3x, lihat 1 story,    │
│   like 1 post random (mimic human)             │
│ - Delay random 30-90 detik                     │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ STEP 3: Navigasi ke Profil Kompetitor          │
│ - Buka instagram.com/{username}                │
│ - Tunggu page load (random 2-5 detik)          │
│ - Screenshot profil header                     │
│ - Baca DOM: follower, following, post count    │
│ - Scroll slowly (3-5x) untuk load post grid    │
│ - Screenshot post grid                         │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ STEP 4: Buka 12 Post Terbaru                   │
│ - Klik post pertama                            │
│ - Tunggu load                                  │
│ - Baca: caption text, likes count, timestamp   │
│ - Screenshot post                              │
│ - Klik next → post berikutnya                  │
│ - Ulangi 12x                                   │
│ - Jangan like, jangan comment                  │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ STEP 5: AI Extract & Parse                     │
│ - Kirim screenshot + DOM text ke AI            │
│ - AI ekstrak data terstruktur (JSON)           │
│ - Simpan ke database                           │
│ - Logout / clear session (opsional)            │
└──────────────┬─────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────┐
│ STEP 6: Rotate & Cool-down                     │
│ - Tandai akun sebagai "used"                   │
│ - Set cooldown 4-6 jam sebelum dipakai lagi    │
│ - Rotate proxy IP untuk akun tersebut          │
│ - Pool management: pastikan akun tidak overuse  │
└────────────────────────────────────────────────┘
```

---

## 4. Akun Fake: Pool Management

### 4.1 Berapa Akun Dibutuhkan?

| Target Kompetitor | Akun Fake | Rasio | Keterangan |
|-------------------|-----------|-------|------------|
| 5 kompetitor | 3 akun | 1:1.7 | 1 akun bisa scrape 2 kompetitor/hari |
| 10 kompetitor | 5 akun | 1:2 | 1 akun = 2 kompetitor |
| 20 kompetitor | 8 akun | 1:2.5 | Dengan cooldown rotation |
| 50+ kompetitor | 15+ akun | + proxy pool besar | Skala enterprise |

### 4.2 Cara Membuat Akun Fake yang Tahan Lama

**Hardware/Software yang dibutuhkan:**
- **Mobile proxy atau 4G proxy** (IP dari operator seluler) — Instagram paling percaya IP mobile
- **Device fingerprint berbeda** tiap akun — Playwright bisa set custom fingerprint
- **Email provider:** ProtonMail, Outlook, atau Gmail (pakai nomor HP berbeda tiap akun)

**Proses "Warming Up" (7-14 hari pertama):**

```
Hari 1-3:  Buat akun, upload profile pic (AI-generated face), 
          isi bio natural, follow 5-10 akun random
Hari 4-7:  Scroll feed 5-10 menit/hari, like 2-3 post, 
          jangan follow/unfollow
Hari 8-14: Tambah follow 5 akun lagi, lihat stories, 
           like 3-5 post, aktivitas naik gradually
Hari 15+:  Akun siap dipakai scraping — aktivitas: 
           lihat profil 1-2 kompetitor/hari
```

### 4.3 Aturan Main (Anti-Ban)

| Aturan | Nilai |
|--------|-------|
| Max profil dilihat per akun per hari | 2-3 |
| Min jeda antar profil | 30-60 menit |
| Max scroll per profil | 5x (jangan scroll sampai post lama) |
| Jangan like post kompetitor | ❌ |
| Jangan follow kompetitor | ❌ |
| Jangan copy-paste apa pun | ❌ |
| Jangan buka DM atau interaksi apapun | ❌ |
| Session duration per login | Max 15 menit |
| Min cooldown antar login | 4 jam |
| Proxy type | Residential rotating (bukan datacenter) |
| User agent | Mobile (iPhone 15 / Samsung S24) |
| Viewport | 390x844 (iPhone 14) |
| Timezone | Sesuai IP proxy |

---

## 5. AI sebagai "Mata dan Otak" Scraper

### 5.1 Dua Mode AI dalam Scraping

**Mode 1: Vision (Screenshot → Structured Data)**

Cocok untuk data yang sulit di-parse DOM, atau ketika DOM Instagram berubah terus.

```typescript
// src/lib/scraper/ai-vision.ts
export async function extractProfileFromScreenshot(
  screenshotBase64: string,
  provider: AIProviderClient
): Promise<ProfileData> {
  const prompt = `Kamu melihat screenshot profil Instagram.
Ekstrak data berikut dalam JSON. Jika data tidak terlihat, isi null.

{
  "username": "string",
  "display_name": "string",
  "bio": "string",
  "website": "string",
  "follower_count": number,
  "following_count": number,
  "post_count": number,
  "is_verified": boolean,
  "category": "string"
}`;

  const result = await provider.chat.completions.create({
    model: 'gpt-4o', // Vision-capable
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}` } }
        ]
      }
    ],
    temperature: 0.1
  });

  return JSON.parse(result.choices[0].message.content);
}
```

**Mode 2: DOM Parser (HTML → Structured Data)**

Cocok untuk data yang konsisten di DOM (follower count, post count, caption text).

```typescript
// src/lib/scraper/ai-dom.ts
export async function extractPostsFromDOM(
  domJSON: string, // Simplified DOM structure
  provider: AIProviderClient
): Promise<PostData[]> {
  const prompt = `Berikut struktur DOM dari 12 post Instagram terbaru kompetitor.
Ekstrak data setiap post dalam JSON array:

${domJSON}

Output JSON array of:
{
  "shortcode": "string",
  "caption": "string",
  "hashtags": ["#tag1", "#tag2"],
  "likes": number,
  "comments": number,
  "timestamp": "ISO date",
  "type": "image/carousel/video"
}`;

  const result = await provider.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  });

  return JSON.parse(result.choices[0].message.content);
}
```

### 5.2 Provider Selection untuk Scraping

| Task | Provider | Model | Cost per Scrape |
|------|----------|-------|-----------------|
| Vision: extract profile | Groq LLaMA 3.2 Vision | llama-3.2-90b-vision | ~$0.002 |
| Vision: extract post grid | OpenAI | gpt-4o-mini | ~$0.003 |
| DOM: parse post data | Groq | llama-3.3-70b | ~$0.001 |
| Vision fallback | Anthropic | claude-3-haiku | ~$0.005 |

Total cost per kompetitor per scrape: **~$0.01-0.02**

Bandingkan dengan Apify: **~$0.05-0.10** per profile

---

## 6. Implementasi di VPS

### 6.1 VPS Requirements

| Spesifikasi | Minimal | Rekomendasi |
|-------------|---------|-------------|
| CPU | 2 core | 4 core |
| RAM | 4 GB | 8 GB (Playwright + Chromium) |
| Storage | 20 GB | 50 GB (screenshots + sessions) |
| Bandwidth | 500 GB | 1 TB (banyak screenshot) |
| OS | Ubuntu 22.04 | Ubuntu 24.04 |
| Provider | DigitalOcean $24/bln | Hetzner $15/bln |

### 6.2 VPS Setup Script

```bash
#!/bin/bash
# setup-scraper-vps.sh

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chromium dependencies for Playwright
sudo apt-get install -y \
  libnss3 libnspr4 libatk-bridge2.0-0 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 \
  libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2 libatspi2.0-0

# Install project
git clone https://github.com/your/digimar-scraper-agent.git
cd digimar-scraper-agent
npm install
npx playwright install chromium
npx playwright install-deps

# Setup PM2 for 24/7 running
npm install -g pm2
pm2 start src/scraper-agent.ts --name digimar-scraper
pm2 save
pm2 startup
```

### 6.3 Arsitektur Deployment

```
┌────────────────────────────────────────────────────────────┐
│                     VERCEL (Dashboard)                      │
│                                                             │
│  Frontend: Insight Hub                                     │
│  API: /api/analysis/*  ←── trigger scraping jobs           │
│  Database: Supabase    ←── all scraped data lives here     │
└──────────────┬─────────────────────────────────────────────┘
               │ HTTP / WebSocket
               ▼
┌────────────────────────────────────────────────────────────┐
│                     VPS (Scraper Agent)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Scraper API Server (Express / Fastify)           │     │
│  │                                                    │     │
│  │  POST /scrape/profile     → scrape 1 competitor    │     │
│  │  POST /scrape/batch       → scrape N competitors   │     │
│  │  GET  /scrape/status      → cek antrean + status   │     │
│  │  GET  /scrape/accounts    → pool status akun fake  │     │
│  │                                                    │     │
│  │  Auth: shared secret (CRON_SECRET)                │     │
│  └──────────────┬───────────────────────────────────┘     │
│                 │                                           │
│  ┌──────────────▼───────────────────────────────────┐     │
│  │  Scraper Engine (Node.js)                         │     │
│  │                                                    │     │
│  │  • Playwright pool (3-5 concurrent browsers)      │     │
│  │  • Session store (persistentContext per akun)     │     │
│  │  • Proxy rotator (BrightData / IPRoyal SDK)       │     │
│  │  • Rate limiter (max 1 scrape/30min per akun)     │     │
│  │  • AI client pool (provider rotation)             │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Account Manager                                  │     │
│  │  • Akun fake credentials (encrypted on disk)      │     │
│  │  • Cooldown tracker                               │     │
│  │  • "Health check": cek apakah akun masih hidup    │     │
│  │  • Auto-rotate jika akun kena ban                 │     │
│  └──────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────┘
```

### 6.4 Komunikasi Vercel ↔ VPS

```typescript
// Di Vercel: src/app/api/analysis/competitors/collect/route.ts
export async function POST(request: Request) {
  const { competitorIds } = await request.json();
  
  // Kirim job ke VPS scraper agent
  const response = await fetch(`${process.env.VPS_SCRAPER_URL}/scrape/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SCRAPER_SECRET}`
    },
    body: JSON.stringify({ competitorIds, userId: session.user.id })
  });
  
  const { jobId } = await response.json();
  
  // Return job ID — frontend bisa polling untuk status
  return Response.json({ jobId, status: 'queued' });
}
```

---

## 7. Biaya Estimasi

### 7.1 Biaya Bulanan

| Item | Provider | Harga/Bulan |
|------|----------|-------------|
| VPS (4 core, 8GB RAM) | Hetzner / DigitalOcean | $15-24 |
| Residential Proxy (10 GB) | BrightData / IPRoyal | $50-80 |
| Akun Fake (5 akun) | Beli nomor HP + buat manual | ~$10 (one-time) |
| AI API cost (scraping) | Groq (mostly free tier) + OpenAI | $5-10 |
| **TOTAL bulan pertama** | | **~$80-124** |
| **TOTAL bulan berikutnya** | | **~$70-100** |

### 7.2 Perbandingan vs Apify

| | Self-hosted (VPS + AI) | Apify |
|---|----------------------|-------|
| Setup cost | $10 (akun fake) + waktu setup 1 minggu | $0 |
| Bulanan | $70-100 | $49-200 (tergantung volume) |
| Kontrol | 100% kustom | Terbatas pada actor |
| Risiko ban | Akun fake bisa kena ban → perlu rebuild | Nol (managed) |
| Data depth | Bisa custom sedalam apapun | Terbatas actor |
| Maintenance | Harus maintain akun + antiban | Nol |
| Scalability | Terbatas jumlah akun fake | Unlimited (tinggal bayar) |

**Kesimpulan:** Self-hosted lebih murah jika > 20 kompetitor. Apify lebih praktis untuk pemula atau < 10 kompetitor.

---

## 8. Anti-Detection Layer

### 8.1 Playwright Stealth Configuration

```typescript
// src/lib/scraper/stealth-browser.ts
import { chromium } from 'playwright';

export async function createStealthBrowser(proxyConfig: ProxyConfig) {
  const browser = await chromium.launch({
    headless: false, // Instagram deteksi headless — HARUS headful
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      `--proxy-server=${proxyConfig.server}`,
    ]
  });

  const context = await browser.newContext({
    userAgent: randomMobileUserAgent(),
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    geolocation: { latitude: -6.2088, longitude: 106.8456 }, // Jakarta
    permissions: ['geolocation'],
  });

  // Remove webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
  });

  return { browser, context };
}
```

### 8.2 Human Behavior Simulation

```typescript
// src/lib/scraper/human-sim.ts
export async function humanScroll(page: Page, times: number) {
  for (let i = 0; i < times; i++) {
    const scrollAmount = 300 + Math.floor(Math.random() * 400);
    await page.mouse.wheel(0, scrollAmount);
    await sleep(2000 + Math.floor(Math.random() * 3000)); // 2-5 detik jeda
  }
}

export async function humanMouseMove(page: Page) {
  // Gerakin mouse random seperti manusia
  const x = Math.floor(Math.random() * 300);
  const y = 200 + Math.floor(Math.random() * 400);
  await page.mouse.move(x, y, { steps: 10 });
  await sleep(500 + Math.floor(Math.random() * 1000));
}

export async function humanTyping(page: Page, selector: string, text: string) {
  const element = page.locator(selector);
  await element.click();
  for (const char of text) {
    await element.press(char, { delay: 50 + Math.floor(Math.random() * 150) });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomMobileUserAgent(): string {
  const uas = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ];
  return uas[Math.floor(Math.random() * uas.length)];
}
```

### 8.3 Instagram-Specific Anti-Detection

Instagram punya fingerprinting canggih. Lapisan tambahan:

| Teknik | Implementasi |
|--------|-------------|
| **Canvas fingerprint** | Randomize canvas hash via `addInitScript` |
| **WebGL fingerprint** | Override WebGL vendor/renderer |
| **Font fingerprint** | Gunakan font umum (system fonts) |
| **AudioContext** | Noise injection ke AudioContext fingerprint |
| **Battery API** | Block `navigator.getBattery()` |
| **Timezone offset** | Sesuaikan dengan IP proxy |
| **Language header** | `Accept-Language: id-ID,id;q=0.9` |
| **Referrer** | `https://www.google.com/` atau `https://www.instagram.com/` |

---

## 9. Monitoring & Alerting

### 9.1 Health Check Akun Fake

```typescript
// src/lib/scraper/account-health.ts
export async function checkAccountHealth(accountId: string) {
  // 1. Coba login
  const loggedIn = await attemptLogin(accountId);
  if (!loggedIn) return { status: 'banned', reason: 'login_failed' };
  
  // 2. Cek apakah ada "Action Blocked" atau "Suspicious Login"
  const page = await openFeed();
  const html = await page.content();
  
  if (html.includes('action_blocked')) return { status: 'blocked', reason: 'action_block' };
  if (html.includes('suspicious_login')) return { status: 'challenged', reason: 'suspicious_login' };
  if (html.includes('verify_email')) return { status: 'challenged', reason: 'email_verify' };
  if (html.includes('verify_phone')) return { status: 'challenged', reason: 'phone_verify' };
  
  // 3. Semua OK
  await page.close();
  return { status: 'healthy' };
}
```

### 9.2 Alert Triggers

| Kondisi | Action |
|---------|--------|
| Akun fake kena ban | Auto-remove dari pool, flag untuk penggantian |
| Scrape gagal 3x berturut | Notif admin (Telegram bot / email) |
| IP proxy terdeteksi | Rotate ke IP baru, blacklist IP lama |
| Instagram rate limit | Pause semua scraping 1 jam |
| Akun diminta verifikasi | Tunda scraping, butuh intervensi manual |

---

## 10. Database Integration

### 10.1 Tambahan Tabel

```sql
-- Akun fake pool
CREATE TABLE scraper_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    instagram_username TEXT NOT NULL,
    instagram_password_encrypted BYTEA NOT NULL,
    email TEXT,
    phone TEXT,
    proxy_provider TEXT,
    proxy_config JSONB,
    status TEXT NOT NULL DEFAULT 'warming_up' 
        CHECK (status IN ('warming_up', 'active', 'cooldown', 'blocked', 'banned', 'challenged')),
    last_used_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,
    total_scrapes INTEGER DEFAULT 0,
    health_score INTEGER DEFAULT 100,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scraping jobs
CREATE TABLE scraper_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scraper_account_id UUID REFERENCES scraper_accounts(id),
    competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' 
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    result_data JSONB,
    ai_provider_used TEXT,
    ai_tokens_used INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scraped posts (from competitor)
CREATE TABLE competitor_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    instagram_post_id TEXT,
    shortcode TEXT,
    caption TEXT,
    hashtags JSONB DEFAULT '[]',
    media_type TEXT,
    media_urls JSONB DEFAULT '[]',
    likes_count INTEGER,
    comments_count INTEGER,
    posted_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(competitor_id, instagram_post_id)
);
```

---

## 11. MVP Roadmap

### Week 1-2: Scraper VPS Setup
- [ ] Provision VPS (Hetzner 4-core, 8GB)
- [ ] Install Playwright + Chromium
- [ ] Setup BrightData/IPRoyal residential proxy
- [ ] Buat 3 akun fake Instagram + warming up

### Week 2-3: Scraper Engine
- [ ] Implement Playwright stealth browser
- [ ] Implement `scrapeProfile()` — ambil data profil
- [ ] Implement `scrapePosts()` — ambil 12 post terbaru
- [ ] Implement AI vision extraction (screenshot → JSON)
- [ ] Implement AI DOM extraction (HTML → JSON)
- [ ] Session management + cookie persistence

### Week 3-4: API + Orchestrator
- [ ] Express/Fastify server di VPS
- [ ] `POST /scrape/profile` endpoint
- [ ] Account pool manager (cooldown, rotation)
- [ ] Job queue + rate limiter

### Week 4-5: Integration
- [ ] Hubungkan Vercel → VPS scraper API
- [ ] Simpan hasil scrape ke Supabase
- [ ] Health monitoring + Telegram alert

### Week 5-6: AI Analysis Pipeline
- [ ] Trigger dari Vercel Cron → VPS scrape → Supabase
- [ ] AI competitive analysis dari data yang sudah di-scrape
- [ ] Insight Hub dashboard tampilkan hasil

---

## 12. Catatan Penting & Risiko

### ⚠️ Legal & Terms of Service

Instagram ToS melarang:
- Scraping otomatis
- Akun fake
- Automated access tanpa izin

**Mitigasi:** Ini untuk **personal/internal use** (riset kompetitor bisnis sendiri). Bukan untuk dijual atau redistribusi data. Gunakan dengan bijak.

### ⚠️ Risiko Teknis

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| Akun fake kena ban massal | Tinggi | Semua scraping berhenti | Pool akun cadangan, fallback ke Apify |
| Instagram update anti-bot | Sedang | Scraping gagal | Monitoring + update stealth config |
| Proxy residential mahal | Rendah | Budget bengkak | Batasi volume, optimasi AI untuk kurangi screenshot |
| VPS down | Rendah | Scraping delay | PM2 auto-restart + health check |
| AI vision akurasi rendah | Sedang | Data tidak akurat | Fallback: DOM parsing + double-check LLM |

---

## 13. Alternatif Hybrid: Self-Hosted + Managed

Jika setup sendiri terlalu rumit, alternatif paling optimal:

```
Self-hosted untuk:          Managed untuk:
- Akun fake pool            - Apify Instagram Scraper
  (bikin + warming up)        ($49/bln, 1000 profiles)
- AI extraction             
  (screenshot → JSON)       - Atau RapidAPI Instagram
- AI analysis & insight       ($30/bln, 5000 requests)
```

Flow hybrid:
1. Vercel Cron trigger → Apify scrape (reliable, no ban risk)
2. Apify kirim raw data ke Supabase
3. AI analysis (Groq/OpenAI) proses raw data → insight
4. Semua AI + analysis self-hosted (lebih murah)

**Biaya hybrid:** $49 (Apify) + $5 (AI cost) = **~$55/bulan** — tanpa perlu maintain VPS + akun fake + antiban.
