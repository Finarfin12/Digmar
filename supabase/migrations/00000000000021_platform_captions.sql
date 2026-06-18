-- ============================================
-- Multi-Platform Publishing & Caption Override
-- Kolom platform_captions untuk caption per akun
-- ============================================

ALTER TABLE post_queue
  ADD COLUMN IF NOT EXISTS platform_captions JSONB DEFAULT '{}';

COMMENT ON COLUMN post_queue.platform_captions IS 'Caption override per akun. Key = account UUID, value = caption. Jika kosong atau key tidak ditemukan, fallback ke caption utama.';
