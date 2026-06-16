-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Business Units
CREATE TABLE IF NOT EXISTS business_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    business_category TEXT NOT NULL DEFAULT '',
    ai_system_prompt TEXT NOT NULL DEFAULT 'Kamu adalah asisten marketing profesional...',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social Accounts (tokens encrypted via pgcrypto)
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('meta_ig', 'linkedin', 'threads')),
    ig_user_id TEXT NOT NULL,
    access_token_encrypted BYTEA NOT NULL,
    token_expiry TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post Queue
CREATE TABLE IF NOT EXISTS post_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_code TEXT NOT NULL UNIQUE,
    target_account_ids JSONB NOT NULL DEFAULT '[]',
    scheduled_at TIMESTAMPTZ NOT NULL,
    media_urls JSONB NOT NULL DEFAULT '[]',
    caption TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'waiting' 
        CHECK (status IN ('waiting', 'processing', 'success', 'partial', 'failed')),
    log_messages JSONB NOT NULL DEFAULT '[]',
    post_type TEXT NOT NULL DEFAULT 'single_image' 
        CHECK (post_type IN ('single_image', 'carousel', 'reels')),
    cover_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Provider Configurations
CREATE TABLE IF NOT EXISTS ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL CHECK (provider_name IN ('groq', 'openai', 'anthropic', 'gemini', 'vps')),
    api_key_encrypted BYTEA,
    base_url TEXT,
    model TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 1,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider_name)
);

-- System Configurations
CREATE TABLE IF NOT EXISTS configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_queue_status_scheduled ON post_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_post_queue_user ON post_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_unit ON social_accounts(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_user ON ai_providers(user_id, is_active);

-- Row-Level Security (RLS)
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid errors if they exist, then recreate them
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users see own data" ON business_units;
    DROP POLICY IF EXISTS "Users see own data" ON social_accounts;
    DROP POLICY IF EXISTS "Users see own data" ON post_queue;
    DROP POLICY IF EXISTS "Users see own data" ON ai_providers;
    DROP POLICY IF EXISTS "Users see own data" ON configurations;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Policy: Users can only see their own data
CREATE POLICY "Users see own data" ON business_units
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own data" ON social_accounts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM business_units 
            WHERE business_units.id = social_accounts.business_unit_id 
            AND business_units.user_id = auth.uid()
        )
    );

CREATE POLICY "Users see own data" ON post_queue
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own data" ON ai_providers
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own data" ON configurations
    FOR ALL USING (auth.uid() = user_id);

-- Encryption Helper Functions
CREATE OR REPLACE FUNCTION encrypt_value(plaintext TEXT, enc_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(plaintext, enc_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_value(ciphertext BYTEA, enc_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(ciphertext, enc_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
