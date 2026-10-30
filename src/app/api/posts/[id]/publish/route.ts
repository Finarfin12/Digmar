import { createClient } from '@/lib/supabase/server'
import { processSingleJob } from '@/lib/social/publisher'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

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
    const { data: job, error: fetchError } = await supabase
      .from('post_queue')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !job) {
      return NextResponse.json({ error: 'Post tidak ditemukan' }, { status: 404 })
    }

    if (job.status === 'processing') {
      return NextResponse.json({ error: 'Post sedang diproses' }, { status: 409 })
    }

    if (job.status === 'success' || job.status === 'partial') {
      return NextResponse.json({ error: 'Post sudah dipublikasikan' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('post_queue')
      .update({
        status: 'waiting',
        scheduled_at: now,
        next_retry_at: null,
        retry_count: 0,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const result = await processSingleJob(id)
    return NextResponse.json(result)
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
