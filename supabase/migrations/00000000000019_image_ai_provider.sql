-- ============================================
-- Image AI Provider — Tabel Terpisah (Fase 2)
-- Provider image AI independen dari text AI
-- ============================================

CREATE TABLE IF NOT EXISTS image_ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('dalle', 'stability', 'leonardo')),
    api_key_encrypted BYTEA NOT NULL,
    model TEXT,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE image_ai_providers IS 'Provider image AI untuk generate gambar fotorealistik (DALL-E, Stability, Leonardo). Terpisah dari ai_providers (text AI).';
COMMENT ON COLUMN image_ai_providers.provider_type IS 'Tipe provider: dalle, stability, leonardo.';
COMMENT ON COLUMN image_ai_providers.api_key_encrypted IS 'API key terenkripsi via encrypt_value().';
COMMENT ON COLUMN image_ai_providers.model IS 'Model spesifik: dall-e-3, stable-diffusion-xl, dll.';
COMMENT ON COLUMN image_ai_providers.config IS 'JSON konfigurasi: size, quality, style, steps, dll.';

ALTER TABLE image_ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own image AI providers"
  ON image_ai_providers FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_image_ai_providers_user ON image_ai_providers(user_id, is_active);
