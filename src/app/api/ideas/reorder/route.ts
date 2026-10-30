import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { IDEA_STATUSES } from '../validation'

type ReorderItem = { id: string; status: string; position: number }

// Simpan urutan & kolom beberapa kartu sekaligus (drag-and-drop Kanban)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const items: unknown = body?.items

    if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
      return NextResponse.json({ error: 'items must be a non-empty array (max 500)' }, { status: 400 })
    }

    const valid = items.every((item): item is ReorderItem =>
      typeof item?.id === 'string' &&
      IDEA_STATUSES.includes(item?.status) &&
      Number.isInteger(item?.position) && item.position >= 0
    )
    if (!valid) {
      return NextResponse.json({ error: 'Invalid reorder item' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const results = await Promise.all((items as ReorderItem[]).map(item =>
      supabase
        .from('idea_board')
        .update({ status: item.status, position: item.position, updated_at: now })
        .eq('id', item.id)
        .eq('user_id', user.id)
    ))

    const failed = results.find(r => r.error)
    if (failed?.error) {
      return NextResponse.json({ error: failed.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err)
  }
}
