import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

const safeUserMessages = [
  'No active AI provider configured',
  'Tidak ada AI provider aktif',
  'Kredensial Mata AI belum dikonfigurasi',
  'Provider ',
  'VPS base_url is required',
  'Invalid or blocked base_url',
  'Invalid or blocked vision_base_url',
  'Format AI tidak valid',
  'AI provider gagal merespons',
  'tidak bisa didekripsi',
  'Invalid encrypted data format',
  'Unsupported state or unable to authenticate data',
  'ENCRYPTION_KEY is not defined',
  'ENCRYPTION_SALT is not defined',
];

export function handleApiError(err: unknown) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = err instanceof Error ? err.message : String(err);
  const isSafeUserMessage = safeUserMessages.some(message => errorMessage.includes(message));
  
  logger.error('API Error:', err);

  if (isDevelopment || isSafeUserMessage) {
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  // Di mode produksi, jangan bocorkan pesan asli bila ini adalah error tidak terduga.
  return NextResponse.json(
    { error: 'An unexpected internal server error occurred.' }, 
    { status: 500 }
  );
}
