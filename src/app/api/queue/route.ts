import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

import { handleApiError } from '@/lib/utils/error-handler'
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const unitId = request.nextUrl.searchParams.get('business_unit_id')
  
  // C6 Fix: Verifikasi kepemilikan
  let query = supabase
    .from('content_queue')
    .select('*, business_units!inner(user_id)')
    .eq('business_units.user_id', user.id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  if (unitId) {
    query = query.eq('business_unit_id', unitId)
  }

  const { data, error } = await query

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
    const { 
      business_unit_id, 
      media_urls, 
      caption, 
      first_comment,
      post_type, 
      cover_url,
      priority
    } = body

    if (!business_unit_id) {
      return NextResponse.json({ error: 'Missing business_unit_id' }, { status: 400 })
    }

    // C6 Fix: Verifikasi kepemilikan unit
    const { data: unitCheck, error: unitError } = await supabase
      .from('business_units')
      .select('id')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unitCheck) {
      return NextResponse.json({ error: 'Forbidden: You do not own this business unit' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('content_queue')
      .insert([
        {
          business_unit_id,
          media_urls: media_urls || [],
          caption: caption || '',
          first_comment: first_comment || '',
          post_type: post_type || 'single_image',
          cover_url: cover_url || null,
          priority: priority || 10
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

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  // C6 Fix: Verifikasi kepemilikan sebelum hapus
  const { data: checkData, error: checkError } = await supabase
    .from('content_queue')
    .select('business_units!inner(user_id)')
    .eq('id', id)
    .eq('business_units.user_id', user.id)
    .single()

  if (checkError || !checkData) {
    return NextResponse.json({ error: 'Forbidden or Not Found' }, { status: 403 })
  }

  const { error } = await supabase.from('content_queue').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
