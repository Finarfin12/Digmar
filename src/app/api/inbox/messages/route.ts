import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const conversation_id = searchParams.get('conversation_id')

  if (!conversation_id) {
    return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
  }

  try {
    const { data: messages, error } = await supabase
      .from('social_messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Optionally mark conversation as read
    await supabase
      .from('social_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversation_id)

    return NextResponse.json({ success: true, data: messages })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
