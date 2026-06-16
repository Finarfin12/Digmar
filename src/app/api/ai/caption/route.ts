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
    const { business_unit_id, prompt_context, tone_voice, preferred_provider } = await request.json()

    if (!business_unit_id || !prompt_context) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('ai_system_prompt')
      .eq('id', business_unit_id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    const { client, config } = await getAIProvider(user.id, preferred_provider)
    
    const userPrompt = `
Konteks Postingan: ${prompt_context}
Gaya Bahasa (Tone): ${tone_voice || 'profesional'}

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
      maxTokens: config.config?.max_tokens || 1600
    })

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.error("Gagal parse JSON dari AI:", response.content);
      return NextResponse.json({ error: "Format AI tidak valid. Coba lagi." }, { status: 500 })
    }

    return NextResponse.json(parsedData)
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
