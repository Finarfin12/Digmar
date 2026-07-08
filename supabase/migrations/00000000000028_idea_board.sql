CREATE TABLE IF NOT EXISTS idea_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unassigned',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  platform TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  tags JSONB DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMPTZ,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE idea_board DROP CONSTRAINT IF EXISTS idea_board_status_check;
  ALTER TABLE idea_board ADD CONSTRAINT idea_board_status_check
    CHECK (status IN ('unassigned', 'todo', 'in_progress', 'done'));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE idea_board ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE idea_board ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE idea_board ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ideas" ON idea_board;
CREATE POLICY "Users can view their own ideas"
  ON idea_board FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create ideas" ON idea_board;
CREATE POLICY "Users can create ideas"
  ON idea_board FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ideas" ON idea_board;
CREATE POLICY "Users can update their own ideas"
  ON idea_board FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own ideas" ON idea_board;
CREATE POLICY "Users can delete their own ideas"
  ON idea_board FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_idea_board_user_status ON idea_board(user_id, status);
CREATE INDEX IF NOT EXISTS idx_idea_board_position ON idea_board(user_id, position);
