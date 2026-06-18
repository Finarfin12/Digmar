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
  if (!checkRateLimit(rateLimitKey, 'ai-trends', 10, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { business_unit_id, preferred_provider, source = 'mixed' } = await request.json()

    if (!business_unit_id) {
      return NextResponse.json({ error: 'Missing business_unit_id' }, { status: 400 })
    }

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('brand_name, business_category, ai_system_prompt')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    const sources: SourceItem[] = []
    const trendingNews: string[] = []
    const apiKey = process.env.NEWSDATA_API_KEY
    const fetchPromises: Promise<void>[] = []

    // Google News RSS
    if (source === 'mixed' || source === 'google_news') {
      fetchPromises.push(
        fetch('https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id')
          .then(res => res.text())
          .then(xmlData => {
            const parser = new XMLParser()
            const jsonObj = parser.parse(xmlData)
            const items = jsonObj?.rss?.channel?.item || []
            const topItems = (Array.isArray(items) ? items.slice(0, 5) : [items]) as Array<{ title: string; link: string; pubDate: string }>
            for (const item of topItems) {
              sources.push({ title: item.title, platform: 'google_news', icon: 'google_news', date: item.pubDate || new Date().toISOString(), link: item.link || '' })
            }
            trendingNews.push(...topItems.map((i) => i.title))
          })
          .catch(() => {})
      )
    }

    // NewsData.io
    if (apiKey && (source === 'mixed' || source === 'newsdata')) {
      fetchPromises.push(
        fetch(`https://newsdata.io/api/1/news?apikey=${apiKey}&country=id&language=id`)
          .then(res => res.json())
          .then(data => {
            if (data?.results) {
              for (const item of data.results.slice(0, 5)) {
                sources.push({ title: item.title, platform: 'newsdata', icon: 'newsdata', date: item.pubDate || item.publishedAt || new Date().toISOString(), link: item.link || '' })
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
        fetch(`https://youtube.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=ID&maxResults=5&key=${ytApiKey}`)
          .then(res => res.json() as Promise<{ items?: YouTubeVideoItem[] }>)
          .then(data => {
            if (data?.items) {
              for (const item of data.items) {
                sources.push({ title: `[${item.snippet.channelTitle}] ${item.snippet.title}`, platform: 'youtube', icon: 'youtube', date: item.snippet.publishedAt, link: `https://youtube.com/watch?v=${item.id.videoId}` })
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
        fetch('https://www.reddit.com/r/indonesia/hot.json?limit=7', { headers: { 'User-Agent': 'DigiMarBot/1.0' } })
          .then(res => res.json() as Promise<{ data?: { children?: RedditChild[] } }>)
          .then(data => {
            if (data?.data?.children) {
              for (const item of data.data.children.filter(c => !c.data.stickied).slice(0, 5)) {
                const d = item.data
                sources.push({ title: d.title, platform: 'reddit', icon: 'reddit', score: d.score, comments: d.num_comments, date: new Date(d.created_utc * 1000).toISOString(), link: `https://reddit.com${d.permalink}` })
              }
              trendingNews.push(...data.data.children.filter(c => !c.data.stickied).slice(0, 5).map(c => `[Reddit r/${c.data.subreddit}] ${c.data.title} (⬆${c.data.score})`))
            }
          })
          .catch(() => {})
      )

      if (unit.business_category) {
        fetchPromises.push(
          fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(unit.business_category)}&sort=relevance&t=week&limit=5`, { headers: { 'User-Agent': 'DigiMarBot/1.0' } })
            .then(res => res.json() as Promise<{ data?: { children?: RedditChild[] } }>)
            .then(data => {
              if (data?.data?.children) {
                for (const item of data.data.children.slice(0, 3)) {
                  const d = item.data
                  sources.push({ title: d.title, platform: 'reddit', icon: 'reddit_hot', score: d.score, comments: d.num_comments, date: new Date(d.created_utc * 1000).toISOString(), link: `https://reddit.com${d.permalink}` })
                }
              }
            })
            .catch(() => {})
        )
      }
    }

    await Promise.allSettled(fetchPromises)

    if (trendingNews.length === 0) trendingNews.push('Gagal memuat berita terkini.')

    const today = new Date()
    const dateStr = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const currentMonth = today.getMonth() + 1
    let seasonContext = 'Bulan biasa'
    if (currentMonth >= 11 || currentMonth <= 1) seasonContext = 'Musim Liburan / Akhir Tahun'
    else if (currentMonth >= 3 && currentMonth <= 4) seasonContext = 'Periode Ramadhan / Idul Fitri'
    else if (currentMonth >= 6 && currentMonth <= 7) seasonContext = 'Musim Libur Sekolah / Kemarau'
    else if (currentMonth === 8) seasonContext = 'Bulan Kemerdekaan RI'

    const { client } = await getAIProvider(user.id, preferred_provider).catch(err => { logger.error('Trend AI provider setup failed:', err); throw err })

    const aiPrompt = `
Konteks Bisnis:
Nama: ${unit.brand_name}
Kategori: ${unit.business_category}
Aturan Khusus: ${unit.ai_system_prompt || 'Tidak ada.'}

Tanggal: ${dateStr}
Konteks Musiman: ${seasonContext}
Topik Tren: 
${trendingNews.map(n => `- ${n}`).join('\n')}

Buat 3 Ide Konten relevan untuk bisnis ini. Gaya bahasa kekinian, kasual, Gen-Z / Millennial.

KEMBALIKAN HANYA JSON:
{
  "topik_utama_hari_ini": "ringkasan tren",
  "ide_konten": [
    { "judul": "...", "format": "Reels / Carousel / Single", "deskripsi": "..." }
  ]
}
`

    const response = await client.generateText('Anda adalah analis tren sosial media.', aiPrompt, { temperature: 0.8, maxTokens: 1500 })
      .catch(err => { logger.error('Trend AI provider failed:', err); throw new Error('AI provider gagal merespons.') })

    let parsedData
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch {
      return handleApiError(new Error('Format AI tidak valid.'))
    }

    return NextResponse.json({ ...parsedData, sources })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
