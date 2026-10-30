-- Antrean event webhook: payload disimpan dulu, lalu diproses worker (after() + cron retry)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'meta',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_received ON webhook_events(status, received_at);

-- Tanpa policy: hanya service role (webhook & worker) yang bisa membaca/menulis
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
