import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { GRAPH_BASE_URL } from '@/lib/social/graph'

export async function POST(request: NextRequest) {
  const userClient = await createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { account_id } = body
    if (!account_id) {
      return NextResponse.json({ error: 'account_id wajib diisi' }, { status: 400 })
    }

    // Verifikasi kepemilikan akun sebelum memakai service client (bypass RLS)
    const { data: ownedAccount } = await userClient
      .from('social_accounts')
      .select('id, business_units!inner(user_id)')
      .eq('id', account_id)
      .eq('business_units.user_id', user.id)
      .maybeSingle()

    if (!ownedAccount) {
      return NextResponse.json({ error: 'Account tidak ditemukan' }, { status: 404 })
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
    let totalSynced = 0
    const syncErrors: string[] = []

    // Step 1: Dapatkan Page Token dari /me/accounts
    const pagesRes = await fetch(
      `${GRAPH_BASE_URL}/me/accounts?fields=id,name,access_token,instagram_business_account{id}&access_token=${userToken}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    )
    const pagesData = await pagesRes.json()

    if (pagesData.error || !pagesData.data?.length) {
      const msg = pagesData.error?.message || 'Tidak ada Facebook Page ditemukan'
      return NextResponse.json({ error: msg, code: pagesData.error?.code })
    }

    // Cari Page yang terhubung ke IG Business Account ini
    const match = pagesData.data.find((p: { id: string; instagram_business_account?: { id: string } }) =>
      p.instagram_business_account?.id === account.ig_user_id || p.id === account.ig_user_id
    )

    if (!match) {
      return NextResponse.json({ error: 'Facebook Page yang terhubung ke akun ini tidak ditemukan pada token' }, { status: 404 })
    }

    const pageToken = match.access_token
    const pageId = match.id

    if (!pageToken) {
      return NextResponse.json({ error: 'Page token tidak tersedia — pastikan token punya pages_show_list & pages_messaging' })
    }

    // Step 2: Fetch conversations lewat Page Messenger API
    // platform=messenger — tidak perlu Instagram Messages product, cukup pages_messaging
    const fields = 'id,participants,updated_time,unread_count,messages.limit(20){id,from,to,message,created_time,attachments}'
    const convRes = await fetch(
      `${GRAPH_BASE_URL}/${pageId}/conversations?platform=messenger&fields=${encodeURIComponent(fields)}&access_token=${pageToken}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) }
    )
    const convData = await convRes.json()

    if (convData.error) {
      return NextResponse.json({
        error: convData.error.message,
        code: convData.error.code,
        info: 'Coba generate ulang token dengan permission pages_messaging di Graph API Explorer.',
      })
    }

    const conversations = (convData?.data || []) as Array<{
      id: string
      participants?: { data: Array<{ id: string }> }
      updated_time?: string
      unread_count?: number
      messages?: { data: Array<{ id: string; from?: { id: string }; message?: string; created_time?: string }> }
    }>

    for (const conv of conversations) {
      const participants = conv.participants?.data || []
      const customer = participants.find((p) => p.id !== pageId)
      if (!customer) continue
      const customerId = customer.id

      // Fetch nama asli via Graph API (PSID → name)
      let customerName = `User ${customerId.substring(0, 8)}`
      try {
        const uRes = await fetch(
          `${GRAPH_BASE_URL}/${customerId}?fields=id,name&access_token=${pageToken}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
        )
        const uData = await uRes.json()
        if (!uData.error) customerName = uData.name || customerName
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

        const senderType = msg.from?.id === pageId ? 'brand' : 'customer'
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
