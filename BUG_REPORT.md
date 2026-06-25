# Bug Report & Code Issues — DigiMar Automation

**Generated:** 2026-06-25  
**Reviewed by:** Hiraeth (AI Code Reviewer)  
**Severity Legend:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 Critical Issues

### C1. Null Pointer Exception di Analytics Route
**File:** `src/app/api/analytics/route.ts:99`  
**Severity:** 🔴 Critical  
**Impact:** Runtime crash saat GET analytics jika `access_token_encrypted` null/undefined

**Problem:**
```typescript
const accessToken = decryptValue(acc.access_token_encrypted); // Line 99
```

`decryptValue()` dipanggil tanpa null check. Jika akun baru ditambahkan tapi belum punya token (atau token expired dan dihapus), ini akan throw error yang tidak ter-handle.

**Fix:**
```typescript
if (!acc.access_token_encrypted) {
  console.warn(`Account ${acc.id} missing access token, skipping sync`);
  continue; // Skip account ini
}
const accessToken = decryptValue(acc.access_token_encrypted);
```

---

### C2. Race Condition di Auto-Sync Profile
**File:** `src/app/api/accounts/route.ts:34-58`  
**Severity:** 🔴 Critical  
**Impact:** Timeout dan blocking di GET endpoint jika user punya banyak akun

**Problem:**
Auto-sync di GET endpoint menggunakan `Promise.all()` untuk sync semua akun sekaligus:
```typescript
await Promise.all(accounts.map(async (acc) => { /* Meta API call */ }));
```

Jika user punya 10+ akun atau salah satu Meta API call timeout (30 detik), user akan nunggu lama banget. Ini blocking operation yang tidak seharusnya ada di GET request.

**Fix:**
1. Pindahkan auto-sync ke background job (cron atau queue)
2. Atau buat endpoint terpisah `POST /api/accounts/sync-all` yang dipanggil manual/scheduled
3. Atau buat sync jadi fire-and-forget dengan timeout 5 detik per akun:
```typescript
Promise.all(accounts.map(async (acc) => {
  return Promise.race([
    syncProfileFromMeta(acc),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
  ]).catch(err => console.warn(`Sync ${acc.id} failed:`, err));
}));
```

---

### C3. Configuration Endpoint Returns Encrypted Value to Frontend
**File:** `src/app/api/configurations/route.ts:26`  
**Severity:** 🔴 Critical (Security)  
**Impact:** Encrypted secrets exposed ke client-side, bisa didekripsi jika attacker dapat ENCRYPTION_KEY

**Problem:**
```typescript
return NextResponse.json(data ? { key, value: data.value_encrypted } : null)
```

Endpoint GET `/api/configurations?key=X` mengembalikan `value_encrypted` langsung ke frontend. Ini berbahaya karena:
1. Encrypted value tidak berguna di frontend (ga ada decrypt function)
2. Jika attacker dapat ENCRYPTION_KEY dari environment leak, semua secret terbuka

**Fix:**
Jangan pernah return encrypted value ke frontend. Kalau memang perlu baca config, dekripsi server-side dan mask sebagian:
```typescript
import { decryptValue } from '@/lib/crypto/server';

const decrypted = decryptValue(data.value_encrypted);
const masked = decrypted.slice(0, 4) + '****' + decrypted.slice(-4); // Show first & last 4 chars
return NextResponse.json({ key, value: masked, is_configured: true });
```

Atau lebih baik: jangan return value sama sekali, cukup return boolean `is_configured`.

---

## 🟠 High Priority Issues

### H1. AI Caption Route Missing Input Validation
**File:** `src/app/api/ai/caption/route.ts`  
**Severity:** 🟠 High  
**Impact:** AI token waste, invalid request ke AI provider

**Problem:**
Endpoint tidak validasi input sebelum kirim ke AI. Jika frontend kirim `caption_style: null` atau `business_unit_id: undefined`, AI akan terima prompt yang rusak.

**Fix:**
Tambahkan Zod schema validation:
```typescript
import { z } from 'zod';

const CaptionRequestSchema = z.object({
  business_unit_id: z.string().uuid(),
  caption_style: z.string().min(1),
  topic: z.string().optional(),
  additional_context: z.string().optional()
});

const body = await request.json();
const validated = CaptionRequestSchema.parse(body); // Throws if invalid
```

---

### H2. Competitor Tracking: Instagram Scraping Fragile
**File:** `src/app/api/competitors/route.ts:37-51`  
**Severity:** 🟠 High  
**Impact:** Scraping akan fail jika Instagram ubah HTML structure

**Problem:**
Scraping Instagram pakai regex di meta tag:
```typescript
const match = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
```

Instagram sering ubah HTML structure. Regex ini akan fail jika:
1. Instagram pindahkan data ke JSON (window._sharedData)
2. Meta tag dihapus/diganti
3. Rate limit/block karena scraping

