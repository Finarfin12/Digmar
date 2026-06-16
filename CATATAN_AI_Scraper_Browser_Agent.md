# AI Langsung Operasikan Browser — Login & Scraping Instagram Tanpa Tools Berbayar

**Tanggal:** 2026-06-16
**Status:** Blueprint — AI-native browser approach

---

## Konsep: AI sebagai Operator Browser, Bukan Sekadar Parser

Selama ini kita mikir AI cuma dipakai untuk **parse data** setelah browser ambil HTML/screenshot. Padahal AI juga bisa **mengoperasikan browser langsung** — AI yang melakukan login, klik, scroll, baca halaman, dan ambil keputusan. Ini menghilangkan kebutuhan Playwright scripting kompleks.

```
┌────────────────────────────────────────────────────┐
│                    VPS                              │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │           AI Operator Agent                    │ │
│  │                                                │ │
│  │  "Buka instagram.com/login"                   │ │
│  │  "Ketik username di field pertama"            │ │
│  │  "Ketik password di field kedua"              │ │
│  │  "Klik tombol Login"                          │ │
│  │  "Jika ada popup 'Save Info' → klik Not Now"  │ │
│  │  "Sekarang buka instagram.com/kompetitor"     │ │
│  │  "Scroll 3 kali pelan-pelan"                  │ │
│  │  "Baca jumlah followers dari halaman"         │ │
│  │  "Klik post pertama → baca caption → next"     │ │
│  │  "Ulangi untuk 12 post"                       │ │
│  │  "Kembalikan data dalam JSON"                 │ │
│  └───────────────┬───────────────────────────────┘ │
│                  │                                   │
│  ┌───────────────▼───────────────────────────────┐ │
│  │  Browser (Chromium) + Agent Framework         │ │
│  │  • browser-use (Python)                       │ │
│  │  • playwright-mcp (Node.js)                   │ │
│  │  • puppeteer + AI controller                  │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## 1. Opsi Framework AI Browser Operator (Gratis / Open Source)

### A. `browser-use` (Python) — Paling Matang

Open-source, Python, GitHub 30k+ stars. AI agent yang mengontrol browser via Playwright.

```bash
pip install browser-use
playwright install
```

```python
from browser_use import Agent
from langchain_openai import ChatOpenAI

agent = Agent(
    task="""
    1. Buka https://www.instagram.com/accounts/login/
    2. Login dengan username "budi_santoso921" dan password "password123"
    3. Jika ada popup "Save Login Info", klik "Not Now"
    4. Jika ada popup "Turn on Notifications", klik "Not Now"
    5. Buka profil https://www.instagram.com/competitor_name/
    6. Catat jumlah followers, following, dan posts
    7. Scroll ke bawah 3 kali dengan jeda 2 detik
    8. Buka 5 post terbaru, baca caption, likes, comments
    9. Kembalikan semua data dalam format JSON
    """,
    llm=ChatOpenAI(
        model="gpt-4o",
        base_url="https://api.groq.com/openai/v1",  # Bisa pakai Groq
        api_key="gsk_xxx"
    ),
    use_vision=True,
)

result = await agent.run()
print(result)
```

**Kenapa ini powerful:**
- AI ngerti konteks halaman — "ada popup? klik Not Now"
- AI bisa handle unexpected situations — "tombol login berubah posisi? cari text 'Log in'"
- AI bisa baca error — "akun kena challenge? laporkan"
- **Gak perlu nulis kode scraping detail** — task dalam bahasa natural

### B. `playwright-mcp` (Node.js) — Tetap di TypeScript

Model Context Protocol (MCP) server untuk Playwright. AI bisa panggil tool browser langsung.

```bash
npm install @anthropic-ai/sdk @playwright/mcp playwright
```

```typescript
// src/lib/scraper/mcp-scraper.ts
import { Client } from '@anthropic-ai/sdk';
import { chromium } from 'playwright';

const anthropic = new Client({ apiKey: process.env.ANTHROPIC_API_KEY });

