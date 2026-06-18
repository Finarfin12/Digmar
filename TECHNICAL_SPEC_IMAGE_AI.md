# 📐 TECHNICAL SPEC — Image AI Provider (Fase 2)

**Tanggal:** 18 Juni 2026  
**Project:** DigiMar Automation  
**Fitur:** Photorealistic AI Image Generation (DALL-E / Stable Diffusion)  
**Target:** Personal use — tanpa monetisasi / paket pricing  

---

## 🧠 OVERVIEW

Saat ini DigiMar menggunakan **Satori** (HTML-to-Image) untuk AI Canvas — gratis, cepat, tetapi terbatas pada tipografi/vektor. Fitur ini menambahkan opsi **AI Image Generation** fotorealistik via DALL-E 3 dan Stable Diffusion sebagai alternatif render.

---

## 🏗️ ARSITEKTUR

```
┌─────────────────────────────────────────────────────┐
│                   PostScheduler UI                   │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  AI Canvas    │  │  Render Mode Toggle          │ │
│  │  (Satori)     │  │  ○ Tipografi (Satori)        │ │
│  │               │  │  ● Fotorealistik (AI Image)  │ │
│  └──────────────┘  └──────────────────────────────┘ │
└─────────────┬───────────────────┬───────────────────┘
              │                   │
     ┌────────▼────────┐  ┌──────▼──────────────────┐
     │ /api/media/     │  │ /api/media/ai-image     │
     │ canvas          │  │ (NEW ENDPOINT)          │
     │ (existing)      │  │                         │
     └────────┬────────┘  └──────┬──────────────────┘
              │                  │
     ┌────────▼────────┐  ┌──────▼──────────────────┐
     │    Satori        │  │  AI Image Provider      │
     │  (HTML→PNG)      │  │  Factory                │
     └─────────────────┘  └──────┬──────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐ ┌───▼────┐ ┌─────▼──────┐
              │  DALL-E 3 │ │ Stable │ │ Leonardo   │
              │  (OpenAI) │ │ Diff.. │ │ AI (future)│
              └───────────┘ └────────┘ └────────────┘
```

**Prinsip:** Tidak menyentuh `ai_providers` text AI. Image AI punya jalur sendiri — user bisa pakai provider text AI gratis (Groq) + provider image berbayar (DALL-E) secara independen.

---

## 🗄️ DATABASE — MIGRATION

### Migration: `00000000000019_image_ai_provider.sql`

```sql
-- ============================================
-- Image AI Provider Support (Fase 2)
-- Menambahkan kolom untuk image generation
-- ============================================

-- Tambahkan kolom image provider ke ai_providers
ALTER TABLE ai_providers
  ADD COLUMN IF NOT EXISTS image_provider_type TEXT 
    CHECK (image_provider_type IS NULL OR image_provider_type IN ('dalle', 'stability', 'leonardo')),
  ADD COLUMN IF NOT EXISTS image_api_key_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS image_model TEXT,
  ADD COLUMN IF NOT EXISTS image_config JSONB DEFAULT '{}';
-- image_config contoh: { "size": "1024x1024", "quality": "standard", "style": "vivid" }

-- Index
CREATE INDEX IF NOT EXISTS idx_ai_providers_image ON ai_providers(user_id, image_provider_type, is_active);
```

**Penjelasan kolom:**

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `image_provider_type` | TEXT | `'dalle'`, `'stability'`, `'leonardo'`, atau NULL (tidak dikonfigurasi) |
| `image_api_key_encrypted` | BYTEA | API key terenkripsi untuk image provider |
| `image_model` | TEXT | Model spesifik: `'dall-e-3'`, `'stable-diffusion-xl'`, dll |
| `image_config` | JSONB | Konfigurasi tambahan: size, quality, style, steps, dll |

**Kenapa di tabel `ai_providers` bukan tabel baru?**
- Satu user = satu set konfigurasi AI. Memisah ke tabel baru overkill untuk personal use.
- Kolom `image_*` nullable — tidak mengganggu user yang tidak pakai fitur ini.
- Query tetap sederhana: satu `SELECT` dari `ai_providers`.

---

## 🔌 API ROUTES

### Route 1: `GET /api/providers/image` — Baca konfigurasi image provider

