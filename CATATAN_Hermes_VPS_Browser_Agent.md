# Hermes AI Agent — Instagram Competitor Analysis with Visual Models (Local VPS + Cloud Providers)

**Tanggal:** 2026-06-17 (updated)
**Status:** Architecture Blueprint
**Model:** Nous Research Hermes (tool-use / function-calling specialist)
**Vision:** LLaMA 3.2 Vision / Pixtral / Qwen-VL / Gemini Flash / GPT-4o
**Deployment:** VPS (local) + Cloud Providers (Groq, OpenRouter, Ollama Cloud, dll.)
**Strategy:** Multi-provider — primary cloud / fallback VPS / hybrid

---

## 1. Kenapa Hermes?

**Hermes** (oleh Nous Research) adalah model yang di-fine-tune khusus untuk **agentic behavior**:
- **Function calling / tool use** — Hermes bisa memanggil browser, klik, type, screenshot
- **Structured JSON output** — Hermes selalu return JSON clean, tidak bertele-tele
- **Autonomous decision making** — bisa handle "jika ada popup, klik Not Now"
- **Multi-turn reasoning** — ingat konteks seluruh sesi scraping
- **Open-weight, self-hosted** — jalan di VPS sendiri, zero API cost

| Model | Size | Strength | GPU Butuh | Speed |
|-------|------|----------|-----------|-------|
| **Hermes-3 Llama-3.2 3B** | 3B | Cepat, CPU friendly | None (CPU OK) | ⚡⚡⚡ |
| **Hermes-3 Llama-3.1 8B** | 8B | Seimbang, tool-use solid | 8GB VRAM | ⚡⚡ |
| **Hermes-3 Llama-3.1 70B** | 70B | Paling pintar, complex reasoning | 48GB VRAM | ⚡ |
| **Hermes-2 Pro Mistral 7B** | 7B | Function calling champion | 6GB VRAM | ⚡⚡⚡ |

**Rekomendasi:** Hermes-3 8B untuk orchestrator + LLaMA 3.2 Vision 11B untuk screenshot analysis. Atau Hermes-3 70B jika VPS kuat dan ingin satu model handle semuanya.

---

## 2. Arsitektur: Hermes as Browser Operator

```
┌────────────────────────────────────────────────────────────────────┐
│                        VPS (Hetzner GPU / RunPod)                   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Hermes Agent (Orchestrator)                 │ │
│  │                    Model: Hermes-3 8B                          │ │
│  │                    Server: Ollama / vLLM                       │ │
│  │                                                                │ │
│  │  "Aku perlu scraping profil Instagram @competitor"            │ │
│  │    ↓                                                           │ │
│  │  Hermes decides:                                               │ │
│  │    Step 1: navigate("instagram.com/accounts/login")           │ │
│  │    Step 2: type("input[name=username]", "budi_santoso")       │ │
│  │    Step 3: type("input[name=password]", "pass123")            │ │
│  │    Step 4: click("button[type=submit]")                       │ │
│  │    Step 5: screenshot() → kirim ke Vision model               │ │
│  │    Step 6: Jika Vision lihat popup → click("Not Now")         │ │
│  │    Step 7: navigate("instagram.com/competitor")               │ │
│  │    Step 8: scroll(3x) → screenshot → Vision model             │ │
│  │    ...                                                        │ │
│  └───────────────────────┬───────────────────────────────────────┘ │
│                          │                                          │
│  ┌───────────────────────▼───────────────────────────────────────┐ │
│  │                  Browser (Playwright + Chromium)               │ │
│  │  • Hermes kirim action → Playwright execute                   │ │
│  │  • Playwright return DOM/screenshot → Hermes parse            │ │
│  └───────────────────────┬───────────────────────────────────────┘ │
│                          │                                          │
│  ┌───────────────────────▼───────────────────────────────────────┐ │
│  │              Vision Model (Screenshot → Data)                  │ │
│  │              Model: LLaMA 3.2 Vision 11B / Qwen-VL 7B         │ │
│  │  • Screenshot profil → extract followers, bio, posts          │ │
│  │  • Screenshot post → extract caption, likes, hashtags         │ │
│  │  • Screenshot error → "ini challenge page, stop scraping"     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              Hermes + Ollama API (OpenAI-compatible)           │ │
│  │              POST http://localhost:11434/v1/chat/completions  │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ HTTP
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase                                     │
│  competitor_snapshots, competitor_posts, competitor_profiles        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. VPS Specs & Ollama Setup

### 3.1 VPS Pilihan

| Provider | Spec | GPU | Harga/Bulan |
|----------|------|-----|-------------|
| **Hetzner GPU** | 8 vCPU, 32GB, RTX 4000 | 8GB VRAM | ~€80 |
| **RunPod** (Spot) | RTX 3090 | 24GB VRAM | ~$0.30/jam → ~$50/bln (pakai 6 jam/hari) |
| **Vast.ai** | RTX 3060 / A4000 | 12-16GB | ~$0.20/jam → ~$35/bln |
| **Lambda GPU** | A10 | 24GB VRAM | ~$0.60/jam |

**Rekomendasi:** **RunPod Spot** — RTX 3090 (24GB VRAM) cukup untuk Hermes 8B + Vision 11B. Nyalakan hanya saat scraping (pakai serverless trigger), matikan setelah selesai.

### 3.2 Kalau Mau CPU Only (Quantized)

Untuk hemat ekstrem, Hermes bisa jalan di CPU dengan GGUF quantized:

| Model Quantized | RAM Butuh | Speed | Kualitas |
|----------------|-----------|-------|----------|
| Hermes-3 3B Q4_K_M | 2GB | Cepat | Cukup untuk tool-use simpel |
| Hermes-3 8B Q4_K_M | 6GB | Sedang | Bagus untuk function calling |
| Hermes-3 8B Q8_0 | 10GB | Lambat | Presisi tinggi |

**Hetzner VPS 8GB RAM ($15/bln)** bisa jalan Hermes-3 3B quantized + Vision ringan.

---

## 4. Install Stack di VPS

```bash
#!/bin/bash
# install-hermes-scraper.sh

# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull Hermes model (pilih salah satu)
ollama pull hermes3:8b-llama3.1-q4_K_M     # 8B quantized - rekomendasi
# ollama pull hermes3:70b-llama3.1-q4_K_M   # 70B - butuh GPU 48GB
# ollama pull hermes3:3b-llama3.2-q8_0      # 3B - CPU friendly

# 3. Pull Vision model (untuk screenshot → data)
ollama pull llava-llama3:8b                 # LLaVA-based, ringan
# atau
ollama pull minicpm-v:8b                    # MiniCPM-V, bagus untuk OCR + UI
# atau via custom Modelfile untuk LLaMA 3.2 Vision

# 4. Install Playwright untuk browser
npm install -g playwright
playwright install chromium
playwright install-deps

# 5. Install Python (untuk agent orchestration)
pip install ollama playwright browser-use
```

### Custom Hermes Modelfile (untuk Vision)

```dockerfile
# Modelfile-Hermes-Vision
FROM hermes3:8b-llama3.1

SYSTEM """Kamu adalah Hermes, AI agent yang mengoperasikan browser untuk scraping Instagram.
Kamu menerima screenshot dan DOM, lalu memutuskan aksi selanjutnya.

TOOLS TERSEDIA:
1. navigate(url) - Buka URL
2. type(selector, text) - Ketik text  
3. click(selector) - Klik elemen
4. screenshot() - Ambil screenshot halaman
5. scroll(amount) - Scroll halaman
6. extract_profile() - Selesai: return data profil
7. extract_posts() - Selesai: return data posts
8. done() - Selesai: return final JSON

ATURAN:
- Jika ada popup/notification: click "Not Now"
- Jika diminta verifikasi/OTP: report error, JANGAN lanjutkan
- Jika halaman tidak load dalam 10 detik: screenshot, analisis, retry atau report error
- Setiap 3-5 aksi, ambil screenshot untuk verifikasi posisi
- Jangan terlalu cepat: jeda 1-3 detik antar aksi
- Jangan like, comment, atau follow siapa pun
"""
```

Build dan run:
```bash
ollama create hermes-scraper -f Modelfile-Hermes-Vision
ollama run hermes-scraper
```

---

## 5. Agent Loop: Hermes + Browser + Vision

```python
# scraper_agent.py
import asyncio
import json
import base64
from playwright.async_api import async_playwright
from ollama import AsyncClient

# Config
HERMES_MODEL = "hermes3:8b-llama3.1"
VISION_MODEL = "minicpm-v:8b"   # Atau llava-llama3:8b

# Tool definitions untuk Hermes
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "navigate",
            "description": "Buka URL di browser",
            "parameters": {
                "type": "object",
                "properties": {"url": {"type": "string"}},
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "type",
            "description": "Ketik text di input field (gunakan selector CSS)",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string"},
                    "text": {"type": "string"}
                },
                "required": ["selector", "text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "click",
            "description": "Klik elemen berdasarkan selector CSS atau text",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS selector atau text elemen"}
                },
                "required": ["selector"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "screenshot",
            "description": "Ambil screenshot halaman saat ini dan analisis dengan Vision model",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_page_text",
            "description": "Baca seluruh text yang terlihat di halaman",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "scroll",
            "description": "Scroll halaman ke bawah",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "integer", "description": "Jumlah pixel, 300-800"}
                },
                "required": ["amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "wait",
            "description": "Tunggu beberapa detik (simulasi human delay)",
            "parameters": {
                "type": "object",
                "properties": {
                    "seconds": {"type": "number"}
                },
                "required": ["seconds"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "submit_results",
            "description": "SELESAI. Panggil ini saat semua data sudah terkumpul. Kembalikan data dalam JSON.",
            "parameters": {
                "type": "object",
                "properties": {
                    "competitor_username": {"type": "string"},
                    "followers": {"type": "integer"},
                    "following": {"type": "integer"},
                    "posts_count": {"type": "integer"},
                    "bio": {"type": "string"},
                    "latest_posts": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "caption": {"type": "string"},
                                "hashtags": {"type": "array", "items": {"type": "string"}},
                                "likes": {"type": "integer"},
                                "comments": {"type": "integer"},
                                "type": {"type": "string"},
                                "posted_at": {"type": "string"}
                            }
                        }
                    }
                },
                "required": ["competitor_username", "followers", "posts_count", "latest_posts"]
            }
        }
    }
]

