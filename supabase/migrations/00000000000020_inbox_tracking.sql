-- ============================================
-- Inbox Message Tracking
-- Tracking status pengiriman pesan dari inbox
-- ============================================

ALTER TABLE social_messages
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent' 
    CHECK (status IN ('pending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN social_messages.status IS 'Status pengiriman: pending, sent, failed. Default sent untuk data existing.';
COMMENT ON COLUMN social_messages.sent_at IS 'Timestamp saat pesan berhasil dikirim ke platform.';
COMMENT ON COLUMN social_messages.error_message IS 'Error message jika pengiriman gagal.';
