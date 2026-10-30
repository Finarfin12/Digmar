import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { validateIdeaFields } from '../validation'

async function getOwnedIdea(supabase: any, id: string, userId: string) {
  const { data, error } = await supabase
    .from('idea_board')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await getOwnedIdea(supabase, id, user.id)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const allowedFields = ['title', 'description', 'status', 'priority', 'platform', 'business_unit_id', 'media_url', 'tags', 'scheduled_at', 'position']
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }
    if (updates.title !== undefined && !String(updates.title).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
    const validationError = await validateIdeaFields(supabase, user.id, updates)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    // Pindah kolom tanpa posisi eksplisit → taruh di paling bawah kolom tujuan
    if (updates.status !== undefined && updates.status !== existing.status && updates.position === undefined) {
      const { data: maxPos } = await supabase
        .from('idea_board')
        .select('position')
        .eq('user_id', user.id)
        .eq('status', updates.status)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      updates.position = (maxPos?.position ?? -1) + 1
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('idea_board')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await getOwnedIdea(supabase, id, user.id)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('idea_board')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
