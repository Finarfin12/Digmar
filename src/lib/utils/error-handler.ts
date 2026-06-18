import { NextResponse } from 'next/server';

export function handleApiError(err: unknown) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = err instanceof Error ? err.message : String(err);
  
  if (isDevelopment) {
    console.error('API Error:', err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  // Di mode produksi, jangan bocorkan pesan asli bila ini adalah error tidak terduga
  // Kita bisa mengecek tipe error, tetapi demi keamanan global kita generalisir
  return NextResponse.json(
    { error: 'An unexpected internal server error occurred.' }, 
    { status: 500 }
  );
}