class HermesScraperAgent:
    def __init__(self, account: dict, target_username: str):
        self.account = account
        self.target = target_username
        self.browser = None
        self.page = None
        self.ollama = AsyncClient()
        self.messages = []
        self.history = []
    
    async def start(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=False,
            args=['--no-sandbox', '--disable-blink-features=AutomationControlled']
        )
        context = await self.browser.new_context(
            user_agent='Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/125.0.6422.165 Mobile Safari/537.36',
            viewport={'width': 390, 'height': 844},
            is_mobile=True,
            has_touch=True,
        )
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        """)
        self.page = await context.new_page()
    
    async def execute_tool(self, tool_call):
        """Eksekusi tool yang dipanggil Hermes, return hasil"""
        name = tool_call['function']['name']
        args = json.loads(tool_call['function']['arguments'])
        
        try:
            if name == 'navigate':
                await self.page.goto(args['url'], wait_until='networkidle', timeout=30000)
                return f"Berhasil navigasi ke {args['url']}"
            
            elif name == 'type':
                await self.page.fill(args['selector'], args['text'], timeout=10000)
                return f"Berhasil mengetik '{args['text']}' di {args['selector']}"
            
            elif name == 'click':
                # Coba klik by text dulu, baru by selector
                try:
                    await self.page.get_by_text(args['selector'], exact=False).first.click(timeout=5000)
                except:
                    await self.page.click(args['selector'], timeout=5000)
                return f"Berhasil klik {args['selector']}"
            
            elif name == 'screenshot':
                # Ambil screenshot, kirim ke Vision model
                screenshot_bytes = await self.page.screenshot(type='png')
                b64 = base64.b64encode(screenshot_bytes).decode()
                
                vision_result = await self._analyze_with_vision(b64)
                return f"Screenshot diambil. Analisis Vision: {vision_result}"
            
            elif name == 'get_page_text':
                text = await self.page.evaluate('() => document.body.innerText')
                return text[:5000]  # Limit panjang
            
            elif name == 'scroll':
                await self.page.evaluate(f'window.scrollBy(0, {args["amount"]})')
                await asyncio.sleep(1.5 + random.random() * 1.5)
                return f"Scroll {args['amount']}px"
            
            elif name == 'wait':
                await asyncio.sleep(args['seconds'])
                return f"Menunggu {args['seconds']} detik"
            
            elif name == 'submit_results':
                return json.dumps(args)
            
        except Exception as e:
            return f"ERROR: {str(e)}. Analisis situasi dan coba alternatif."
    
    async def _analyze_with_vision(self, screenshot_b64: str) -> str:
        """Kirim screenshot ke Vision model untuk analisis"""
        response = await self.ollama.chat(
            model=VISION_MODEL,
            messages=[{
                'role': 'user',
                'content': 'Kamu adalah analis halaman Instagram. Deskripsikan apa yang kamu lihat di screenshot ini. Apa halaman ini? Ada popup? Ada error? Jumlah followers terlihat? Post terlihat? Jawab dalam Bahasa Indonesia, singkat.',
                'images': [screenshot_b64]
            }]
        )
        return response['message']['content']
    
    async def run(self):
        """Main agent loop"""
        self.messages = [{
            'role': 'system',
            'content': f"""Kamu adalah Hermes, AI agen scraping Instagram.

TUGAS: Login sebagai {self.account['username']}, kemudian buka profil @{self.target}, 
kumpulkan data lengkap: followers, following, posts, bio, dan 8 post terbaru (caption, hashtag, likes, comments, type).

ATURAN PENTING:
1. Jika ada popup/notifikasi → klik "Not Now"
2. Jika diminta verifikasi/OAuth/challenge → hentikan, panggil submit_results dengan error
3. Jika halaman error/block → screenshot, analisis, coba 1x lagi, jika gagal → hentikan
4. Jangan like, comment, follow
5. Setelah login, tunggu 3 detik sebelum navigasi
6. Di profil, scroll 3-4 kali untuk load post grid
7. Untuk setiap post: klik, baca caption, catat likes/comments, kembali
8. Setelah semua data terkumpul → panggil submit_results

Mulai sekarang."""
        }]
        
        max_steps = 30
        for step in range(max_steps):
            print(f"\n--- Step {step + 1}/{max_steps} ---")
            
            # Panggil Hermes
            response = await self.ollama.chat(
                model=HERMES_MODEL,
                messages=self.messages,
                tools=TOOLS,
                options={'temperature': 0.1, 'num_predict': 2000}
            )
            
            msg = response['message']
            self.messages.append(msg)
            
            # Cek apakah Hermes panggil tool
            if msg.get('tool_calls'):
                for tool_call in msg['tool_calls']:
                    print(f"  🔧 {tool_call['function']['name']}")
                    
                    result = await self.execute_tool(tool_call)
                    print(f"  ✓ Result: {result[:200]}...")
                    
                    self.messages.append({
                        'role': 'tool',
                        'content': result,
                    })
                    
                    # Jika submit_results → selesai
                    if tool_call['function']['name'] == 'submit_results':
                        await self.stop()
                        return json.loads(tool_call['function']['arguments'])
            else:
                # Hermes kasih text response (biasanya reasoning)
                print(f"  💬 {msg.get('content', '')[:200]}")
        
        await self.stop()
        raise Exception("Agent mencapai max steps tanpa selesai")
    
    async def stop(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


# ===== RUN =====
async def main():
    # Pool akun fake
    akun = {"username": "budi_santoso921", "password": "Pass123!"}
    target = "competitor_brand"
    
    agent = HermesScraperAgent(akun, target)
    await agent.start()
    
    try:
        data = await agent.run()
        print("\n✅ HASIL SCRAPING:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"\n❌ Scraping gagal: {e}")

asyncio.run(main())
```

---

## 6. Vision Model Detail

Dua opsi Vision model untuk pasangan Hermes:

### Opsi A: MiniCPM-V 8B (Rekomendasi)

```bash
ollama pull minicpm-v:8b
```

| Keunggulan | Detail |
|-----------|--------|
| Ukuran | 8B parameter, 5GB VRAM |
| OCR | Paling akurat baca text di UI/screenshot |
| UI Understanding | Bisa identifikasi button, popup, form |
| Bahasa Indonesia | Support multi-bahasa |
| Speed | ~2-3 detik per screenshot |

```python
# Analisis detail dengan MiniCPM-V
async def extract_profile_data(screenshot_b64: str):
    response = await ollama.chat(
        model='minicpm-v:8b',
        messages=[{
            'role': 'user',
            'content': """Analisis screenshot profil Instagram ini.