```typescript
// GET /api/providers/image
// Response: { image_provider_type: 'dalle' | null, image_model: 'dall-e-3', has_image_key: true }
```

### Route 2: `POST /api/providers/image` — Simpan/update konfigurasi image provider

```typescript
// POST /api/providers/image
// Body: { image_provider_type, image_api_key, image_model, image_config }
// Mengenkripsi image_api_key via encryptValue()
// Validasi base_url via isValidExternalUrl() untuk stability/leonardo
```

### Route 3: `POST /api/media/ai-image` — Generate gambar AI (NEW)

```typescript
// POST /api/media/ai-image
// Body: {
//   business_unit_id: string,
//   prompt: string,
//   negative_prompt?: string,   // untuk Stable Diffusion
//   size?: string,              // '1024x1024' | '1792x1024' | etc
//   style?: string,             // 'vivid' | 'natural' (DALL-E)
//   template_id?: string        // 'centered' | 'split' | 'minimal' — untuk Satori fallback
// }
//
// Flow:
// 1. Auth check (getUser)
// 2. Ownership check (business_unit_id)
// 3. Ambil konfigurasi image provider dari ai_providers
// 4. Decrypt image_api_key
// 5. Panggil API provider sesuai image_provider_type
// 6. Download hasil gambar dari URL response
// 7. Upload ke Supabase Storage (folder user.id/ai-images/)
// 8. Simpan metadata ke media_assets
// 9. Return { url, id, provider, model, prompt }
```

### Route 4: `PUT /api/providers/image` — Update parsial

Gunakan method yang sama dengan POST tapi dengan partial update (hanya field yang dikirim).

---

## 🧩 PROVIDER INTEGRATION

### File baru: `src/lib/ai/image-factory.ts`

```typescript
// src/lib/ai/image-factory.ts
import { createClient } from '@/lib/supabase/server';
import { decryptValue } from '@/lib/crypto/server';
import { isValidExternalUrl } from '@/lib/utils/url';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  size?: string;       // '1024x1024', '1024x1792', '1792x1024'
  quality?: string;    // 'standard' | 'hd' (DALL-E)
  style?: string;      // 'vivid' | 'natural' (DALL-E)
  steps?: number;      // Stable Diffusion
  seed?: number;       // reproducibility
}

export interface ImageGenerationResult {
  url: string;          // temporary URL dari provider
  revisedPrompt?: string; // DALL-E revised prompt
  provider: string;
  model: string;
}

export async function generateAIImage(
  userId: string, 
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const supabase = await createClient();
  
  // 1. Ambil provider
  const { data: providers, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('image_provider_type', 'is', null)
    .order('priority', { ascending: true })
    .limit(1);

  if (error || !providers || providers.length === 0) {
    throw new Error('No image AI provider configured. Add one in Settings > AI Provider.');
  }

  const provider = providers[0];
  const apiKey = decryptValue(provider.image_api_key_encrypted);

  switch (provider.image_provider_type) {
    case 'dalle':
      return generateDalleImage(apiKey, provider.image_model || 'dall-e-3', request);
    case 'stability':
      return generateStabilityImage(apiKey, provider.image_model || 'stable-diffusion-xl', request);
    case 'leonardo':
      return generateLeonardoImage(apiKey, provider.image_model || '', request);
    default:
      throw new Error(`Unsupported image provider: ${provider.image_provider_type}`);
  }
}

// DALL-E 3 via OpenAI SDK
async function generateDalleImage(
  apiKey: string, 
  model: string, 
  req: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: req.prompt,
      n: 1,
      size: req.size || '1024x1024',
      quality: req.quality || 'standard',
      style: req.style || 'vivid',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `DALL-E API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    url: data.data[0].url,
    revisedPrompt: data.data[0].revised_prompt,
    provider: 'dalle',
    model,
  };
}

// Stable Diffusion via Stability AI REST API
async function generateStabilityImage(
  apiKey: string,
  model: string,
  req: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const formData = new FormData();
  formData.append('prompt', req.prompt);
  if (req.negativePrompt) formData.append('negative_prompt', req.negativePrompt);
  formData.append('output_format', 'png');

  const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Stability API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    url: data.image, // base64 atau URL
    provider: 'stability',
    model,
  };
}

