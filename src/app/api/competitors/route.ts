import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'

import { handleApiError } from '@/lib/utils/error-handler'
import { logger } from '@/lib/utils/logger'
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('competitor_tracking')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { handle, platform = 'instagram' } = await request.json()

    if (!handle) return NextResponse.json({ error: 'Handle required' }, { status: 400 })

    let realFollowers = null;
    if (platform === 'instagram') {
      try {
        const igRes = await fetch(`https://www.instagram.com/${handle}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          next: { revalidate: 3600 }
        });
        const html = await igRes.text();
        // Try JSON first
        const jsonMatch = html.match(/window\._sharedData\s*=\s*(\{.+?\});/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            const count = data.entry_data?.ProfilePage?.[0]?.graphql?.user?.edge_followed_by?.count;
            if (count) realFollowers = count.toString();
          } catch(e) {}
        }
        
        // Fallback to meta tag
        if (!realFollowers) {
          const match = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
          if (match && match[1]) {
            const followersStr = match[1].split(' Followers')[0];
            if (followersStr && followersStr.length < 20) {
              realFollowers = followersStr;
            }
          }
        }
      } catch(e) {
        logger.error("IG Scrape error:", e);
      }
    }

    const { client } = await getAIProvider(user.id)
    const followerContext = realFollowers 
      ? `Data ASLI Followers saat ini: ${realFollowers} (Gunakan teks/angka ini persis di output followers!).`
      : `Buatkan estimasi realistis untuk jumlah followers.`;

    const aiPrompt = `Berikan data performa untuk akun sosial media @${handle} di platform ${platform}. 
${followerContext}
Engagement Rate estimasi: Buatkan estimasi realistis (misal 0.5% - 3%).
Top Posts: Buatkan 3 post terakhir yang SANGAT SPESIFIK dan sesuai dengan gaya/niche dari brand/akun @${handle}. JANGAN gunakan caption generik seperti "Introducing our newest...". Tulis caption yang persis meniru gaya brand asli (bahasa yang sesuai), sesuaikan jumlah likes/comments dengan rasio followers.

Tolong keluarkan JSON dengan format: 
{ 
  "metrics": { "followers": "...", "engagement_rate": "..." }, 
  "top_posts": [
    { "type": "image", "caption": "Caption spesifik brand...", "likes": 50000, "comments": 1200 }
  ] 
}`;

    const aiRes = await client.generateText("Anda adalah analis intelijen sosial media.", aiPrompt, { temperature: 0.7, maxTokens: 1000 });
    let analysis;
    try {
      analysis = JSON.parse(aiRes.content.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch(e) {
      analysis = { metrics: { followers: 0, engagement_rate: "0%" }, top_posts: [] };
    }

    const { data, error } = await supabase
      .from('competitor_tracking')
      .insert({
        user_id: user.id,
        handle,
        platform,
        metrics_json: analysis.metrics,
        top_posts_json: analysis.top_posts,
        last_scraped_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error;
    return NextResponse.json(data)
  } catch (err: unknown) {
    return handleApiError(err)
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await supabase.from('competitor_tracking').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
