import { createClient } from '@/lib/supabase/server'
import { generateJobCode } from '@/lib/utils/job-code'
import { NextResponse, type NextRequest } from 'next/server'

import { handleApiError } from '@/lib/utils/error-handler'
import { APP_TIMEZONE, isValidTimeZone } from '@/lib/utils/timezone'

type PostQueueInsert = {
  user_id: string
  job_code: string
  target_account_ids: string[]
  scheduled_at: string
  media_urls: string[]
  caption: string
  first_comment?: string
  post_type: string
  cover_url: string | null
  status: 'waiting'
  log_messages: unknown[]
  platform_captions?: Record<string, string>
  ab_test_id?: string
  ab_variant?: string
}

function isMissingColumnError(error: { message?: string; code?: string } | null, column: string) {
  if (!error) return false
  return error.code === 'PGRST204' || Boolean(error.message?.includes(`'${column}' column`) || error.message?.includes(`column "${column}"`))
}

async function insertPostQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  insertData: PostQueueInsert
) {
  const insertVariants: PostQueueInsert[] = [insertData]

  if (insertData.platform_captions) {
    const { platform_captions, ...withoutPlatformCaptions } = insertData
    insertVariants.push(withoutPlatformCaptions)
  }

  if (insertData.first_comment !== undefined) {
    const { first_comment, ...withoutFirstComment } = insertData
    insertVariants.push(withoutFirstComment)
  }

  if (insertData.platform_captions && insertData.first_comment !== undefined) {
    const { platform_captions, first_comment, ...minimalData } = insertData
    insertVariants.push(minimalData)
  }

  let lastError: { message?: string; code?: string } | null = null

  for (const variant of insertVariants) {
    const { data, error } = await supabase
      .from('post_queue')
      .insert([variant])
      .select()
      .single()

    if (!error) return { data, error: null }

    lastError = error
    const canFallback =
      ('platform_captions' in variant && isMissingColumnError(error, 'platform_captions')) ||
      ('first_comment' in variant && isMissingColumnError(error, 'first_comment'))

    if (!canFallback) {
      return { data: null, error }
    }
  }

  return { data: null, error: lastError }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const parsedLimit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)
  const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 500)
  const status = request.nextUrl.searchParams.get('status')
  const businessUnitId = request.nextUrl.searchParams.get('business_unit_id')
  let unitAccountIds: string[] | null = null

  if (businessUnitId) {
    const { data: unitData, error: unitError } = await supabase
      .from('business_units')
      .select('id')
      .eq('id', businessUnitId)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unitData) {
      return NextResponse.json({ error: 'Business unit not found or unauthorized' }, { status: 403 })
    }

    const { data: accounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('business_unit_id', businessUnitId)

    if (accountsError) {
      return NextResponse.json({ error: accountsError.message }, { status: 500 })
    }

    unitAccountIds = (accounts || []).map(account => account.id)
    if (unitAccountIds.length === 0) {
      return NextResponse.json([])
    }
  }
  
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

  if (unitAccountIds) {
    const filteredData = (data || []).filter(post => {
      const targetIds = Array.isArray(post.target_account_ids) ? post.target_account_ids : []
      return targetIds.some((id: string) => unitAccountIds.includes(id))
    })
    return NextResponse.json(filteredData)
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
      media_urls = [],
      caption, 
      first_comment,
      post_type, 
      cover_url,
      platform_captions,
      is_ab_test,
      caption_b,
      media_urls_b
    } = body

    if (!Array.isArray(target_account_ids) || target_account_ids.length === 0 || !scheduled_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedSchedule = new Date(scheduled_at)
    if (Number.isNaN(parsedSchedule.getTime())) {
      return NextResponse.json({ error: 'Tanggal jadwal tidak valid' }, { status: 400 })
    }

    if (!Array.isArray(media_urls) || media_urls.some(url => typeof url !== 'string' || !url.trim())) {
      return NextResponse.json({ error: 'Media tidak valid' }, { status: 400 })
    }

    if (is_ab_test && media_urls_b && (!Array.isArray(media_urls_b) || media_urls_b.some((url: any) => typeof url !== 'string' || !url.trim()))) {
      return NextResponse.json({ error: 'Media Varian B tidak valid' }, { status: 400 })
    }

    if ((post_type || 'single_image') !== 'carousel' && media_urls.length > 1) {
      return NextResponse.json({ error: 'Single post hanya boleh memakai 1 media' }, { status: 400 })
    }

    const uniqueTargetAccountIds = [...new Set(target_account_ids.filter((id: any) => typeof id === 'string'))]
    if (uniqueTargetAccountIds.length !== target_account_ids.length) {
      return NextResponse.json({ error: 'Invalid target account IDs' }, { status: 400 })
    }

    const { data: ownedAccounts, error: ownedAccountsError } = await supabase
      .from('social_accounts')
      .select('id, business_unit_id, platform, business_units!inner(user_id)')
      .in('id', uniqueTargetAccountIds)
      .eq('business_units.user_id', user.id)

    if (ownedAccountsError) {
      return NextResponse.json({ error: ownedAccountsError.message }, { status: 500 })
    }

    if (!ownedAccounts || ownedAccounts.length !== uniqueTargetAccountIds.length) {
      return NextResponse.json({ error: 'One or more target accounts are not owned by this user' }, { status: 403 })
    }

    if (ownedAccounts.some(account => account.platform === 'meta_ig') && media_urls.length === 0) {
      return NextResponse.json({ error: 'Instagram membutuhkan minimal 1 media untuk diposting' }, { status: 400 })
    }

    // Fase 5: Apply Variables
    let processedCaption = caption || '';
    let processedFirstComment = first_comment || '';
    let processedCaptionB = caption_b || '';

    // Ambil info Unit Bisnis dari akun pertama
    const accountInfo = ownedAccounts.find(account => account.id === uniqueTargetAccountIds[0])

    if (accountInfo) {
      const { data: unitInfo } = await supabase
        .from('business_units')
        .select('brand_name, custom_variables, timezone')
        .eq('id', accountInfo.business_unit_id)
        .single()

      if (unitInfo) {
        const vars = unitInfo.custom_variables || {};
        // Variables standar
        const defaultVars: Record<string, string> = {
          brand: unitInfo.brand_name,
          tanggal: new Date(scheduled_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: isValidTimeZone(unitInfo.timezone) ? unitInfo.timezone : APP_TIMEZONE })
        };
        const allVars = { ...vars, ...defaultVars };

        const replacer = (match: string, p1: string) => {
          const key = p1.trim();
          return allVars[key] !== undefined ? String(allVars[key]) : match;
        };

        processedCaption = processedCaption.replace(/\{([^}]+)\}/g, replacer);
        processedFirstComment = processedFirstComment.replace(/\{([^}]+)\}/g, replacer);
        if (processedCaptionB) processedCaptionB = processedCaptionB.replace(/\{([^}]+)\}/g, replacer);
      }
    }

    const job_code = generateJobCode()
    const sanitizedPlatformCaptions: Record<string, string> = {}
    if (platform_captions && typeof platform_captions === 'object' && !Array.isArray(platform_captions)) {
      for (const [accountId, value] of Object.entries(platform_captions)) {
        if (uniqueTargetAccountIds.includes(accountId) && typeof value === 'string' && value.trim()) {
          sanitizedPlatformCaptions[accountId] = value
        }
      }
    }

    const insertData: PostQueueInsert = {
      user_id: user.id,
      job_code,
      target_account_ids: uniqueTargetAccountIds,
      scheduled_at: parsedSchedule.toISOString(),
      media_urls,
      caption: processedCaption,
      first_comment: processedFirstComment,
      post_type: post_type || 'single_image',
      cover_url: cover_url || null,
      status: 'waiting',
      log_messages: []
    }

    if (Object.keys(sanitizedPlatformCaptions).length > 0) {
      insertData.platform_captions = sanitizedPlatformCaptions
    }

    if (is_ab_test && processedCaptionB) {
      // 1. Create AB Test Record
      const { data: abTestRecord, error: abTestError } = await supabase
        .from('ab_tests')
        .insert({
          user_id: user.id,
          business_unit_id: accountInfo?.business_unit_id || null,
          name: `A/B Test ${parsedSchedule.toISOString().split('T')[0]}`
        })
        .select('id')
        .single()
      if (abTestError) {
        return NextResponse.json({ error: 'Gagal membuat A/B test record: ' + abTestError.message }, { status: 500 })
      }
      
      const abTestId = abTestRecord.id;
      insertData.ab_test_id = abTestId;
      
      // 2. Insert Variant A
      const { data: dataA, error: errorA } = await insertPostQueue(supabase, { ...insertData, ab_variant: 'A' })
      if (errorA) {
        await supabase.from('ab_tests').delete().eq('id', abTestId).eq('user_id', user.id)
        return NextResponse.json({ error: errorA.message }, { status: 500 })
      }
      
      // 3. Insert Variant B (beda job_code dan caption)
      const { data: dataB, error: errorB } = await insertPostQueue(supabase, { 
        ...insertData, 
        job_code: generateJobCode(), 
        ab_variant: 'B',
        caption: processedCaptionB,
        media_urls: media_urls_b && media_urls_b.length > 0 ? media_urls_b : media_urls
      })
      if (errorB) {
        // Rollback agar tidak tersisa varian A tanpa pasangan
        await supabase.from('post_queue').delete().eq('id', dataA.id).eq('user_id', user.id)
        await supabase.from('ab_tests').delete().eq('id', abTestId).eq('user_id', user.id)
        return NextResponse.json({ error: errorB.message }, { status: 500 })
      }
      
      return NextResponse.json({ variantA: dataA, variantB: dataB, ab_test_id: abTestId }, { status: 201 })
    }

    // Normal single insert
    const { data, error } = await insertPostQueue(supabase, insertData)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
