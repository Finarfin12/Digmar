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
  
  // C7 Fix: Verifikasi kepemilikan
  let query = supabase
    .from('posting_schedules')
    .select('*, business_units!inner(user_id)')
    .eq('business_units.user_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('time_of_day', { ascending: true })

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
    const { business_unit_id, day_of_week, time_of_day } = body

    if (!business_unit_id || day_of_week === undefined || !time_of_day) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // C7 Fix: Verifikasi kepemilikan
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
      .from('posting_schedules')
      .insert([{ business_unit_id, day_of_week, time_of_day }])
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

  // C7 Fix: Verifikasi kepemilikan sebelum hapus
  const { data: checkData, error: checkError } = await supabase
    .from('posting_schedules')
    .select('business_units!inner(user_id)')
    .eq('id', id)
    .eq('business_units.user_id', user.id)
    .single()

  if (checkError || !checkData) {
    return NextResponse.json({ error: 'Forbidden or Not Found' }, { status: 403 })
  }

  const { error } = await supabase.from('posting_schedules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
