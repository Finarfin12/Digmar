# Rencana Implementasi: Multi-Platform Publishing & Caption Override

## Latar Belakang

Saat ini `PostScheduler` hanya bisa memilih **satu akun** (`formAccount: string`) sebagai target publish. Akibatnya, untuk mengirim konten ke 3 platform sekaligus, pengguna harus membuat 3 jadwal berbeda. Ini tidak efisien.

Kita akan mengimplementasikan:
- **Opsi A**: Multi-select akun via checkbox per platform (UI overhaul bagian "Akun Tujuan")
- **Opsi C**: Per-platform caption override dengan accordion per platform
- **Setting Preferensi**: Pengguna bisa memilih mode default (Opsi A atau A+C) di halaman Pengaturan
- **Bonus Fix**: Hashtag platform-aware — Instagram maksimal 5, TikTok bebas

---

## User Review Required

> [!IMPORTANT]
> **Opsi C — Caption Per-Platform**
> Apakah caption override ini **wajib diisi**, atau sifatnya **opsional fallback**?
> - **Opsional (Recommended)**: Jika per-platform tidak diisi, sistem otomatis pakai "Caption Final" yang sudah ada sebagai default. Pengguna hanya mengisi jika ingin berbeda.
> - **Wajib**: Setiap platform yang dipilih harus diisi caption-nya sebelum bisa disimpan.

> [!NOTE]
> **Hashtag Instagram**
> Instagram per update terbaru **membatasi maksimal 5 hashtag** untuk jangkauan optimal (algoritma 2024). Hashtag ke-6 dst tidak dihitung bahkan bisa mengurangi reach. Generator akan menghasilkan set terpisah per platform.

---

## Perubahan yang Direncanakan

---

### A. UI — PostScheduler (Bagian "Akun Tujuan")

#### [MODIFY] [PostScheduler.tsx](file:///c:/antigravity/DigiMar%20automation/src/components/planner/PostScheduler.tsx)

**Kondisi sekarang (baris 279–282):**
```tsx
// Single <select> — hanya 1 akun
<select value={formAccount} onChange={e => setFormAccount(e.target.value)}>
  {filteredAccounts.map(a => <option key={a.id} value={a.id}>{a.platform}</option>)}
</select>
```

**Kondisi setelah:**
```tsx
// State berubah: string → string[]
const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

// Ganti <select> dengan Checkbox Grid per Platform
```

**Visual baru (Opsi A):**
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

- Setiap baris menampilkan: **ikon platform** + **nama akun** (dari `ig_user_id` atau nama yang disimpan) + **platform badge**
- Checkbox yang dipilih akan **highlight** dengan warna platform masing-masing (IG = gradient pink-purple, TikTok = hitam, Facebook = biru, Threads = hitam)
- Jika akun platform tertentu belum terhubung, baris akan tampil **disabled** dengan label "Belum terhubung — Tambah di Pengaturan"

**Perubahan state:**
```typescript
// Sebelum
const [formAccount, setFormAccount] = useState<string>('');

// Sesudah
const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
// Auto-select akun pertama jika hanya ada satu
```

**Perubahan submit payload:**
```typescript
// Sebelum
target_account_ids: [formAccount]

// Sesudah
target_account_ids: selectedAccounts // langsung array
```

---

### B. UI — Per-Platform Caption Override (Opsi C)

#### [MODIFY] [PostScheduler.tsx](file:///c:/antigravity/DigiMar%20automation/src/components/planner/PostScheduler.tsx)

Di bawah "Caption Final" yang sudah ada, tambahkan **accordion** yang muncul hanya jika lebih dari 1 platform dipilih:

**Visual (Opsi C):**
```
┌──────────────────────────────────────────────┐
│ Caption Final (dipakai jika tidak di-override)│
│ [textarea utama - sudah ada]                 │
└──────────────────────────────────────────────┘

▼ Override Caption Per-Platform (opsional)
┌──────────────────────────────────────────────┐
│ 📸 Instagram                                 │
│ [textarea - max 2200 char] [counter: 0/2200] │
│ 💡 Tips: Tempel hashtag di komentar pertama  │
├──────────────────────────────────────────────┤
│ 🎵 TikTok                                    │
│ [textarea - max 150 char]  [counter: 0/150]  │
│ 💡 Tips: Caption singkat, hook di baris 1    │
├──────────────────────────────────────────────┤
│ 👥 Facebook                                  │
│ [textarea - max 63000 char]                  │
└──────────────────────────────────────────────┘
```

**State baru:**
```typescript
const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
// e.g., { 'uuid-ig-account': 'Caption khusus IG...', 'uuid-tiktok-account': 'Caption TikTok...' }
```

**Perubahan API payload:**
```typescript
// Kirim ke API dengan mapping akun → caption
platform_captions: platformCaptions
```

---

### C. Backend — API `/api/posts` & Tabel DB

#### [MODIFY] [post_queue tabel — Skema DB](file:///c:/antigravity/DigiMar%20automation/supabase/migrations/00000000000000_init.sql)

Tambahkan kolom baru:
```sql
platform_captions JSONB DEFAULT '{}'
-- Berisi: { "uuid-akun-id": "teks caption override" }
```

