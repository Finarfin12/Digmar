-- Content Library: Media Assets
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content Library: Caption Templates
CREATE TABLE IF NOT EXISTS caption_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content Library: Hashtag Banks
CREATE TABLE IF NOT EXISTS hashtag_banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    hashtags JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_unit ON media_assets(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_caption_templates_unit ON caption_templates(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_hashtag_banks_unit ON hashtag_banks(business_unit_id);

-- RLS
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE caption_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtag_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own data" ON media_assets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON caption_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON hashtag_banks FOR ALL USING (auth.uid() = user_id);
