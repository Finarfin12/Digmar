import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

function getCount(data: unknown): number {
  if (Array.isArray(data)) return data.length
  if (data && typeof data === 'object' && 'count' in data) return (data as { count: number }).count
  return 0
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [
      { data: totalPosts },
      { data: todayPosts },
      { data: queueWaiting },
      { data: queueProcessing },
      { data: queueSuccess },
      { data: queueFailed },
      { data: recentPosts },
      { data: recentConversations },
      { data: monthlyPosts },
      { data: unitsData },
      { data: accountsData },
    ] = await Promise.all([
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('scheduled_at', todayStart).lt('scheduled_at', todayEnd),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'waiting'),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'processing'),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['success', 'published']),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'failed'),
      supabase.from('post_queue').select('job_code, status, scheduled_at, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(10),
      supabase.from('social_conversations').select('id, customer_name, latest_message, latest_message_at').eq('business_units.user_id', user.id).order('latest_message_at', { ascending: false }).limit(10),
      supabase.from('post_queue').select('scheduled_at').eq('user_id', user.id).gte('scheduled_at', monthStart).order('scheduled_at', { ascending: true }),
      supabase.from('business_units').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('social_accounts').select('id', { count: 'exact', head: true }).eq('business_units.user_id', user.id),
    ])

    const queue = {
      waiting: getCount(queueWaiting),
      processing: getCount(queueProcessing),
      success: getCount(queueSuccess),
      failed: getCount(queueFailed),
    }

    const calendarMap = new Map<string, number>()
    if (monthlyPosts) {
      for (const p of monthlyPosts) {
        const dateKey = p.scheduled_at.split('T')[0]
        calendarMap.set(dateKey, (calendarMap.get(dateKey) || 0) + 1)
      }
    }
    const monthlyCalendar = Array.from(calendarMap.entries()).map(([date, count]) => ({ date, count }))

    const activity: Array<{ type: string; timestamp: string; message: string }> = []

    if (recentPosts) {
      for (const p of recentPosts.slice(0, 5)) {
        const statusLabel = p.status === 'success' ? 'berhasil dipublikasi' : p.status === 'failed' ? 'gagal' : p.status
        activity.push({
          type: `post_${p.status}`,
          timestamp: p.updated_at,
          message: `Post ${p.job_code} — ${statusLabel}`,
        })
      }
    }

    if (recentConversations) {
      for (const c of recentConversations.slice(0, 5)) {
        activity.push({
          type: 'conversation',
          timestamp: c.latest_message_at,
          message: `Pesan baru dari ${c.customer_name}: "${(c.latest_message || '').substring(0, 60)}${(c.latest_message?.length || 0) > 60 ? '...' : ''}"`,
        })
      }
    }

    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      total_posts: getCount(totalPosts),
      posts_today: getCount(todayPosts),
      total_units: getCount(unitsData),
      total_accounts: getCount(accountsData),
      queue,
      monthly_calendar: monthlyCalendar.slice(0, 31),
      recent_activity: activity.slice(0, 10),
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
