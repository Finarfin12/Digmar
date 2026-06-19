import type { SocialAccount, PostJob } from './types';

// Threads API hanya support v1.0 — jangan pakai versi lain
const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

async function fetchThreadsAPI(
  path: string,
  token: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
) {
  // Hapus leading slash jika ada
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  let url: string;
  if (method === 'GET') {
    // Threads API GET: token via query param (Bearer header tidak didukung untuk GET)
    const separator = cleanPath.includes('?') ? '&' : '?';
    url = `${THREADS_API_BASE}/${cleanPath}${separator}access_token=${token}`;
  } else {
    url = `${THREADS_API_BASE}/${cleanPath}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // POST: gunakan Bearer header
  if (method === 'POST') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Threads API Error: ${response.statusText}`);
  }
  return data;
}

export async function publishToThreads(account: SocialAccount, job: PostJob) {
  try {
    let containerId: string;

    if (job.post_type === 'carousel') {
      // Buat child containers dulu
      const children: string[] = [];
      for (const mediaUrl of job.media_urls) {
        const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i);
        const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

        const res = await fetchThreadsAPI(`${account.ig_user_id}/threads`, account.access_token, 'POST', {
          media_type: mediaType,
          [isVideo ? 'video_url' : 'image_url']: mediaUrl,
          is_carousel_item: true,
        });
        children.push(res.id);
      }

      const carouselRes = await fetchThreadsAPI(`${account.ig_user_id}/threads`, account.access_token, 'POST', {
        media_type: 'CAROUSEL',
        children,
        text: job.caption,
      });
      containerId = carouselRes.id;

    } else if (job.media_urls.length === 0) {
      // Text-only post
      const res = await fetchThreadsAPI(`${account.ig_user_id}/threads`, account.access_token, 'POST', {
        media_type: 'TEXT',
        text: job.caption,
      });
      containerId = res.id;

    } else {
      // Single image atau video
      const isVideo = job.media_urls[0]?.match(/\.(mp4|mov|avi)$/i);
      const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

      const createBody: Record<string, unknown> = {
        media_type: mediaType,
        text: job.caption,
      };

      if (isVideo) {
        createBody.video_url = job.media_urls[0];
      } else {
        createBody.image_url = job.media_urls[0];
      }

      const res = await fetchThreadsAPI(`${account.ig_user_id}/threads`, account.access_token, 'POST', createBody);
      containerId = res.id;
    }

    // Poll status container sampai FINISHED
    let isReady = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const statusRes = await fetchThreadsAPI(
        `${containerId}?fields=status,error_message`,
        account.access_token,
        'GET'
      );

      if (statusRes.status === 'FINISHED') {
        isReady = true;
        break;
      }
      if (statusRes.status === 'ERROR' || statusRes.status === 'EXPIRED') {
        throw new Error(`Threads container ${statusRes.status}: ${statusRes.error_message || 'Unknown error'}`);
      }
      // Backoff: 2s, 2.6s, 3.4s, ... max 15s
      const waitTime = Math.min(2000 * Math.pow(1.3, attempt), 15000);
      await new Promise(r => setTimeout(r, waitTime));
    }

    if (!isReady) {
      throw new Error('Threads media container timed out setelah polling 20x.');
    }

    // Publish container
    const publishRes = await fetchThreadsAPI(`${account.ig_user_id}/threads_publish`, account.access_token, 'POST', {
      creation_id: containerId,
    });

    return { success: true, id: publishRes.id };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
