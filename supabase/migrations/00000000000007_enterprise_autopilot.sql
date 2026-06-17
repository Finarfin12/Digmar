-- Fase 4: Hashtag Auto-Append & First Comment
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS first_comment TEXT NOT NULL DEFAULT '';

-- Fase 5: Caption Variable Auto-Replace
ALTER TABLE business_units ADD COLUMN IF NOT EXISTS custom_variables JSONB NOT NULL DEFAULT '{}';

-- Fase 6: Content Queue & Schedules

-- 1. Tabel Jadwal Rutin (Schedules)
CREATE TABLE IF NOT EXISTS posting_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Minggu, 1=Senin, dst.
    time_of_day TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Wadah Antrean Konten (Content Queue)
CREATE TABLE IF NOT EXISTS content_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    media_urls JSONB NOT NULL DEFAULT '[]',
    caption TEXT NOT NULL DEFAULT '',
    first_comment TEXT NOT NULL DEFAULT '',
    post_type TEXT NOT NULL DEFAULT 'single_image' CHECK (post_type IN ('single_image', 'carousel', 'reels')),
    cover_url TEXT,
    priority INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS untuk tabel baru
ALTER TABLE posting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users see own schedules" ON posting_schedules;
    DROP POLICY IF EXISTS "Users see own content queue" ON content_queue;
EXCEPTION WHEN undefined_object THEN null; END $$;

CREATE POLICY "Users see own schedules" ON posting_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM business_units 
            WHERE business_units.id = posting_schedules.business_unit_id 
            AND business_units.user_id = auth.uid()
        )
    );

CREATE POLICY "Users see own content queue" ON content_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM business_units 
            WHERE business_units.id = content_queue.business_unit_id 
            AND business_units.user_id = auth.uid()
        )
    );