Ekstrak data berikut dalam JSON:
- Jumlah posts
- Jumlah followers  
- Jumlah following
- Nama display
- Bio (lengkap)
- Apakah verified? (true/false)
- Apakah private? (true/false)

HANYA return JSON, tanpa teks lain.""",
            'images': [screenshot_b64]
        }],
        format='json'
    )
    return json.loads(response['message']['content'])
```

### Opsi B: LLaVA (Llama 3)

```bash
ollama pull llava-llama3:8b
```

| Keunggulan | Detail |
|-----------|--------|
| Ukuran | 8B, ~5GB VRAM |
| Speed | Paling cepat (~1 detik) |
| Integrasi | Ollama native, stabil |
| Kekurangan | OCR tidak seakurat MiniCPM-V |

---

## 7. Pool Manager — 3 Akun Fake dengan Hermes

```python
# pool_manager.py
import json
import time
from datetime import datetime

class AccountPool:
    def __init__(self, accounts_file='fake_accounts.json'):
        with open(accounts_file) as f:
            self.accounts = json.load(f)  # [{username, password, status, last_used, cooldown_until}]
    
    def get_available(self):
        """Pilih akun yang ready untuk scraping"""
        now = datetime.now()
        for acc in self.accounts:
            if acc['status'] == 'active':
                cooldown = datetime.fromisoformat(acc.get('cooldown_until', '2000-01-01'))
                if now > cooldown:
                    return acc
        return None
    
    def mark_used(self, username: str):
        """Tandai akun sudah dipakai, set cooldown 4 jam"""
        for acc in self.accounts:
            if acc['username'] == username:
                acc['last_used'] = datetime.now().isoformat()
                acc['cooldown_until'] = datetime.now().timestamp() + 4 * 3600  # 4 jam
                break
        self._save()
    
    def mark_banned(self, username: str):
        """Tandai akun kena ban"""
        for acc in self.accounts:
            if acc['username'] == username:
                acc['status'] = 'banned'
                break
        self._save()
    
    def health_report(self):
        """Laporan status semua akun"""
        return [
            f"{a['username']}: {a['status']} | last: {a.get('last_used', 'never')}"
            for a in self.accounts
        ]
    
    def _save(self):
        with open('fake_accounts.json', 'w') as f:
            json.dump(self.accounts, f, indent=2)
```

```json
// fake_accounts.json
[
  {
    "username": "budi_santoso921",
    "password": "encrypted_or_env_var",
    "email": "budi.santoso921@gmail.com",
    "status": "active",
    "created_at": "2026-06-01",
    "last_used": null,
    "cooldown_until": null,
    "total_scrapes": 0,
    "proxy": null
  },
  {
    "username": "siti_rahayu_456",
    "password": "encrypted_or_env_var",
    "email": "siti.rahayu456@gmail.com",
    "status": "active",
    "created_at": "2026-06-01",
    "last_used": null,
    "cooldown_until": null,
    "total_scrapes": 0,
    "proxy": null
  },
  {
    "username": "andi_pratama_789",
    "password": "encrypted_or_env_var",
    "email": "andi.pratama789@gmail.com",
    "status": "active",
    "created_at": "2026-06-01",
    "last_used": null,
    "cooldown_until": null,
    "total_scrapes": 0,
    "proxy": null
  }
]
```

---

## 8. API Server (FastAPI — VPS)

```python
# api_server.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio
import subprocess

app = FastAPI()
SECRET = "scraper-secret-token-xxx"

class ScrapeRequest(BaseModel):
    target_username: str
    deep: bool = False  # False = only profile, True = open all posts

account_pool = AccountPool()

@app.post("/scrape/competitor")
async def scrape_competitor(req: ScrapeRequest):
    # Cek akun tersedia
    account = account_pool.get_available()
    if not account:
        raise HTTPException(status_code=429, detail="Semua akun dalam cooldown")
    
    # Jalankan Hermes agent
    agent = HermesScraperAgent(account, req.target_username)
    await agent.start()
    
    try:
        data = await agent.run()
        account_pool.mark_used(account['username'])
        
        # Simpan ke Supabase (optional, bisa juga return raw)
        # await save_to_supabase(data)
        
        return {"success": True, "data": data, "account_used": account['username']}
    
    except Exception as e:
        # Cek apakah akun kena ban
        if "login" in str(e).lower() or "challenge" in str(e).lower():
            account_pool.mark_banned(account['username'])
        
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scrape/accounts/health")
async def account_health():
    return {"accounts": account_pool.health_report()}

@app.get("/scrape/status")
async def scrape_status():
    return {
        "status": "idle",
        "accounts_available": bool(account_pool.get_available()),
        "hermes_model": HERMES_MODEL,
        "vision_model": VISION_MODEL,
    }

# Start: uvicorn api_server:app --host 0.0.0.0 --port 8000
```

---

## 9. Warming-Up Akun dengan Hermes

```python
# warming_up.py
import asyncio
from datetime import datetime

WARMUP_TASKS = {
    1: "Buka Instagram feed. Scroll 5 kali perlahan. Like 1-2 postingan yang menarik. Jangan follow siapa pun. Durasi: 5 menit.",
    2: "Buka Instagram feed. Scroll 8 kali. Like 2 postingan. Lihat 2 story. Follow 2-3 akun random (brand lokal). Durasi: 8 menit.",
    3: "Buka Instagram feed. Scroll 10 kali. Like 3 postingan. Lihat 3 story. Follow 2 akun. Comment 1x (simple: 'keren!'). Durasi: 10 menit.",
    4: "Buka Instagram feed. Scroll santai 5 menit. Like 2 postingan. Lihat story. Durasi: 7 menit.",
    5: "Buka Instagram feed. Scroll 8 kali. Like 3 postingan. Lihat 4 story. Follow 1 akun. Durasi: 10 menit.",
    6: "Buka Instagram feed. Scroll 12 kali. Like 4 postingan. Lihat 5 story. Follow 2 akun. Comment 1x. Durasi: 12 menit.",
    7: "Buka Instagram feed. Scroll natural 10 menit. Like 3 postingan. Lihat semua story. Follow 1 akun. Durasi: 12 menit.",
}

async def warmup_account(account: dict, day: int):
    agent = HermesScraperAgent(account, "")  # Target kosong untuk warmup
    agent.system_prompt = f"""Kamu adalah pengguna Instagram biasa bernama {account['username']}.
{ WARMUP_TASKS.get(day, WARMUP_TASKS[7]) }

