import { NextResponse, after, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { logger } from '@/lib/utils/logger'
import { processWebhookBody } from '@/lib/webhooks/meta'
import { enqueueMetaWebhook, processWebhookEvent } from '@/lib/webhooks/queue'

// Pemrosesan (termasuk generate AI) berjalan di after(), beri waktu cukup
export const maxDuration = 60

// VERIFIKASI WEBHOOK DARI META
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // C10 Fix: Remove hardcoded fallback
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!VERIFY_TOKEN) {
    return new NextResponse('Internal Server Error: Missing Verify Token config', { status: 500 })
  }

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      logger.info('Webhook verified successfully')
      return new NextResponse(challenge, { status: 200 })
    } else {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  return new NextResponse('Bad Request', { status: 400 })
}

function isValidSignature(rawBody: string, signature: string, appSecret: string): boolean {
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`)
  const received = Buffer.from(signature)
  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
}

// MENANGKAP PAYLOAD WEBHOOK (KOMENTAR & DM MASUK)
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    // C9 Fix: Verifikasi HMAC-SHA-256 Signature
    const signature = request.headers.get('x-hub-signature-256')
    const appSecret = process.env.META_APP_SECRET

    if (!appSecret) {
      logger.error('META_APP_SECRET is not configured')
      return new NextResponse('Internal Server Error', { status: 500 })
    }

    if (!signature) {
      return new NextResponse('Forbidden: Missing signature', { status: 403 })
    }

    if (!isValidSignature(rawBody, signature, appSecret)) {
      return new NextResponse('Forbidden: Invalid signature', { status: 403 })
    }

    const body = JSON.parse(rawBody)

    // Cek apakah webhook dari Instagram atau Page (karena IG DM di-routing via Page)
    if ((body.object === 'instagram' || body.object === 'page') && Array.isArray(body.entry)) {
      // Simpan dulu ke antrean (tahan banting bila instance mati), balas Meta secepatnya,
      // lalu proses setelah response. Event yang gagal/macet diambil ulang oleh cron /api/webhooks/process.
      const eventId = await enqueueMetaWebhook(body)
      after(async () => {
        if (eventId) {
          await processWebhookEvent(eventId)
        } else {
          // Antrean tidak tersedia (mis. migration belum dijalankan): proses langsung tanpa retry
          await processWebhookBody(body).catch(err => logger.error('Webhook processing failed:', err))
        }
      })
      return new NextResponse('EVENT_RECEIVED', { status: 200 })
    }

    return new NextResponse('Bad Request', { status: 400 })
  } catch (err: unknown) {
    logger.error('Webhook Error:', err);
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
