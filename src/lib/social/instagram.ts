import { SocialAccount, PostJob } from './types';

import { logger } from '@/lib/utils/logger'
const INSTAGRAM_API_VERSION = process.env.INSTAGRAM_API_VERSION || 'v25.0';

async function fetchInstagram(path: string, token: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, string | number | boolean | undefined | null>) {
  const url = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}/${path}`;
  
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };
  
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  let searchParams = '';
  if (method === 'GET' && body) {
    const stringBody: Record<string, string> = {};
    for (const key in body) {
      if (body[key] !== undefined) stringBody[key] = String(body[key]);
    }
    searchParams = '?' + new URLSearchParams(stringBody);
  }

  const response = await fetch(url + searchParams, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Instagram API Error: ${response.statusText}`);
  }
  return data;
}

export async function publishToInstagram(account: SocialAccount, job: PostJob) {
  try {
    let containerId: string;

    if (job.post_type === 'single_image') {
      const res = await fetchInstagram(`${account.ig_user_id}/media`, account.access_token, 'POST', {
        image_url: job.media_urls[0],
        caption: job.caption
      });
      containerId = res.id;
    } else if (job.post_type === 'carousel') {
      const childIds = [];
      for (let i = 0; i < job.media_urls.length; i++) {
        const res = await fetchInstagram(`${account.ig_user_id}/media`, account.access_token, 'POST', {
        image_url: job.media_urls[i],
        is_carousel_item: true
        });
        childIds.push(res.id);
      }
      
      const carouselRes = await fetchInstagram(`${account.ig_user_id}/media`, account.access_token, 'POST', {
        caption: job.caption,
        media_type: 'CAROUSEL',
        children: childIds.join(',')
      });
      containerId = carouselRes.id;
    } else if (job.post_type === 'reels') {
      const res = await fetchInstagram(`${account.ig_user_id}/media`, account.access_token, 'POST', {
        video_url: job.media_urls[0],
        caption: job.caption,
        media_type: 'REELS',
        cover_url: job.cover_url
      });
      containerId = res.id;
      
      // Exponential backoff polling for Reels processing status
      let isReady = false;
      let attempt = 0;
      const maxAttempts = 15; // Up to ~2-3 minutes total wait
      while (attempt < maxAttempts) {
        const waitTime = Math.min(5000 * Math.pow(1.5, attempt), 20000); // Caps at 20s per check
        await new Promise(r => setTimeout(r, waitTime));
        const statusRes = await fetchInstagram(`${containerId}?fields=status_code`, account.access_token);
        if (statusRes.status_code === 'FINISHED') {
          isReady = true;
          break;
        } else if (statusRes.status_code === 'ERROR') {
          throw new Error('Reels processing failed on Instagram.');
        }
        attempt++;
      }
      if (!isReady) throw new Error('Reels processing timed out after 15 attempts.');
    } else {
      throw new Error(`Unsupported post type: ${job.post_type}`);
    }

    // Publish container
    const publishRes = await fetchInstagram(`${account.ig_user_id}/media_publish`, account.access_token, 'POST', {
      creation_id: containerId
    });

    // Fase 4: First Comment
    if (job.first_comment) {
      try {
        await fetchInstagram(`${publishRes.id}/comments`, account.access_token, 'POST', {
          message: job.first_comment
        });
      } catch (commentErr) {
        logger.error('Failed to post first comment:', commentErr);
        // Continue and return success for the main post even if comment fails
      }
    }

    return { success: true, id: publishRes.id };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
