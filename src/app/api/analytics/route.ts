import { createClient } from '@/lib/supabase/server'
import { decryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'

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
    // 1. Fetch account details
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

    // 2. Try fetching real data from Meta Graph API
    let isMock = false;
    let metricsData = null;

    if (account.platform === 'meta_ig' && decryptedToken) {
      try {
        const url = `https://graph.facebook.com/v18.0/${account.ig_user_id}?fields=followers_count,media_count,name,profile_picture_url&access_token=${decryptedToken}`;
        const res = await fetch(url);
        if (res.ok) {
          const fbData = await res.json();
          // We could fetch insights here, but Graph API requires special permissions for insights.
          // For now, we will construct the object using the real profile data.
          metricsData = {
            followers: fbData.followers_count || 0,
            posts: fbData.media_count || 0,
            name: fbData.name || 'Instagram User',
            profile_pic: fbData.profile_picture_url,
          }
        } else {
          // Fallback to mock if token is invalid or permissions missing
          isMock = true;
        }
      } catch (err) {
        isMock = true;
      }
    } else {
      isMock = true;
    }

    // 3. Generate Mock Data if real data failed or unsupported platform
    if (isMock) {
      metricsData = {
        followers: Math.floor(Math.random() * 10000) + 1000,
        posts: Math.floor(Math.random() * 500) + 50,
        name: 'Mock Account',
        profile_pic: 'https://ui-avatars.com/api/?name=Mock&background=random',
      }
    }

    // 4. Generate 7-day chart data (Mock for now since real insights require complex pagination)
    const today = new Date();
    const chartData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        reach: Math.floor(Math.random() * 5000) + 500,
        engagement: Math.floor(Math.random() * 500) + 50,
      };
    });

    const totalReach = chartData.reduce((acc, curr) => acc + curr.reach, 0);
    const totalEngagement = chartData.reduce((acc, curr) => acc + curr.engagement, 0);
    const engagementRate = ((totalEngagement / totalReach) * 100).toFixed(2);

    // 5. Mock Recent Comments
    const recentComments = [
      { id: '1', username: 'john_doe', text: 'Berapa harganya kak?', time: '10 menit yang lalu' },
      { id: '2', username: 'siti_aminah', text: 'Apakah ready stock?', time: '1 jam yang lalu' },
      { id: '3', username: 'budi_santoso', text: 'Wah bagus banget produknya!', time: '3 jam yang lalu' },
    ];

    return NextResponse.json({
      is_mock: isMock,
      metrics: {
        ...metricsData,
        engagement_rate: engagementRate + '%',
        total_reach: totalReach,
      },
      chart_data: chartData,
      recent_comments: recentComments
    })

  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
