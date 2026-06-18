-- ============================================
-- Vision AI Provider — Tabel Terpisah (Fase 3)
-- Vision AI dipisah dari ai_providers (text AI)
-- Mirror pola image_ai_providers (migration 00019)
-- ============================================

CREATE TABLE IF NOT EXISTS vision_ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('openrouter', 'groq', 'openai', 'anthropic', 'vps')),
    api_key_encrypted BYTEA NOT NULL,
    base_url TEXT NOT NULL,
    model TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vision_ai_providers IS 'Provider Vision AI untuk analisis gambar (OpenRouter, Groq, OpenAI, Anthropic, VPS). Terpisah dari ai_providers (text AI).';
COMMENT ON COLUMN vision_ai_providers.provider_type IS 'Tipe provider: openrouter, groq, openai, anthropic, vps.';
COMMENT ON COLUMN vision_ai_providers.api_key_encrypted IS 'API key terenkripsi via encryptValue().';
COMMENT ON COLUMN vision_ai_providers.base_url IS 'Base URL endpoint API (default otomatis per provider).';
COMMENT ON COLUMN vision_ai_providers.model IS 'Model spesifik: google/gemini-1.5-flash-free, gpt-4o, dll.';

ALTER TABLE vision_ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vision AI providers"
  ON vision_ai_providers FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vision_ai_providers_user ON vision_ai_providers(user_id, is_active);

-- ============================================
-- Migrasi data existing dari ai_providers
-- ============================================
DO $$
DECLARE
    v_row RECORD;
BEGIN
    FOR v_row IN
        SELECT user_id, vision_base_url, vision_api_key_encrypted, vision_model
        FROM ai_providers
        WHERE vision_base_url IS NOT NULL
          AND vision_api_key_encrypted IS NOT NULL
          AND vision_model IS NOT NULL
    LOOP
        INSERT INTO vision_ai_providers (user_id, provider_type, api_key_encrypted, base_url, model)
        VALUES (v_row.user_id, 'openrouter', v_row.vision_api_key_encrypted, v_row.vision_base_url, v_row.vision_model)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================
-- Hapus kolom vision dari ai_providers
-- ============================================
ALTER TABLE ai_providers DROP COLUMN IF EXISTS vision_base_url;
ALTER TABLE ai_providers DROP COLUMN IF EXISTS vision_api_key_encrypted;
ALTER TABLE ai_providers DROP COLUMN IF EXISTS vision_model;
