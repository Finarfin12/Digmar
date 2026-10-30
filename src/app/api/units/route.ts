import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

import { handleApiError } from '@/lib/utils/error-handler'
import { isValidTimeZone } from '@/lib/utils/timezone'
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('business_units')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { brand_name, business_category, ai_system_prompt, custom_variables, use_vision_ai, brand_color, brand_logo_url, timezone } = body

    if (!brand_name) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
    }

    if (timezone !== undefined && !isValidTimeZone(timezone)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('business_units')
      .insert([
        {
          user_id: user.id,
          brand_name,
          business_category: business_category || '',
          ai_system_prompt: ai_system_prompt || 'Kamu adalah asisten marketing profesional...',
          custom_variables: custom_variables || {},
          use_vision_ai: !!use_vision_ai,
          brand_color: brand_color || '#4f46e5',
          brand_logo_url: brand_logo_url || null,
          ...(timezone ? { timezone } : {})
        }
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, brand_name, business_category, ai_system_prompt, custom_variables, use_vision_ai, brand_color, brand_logo_url, timezone } = body

    if (!id || !brand_name) {
      return NextResponse.json({ error: 'ID and Brand name are required' }, { status: 400 })
    }

    if (timezone !== undefined && !isValidTimeZone(timezone)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('business_units')
      .update({
        brand_name,
        business_category: business_category || '',
        ai_system_prompt: ai_system_prompt || '',
        custom_variables: custom_variables || {},
        use_vision_ai: !!use_vision_ai,
        brand_color: brand_color || '#4f46e5',
        brand_logo_url: brand_logo_url || null,
        ...(timezone ? { timezone } : {})
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
