import { createClient } from '@/lib/supabase/server'
import { decryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { fetchInstagramProfile, fetchInstagramInsights, fetchInstagramTopPosts, type ChartDataPoint, type TopPost } from '@/lib/social/analytics'

type AnalyticsChartPoint = {
  date: string
  reach: number
  engagement: number
  impressions: number
}

type RecentComment = {
  id: string
  username: string
  text: string
  time: string
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { weekday: 'short' })
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))

  if (diffMinutes < 1) return 'baru saja'
  if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam yang lalu`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} hari yang lalu`
}

function buildChartData(insights: ChartDataPoint[], posts: TopPost[]): AnalyticsChartPoint[] {
  const dailyEngagement = new Map<string, number>()

  for (const post of posts) {
    const date = post.published_at?.split('T')[0]
    if (!date) continue
    dailyEngagement.set(date, (dailyEngagement.get(date) || 0) + post.likes + post.comments)
  }

  if (insights.length > 0) {
    return insights.map(point => ({
      date: formatDay(point.date),
      reach: point.reach,
      impressions: point.impressions,
      engagement: point.engagement || dailyEngagement.get(point.date) || 0,
    }))
  }

  const days: AnalyticsChartPoint[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    days.push({
      date: formatDay(dateKey),
      reach: 0,
      impressions: 0,
      engagement: dailyEngagement.get(dateKey) || 0,
    })
  }

  return days
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accountId = request.nextUrl.searchParams.get('account_id')
  if (!accountId) {
    return NextResponse.json({ error: 'Missing account_id parameter' }, { status: 400 })
  }

  try {
    const { data: account, error: accError } = await supabase
      .from('social_accounts')
      .select('*, business_units!inner(user_id, brand_name)')
      .eq('id', accountId)
      .eq('business_units.user_id', user.id)
      .single()

    if (accError || !account) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 })
    }

    if (account.platform !== 'meta_ig') {
      return NextResponse.json({ error: 'Analytics API saat ini hanya mendukung akun Instagram Graph API' }, { status: 400 })
    }

    const decryptedToken = decryptValue(account.access_token_encrypted)
    const warnings: string[] = []

    let metricsData
    try {
      metricsData = await fetchInstagramProfile(account.ig_user_id, decryptedToken)
    } catch (err: unknown) {
      return NextResponse.json({
        error: `Meta API gagal mengambil profil akun: ${(err as Error).message}`,
      }, { status: 502 })
    }

    let insights: ChartDataPoint[] = []
    try {
      insights = await fetchInstagramInsights(account.ig_user_id, decryptedToken)
      if (insights.length === 0) {
        warnings.push('Meta tidak mengembalikan data Insights untuk 7 hari terakhir. Pastikan token memiliki izin instagram_manage_insights.')
      }
    } catch (err: unknown) {
      warnings.push(`Insights Meta belum tersedia: ${(err as Error).message}`)
    }

    let posts: TopPost[] = []
    try {
      posts = await fetchInstagramTopPosts(account.ig_user_id, decryptedToken, 25)
    } catch (err: unknown) {
      warnings.push(`Media Instagram belum bisa dibaca: ${(err as Error).message}`)
    }

    const chartData = buildChartData(insights, posts)
    const totalReach = chartData.reduce((acc, curr) => acc + (curr.reach || 0), 0)
    const totalEngagement = chartData.reduce((acc, curr) => acc + (curr.engagement || 0), 0)
    const engagementRate = totalReach > 0 ? ((totalEngagement / totalReach) * 100).toFixed(2) : '0'

    const { data: conversations } = await supabase
      .from('social_conversations')
      .select('id, customer_name, latest_message, latest_message_at')
      .eq('account_id', accountId)
      .eq('type', 'comment')
      .order('latest_message_at', { ascending: false })
      .limit(5)

    const recentComments: RecentComment[] = (conversations || []).map(comment => ({
      id: comment.id,
      username: comment.customer_name || 'instagram_user',
      text: comment.latest_message || '',
      time: formatRelativeTime(comment.latest_message_at),
    }))

    return NextResponse.json({
      is_mock: false,
      warnings,
      metrics: {
        ...metricsData,
        engagement_rate: engagementRate + '%',
        total_reach: totalReach,
        total_engagement: totalEngagement,
        unit_name: account.business_units?.brand_name,
      },
      chart_data: chartData,
      recent_comments: recentComments,
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
