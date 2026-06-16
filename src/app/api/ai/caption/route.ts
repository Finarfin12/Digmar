import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { buildCaptionPrompt } from '@/lib/ai/prompts'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { business_unit_id, prompt_context, tone_voice, preferred_provider } = body

    if (!business_unit_id || !prompt_context || !tone_voice) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: unitData, error: unitError } = await supabase
      .from('business_units')
      .select('ai_system_prompt')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unitData) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    const { client, config } = await getAIProvider(user.id, preferred_provider)
    const userPrompt = buildCaptionPrompt(prompt_context, tone_voice)
    
    const response = await client.generateText(unitData.ai_system_prompt, userPrompt, {
      temperature: config.config?.temperature,
      maxTokens: config.config?.max_tokens
    })

    // Parse JSON safely
    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      // Fallback if parsing fails
      parsedData = { raw_output: response.content, error: "Failed to parse JSON" }
    }

    return NextResponse.json({
      ...parsedData,
      usage: response.usage,
      provider_used: config.provider_name,
      model_used: config.model
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