// Define tools yang bisa dipanggil AI
const browserTools = [
  {
    name: 'navigate',
    description: 'Buka URL di browser',
    input_schema: { type: 'object', properties: { url: { type: 'string' } } }
  },
  {
    name: 'click',
    description: 'Klik elemen berdasarkan text/selector',
    input_schema: { type: 'object', properties: { selector: { type: 'string' } } }
  },
  {
    name: 'type',
    description: 'Ketik text ke input field',
    input_schema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } } }
  },
  {
    name: 'screenshot',
    description: 'Ambil screenshot halaman saat ini',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_page_content',
    description: 'Baca seluruh text di halaman',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'scroll',
    description: 'Scroll halaman ke bawah',
    input_schema: { type: 'object', properties: { amount: { type: 'number' } } }
  },
  {
    name: 'extract_data',
    description: 'Selesai: kembalikan data yang sudah dikumpulkan',
    input_schema: { type: 'object', properties: { data: { type: 'object' }, summary: { type: 'string' } } }
  }
];

export async function scrapeWithAI(targetUsername: string, accountPool: FakeAccount[]) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // AI agent loop
  const messages = [{
    role: 'user',
    content: `Kamu adalah AI yang mengoperasikan browser untuk scraping Instagram.

Login dengan akun:
- Username: ${accountPool[0].username}
- Password: ${accountPool[0].password}

Kemudian buka profil @${targetUsername} dan kumpulkan:
1. Followers, following, post count
2. Bio
3. 10 post terbaru: caption, hashtags, likes, comments, type

Jika ada popup/notifikasi, tutup (Not Now).
Jika ada error, laporkan.
Saat selesai, panggil extract_data.`
  }];

  // AI bikin keputusan, kita eksekusi
  for (let i = 0; i < 50; i++) { // Max 50 langkah
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      tools: browserTools,
      messages,
    });

    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (!toolUse) break;

    // Eksekusi tool call dari AI
    const result = await executeToolCall(toolUse, page);
    
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: result }] });

    if (toolUse.name === 'extract_data') {
      await browser.close();
      return toolUse.input.data;
    }
  }
}
```

### C. `Stagehand` (Browserbase, open-source) — Simplest

```bash
npm install @browserbasehq/stagehand playwright
```

```typescript
import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';

const stagehand = new Stagehand({
  env: 'LOCAL', // BUKAN pakai Browserbase cloud
  headless: false,
});

await stagehand.init();
const page = stagehand.page;

// Stagehand pakai natural language untuk action + extract
await page.goto('https://www.instagram.com/accounts/login/');
await page.act('Ketik "budi_santoso" di field username');
await page.act('Ketik "pass123" di field password');
await page.act('Klik tombol Log in');
await page.act('Klik Not Now jika ada popup');

await page.goto('https://www.instagram.com/competitor/');

// Extract dengan schema Zod
const data = await page.extract({
  instruction: 'Ambil jumlah followers, following, posts, dan bio dari profil ini',
  schema: z.object({
    followers: z.string(),
    following: z.string(),
    posts: z.string(),
    bio: z.string(),
  })
});

console.log(data);
```

---

## 2. Arsitektur Final: AI Agent Pool di VPS

```
┌─────────────────────────────────────────────────────────────────┐
│                       VPS ($15/bln Hetzner)                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    AI Scraper Controller                     │ │
│  │  (Node.js / Python — API server)                            │ │
│  │                                                              │ │
│  │  POST /scrape/competitor                                     │ │
│  │    body: { username: "@target", deep: true }                 │ │
│  │                                                              │ │
│  │  → pilih akun fake tersedia                                  │ │
│  │  → spawn Playwright browser                                  │ │
│  │  → kirim task natural language ke AI operator                │ │
│  │  → AI melakukan login + navigasi + scraping                  │ │
│  │  → AI kembalikan JSON data                                   │ │
│  │  → simpan ke Supabase + return                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                  │                                                │
│     ┌────────────┼────────────┐                                  │
│     ▼            ▼            ▼                                  │
│  ┌──────┐   ┌──────┐   ┌──────────────┐                         │
│  │Browser│   │Browser│   │Browser       │                         │
│  │  #1   │   │  #2   │   │  #3          │  (max 3 concurrent)   │
│  │Akun A │   │Akun B │   │Akun C        │                         │
│  └──────┘   └──────┘   └──────────────┘                         │
│                                                                   │
│  AI Operator: Groq LLaMA 3.3 70B / GPT-4o-mini                   │
│  Vision: Groq LLaMA 3.2 Vision (gratis tier)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Biaya AI Operator

