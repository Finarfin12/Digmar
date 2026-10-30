import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { GRAPH_BASE_URL } from '@/lib/social/graph'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { access_token } = body

    if (!access_token || typeof access_token !== 'string') {
      return NextResponse.json({ error: 'access_token wajib diisi' }, { status: 400 })
    }

    const results: Array<{
      page_id: string
      page_name: string
      ig_business_account_id: string | null
      ig_username: string | null
      error?: string
    }> = []

    // Step 1: Get Facebook Pages
    const pagesUrl = new URL(`${GRAPH_BASE_URL}/me/accounts`)
    pagesUrl.searchParams.set('fields', 'id,name,instagram_business_account{id,username}')
    pagesUrl.searchParams.set('access_token', access_token.trim())

    const pagesRes = await fetch(pagesUrl,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    )
    const pagesData = await pagesRes.json()

    if (!pagesRes.ok || pagesData.error) {
      return NextResponse.json({
        error: pagesData.error?.message || 'Gagal mengambil daftar Facebook Pages',
        pages: [],
      }, { status: pagesRes.ok ? 400 : pagesRes.status })
    }

    const pages = pagesData.data || []

    for (const page of pages) {
      const igAccount = page.instagram_business_account
      results.push({
        page_id: page.id,
        page_name: page.name,
        ig_business_account_id: igAccount?.id || null,
        ig_username: igAccount?.username || null,
        error: !igAccount ? 'Facebook Page ini belum terhubung ke Instagram Business Account' : undefined,
      })
    }

    return NextResponse.json({ pages: results })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
