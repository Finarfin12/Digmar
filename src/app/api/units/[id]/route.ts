import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

import { isValidTimeZone } from '@/lib/utils/timezone'
import { handleApiError } from '@/lib/utils/error-handler'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

    const { data, error } = await supabase
      .from('business_units')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // C8 Fix: Verifikasi kepemilikan
      .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const allowedFields = ['brand_name', 'business_category', 'ai_system_prompt', 'custom_variables', 'use_vision_ai', 'brand_color', 'brand_logo_url', 'timezone', 'require_approval']
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }
    if (updates.timezone !== undefined && !isValidTimeZone(updates.timezone)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('business_units')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id) // C8 Fix: Verifikasi kepemilikan
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    return handleApiError(err)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('business_units')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id) // C8 Fix: Verifikasi kepemilikan

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
