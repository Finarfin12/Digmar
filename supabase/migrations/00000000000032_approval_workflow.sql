-- Approval workflow: draft -> pending_review -> (approved = waiting) / rejected
ALTER TABLE post_queue DROP CONSTRAINT IF EXISTS post_queue_status_check;
-- NOT VALID: jangan gagal karena baris lama dengan status lain; constraint tetap berlaku untuk tulisan baru
ALTER TABLE post_queue ADD CONSTRAINT post_queue_status_check
  CHECK (status IN ('waiting', 'processing', 'success', 'partial', 'failed', 'skipped', 'draft', 'pending_review', 'rejected')) NOT VALID;

-- Token rahasia untuk link review publik (klien bisa approve tanpa login)
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS approval_token TEXT;
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_queue_approval_token ON post_queue(approval_token) WHERE approval_token IS NOT NULL;

-- Business unit yang mewajibkan approval sebelum post bisa terbit
ALTER TABLE business_units ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT false;