**Fix:**
1. Tambahkan fallback ke JSON parsing:
```typescript
// Try JSON first
const jsonMatch = html.match(/window\._sharedData\s*=\s*(\{.+?\});/);
if (jsonMatch) {
  const data = JSON.parse(jsonMatch[1]);
  realFollowers = data.entry_data?.ProfilePage?.[0]?.graphql?.user?.edge_followed_by?.count;
}
// Fallback to meta tag if JSON parsing fails
if (!realFollowers) {
  const match = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  // ... existing logic
}
```

2. Tambahkan retry logic dan user-agent rotation
3. Atau pakai library seperti `instagram-scraper` yang lebih robust

---

### H3. AI Insights Schema Validation Too Loose
**File:** `src/app/api/reports/ai-insights/route.ts:10`  
**Severity:** 🟠 High  
**Impact:** AI akan terima data yang tidak terstruktur, hasil analisis jadi tidak konsisten

**Problem:**
```typescript
metrics_data: z.any()
```

`z.any()` terlalu permissive. Kalau frontend kirim `metrics_data: "hello"` atau `null`, AI prompt akan jadi rusak dan hasilnya tidak berguna.

**Fix:**
Buat schema yang ketat:
```typescript
const MetricsDataSchema = z.object({
  accounts: z.array(z.object({
    account_id: z.string().uuid(),
    account_name: z.string(),
    followers: z.number(),
    engagement_rate: z.number(),
    posts_count: z.number(),
    // ... metrics lainnya
  })),
  date_range: z.object({
    start: z.string(),
    end: z.string()
  })
});

const AiInsightsSchema = z.object({
  business_unit_id: z.string().uuid(),
  report_type: z.string(),
  metrics_data: MetricsDataSchema // Ganti z.any() dengan ini
});
```

---

### H4. OpenAI Client: JSON Mode Forced by Default
**File:** `src/lib/ai/providers/base.ts:45`  
**Severity:** 🟠 High  
**Impact:** AI akan fail jika diminta generate non-JSON content (prose, markdown, etc.)

**Problem:**
```typescript
response_format: options?.jsonMode === false ? undefined : { type: "json_object" }
```

JSON mode di-enable by default kecuali explicitly disabled. Ini akan fail untuk use case seperti:
- Generate caption yang panjang (prose)
- Generate blog post
- Brainstorming ideas

**Fix:**
Invert logic — JSON mode harus explicitly requested:
```typescript
response_format: options?.jsonMode === true ? { type: "json_object" } : undefined
```

Dan pastikan semua caller yang butuh JSON output pass `jsonMode: true`.

---

## 🟡 Medium Priority Issues

### M1. Autopilot Route: No Duplicate Post Check
**File:** `src/app/api/posts/autopilot/route.ts`  
**Severity:** 🟡 Medium  
**Impact:** Autopilot bisa generate post yang identik dengan post sebelumnya

**Problem:**
Autopilot generate content tanpa cek post history. Kalau AI generate topik yang sama 2x, user bisa dapat duplicate post.

**Fix:**
Sebelum insert post baru, fetch 10 post terakhir dan pass ke AI sebagai context:
```typescript
const { data: recentPosts } = await supabase
  .from('posts')
  .select('caption')
  .eq('account_id', accountId)
  .order('created_at', { ascending: false })
  .limit(10);

const recentCaptions = recentPosts?.map(p => p.caption).join('\n---\n') || '';

const aiPrompt = `Generate new content. AVOID duplicating these recent posts:
${recentCaptions}

Now generate a fresh, unique post about: ${topic}`;
```

---

### M2. Rate Limiting Not Implemented
**File:** `src/lib/utils/rate-limit.ts`  
**Severity:** 🟡 Medium  
**Impact:** Abuse dari single user bisa exhaust AI quota atau Meta API rate limit

**Problem:**
File `rate-limit.ts` exists tapi tidak dipakai di endpoint manapun. Endpoint seperti `/api/ai/caption` dan `/api/competitors` bisa di-spam.

**Fix:**
Implement rate limit middleware dan apply ke semua AI endpoints:
```typescript
// Di middleware.ts atau per-route
import { rateLimit } from '@/lib/utils/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const limited = await rateLimit(ip, 10, 60); // 10 req/minute
  if (limited) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  // ... rest of handler
}
```

---

### M3. Webhook Signature Verification Missing
**File:** `src/app/api/webhooks/meta/route.ts`  
**Severity:** 🟡 Medium (Security)  
**Impact:** Attacker bisa send fake webhook events

**Problem:**
Webhook endpoint tidak verify signature dari Meta. Attacker bisa POST fake events ke endpoint ini.

**Fix:**
Tambahkan signature verification:
```typescript
import crypto from 'crypto';

const signature = request.headers.get('x-hub-signature-256');
const body = await request.text();
const hash = crypto
  .createHmac('sha256', process.env.META_APP_SECRET!)
  .update(body)
  .digest('hex');

if (`sha256=${hash}` !== signature) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
}
```

