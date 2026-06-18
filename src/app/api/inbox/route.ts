import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const business_unit_id = searchParams.get('business_unit_id')
  const account_id = searchParams.get('account_id')

  if (!business_unit_id) {
    return NextResponse.json({ error: 'Business unit ID required' }, { status: 400 })
  }

  try {
    let query = supabase
      .from('social_conversations')
      .select('*, social_accounts(platform, ig_user_id)')
      .eq('business_unit_id', business_unit_id)
      .order('latest_message_at', { ascending: false })

    if (account_id) {
      query = query.eq('account_id', account_id)
    }

    const { data: conversations, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, data: conversations })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