// Leonardo AI
async function generateLeonardoImage(
  apiKey: string,
  model: string,
  req: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  // 1. Generate
  const genRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: req.prompt,
      modelId: model,
      width: parseInt(req.size?.split('x')[0] || '1024'),
      height: parseInt(req.size?.split('x')[1] || '1024'),
      num_images: 1,
    }),
  });

  if (!genRes.ok) {
    const err = await genRes.json().catch(() => ({}));
    throw new Error(err.error || `Leonardo API error: ${genRes.status}`);
  }

  const { sdGenerationJob } = await genRes.json();
  const generationId = sdGenerationJob.generationId;

  // 2. Polling sampai selesai (max 30 detik)
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const pollData = await pollRes.json();
    if (pollData.generations_by_pk?.generated_images?.length > 0) {
      return {
        url: pollData.generations_by_pk.generated_images[0].url,
        provider: 'leonardo',
        model,
      };
    }
  }

  throw new Error('Leonardo generation timed out after 30 seconds');
}
```

---

## 🖥️ UI CHANGES

### Perubahan di `PostScheduler.tsx`

**Konsep:** Toggle sederhana di area media upload — tidak perlu modal baru, tidak menambah kompleksitas UI.

```tsx
// Di dalam PostScheduler.tsx, di area Media Uploader:

// State baru
const [renderMode, setRenderMode] = useState<'satori' | 'ai_image'>('satori');
const [aiImagePrompt, setAiImagePrompt] = useState('');
const [generatingImage, setGeneratingImage] = useState(false);

