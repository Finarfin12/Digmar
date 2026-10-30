import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedLimit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)
  const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100)

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, message, link, metadata, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ])

  if (error || countError) {
    return NextResponse.json({ error: (error || countError)!.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: data || [], unread_count: count || 0 })
}

// Tandai dibaca: { ids: string[] } atau { all: true }
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const now = new Date().toISOString()

    let query = supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (body?.all === true) {
      // semua notifikasi belum dibaca
    } else if (Array.isArray(body?.ids) && body.ids.length > 0 && body.ids.every((id: unknown) => typeof id === 'string')) {
      query = query.in('id', body.ids)
    } else {
      return NextResponse.json({ error: 'Provide ids or all: true' }, { status: 400 })
    }

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err)
  }
}
