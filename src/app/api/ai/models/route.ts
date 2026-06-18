import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit } from '@/lib/utils/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate Limiting: 10 request per menit
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
  if (!checkRateLimit(ip, 'ai-models', 10, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { base_url, api_key } = await request.json()
    
    if (!base_url || !api_key) {
      return NextResponse.json({ error: 'Missing base_url or api_key' }, { status: 400 })
    }

    // Validate domain to prevent SSRF
    let parsedUrl;
    try {
      parsedUrl = new URL(base_url);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid base_url format' }, { status: 400 });
    }

    const allowedDomains = ['api.groq.com', 'api.openai.com', 'openrouter.ai', 'api.anthropic.com'];
    if (!allowedDomains.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`))) {
      return NextResponse.json({ error: 'base_url domain not allowed' }, { status: 403 });
    }

    // Clean trailing slash
    const cleanBaseUrl = base_url.replace(/\/$/, '')
    
    // Fetch models (base_url already includes /v1 typically)
    const fetchUrl = cleanBaseUrl.endsWith('/v1') ? `${cleanBaseUrl}/models` : `${cleanBaseUrl}/v1/models`

    const res = await fetch(fetchUrl, {
      headers: { 'Authorization': `Bearer ${api_key}` }
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch models from provider' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
