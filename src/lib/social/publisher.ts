import { createServiceClient } from '@/lib/supabase/service';
import { decryptValue } from '@/lib/crypto/server';
import { publishToInstagram, validateInstagramToken } from './instagram';
import { publishToFacebook } from './facebook';
import { publishToTikTok } from './tiktok';
import { publishToThreads } from './threads';
import type { PostJob, SocialAccount } from './types';

export async function processQueue() {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const nowDate = new Date();
  const staleProcessingCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const diagnostic: Record<string, unknown> = {
    server_time: now,
    service_key_configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // 1. Check total waiting jobs (regardless of scheduled_at)
  const { count: totalWaiting, error: countError } = await supabase
    .from('post_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'waiting');

  diagnostic.total_waiting_jobs = countError ? `count error: ${countError.message}` : (totalWaiting || 0);

  // 2. Check all jobs with their scheduled times for debugging
  const { data: allPending, error: allErr } = await supabase
    .from('post_queue')
    .select('id, job_code, scheduled_at, status, retry_count, next_retry_at')
    .in('status', ['waiting', 'failed', 'processing'])
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (allPending && allPending.length > 0) {
    diagnostic.pending_jobs = allPending.map(j => ({
      job_code: j.job_code,
      status: j.status,
      scheduled_at: j.scheduled_at,
      is_due: new Date(j.scheduled_at) <= nowDate,
      retry_count: j.retry_count,
      next_retry_at: j.next_retry_at,
    }));
  } else {
    diagnostic.pending_jobs = allErr ? `query error: ${allErr.message}` : [];
  }

  // 3. Recover stale processing jobs
  const { data: staleProcessingJobs } = await supabase
    .from('post_queue')
    .select('id, retry_count, log_messages')
    .eq('status', 'processing')
    .lt('updated_at', staleProcessingCutoff)
    .limit(10);

  diagnostic.stale_processing_count = staleProcessingJobs?.length || 0;

  if (staleProcessingJobs && staleProcessingJobs.length > 0) {
    for (const staleJob of staleProcessingJobs) {
      const retryCount = staleJob.retry_count || 0;
      const shouldRetry = retryCount < 3;
      const logs = [
        ...(staleJob.log_messages || []),
        {
          time: new Date().toISOString(),
          message: shouldRetry
            ? 'Recovered stale processing job and returned it to waiting queue.'
            : 'Recovered stale processing job and marked it failed after max retries.'
        }
      ];

      await supabase
        .from('post_queue')
        .update({
          status: shouldRetry ? 'waiting' : 'failed',
          retry_count: shouldRetry ? retryCount + 1 : retryCount,
          next_retry_at: shouldRetry ? now : null,
          log_messages: logs,
          updated_at: new Date().toISOString()
        })
        .eq('id', staleJob.id)
        .eq('status', 'processing');
    }
  }

  // 4. Fetch jobs that are due — split into two queries to avoid PostgREST .or() parsing issues
  const { data: jobsNullRetry, error: nullErr } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'waiting')
    .lte('scheduled_at', now)
    .is('next_retry_at', null)
    .limit(5);

  if (nullErr) {
    diagnostic.query_error = nullErr.message;
    throw new Error(`Query post_queue (null retry) gagal: ${nullErr.message}`);
  }

  const { data: jobsDueRetry, error: dueErr } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'waiting')
    .lte('scheduled_at', now)
    .lte('next_retry_at', now)
    .limit(5);

  if (dueErr) {
    diagnostic.query_error = dueErr.message;
    throw new Error(`Query post_queue (due retry) gagal: ${dueErr.message}`);
  }

  const seen = new Set<string>();
  const waitingJobs = [...(jobsNullRetry || []), ...(jobsDueRetry || [])]
    .filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; })
    .slice(0, 5);

  if (waitingJobs.length === 0) {
    return { processed: 0, jobs: [], diagnostic };
  }

  const results = [];

  for (const dbJob of waitingJobs) {
    const { data: lockedJob, error: lockError } = await supabase
      .from('post_queue')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', dbJob.id)
      .eq('status', 'waiting')
      .select()
      .single();

    if (lockError || !lockedJob) {
      continue;
    }

    const job: PostJob = lockedJob;
    let allSuccess = true;
    let anySuccess = false;
    const logs = [...job.log_messages];

    const { data: accountsData } = await supabase
      .from('social_accounts')
      .select('*')
      .in('id', job.target_account_ids);

    if (accountsData && accountsData.length > 0) {
      for (const accountDb of accountsData) {
        try {
          const platformCaption = (job.platform_captions && typeof job.platform_captions === 'object' && !Array.isArray(job.platform_captions))
            ? (job.platform_captions as Record<string, string>)[accountDb.id] || job.caption
            : job.caption;

          const platformJob: PostJob = { ...job, caption: platformCaption };

          const decryptedToken = decryptValue(accountDb.access_token_encrypted);
          const account: SocialAccount = {
            id: accountDb.id,
            business_unit_id: accountDb.business_unit_id,
            platform: accountDb.platform,
            ig_user_id: accountDb.ig_user_id,
            access_token: decryptedToken
          };

          // Token diagnostic: show masked preview
          const tokenPreview = decryptedToken
            ? decryptedToken.substring(0, 8) + '...' + decryptedToken.substring(decryptedToken.length - 4)
            : '(empty)';
          const accountTag = { token_preview: tokenPreview, token_length: decryptedToken?.length || 0 };

          if (account.platform === 'meta_ig') {
            // Validate token before attempting publish
            const validation = await validateInstagramToken(decryptedToken, accountDb.ig_user_id);
            if (!validation.valid) {
              // Try to auto-discover correct IG ID if current one fails
              let discoveredId: string | null = null;
              try {
                const pagesRes = await fetch(
                  `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${decryptedToken}`,
                  { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
                );
                const pagesData = await pagesRes.json();
                const pages = pagesData?.data || [];
                const firstIG = pages.find((p: { instagram_business_account?: { id: string } }) => p.instagram_business_account?.id);
                if (firstIG) discoveredId = firstIG.instagram_business_account!.id;
              } catch { /* ignore */ }

              let suggestion = validation.suggestion || validation.error;
              if (discoveredId && discoveredId !== accountDb.ig_user_id) {
                suggestion = `ID Instagram tersimpan (${accountDb.ig_user_id}) tidak valid untuk token ini. ID yang benar: ${discoveredId}. Silakan reconnect akun di Settings → Akun Sosial.`;
              } else if (!discoveredId) {
                suggestion = 'Token tidak bisa mengakses Instagram account manapun. Pastikan akun Instagram Professional terhubung ke Facebook Page.';
              }

              logs.push({
                account_id: account.id,
                platform: 'instagram',
                time: new Date().toISOString(),
                success: false,
                error: validation.error,
                suggestion,
                discovered_ig_id: discoveredId,
                stored_ig_id: accountDb.ig_user_id,
                ...accountTag,
              });
              allSuccess = false;
              continue;
            }
            if (validation.suggestion) {
              logs.push({
                account_id: account.id,
                platform: 'instagram',
                time: new Date().toISOString(),
                success: false,
                error: validation.suggestion,
                account_type: validation.account_type,
                ...accountTag,
              });
              allSuccess = false;
              continue;
            }
            const res = await publishToInstagram(account, platformJob);
            logs.push({ account_id: account.id, platform: 'instagram', time: new Date().toISOString(), ...res, ...accountTag });
            if (res.success) anySuccess = true;
            else allSuccess = false;
          } else if (account.platform === 'facebook') {
            const res = await publishToFacebook(account, platformJob);
            logs.push({ account_id: account.id, platform: 'facebook', time: new Date().toISOString(), ...res, ...accountTag });
            if (res.success) anySuccess = true;
            else allSuccess = false;
          } else if (account.platform === 'tiktok') {
            const res = await publishToTikTok(account, platformJob);
            logs.push({ account_id: account.id, platform: 'tiktok', time: new Date().toISOString(), ...res, ...accountTag });
            if (res.success) anySuccess = true;
            else allSuccess = false;
          } else if (account.platform === 'threads') {
            const res = await publishToThreads(account, platformJob);
            logs.push({ account_id: account.id, platform: 'threads', time: new Date().toISOString(), ...res, ...accountTag });
            if (res.success) anySuccess = true;
            else allSuccess = false;
          } else {
            logs.push({ account_id: accountDb.id, platform: accountDb.platform, time: new Date().toISOString(), success: false, error: 'Platform not yet implemented' });
            allSuccess = false;
          }
        } catch (err: unknown) {
          logs.push({ account_id: accountDb.id, platform: accountDb.platform, time: new Date().toISOString(), success: false, error: (err as Error).message });
          allSuccess = false;
        }
      }
    } else {
      logs.push({ time: new Date().toISOString(), success: false, error: 'No valid target accounts found' });
      allSuccess = false;
    }

    let finalStatus = 'failed';
    let retryCount = job.retry_count || 0;
    let nextRetryAt = null;
    const skippedAccounts = logs.filter((l: Record<string, unknown>) => l.skipped).length;
    const realAccounts = logs.filter((l: Record<string, unknown>) => l.platform && !l.skipped).length;
    const onlySkipped = skippedAccounts > 0 && realAccounts === 0;

    if (onlySkipped) {
      finalStatus = 'skipped';
      logs.push({ time: new Date().toISOString(), message: 'Semua akun di-skip (belum didukung). Tidak perlu retry.' });
    } else if (allSuccess && anySuccess) {
      finalStatus = 'success';
    } else if (anySuccess) {
      finalStatus = 'partial';
    } else {
      if (retryCount < 3) {
        finalStatus = 'waiting';
        retryCount += 1;
        const backoffMinutes = Math.pow(2, retryCount) * 5;
        nextRetryAt = new Date(Date.now() + backoffMinutes * 60000).toISOString();
        logs.push({ time: new Date().toISOString(), message: `Job failed, retrying at ${nextRetryAt} (Attempt ${retryCount}/3)` });
      } else {
        finalStatus = 'failed';
        logs.push({ time: new Date().toISOString(), message: 'Job failed permanently after 3 retries.' });
      }
    }

    await supabase
      .from('post_queue')
      .update({ 
        status: finalStatus, 
        log_messages: logs, 
        retry_count: retryCount,
        next_retry_at: nextRetryAt,
        updated_at: new Date().toISOString() 
      })
      .eq('id', job.id);

    // Build per-account error summary
    const perAccountErrors = logs
      .filter((l: Record<string, unknown>) => l.platform && l.success === false && !l.skipped)
      .map((l: Record<string, unknown>) => ({
        platform: l.platform,
        error: l.error,
        token_preview: l.token_preview,
        token_length: l.token_length,
      }));

    const lastAttemptLog = logs.slice().reverse().find((l: Record<string, unknown>) => l.success === false && l.error && !l.skipped);
    results.push({
      job: job.job_code,
      status: finalStatus,
      retry_count: finalStatus === 'waiting' ? retryCount : undefined,
      error: lastAttemptLog ? String(lastAttemptLog.error || 'Unknown error') : undefined,
      token_preview: lastAttemptLog?.token_preview,
      accounts: perAccountErrors.length > 0 ? perAccountErrors : undefined,
      skipped: skippedAccounts > 0 ? skippedAccounts : undefined,
    });
  }

  diagnostic.processed_count = results.length;
  return { processed: results.length, jobs: results, diagnostic };
}