Mari hitung biaya AI untuk 1x scraping 1 kompetitor dengan browser-use:

| Langkah | Tool Call | AI Tokens (input) | AI Tokens (output) | ~Cost |
|---------|-----------|-------------------|-------------------|-------|
| 1. Buka login page | navigate | 500 | 50 | $0.0002 |
| 2. Ketik username | type | 200 | 30 | $0.0001 |
| 3. Ketik password | type | 200 | 30 | $0.0001 |
| 4. Klik login | click + screenshot | 1000 | 50 | $0.0003 |
| 5. Handle popup | click (conditional) | 500 | 30 | $0.0002 |
| 6. Buka profil | navigate | 500 | 50 | $0.0002 |
| 7. Screenshot profil | screenshot + vision | 1500 | 100 | $0.0008 |
| 8. Scroll 3x | scroll × 3 | 300 | 100 | $0.0002 |
| 9. Buka 10 post | click + extract × 10 | 3000 | 500 | $0.002 |
| 10. Final extract | extract_data | 800 | 300 | $0.0005 |
| **TOTAL per kompetitor** | | **~8,500** | **~1,240** | **~$0.004** |

Dengan Groq (LLaMA 3.3 70B: $0.59/1M input, $0.79/1M output):
**~$0.005 per kompetitor**

Kalau 10 kompetitor, 2x/hari = 600 scrape/bulan = **~$3/bulan**

Vision model (LLaMA 3.2 90B Vision) lebih mahal sedikit:
**~$5-8/bulan** untuk 600 screenshot analysis

**Total AI cost: ~$8-11/bulan** — masih jauh di bawah Apify $49/bulan.

---

## 4. Keunggulan AI Operator vs Scraper Manual

| Aspek | Playwright Manual Scripting | AI Operator (browser-use) |
|-------|---------------------------|--------------------------|
| **Anti-detection** | Harus manual handle popup, captcha | AI otomatis deteksi + handle |
| **Instagram UI berubah** | Script rusak, harus update selector | AI adaptasi ("cari tombol login") |
| **Error recovery** | Manual try-catch per langkah | AI bisa retry + alternatif path |
| **Setup cost** | 500+ baris kode per flow | 5 baris task description |
| **Maintenance** | Update terus tiap Instagram ganti class | AI adaptasi sendiri |
| **Akurasi parsing** | DOM parsing = fragile | AI vision lihat seperti manusia |
| **Learning curve** | Harus ngerti CSS selector, DOM, anti-bot | Natural language task |
| **Debugging** | Console log, screenshot manual | AI jelaskan apa yang terjadi |
| **Human behavior** | Manual random delay | AI otomatis variasi kecepatan + jeda |

---

## 5. Warming-Up AI-Style (Lebih Natural)

Dengan AI operator, warming-up akun fake lebih natural karena AI bisa:

```
Task warming-up harian:
"Kamu adalah pengguna Instagram biasa bernama Budi.
Hari ini: buka Instagram, scroll feed 2 menit,
like 2 postingan yang menarik, lihat 1 story,
jangan follow/unfollow siapa pun.
Bersikaplah natural seperti manusia."
```

AI akan:
- Scroll dengan kecepatan bervariasi
- Berhenti di post yang "menarik" (AI vision bisa nilai visual)
- Like setelah "membaca" caption
- Skip post yang tidak relevan
- Buka story, tunggu 3-5 detik, next

Ini jauh lebih natural daripada script `scroll(300)` + `sleep(2000)` — pola robotik.

---

## 6. Quick Setup: browser-use + Groq (Python)

