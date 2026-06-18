import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { XMLParser } from 'fast-xml-parser'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

import { logger } from '@/lib/utils/logger'

type YouTubeVideoItem = {
  snippet: {
    title: string
    channelTitle: string
  }
}

type RedditChild = {
  data: {
    stickied?: boolean
    subreddit: string
    title: string
    score: number
    num_comments: number
    selftext?: string
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate Limiting: 5 request per menit
  const rateLimitKey = getRateLimitIdentifier(request, user.id)
  if (!checkRateLimit(rateLimitKey, 'ai-trends', 10, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { business_unit_id, preferred_provider, source = 'mixed' } = await request.json()

    if (!business_unit_id) {
      return NextResponse.json({ error: 'Missing business_unit_id' }, { status: 400 })
    }

    // 1. Get Unit Info
    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('brand_name, business_category, ai_system_prompt')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    // 2. Fetch Real-time News (NewsData.io AND Google News RSS)
    let trendingNews: string[] = [];
    const apiKey = process.env.NEWSDATA_API_KEY;

    const fetchPromises = [];

    // Promise 1: Google News
    if (source === 'mixed' || source === 'google_news') {
      fetchPromises.push(
        fetch('https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id', { next: { revalidate: 3600 } })
          .then(res => res.text())
          .then(xmlData => {
            const parser = new XMLParser();
            const jsonObj = parser.parse(xmlData);
            const items = jsonObj?.rss?.channel?.item || [];
            const topItems = Array.isArray(items) ? items.slice(0, 5) : [items];
            return topItems.map((item: { title: string }) => item.title);
          })
      );
    }

    // Promise 2: NewsData.io
    if (apiKey && (source === 'mixed' || source === 'newsdata')) {
      fetchPromises.push(
        fetch(`https://newsdata.io/api/1/news?apikey=${apiKey}&country=id&language=id`, { next: { revalidate: 3600 } })
          .then(res => res.json())
          .then(data => {
            if (data && data.results && data.results.length > 0) {
              return data.results.slice(0, 5).map((item: { title: string }) => item.title);
            }
            return [];
          })
      );
    }

    // Promise 3: YouTube Data API (mostPopular) - Hemat Kuota (1 Unit)
    const ytApiKey = process.env.YOUTUBE_API_KEY;
    if (ytApiKey && (source === 'mixed' || source === 'youtube')) {
      fetchPromises.push(
        fetch(`https://youtube.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=ID&maxResults=5&key=${ytApiKey}`, { next: { revalidate: 3600 } })
          .then(res => res.json() as Promise<{ items?: YouTubeVideoItem[] }>)
          .then(data => {
            if (data && data.items) {
              return data.items.map(item => `[YouTube Trending] ${item.snippet.title} (Channel: ${item.snippet.channelTitle})`);
            }
            return [];
          })
      );
    }

    // Promise 4: Reddit Hot Posts (r/indonesia) - Sentimen & Diskusi Publik
    // Catatan: Reddit diblokir Kominfo di Indonesia, hanya bisa diakses via VPN atau dari server luar (Vercel)
    if (source === 'mixed' || source === 'reddit') {
      fetchPromises.push(
        fetch('https://www.reddit.com/r/indonesia/hot.json?limit=7', { 
          headers: { 'User-Agent': 'DigiMarBot/1.0 (by /u/digimarautomation)' }
        })
          .then(res => res.json() as Promise<{ data?: { children?: RedditChild[] } }>)
          .then(data => {
            if (data && data.data && data.data.children) {
              return data.data.children
                .filter(item => !item.data.stickied) // Skip pinned
                .slice(0, 5)
                .map(item => {
                  const d = item.data
                  const snippet = d.selftext ? d.selftext.substring(0, 120).replace(/\n/g, ' ') : ''
                  return `[Reddit r/${d.subreddit}] ${d.title} (⬆${d.score} | 💬${d.num_comments} komentar)${snippet ? ` — "${snippet}..."` : ''}`
                })
            }
            return []
          })
      )

      // Promise 4b: Reddit Search berdasarkan kategori bisnis
      if (unit.business_category) {
        fetchPromises.push(
          fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(unit.business_category)}&sort=relevance&t=week&limit=5`, {
            headers: { 'User-Agent': 'DigiMarBot/1.0 (by /u/digimarautomation)' }
          })
            .then(res => res.json() as Promise<{ data?: { children?: RedditChild[] } }>)
            .then(data => {
              if (data && data.data && data.data.children) {
                return data.data.children.slice(0, 3).map(item => {
                  const d = item.data
                  return `[Reddit Sentimen "${unit.business_category}"] ${d.title} (⬆${d.score} di r/${d.subreddit})`
                })
              }
              return []
            })
        )
      }
    }

    const resultsList = await Promise.allSettled(fetchPromises);
    resultsList.forEach(result => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        trendingNews = [...trendingNews, ...result.value];
      } else if (result.status === 'rejected') {
        logger.error("Gagal menarik salah satu sumber berita:", result.reason);
      }
    });

    if (trendingNews.length === 0) {
      trendingNews = ["Gagal memuat berita terkini."];
    }

    // 3. Format Date
    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentMonth = today.getMonth() + 1; // 1-12
    let seasonContext = "Bulan biasa";
    if (currentMonth >= 11 || currentMonth <= 1) seasonContext = "Musim Liburan / Akhir Tahun / Awal Tahun Baru";
    else if (currentMonth >= 3 && currentMonth <= 4) seasonContext = "Periode Ramadhan / Idul Fitri (Tergantung kalender Hijriah)";
    else if (currentMonth >= 6 && currentMonth <= 7) seasonContext = "Musim Libur Sekolah / Musim Panas (Kemarau)";
    else if (currentMonth === 8) seasonContext = "Bulan Kemerdekaan RI (Agustus)";

    // 4. Generate with AI
    const { client } = await getAIProvider(user.id, preferred_provider)
    
    const aiPrompt = `
Konteks Bisnis:
Nama: ${unit.brand_name}
Kategori: ${unit.business_category}
Aturan Promosi Khusus: ${unit.ai_system_prompt || 'Tidak ada spesifikasi khusus.'}

Data Hari Ini:
Tanggal: ${dateStr}
Konteks Musiman/Bulan: ${seasonContext}
Topik Berita Tren (Indonesia): 
${trendingNews.map(n => `- ${n}`).join('\n')}

Perhatikan data dari Reddit (ditandai [Reddit ...]) — ini berisi opini mentah netizen. Gunakan sentimen dari sana (keluhan, pujian, atau diskusi) untuk ide konten yang relatable.

Tugas Anda:
Berdasarkan hari ini, konteks musiman, dan topik berita yang sedang tren di atas, buatlah 3 Rekomendasi Ide Konten Media Sosial yang sangat relevan dan menarik untuk bisnis ini.
SANGAT PENTING: Gunakan GAYA BAHASA YANG KEKINIAN, KASUAL, dan TIDAK KAKU. Jangan gunakan bahasa korporat atau robotik. Buatlah ide konten yang terasa segar, trendi, dan cocok untuk Gen-Z / Millennial di media sosial (Instagram/TikTok). Gabungkan soft-selling dengan tren secara natural.

KEMBALIKAN HANYA DALAM FORMAT JSON BERIKUT (tanpa markdown blok teks apapun):
{
  "topik_utama_hari_ini": "Satu kalimat ringkasan tentang apa yang sedang tren",
  "ide_konten": [
    {
      "judul": "Judul Ide Konten",
      "format": "Reels / Carousel / Single Image",
      "deskripsi": "Penjelasan detail mengapa konten ini cocok di-post hari ini beserta bayangan visualnya."
    }
  ]
}
`;

    const response = await client.generateText(
      "Anda adalah analis tren sosial media jenius (Social Media Strategist).",
      aiPrompt,
      { temperature: 0.8, maxTokens: 1500 }
    ).catch(err => {
      logger.error('Trend AI provider failed:', err)
      throw new Error('AI provider gagal merespons. Periksa API key, model, dan provider aktif di Settings.')
    })

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch {
      return handleApiError(new Error("Format AI tidak valid. Coba lagi."))
    }

    return NextResponse.json({
      berita_sumber: trendingNews,
      ...parsedData
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
