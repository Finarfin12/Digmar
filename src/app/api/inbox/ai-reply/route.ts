import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate Limiting (L3 Fix): 10 request per menit
  const rateLimitKey = getRateLimitIdentifier(request, user.id)
  if (!await checkRateLimit(rateLimitKey, 'inbox-ai-reply', 20, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { conversation_id, custom_prompt } = await request.json()

    if (!conversation_id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
    }

    // 1. Fetch Conversation & Unit
    const { data: convo, error: convoError } = await supabase
      .from('social_conversations')
      .select('*, business_units!inner(user_id, ai_system_prompt, brand_name, custom_variables)')
      .eq('id', conversation_id)
      .eq('business_units.user_id', user.id) // C5 Fix: Verifikasi kepemilikan
      .single()

    if (convoError || !convo) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // 2. Fetch recent messages
    const { data: messages, error: msgError } = await supabase
      .from('social_messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20)

    if (msgError) throw msgError

    // 3. Format history for AI
    const historyText = messages.map(m => {
      const role = m.sender_type === 'customer' ? `Customer (${convo.customer_name})` : 'Anda (Brand)';
      return `${role}: ${m.content}`;
    }).join('\n');

    const { client, config } = await getAIProvider(user.id)
    
    const systemPrompt = `
Anda adalah Customer Service/Community Manager untuk brand: ${convo.business_units.brand_name}.
Panduan Sistem: ${convo.business_units.ai_system_prompt || 'Gunakan bahasa profesional namun ramah.'}

Konteks Percakapan:
Platform: ${convo.platform}
Tipe: ${convo.type} (DM / Komentar)

Riwayat Obrolan:
${historyText}
`;

    const userPrompt = custom_prompt 
      ? `Instruksi tambahan dari admin: ${custom_prompt}\n\nBuat balasan selanjutnya untuk customer tersebut.` 
      : `Buat balasan selanjutnya untuk customer tersebut berdasarkan konteks obrolan di atas. Jika mereka bertanya harga, arahkan untuk cek link bio atau jawab jika Anda tahu.`;

    const response = await client.generateText(systemPrompt, userPrompt, {
      temperature: config.config?.temperature || 0.7,
      maxTokens: 500
    })

    const replyText = response.content;

    await supabase.from('social_messages').insert({
      conversation_id,
      sender_type: 'ai_auto',
      content: replyText,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, reply: replyText })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
