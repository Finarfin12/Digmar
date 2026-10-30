import { NextResponse, type NextRequest } from 'next/server'
import { runTokenMaintenance } from '@/lib/social/token-maintenance'
import { handleApiError } from '@/lib/utils/error-handler'

export const maxDuration = 60

// Cron harian: cek validitas, perpanjang, dan beri peringatan token akun sosial
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runTokenMaintenance()
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})
    return NextResponse.json({ checked: results.length, summary, results })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
