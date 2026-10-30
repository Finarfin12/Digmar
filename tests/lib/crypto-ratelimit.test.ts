import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('crypto', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ENCRYPTION_KEY = 'test-key-for-unit-tests'
    process.env.ENCRYPTION_SALT = 'test-salt'
  })

  it('round-trips a value and produces a fresh IV each time', async () => {
    const { encryptValue, decryptValue } = await import('@/lib/crypto/server')
    const a = encryptValue('secret-token')
    const b = encryptValue('secret-token')
    expect(a).not.toBe(b)
    expect(a.startsWith('\\x')).toBe(true)
    expect(decryptValue(a)).toBe('secret-token')
    expect(decryptValue(b)).toBe('secret-token')
  })

  it('rejects tampered ciphertext', async () => {
    const { encryptValue, decryptValue } = await import('@/lib/crypto/server')
    const encrypted = encryptValue('secret-token')
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith('00') ? '11' : '00')
    expect(() => decryptValue(tampered)).toThrow()
  })
})

describe('checkRateLimit', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.resetModules()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('uses the in-memory limiter without Upstash env', async () => {
    const { checkRateLimit } = await import('@/lib/utils/rate-limit')
    const results = []
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit('user:a', 'test-memory', 3, 60000))
    expect(results).toEqual([true, true, true, false])
  })

  it('uses Upstash when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'
    let counter = 0
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: ++counter }, { result: 1 }])))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { checkRateLimit } = await import('@/lib/utils/rate-limit')
    expect(await checkRateLimit('user:b', 'test-redis', 2, 60000)).toBe(true)
    expect(await checkRateLimit('user:b', 'test-redis', 2, 60000)).toBe(true)
    expect(await checkRateLimit('user:b', 'test-redis', 2, 60000)).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith('https://redis.example/pipeline', expect.objectContaining({ method: 'POST' }))
  })

  it('falls back to memory when Upstash is unreachable', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok'
    globalThis.fetch = vi.fn(async () => { throw new Error('network down') }) as unknown as typeof fetch

    const { checkRateLimit } = await import('@/lib/utils/rate-limit')
    expect(await checkRateLimit('user:c', 'test-fallback', 1, 60000)).toBe(true)
    expect(await checkRateLimit('user:c', 'test-fallback', 1, 60000)).toBe(false)
  })
})
