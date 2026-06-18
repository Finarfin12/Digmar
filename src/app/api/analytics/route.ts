import { createClient } from '@/lib/supabase/server'
import { decryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { fetchInstagramProfile, fetchInstagramInsights, getMockChartData } from '@/lib/social/analytics'

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
      .select('*, business_units!inner(user_id)')
      .eq('id', accountId)
      .eq('business_units.user_id', user.id)
      .single()

    if (accError || !account) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 })
    }

    const decryptedToken = decryptValue(account.access_token_encrypted)
    let isMock = false
    let metricsData = null
    let chartData: any[] = []

    if (account.platform === 'meta_ig' && decryptedToken) {
      try {
        const profile = await fetchInstagramProfile(account.ig_user_id, decryptedToken)
        metricsData = profile

        const insights = await fetchInstagramInsights(account.ig_user_id, decryptedToken)
        if (insights.length > 0) {
          chartData = insights.map(d => ({
            date: new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' }),
            reach: d.reach,
            engagement: d.engagement,
            impressions: d.impressions,
          }))
        } else {
          chartData = getMockChartData().map(d => ({
            date: new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' }),
            reach: d.reach,
            engagement: d.engagement,
            impressions: d.impressions,
          }))
        }
      } catch {
        isMock = true
      }
    }

    if (isMock || !metricsData) {
      metricsData = {
        followers: Math.floor(Math.random() * 10000) + 1000,
        posts: Math.floor(Math.random() * 500) + 50,
        name: 'Mock Account',
        profile_pic: 'https://ui-avatars.com/api/?name=Mock&background=random',
      }
      chartData = getMockChartData().map(d => ({
        date: new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' }),
        reach: d.reach,
        engagement: d.engagement,
        impressions: d.impressions,
      }))
    }

    const totalReach = chartData.reduce((acc: number, curr: any) => acc + (curr.reach || 0), 0)
    const totalEngagement = chartData.reduce((acc: number, curr: any) => acc + (curr.engagement || 0), 0)
    const engagementRate = totalReach > 0 ? ((totalEngagement / totalReach) * 100).toFixed(2) : '0'

    const recentComments = [
      { id: '1', username: 'john_doe', text: 'Berapa harganya kak?', time: '10 menit yang lalu' },
      { id: '2', username: 'siti_aminah', text: 'Apakah ready stock?', time: '1 jam yang lalu' },
      { id: '3', username: 'budi_santoso', text: 'Wah bagus banget produknya!', time: '3 jam yang lalu' },
    ]

    return NextResponse.json({
      is_mock: isMock,
      metrics: {
        ...metricsData,
        engagement_rate: engagementRate + '%',
        total_reach: totalReach,
      },
      chart_data: chartData,
      recent_comments: recentComments,
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
