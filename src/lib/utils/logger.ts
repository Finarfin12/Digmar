/**
 * Structured Logger — L13 Fix
 * 
 * Di production, console.error bisa membocorkan PII, path internal, dan detail DB.
 * Logger ini menekan output sensitif di production, sekaligus tetap bisa
 * menampilkan detail lengkap di development.
 * 
 * Penggunaan:
 *   import { logger } from '@/lib/utils/logger'
 *   logger.error('Gagal fetch berita:', err)
 *   logger.warn('Rate limit hampir habis')
 *   logger.info('Webhook processed')
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.error('[DigiMar ERROR]', ...args)
    }
    // Di production, kita bisa mengirim ke external logging service (Sentry, LogDNA, dll)
    // Untuk saat ini, kita suppress agar tidak bocor ke stdout/stderr Vercel logs
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn('[DigiMar WARN]', ...args)
    }
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info('[DigiMar INFO]', ...args)
    }
  },
}
