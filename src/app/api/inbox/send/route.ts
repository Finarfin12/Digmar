import { createClient } from '@/lib/supabase/server'
import { decryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

interface MetaConversation {
  id: string;
  type: string;
  customer_id: string;
  account_id: string;
}

interface MetaAccount {
  access_token_encrypted: string;
}

async function sendMetaMessage(conversation: MetaConversation, account: MetaAccount, message: string): Promise<{ platform_message_id?: string }> {
  const token = decryptValue(account.access_token_encrypted)
  const version = process.env.META_API_VERSION || 'v25.0'

  if (conversation.type === 'dm') {
    const res = await fetch(`https://graph.facebook.com/${version}/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient: { id: conversation.customer_id },
        message: { text: message },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Meta DM API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    return { platform_message_id: data.message_id }
  } else if (conversation.type === 'comment') {
    const commentId = conversation.customer_id
    const replyParams = new URLSearchParams()
    replyParams.append('message', message)
    replyParams.append('access_token', token)

    const res = await fetch(`https://graph.facebook.com/${version}/${commentId}/replies`, {
      method: 'POST',
      body: replyParams,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Meta Comment API error ${res.status}: ${errText}`)
    }

    return {}
  }

  throw new Error('Unsupported conversation type')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { conversation_id, message, sender_type = 'brand' } = await request.json()

    if (!conversation_id || !message) {
      return NextResponse.json({ error: 'conversation_id dan message wajib diisi' }, { status: 400 })
    }

    const { data: convo, error: convoErr } = await supabase
      .from('social_conversations')
      .select('*, business_units!inner(user_id)')
      .eq('id', conversation_id)
      .eq('business_units.user_id', user.id)
      .single()

    if (convoErr || !convo) {
      return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 403 })
    }

    const { data: msgInsert, error: insertErr } = await supabase
      .from('social_messages')
      .insert({
        conversation_id,
        sender_type,
        content: message,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const { data: account } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', convo.account_id)
      .single()

    if (!account) {
      await supabase.from('social_messages').update({ status: 'failed', error_message: 'Account not found' }).eq('id', msgInsert.id)
      return NextResponse.json({ error: 'Social account not found' }, { status: 500 })
    }

    let platformMessageId: string | undefined
    let sendError: string | null = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await sendMetaMessage(convo, account, message)
        platformMessageId = result.platform_message_id
        sendError = null
        break
      } catch (err: unknown) {
        sendError = err instanceof Error ? err.message : String(err);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        }
      }
    }

    if (sendError) {
      await supabase.from('social_messages')
        .update({ status: 'failed', error_message: sendError })
        .eq('id', msgInsert.id)

      return NextResponse.json({ error: `Gagal mengirim: ${sendError}`, message_id: msgInsert.id }, { status: 500 })
    }

    await supabase.from('social_messages')
      .update({
        status: 'sent',
        platform_message_id: platformMessageId || null,
        sent_at: new Date().toISOString(),
      })
      .eq('id', msgInsert.id)

    await supabase.from('social_conversations')
      .update({ latest_message: message, latest_message_at: new Date().toISOString() })
      .eq('id', conversation_id)

    return NextResponse.json({
      success: true,
      message_id: msgInsert.id,
      platform_message_id: platformMessageId,
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
