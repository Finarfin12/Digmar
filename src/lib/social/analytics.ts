export interface AnalyticsMetrics {
  followers: number;
  posts: number;
  name: string;
  profile_pic: string;
  reach_7d: number;
  impressions_7d: number;
  engagement_rate: number;
  is_mock: boolean;
}

export interface ChartDataPoint {
  date: string;
  reach: number;
  impressions: number;
  engagement: number;
}

export interface TopPost {
  id: string;
  caption: string;
  media_url: string;
  likes: number;
  comments: number;
  reach: number;
  engagement_rate: number;
  published_at: string;
}

const META_API_BASE = 'https://graph.facebook.com';

async function readMetaResponse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    const message = data?.error?.message || `Meta API request failed: ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function fetchInstagramProfile(igUserId: string, accessToken: string): Promise<{ followers: number; posts: number; name: string; profile_pic: string }> {
  const version = process.env.META_API_VERSION || 'v18.0';
  const params = new URLSearchParams({
    fields: 'followers_count,media_count,name,username,profile_picture_url',
    access_token: accessToken,
  });
  const res = await fetch(`${META_API_BASE}/${version}/${igUserId}?${params.toString()}`);
  const data = await readMetaResponse(res);
  return {
    followers: data.followers_count || 0,
    posts: data.media_count || 0,
    name: data.name || data.username || 'Instagram Account',
    profile_pic: data.profile_picture_url || '',
  };
}

export async function fetchInstagramInsights(igUserId: string, accessToken: string): Promise<ChartDataPoint[]> {
  const version = process.env.META_API_VERSION || 'v18.0';
  const params = new URLSearchParams({
    metric: 'reach,views',
    period: 'day',
    access_token: accessToken,
  });
  const res = await fetch(`${META_API_BASE}/${version}/${igUserId}/insights?${params.toString()}`);
  const data = await readMetaResponse(res);

  if (!data.data || data.data.length === 0) return [];

  const reachMetric = data.data.find((d: Record<string, unknown>) => d.name === 'reach');
  const viewsMetric = data.data.find((d: Record<string, unknown>) => d.name === 'views');

  const points: ChartDataPoint[] = [];
  const reachValues = (reachMetric?.values || []) as Array<{ end_time: string; value: number }>;
  const viewValues = (viewsMetric?.values || []) as Array<{ end_time: string; value: number }>;
  const values = reachValues.length > 0 ? reachValues : viewValues;

  for (const [index, entry] of values.slice(-7).entries()) {
    const date = entry.end_time?.split('T')[0] || '';
    points.push({
      date,
      reach: reachMetric ? entry.value : 0,
      impressions: viewValues[index]?.value || 0,
      engagement: 0,
    });
  }
  return points;
}

export async function fetchInstagramTopPosts(igUserId: string, accessToken: string, limit = 10): Promise<TopPost[]> {
  const version = process.env.META_API_VERSION || 'v18.0';
  const params = new URLSearchParams({
    fields: 'id,caption,media_url,like_count,comments_count,timestamp,permalink',
    limit: String(limit),
    access_token: accessToken,
  });
  const res = await fetch(`${META_API_BASE}/${version}/${igUserId}/media?${params.toString()}`);
  const data = await readMetaResponse(res);

  if (!data.data) return [];

  return (data.data as Array<Record<string, unknown>>).map((m) => ({
    id: m.id as string,
    caption: String(m.caption || '').substring(0, 150),
    media_url: String(m.media_url || ''),
    likes: Number(m.like_count) || 0,
    comments: Number(m.comments_count) || 0,
    reach: 0,
    engagement_rate: 0,
    published_at: String(m.timestamp || ''),
  }));
}

export async function fetchFacebookPageInsights(pageId: string, accessToken: string): Promise<{ followers: number; impressions_7d: number }> {
  const version = process.env.META_API_VERSION || 'v18.0';
  const url = `${META_API_BASE}/${version}/${pageId}/insights?metric=page_follows,page_impressions&period=day&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) return { followers: 0, impressions_7d: 0 };
  const data = await res.json();

  let followers = 0;
  let impressions = 0;
  if (data.data) {
    for (const metric of data.data as Array<Record<string, unknown>>) {
      const values = metric.values as Array<{ value: number }> | undefined;
      const lastVal = values?.[values.length - 1]?.value;
      if (metric.name === 'page_follows') followers = lastVal || 0;
      if (metric.name === 'page_impressions') impressions = lastVal || 0;
    }
  }
  return { followers, impressions_7d: impressions };
}

