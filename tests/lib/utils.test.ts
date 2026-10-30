import { describe, expect, it } from 'vitest'
import { getZonedToday, isValidTimeZone, zonedTimeToUtc } from '@/lib/utils/timezone'
import { nextReviewState } from '@/lib/approval'

describe('zonedTimeToUtc', () => {
  it('converts WIB wall-clock time to UTC', () => {
    expect(zonedTimeToUtc(2026, 10, 30, 9, 0, 'Asia/Jakarta').toISOString()).toBe('2026-10-30T02:00:00.000Z')
  })

  it('handles a local time that falls on the previous UTC day', () => {
    expect(zonedTimeToUtc(2026, 10, 31, 0, 30, 'Asia/Jakarta').toISOString()).toBe('2026-10-30T17:30:00.000Z')
  })

  it('respects daylight saving time', () => {
    expect(zonedTimeToUtc(2026, 7, 1, 9, 0, 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z')
    expect(zonedTimeToUtc(2026, 1, 1, 9, 0, 'America/New_York').toISOString()).toBe('2026-01-01T14:00:00.000Z')
  })

  it('returns a calendar date for today', () => {
    const today = getZonedToday('UTC')
    const now = new Date()
    expect(today).toEqual({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() })
  })
})

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects garbage', () => {
    expect(isValidTimeZone('Asia/Jakarta')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
  })
})

describe('nextReviewState', () => {
  it('moves posts through the approval workflow', () => {
    expect(nextReviewState('waiting', 'submit')).toEqual({ status: 'pending_review', newToken: true })
    expect(nextReviewState('rejected', 'submit')).toEqual({ status: 'pending_review', newToken: true })
    expect(nextReviewState('pending_review', 'approve')).toEqual({ status: 'waiting', newToken: false })
    expect(nextReviewState('pending_review', 'reject')).toEqual({ status: 'rejected', newToken: false })
  })

  it('rejects transitions that do not apply', () => {
    expect(nextReviewState('success', 'submit')).toBeNull()
    expect(nextReviewState('waiting', 'approve')).toBeNull()
    expect(nextReviewState('rejected', 'reject')).toBeNull()
  })
})
