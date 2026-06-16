import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'

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
    
    const aiPrompt = `
Tugas: Buat riset hashtag dan keyword potensial untuk diposting di media sosial Instagram/TikTok.
Topik Niche / Kata Kunci Awal: "${topic}"

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

    return NextResponse.json(parsedData)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