// Handler generate AI image
const handleGenerateAIImage = async () => {
  if (!aiImagePrompt.trim()) {
    return Swal.fire('Error', 'Masukkan prompt gambar', 'error');
  }
  setGeneratingImage(true);
  try {
    const res = await fetch('/api/media/ai-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_unit_id: formUnit,
        prompt: aiImagePrompt,
        size: '1024x1024',
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    selectFromGallery(data.url);
    Swal.fire({ toast: true, icon: 'success', title: 'Gambar AI berhasil dibuat', position: 'top-end', timer: 2000 });
  } catch (err: any) {
    Swal.fire('Error', err.message, 'error');
  } finally {
    setGeneratingImage(false);
  }
};
```

**Letak UI toggle di PostScheduler:**
```
┌────────────────────────────────────────┐
│  Media                                   │
│  ┌────────────────────────────────────┐  │
│  │  Render Mode:  ○ Satori  ● AI Image│  │
│  │  [Prompt: ___________________]     │  │
│  │  [Generate Gambar AI]              │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  (Drop zone / preview same as now) │  │
│  └────────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## 🔄 FLOW IMPLEMENTASI

### Flow 1: Generate Gambar AI (Manual Mode)

```
User klik "AI Canvas" atau "Generate AI Image"
  → Pilih Render Mode = "Fotorealistik"
  → Masukkan prompt ("Foto sinematik secangkir kopi di pagi hari dengan latte art...")
  → Klik "Generate"
  → POST /api/media/ai-image
    → Auth check ✅
    → Ownership check business_unit_id ✅
    → Ambil image provider config dari ai_providers
    → Decrypt image_api_key_encrypted
    → Panggil generateAIImage() dari image-factory.ts
    → Provider (DALL-E/Stability/Leonardo) return image URL
    → Download image buffer dari URL
    → Upload ke Supabase Storage (user.id/ai-images/timestamp.png)
    → Insert ke media_assets table
    → Return { url, id }
  → UI: gambar muncul di preview, siap digunakan untuk posting
```

### Flow 2: Generate Gambar AI (Auto-Pilot Mode)

```
User pilih Auto-Pilot mode
  → Isi ide konten ("Promo kopi diskon 50%")
  → Pilih Render Mode = "Fotorealistik"
  → AI generate caption + generate gambar dari prompt
  → Keduanya dijadwalkan otomatis
```

**Perbedaan:** Di auto-pilot, prompt gambar dihasilkan dari `content_idea` + template prompt. Tidak perlu user input prompt manual.

### Flow 3: Fallback ke Satori

```
Jika user belum konfigurasi image provider:
  → Render Mode otomatis lock ke "Satori"
  → Tampilkan hint: "Tambahkan Image AI Provider di Settings untuk generate gambar fotorealistik"
  → Tidak mengganggu flow existing
```

---

## 📁 STRUKTUR FILE

```
File yang DIBUAT:
  src/lib/ai/image-factory.ts              ← Provider image AI factory (200 baris)
  src/app/api/media/ai-image/route.ts       ← Endpoint generate gambar (100 baris)
  src/app/api/providers/image/route.ts      ← Endpoint config image provider (60 baris)
  supabase/migrations/00000000000019_image_ai_provider.sql  ← Migration

File yang DIEDIT:
  src/components/planner/PostScheduler.tsx  ← Tambah toggle render mode + prompt input
  src/components/planner/AICanvasModal.tsx  ← (opsional) Tambah tab "AI Image"
  src/app/api/posts/autopilot/route.ts      ← Support auto-generate gambar di autopilot
  src/app/api/posts/ab-test/route.ts        ← Support di A/B test juga
  src/types/index.ts                        ← Tambah type ImageProviderConfig

File TIDAK DISENTUH:
  src/lib/crypto/server.ts                  ← encryptValue/decryptValue sudah bekerja
  src/lib/supabase/server.ts                ← Tidak ada perubahan
  src/lib/ai/factory.ts                     ← Text AI factory tidak disentuh
  src/lib/ai/providers/base.ts              ← OpenAI client tidak disentuh
  src/app/api/ai/*                          ← Tidak ada perubahan
  Semua migration sebelumnya                ← Tidak ada perubahan
```

---

## 🔐 KEAMANAN

| Layer | Implementasi |
|-------|-------------|
| **Auth** | `supabase.auth.getUser()` di setiap endpoint |
| **Ownership** | Verifikasi `business_unit_id` milik user sebelum generate |
| **API Key** | Disimpan sebagai `image_api_key_encrypted BYTEA` via `encryptValue()` |
| **SSRF** | Provider URL tidak user-configurable (semua hardcoded: api.openai.com, api.stability.ai, cloud.leonardo.ai) |
| **Prompt Injection** | Prompt AI image tidak membahayakan server (hanya dikirim ke provider eksternal), tapi perlu pertimbangan content policy |
| **Storage** | Gambar hasil generate disimpan di folder `user.id/ai-images/` — terproteksi oleh RLS |

---

## 📊 ESTIMASI KOMPLEKSITAS

| Komponen | Tingkat Kesulitan | Keterangan |
|----------|-------------------|------------|
| Database migration | 🟢 Sederhana | 4 kolom baru di tabel existing |
| `image-factory.ts` | 🟡 Sedang | 3 provider integration, masing-masing ~50 baris |
| `/api/media/ai-image` | 🟢 Sederhana | Pola sama dengan `/api/media/canvas` |
| `/api/providers/image` | 🟢 Sederhana | Pola sama dengan `/api/providers/route.ts` |
| UI PostScheduler | 🟡 Sedang | Tambah toggle + prompt input + handler |
| Autopilot integration | 🟡 Sedang | Generate prompt dari content_idea |

**Total:** 1 migration, 3 file baru, 4 file edit. Bisa diimplementasikan dalam 1 sprint.

---

## 🚦 PRASYARAT

Sebelum implementasi, pastikan:

1. [ ] **Bug regression critical sudah difix** (C1, C2, H2, H3, H5, H7, H8 dari laporan bug regression)
2. [ ] User punya API key untuk minimal 1 provider (DALL-E direkomendasikan — paling sederhana)
3. [ ] Supabase Storage bucket `digimar-media` sudah berfungsi
4. [ ] `ENCRYPTION_KEY` di `.env.local` sudah diisi key sebenarnya (bukan placeholder)

---

## 🎯 IMPLEMENTATION ORDER

1. **Migration** — `00000000000019_image_ai_provider.sql`
2. **Settings API** — `/api/providers/image/route.ts` (GET + POST)
3. **Image Factory** — `src/lib/ai/image-factory.ts` (DALL-E dulu, Stability + Leonardo menyusul)
4. **Generate Endpoint** — `/api/media/ai-image/route.ts`
5. **UI Toggle** — Edit `PostScheduler.tsx` tambah render mode
6. **Autopilot Integration** — Edit `/api/posts/autopilot/route.ts`
7. **Testing** — Test setiap provider dengan API key valid

---

*Technical spec — siap implementasi. Semua integrasi mengikuti pola existing codebase.*
