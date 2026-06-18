import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const business_unit_id = searchParams.get('business_unit_id')

  if (!business_unit_id) {
    return NextResponse.json({ error: 'Business unit ID required' }, { status: 400 })
  }

  try {
    // Cari semua post yang memiliki ab_test_id, group by ab_test_id
    // Untuk demo, kita ambil yang statusnya apa saja, lalu pura-pura membuat analytics.
    const { data: posts, error: postsError } = await supabase
      .from('post_queue')
      .select('*')
      .not('ab_test_id', 'is', null)
      .order('created_at', { ascending: false })

    if (postsError) throw postsError;

    // Group by ab_test_id
    const testGroups: Record<string, any[]> = {};
    for (const post of posts) {
      if (!testGroups[post.ab_test_id]) testGroups[post.ab_test_id] = [];
      testGroups[post.ab_test_id].push(post);
    }

    const results = [];
    
    const { client } = await getAIProvider(user.id); // Default provider for AI Conclusion

    for (const [abTestId, variants] of Object.entries(testGroups)) {
      if (variants.length !== 2) continue; // Harus 2 varian untuk A/B test

      const vA = variants[0];
      const vB = variants[1];

      // Simulasi metrik karena kita belum terhubung full ke Graph API real-time
      const metricsA = {
        likes: Math.floor(Math.random() * 500) + 50,
        comments: Math.floor(Math.random() * 50) + 5,
        reach: Math.floor(Math.random() * 5000) + 1000
      };
      const metricsB = {
        likes: Math.floor(Math.random() * 500) + 50,
        comments: Math.floor(Math.random() * 50) + 5,
        reach: Math.floor(Math.random() * 5000) + 1000
      };

      const winner = metricsA.likes > metricsB.likes ? 'A' : 'B';
      
      // Jika ingin memanggil AI beneran untuk kesimpulan:
      // Karena menghemat waktu dan API call untuk setiap fetch, kita bisa pre-generate, 
      // atau generate on the fly jika ada flag ?generate_ai=true
      // Di sini kita sediakan mock/simpel conclusion untuk respons cepat.
      let conclusion = `Berdasarkan data simulasi, Varian ${winner} menunjukkan performa lebih tinggi dengan total likes terbanyak. Coba gunakan gaya caption serupa untuk postingan berikutnya.`;

      results.push({
        ab_test_id: abTestId,
        created_at: vA.created_at,
        status_a: vA.status,
        status_b: vB.status,
        variant_a: {
          id: vA.id,
          caption_snippet: vA.caption.substring(0, 100) + '...',
          image: vA.media_urls[0] || null,
          metrics: metricsA
        },
        variant_b: {
          id: vB.id,
          caption_snippet: vB.caption.substring(0, 100) + '...',
          image: vB.media_urls[0] || null,
          metrics: metricsB
        },
        winner,
        ai_conclusion: conclusion
      });
    }

    return NextResponse.json({ success: true, data: results })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
