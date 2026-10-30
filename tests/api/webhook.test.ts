import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}))
vi.mock('@/lib/webhooks/queue', () => ({
  enqueueMetaWebhook: vi.fn(async () => 'event-1'),
  processWebhookEvent: vi.fn(),
}))
vi.mock('@/lib/webhooks/meta', () => ({ processWebhookBody: vi.fn() }))

import { after } from 'next/server'
import { POST } from '@/app/api/webhooks/meta/route'
import { enqueueMetaWebhook } from '@/lib/webhooks/queue'

const SECRET = 'app-secret'
const payload = JSON.stringify({ object: 'instagram', entry: [{ id: 'ig-1', changes: [] }] })
const sign = (body: string, secret = SECRET) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`

const webhookRequest = (body: string, signature?: string) => new Request('http://localhost/api/webhooks/meta', {
  method: 'POST',
  headers: signature ? { 'x-hub-signature-256': signature } : {},
  body,
}) as unknown as NextRequest

describe('POST /api/webhooks/meta', () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = SECRET
    vi.mocked(enqueueMetaWebhook).mockClear()
    vi.mocked(after).mockClear()
  })

  it('rejects requests without a signature', async () => {
    const res = await POST(webhookRequest(payload))
    expect(res.status).toBe(403)
    expect(enqueueMetaWebhook).not.toHaveBeenCalled()
  })

  it('rejects requests signed with the wrong secret', async () => {
    const res = await POST(webhookRequest(payload, sign(payload, 'wrong')))
    expect(res.status).toBe(403)
  })

  it('rejects a signature for a different body', async () => {
    const res = await POST(webhookRequest(payload, sign('{"object":"page"}')))
    expect(res.status).toBe(403)
  })

  it('queues a valid event and answers immediately', async () => {
    const res = await POST(webhookRequest(payload, sign(payload)))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('EVENT_RECEIVED')
    expect(enqueueMetaWebhook).toHaveBeenCalledWith(JSON.parse(payload))
    expect(after).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when the app secret is missing', async () => {
    delete process.env.META_APP_SECRET
    const res = await POST(webhookRequest(payload, sign(payload)))
    expect(res.status).toBe(500)
  })
})
