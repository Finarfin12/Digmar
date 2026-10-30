-- Notifikasi in-app (gagal publish, token expired/hampir expired, approval, dll)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Mencegah notifikasi kembar untuk kejadian yang sama (mis. token expiring per akun per hari)
  dedup_key TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bukan partial index agar bisa dipakai ON CONFLICT (user_id, dedup_key); NULL dianggap berbeda
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(user_id, dedup_key);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Insert hanya lewat service role (publisher, cron); user hanya membaca & menandai dibaca
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Kapan token terakhir dicek/di-refresh oleh cron
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS token_checked_at TIMESTAMPTZ;
