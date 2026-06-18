-- ============================================
-- Image AI Provider Support (Fase 2)
-- Menambahkan kolom untuk image generation
-- ============================================

-- Tambahkan kolom image provider ke ai_providers
ALTER TABLE ai_providers
  ADD COLUMN IF NOT EXISTS image_provider_type TEXT 
    CHECK (image_provider_type IS NULL OR image_provider_type IN ('dalle', 'stability', 'leonardo')),
  ADD COLUMN IF NOT EXISTS image_api_key_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS image_model TEXT,
  ADD COLUMN IF NOT EXISTS image_config JSONB DEFAULT '{}';

COMMENT ON COLUMN ai_providers.image_provider_type IS 'Tipe provider image AI: dalle, stability, leonardo. NULL = tidak dikonfigurasi.';
COMMENT ON COLUMN ai_providers.image_api_key_encrypted IS 'API key terenkripsi untuk image AI provider.';
COMMENT ON COLUMN ai_providers.image_model IS 'Model spesifik: dall-e-3, stable-diffusion-xl, dll.';
COMMENT ON COLUMN ai_providers.image_config IS 'Konfigurasi tambahan: size, quality, style, steps, dll.';

-- Index untuk query image provider aktif
CREATE INDEX IF NOT EXISTS idx_ai_providers_image ON ai_providers(user_id, image_provider_type, is_active);
