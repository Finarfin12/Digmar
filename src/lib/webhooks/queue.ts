import { createServiceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/utils/logger'
import { processWebhookBody } from './meta'

const MAX_ATTEMPTS = 5
// Event 'processing' yang tidak selesai dalam waktu ini dianggap macet (instance mati) dan diambil ulang
const STALE_LOCK_MS = 10 * 60 * 1000

/** Simpan payload webhook Meta ke antrean. Mengembalikan id event, atau null jika antrean tidak tersedia. */
export async function enqueueMetaWebhook(payload: unknown): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('webhook_events')
    .insert({ source: 'meta', payload })
    .select('id')
    .single()

  if (error || !data) {
    logger.error('Failed to enqueue webhook event:', error)
    return null
  }
  return data.id
}

/** Klaim lalu proses satu event. Aman dipanggil bersamaan: klaim memakai update bersyarat. */
export async function processWebhookEvent(eventId: string): Promise<'processed' | 'failed' | 'skipped'> {
  const supabase = createServiceClient()

  const { data: event } = await supabase
    .from('webhook_events')
    .select('id, payload, status, attempts, locked_at')
    .eq('id', eventId)
    .single()

  if (!event || event.status === 'processed' || event.attempts >= MAX_ATTEMPTS) return 'skipped'
  const lockIsStale = event.locked_at && Date.now() - new Date(event.locked_at).getTime() > STALE_LOCK_MS
  if (event.status === 'processing' && !lockIsStale) return 'skipped'

  const { data: claimed } = await supabase
    .from('webhook_events')
    .update({ status: 'processing', attempts: event.attempts + 1, locked_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('attempts', event.attempts) // proses lain sudah mengklaim jika attempts berubah
    .select('id')
    .maybeSingle()

  if (!claimed) return 'skipped'

  try {
    await processWebhookBody(event.payload)
    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString(), last_error: null, locked_at: null })
      .eq('id', eventId)
    return 'processed'
  } catch (err) {
    await supabase
      .from('webhook_events')
      .update({ status: 'failed', last_error: (err as Error).message.slice(0, 1000), locked_at: null })
      .eq('id', eventId)
    return 'failed'
  }
}

/** Worker cron: proses event yang tertunda, gagal (belum melewati batas retry), atau macet. */
export async function processPendingWebhookEvents(limit = 20) {
  const supabase = createServiceClient()
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString()

  const { data: events, error } = await supabase
    .from('webhook_events')
    .select('id')
    .lt('attempts', MAX_ATTEMPTS)
    .or(`status.eq.pending,status.eq.failed,and(status.eq.processing,locked_at.lt.${staleBefore})`)
    .order('received_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Query webhook_events gagal: ${error.message}`)

  const results: Record<string, number> = { processed: 0, failed: 0, skipped: 0 }
  for (const event of events || []) {
    const outcome = await processWebhookEvent(event.id)
    results[outcome] += 1
  }
  return { picked: events?.length || 0, ...results }
}
