import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDb, createFakeSupabase } from '../helpers/fake-supabase'

const state = vi.hoisted(() => ({ db: null as unknown as FakeDb }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => createFakeSupabase(state.db) }))
vi.mock('@/lib/crypto/server', () => ({ decryptValue: (v: string) => v, encryptValue: (v: string) => v }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(async () => {}) }))
vi.mock('@/lib/social/facebook', () => ({ publishToFacebook: vi.fn() }))
vi.mock('@/lib/social/instagram', () => ({ publishToInstagram: vi.fn(), validateInstagramToken: vi.fn() }))
vi.mock('@/lib/social/tiktok', () => ({ publishToTikTok: vi.fn() }))
vi.mock('@/lib/social/threads', () => ({ publishToThreads: vi.fn() }))

import { processSingleJob } from '@/lib/social/publisher'
import { publishToFacebook } from '@/lib/social/facebook'
import { createNotification } from '@/lib/notifications'

const publishMock = vi.mocked(publishToFacebook)
const notifyMock = vi.mocked(createNotification)

function seed(job: Record<string, unknown> = {}) {
  state.db = new FakeDb({
    business_units: [{ id: 'bu-1', user_id: 'user-1' }],
    social_accounts: [
      { id: 'acc-a', business_unit_id: 'bu-1', platform: 'facebook', ig_user_id: 'page-a', access_token_encrypted: 'tok-a' },
      { id: 'acc-b', business_unit_id: 'bu-1', platform: 'facebook', ig_user_id: 'page-b', access_token_encrypted: 'tok-b' },
    ],
    post_queue: [{
      id: 'job-1', user_id: 'user-1', job_code: 'JOB-1', status: 'waiting',
      target_account_ids: ['acc-a', 'acc-b'], media_urls: [], caption: 'hello', post_type: 'single_image',
      log_messages: [], retry_count: 0, next_retry_at: null, scheduled_at: new Date(0).toISOString(),
      ...job,
    }],
  })
}

const job = () => state.db.table('post_queue')[0]

describe('publisher', () => {
  beforeEach(() => {
    publishMock.mockReset()
    notifyMock.mockClear()
  })

  it('publishes to every account and marks the job success', async () => {
    seed()
    publishMock.mockResolvedValue({ success: true, postId: 'p' } as never)

    const result = await processSingleJob('job-1')

    expect(result.processed).toBe(1)
    expect(job().status).toBe('success')
    expect(publishMock).toHaveBeenCalledTimes(2)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('retries only the failed account after a partial publish', async () => {
    seed()
    publishMock.mockImplementation(async (account) =>
      (account.id === 'acc-a' ? { success: true, postId: 'p' } : { success: false, error: 'boom' }) as never)

    await processSingleJob('job-1')
    expect(job().status).toBe('waiting')
    expect(job().retry_count).toBe(1)
    expect(job().next_retry_at).not.toBeNull()

    publishMock.mockReset()
    publishMock.mockResolvedValue({ success: true, postId: 'p2' } as never)
    await processSingleJob('job-1')

    expect(publishMock).toHaveBeenCalledTimes(1)
    expect(publishMock.mock.calls[0][0].id).toBe('acc-b')
    expect(job().status).toBe('success')
  })

  it('fails permanently after the retry limit and notifies the owner', async () => {
    seed({ retry_count: 3 })
    publishMock.mockResolvedValue({ success: false, error: 'boom' } as never)

    await processSingleJob('job-1')

    expect(job().status).toBe('failed')
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', type: 'publish_failed' }), expect.anything())
  })

  it('notifies about expired tokens', async () => {
    seed({ retry_count: 3 })
    publishMock.mockResolvedValue({ success: false, error: 'Error validating access token: Session has expired (OAuthException code 190)' } as never)

    await processSingleJob('job-1')

    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'token_expired', metadata: { account_id: 'acc-a' } }), expect.anything())
  })

  it('ignores jobs that are not waiting (e.g. pending review)', async () => {
    seed({ status: 'pending_review' })
    const result = await processSingleJob('job-1')
    expect(result.processed).toBe(0)
    expect(publishMock).not.toHaveBeenCalled()
    expect(job().status).toBe('pending_review')
  })
})