```python
# setup.py — jalankan di VPS
"""
pip install browser-use langchain-groq playwright
playwright install chromium
"""

import asyncio
from browser_use import Agent
from langchain_groq import ChatGroq
import os

os.environ["GROQ_API_KEY"] = "gsk_xxx"

async def scrape_competitor(username: str, fake_account: dict):
    agent = Agent(
        task=f"""
        Kamu adalah AI yang scrolling Instagram sebagai pengguna biasa.

        1. Buka https://www.instagram.com/accounts/login/
        2. Login dengan username "{fake_account['username']}" 
           dan password "{fake_account['password']}"
        3. Jika ada popup apa pun, klik "Not Now"
        4. Buka profil https://www.instagram.com/{username}/
        5. Catat: followers, following, jumlah post, bio
        6. Scroll ke bawah perlahan 4 kali
        7. Buka 8 post terbaru, untuk setiap post catat:
           - caption lengkap
           - hashtag
           - jumlah likes
           - jumlah comments
           - tanggal posting (jika terlihat)
           - tipe (image/carousel/video)
        8. JANGAN like, JANGAN comment, JANGAN follow
        9. Setelah selesai, logout
        10. Kembalikan SEMUA data dalam format JSON
        
        Catatan: jika website meminta verifikasi atau challenge,
        berhenti dan laporkan error.
        """,
        llm=ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.1,
        ),
        use_vision=True,
        max_steps=40,
    )
    
    result = await agent.run()
    return result

# Pool 3 akun untuk rotasi
pool = [
    {"username": "budi_santoso921", "password": "xxx"},
    {"username": "siti_rahayu_456", "password": "xxx"},
    {"username": "andi_pratama_789", "password": "xxx"},
]

# Scrape 1 kompetitor
data = asyncio.run(scrape_competitor("competitor_indonesia", pool[0]))
print(data)
```

---

## 7. Integrasi dengan DigiMar (Vercel → VPS)

```typescript
// Di Vercel: src/app/api/scraper/competitor/route.ts
export async function POST(request: Request) {
  const { username } = await request.json();

  // Panggil VPS scraper agent
  const response = await fetch(`${process.env.VPS_SCRAPER_URL}/scrape/competitor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SCRAPER_SECRET}`
    },
    body: JSON.stringify({ username })
  });

  const rawData = await response.json();

  // Simpan ke Supabase
  const supabase = await createServiceClient();
  await supabase.from('competitor_snapshots').insert({
    competitor_id: rawData.competitor_id,
    snapshot_date: new Date().toISOString(),
    follower_count: rawData.followers,
    following_count: rawData.following,
    total_posts: rawData.posts,
    avg_engagement_rate: calculateEngagement(rawData.posts),
    latest_posts: rawData.posts,
    bio: rawData.bio,
    raw_data: rawData,
  });

  return Response.json({ success: true, data: rawData });
}
```

---

## 8. Biaya Total (Final)

| Item | Provider | Biaya/Bulan |
|------|----------|-------------|
| VPS (4-core, 8GB) | Hetzner | **$15** |
| AI Operator (LLM) | Groq (Llama 3.3 70B) | **$3-5** |
| AI Vision | Groq (Llama 3.2 Vision) | **$5-8** |
| Akun fake (3) | Gmail gratis + thispersondoesnotexist.com | **$0** |
| Proxy | Tidak perlu | **$0** |
| Framework | browser-use / Stagehand (open source) | **$0** |
| **TOTAL** | | **~$23-28/bulan** |

---

## Kesimpulan

**AI bisa mengoperasikan browser langsung — login, navigasi, scraping — dengan biaya hanya AI token consumption.** Framework open-source seperti `browser-use` (Python) atau `Stagehand` (Node.js) sudah menyediakan abstraksi ini. AI agent menggantikan 500+ baris Playwright scripting manual dengan deskripsi task natural language yang adaptive terhadap perubahan UI Instagram dan bisa handle unexpected popup/challenge secara otomatis.

Total biaya: **$23-28/bulan** (VPS $15 + AI tokens $8-13). Tidak ada biaya scraper, tidak ada biaya proxy, tidak ada biaya akun fake.
