export function buildCaptionPrompt(context: string, tone: string) {
  return `Buatlah 3 pilihan caption Instagram untuk: ${context}.
Nada bahasa: ${tone}.

Kamu WAJIB mengembalikan hasil dalam format JSON persis seperti berikut tanpa ada teks tambahan di luar JSON:
{
  "pilihan_1": { "caption": "...", "hashtag": "#..." },
  "pilihan_2": { "caption": "...", "hashtag": "#..." },
  "pilihan_3": { "caption": "...", "hashtag": "#..." },
  "keyword_cloud": ["word1", "word2", "word3"],
  "cerita_musiman": "Saran cerita/angle..."
}`;
}

export function buildTrendPrompt(category: string, competitors: string[]) {
  return `Buatlah laporan tren mingguan untuk kategori bisnis: ${category}.
Kompetitor: ${competitors.join(', ') || 'Belum ada data'}.

Kamu WAJIB mengembalikan hasil dalam format JSON persis seperti berikut tanpa teks tambahan:
{
  "week_topics": ["topik 1", "topik 2"],
  "content_angles": ["angle 1", "angle 2"],
  "hashtag_keyword_map": { "tema1": ["#hash1"], "tema2": ["#hash2"] },
  "seasonal_ideas": "Ide musiman...",
  "post_ideas": [
    { "title": "...", "angle": "...", "format": "carousel/reels/single" }
  ]
}`;
}
