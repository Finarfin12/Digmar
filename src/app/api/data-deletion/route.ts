import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { logger } from '@/lib/utils/logger'

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

// Verifikasi signed_request Meta: "<signature>.<payload>", signature = HMAC-SHA256(payload, app secret)
function parseSignedRequest(signedRequest: string, appSecret: string): { user_id?: string; algorithm?: string } | null {
  const [encodedSig, payload] = signedRequest.split('.', 2)
  if (!encodedSig || !payload) return null

  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest()
  const received = base64UrlDecode(encodedSig)
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null

  try {
    const data = JSON.parse(base64UrlDecode(payload).toString('utf8'))
    if (typeof data?.algorithm !== 'string' || data.algorithm.toUpperCase() !== 'HMAC-SHA256') return null
    return data
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const appSecret = process.env.META_APP_SECRET
    if (!appSecret) {
      logger.error('META_APP_SECRET is not configured')
      return new NextResponse('Internal Server Error', { status: 500 })
    }

    const rawBody = await request.text()
    // Parse URL-encoded form data
    const formData = new URLSearchParams(rawBody)
    const signedRequest = formData.get('signed_request')

    if (!signedRequest) {
      return new NextResponse('Bad Request', { status: 400 })
    }

    const data = parseSignedRequest(signedRequest, appSecret)
    if (!data || !data.user_id) {
      return new NextResponse('Forbidden: Invalid signed_request', { status: 403 })
    }

    const confirmationCode = crypto.randomBytes(8).toString('hex')
    // TODO: hapus data milik Meta user_id ini setelah mapping user_id → social_accounts tersedia
    logger.info(`Meta data deletion request received for user ${data.user_id}, confirmation ${confirmationCode}`)

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL || 'localhost:3000'}`
    return NextResponse.json({
      url: `${baseUrl}/privacy`,
      confirmation_code: confirmationCode
    })
  } catch (err: unknown) {
    logger.error('Data deletion callback error:', err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
