import { SocialAccount, PostJob } from './types';

const INSTAGRAM_API_VERSION = process.env.INSTAGRAM_API_VERSION || 'v25.0';

async function fetchInstagram(path: string, token: string, method: 'GET' | 'POST' = 'GET', body?: any) {
  const url = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}/${path}`;
  
  const headers: any = {
    Authorization: `Bearer ${token}`
  };
  
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url + (method === 'GET' && body ? '?' + new URLSearchParams({ ...body }) : ''), {
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
      for (const url of job.media_urls) {
        const res = await fetchInstagram(`${account.ig_user_id}/media`, account.access_token, 'POST', {
          image_url: url,
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
      
      // Basic polling for Reels processing status
      let isReady = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetchInstagram(`${containerId}?fields=status_code`, account.access_token);
        if (statusRes.status_code === 'FINISHED') {
          isReady = true;
          break;
        } else if (statusRes.status_code === 'ERROR') {
          throw new Error('Reels processing failed on Instagram.');
        }
      }
      if (!isReady) throw new Error('Reels processing timed out.');
    } else {
      throw new Error(`Unsupported post type: ${job.post_type}`);
    }

    // Publish container
    const publishRes = await fetchInstagram(`${account.ig_user_id}/media_publish`, account.access_token, 'POST', {
      creation_id: containerId
    });

    return { success: true, id: publishRes.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
