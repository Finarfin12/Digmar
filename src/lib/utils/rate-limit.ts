// Rate limiter: memakai Upstash Redis (REST) bila UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN di-set,
// sehingga limit konsisten di semua instance serverless. Tanpa env itu (mis. lokal), fallback ke memori proses
// (yang kereset setiap instance baru menyala).
import { logger } from '@/lib/utils/logger';

type RateLimitEntry = {
  count: number;
  lastReset: number;
};

const limits = new Map<string, RateLimitEntry>();
const MAX_TRACKED_KEYS = 5000;

function normalizeIp(rawIp: string | null): string {
  const firstIp = rawIp?.split(',')[0]?.trim();
  if (!firstIp) return 'unknown';
  return firstIp.replace(/^\[|\]$/g, '');
}

export function getRateLimitIdentifier(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;

  const headers = request.headers;
  const ip =
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for');

  return `ip:${normalizeIp(ip)}`;
}

function evictExpiredEntries(now: number, windowMs: number) {
  for (const [key, entry] of limits.entries()) {
    if (now - entry.lastReset > windowMs) {
      limits.delete(key);
    }
  }

  if (limits.size <= MAX_TRACKED_KEYS) return;

  const oldestKeys = [...limits.entries()]
    .sort((a, b) => a[1].lastReset - b[1].lastReset)
    .slice(0, limits.size - MAX_TRACKED_KEYS)
    .map(([key]) => key);

  oldestKeys.forEach(key => limits.delete(key));
}

function checkMemoryRateLimit(identifier: string, endpoint: string, limit: number, windowMs: number): boolean {
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();
  evictExpiredEntries(now, windowMs);
  
  const entry = limits.get(key);
  
  if (!entry) {
    limits.set(key, { count: 1, lastReset: now });
    return true;
  }
  
  if (now - entry.lastReset > windowMs) {
    // Reset window
    entry.count = 1;
    entry.lastReset = now;
    return true;
  }
  
  if (entry.count >= limit) {
    return false; // Rate limit exceeded
  }
  
  entry.count += 1;
  return true;
}

// Fixed window counter di Redis: INCR + PEXPIRE dalam satu pipeline
async function checkUpstashRateLimit(url: string, token: string, identifier: string, endpoint: string, limit: number, windowMs: number): Promise<boolean> {
  const windowId = Math.floor(Date.now() / windowMs)
  const key = `ratelimit:${endpoint}:${identifier}:${windowId}`

  const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['PEXPIRE', key, String(windowMs), 'NX'],
    ]),
    signal: AbortSignal.timeout(2000),
  })
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)

  const [incr] = (await res.json()) as Array<{ result?: number; error?: string }>
  if (incr?.error || typeof incr?.result !== 'number') throw new Error(incr?.error || 'Invalid Upstash response')
  return incr.result <= limit
}

/**
 * @param identifier User-scoped identifier. Prefer getRateLimitIdentifier(request, user.id).
 * @param endpoint Nama endpoint (e.g. 'ai-caption')
 * @param limit Batas jumlah request
 * @param windowMs Jendela waktu dalam milliseconds (e.g. 60000 = 1 menit)
 * @returns true jika sukses, false jika terkena limit
 */
export async function checkRateLimit(identifier: string, endpoint: string, limit: number, windowMs: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    try {
      return await checkUpstashRateLimit(url, token, identifier, endpoint, limit, windowMs)
    } catch (err) {
      // Redis bermasalah: jangan blokir semua request, pakai limiter memori sementara
      logger.warn('Upstash rate limit unavailable, falling back to in-memory limiter:', err)
    }
  }

  return checkMemoryRateLimit(identifier, endpoint, limit, windowMs)
}
