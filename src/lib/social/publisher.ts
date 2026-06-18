import { createServiceClient } from '@/lib/supabase/service';
import { decryptValue } from '@/lib/crypto/server';
import { publishToInstagram } from './instagram';
import { publishToFacebook } from './facebook';
import { publishToTikTok } from './tiktok';
import type { PostJob, SocialAccount } from './types';

export async function processQueue() {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: waitingJobs, error: fetchError } = await supabase
    .from('post_queue')
    .select('*')
    .eq('status', 'waiting')
    .lte('scheduled_at', now)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .limit(5);

  if (fetchError || !waitingJobs || waitingJobs.length === 0) {
    return { processed: 0, jobs: [] };
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
          const account: SocialAccount = {
            id: accountDb.id,
            business_unit_id: accountDb.business_unit_id,
            platform: accountDb.platform,
            ig_user_id: accountDb.ig_user_id,
            access_token: decryptValue(accountDb.access_token_encrypted)
          };

          if (account.platform === 'meta_ig') {
            const res = await publishToInstagram(account, job, job.id); // H3 Fix: Idempotency Key
            logs.push({ account_id: account.id, time: new Date().toISOString(), ...res });
            if (res.success) anySuccess = true;
            else allSuccess = false;
          } else if (account.platform === 'facebook') {
            const res = await publishToFacebook(account, job, job.id); // H3 Fix: Idempotency Key
            logs.push({ account_id: account.id, time: new Date().toISOString(), ...res });
            if (res.success) anySuccess = true;
            else allSuccess = false;
          } else if (account.platform === 'tiktok') {
            const res = await publishToTikTok(account, job, job.id); // H3 Fix: Idempotency Key
            logs.push({ account_id: account.id, time: new Date().toISOString(), ...res });
            if (res.success) anySuccess = true;
            else allSuccess = false;
          } else if (account.platform === 'threads') {
            // Placeholder for Threads API integration
            logs.push({ account_id: account.id, time: new Date().toISOString(), success: false, error: 'Threads API not yet fully implemented' });
            allSuccess = false;
          } else {
            logs.push({ account_id: accountDb.id, time: new Date().toISOString(), success: false, error: 'Platform not yet implemented' });
            allSuccess = false;
          }
        } catch (err: unknown) {
          logs.push({ account_id: accountDb.id, time: new Date().toISOString(), success: false, error: (err as Error).message });
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

    if (allSuccess && anySuccess) {
      finalStatus = 'success';
    } else if (anySuccess) {
      finalStatus = 'partial';
    } else {
      // Exponential backoff retry logic (max 3 retries)
      if (retryCount < 3) {
        finalStatus = 'waiting';
        retryCount += 1;
        const backoffMinutes = Math.pow(2, retryCount) * 5; // 10m, 20m, 40m
        nextRetryAt = new Date(Date.now() + backoffMinutes * 60000).toISOString();
        logs.push({ time: new Date().toISOString(), message: `Job failed, retrying at ${nextRetryAt} (Attempt ${retryCount}/3)` });
      } else {
        finalStatus = 'failed';
        logs.push({ time: new Date().toISOString(), message: `Job failed permanently after 3 retries.` });
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

    results.push({ job: job.job_code, status: finalStatus });
  }

  return { processed: results.length, jobs: results };
}
