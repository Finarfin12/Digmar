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

    // Promise 1: NewsData.io
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
          .then(res => res.json())
          .then(data => {
            if (data && data.items) {
              return data.items.map((item: any) => `[YouTube Trending] ${item.snippet.title} (Channel: ${item.snippet.channelTitle})`);
            }
            return [];
          })
      );
    }

    // Promise 4: Reddit (r/indonesia) - (Akan diblokir Kominfo jika run di lokal tanpa VPN)
    if (source === 'mixed' || source === 'reddit') {
      fetchPromises.push(
        fetch('https://www.reddit.com/r/indonesia/hot.json?limit=5', { 
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
    }

    const resultsList = await Promise.allSettled(fetchPromises);
    resultsList.forEach(result => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        trendingNews = [...trendingNews, ...result.value];
      } else if (result.status === 'rejected') {
        console.error("Gagal menarik salah satu sumber berita:", result.reason);
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
    const { client, config } = await getAIProvider(user.id, preferred_provider)
    
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

Tugas Anda:
Berdasarkan hari ini, konteks musiman, dan topik berita yang sedang tren di atas, buatlah 3 Rekomendasi Ide Konten Media Sosial yang sangat relevan dan menarik untuk bisnis ini (gabungkan bisnis (soft-selling) dengan tren yang ada jika masuk akal, jika tidak masuk akal jangan paksakan, gunakan saja konteks musim/tanggal).

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
    )

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.error("Gagal parse JSON dari AI:", response.content);
      return NextResponse.json({ error: "Format AI tidak valid. Coba lagi." }, { status: 500 })
    }

    return NextResponse.json({
      berita_sumber: trendingNews,
      ...parsedData
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
