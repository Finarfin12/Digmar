import { SocialAccount, PostJob } from './types';

// TikTok Content Posting API
// Note: Requires a fully approved TikTok Developer App with 'video.publish' scope
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export async function publishToTikTok(account: SocialAccount, job: PostJob) {
  try {
    if (job.post_type !== 'reels') {
      return { success: false, error: 'TikTok only supports video (reels) format' };
    }

    if (!job.media_urls || job.media_urls.length === 0) {
      return { success: false, error: 'Video URL is required for TikTok' };
    }

    // Step 1: Initialize the upload via TikTok API
    const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      },
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

    const data = await initRes.json();
    
    if (!initRes.ok || data.error) {
      throw new Error(data.error?.message || `TikTok API Error: ${initRes.statusText}`);
    }

    // Since we use PULL_FROM_URL, TikTok servers will download the video themselves.
    // The publish ID is returned immediately.
    const publishId = data.data?.publish_id || data.data?.post_id || 'tiktok_pending_id';

    return { success: true, platform_post_id: publishId };
  } catch (err: unknown) {
    console.error('TikTok Publish Error:', err);
    return { success: false, error: (err as Error).message };
  }
}
