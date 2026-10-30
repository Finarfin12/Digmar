import { createServiceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/utils/logger'

export type NotificationType =
  | 'publish_failed'
  | 'publish_partial'
  | 'token_expired'
  | 'token_expiring'
  | 'token_refreshed'
  | 'approval_requested'
  | 'approval_decided'

export interface NewNotification {
  userId: string
  type: NotificationType
  title: string
  message?: string
  link?: string
  metadata?: Record<string, unknown>
  /** Notifikasi dengan dedupKey yang sama untuk user yang sama hanya dibuat sekali */
  dedupKey?: string
}

/** Buat notifikasi in-app. Tidak pernah melempar error — notifikasi tidak boleh menggagalkan proses utama. */
export async function createNotification(notification: NewNotification, supabase = createServiceClient()): Promise<void> {
  const row = {
    user_id: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message || '',
    link: notification.link || null,
    metadata: notification.metadata || {},
    dedup_key: notification.dedupKey || null,
  }

  const { error } = notification.dedupKey
    ? await supabase.from('notifications').upsert(row, { onConflict: 'user_id,dedup_key', ignoreDuplicates: true })
    : await supabase.from('notifications').insert(row)

  if (error) logger.error('Failed to create notification:', error)
}
