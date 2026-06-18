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
  if (!checkRateLimit(rateLimitKey, 'ai-hashtags', 20, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { business_unit_id, topic, preferred_provider, source = 'mixed' } = await request.json()

    if (!business_unit_id || !topic) {
      return NextResponse.json({ error: 'Business unit ID and Topic are required' }, { status: 400 })
    }

    // M31: Verifikasi kepemilikan business_unit_id
    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('id')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found or unauthorized' }, { status: 403 })
    }

    const { client } = await getAIProvider(user.id, preferred_provider).catch(err => {
      logger.error('Hashtag AI provider setup failed:', err)
      throw err
    })
    
    // Fetch Real-time News based on topic
    let trendingNews: string[] = [];
    const apiKey = process.env.NEWSDATA_API_KEY;
    const fetchPromises = [];

    // Promise 1: Google News RSS for the topic
    if (source === 'mixed' || source === 'google_news') {
      fetchPromises.push(
        fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=id&gl=ID&ceid=ID:id`, { next: { revalidate: 3600 } })
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

    // Promise 2: NewsData.io for the topic
    if (apiKey && (source === 'mixed' || source === 'newsdata')) {
      fetchPromises.push(
        fetch(`https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(topic)}&language=id`, { next: { revalidate: 3600 } })
          .then(res => res.json())
          .then(data => {
            if (data && data.results && data.results.length > 0) {
              return data.results.slice(0, 5).map((item: { title: string }) => item.title);
            }
            return [];
          })
      );
    }

    // Promise 3: YouTube Data API (search.list) - 100 Unit Kuota
    const ytApiKey = process.env.YOUTUBE_API_KEY;
    if (ytApiKey && (source === 'mixed' || source === 'youtube')) {
      fetchPromises.push(
        fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(topic)}&type=video&maxResults=5&key=${ytApiKey}`, { next: { revalidate: 3600 } })
          .then(res => res.json() as Promise<{ items?: YouTubeVideoItem[] }>)
          .then(data => {
            if (data && data.items) {
              return data.items.map(item => `[YouTube Topik] ${item.snippet.title} (Channel: ${item.snippet.channelTitle})`);
            }
            return [];
          })
      );
    }

    // Promise 4: Reddit Search berdasarkan topik — Sentimen & Diskusi Publik
    // Catatan: Reddit diblokir Kominfo di Indonesia, hanya bisa diakses via VPN atau dari server luar (Vercel)
    if (source === 'mixed' || source === 'reddit') {
      // 4a: Search global berdasarkan topik (postingan terbaru)
      fetchPromises.push(
        fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=new&t=week&limit=7`, { 
          headers: { 'User-Agent': 'DigiMarBot/1.0 (by /u/digimarautomation)' }
        })
          .then(res => res.json() as Promise<{ data?: { children?: RedditChild[] } }>)
          .then(data => {
            if (data && data.data && data.data.children) {
              return data.data.children
                .filter(item => !item.data.stickied)
                .slice(0, 5)
                .map(item => {
                  const d = item.data
                  const snippet = d.selftext ? d.selftext.substring(0, 150).replace(/\n/g, ' ') : ''
                  return `[Reddit r/${d.subreddit}] ${d.title} (⬆${d.score} | 💬${d.num_comments} komentar)${snippet ? ` — "${snippet}..."` : ''}`
                })
            }
            return []
          })
      )

      // 4b: Search berdasarkan topik yang sedang hot (engagement tinggi)
      fetchPromises.push(
        fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=hot&t=month&limit=5`, {
          headers: { 'User-Agent': 'DigiMarBot/1.0 (by /u/digimarautomation)' }
        })
          .then(res => res.json() as Promise<{ data?: { children?: RedditChild[] } }>)
          .then(data => {
            if (data && data.data && data.data.children) {
              return data.data.children
                .filter(item => item.data.score > 10) // Hanya post yang punya engagement
                .slice(0, 3)
                .map(item => {
                  const d = item.data
                  return `[Reddit Trending "${topic}"] ${d.title} (⬆${d.score} di r/${d.subreddit})`
                })
            }
            return []
          })
      )
    }

    const resultsList = await Promise.allSettled(fetchPromises);
    resultsList.forEach(result => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        trendingNews = [...trendingNews, ...result.value];
      } else if (result.status === 'rejected') {
        logger.error("Gagal menarik sumber berita untuk hashtag:", result.reason);
      }
    });

    const newsContext = trendingNews.length > 0 
      ? `Konteks Berita & Diskusi Terkait Topik "${topic}":\n${trendingNews.map(n => `- ${n}`).join('\n')}\n\nGunakan berita dan sentimen Reddit di atas untuk menciptakan hashtag yang sedang viral (newsjacking). Perhatikan diskusi di Reddit (ditandai [Reddit ...]) — opini mentah netizen di sana bisa menjadi ide hashtag niche yang sangat tertarget.`
      : 'Tidak ada berita atau diskusi live terbaru yang ditemukan untuk topik ini.';

    const aiPrompt = `
Tugas: Buat riset hashtag dan keyword potensial untuk diposting di media sosial Instagram/TikTok.
Topik Niche / Kata Kunci Awal: "${topic}"

${newsContext}

Tolong berikan daftar hashtag yang dibagi menjadi 3 kategori:
1. High Volume (Pencarian sangat tinggi, sangat populer)
2. Medium Volume (Pencarian menengah, persaingan lumayan)
3. Low Volume / Niche (Pencarian spesifik, sangat tertarget)

Juga berikan 3 ide keyword SEO/teks untuk diselipkan di dalam caption agar postingan mudah ditemukan mesin pencari platform (Social SEO).

KEMBALIKAN HANYA DALAM FORMAT JSON BERIKUT (tanpa markdown blok teks apapun):
{
  "hashtags": {
    "high": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "medium": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "niche": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  },
  "seo_keywords": ["keyword panjang 1", "keyword spesifik 2", "ide pencarian 3"]
}
`;

    const response = await client.generateText(
      "Anda adalah ahli Social Media SEO dan algoritma pencarian Instagram/TikTok.",
      aiPrompt,
      { temperature: 0.7, maxTokens: 1000 }
    ).catch(err => {
      logger.error('Hashtag AI provider failed:', err)
      throw new Error('AI provider gagal merespons. Periksa API key, model, dan provider aktif di Settings.')
    })

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch {
      return handleApiError(new Error("Format AI tidak valid. Coba lagi."))
    }

    return NextResponse.json({
      ...parsedData,
      berita_sumber: trendingNews // Kirim juga sumber berita agar bisa ditampilkan di UI jika mau
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
