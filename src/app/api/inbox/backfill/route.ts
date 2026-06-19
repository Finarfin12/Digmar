import { createServiceClient } from '@/lib/supabase/service'
import { decryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id } = body
    if (!account_id) {
      return NextResponse.json({ error: 'account_id wajib diisi' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: account } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', account_id)
      .single()
    if (!account) {
      return NextResponse.json({ error: 'Account tidak ditemukan' }, { status: 404 })
    }

    const userToken = decryptValue(account.access_token_encrypted)
    const igUserId = account.ig_user_id
    let totalSynced = 0
    const syncErrors: string[] = []

    // Coba langsung fetch conversations dengan user token
    const baseFields = 'id,participants,updated_time,unread_count,messages.limit(10){id,from,to,message,created_time,attachments}'
    let convData: { data?: unknown[]; error?: { message: string; code: number } } | null = null

    // Attempt 1: langsung pakai user token — Instagram API
    let res = await fetch(
      `https://graph.facebook.com/v25.0/${igUserId}/conversations?platform=instagram&fields=${encodeURIComponent(baseFields)}&access_token=${userToken}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
    )
    convData = await res.json()

    // Attempt 2: kalau gagal, coba lewat Page Messenger API
    // Pages Messaging API lebih mudah diakses (hanya butuh pages_messaging)
    if (convData?.error) {
      try {
        const pagesRes = await fetch(
          `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,instagram_business_account{id},access_token&access_token=${userToken}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
        )
        const pagesData = await pagesRes.json()
        if (!pagesData.error && pagesData.data?.length > 0) {
          const match = pagesData.data.find((p: { instagram_business_account?: { id: string } }) =>
            p.instagram_business_account?.id === igUserId
          ) || pagesData.data[0]

          const pageToken = match.access_token
          const pageId = match.id

          if (pageToken && pageId) {
            // Coba Instagram endpoint dengan Page Token
            res = await fetch(
              `https://graph.facebook.com/v25.0/${igUserId}/conversations?platform=instagram&fields=${encodeURIComponent(baseFields)}&access_token=${pageToken}`,
              { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
            )
            let pageConv = await res.json()
            if (!pageConv.error) {
              convData = pageConv
            } else {
              // Fallback: Messenger API (platform=messenger) — bisa baca IG DM juga
              res = await fetch(
                `https://graph.facebook.com/v25.0/${pageId}/conversations?platform=messenger&fields=${encodeURIComponent(baseFields)}&access_token=${pageToken}`,
                { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
              )
              const msgConv = await res.json()
              if (!msgConv.error) convData = msgConv
            }
          }
        }
      } catch { /* tetap pakai convData asli */ }
    }

    if (convData?.error) {
      return NextResponse.json({
        error: convData.error.message,
        code: convData.error.code,
        info: 'Coba tambah permission pages_messaging dan pages_show_list di Graph API Explorer, lalu generate ulang token.',
      }, { status: 400 })
    }

    const conversations = (convData?.data || []) as Array<{
      id: string
      participants?: { data: Array<{ id: string }> }
      updated_time?: string
      unread_count?: number
      messages?: { data: Array<{ id: string; from?: { id: string }; message?: string; created_time?: string; attachments?: unknown }> }
    }>

    for (const conv of conversations) {
      const participants = conv.participants?.data || []
      const customer = participants.find((p) => p.id !== igUserId)
      if (!customer) continue
      const customerId = customer.id

      // Fetch nama asli
      let customerName = `IG User ${customerId}`
      try {
        const uRes = await fetch(
          `https://graph.facebook.com/v25.0/${customerId}?fields=id,username,name&access_token=${userToken}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
        )
        const uData = await uRes.json()
        if (!uData.error) customerName = uData.name || uData.username || customerName
      } catch { /* fallback */ }

      const latestMsg = conv.messages?.data?.[0]
      const latestText = latestMsg?.message || '(Media)'
      const updatedAt = conv.updated_time || new Date().toISOString()

      // Cari/buat conversation di DB
      const { data: existing } = await supabase
        .from('social_conversations')
        .select('id')
        .eq('account_id', account_id)
        .eq('type', 'dm')
        .eq('customer_id', customerId)
        .single()

      let convId: string | undefined
      if (existing) {
        convId = existing.id
        await supabase.from('social_conversations').update({
          latest_message: latestText,
          latest_message_at: updatedAt,
          unread_count: conv.unread_count || 0,
        }).eq('id', convId)
      } else {
        const { data: nc } = await supabase.from('social_conversations').insert({
          business_unit_id: account.business_unit_id,
          account_id,
          platform: account.platform,
          type: 'dm',
          customer_id: customerId,
          customer_name: customerName,
          latest_message: latestText,
          latest_message_at: updatedAt,
          unread_count: conv.unread_count || 1,
        }).select('id').single()
        if (nc) convId = nc.id
      }

      if (!convId) continue

      // Sync messages (dedup by platform_message_id)
      for (const msg of conv.messages?.data || []) {
        const { data: existingMsg } = await supabase
          .from('social_messages')
          .select('id')
          .eq('conversation_id', convId)
          .eq('platform_message_id', msg.id)
          .maybeSingle()
        if (existingMsg) continue

        const senderType = msg.from?.id === igUserId ? 'brand' : 'customer'
        await supabase.from('social_messages').insert({
          conversation_id: convId,
          sender_type: senderType,
          content: msg.message || '(Media)',
          platform_message_id: msg.id || null,
          created_at: msg.created_time || new Date().toISOString(),
        })
        totalSynced++
      }
    }

    return NextResponse.json({
      success: true,
      conversations_synced: conversations.length,
      messages_synced: totalSynced,
      errors: syncErrors.length > 0 ? syncErrors : undefined,
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
