ALTER TABLE idea_board DROP CONSTRAINT IF EXISTS idea_board_status_check;
ALTER TABLE idea_board ADD CONSTRAINT idea_board_status_check
  CHECK (status IN ('unassigned', 'todo', 'in_progress', 'done'));

ALTER TABLE idea_board ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT '';
ALTER TABLE idea_board ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

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
