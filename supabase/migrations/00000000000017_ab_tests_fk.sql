-- Fase 2 Security Patch Fix (M27)

-- Membuat tabel ab_tests yang diperlukan sebagai referensi dari post_queue.ab_test_id

CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tambahkan RLS untuk ab_tests
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own ab_tests"
  ON ab_tests
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Tambahkan trigger updated_at
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TRIGGER handle_updated_at_ab_tests
  BEFORE UPDATE ON ab_tests
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);

-- Tambahkan Foreign Key dari post_queue ke ab_tests
-- IF NOT EXISTS untuk menghindari error bila constraint sudah ada.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_post_queue_ab_test'
  ) THEN
    ALTER TABLE post_queue
    ADD CONSTRAINT fk_post_queue_ab_test
    FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE SET NULL;
  END IF;
END $$;
