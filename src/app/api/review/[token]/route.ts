import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { nextReviewState } from '@/lib/approval'
import { createNotification } from '@/lib/notifications'

// Link review publik untuk klien (tanpa login). Akses hanya dengan token rahasia per post.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,64}$/

async function findPostByToken(token: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('post_queue')
    .select('id, user_id, job_code, status, caption, media_urls, post_type, scheduled_at, target_account_ids, review_note, reviewed_at, reviewed_by')
    .eq('approval_token', token)
    .maybeSingle()
  return { supabase, post: data }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!TOKEN_PATTERN.test(token)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkRateLimit(getRateLimitIdentifier(request), 'review-view', 60, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { supabase, post } = await findPostByToken(token)
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('platform, business_units(brand_name)')
      .in('id', post.target_account_ids || [])

    const brandNames = [...new Set((accounts || [])
      .map(a => (a.business_units as unknown as { brand_name?: string } | null)?.brand_name)
      .filter(Boolean))]

    // Jangan kirim user_id, target_account_ids, atau token ke klien
    return NextResponse.json({
      job_code: post.job_code,
      status: post.status,
      caption: post.caption,
      media_urls: post.media_urls,
      post_type: post.post_type,
      scheduled_at: post.scheduled_at,
      platforms: [...new Set((accounts || []).map(a => a.platform))],
      brand: brandNames.join(', '),
      review_note: post.review_note,
      reviewed_at: post.reviewed_at,
      reviewed_by: post.reviewed_by,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!TOKEN_PATTERN.test(token)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!await checkRateLimit(getRateLimitIdentifier(request), 'review-decide', 10, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const action = body?.action
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }
    const reviewerName = typeof body?.reviewer_name === 'string' && body.reviewer_name.trim()
      ? body.reviewer_name.trim().slice(0, 100)
      : 'Klien'
    const note = typeof body?.note === 'string' ? body.note.slice(0, 2000) : null

    const { supabase, post } = await findPostByToken(token)
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const next = nextReviewState(post.status, action)
    if (!next) {
      return NextResponse.json({ error: 'Post ini sudah direview atau tidak lagi menunggu persetujuan' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { data: updated, error } = await supabase
      .from('post_queue')
      .update({ status: next.status, review_note: note, reviewed_at: now, reviewed_by: reviewerName, updated_at: now })
      .eq('id', post.id)
      .eq('status', 'pending_review')
      .select('id')
      .maybeSingle()

    if (error || !updated) {
      return NextResponse.json({ error: 'Post ini sudah direview' }, { status: 409 })
    }

    await createNotification({
      userId: post.user_id,
      type: 'approval_decided',
      title: action === 'approve'
        ? `Post ${post.job_code} disetujui oleh ${reviewerName}`
        : `Post ${post.job_code} ditolak oleh ${reviewerName}`,
      message: note || (action === 'approve' ? 'Post masuk antrean publish sesuai jadwal.' : 'Perbaiki post lalu minta review lagi.'),
      link: '/queue',
      metadata: { post_id: post.id, action },
    }, supabase)

    return NextResponse.json({ status: next.status })
  } catch (err) {
    return handleApiError(err)
  }
}
