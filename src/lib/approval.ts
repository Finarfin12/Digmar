import crypto from 'crypto'

export type ReviewAction = 'submit' | 'approve' | 'reject'

/** Token acak untuk link review publik — cukup panjang agar tidak bisa ditebak. */
export function generateApprovalToken(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/**
 * Transisi status untuk aksi review. Mengembalikan null jika aksi tidak berlaku pada status saat ini.
 * - submit: draft/waiting/rejected → pending_review (token baru)
 * - approve: pending_review → waiting (masuk antrean publish)
 * - reject: pending_review → rejected
 */
export function nextReviewState(currentStatus: string, action: ReviewAction): { status: string; newToken: boolean } | null {
  if (action === 'submit' && ['draft', 'waiting', 'rejected'].includes(currentStatus)) {
    return { status: 'pending_review', newToken: true }
  }
  if (action === 'approve' && currentStatus === 'pending_review') return { status: 'waiting', newToken: false }
  if (action === 'reject' && currentStatus === 'pending_review') return { status: 'rejected', newToken: false }
  return null
}

export function isReviewAction(value: unknown): value is ReviewAction {
  return value === 'submit' || value === 'approve' || value === 'reject'
}
