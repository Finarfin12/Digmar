import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { FakeDb, createFakeSupabase } from '../helpers/fake-supabase'

const state = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  user: null as { id: string; email?: string } | null,
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => createFakeSupabase(state.db, state.user) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => createFakeSupabase(state.db) }))
vi.mock('@/lib/crypto/server', () => ({ decryptValue: (v: string) => v, encryptValue: (v: string) => v }))
vi.mock('@/lib/social/publisher', () => ({ processSingleJob: vi.fn(async () => ({ processed: 1, jobs: [] })) }))

import { PUT as putPost } from '@/app/api/posts/[id]/route'
import { POST as publishNow } from '@/app/api/posts/[id]/publish/route'
import { POST as reviewPost } from '@/app/api/posts/[id]/review/route'
import { POST as backfill } from '@/app/api/inbox/backfill/route'
import { POST as reorderIdeas } from '@/app/api/ideas/reorder/route'
import { processSingleJob } from '@/lib/social/publisher'

const jsonRequest = (body: unknown) => new Request('http://localhost/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}) as unknown as NextRequest

const params = (id: string) => ({ params: Promise.resolve({ id }) })

function seed() {
  state.user = { id: 'user-1', email: 'owner@example.com' }
  state.db = new FakeDb({
    business_units: [
      { id: 'bu-1', user_id: 'user-1' },
      { id: 'bu-2', user_id: 'user-2' },
    ],
    social_accounts: [
      { id: 'acc-mine', business_unit_id: 'bu-1', platform: 'facebook', ig_user_id: 'page-1', access_token_encrypted: 'tok' },
      { id: 'acc-other', business_unit_id: 'bu-2', platform: 'facebook', ig_user_id: 'page-2', access_token_encrypted: 'tok2' },
    ],
    post_queue: [
      { id: 'post-1', user_id: 'user-1', status: 'waiting', caption: 'old', target_account_ids: ['acc-mine'], log_messages: [] },
      { id: 'post-review', user_id: 'user-1', status: 'pending_review', caption: 'x', target_account_ids: ['acc-mine'], log_messages: [] },
    ],
    idea_board: [
      { id: 'idea-1', user_id: 'user-1', status: 'todo', position: 0 },
      { id: 'idea-other', user_id: 'user-2', status: 'todo', position: 0 },
    ],
  })
}

const post = (id: string) => state.db.table('post_queue').find(p => p.id === id)!

describe('PUT /api/posts/[id]', () => {
  beforeEach(seed)

  it('rejects target accounts owned by another user', async () => {
    const res = await putPost(jsonRequest({ target_account_ids: ['acc-other'] }), params('post-1'))
    expect(res.status).toBe(403)
    expect(post('post-1').target_account_ids).toEqual(['acc-mine'])
  })

  it('ignores protected fields like status and log_messages', async () => {
    const res = await putPost(jsonRequest({ caption: 'new', status: 'success', log_messages: ['x'] }), params('post-1'))
    expect(res.status).toBe(200)
    expect(post('post-1').caption).toBe('new')
    expect(post('post-1').status).toBe('waiting')
    expect(post('post-1').log_messages).toEqual([])
  })

  it('requires login', async () => {
    state.user = null
    const res = await putPost(jsonRequest({ caption: 'new' }), params('post-1'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/posts/[id]/publish', () => {
  beforeEach(() => { seed(); vi.mocked(processSingleJob).mockClear() })

  it('only processes the requested job', async () => {
    const res = await publishNow(jsonRequest({}), params('post-1'))
    expect(res.status).toBe(200)
    expect(processSingleJob).toHaveBeenCalledWith('post-1')
  })

  it('blocks posts that are waiting for approval', async () => {
    const res = await publishNow(jsonRequest({}), params('post-review'))
    expect(res.status).toBe(409)
    expect(processSingleJob).not.toHaveBeenCalled()
  })

  it('blocks posts that were already published', async () => {
    post('post-1').status = 'success'
    const res = await publishNow(jsonRequest({}), params('post-1'))
    expect(res.status).toBe(409)
  })
})

describe('POST /api/posts/[id]/review', () => {
  beforeEach(seed)

  it('approves a pending post into the publish queue', async () => {
    const res = await reviewPost(jsonRequest({ action: 'approve' }), params('post-review'))
    expect(res.status).toBe(200)
    expect(post('post-review').status).toBe('waiting')
    expect(post('post-review').reviewed_by).toBe('owner@example.com')
  })

  it('submitting creates a review token', async () => {
    const res = await reviewPost(jsonRequest({ action: 'submit' }), params('post-1'))
    expect(res.status).toBe(200)
    expect(post('post-1').status).toBe('pending_review')
    expect(String(post('post-1').approval_token)).toMatch(/^[A-Za-z0-9_-]{32}$/)
  })

  it('refuses transitions that do not apply', async () => {
    const res = await reviewPost(jsonRequest({ action: 'approve' }), params('post-1'))
    expect(res.status).toBe(409)
  })
})

describe('POST /api/inbox/backfill', () => {
  beforeEach(seed)

  it('requires login', async () => {
    state.user = null
    const res = await backfill(jsonRequest({ account_id: 'acc-mine' }))
    expect(res.status).toBe(401)
  })

  it("refuses another user's account", async () => {
    const res = await backfill(jsonRequest({ account_id: 'acc-other' }))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/ideas/reorder', () => {
  beforeEach(seed)

  it("does not touch another user's ideas", async () => {
    const res = await reorderIdeas(jsonRequest({ items: [
      { id: 'idea-1', status: 'done', position: 0 },
      { id: 'idea-other', status: 'done', position: 0 },
    ] }))
    expect(res.status).toBe(200)
    const ideas = state.db.table('idea_board')
    expect(ideas.find(i => i.id === 'idea-1')!.status).toBe('done')
    expect(ideas.find(i => i.id === 'idea-other')!.status).toBe('todo')
  })

  it('validates status values', async () => {
    const res = await reorderIdeas(jsonRequest({ items: [{ id: 'idea-1', status: 'archived', position: 0 }] }))
    expect(res.status).toBe(400)
  })
})
