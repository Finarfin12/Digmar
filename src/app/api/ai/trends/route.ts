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
    let preferred_provider;
    try {
      const body = await request.json();
      preferred_provider = body.preferred_provider;
    } catch (e) {}

    const { client, config } = await getAIProvider(user.id, preferred_provider)
    
    const prompt = `Berikan analisis tren konten media sosial terkini yang sedang viral atau naik daun. Kembalikan HANYA dalam format JSON ketat (strict) tanpa markdown block, seperti ini:
{
  "topics": ["Trend 1", "Trend 2", "Trend 3"],
  "seasonal_idea": "Ide konten musiman yang sangat spesifik dan aplikatif berdasarkan bulan ini.",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}`;
    
    const response = await client.generateText("Kamu adalah analis trend sosial media top dunia.", prompt, {
      temperature: 0.8,
      maxTokens: 500
    })

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      return NextResponse.json({ error: "Gagal memproses respon AI. Pastikan AI menghasilkan JSON murni." }, { status: 500 })
    }

    return NextResponse.json(parsedData)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
