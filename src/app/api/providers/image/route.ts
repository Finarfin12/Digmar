import { createClient } from '@/lib/supabase/server'
import { encryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from('image_ai_providers')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        provider_type: null,
        model: null,
        has_key: false,
        config: null,
      })
    }

    const provider = data[0]
    const { api_key_encrypted, ...safe } = provider
    return NextResponse.json({
      ...safe,
      has_key: !!api_key_encrypted,
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { provider_type, api_key, model, config } = body

    if (!provider_type) {
      return NextResponse.json({ error: 'provider_type wajib diisi' }, { status: 400 })
    }

    if (!['dalle', 'stability', 'leonardo'].includes(provider_type)) {
      return NextResponse.json({ error: 'provider_type tidak valid. Pilihan: dalle, stability, leonardo' }, { status: 400 })
    }

    if (!api_key) {
      return NextResponse.json({ error: 'api_key wajib diisi' }, { status: 400 })
    }

    let encryptedKey: string;
    try {
      encryptedKey = encryptValue(api_key)
    } catch {
      return NextResponse.json({ error: 'Gagal mengenkripsi API key. Pastikan ENCRYPTION_KEY sudah dikonfigurasi.' }, { status: 500 })
    }

    const { data: existing } = await supabase
      .from('image_ai_providers')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    if (existing && existing.length > 0) {
      const { error: updateError } = await supabase
        .from('image_ai_providers')
        .update({
          provider_type,
          api_key_encrypted: encryptedKey,
          model: model || null,
          config: config || {},
          is_active: true,
        })
        .eq('id', existing[0].id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabase
        .from('image_ai_providers')
        .insert({
          user_id: user.id,
          provider_type,
          api_key_encrypted: encryptedKey,
          model: model || null,
          config: config || {},
        })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      provider_type,
      model: model || null,
      has_key: true,
      config: config || {},
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { error } = await supabase
      .from('image_ai_providers')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
