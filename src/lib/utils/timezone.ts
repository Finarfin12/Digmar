// Zona waktu bisnis untuk jadwal rutin (server Vercel berjalan di UTC)
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta'

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number }

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') }
}

// Selisih (ms) antara waktu lokal di timeZone dan UTC pada instant tertentu
function getOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return asUtc - Math.floor(date.getTime() / 60000) * 60000
}

/** Ubah tanggal + jam lokal di timeZone menjadi Date (instant UTC). */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone = APP_TIMEZONE): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const firstPass = guess - getOffsetMs(new Date(guess), timeZone)
  // Ulangi sekali untuk menangani pergantian DST
  return new Date(guess - getOffsetMs(new Date(firstPass), timeZone))
}

/** Tanggal kalender "hari ini" di timeZone. */
export function getZonedToday(timeZone = APP_TIMEZONE): { year: number; month: number; day: number } {
  const { year, month, day } = getZonedParts(new Date(), timeZone)
  return { year, month, day }
}

/** True jika string adalah nama zona waktu IANA yang dikenal (mis. 'Asia/Jakarta'). */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

// Pilihan zona waktu yang umum untuk form Settings
export const COMMON_TIMEZONES = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Bangkok',
  'Asia/Manila',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Amsterdam',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]
