import { createClient } from '@/lib/supabase/server'
import { encryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const safeData = data.map(provider => {
    const { api_key_encrypted, ...safeProvider } = provider
    return {
      ...safeProvider,
      has_key: !!api_key_encrypted 
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
    const { provider_name, api_key, base_url, model, is_active, priority, config } = body

    if (!provider_name) {
      return NextResponse.json({ error: 'Provider name is required' }, { status: 400 })
    }

    let encryptedKey = null
    if (api_key) {
      encryptedKey = encryptValue(api_key)
    }

    const { data, error } = await supabase
      .from('ai_providers')
      .insert([
        {
          user_id: user.id,
          provider_name,
          api_key_encrypted: encryptedKey,
          base_url,
          model,
          is_active: is_active ?? true,
          priority: priority ?? 1,
          config: config ?? {}
        }
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { api_key_encrypted, ...safeData } = data
    return NextResponse.json({ ...safeData, has_key: !!api_key_encrypted }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
