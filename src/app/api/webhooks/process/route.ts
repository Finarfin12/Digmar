import { NextResponse, type NextRequest } from 'next/server'
import { processPendingWebhookEvents } from '@/lib/webhooks/queue'
import { handleApiError } from '@/lib/utils/error-handler'

export const maxDuration = 60

// Cron (mis. tiap 5 menit): retry event webhook yang tertunda, gagal, atau macet
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await processPendingWebhookEvents())
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
