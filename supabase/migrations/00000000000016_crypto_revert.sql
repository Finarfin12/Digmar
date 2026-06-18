-- Fase 2 Security Patch Fix (M26)

-- Aplikasi sudah menyeragamkan enkripsi/dekripsi di TypeScript
-- (`src/lib/crypto/server.ts`). Fungsi PostgreSQL lama memakai format yang
-- tidak kompatibel dan berisiko membuat data baru tidak bisa dibaca aplikasi.
DROP FUNCTION IF EXISTS encrypt_value(TEXT, TEXT);
DROP FUNCTION IF EXISTS decrypt_value(BYTEA, TEXT);
