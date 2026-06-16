import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
