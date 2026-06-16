import { createClient } from '@/lib/supabase/server'
import { generateJobCode } from '@/lib/utils/job-code'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
  const status = request.nextUrl.searchParams.get('status')
  
  let query = supabase
    .from('post_queue')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
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
      target_account_ids, 
      scheduled_at, 
      media_urls, 
      caption, 
      post_type, 
      cover_url 
    } = body

    if (!target_account_ids || target_account_ids.length === 0 || !scheduled_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const job_code = generateJobCode()

    const { data, error } = await supabase
      .from('post_queue')
      .insert([
        {
          user_id: user.id,
          job_code,
          target_account_ids,
          scheduled_at,
          media_urls: media_urls || [],
          caption: caption || '',
          post_type: post_type || 'single_image',
          cover_url: cover_url || null,
          status: 'waiting',
          log_messages: []
        }
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