export function getMockChartData(): ChartDataPoint[] {
  const days: ChartDataPoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      date: dateStr,
      reach: Math.floor(Math.random() * 800) + 200,
      impressions: Math.floor(Math.random() * 1500) + 500,
      engagement: Math.floor(Math.random() * 200) + 50,
    });
  }
  return days;
}

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

export async function fetchThreadsProfile(userId: string, accessToken: string): Promise<{ followers: number; posts: number; name: string; profile_pic: string }> {
  // 1. Get basic profile
  const params = new URLSearchParams({
    fields: 'id,username,name,threads_profile_picture_url',
    access_token: accessToken,
  });
  const res = await fetch(`${THREADS_API_BASE}/${userId}?${params.toString()}`);
  const data = await readMetaResponse(res);
  
  let followers = 0;
  let posts = 0;

  // 2. Get Follower count via insights (requires threads_manage_insights)
  try {
    const followersRes = await fetch(`${THREADS_API_BASE}/${userId}/threads_insights?metric=followers_count&access_token=${accessToken}`);
    if (followersRes.ok) {
      const followersData = await followersRes.json();
      const vals = followersData.data?.find((d: any) => d.name === 'followers_count')?.values;
      // Get the latest day's follower count
      if (vals && vals.length > 0) {
        followers = vals[vals.length - 1].value || 0;
      }
    }
  } catch (e) {}

  // 3. Get total posts count (approximation by fetching recent threads)
  try {
    const postsRes = await fetch(`${THREADS_API_BASE}/${userId}/threads?access_token=${accessToken}`);
    if (postsRes.ok) {
      const postsData = await postsRes.json();
      posts = postsData.data?.length || 0; // returns up to 25 items by default, accurate for new accounts
    }
  } catch (e) {}

  return {
    followers,
    posts,
    name: data.name || data.username || 'Threads Account',
    profile_pic: data.threads_profile_picture_url || '',
  };
}

export async function fetchThreadsInsights(userId: string, accessToken: string): Promise<ChartDataPoint[]> {
  // Memerlukan permission threads_manage_insights
  const params = new URLSearchParams({
    metric: 'views,likes,replies,reposts,quotes',
    access_token: accessToken,
  });
  
  // Jika gagal (karena permission), kembalikan array kosong agar di-handle sebagai warning
  try {
    const res = await fetch(`${THREADS_API_BASE}/${userId}/threads_insights?${params.toString()}`);
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data.data) return [];
    
    // Parse sederhana jika ada data (asumsi struktur mirip IG)
    const points: ChartDataPoint[] = [];
    const viewsData = data.data.find((d: any) => d.name === 'views')?.values || [];
    
    for (const [index, entry] of viewsData.slice(-7).entries()) {
      const date = entry.end_time?.split('T')[0] || new Date().toISOString().split('T')[0];
      points.push({
        date,
        reach: entry.value || 0,
        impressions: entry.value || 0,
        engagement: 0,
      });
    }
    return points;
  } catch {
    return [];
  }
}

export async function fetchThreadsTopPosts(userId: string, accessToken: string, limit = 10): Promise<TopPost[]> {
  const params = new URLSearchParams({
    fields: 'id,text,media_url,timestamp,permalink',
    limit: String(limit),
    access_token: accessToken,
  });
  const res = await fetch(`${THREADS_API_BASE}/${userId}/threads?${params.toString()}`);
  const data = await res.json().catch(() => null);

  if (!res.ok || data?.error || !data.data) {
     throw new Error(data?.error?.message || 'Gagal mengambil postingan Threads');
  }

  return (data.data as Array<Record<string, unknown>>).map((m) => ({
    id: m.id as string,
    caption: String(m.text || '').substring(0, 150),
    media_url: String(m.media_url || ''),
    likes: 0, 
    comments: 0, 
    reach: 0,
    engagement_rate: 0,
    published_at: String(m.timestamp || ''),
  }));
}

