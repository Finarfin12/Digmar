# AI Scraper Kompetitor — Gratis (Hanya Bayar VPS + AI Provider)

**Tanggal:** 2026-06-16
**Status:** Blueprint — Zero-cost scraper strategy

---

## Prinsip: Scrape Seperti Manusia, Bukan Bot

Instagram mendeteksi bot dari **pola**, bukan dari IP. VPS IP biasa bisa dipakai selama perilaku scraping tidak mencurigakan. Tidak perlu residential proxy mahal.

```
┌────────────────────────────────────────┐
│              VPS ($15-24/bln)           │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Scraper Agent (Node.js / Python) │ │
│  │  • Playwright-stealth / Instagrapi│ │
│  │  • 2-3 akun fake (buat sendiri)   │ │
│  │  • Human behavior simulation      │ │
│  │  • Rate: 2-3 kompetitor/hari      │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│  ┌───────────────▼───────────────────┐ │
│  │  AI Extraction (Groq/OpenAI)       │ │
│  │  • Screenshot → JSON (Vision)     │ │
│  │  • DOM → JSON (LLM)              │ │
│  │  • Cost: ~$5-10/bln               │ │
│  └───────────────────────────────────┘ │
│                  │                      │
│  Supabase ←──────┘ (data disimpan)     │
└────────────────────────────────────────┘
```

---

## 1. Dua Opsi Engine Scraper (Pilih Satu)

### Opsi A: `instagrapi` (Python) — Paling Simpel & Teruji

Battle-tested library Python untuk Instagram private API. Sudah dipakai ribuan developer. Bisa scrape public profile tanpa login.

```python
# install: pip install instagrapi
from instagrapi import Client

cl = Client()

# Bisa scrape TANPA login untuk profil public
user_info = cl.user_info_by_username('competitor_username')
print(user_info.follower_count)
print(user_info.following_count)
print(user_info.media_count)

# Ambil 12 post terbaru
medias = cl.user_medias(user_info.pk, amount=12)
for media in medias:
    print(media.caption_text)
    print(media.like_count)
    print(media.comment_count)
    print(media.taken_at)

# Download thumbnail (opsional)
# cl.photo_download(media.pk, folder='screenshots')
```

**Kelebihan:**
- Simpel, < 50 baris kode untuk scraping dasar
- Bisa tanpa login untuk public profile
- Return data terstruktur (tidak perlu parsing DOM/AI)
- Rate limit handling built-in
- Bisa pakai proxy gratis jika diperlukan (tapi biasanya tidak perlu)

**Kekurangan:**
- Python, bukan Node.js/TypeScript
- Kadang perlu update jika Instagram ganti API internal
- Tidak bisa ambil data yang butuh render JavaScript (story, highlight)

### Opsi B: `playwright-stealth` (Node.js) — Stay di TypeScript

Skill yang sama dengan frontend DigiMar (TypeScript).

```bash
npm install playwright playwright-stealth
npx playwright install chromium
```

```typescript
// src/lib/scraper/stealth-scraper.ts
import { chromium } from 'playwright';
import { PlaywrightBlocker } from '@cliqz/adblocker-playwright';
import fetch from 'cross-fetch';

export async function scrapeCompetitorProfile(username: string) {
  const browser = await chromium.launch({
    headless: true, // instagrapi-style: headless OK untuk volume rendah
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/125.0.6422.165 Mobile Safari/537.36',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  // Strip webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  const page = await context.newPage();

  // Buka profil (public, no login needed)
  await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle' });

  // Ekstrak data dari meta tags / initial state JSON (TANPA AI!)
  const html = await page.content();
  
  // Instagram embed JSON di script tag
  const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  const structuredData = jsonMatch ? JSON.parse(jsonMatch[1]) : null;

  // Atau dari window.__INITIAL_STATE__ (lebih lengkap)
  const initialState = await page.evaluate(() => {
    return (window as any).__INITIAL_STATE__;
  });

  if (initialState) {
    // Parse data langsung dari JSON — gratis, tanpa AI
    return {
      follower_count: initialState.graphql?.user?.edge_followed_by?.count,
      following_count: initialState.graphql?.user?.edge_follow?.count,
      post_count: initialState.graphql?.user?.edge_owner_to_timeline_media?.count,
      bio: initialState.graphql?.user?.biography,
      is_private: initialState.graphql?.user?.is_private,
    };
  }

  await browser.close();
  return null;
}
```

**Kelebihan Opsi B:**
- Dapat data dari `__INITIAL_STATE__` JSON instagram — **gratis, tanpa AI parsing**
- Tidak perlu screenshot + vision AI → hemat $3-5/bln
- Tetap di TypeScript, satu codebase dengan DigiMar

---

## 2. Dapatkan Data Kompetitor Tanpa Login

Instagram public profile bisa diakses **tanpa login** via web. Data tersedia di JSON embed (`__INITIAL_STATE__` dan `application/ld+json`):

