import { processQueue } from '@/lib/social/publisher';
import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError } from '@/lib/utils/error-handler'
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processQueue();
    return NextResponse.json({
      ...result,
      message: result.processed === 0 
        ? 'Tidak ada job yang perlu diproses. Cek diagnostic.pending_jobs untuk detail.'
        : `${result.processed} job diproses.`
    });
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
