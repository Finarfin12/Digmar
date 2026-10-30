import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { validateIdeaFields } from './validation'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const businessUnitId = request.nextUrl.searchParams.get('business_unit_id')
  const status = request.nextUrl.searchParams.get('status')

  let query = supabase
    .from('idea_board')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (businessUnitId) query = query.eq('business_unit_id', businessUnitId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
    const { title, description, business_unit_id, priority, platform, tags, status } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const validationError = await validateIdeaFields(supabase, user.id, { status, priority, tags, business_unit_id })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const targetStatus = status || 'unassigned'

    const { data: maxPos } = await supabase
      .from('idea_board')
      .select('position')
      .eq('user_id', user.id)
      .eq('status', targetStatus)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextPosition = (maxPos?.position ?? -1) + 1

    const { data, error } = await supabase
      .from('idea_board')
      .insert({
        user_id: user.id,
        business_unit_id: business_unit_id || null,
        title: title.trim(),
        description: description || '',
        priority: priority || 'medium',
        platform: platform || '',
        tags: tags || [],
        position: nextPosition,
        status: targetStatus,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
