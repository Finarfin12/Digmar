import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { base_url, api_key } = await request.json()
    
    if (!base_url || !api_key) {
      return NextResponse.json({ error: 'Missing base_url or api_key' }, { status: 400 })
    }

    // Clean trailing slash
    const cleanBaseUrl = base_url.replace(/\/$/, '')
    
    // Fetch models
    const res = await fetch(`${cleanBaseUrl}/v1/models`, {
      headers: { 'Authorization': `Bearer ${api_key}` }
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch models from provider' }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
