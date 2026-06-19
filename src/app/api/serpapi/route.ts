import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { getAIProvider } from '@/lib/ai/factory'
import { handleApiError } from '@/lib/utils/error-handler'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { business_unit_id, search_type, query, platform = 'instagram' } = await request.json()

    if (!business_unit_id || !search_type || !query) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('id, use_serpapi, serpapi_key')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    if (!unit.use_serpapi) {
      return NextResponse.json({ error: 'SerpApi is disabled for this unit' }, { status: 403 })
    }

    const apiKey = unit.serpapi_key || process.env.SERPAPI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SerpApi Key is missing' }, { status: 400 })
    }

    // Phase 1: Check Limit Circuit Breaker (250/month)
    const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM
    const { count, error: countError } = await supabase
      .from('api_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('business_unit_id', business_unit_id)
      .eq('month_key', monthKey)
      .eq('api_name', 'serpapi')

    if (countError) throw countError

    if (count !== null && count >= 250) {
      return NextResponse.json({ 
        error: 'Limit Reached', 
        message: 'Limit 250 pencarian SerpApi bulan ini telah habis.' 
      }, { status: 429 })
    }

    // Phase 2: Check Cache (Valid for 24 hours)
    const { data: cache } = await supabase
      .from('serpapi_caches')
      .select('*')
      .eq('business_unit_id', business_unit_id)
      .eq('search_type', search_type)
      .eq('query', query)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cache) {
      return NextResponse.json({ success: true, cached: true, data: cache.result_data })
    }

    // Phase 3: Fetch from SerpApi
    let serpApiUrl = ''
    if (search_type === 'trends') {
      serpApiUrl = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(query)}&geo=ID&api_key=${apiKey}`
    } else if (search_type === 'hashtag') {
      serpApiUrl = `https://serpapi.com/search.json?engine=google_autocomplete&q=${encodeURIComponent(query)}&gl=id&hl=id&api_key=${apiKey}`
    } else if (search_type === 'competitor') {
      const site = platform === 'tiktok' ? 'tiktok.com' : 'instagram.com'
      const searchQ = `site:${site} "@${query}"`
      serpApiUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQ)}&api_key=${apiKey}`
    } else {
      return NextResponse.json({ error: 'Invalid search type' }, { status: 400 })
    }

    const serpRes = await fetch(serpApiUrl)
    const serpData = await serpRes.json()

    if (!serpRes.ok) {
      throw new Error(serpData.error || 'Failed to fetch from SerpApi')
    }

    let resultData = serpData

    // Phase 3.5: Generate AI Summary
    if (search_type === 'competitor' && serpData.organic_results) {
      const snippets = serpData.organic_results.map((r: any) => r.title + '\n' + r.snippet).join('\n\n')
      if (snippets.trim()) {
        const { client } = await getAIProvider(user.id)
        const prompt = `Berdasarkan hasil pencarian Google berikut untuk kompetitor @${query}:\n\n${snippets}\n\nAnalisis pola konten apa yang sering dibuat oleh kompetitor ini, apa yang menarik perhatian audiens, dan berikan ringkasan strategi konten mereka.`
        try {
          const aiRes = await client.generateText('Anda adalah analis media sosial.', prompt, { maxTokens: 800 })
          resultData = {
            organic_results: serpData.organic_results,
            ai_summary: aiRes.content
          }
        } catch (e) {
          console.error("AI Summary failed for competitor", e)
        }
      }
    } else if (search_type === 'trends') {
      const trendQueries = serpData.trending_searches?.map((t: any) => t.query).join(', ') || 'Tren umum'
      const { client } = await getAIProvider(user.id)
      const prompt = `Berdasarkan tren pencarian Google berikut: ${trendQueries}. 
Buat JSON dengan format:
{
  "topik_utama_hari_ini": "Ringkasan 1 kalimat topik yang sedang viral",
  "ide_konten": [
    { "judul": "Ide 1", "tipe": "edukasi/hiburan", "deskripsi": "Detail ide konten", "format": "Video Pendek/Karousel" }
  ]
}
Ide harus relevan dengan bisnis kategori: ${unit.business_category} (${unit.brand_name}).
Kembalikan HANYA JSON valid tanpa markdown \`\`\`json.`;
      try {
        const aiRes = await client.generateText('Anda adalah content planner handal.', prompt, { maxTokens: 1000 })
        const parsed = JSON.parse(aiRes.content.replace(/```json|```/g, '').trim())
        resultData = {
          ...parsed,
          sources: serpData.trending_searches?.map((t: any) => ({
            title: t.query,
            platform: 'google_trends',
            icon: 'globe2',
            date: new Date().toISOString(),
            link: t.explore_link || 'https://trends.google.com'
          })) || []
        }
      } catch (e) {
        console.error("AI Trends Summary failed", e)
      }
    } else if (search_type === 'hashtag') {
      const suggestions = serpData.suggestions?.map((s: any) => s.value).join(', ') || 'Hashtag umum'
      const { client } = await getAIProvider(user.id)
      const prompt = `Berdasarkan saran pencarian Google Autocomplete berikut untuk topik "${query}": ${suggestions}.
Buat JSON dengan format:
{
  "hashtags": { "high": ["#tag1"], "medium": ["#tag2"], "niche": ["#tag3"] },
  "instagram_safe": ["#tag1"],
  "tiktok_trending": ["#tag1"],
  "seo_keywords": ["keyword 1"]
}
Ide harus relevan dengan bisnis kategori: ${unit.business_category} (${unit.brand_name}).
Kembalikan HANYA JSON valid tanpa markdown \`\`\`json.`;
      try {
        const aiRes = await client.generateText('Anda adalah pakar SEO dan Sosial Media.', prompt, { maxTokens: 1000 })
        const parsed = JSON.parse(aiRes.content.replace(/```json|```/g, '').trim())
        resultData = {
          ...parsed,
          sources: serpData.suggestions?.map((s: any) => ({
            title: s.value,
            platform: 'google_trends',
            icon: 'globe2',
            date: new Date().toISOString(),
            link: `https://www.google.com/search?q=${encodeURIComponent(s.value)}`
          })) || []
        }
      } catch (e) {
        console.error("AI Hashtag Summary failed", e)
      }
    }

    // Phase 4: Save Usage Log
    await supabase.from('api_usage_logs').insert({
      business_unit_id,
      api_name: 'serpapi',
      endpoint: search_type,
      month_key: monthKey
    })

    // Phase 5: Save Cache
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hours cache

    await supabase.from('serpapi_caches').insert({
      business_unit_id,
      search_type,
      query,
      result_data: resultData,
      expires_at: expiresAt.toISOString()
    })

    return NextResponse.json({ success: true, cached: false, data: resultData })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
