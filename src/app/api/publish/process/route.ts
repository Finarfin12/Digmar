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
    return NextResponse.json(result);
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