```typescript
// src/lib/scraper/no-login-scraper.ts
export async function getPublicProfileData(username: string) {
  const response = await fetch(`https://www.instagram.com/${username}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/125.0.6422.165 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    }
  });

  const html = await response.text();

  // Method 1: Parse application/ld+json (official structured data)
  const ldJsonMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  
  // Method 2: Parse __INITIAL_STATE__ di sharedData
  const sharedDataMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});<\/script>/);

  // Method 3: Parse `<meta property="og:description" content="...">` 
  //   format: "1,234 Followers, 456 Following, 789 Posts"
  const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1];

  // Gabungkan semua data
  return {
    raw_ld_json: ldJsonMatch?.[1] || null,
    raw_initial_state: sharedDataMatch?.[1] || null,
    og_description: ogDesc || null,
  };
}
```

**Ini 100% gratis.** Tidak perlu login, tidak perlu akun fake, tidak perlu AI untuk ekstrak — semua data sudah dalam JSON.

---

## 3. Kalau Butuh Lebih Dalam: Akun Fake (Gratis)

Jika data dari public access tidak cukup (misal butuh lihat post detail, likes count real-time), baru pakai akun fake.

### Cara Bikin Akun Fake Gratis

```
1. Buka Gmail → buat akun baru (gratis)
   - Nama: "Budi Santoso" / "Siti Rahayu" (natural)
   - Username: budi.santoso921@gmail.com
   
2. Buka Instagram.com → Register dengan email tersebut
   - Username: budi_santoso921 atau siti_rahayu_456
   - Nama: Budi Santoso
   - Password: random 16-char (simpan di .env)
   - Profile pic: download AI-generated face dari thispersondoesnotexist.com

3. Isi bio natural:
   "📍 Jakarta | 💼 Marketing | ☕ Coffee lover"

4. Follow 5-10 akun random (brand lokal, influencer kecil)

5. Warming-up 7 hari:
   Hari 1-3: Scroll feed 2x, like 1 post, jangan follow/unfollow
   Hari 4-7: Like 2-3 post, lihat 1-2 story, follow 2-3 akun
   
6. Setelah 7 hari: Akun siap dipakai scraping
```

**Butuh 3 akun untuk 5-10 kompetitor.** Total biaya: Rp 0 (email gratis).

---

## 4. Rate Limiting (Anti-Ban Gratis)

Tanpa proxy mahal, strategi anti-ban 100% behavioral:

```typescript
// src/lib/scraper/rate-limiter.ts
const LIMITS = {
  max_profiles_per_day: 3,        // Per akun fake
  max_profiles_per_hour: 1,
  min_delay_between_profiles: 45 * 60 * 1000, // 45 menit
  min_delay_between_actions: [2000, 5000],     // 2-5 detik (random)
  max_session_duration: 10 * 60 * 1000,        // 10 menit
  cooldown_after_session: 4 * 60 * 60 * 1000,  // 4 jam
};

export class RateLimiter {
  private dailyCount = 0;
  private lastAction = 0;
  private sessionStart = 0;

  async wait() {
    const delay = LIMITS.min_delay_between_actions[0] + 
      Math.random() * (LIMITS.min_delay_between_actions[1] - LIMITS.min_delay_between_actions[0]);
    await new Promise(r => setTimeout(r, delay));
  }

  canScrape(): boolean {
    const now = Date.now();
    if (this.dailyCount >= LIMITS.max_profiles_per_day) return false;
    if (now - this.lastAction < LIMITS.min_delay_between_profiles) return false;
    if (this.sessionStart > 0 && now - this.sessionStart > LIMITS.max_session_duration) return false;
    return true;
  }

  startSession() {
    this.sessionStart = Date.now();
  }

  recordScrape() {
    this.dailyCount++;
    this.lastAction = Date.now();
  }

  resetDaily() {
    this.dailyCount = 0;
  }
}
```

**Jika VPS IP kena rate limit:** Tunggu 24 jam, ganti User-Agent, coba lagi. Free solution.

---

## 5. AI Extraction — Gunakan yang Sudah Ada

AI provider abstraction di DigiMar (`src/lib/ai/factory.ts`) langsung bisa dipakai untuk parsing data scraper.

```typescript
// src/lib/scraper/ai-extract.ts
import { getAIProvider } from '@/lib/ai/factory';

