import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { z } from 'zod'

const CaptionPayloadSchema = z.object({
  business_unit_id: z.string().uuid(),
  prompt_context: z.string().min(5, "Prompt context terlalu pendek").max(1000),
  tone_voice: z.string().optional(),
  preferred_provider: z.string().optional()
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate Limiting (L3 Fix): 5 request per menit
  const rateLimitKey = getRateLimitIdentifier(request, user.id)
  if (!await checkRateLimit(rateLimitKey, 'ai-caption', 20, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const jsonBody = await request.json()
    const { business_unit_id, prompt_context, tone_voice, preferred_provider } = CaptionPayloadSchema.parse(jsonBody)

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('ai_system_prompt')
      .eq('id', business_unit_id)
      .eq('user_id', user.id) // H8 Fix: Verifikasi kepemilikan
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    const { client, config } = await getAIProvider(user.id, preferred_provider)
    
    const userPrompt = `
Konteks Postingan: ${prompt_context}
Gaya Bahasa (Tone): ${tone_voice || 'profesional'}

INSTRUKSI SANGAT PENTING:
Anda WAJIB menulis caption dengan SANGAT MENGHARGAI Gaya Bahasa (Tone) yang diminta.
- Jika tone "Kasual & Santai" / "kasual": Gunakan bahasa gaul yang wajar, kekinian, santai, seakan ngobrol dengan teman (misal pakai sapaan 'kamu', 'kalian', atau sapaan akrab). JANGAN kaku/formal/kaku-robotik.
- Jika tone "Humoris": Buatlah lucu, kocak, dan mengundang tawa.
- Jika tone "Profesional": Gunakan bahasa formal, rapi, dan elegan.
- Jika "Hard Selling": Fokus pada promo, FOMO, dan call to action yang kuat.
Sesuaikan kosakata, struktur kalimat, dan sapaan dengan SEMPURNA sesuai tone tersebut. JANGAN MENGGUNAKAN BAHASA GENERIK.

KEMBALIKAN HANYA dalam format JSON (tanpa awalan dan akhiran markdown apapun):
{
  "pilihan_1": { "caption": "...", "hashtag": "#tag1 #tag2" },
  "pilihan_2": { "caption": "...", "hashtag": "#tag1 #tag2" },
  "pilihan_3": { "caption": "...", "hashtag": "#tag1 #tag2" },
  "keyword_cloud": ["keyword1", "keyword2", "keyword3"],
  "cerita_musiman": "Saran angle storytelling singkat"
}
`;

    const response = await client.generateText(unit.ai_system_prompt, userPrompt, {
      temperature: config.config?.temperature || 0.85,
      maxTokens: config.config?.max_tokens || 1600,
      jsonMode: true
    })

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch {
      return handleApiError(new Error("Format AI tidak valid. Coba lagi."))
    }

    return NextResponse.json(parsedData)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: (err as any).errors[0].message }, { status: 400 })
    }
    return handleApiError(err)
  }
}