#### [NEW] `supabase/migrations/00000000000020_platform_captions.sql`
Migrasi untuk menambahkan kolom `platform_captions` ke tabel `post_queue`.

#### [MODIFY] `src/app/api/posts/route.ts` & `src/app/api/posts/[id]/route.ts`
Terima dan simpan `platform_captions` saat POST/PUT.

#### [MODIFY] `src/lib/social/publisher.ts`
Saat memproses antrean, gunakan caption yang tepat per akun:
```typescript
// Logic baru di publisher
const caption = job.platform_captions?.[account.id] || job.caption;
// → Cek override dulu, fallback ke caption utama
```

---

### D. Fix Hashtag — Platform-Aware (Instagram max 5)

#### [MODIFY] [hashtags/route.ts](file:///c:/antigravity/DigiMar%20automation/src/app/api/ai/hashtags/route.ts)

Instagram per update terbaru **membatasi maksimal 5 hashtag** untuk jangkauan optimal. TikTok dan platform lain tidak punya batasan ketat.

Ubah prompt AI menjadi **strategi berbeda per platform**:

```typescript
// Output JSON baru dari AI:
{
  "instagram": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],  // MAX 5
  "tiktok":    ["#tag1", "#tag2", "#tag3", ... "#tag15"],       // Bebas, rekomendasi 5-15
  "general":   ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]   // Fallback jika platform tidak spesifik
}
```

#### [MODIFY] [HashtagModal.tsx](file:///c:/antigravity/DigiMar%20automation/src/components/planner/HashtagModal.tsx)
Tampilkan hasil dalam **tab per platform** (Instagram | TikTok | Umum) agar pengguna tahu set mana yang harus dipakai untuk platform tertentu.

#### [MODIFY] PostScheduler.tsx — Caption Textarea dengan Hashtag Counter
Tambahkan **peringatan otomatis** jika caption untuk akun Instagram mengandung lebih dari 5 hashtag:
```
⚠️ Caption Instagram mengandung 8 hashtag. Instagram merekomendasikan maksimal 5.
```

---

### E. Settings — Preferensi Mode Publish

#### [MODIFY] Halaman Settings (tab baru atau section baru)

Tambahkan pilihan **"Mode Publish Default"** di halaman Pengaturan, sehingga setiap pengguna bisa mengatur preferensi workflow-nya sendiri:

```
┌─────────────────────────────────────────────────────┐
│ ⚙️  Mode Publish Konten                             │
│                                                     │
│ ● Mode Cepat (Opsi A)                               │
│   Pilih beberapa akun, 1 caption untuk semua.       │
│   Cocok untuk konten yang sama di semua platform.   │
│                                                     │
│ ○ Mode Lanjutan (Opsi A + C)                        │
│   Pilih beberapa akun + bisa atur caption berbeda   │
│   per platform. Cocok untuk pengguna yang ingin     │
│   optimasi konten per platform.                     │
└─────────────────────────────────────────────────────┘
```

- Default: **Mode Cepat (Opsi A)** agar tidak membingungkan pengguna baru
- Preferensi ini disimpan di tabel `configurations` (sudah ada) dengan `key = 'publish_mode'`, `value = 'simple' | 'advanced'`
- `PostScheduler` membaca preferensi ini saat pertama dibuka:
  - `simple`: hanya tampilkan checkbox multi-select, **tanpa** accordion override caption
  - `advanced`: tampilkan checkbox multi-select **+** accordion override caption per platform

#### [NEW] Tidak butuh migrasi DB baru
Menggunakan tabel `configurations` yang sudah ada:
```sql
-- Disimpan otomatis saat user memilih
INSERT INTO configurations (user_id, key, value_encrypted)
VALUES (auth.uid(), 'publish_mode', encrypt_value('simple'));
```

---

## Urutan Eksekusi

```
1. DB Migration (tambah kolom platform_captions ke post_queue)
2. API update (posts route — terima & simpan platform_captions)  
3. Publisher update (baca platform_captions per akun, fallback ke caption utama)
4. Settings — tambah preferensi Mode Publish (simple/advanced), simpan ke configurations
5. PostScheduler — baca preferensi, ubah state formAccount → selectedAccounts[]
6. PostScheduler — ganti <select> dengan Checkbox Grid per platform
7. PostScheduler — tambah accordion Per-Platform Caption (hanya jika mode = advanced)
8. PostScheduler — tambah character counter & peringatan hashtag Instagram
9. HashtagModal + hashtags/route.ts — hashtag platform-aware (IG max 5, TikTok bebas, tab per platform)
```

---

## Verification Plan

### Manual Verification
- Centang 3 akun berbeda → pastikan 1 entry di DB dengan `target_account_ids` berisi 3 UUID
- Ganti ke mode **Advanced** di Pengaturan → buka PostScheduler → accordion override caption muncul
- Isi override caption TikTok berbeda → publish → cek `platform_captions` di DB berisi mapping yang benar
- Test publisher: pastikan masing-masing akun menerima caption yang benar (bukan semua dapat caption yang sama)
- Ketik 6 hashtag di caption Instagram → pastikan peringatan ⚠️ muncul otomatis
- Buka Hashtag Engine → pastikan ada 3 tab (Instagram | TikTok | Umum) dengan set hashtag berbeda
