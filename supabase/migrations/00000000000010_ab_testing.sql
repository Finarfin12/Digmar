-- Fitur 5: A/B Testing
-- Tambahkan kolom ab_test_id (UUID) ke post_queue
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS ab_test_id UUID;

-- Buat index untuk mempercepat query analytics berdasarkan ab_test_id
CREATE INDEX IF NOT EXISTS idx_post_queue_ab_test ON post_queue(ab_test_id);
