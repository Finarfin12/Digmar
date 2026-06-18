import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business_unit_id = request.nextUrl.searchParams.get('business_unit_id')
  
  let query = supabase.from('chatbot_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (business_unit_id) {
    query = query.eq('business_unit_id', business_unit_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { id, business_unit_id, trigger_keyword, reply_mode, response_content, priority, is_active } = body

    if (!business_unit_id || !trigger_keyword || !reply_mode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // H8 Fix: Verifikasi kepemilikan unit
    const { data: unitCheck, error: unitError } = await supabase
      .from('business_units')
      .select('id')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unitCheck) {
      return NextResponse.json({ error: 'Forbidden: You do not own this business unit' }, { status: 403 })
    }

    if (id) {
      // Update
      const { data, error } = await supabase
        .from('chatbot_rules')
        .update({ trigger_keyword, reply_mode, response_content, priority, is_active })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json(data)
    } else {
      // Insert
      const { data, error } = await supabase
        .from('chatbot_rules')
        .insert({
          user_id: user.id,
          business_unit_id,
          trigger_keyword,
          reply_mode,
          response_content,
          priority: priority || 10,
          is_active: is_active ?? true
        })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json(data)
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await supabase.from('chatbot_rules').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
