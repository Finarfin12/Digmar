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
      .from('ai_providers')
      .select('image_provider_type, image_model, image_api_key_encrypted, image_config')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('image_provider_type', 'is', null)
      .order('priority', { ascending: true })
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        image_provider_type: null,
        image_model: null,
        has_image_key: false,
        image_config: null,
      })
    }

    const provider = data[0]
    return NextResponse.json({
      image_provider_type: provider.image_provider_type,
      image_model: provider.image_model,
      has_image_key: !!provider.image_api_key_encrypted,
      image_config: provider.image_config,
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
    const { image_provider_type, image_api_key, image_model, image_config } = body

    if (!image_provider_type) {
      return NextResponse.json({ error: 'image_provider_type wajib diisi' }, { status: 400 })
    }

    if (!['dalle', 'stability', 'leonardo'].includes(image_provider_type)) {
      return NextResponse.json({ error: 'image_provider_type tidak valid. Pilihan: dalle, stability, leonardo' }, { status: 400 })
    }

    if (!image_api_key) {
      return NextResponse.json({ error: 'image_api_key wajib diisi' }, { status: 400 })
    }

    let encryptedKey: string | null = null
    try {
      encryptedKey = encryptValue(image_api_key)
    } catch {
      return NextResponse.json({ error: 'Gagal mengenkripsi API key. Pastikan ENCRYPTION_KEY sudah dikonfigurasi.' }, { status: 500 })
    }

    const { data: existing, error: findError } = await supabase
      .from('ai_providers')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('image_provider_type', 'is', null)
      .order('priority', { ascending: true })
      .limit(1)

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }

    if (existing && existing.length > 0) {
      const { error: updateError } = await supabase
        .from('ai_providers')
        .update({
          image_provider_type,
          image_api_key_encrypted: encryptedKey,
          image_model: image_model || null,
          image_config: image_config || {},
        })
        .eq('id', existing[0].id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      const { data: primaryProvider, error: primaryError } = await supabase
        .from('ai_providers')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(1)

      if (primaryError) {
        return NextResponse.json({ error: primaryError.message }, { status: 500 })
      }

      if (primaryProvider && primaryProvider.length > 0) {
        const { error: updateError } = await supabase
          .from('ai_providers')
          .update({
            image_provider_type,
            image_api_key_encrypted: encryptedKey,
            image_model: image_model || null,
            image_config: image_config || {},
          })
          .eq('id', primaryProvider[0].id)

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
      } else {
        const { error: insertError } = await supabase
          .from('ai_providers')
          .insert({
            user_id: user.id,
            provider_name: 'groq',
            image_provider_type,
            image_api_key_encrypted: encryptedKey,
            image_model: image_model || null,
            image_config: image_config || {},
            is_active: true,
            priority: 1,
          })

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({
      success: true,
      image_provider_type,
      image_model: image_model || null,
      has_image_key: true,
      image_config: image_config || {},
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