export async function extractPostsWithAI(
  rawHTML: string, 
  userId: string
) {
  const { client } = await getAIProvider(userId, 'groq');

  const prompt = `Berikut adalah raw data dari profil Instagram kompetitor.
Ekstrak data 12 post terbaru dalam JSON. Hanya kembalikan JSON, tanpa teks lain.

{
  "posts": [
    {
      "caption": "string",
      "hashtags": ["#tag1"],
      "likes": number,
      "comments": number,
      "type": "image/carousel/video",
      "posted_at": "ISO date",
      "shortcode": "string"
    }
  ]
}

Raw data:
${rawHTML.substring(0, 15000)}`;

  const result = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 2000
  });

  return JSON.parse(result.choices[0].message.content);
}
```

**Optimasi:** Sebisa mungkin ekstrak dari `__INITIAL_STATE__` JSON dulu (gratis), baru fallback ke AI parsing kalau JSON tidak tersedia.

---

## 6. Arsitektur Simpel (Node.js Only, No Python)

```
digimar-next/                          (existing project)
├── src/
│   ├── lib/
│   │   ├── scraper/                   (NEW)
│   │   │   ├── no-login-scraper.ts    ← Scrape tanpa login (gratis)
│   │   │   ├── stealth-scraper.ts     ← Playwright stealth (akun login)
│   │   │   ├── rate-limiter.ts        ← Anti-ban behavioral
│   │   │   ├── ai-extract.ts          ← AI parsing fallback
│   │   │   ├── account-manager.ts     ← Pool akun fake
│   │   │   └── types.ts
│   │   └── ai/                        (existing)
│   │       └── factory.ts             ← Dipakai untuk AI extraction
│   └── app/
│       └── api/
│           └── scraper/
│               ├── profile/route.ts   ← GET /api/scraper/profile?username=
│               ├── batch/route.ts     ← POST /api/scraper/batch
│               └── status/route.ts    ← GET /api/scraper/status
└── scripts/
    └── scrape-competitors.ts           ← CLI script untuk testing
```

---

## 7. Flow Scraping per Kompetitor (2 Mode)

### Mode A: No-Login (public profile, 90% kasus)

```
Vercel Cron / Manual trigger
    │
    ▼
GET instagram.com/{username}/ (fetch, no browser)
    │
    ▼
Parse __INITIAL_STATE__ JSON
    │
    ▼
Dapat: followers, following, posts, bio, is_verified
    │
    ▼
Dapat: 12 post terbaru (thumbnail, caption, likes, comments)
    │
    ▼
Simpan ke competitor_posts table di Supabase
    │
    ▼
DONE — total time: ~2 detik, cost: $0
```

### Mode B: Login + Playwright (butuh data lebih dalam)

```
Manual trigger (hanya jika Mode A tidak cukup)
    │
    ▼
Playwright launch → login akun fake → buka profil
    │
    ▼
Scroll 3x → screenshot → AI extract
    │
    ▼
Buka 12 post → baca caption → AI parse hashtag
    │
    ▼
Logout → cooldown akun 4 jam
    │
    ▼
DONE — total time: ~3 menit, cost: ~$0.01 AI
```

---

## 8. Biaya Total (Rangkuman)

| Item | Provider | Biaya/Bulan |
|------|----------|-------------|
| VPS (4-core, 8GB, untuk Playwright) | Hetzner | **$15** |
| AI extraction (Groq) | Groq (free tier cukup) | **$0** |
| AI deep analysis | Groq / OpenAI | **$3-5** |
| Akun fake | Gmail (gratis) | **$0** |
| Proxy | Tidak perlu (VPS IP langsung) | **$0** |
| **TOTAL** | | **~$18-20/bulan** |

Bandingkan dengan:
- Apify: $49/bulan
- BrightData: $100/bulan
- Hybrid (Apify + AI): $55/bulan

---

## 9. Quick Start: Script Scraping dalam 5 Menit

```typescript
// scripts/test-scrape.ts
// Jalankan: npx tsx scripts/test-scrape.ts

async function quickScrape(username: string) {
  // No login needed
  const res = await fetch(`https://www.instagram.com/${username}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/125.0' }
  });
  
  const html = await res.text();

  // Extract from meta og:description (always available)
  const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1];
  // Format: "1,234 Followers, 456 Following, 789 Posts - See Instagram photos..."
  
  const followers = ogDesc?.match(/([\d,]+)\s*Followers/)?.[1];
  const following = ogDesc?.match(/([\d,]+)\s*Following/)?.[1];
  const posts = ogDesc?.match(/([\d,]+)\s*Posts/)?.[1];
  
  console.log({ username, followers, following, posts });
  
  // Try to get more data from JSON
  const jsonMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonMatch) {
    const data = JSON.parse(jsonMatch[1]);
    console.log('Structured data:', JSON.stringify(data, null, 2));
  }
}

quickScrape('nike'); // Test dengan akun public manapun
```

---

## 10. Deployment ke VPS

```bash
# Di VPS
git clone https://github.com/your/digimar-scraper-agent.git
cd digimar-scraper-agent

npm install
npx playwright install chromium
npx playwright install-deps

# Jalankan sebagai service (PM2)
npm install -g pm2
pm2 start src/scraper-server.ts --name digimar-scraper
pm2 save
pm2 startup

# API server siap menerima job dari Vercel
# POST https://vps-ip:3001/scrape/profile
# Auth: Bearer token
```

---

## Kesimpulan

**Tidak perlu bayar scraper atau proxy.** Kombinasi `fetch()` + parsing `__INITIAL_STATE__` JSON Instagram sudah menangani 90% kebutuhan scraping kompetitor — gratis. Akun fake hanya diperlukan sebagai eskalasi untuk data yang benar-benar tidak bisa diakses tanpa login. Dengan 2-3 akun fake + behavioral rate limiting, VPS IP biasa sudah cukup.
