# Rencana Implementasi: Multi-Platform Publishing & Caption Override

## Latar Belakang

Saat ini `PostScheduler` hanya bisa memilih **satu akun** (`formAccount: string`) sebagai target publish. Akibatnya, untuk mengirim konten ke 3 platform sekaligus, pengguna harus membuat 3 jadwal berbeda. Ini tidak efisien.

Kita akan mengimplementasikan:
- **Opsi A**: Multi-select akun via checkbox per platform (UI overhaul bagian "Akun Tujuan")
- **Opsi C**: Per-platform caption override dengan accordion per platform
- **Bonus Fix**: Hashtag Instagram limit naik dari 5 menjadi 30

---

## User Review Required

> [!IMPORTANT]
> **Opsi C — Caption Per-Platform**
> Apakah caption override ini **wajib diisi**, atau sifatnya **opsional fallback**?
> - **Opsional (Recommended)**: Jika per-platform tidak diisi, sistem otomatis pakai "Caption Final" yang sudah ada sebagai default. Pengguna hanya mengisi jika ingin berbeda.
> - **Wajib**: Setiap platform yang dipilih harus diisi caption-nya sebelum bisa disimpan.

> [!NOTE]
> **Hashtag Instagram**
> Info terbaru: Instagram **tidak menghapus batas 30 hashtag** tapi secara algoritma merekomendasikan **3-5 hashtag** untuk jangkauan terbaik (per update 2024). Kita akan ubah batasan di generator menjadi **30 hashtag total** (5 per kategori → 10 per kategori) sekaligus menambahkan *counter* karakter di caption textarea agar pengguna tetap bisa kontrol manual.

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

### D. Fix Hashtag Instagram — Generator AI

#### [MODIFY] [hashtags/route.ts](file:///c:/antigravity/DigiMar%20automation/src/app/api/ai/hashtags/route.ts)

Ubah prompt AI:
```
// Sebelum
high: 5 hashtag, medium: 5 hashtag, niche: 5 hashtag = total 15

// Sesudah  
high: 10 hashtag, medium: 10 hashtag, niche: 10 hashtag = total 30
```

#### [MODIFY] [HashtagModal.tsx](file:///c:/antigravity/DigiMar%20automation/src/components/planner/HashtagModal.tsx)
Tampilkan semua 30 hashtag (sekarang hanya 5 yang muncul per kategori).

#### [MODIFY] PostScheduler.tsx — Caption Textarea
Tambahkan **character counter** di textarea Caption Final:
```
Caption Final                              [1.247 / 2.200 karakter]
```

---

## Urutan Eksekusi

```
1. DB Migration (tambah kolom platform_captions)
2. API update (posts route — terima platform_captions)  
3. Publisher update (baca platform_captions per akun)
4. PostScheduler — ubah state formAccount → selectedAccounts[]
5. PostScheduler — ganti <select> dengan Checkbox Grid
6. PostScheduler — tambah Per-Platform Caption Accordion
7. PostScheduler — tambah character counter
8. HashtagModal + hashtags/route.ts — naikkan limit hashtag ke 30
```

---

## Verification Plan

### Manual Verification
- Centang 3 akun berbeda → pastikan 1 entry di DB dengan `target_account_ids` berisi 3 UUID
- Isi override caption TikTok berbeda → publish → cek `platform_captions` di DB
- Test publisher: pastikan masing-masing akun menerima caption yang benar (bukan semua dapat caption yang sama)
- Buka Hashtag Engine → pastikan hasil 30 hashtag muncul semua di UI
