// In-Memory Rate Limiter Sederhana
// Peringatan: Dalam environment serverless seperti Vercel, memory ini akan kereset setiap kali instance baru menyala.
// Untuk skala enterprise, disarankan menggunakan Upstash Redis / Vercel KV.

type RateLimitEntry = {
  count: number;
  lastReset: number;
};

const limits = new Map<string, RateLimitEntry>();

/**
 * 
 * @param ip IP Address pengguna
 * @param endpoint Nama endpoint (e.g. 'ai-caption')
 * @param limit Batas jumlah request
 * @param windowMs Jendela waktu dalam milliseconds (e.g. 60000 = 1 menit)
 * @returns boolean true jika sukses, false jika terkena limit
 */
export function checkRateLimit(ip: string, endpoint: string, limit: number, windowMs: number): boolean {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  
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
