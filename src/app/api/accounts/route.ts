import { createClient } from '@/lib/supabase/server'
import { encryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const unitId = request.nextUrl.searchParams.get('unit_id')
  
  let query = supabase
    .from('social_accounts')
    .select('*, business_units!inner(user_id)')
    .eq('business_units.user_id', user.id)
    .order('created_at', { ascending: false })

  if (unitId) {
    query = query.eq('business_unit_id', unitId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const safeData = data.map(account => {
    const { access_token_encrypted, business_units, ...safeAccount } = account
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
    const { business_unit_id, platform, ig_user_id, access_token, token_expiry, status } = body

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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
