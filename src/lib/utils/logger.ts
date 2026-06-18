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

function sanitizeArg(arg: unknown): unknown {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: isDevelopment ? arg.stack : undefined,
    }
  }

  if (typeof arg === 'string') {
    return arg
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
      .replace(/(api[_-]?key|access[_-]?token|authorization|password|secret)=([^&\s]+)/gi, '$1=[REDACTED]')
  }

  return arg
}

export const logger = {
  error: (...args: unknown[]) => {
    const safeArgs = args.map(sanitizeArg)
    if (isDevelopment) {
      console.error('[DigiMar ERROR]', ...safeArgs)
      return
    }
    console.error('[DigiMar ERROR]', ...safeArgs)
  },

  warn: (...args: unknown[]) => {
    const safeArgs = args.map(sanitizeArg)
    if (isDevelopment) {
      console.warn('[DigiMar WARN]', ...safeArgs)
      return
    }
    console.warn('[DigiMar WARN]', ...safeArgs)
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info('[DigiMar INFO]', ...args)
    }
  },
}
