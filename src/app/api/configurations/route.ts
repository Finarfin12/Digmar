import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = request.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'key parameter required' }, { status: 400 })
  }

  try {
    const { data } = await supabase
      .from('configurations')
      .select('value_encrypted')
      .eq('user_id', user.id)
      .eq('key', key)
      .single()

    return NextResponse.json(data ? { key, is_configured: true } : null)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { key, value } = await request.json()
    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('configurations')
      .select('id')
      .eq('user_id', user.id)
      .eq('key', key)
      .single()

    if (existing) {
      await supabase.from('configurations').update({ value_encrypted: value }).eq('id', existing.id).eq('user_id', user.id)
    } else {
      await supabase.from('configurations').insert({ user_id: user.id, key, value_encrypted: value })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
