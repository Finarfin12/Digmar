import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { decryptValue } from '@/lib/crypto/server'
import { handleApiError } from '@/lib/utils/error-handler'
import { fetchInstagramTopPosts, type TopPost } from '@/lib/social/analytics'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const account_id = searchParams.get('account_id')

  if (!account_id) {
    return NextResponse.json({ error: 'account_id required' }, { status: 400 })
  }

  try {
    const { data: account, error: accErr } = await supabase
      .from('social_accounts')
      .select('*, business_units!inner(user_id)')
      .eq('id', account_id)
      .eq('business_units.user_id', user.id)
      .single()

    if (accErr || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    let posts: TopPost[] = [];

    if (account.platform === 'meta_ig') {
      const token = decryptValue(account.access_token_encrypted);
      posts = await fetchInstagramTopPosts(account.ig_user_id, token, 10);
    }

    return NextResponse.json({ success: true, data: posts })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