Bersikap natural - scroll dengan kecepatan bervariasi, berhenti di post yang menarik.
Jangan like semua post. Jangan follow berlebihan. Jadilah manusia biasa.
TIDAK USAH mengumpulkan data apa pun. Cuma scroll dan berinteraksi seperti manusia."""
    
    await agent.start()
    await agent.run()
    print(f"✅ Warmup day {day} selesai untuk {account['username']}")
```

---

## 10. Biaya Akhir — Mode Operasi

### Mode A: Cloud-First (Rekomendasi MVP)

| Item | Provider | Spesifikasi | Biaya/Bulan |
|------|----------|-------------|-------------|
| **VPS CPU** | Hetzner 8GB | Playwright + Ollama fallback only | **$15** |
| **AI: Tool-use** | OpenRouter | Hermes 3 405B — free tier | **$0** |
| **AI: Vision** | Groq | LLaMA 3.2 Vision 90B — free tier | **$0** |
| **AI: Overflow** | OpenRouter / Groq (paid) | Jika limit free tier tercapai | **$2-5** |
| **Playwright** | Open source | Browser automation | **$0** |
| **Account fake** | Gmail gratis | 3 akun | **$0** |
| **Proxy** | Tidak perlu | Behavioral rate limiting | **$0** |
| **Ollama** | Open source | Model fallback server | **$0** |
| **TOTAL Cloud-First** | | | **$17-20/bln** |

### Mode B: GPU VPS (Self-Hosted — Zero API Cost)

| Item | Provider | Spesifikasi | Biaya/Bulan |
|------|----------|-------------|-------------|
| **VPS GPU** | RunPod Spot (RTX 3090) | 24GB VRAM, hidup 6 jam/hari | **$40-50** |
| **VPS GPU alternatif** | Vast.ai RTX 3060 | 12GB, hidup 8 jam/hari | **$30-35** |
| **VPS CPU alternatif** | Hetzner 8GB | Hermes 3B Q4 quantized + LLaVA | **$15** |
| **AI API Cost** | $0 (model self-hosted) | Hermes + Vision local | **$0** |
| **TOTAL GPU Self-Hosted** | | | **$30-50/bln** |

### Mode C: Pure Cloud (Tanpa VPS — hanya API Provider)

| Item | Provider | Biaya/Bulan |
|------|----------|-------------|
| **AI: Tool-use** | OpenRouter Hermes 3 405B (free) | **$0** |
| **AI: Vision** | Groq LLaMA 3.2 Vision (free) | **$0** |
| **Browser** | Browserbase / Stagehand cloud | **$10-20** |
| **Scraper execution** | Vercel Cron (no long-running browser) | **$0** |
| **TOTAL Pure Cloud** | | **$10-20/bln** |

> **Rekomendasi:** Mode A (Cloud-First) — biaya terendah, setup paling simpel. Hanya butuh VPS CPU murah untuk Playwright browser. OpenRouter free tier + Groq free tier menangani 90% kebutuhan AI. Local Ollama di VPS sebagai safety net.

---

## 11. Trigger dari Vercel ke VPS

```typescript
// Di Vercel: src/app/api/scraper/trigger/route.ts
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  // Cek cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Ambil daftar kompetitor dari Supabase
  const supabase = await createServiceClient();
  const { data: competitors } = await supabase
    .from('competitors')
    .select('instagram_username')
    .eq('is_active', true);
  
  if (!competitors || competitors.length === 0) {
    return Response.json({ message: 'No competitors to scrape' });
  }
  
  const results = [];
  for (const comp of competitors) {
    // POST ke VPS
    const response = await fetch(`${process.env.VPS_SCRAPER_URL}/scrape/competitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SCRAPER_SECRET}`
      },
      body: JSON.stringify({ target_username: comp.instagram_username })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Simpan ke Supabase
      await supabase.from('competitor_snapshots').insert({
        competitor_id: comp.id,
        snapshot_date: new Date().toISOString(),
        follower_count: data.data.followers,
        following_count: data.data.following,
        total_posts: data.data.posts_count,
        latest_posts: data.data.latest_posts,
        bio: data.data.bio,
        raw_data: data.data,
      });
      
      results.push({ username: comp.instagram_username, success: true });
    } else {
      results.push({ username: comp.instagram_username, success: false });
    }
    
    // Jeda 3 menit antar kompetitor (rate limiting)
    await new Promise(r => setTimeout(r, 180000));
  }
  
  return Response.json({ processed: results.length, results });
}
```

```json
// vercel.json cron
{
  "crons": [
    {
      "path": "/api/scraper/trigger",
      "schedule": "0 8,16 * * *"
    }
  ]
}
```

---

## 12. HYBRID: Multi-Provider AI — Cloud + Local VPS

Hermes bukan cuma bisa self-hosted. Bisa diakses dari **cloud provider manapun** yang support OpenAI-compatible API. **Strategi optimal: primary cloud provider + local VPS sebagai fallback**, atau hybrid tergantung task complexity dan volume.

---

### 12.1 Provider Matrix — Hermes & Vision di Cloud

| Provider | Endpoint | Hermes/Tool Model | Vision Model | Harga Input/Output | Free Tier? |
|----------|----------|------------------|-------------|-------------------|------------|
| **OpenRouter** | `openrouter.ai/api/v1` | `nousresearch/hermes-3-llama-3.1-405b:free` | `qwen/qwen-2-vl-72b-instruct` | $0 / $0.90/1M | ✅ Hermes 405B GRATIS |
| **Groq** | `api.groq.com/openai/v1` | `llama-3.3-70b-versatile` (native tool-use) | `llama-3.2-90b-vision-preview` | $0.59/$0.79 + gratis tier | ✅ Vision gratis tier |
| **Together AI** | `api.together.xyz/v1` | `NousResearch/Hermes-3-Llama-3.1-70B` | `meta-llama/Llama-3.2-90B-Vision` | $0.90/$0.90 | ❌ |
| **Ollama** (local VPS) | `localhost:11434/v1` | `hermes3:8b-llama3.1` | `minicpm-v:8b` | $0 (fixed VPS cost) | ✅ Full free |
| **Lambda GPU** | Managed API | Hermes 3 via vLLM | LLaMA 3.2 Vision | $0.30/jam GPU | ❌ |
| **Fireworks** | `api.fireworks.ai` | `accounts/nousresearch/hermes-3-llama` | `accounts/fireworks/llama-v3p2-90b-vision` | $0.90/$0.90 | ❌ |
| **DeepInfra** | `api.deepinfra.com/v1/openai` | `NousResearch/Hermes-3-Llama-3.1-405B` | `Qwen/Qwen2-VL-72B-Instruct` | $2.50/$2.50 | ❌ |

### 12.2 Provider Recommendation by Task

| Task | Primary Provider | Fallback | Kenapa |
|------|-----------------|----------|--------|
| **Tool-use reasoning** (step decision) | OpenRouter Hermes 3 405B (gratis!) | Groq Llama 3.3 70B | Hermes jago function calling + gratis |
| **Vision: OCR + UI analysis** | OpenRouter Qwen 2.5 VL 72B | Groq LLaMA 3.2 Vision | Qwen VL paling akurat baca UI |
| **Vision: quick check** (popup? error?) | Groq LLaMA 3.2 Vision (gratis tier) | Local MiniCPM-V | Groq gratis + super cepat |
| **Data extraction** (caption, likes) | Groq Llama 3.3 70B | Together Hermes 70B | Groq paling murah + cepat |
| **High volume** (>20 competitor) | Self-hosted VPS Hermes 8B | Groq fallback | Fixed VPS cost vs variable API |
| **Low volume** (<10 competitor) | OpenRouter free + Groq free tier | Local VPS | Hampir gratis total |

### 12.3 Multi-Provider Agent Implementation

```python
# hybrid_agent.py — Hermes dengan multi-provider + auto-fallback
import os
from openai import AsyncOpenAI
from enum import Enum

class AIProvider(Enum):
    OPENROUTER = "openrouter"
    GROQ = "groq"
    TOGETHER = "together"  
    LOCAL_OLLAMA = "local_ollama"

class HybridHermesAgent:
    def __init__(self):
        self.clients = {}
        self._init_clients()
    
    def _init_clients(self):
        # OpenRouter — Hermes 405B GRATIS
        if os.getenv('OPENROUTER_API_KEY'):
            self.clients[AIProvider.OPENROUTER] = {
                'client': AsyncOpenAI(
                    base_url='https://openrouter.ai/api/v1',
                    api_key=os.getenv('OPENROUTER_API_KEY'),
                    default_headers={'HTTP-Referer': 'https://digimar.app'}
                ),
                'tool_model': 'nousresearch/hermes-3-llama-3.1-405b:free',
                'vision_model': 'qwen/qwen-2-vl-72b-instruct',
                'cost_per_1k_input': 0.0,  # Free tier
                'cost_per_1k_output': 0.0,
            }
        
        # Groq — Llama 3.3 tool-use + LLaMA Vision gratis tier
        if os.getenv('GROQ_API_KEY'):
            self.clients[AIProvider.GROQ] = {
                'client': AsyncOpenAI(
                    base_url='https://api.groq.com/openai/v1',
                    api_key=os.getenv('GROQ_API_KEY')
                ),
                'tool_model': 'llama-3.3-70b-versatile',
                'vision_model': 'llama-3.2-90b-vision-preview',
                'cost_per_1k_input': 0.00059,
                'cost_per_1k_output': 0.00079,
            }
        
        # Together AI — Hermes 3 asli
        if os.getenv('TOGETHER_API_KEY'):
            self.clients[AIProvider.TOGETHER] = {
                'client': AsyncOpenAI(
                    base_url='https://api.together.xyz/v1',
                    api_key=os.getenv('TOGETHER_API_KEY')
                ),
                'tool_model': 'NousResearch/Hermes-3-Llama-3.1-70B',
                'vision_model': 'meta-llama/Llama-3.2-90B-Vision-Instruct',
                'cost_per_1k_input': 0.0009,
                'cost_per_1k_output': 0.0009,
            }
        
        # Local Ollama VPS
        try:
            import aiohttp
            self.clients[AIProvider.LOCAL_OLLAMA] = {
                'client': AsyncOpenAI(
                    base_url=os.getenv('OLLAMA_URL', 'http://localhost:11434/v1'),
                    api_key='ollama'
                ),
                'tool_model': 'hermes3:8b-llama3.1',
                'vision_model': 'minicpm-v:8b',
                'cost_per_1k_input': 0.0,
                'cost_per_1k_output': 0.0,
            }
        except:
            pass
    
    async def chat_with_fallback(self, messages, tools=None, 
                                  model_type='tool', 
                                  priority=None):
        """Primary-first → fallback chain. Hentikan saat berhasil."""
        if priority is None:
            priority = [
                AIProvider.OPENROUTER,  # Gratis, Hermes 405B
                AIProvider.GROQ,         # Cepat + murah
                AIProvider.TOGETHER,     # Hermes asli 70B
                AIProvider.LOCAL_OLLAMA  # Last resort
            ]
        
        for provider in priority:
            if provider not in self.clients:
                continue
            
            try:
                config = self.clients[provider]
                model = config[f'{model_type}_model']
                
                kwargs = {
                    'model': model,
                    'messages': messages,
                    'temperature': 0.1,
                    'max_tokens': 2000,
                }
                if tools:
                    kwargs['tools'] = tools
                    kwargs['tool_choice'] = 'auto'
                
                response = await config['client'].chat.completions.create(**kwargs)
                print(f"✅ [{provider.value}] SUCCESS — model: {model}")
                return response, provider
                
            except Exception as e:
                print(f"⚠️  [{provider.value}] FAILED — {str(e)[:80]}")
                continue
        
        raise Exception("ALL PROVIDERS FAILED — check API keys and network")
    
    async def analyze_screenshot(self, screenshot_b64: str, question: str):
        """Vision: OpenRouter Qwen VL → Groq → Local"""
        messages = [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': question},
                {'type': 'image_url', 
                 'image_url': {'url': f'data:image/png;base64,{screenshot_b64}'}}
            ]
        }]
        
        response, provider = await self.chat_with_fallback(
            messages=messages,
            model_type='vision',
            priority=[
                AIProvider.OPENROUTER,  # Qwen VL 72B — best vision
                AIProvider.GROQ,        # LLaMA Vision 90B — gratis tier
                AIProvider.TOGETHER,
                AIProvider.LOCAL_OLLAMA
            ]
        )
        return response.choices[0].message.content, provider

# Usage
agent = HybridHermesAgent()

# Tool decision → OpenRouter Hermes 405B FREE
resp, provider = await agent.chat_with_fallback(
    messages=[{'role': 'system', 'content': 'You are Hermes...'}, ...],
    tools=TOOLS,
    model_type='tool'
)

# Vision → OpenRouter Qwen VL → Groq fallback
analysis, used = await agent.analyze_screenshot(screenshot_b64, 
    "Ada popup? Form login terlihat?")
```

### 12.4 Biaya per Provider — per Scrape 1 Kompetitor

| Provider Config | Tool-Use | Vision | Per Scrape | 20/hari | 600/bln |
|----------------|----------|--------|------------|---------|---------|
| **OpenRouter FREE** (Hermes 405B + Qwen VL) | $0 | $0.003 | **$0.003** | $0.06 | **$1.80** |
| **Groq FREE tier** (Llama 3.3 + Llama Vision) | $0 | $0 | **$0** | $0 | **$0** |
| **Groq PAID** (no limit) | $0.003 | $0.006 | **$0.009** | $0.18 | **$5.40** |
| **OpenRouter PAID** | $0.002 | $0.005 | **$0.007** | $0.14 | **$4.20** |
| **Local Ollama VPS** (8B quantized) | $0 | $0 | **$0** | $0 | **$0** |
| **HYBRID: Groq FREE + Local fallback** | $0 | $0 | **$0** | $0 | **$0** |

> **Kesimpulan:** Groq free tier + OpenRouter free tier sudah cukup untuk volume rendah-sedang. **Biaya AI = $0/bulan.** Local VPS Ollama sebagai fallback saat limit free tier tercapai.

### 12.5 Integrasi dengan DigiMar Provider System

Update database schema `ai_providers`:

```sql
-- Tambahkan provider baru
INSERT INTO ai_providers (user_id, provider_name, base_url, model, is_active, priority, config)
VALUES 
  ('user-uuid', 'openrouter', 'https://openrouter.ai/api/v1', 
   'nousresearch/hermes-3-llama-3.1-405b:free', true, 1, 
   '{"tool_model": "nousresearch/hermes-3-llama-3.1-405b:free", "vision_model": "qwen/qwen-2-vl-72b-instruct"}'),
   
  ('user-uuid', 'groq', 'https://api.groq.com/openai/v1',
   'llama-3.3-70b-versatile', true, 2,
   '{"tool_model": "llama-3.3-70b-versatile", "vision_model": "llama-3.2-90b-vision-preview"}'),
   
  ('user-uuid', 'ollama_local', 'http://vps-ip:11434/v1',
   'hermes3:8b-llama3.1', true, 3,
   '{"tool_model": "hermes3:8b-llama3.1", "vision_model": "minicpm-v:8b"}');
```

Update `src/lib/ai/factory.ts`:

```typescript
case 'openrouter':
  client = new OpenRouterClient(apiKey, config.tool_model, config.vision_model);
  break;
case 'ollama_local':
  client = new OllamaLocalClient(config.base_url, config.tool_model);
  break;
```

---

## 13. Arsitektur Final: Multi-Provider Hybrid

```
┌──────────────────────────────────────────────────────────────────────┐
│                           VERCEL ($0)                                 │
│  Dashboard + Cron Triggers + Supabase Database                       │
│  /api/scraper/trigger → kirim job ke VPS                              │
└──────────────┬───────────────────────────────────────────────────────┘
               │ HTTP
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      VPS ($15-50/bln)                                 │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              HybridHermesAgent                                   │ │
│  │                                                                   │ │
│  │  Step 1: Tool decision                                           │ │
│  │    🟢 TRY: OpenRouter → Hermes 3 405B (FREE)                    │ │
│  │    🟡 FALLBACK: Groq → Llama 3.3 70B (FREE tier)               │ │
│  │    🟡 FALLBACK: Together AI → Hermes 3 70B                      │ │
│  │    🔵 LAST: Local Ollama → Hermes 3 8B                          │ │
│  │                                                                   │ │
│  │  Step 2: Vision analysis                                         │ │
│  │    🟢 TRY: OpenRouter → Qwen 2.5 VL 72B                         │ │
│  │    🟡 FALLBACK: Groq → LLaMA 3.2 Vision 90B (FREE)              │ │
│  │    🔵 LAST: Local Ollama → MiniCPM-V 8B                         │ │
│  │                                                                   │ │
│  │  Result: Always available. Zero single point of failure.         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  🌐 Playwright + Chromium (headful)                              │ │
│  │  👤 Pool 3 akun fake Instagram                                   │ │
│  │  ⏱️  Behavioral rate limiter                                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Models:                                                              │
│  🧠 Hermes 3 405B — OpenRouter (gratis) — tool-use decisions        │
│  👁️ Qwen 2.5 VL 72B — OpenRouter (paid) — vision analysis           │
│  🧠 Llama 3.3 70B — Groq (gratis tier) — fallback tool-use         │
│  👁️ LLaMA 3.2 Vision 90B — Groq (gratis tier) — fallback vision    │
│  🔵 Hermes 3 8B — Local Ollama — last resort                        │
│  🔵 MiniCPM-V 8B — Local Ollama — last resort vision                │
└──────────────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
   OpenRouter API              Groq Cloud API
   (free tier)                 (free tier)
         │                           │
         └───────────┬───────────────┘
                     │ (if all cloud fail)
                     ▼
              Local Ollama VPS
              (Hermes 8B + MiniCPM-V)
```

---

## 14. Biaya Final (Hybrid Strategy)

| Item | Provider | Biaya/Bulan |
|------|----------|-------------|
| **VPS** (CPU, 8GB RAM, untuk Playwright + Ollama fallback) | Hetzner | **$15** |
| **AI: Tool-use** | OpenRouter Hermes 3 405B (free tier) | **$0** |
| **AI: Vision** | Groq LLaMA 3.2 Vision (free tier) | **$0** |
| **AI: Overflow/Fallback** | OpenRouter paid / Groq paid | **$2-5** |
| **Akun fake** | Gmail (gratis) | **$0** |
| **Proxy** | Tidak perlu | **$0** |
| **TOTAL** | | **$17-20/bulan** |

---

## 15. Kesimpulan

**Hermes tidak harus self-hosted.** Dengan multi-provider strategy:

- **OpenRouter** menyediakan **Hermes 3 405B GRATIS** (free tier) — model tool-use paling powerful
- **Groq** menyediakan **LLaMA 3.2 Vision GRATIS** — vision analysis tanpa biaya
- **VPS lokal** sebagai **fallback terakhir** jika cloud providers gagal
- **Zero API cost** untuk volume rendah-sedang (<20 kompetitor/hari)
- **Scalable:** tinggal upgrade ke paid tier jika volume naik
- **No vendor lock-in:** ganti provider dengan ganti config, bukan kode
- **Self-healing:** auto-fallback chain memastikan scraping selalu jalan

**Satu Hermes agent, banyak provider — pilih yang paling murah atau gratis saat itu juga.**

