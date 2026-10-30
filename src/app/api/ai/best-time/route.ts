import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { format, addDays } from 'date-fns'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate Limiting: 10 request per menit
  const rateLimitKey = getRateLimitIdentifier(request, user.id)
  if (!await checkRateLimit(rateLimitKey, 'ai-best-time', 20, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { business_unit_id } = await request.json()

    if (!business_unit_id) {
      return NextResponse.json({ error: 'Business unit ID is required' }, { status: 400 })
    }

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('brand_name, business_category')
      .eq('id', business_unit_id)
      .eq('user_id', user.id) // H8 Fix: Verifikasi kepemilikan
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    const { client } = await getAIProvider(user.id)
    
    const now = new Date()
    const tomorrow = addDays(now, 1)
    
    const systemPrompt = "Anda adalah Social Media Strategist jenius yang menguasai algoritma waktu tayang (best time to post) untuk berbagai industri."
    
    const userPrompt = `
Klien: ${unit.brand_name}
Industri/Kategori: ${unit.business_category || 'General/Umum'}

Waktu saat ini (Server Time): ${format(now, "yyyy-MM-dd'T'HH:mm:ss")}
Hari ini: ${format(now, 'EEEE, yyyy-MM-dd')}
Besok: ${format(tomorrow, 'EEEE, yyyy-MM-dd')}

TUGAS:
Tentukan SATU waktu tayang (Best Time to Post) paling optimal untuk klien ini berdasarkan industri mereka. 
Pilih waktu yang belum lewat untuk hari ini ATAU besok.
Pertimbangkan perilaku psikologis audiens di industri tersebut (misal: F&B bagus sebelum jam makan siang, B2B bagus di pagi hari kerja).

KEMBALIKAN HANYA DALAM FORMAT JSON BERIKUT (tanpa markdown atau teks tambahan apapun):
{
  "scheduled_at": "YYYY-MM-DDTHH:mm",
  "reasoning": "Alasan singkat (maksimal 2 kalimat) mengapa waktu ini terbaik untuk industri mereka."
}
`;

    const response = await client.generateText(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 500
    })

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch {
      return handleApiError(new Error("Format AI tidak valid. Coba lagi."))
    }

    // Ensure scheduled_at is a valid date
    if (!parsedData.scheduled_at || isNaN(new Date(parsedData.scheduled_at).getTime())) {
       // Fallback logic
       parsedData.scheduled_at = format(addDays(now, 1), "yyyy-MM-dd'T'12:00")
    }

    return NextResponse.json(parsedData)
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
