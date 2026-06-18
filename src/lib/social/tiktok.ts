import { SocialAccount, PostJob } from './types';

import { logger } from '@/lib/utils/logger'
// TikTok Content Posting API
// Note: Requires a fully approved TikTok Developer App with 'video.publish' scope
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export async function publishToTikTok(account: SocialAccount, job: PostJob, idempotencyKey?: string) {
  try {
    if (job.post_type !== 'reels') {
      return { success: false, error: 'TikTok only supports video (reels) format' };
    }

    if (!job.media_urls || job.media_urls.length === 0) {
      return { success: false, error: 'Video URL is required for TikTok' };
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${account.access_token}`,
      'Content-Type': 'application/json'
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey; // H3 Fix: Idempotency Key
    }

    // Step 1: Initialize the upload via TikTok API
    let initRes;
    let data;
    let retries = 0;
    const maxRetries = 3;
    while (retries < maxRetries) {
      initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          post_info: {
            title: job.caption,
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: job.media_urls[0]
          }
        })
      });

      if (initRes.status >= 500 && initRes.status < 600) {
        retries++;
        if (retries === maxRetries) {
          throw new Error(`TikTok API Error: Server Error ${initRes.status} after ${maxRetries} retries`);
        }
        await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
        continue;
      }

      data = await initRes.json();
      if (!initRes.ok || data.error) {
        throw new Error(data.error?.message || `TikTok API Error: ${initRes.statusText}`);
      }
      break;
    }

    const publishId = data?.data?.publish_id || data?.data?.post_id;
    if (!publishId) {
       throw new Error('TikTok API did not return a valid publish_id.');
    }

    // Step 2: Poll status
    let isReady = false;
    let attempt = 0;
    const maxAttempts = 15;
    while (attempt < maxAttempts) {
      const waitTime = Math.min(5000 * Math.pow(1.5, attempt), 20000);
      await new Promise(r => setTimeout(r, waitTime));
      
      const statusRes = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ publish_id: publishId })
      });
      
      const statusData = await statusRes.json();
      const status = statusData?.data?.status;
      
      if (status === 'PUBLISH_COMPLETE') {
        isReady = true;
        break;
      } else if (status === 'FAILED') {
        throw new Error(`TikTok processing failed: ${statusData?.data?.fail_reason || 'Unknown error'}`);
      }
      attempt++;
    }

    if (!isReady) throw new Error('TikTok processing timed out after 15 attempts.');

    return { success: true, platform_post_id: publishId };
  } catch (err: unknown) {
    logger.error('TikTok Publish Error:', err);
    return { success: false, error: (err as Error).message };
  }
}
