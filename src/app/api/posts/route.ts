import { createClient } from '@/lib/supabase/server'
import { generateJobCode } from '@/lib/utils/job-code'
import { NextResponse, type NextRequest } from 'next/server'

import { handleApiError } from '@/lib/utils/error-handler'
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
  const status = request.nextUrl.searchParams.get('status')
  
  let query = supabase
    .from('post_queue')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { 
      target_account_ids, 
      scheduled_at, 
      media_urls, 
      caption, 
      first_comment,
      post_type, 
      cover_url,
      platform_captions 
    } = body

    if (!Array.isArray(target_account_ids) || target_account_ids.length === 0 || !scheduled_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const uniqueTargetAccountIds = [...new Set(target_account_ids.filter(id => typeof id === 'string'))]
    if (uniqueTargetAccountIds.length !== target_account_ids.length) {
      return NextResponse.json({ error: 'Invalid target account IDs' }, { status: 400 })
    }

    const { data: ownedAccounts, error: ownedAccountsError } = await supabase
      .from('social_accounts')
      .select('id, business_unit_id, business_units!inner(user_id)')
      .in('id', uniqueTargetAccountIds)
      .eq('business_units.user_id', user.id)

    if (ownedAccountsError) {
      return NextResponse.json({ error: ownedAccountsError.message }, { status: 500 })
    }

    if (!ownedAccounts || ownedAccounts.length !== uniqueTargetAccountIds.length) {
      return NextResponse.json({ error: 'One or more target accounts are not owned by this user' }, { status: 403 })
    }

    // Fase 5: Apply Variables
    let processedCaption = caption || '';
    let processedFirstComment = first_comment || '';

    // Ambil info Unit Bisnis dari akun pertama
    const accountInfo = ownedAccounts.find(account => account.id === uniqueTargetAccountIds[0])

    if (accountInfo) {
      const { data: unitInfo } = await supabase
        .from('business_units')
        .select('brand_name, custom_variables')
        .eq('id', accountInfo.business_unit_id)
        .single()

      if (unitInfo) {
        const vars = unitInfo.custom_variables || {};
        // Variables standar
        const defaultVars: Record<string, string> = {
          brand: unitInfo.brand_name,
          tanggal: new Date(scheduled_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        };
        const allVars = { ...vars, ...defaultVars };

        const replacer = (match: string, p1: string) => {
          const key = p1.trim();
          return allVars[key] !== undefined ? String(allVars[key]) : match;
        };

        processedCaption = processedCaption.replace(/\{([^}]+)\}/g, replacer);
        processedFirstComment = processedFirstComment.replace(/\{([^}]+)\}/g, replacer);
      }
    }

    const job_code = generateJobCode()

    const { data, error } = await supabase
      .from('post_queue')
      .insert([
        {
          user_id: user.id,
          job_code,
          target_account_ids: uniqueTargetAccountIds,
          scheduled_at,
          media_urls: media_urls || [],
          caption: processedCaption,
          first_comment: processedFirstComment,
          post_type: post_type || 'single_image',
          cover_url: cover_url || null,
          status: 'waiting',
          log_messages: [],
          platform_captions: platform_captions || {}
        }
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
