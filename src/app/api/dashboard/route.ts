import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'


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
      totalPosts,
      todayPosts,
      queueWaiting,
      queueProcessing,
      queueSuccess,
      queueFailed,
      recentPosts,
      recentConversations,
      monthlyPosts,
      unitsData,
      accountsData,
    ] = await Promise.all([
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('scheduled_at', todayStart).lt('scheduled_at', todayEnd),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'waiting'),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'processing'),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['success', 'published']),
      supabase.from('post_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'failed'),
      supabase.from('post_queue').select('job_code, status, scheduled_at, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(10),
      supabase.from('social_conversations').select('id, customer_name, latest_message, latest_message_at, business_units!inner(user_id)').eq('business_units.user_id', user.id).order('latest_message_at', { ascending: false }).limit(10),
      supabase.from('post_queue').select('scheduled_at').eq('user_id', user.id).gte('scheduled_at', monthStart).order('scheduled_at', { ascending: true }),
      supabase.from('business_units').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('social_accounts').select('id, business_units!inner(user_id)', { count: 'exact', head: true }).eq('business_units.user_id', user.id),
    ])

    const queue = {
      waiting: queueWaiting.count || 0,
      processing: queueProcessing.count || 0,
      success: queueSuccess.count || 0,
      failed: queueFailed.count || 0,
    }

    const calendarMap = new Map<string, number>()
    if (monthlyPosts.data) {
      for (const p of monthlyPosts.data) {
        const dateKey = p.scheduled_at.split('T')[0]
        calendarMap.set(dateKey, (calendarMap.get(dateKey) || 0) + 1)
      }
    }
    const monthlyCalendar = Array.from(calendarMap.entries()).map(([date, count]) => ({ date, count }))

    const activity: Array<{ type: string; timestamp: string; message: string }> = []

    if (recentPosts.data) {
      for (const p of recentPosts.data.slice(0, 5)) {
        const statusLabel = p.status === 'success' ? 'berhasil dipublikasi' : p.status === 'failed' ? 'gagal' : p.status
        activity.push({
          type: `post_${p.status}`,
          timestamp: p.updated_at,
          message: `Post ${p.job_code} — ${statusLabel}`,
        })
      }
    }

    if (recentConversations.data) {
      for (const c of recentConversations.data.slice(0, 5)) {
        activity.push({
          type: 'conversation',
          timestamp: c.latest_message_at,
          message: `Pesan baru dari ${c.customer_name}: "${(c.latest_message || '').substring(0, 60)}${(c.latest_message?.length || 0) > 60 ? '...' : ''}"`,
        })
      }
    }

    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      total_posts: totalPosts.count || 0,
      posts_today: todayPosts.count || 0,
      total_units: unitsData.count || 0,
      total_accounts: accountsData.count || 0,
      queue,
      monthly_calendar: monthlyCalendar.slice(0, 31),
      recent_activity: activity.slice(0, 10),
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
