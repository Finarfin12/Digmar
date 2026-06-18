import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { XMLParser } from 'fast-xml-parser'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { logger } from '@/lib/utils/logger'

type YouTubeVideoItem = {
  id: { videoId: string }
  snippet: { title: string; channelTitle: string; publishedAt: string }
}

type RedditChild = {
  data: {
    stickied?: boolean
    subreddit: string
    title: string
    score: number
    num_comments: number
    selftext?: string
    permalink: string
    created_utc: number
    url: string
  }
}

interface SourceItem {
  title: string
  platform: string
  icon: string
  score?: number
  comments?: number
  date: string
  link: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimitKey = getRateLimitIdentifier(request, user.id)
  if (!checkRateLimit(rateLimitKey, 'ai-hashtags', 20, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { business_unit_id, topic, preferred_provider, source = 'mixed' } = await request.json()

    if (!business_unit_id || !topic) {
      return NextResponse.json({ error: 'Business unit ID and Topic are required' }, { status: 400 })
    }

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

    const sources: SourceItem[] = []
    const trendingNews: string[] = []
    const apiKey = process.env.NEWSDATA_API_KEY
    const fetchPromises: Promise<void>[] = []

    // Google News RSS
    if (source === 'mixed' || source === 'google_news') {
      fetchPromises.push(
        fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=id&gl=ID&ceid=ID:id`)
          .then(res => res.text())
          .then(xmlData => {
            const parser = new XMLParser()
            const jsonObj = parser.parse(xmlData)
            const items = jsonObj?.rss?.channel?.item || []
            const topItems = (Array.isArray(items) ? items.slice(0, 5) : [items]) as Array<{ title: string; link: string; pubDate: string }>
            for (const item of topItems) {
              sources.push({
                title: item.title,
                platform: 'google_news',
                icon: '📰',
                date: item.pubDate || new Date().toISOString(),
                link: item.link || '',
              })
            }
            trendingNews.push(...topItems.map((i: { title: string }) => i.title))
          })
          .catch(() => {})
      )
    }

    // NewsData.io
    if (apiKey && (source === 'mixed' || source === 'newsdata')) {
      fetchPromises.push(
        fetch(`https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(topic)}&language=id`)
          .then(res => res.json())
          .then(data => {
            if (data?.results) {
              for (const item of data.results.slice(0, 5)) {
                sources.push({
                  title: item.title,
                  platform: 'newsdata',
                  icon: '🌐',
                  date: item.pubDate || item.publishedAt || new Date().toISOString(),
                  link: item.link || '',
                })
              }
              trendingNews.push(...data.results.slice(0, 5).map((i: { title: string }) => i.title))
            }
          })
          .catch(() => {})
      )
    }

    // YouTube
    const ytApiKey = process.env.YOUTUBE_API_KEY
    if (ytApiKey && (source === 'mixed' || source === 'youtube')) {
      fetchPromises.push(
        fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(topic)}&type=video&maxResults=5&key=${ytApiKey}`)
          .then(res => res.json() as Promise<{ items?: YouTubeVideoItem[] }>)
          .then(data => {
            if (data?.items) {
              for (const item of data.items) {
                sources.push({
                  title: `[${item.snippet.channelTitle}] ${item.snippet.title}`,
                  platform: 'youtube',
                  icon: '▶️',
                  date: item.snippet.publishedAt,
                  link: `https://youtube.com/watch?v=${item.id.videoId}`,
                })
              }
              trendingNews.push(...data.items.map(i => `[YouTube] ${i.snippet.title} (Channel: ${i.snippet.channelTitle})`))
            }
          })
          .catch(() => {})
      )
    }

    // Reddit
    if (source === 'mixed' || source === 'reddit') {
      fetchPromises.push(
        fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=new&t=week&limit=7`, {
          headers: { 'User-Agent': 'DigiMarBot/1.0' }
        })
          .then(res => res.json() as Promise<{ data?: { children?: RedditChild[] } }>)
          .then(data => {
            if (data?.data?.children) {
              for (const item of data.data.children.filter(c => !c.data.stickied).slice(0, 5)) {
                const d = item.data
                sources.push({
                  title: d.title,
                  platform: 'reddit',
                  icon: '💬',
                  score: d.score,
                  comments: d.num_comments,
                  date: new Date(d.created_utc * 1000).toISOString(),
                  link: `https://reddit.com${d.permalink}`,
                })
              }
              trendingNews.push(...data.data.children.filter(c => !c.data.stickied).slice(0, 5).map(c => `[Reddit r/${c.data.subreddit}] ${c.data.title} (⬆${c.data.score})`))
            }
          })
          .catch(() => {})
      )
      // Reddit hot
      fetchPromises.push(
        fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=hot&t=month&limit=5`, {
          headers: { 'User-Agent': 'DigiMarBot/1.0' }
        })
          .then(res => res.json() as Promise<{ data?: { children?: RedditChild[] } }>)
          .then(data => {
            if (data?.data?.children) {
              for (const item of data.data.children.filter(c => c.data.score > 10).slice(0, 3)) {
                const d = item.data
                sources.push({
                  title: d.title,
                  platform: 'reddit',
                  icon: '🔥',
                  score: d.score,
                  comments: d.num_comments,
                  date: new Date(d.created_utc * 1000).toISOString(),
                  link: `https://reddit.com${d.permalink}`,
                })
              }
            }
          })
          .catch(() => {})
      )
    }

    await Promise.allSettled(fetchPromises)

    const newsContext = trendingNews.length > 0
      ? `Konteks Berita & Diskusi Terkait Topik "${topic}":\n${trendingNews.map(n => `- ${n}`).join('\n')}\n\nGunakan berita dan sentimen Reddit di atas untuk menciptakan hashtag yang sedang viral (newsjacking).`
      : 'Tidak ada berita atau diskusi live terbaru yang ditemukan untuk topik ini.'

    const aiPrompt = `
Tugas: Buat riset hashtag dan keyword potensial untuk diposting di media sosial Instagram/TikTok.
Topik Niche / Kata Kunci Awal: "${topic}"

${newsContext}

Tolong berikan daftar hashtag yang dibagi menjadi 3 kategori:
1. High Volume (Pencarian sangat tinggi, sangat populer)
2. Medium Volume (Pencarian menengah, persaingan lumayan)
3. Low Volume / Niche (Pencarian spesifik, sangat tertarget)

Juga berikan 5 ide keyword SEO/teks untuk diselipkan di dalam caption agar postingan mudah ditemukan mesin pencari platform (Social SEO).

KEMBALIKAN HANYA DALAM FORMAT JSON BERIKUT (tanpa markdown blok teks apapun):
{
  "hashtags": {
    "high": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "medium": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "niche": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  },
  "instagram_safe": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "tiktok_trending": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "seo_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]
}
`

    const response = await client.generateText(
      "Anda adalah ahli Social Media SEO dan algoritma pencarian Instagram/TikTok.",
      aiPrompt,
      { temperature: 0.7, maxTokens: 1000 }
    ).catch(err => {
      logger.error('Hashtag AI provider failed:', err)
      throw new Error('AI provider gagal merespons. Periksa API key, model, dan provider aktif di Settings.')
    })

    let parsedData
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch {
      return handleApiError(new Error("Format AI tidak valid. Coba lagi."))
    }

    return NextResponse.json({
      ...parsedData,
      sources,
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
