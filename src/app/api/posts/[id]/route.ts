import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

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
    .from('post_queue')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
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

    // Whitelist: status, log_messages, retry fields, dll. hanya boleh diubah oleh publisher
    const allowedFields = ['caption', 'first_comment', 'scheduled_at', 'media_urls', 'post_type', 'cover_url', 'platform_captions', 'target_account_ids']
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (updates.scheduled_at !== undefined) {
      const parsedSchedule = new Date(String(updates.scheduled_at))
      if (Number.isNaN(parsedSchedule.getTime())) {
        return NextResponse.json({ error: 'Tanggal jadwal tidak valid' }, { status: 400 })
      }
      updates.scheduled_at = parsedSchedule.toISOString()
    }

    if (updates.media_urls !== undefined) {
      const mediaUrls = updates.media_urls
      if (!Array.isArray(mediaUrls) || mediaUrls.some(url => typeof url !== 'string' || !url.trim())) {
        return NextResponse.json({ error: 'Media tidak valid' }, { status: 400 })
      }
    }

    // Target akun harus milik user ini — publisher memakai service client yang bypass RLS
    if (updates.target_account_ids !== undefined) {
      const targetIds = updates.target_account_ids
      if (!Array.isArray(targetIds) || targetIds.length === 0 || targetIds.some(tid => typeof tid !== 'string')) {
        return NextResponse.json({ error: 'Invalid target account IDs' }, { status: 400 })
      }
      const uniqueTargetIds = [...new Set(targetIds as string[])]

      const { data: ownedAccounts, error: ownedAccountsError } = await supabase
        .from('social_accounts')
        .select('id, business_units!inner(user_id)')
        .in('id', uniqueTargetIds)
        .eq('business_units.user_id', user.id)

      if (ownedAccountsError) {
        return NextResponse.json({ error: ownedAccountsError.message }, { status: 500 })
      }
      if (!ownedAccounts || ownedAccounts.length !== uniqueTargetIds.length) {
        return NextResponse.json({ error: 'One or more target accounts are not owned by this user' }, { status: 403 })
      }
      updates.target_account_ids = uniqueTargetIds
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('post_queue')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
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
    .from('post_queue')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
