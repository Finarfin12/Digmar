import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { generateApprovalToken, isReviewAction, nextReviewState } from '@/lib/approval'

// Pemilik post: minta review (submit), setujui, atau tolak
export async function POST(
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
    const action = body?.action
    const note = typeof body?.note === 'string' ? body.note.slice(0, 2000) : null
    if (!isReviewAction(action)) {
      return NextResponse.json({ error: 'action must be submit, approve, or reject' }, { status: 400 })
    }

    const { data: post, error: fetchError } = await supabase
      .from('post_queue')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post tidak ditemukan' }, { status: 404 })
    }

    const next = nextReviewState(post.status, action)
    if (!next) {
      return NextResponse.json({ error: `Aksi ${action} tidak berlaku untuk status ${post.status}` }, { status: 409 })
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { status: next.status, updated_at: now }
    if (next.newToken) {
      updates.approval_token = generateApprovalToken()
      updates.review_note = null
      updates.reviewed_at = null
      updates.reviewed_by = null
    } else {
      updates.review_note = note
      updates.reviewed_at = now
      updates.reviewed_by = user.email || 'owner'
    }

    const { data, error } = await supabase
      .from('post_queue')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', post.status) // cegah race dengan reviewer lain
      .select('id, status, approval_token, review_note, reviewed_at, reviewed_by')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Status post berubah, muat ulang halaman' }, { status: 409 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
