import { createClient } from '@/lib/supabase/server'
import { encryptValue } from '@/lib/crypto/server'
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
    .from('social_accounts')
    .select('*, business_units!inner(user_id)')
    .eq('id', id)
    .eq('business_units.user_id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  const { access_token_encrypted, business_units, ...safeData } = data
  return NextResponse.json({ ...safeData, has_token: !!access_token_encrypted })
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

  // C1 Fix: Verifikasi kepemilikan
  const { data: checkData, error: checkError } = await supabase
    .from('social_accounts')
    .select('business_units!inner(user_id)')
    .eq('id', id)
    .eq('business_units.user_id', user.id)
    .single()

  if (checkError || !checkData) {
    return NextResponse.json({ error: 'Forbidden or Not Found' }, { status: 403 })
  }

  try {
    const body = await request.json()
    
    delete body.id
    delete body.business_unit_id
    
    const updateData: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }

    if (body.access_token) {
      updateData.access_token_encrypted = encryptValue(body.access_token)
      delete updateData.access_token
    }

    const { data, error } = await supabase
      .from('social_accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { access_token_encrypted, ...safeData } = data
    return NextResponse.json({ ...safeData, has_token: true })
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

  // C1 Fix: Verifikasi kepemilikan
  const { data: checkData, error: checkError } = await supabase
    .from('social_accounts')
    .select('business_units!inner(user_id)')
    .eq('id', id)
    .eq('business_units.user_id', user.id)
    .single()

  if (checkError || !checkData) {
    return NextResponse.json({ error: 'Forbidden or Not Found' }, { status: 403 })
  }

  const { error } = await supabase
    .from('social_accounts')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
