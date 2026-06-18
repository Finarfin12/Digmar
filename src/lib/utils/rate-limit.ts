// In-Memory Rate Limiter Sederhana
// Peringatan: Dalam environment serverless seperti Vercel, memory ini akan kereset setiap kali instance baru menyala.
// Untuk skala enterprise, disarankan menggunakan Upstash Redis / Vercel KV.

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

/**
 * 
 * @param identifier User-scoped identifier. Prefer getRateLimitIdentifier(request, user.id).
 * @param endpoint Nama endpoint (e.g. 'ai-caption')
 * @param limit Batas jumlah request
 * @param windowMs Jendela waktu dalam milliseconds (e.g. 60000 = 1 menit)
 * @returns boolean true jika sukses, false jika terkena limit
 */
export function checkRateLimit(identifier: string, endpoint: string, limit: number, windowMs: number): boolean {
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
