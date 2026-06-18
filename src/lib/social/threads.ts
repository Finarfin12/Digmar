import type { SocialAccount, PostJob } from './types';

const THREADS_API_VERSION = process.env.INSTAGRAM_API_VERSION || 'v25.0';

async function fetchThreadsAPI(path: string, token: string, method: 'GET' | 'POST' = 'GET', body?: Record<string, unknown>) {
  const url = `https://graph.threads.net/${THREADS_API_VERSION}/${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  } else {
    headers['Accept'] = 'application/json';
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
      // Threads supports carousel via children
      const children: string[] = [];
      for (const mediaUrl of job.media_urls) {
        const isVideo = mediaUrl.includes('.mp4');
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
    } else {
      // Single image or video
      const hasVideo = job.media_urls.some((url: string) => url.includes('.mp4'));
      const mediaType = hasVideo ? 'VIDEO' : 'IMAGE';

      const createBody: Record<string, unknown> = {
        media_type: mediaType,
        text: job.caption,
      };

      if (hasVideo) {
        createBody.video_url = job.media_urls[0];
      } else if (job.media_urls[0]) {
        createBody.image_url = job.media_urls[0];
      }

      const res = await fetchThreadsAPI(`${account.ig_user_id}/threads`, account.access_token, 'POST', createBody);
      containerId = res.id;
    }

    // Poll until ready
    let isReady = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const statusRes = await fetchThreadsAPI(`${containerId}?fields=status,id`, account.access_token);
      if (statusRes.status === 'FINISHED') {
        isReady = true;
        break;
      }
      if (statusRes.status === 'ERROR' || statusRes.status === 'EXPIRED') {
        throw new Error(`Threads container ${statusRes.status}: ${statusRes.error_message || 'Unknown error'}`);
      }
      const waitTime = Math.min(2000 * Math.pow(1.3, attempt), 15000);
      await new Promise(r => setTimeout(r, waitTime));
    }

    if (!isReady) {
      throw new Error('Threads media container timed out after polling.');
    }

    // Publish
    const publishRes = await fetchThreadsAPI(`${account.ig_user_id}/threads_publish`, account.access_token, 'POST', {
      creation_id: containerId,
    });

    return { success: true, id: publishRes.id };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
