import { SocialAccount, PostJob } from './types';

const FB_API_VERSION = process.env.FB_API_VERSION || 'v25.0';

async function fetchFacebook(path: string, token: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, string | number | boolean | undefined | null>) {
  const url = `https://graph.facebook.com/${FB_API_VERSION}/${path}`;
  
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
      if (body[key] !== undefined && body[key] !== null) stringBody[key] = String(body[key]);
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
    throw new Error(data.error?.message || `Facebook API Error: ${response.statusText}`);
  }
  
  return data;
}

export async function publishToFacebook(account: SocialAccount, job: PostJob) {
  try {
    const pageId = account.ig_user_id; // For Facebook, we store Page ID here
    let postId: string;

    if (job.post_type === 'single_image' && job.media_urls && job.media_urls.length > 0) {
      // Single Image
      const res = await fetchFacebook(`${pageId}/photos`, account.access_token, 'POST', {
        url: job.media_urls[0],
        message: job.caption,
        published: true
      });
      postId = res.id;
    } else if (job.post_type === 'carousel' && job.media_urls && job.media_urls.length > 0) {
      // Multiple Images (Facebook doesn't have a strict carousel like IG, but we can post multiple photos to a feed post)
      // Usually requires uploading unpublished photos first, then attaching them.
      // For simplicity, we fallback to uploading the first image if multi-image API is too complex, 
      // or we can implement the Facebook multi-photo post:
      const attachedMedia = [];
      for (const url of job.media_urls) {
        const photoRes = await fetchFacebook(`${pageId}/photos`, account.access_token, 'POST', {
          url: url,
          published: false
        });
        attachedMedia.push({ media_fbid: photoRes.id });
      }
      
      const res = await fetchFacebook(`${pageId}/feed`, account.access_token, 'POST', {
        message: job.caption,
        attached_media: attachedMedia as any // passing array of objects
      });
      postId = res.id;
    } else if (job.post_type === 'reels' && job.media_urls && job.media_urls.length > 0) {
      // Video
      const res = await fetchFacebook(`${pageId}/videos`, account.access_token, 'POST', {
        file_url: job.media_urls[0],
        description: job.caption
      });
      postId = res.id;
    } else {
      // Text only
      const res = await fetchFacebook(`${pageId}/feed`, account.access_token, 'POST', {
        message: job.caption
      });
      postId = res.id;
    }

    return { success: true, platform_post_id: postId };
  } catch (err: unknown) {
    console.error('Facebook Publish Error:', err);
    return { success: false, error: (err as Error).message };
  }
}
