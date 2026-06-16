import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { topic, preferred_provider } = await request.json()

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    }

    const { client, config } = await getAIProvider(user.id, preferred_provider)
    
    // Fetch Real-time News based on topic
    let trendingNews: string[] = [];
    const apiKey = process.env.NEWSDATA_API_KEY;
    const fetchPromises = [];

    // Promise 1: Google News RSS for the topic
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

    // Promise 2: NewsData.io for the topic
    if (apiKey) {
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
    if (ytApiKey) {
      fetchPromises.push(
        fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(topic)}&type=video&maxResults=5&key=${ytApiKey}`, { next: { revalidate: 3600 } })
          .then(res => res.json())
          .then(data => {
            if (data && data.items) {
              return data.items.map((item: any) => `[YouTube Topik] ${item.snippet.title} (Channel: ${item.snippet.channelTitle})`);
            }
            return [];
          })
      );
    }

    // Promise 4: Reddit Search for the topic - (Akan diblokir Kominfo jika run di lokal)
    fetchPromises.push(
      fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=hot&limit=5`, { 
        headers: { 'User-Agent': 'DigiMarBot/1.0' },
        next: { revalidate: 3600 } 
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.data && data.data.children) {
            return data.data.children.map((item: any) => `[Opini Netizen] ${item.data.title}`);
          }
          return [];
        })
    );

    const resultsList = await Promise.allSettled(fetchPromises);
    resultsList.forEach(result => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        trendingNews = [...trendingNews, ...result.value];
      } else if (result.status === 'rejected') {
        console.error("Gagal menarik sumber berita untuk hashtag:", result.reason);
      }
    });

    const newsContext = trendingNews.length > 0 
      ? `Konteks Berita Hari Ini Terkait Topik:\n${trendingNews.map(n => `- ${n}`).join('\n')}\n\nGunakan berita-berita di atas untuk menciptakan hashtag dan keyword yang sedang viral (newsjacking).`
      : 'Tidak ada berita live terbaru yang ditemukan untuk topik ini.';

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
    )

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.error("Gagal parse JSON hashtag dari AI:", response.content);
      return NextResponse.json({ error: "Format AI tidak valid. Coba lagi." }, { status: 500 })
    }

    return NextResponse.json({
      ...parsedData,
      berita_sumber: trendingNews // Kirim juga sumber berita agar bisa ditampilkan di UI jika mau
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
