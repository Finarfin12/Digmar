import { createClient } from '@/lib/supabase/server'
import { encryptValue, decryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'
import { fetchInstagramProfile, fetchThreadsProfile } from '@/lib/social/analytics'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const unitId = request.nextUrl.searchParams.get('unit_id')
  
  let query = supabase
    .from('social_accounts')
    .select('*, business_units!inner(id, user_id, brand_name, use_serpapi)')
    .eq('business_units.user_id', user.id)
    .order('created_at', { ascending: false })

  if (unitId) {
    query = query.eq('business_unit_id', unitId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-sync profile data with API to ensure Accounts Dashboard is up-to-date
  const syncedData = await Promise.all(data.map(async (account) => {
    let currentAccount = { ...account }
    if (account.access_token_encrypted && (account.platform === 'meta_ig' || account.platform === 'threads')) {
      try {
        const decryptedToken = decryptValue(account.access_token_encrypted)
        const profile = account.platform === 'meta_ig' 
          ? await fetchInstagramProfile(account.ig_user_id, decryptedToken)
          : await fetchThreadsProfile(account.ig_user_id, decryptedToken)
        
        // Update DB only if there's a difference to avoid unnecessary writes
        if (profile.name !== account.account_name || profile.followers !== account.followers_count || profile.profile_pic !== account.avatar_url) {
          const { data: updatedDbAccount, error: updateError } = await supabase.from('social_accounts').update({
            account_name: profile.name,
            followers_count: profile.followers,
            avatar_url: profile.profile_pic
          }).eq('id', account.id).select().single()
          
          if (updatedDbAccount && !updateError) {
            currentAccount = { ...currentAccount, ...updatedDbAccount }
          }
        }
      } catch (err) {
        console.error(`Failed to sync account ${account.id}:`, err)
      }
    }
    return currentAccount
  }))

  const safeData = syncedData.map(account => {
    const { access_token_encrypted, ...safeAccount } = account
    return {
      ...safeAccount,
      has_token: !!access_token_encrypted 
    }
  })

  return NextResponse.json(safeData)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { business_unit_id, platform, ig_user_id, access_token, token_expiry, status, auto_reply_enabled } = body

    if (!business_unit_id || !platform || !ig_user_id || !access_token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: unitData, error: unitError } = await supabase
      .from('business_units')
      .select('id')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unitData) {
      return NextResponse.json({ error: 'Business unit not found or unauthorized' }, { status: 403 })
    }

    const encryptedToken = encryptValue(access_token)

    const { data, error } = await supabase
      .from('social_accounts')
      .insert([
        {
          business_unit_id,
          platform,
          ig_user_id,
          access_token_encrypted: encryptedToken,
          token_expiry: token_expiry || null,
          status: status || 'active',
          auto_reply_enabled: auto_reply_enabled || false,
        }
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { access_token_encrypted, ...safeData } = data
    return NextResponse.json({ ...safeData, has_token: true }, { status: 201 })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
