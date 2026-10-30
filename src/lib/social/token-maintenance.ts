import { createServiceClient } from '@/lib/supabase/service'
import { decryptValue, encryptValue } from '@/lib/crypto/server'
import { createNotification } from '@/lib/notifications'
import { logger } from '@/lib/utils/logger'
import { GRAPH_BASE_URL } from './graph'

const DAY_MS = 24 * 60 * 60 * 1000
// Token yang akan habis dalam jendela ini dicoba di-refresh / diberi peringatan
const REFRESH_WINDOW_MS = 14 * DAY_MS
const WARN_WINDOW_MS = 7 * DAY_MS

type ServiceClient = ReturnType<typeof createServiceClient>

type AccountRow = {
  id: string
  platform: string
  ig_user_id: string
  access_token_encrypted: string
  token_expiry: string | null
  business_units: { user_id: string; brand_name: string } | null
}

export type TokenResult = { status: 'ok' | 'refreshed' | 'expiring' | 'expired' | 'skipped'; detail?: string }

const PLATFORM_LABEL: Record<string, string> = { meta_ig: 'Instagram', facebook: 'Facebook', threads: 'Threads', tiktok: 'TikTok' }

async function fetchJson(url: URL) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  return res.json()
}

// Meta: cek validitas lewat debug_token, perpanjang long-lived user token lewat fb_exchange_token
async function checkMetaToken(token: string): Promise<{ valid: boolean; expiresAt: Date | null; newToken?: string; newExpiresAt?: Date | null }> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) throw new Error('META_APP_ID / META_APP_SECRET belum dikonfigurasi')

  const debugUrl = new URL(`${GRAPH_BASE_URL}/debug_token`)
  debugUrl.searchParams.set('input_token', token)
  debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`)
  const debug = await fetchJson(debugUrl)
  const info = debug?.data
  if (!info || debug.error) throw new Error(debug?.error?.message || 'debug_token gagal')
  if (!info.is_valid) return { valid: false, expiresAt: null }

  // expires_at 0 = tidak pernah kedaluwarsa (mis. page token dari long-lived user token)
  const expiresAt = info.expires_at ? new Date(info.expires_at * 1000) : null
  if (!expiresAt || expiresAt.getTime() - Date.now() > REFRESH_WINDOW_MS || info.type !== 'USER') {
    return { valid: true, expiresAt }
  }

  const exchangeUrl = new URL(`${GRAPH_BASE_URL}/oauth/access_token`)
  exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token')
  exchangeUrl.searchParams.set('client_id', appId)
  exchangeUrl.searchParams.set('client_secret', appSecret)
  exchangeUrl.searchParams.set('fb_exchange_token', token)
  const exchanged = await fetchJson(exchangeUrl)
  if (!exchanged?.access_token) return { valid: true, expiresAt }

  return {
    valid: true,
    expiresAt,
    newToken: exchanged.access_token,
    newExpiresAt: exchanged.expires_in ? new Date(Date.now() + exchanged.expires_in * 1000) : null,
  }
}

// Threads: long-lived token (60 hari) bisa di-refresh selama masih valid
async function refreshThreadsToken(token: string): Promise<{ newToken: string; newExpiresAt: Date | null } | null> {
  const url = new URL('https://graph.threads.net/refresh_access_token')
  url.searchParams.set('grant_type', 'th_refresh_token')
  url.searchParams.set('access_token', token)
  const data = await fetchJson(url)
  if (!data?.access_token) return null
  return { newToken: data.access_token, newExpiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null }
}

async function maintainAccount(supabase: ServiceClient, account: AccountRow): Promise<TokenResult> {
  const userId = account.business_units?.user_id
  if (!userId) return { status: 'skipped', detail: 'no owner' }

  const label = `${PLATFORM_LABEL[account.platform] || account.platform} (${account.business_units?.brand_name || account.ig_user_id})`
  const today = new Date().toISOString().slice(0, 10)
  const token = decryptValue(account.access_token_encrypted)
  let expiresAt = account.token_expiry ? new Date(account.token_expiry) : null

  const notifyExpired = (title: string) => createNotification({
    userId, type: 'token_expired', title,
    message: 'Hubungkan ulang akun di halaman Accounts agar posting terjadwal tidak gagal.',
    link: '/accounts', metadata: { account_id: account.id },
    dedupKey: `token_expired:${account.id}:${today}`,
  }, supabase)

  const saveToken = async (newToken: string, newExpiresAt: Date | null) => {
    await supabase.from('social_accounts').update({
      access_token_encrypted: encryptValue(newToken),
      token_expiry: newExpiresAt ? newExpiresAt.toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', account.id)
    await createNotification({
      userId, type: 'token_refreshed',
      title: `Token ${label} diperpanjang otomatis`,
      message: newExpiresAt ? `Berlaku sampai ${newExpiresAt.toLocaleDateString('id-ID')}.` : '',
      link: '/accounts',
      metadata: { account_id: account.id },
      dedupKey: `token_refreshed:${account.id}:${today}`,
    }, supabase)
  }

  if (account.platform === 'meta_ig' || account.platform === 'facebook') {
    const meta = await checkMetaToken(token)
    if (!meta.valid) {
      await notifyExpired(`Token ${label} tidak valid atau kedaluwarsa`)
      return { status: 'expired' }
    }
    if (meta.newToken) {
      await saveToken(meta.newToken, meta.newExpiresAt ?? null)
      return { status: 'refreshed' }
    }
    expiresAt = meta.expiresAt
    if (expiresAt && account.token_expiry !== expiresAt.toISOString()) {
      await supabase.from('social_accounts').update({ token_expiry: expiresAt.toISOString() }).eq('id', account.id)
    }
  } else if (account.platform === 'threads' && (!expiresAt || expiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS)) {
    const refreshed = await refreshThreadsToken(token).catch(() => null)
    if (refreshed) {
      await saveToken(refreshed.newToken, refreshed.newExpiresAt)
      return { status: 'refreshed' }
    }
  }

  // TikTok & platform lain (belum ada refresh token tersimpan): peringatan berdasarkan token_expiry
  if (!expiresAt) return { status: 'ok' }

  const remaining = expiresAt.getTime() - Date.now()
  if (remaining <= 0) {
    await notifyExpired(`Token ${label} sudah kedaluwarsa`)
    return { status: 'expired' }
  }
  if (remaining <= WARN_WINDOW_MS) {
    const days = Math.max(1, Math.ceil(remaining / DAY_MS))
    await createNotification({
      userId, type: 'token_expiring',
      title: `Token ${label} akan kedaluwarsa dalam ${days} hari`,
      message: 'Hubungkan ulang akun sebelum token habis agar posting tidak gagal.',
      link: '/accounts', metadata: { account_id: account.id, expires_at: expiresAt.toISOString() },
      dedupKey: `token_expiring:${account.id}:${today}`,
    }, supabase)
    return { status: 'expiring', detail: `${days} hari` }
  }
  return { status: 'ok' }
}

/** Cek, perpanjang, dan beri peringatan token semua akun sosial aktif. Dipanggil oleh cron harian. */
export async function runTokenMaintenance(limit = 200) {
  const supabase = createServiceClient()
  const { data: accounts, error } = await supabase
    .from('social_accounts')
    .select('id, platform, ig_user_id, access_token_encrypted, token_expiry, business_units(user_id, brand_name)')
    .eq('status', 'active')
    .order('token_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) throw new Error(`Query social_accounts gagal: ${error.message}`)

  const results: Array<{ account_id: string; platform: string } & TokenResult> = []
  for (const account of (accounts || []) as unknown as AccountRow[]) {
    let result: TokenResult
    try {
      result = await maintainAccount(supabase, account)
    } catch (err) {
      logger.error(`Token maintenance failed for account ${account.id}:`, err)
      result = { status: 'skipped', detail: (err as Error).message }
    }
    await supabase.from('social_accounts').update({ token_checked_at: new Date().toISOString() }).eq('id', account.id)
    results.push({ account_id: account.id, platform: account.platform, ...result })
  }
  return results
}
