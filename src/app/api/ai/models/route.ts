import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate Limiting: 10 request per menit
  const rateLimitKey = getRateLimitIdentifier(request, user.id)
  if (!checkRateLimit(rateLimitKey, 'ai-models', 20, 60000)) {
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
    } catch {
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

    // Anthropic memakai header x-api-key + anthropic-version, bukan Bearer
    const headers: Record<string, string> = parsedUrl.hostname === 'api.anthropic.com'
      ? { 'x-api-key': api_key, 'anthropic-version': '2023-06-01' }
      : { 'Authorization': `Bearer ${api_key}` }

    const res = await fetch(fetchUrl, { headers })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch models from provider' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
