import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token } = body

    if (!access_token) {
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
    const pagesRes = await fetch(
      'https://graph.facebook.com/v25.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=' + access_token,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    )
    const pagesData = await pagesRes.json()

    if (!pagesRes.ok || pagesData.error) {
      return NextResponse.json({
        error: pagesData.error?.message || 'Gagal mengambil daftar Facebook Pages',
        pages: [],
      }, { status: pagesRes.status })
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