---

### M4. SerpSpy: Unit Selection State Bug
**File:** `src/app/(dashboard)/analytics/SerpSpy.tsx:18`  
**Severity:** 🟡 Medium  
**Impact:** User bisa pilih unit yang tidak aktif SerpApi tapi state tidak update

**Problem:**
```typescript
const isEnabled = uniqueUnits.find(u => u.id === selectedUnit)?.use_serpapi;
```

`isEnabled` di-calculate setiap render tapi tidak reactive. Jika user ganti unit, button disabled state tidak update sampai re-render.

**Fix:**
Ganti logic button disabled:
```typescript
const selectedUnitData = uniqueUnits.find(u => u.id === selectedUnit);
const isEnabled = selectedUnitData?.use_serpapi ?? false;

<button disabled={loading || !isEnabled} ...>
```

Atau lebih baik: tambahkan `useEffect` untuk reset form saat unit ganti:
```typescript
useEffect(() => {
  const unit = uniqueUnits.find(u => u.id === selectedUnit);
  if (!unit?.use_serpapi) {
    setHandle(''); // Clear input if unit disabled
  }
}, [selectedUnit]);
```

---

## 🟢 Low Priority / Code Quality Issues

### L1. Inconsistent Error Handling
**Files:** Multiple  
**Severity:** 🟢 Low  
**Impact:** Debugging lebih susah karena error format tidak konsisten

**Problem:**
Beberapa endpoint return error langsung:
```typescript
return NextResponse.json({ error: 'Something' }, { status: 500 })
```

Beberapa pakai `handleApiError()`:
```typescript
return handleApiError(err)
```

**Fix:**
Standardize semua error handling pakai `handleApiError` untuk konsistensi logging dan response format.

---

### L2. TypeScript `any` Type Overuse
**Files:** Multiple  
**Severity:** 🟢 Low  
**Impact:** Loss of type safety, harder to catch bugs at compile time

**Examples:**
- `src/app/api/competitors/route.ts:73` — `let analysis;` (implicitly any)
- `src/app/(dashboard)/analytics/SerpSpy.tsx:15` — `const [result, setResult] = useState<any>(null);`

**Fix:**
Define proper types:
```typescript
interface CompetitorAnalysis {
  metrics: { followers: string | number; engagement_rate: string };
  top_posts: Array<{ type: string; caption: string; likes: number; comments: number }>;
}

const [result, setResult] = useState<CompetitorAnalysis | null>(null);
```

---

### L3. Magic Numbers in Code
**Files:** Multiple  
**Severity:** 🟢 Low  
**Impact:** Maintenance harder, unclear intent

**Examples:**
- `src/lib/ai/factory.ts:52` — `timeout: 30000` (repeated 5x)
- `src/app/api/competitors/route.ts:39` — `next: { revalidate: 3600 }`

**Fix:**
Extract to constants:
```typescript
const AI_REQUEST_TIMEOUT_MS = 30_000;
const INSTAGRAM_CACHE_SECONDS = 3600;

timeout: AI_REQUEST_TIMEOUT_MS,
next: { revalidate: INSTAGRAM_CACHE_SECONDS }
```

---

### L4. Missing JSDoc Comments
**Files:** Most utility functions  
**Severity:** 🟢 Low  
**Impact:** Harder for new developers to understand code

**Fix:**
Add JSDoc to all exported functions:
```typescript
/**
 * Decrypt an encrypted value using the app's encryption key.
 * @param encryptedValue - Base64 encoded encrypted string
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails or ENCRYPTION_KEY not set
 */
export function decryptValue(encryptedValue: string): string {
  // ...
}
```

---

## Summary & Recommendations

### Critical Path (Fix ASAP)
1. **C1** — Null check di analytics route sebelum decrypt
2. **C2** — Pindahkan auto-sync ke background job atau timeout
3. **C3** — Jangan return encrypted value ke frontend

### High Priority (This Sprint)
4. **H1** — Add Zod validation di AI caption route
5. **H2** — Improve Instagram scraping robustness
6. **H3** — Tighten metrics_data schema
7. **H4** — Fix JSON mode default di OpenAI client

### Backlog
- All Medium & Low priority issues
- Consider adding E2E tests untuk critical flows (publish post, AI generation)
- Add monitoring/alerting untuk API failures dan rate limits

---

**Next Steps:**
1. Review bug report ini dengan Ii
2. Prioritize fixes berdasarkan impact vs effort
3. Create GitHub issues atau Trello cards untuk tracking
4. Assign ke Antigravity untuk implementation

**Questions for Ii:**
- Mau aku bantu fix critical issues sekarang, atau cukup dokumentasi ini untuk Antigravity?
- Ada endpoint lain yang perlu di-review lebih dalam?
