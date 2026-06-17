import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const unitId = request.nextUrl.searchParams.get('business_unit_id')
  
  let query = supabase
    .from('content_queue')
    .select('*')
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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const { error } = await supabase.from('content_queue').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
