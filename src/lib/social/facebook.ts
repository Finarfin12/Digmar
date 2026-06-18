import { SocialAccount, PostJob } from './types';

const FB_API_VERSION = process.env.FB_API_VERSION || 'v25.0';

async function fetchFacebook(path: string, token: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, string | number | boolean | undefined | null>, idempotencyKey?: string) {
  const url = `https://graph.facebook.com/${FB_API_VERSION}/${path}`;
  
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };
  
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey; // H3 Fix: Idempotency Key
    }
  }

  let searchParams = '';
  if (method === 'GET' && body) {
    const stringBody: Record<string, string> = {};
    for (const key in body) {
      if (body[key] !== undefined && body[key] !== null) stringBody[key] = String(body[key]);
    }
    searchParams = '?' + new URLSearchParams(stringBody);
  }

  let retries = 0;
  const maxRetries = 3;
  while (retries < maxRetries) {
    const response = await fetch(url + searchParams, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body) : undefined
    });
    
    if (response.status >= 500 && response.status < 600) {
      retries++;
      if (retries === maxRetries) {
        throw new Error(`Facebook API Error: Server Error ${response.status} after ${maxRetries} retries`);
      }
      await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
      continue;
    }

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || `Facebook API Error: ${response.statusText}`);
    }
    
    return data;
  }
}

export async function publishToFacebook(account: SocialAccount, job: PostJob, idempotencyKey?: string) {
  try {
    const pageId = account.ig_user_id; // For Facebook, we store Page ID here
    let postId: string;

    if (job.post_type === 'single_image' && job.media_urls && job.media_urls.length > 0) {
      // Single Image
      const res = await fetchFacebook(`${pageId}/photos`, account.access_token, 'POST', {
        url: job.media_urls[0],
        message: job.caption,
        published: true
      }, idempotencyKey ? `${idempotencyKey}-photo` : undefined);
      postId = res.id;
    } else if (job.post_type === 'carousel' && job.media_urls && job.media_urls.length > 0) {
      // Multiple Images (Facebook doesn't have a strict carousel like IG, but we can post multiple photos to a feed post)
      // Usually requires uploading unpublished photos first, then attaching them.
      // For simplicity, we fallback to uploading the first image if multi-image API is too complex, 
      // or we can implement the Facebook multi-photo post:
      const attachedMedia = [];
      for (let i = 0; i < job.media_urls.length; i++) {
        const photoRes = await fetchFacebook(`${pageId}/photos`, account.access_token, 'POST', {
          url: job.media_urls[i],
          published: false
        }, idempotencyKey ? `${idempotencyKey}-photo-${i}` : undefined);
        attachedMedia.push({ media_fbid: photoRes.id });
      }
      
      const res = await fetchFacebook(`${pageId}/feed`, account.access_token, 'POST', {
        message: job.caption,
        attached_media: attachedMedia as any // passing array of objects
      }, idempotencyKey ? `${idempotencyKey}-feed` : undefined);
      postId = res.id;
    } else if (job.post_type === 'reels' && job.media_urls && job.media_urls.length > 0) {
      // Video
      const res = await fetchFacebook(`${pageId}/videos`, account.access_token, 'POST', {
        file_url: job.media_urls[0],
        description: job.caption
      }, idempotencyKey ? `${idempotencyKey}-video` : undefined);
      postId = res.id;
    } else {
      // Text only
      const res = await fetchFacebook(`${pageId}/feed`, account.access_token, 'POST', {
        message: job.caption
      }, idempotencyKey ? `${idempotencyKey}-text` : undefined);
      postId = res.id;
    }

    return { success: true, platform_post_id: postId };
  } catch (err: unknown) {
    console.error('Facebook Publish Error:', err);
    return { success: false, error: (err as Error).message };
  }
}
