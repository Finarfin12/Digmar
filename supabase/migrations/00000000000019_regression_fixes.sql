-- Regression fixes for security hardening migrations 12-18.

-- 1. Ensure legacy permissive storage policies are gone, then recreate the
-- restricted policies idempotently.
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Semua orang bisa melihat media" ON storage.objects;
DROP POLICY IF EXISTS "User login bisa mengunggah" ON storage.objects;
DROP POLICY IF EXISTS "User bisa menghapus medianya sendiri" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload valid media" ON storage.objects;
DROP POLICY IF EXISTS "Public media access" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;

CREATE POLICY "Users can upload valid media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'digimar-media' AND
  auth.uid()::text = (storage.foldername(name))[1] AND
  storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov')
);

CREATE POLICY "Public media access"
ON storage.objects FOR SELECT
USING (bucket_id = 'digimar-media');

CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'digimar-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'digimar-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Preserve text vision keys when converting older installs to BYTEA.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ai_providers'
      AND column_name = 'vision_api_key_encrypted'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE ai_providers
      ALTER COLUMN vision_api_key_encrypted DROP DEFAULT,
      ALTER COLUMN vision_api_key_encrypted TYPE BYTEA USING
        CASE
          WHEN vision_api_key_encrypted IS NULL THEN NULL
          WHEN vision_api_key_encrypted LIKE '\x%' THEN decode(substring(vision_api_key_encrypted from 3), 'hex')
          ELSE convert_to(vision_api_key_encrypted, 'utf8')
        END;
  END IF;
END $$;

-- 3. Normalize legacy platform values before reapplying stricter constraints.
DO $$
BEGIN
  IF to_regclass('public.social_accounts') IS NOT NULL THEN
    ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS chk_social_accounts_platform;
    ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_check;
    UPDATE social_accounts SET platform = 'meta_ig' WHERE platform = 'instagram';
    ALTER TABLE social_accounts
      ADD CONSTRAINT chk_social_accounts_platform
      CHECK (platform IN ('meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube', 'linkedin', 'threads'));
  END IF;

  IF to_regclass('public.social_conversations') IS NOT NULL THEN
    ALTER TABLE social_conversations DROP CONSTRAINT IF EXISTS chk_conversations_platform;
    ALTER TABLE social_conversations DROP CONSTRAINT IF EXISTS social_conversations_platform_check;
    UPDATE social_conversations SET platform = 'meta_ig' WHERE platform = 'instagram';
    ALTER TABLE social_conversations
      ADD CONSTRAINT chk_conversations_platform
      CHECK (platform IN ('meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube', 'linkedin', 'threads'));
  END IF;

  IF to_regclass('public.competitor_tracking') IS NOT NULL THEN
    ALTER TABLE competitor_tracking DROP CONSTRAINT IF EXISTS chk_competitor_platform;
    ALTER TABLE competitor_tracking DROP CONSTRAINT IF EXISTS competitor_tracking_platform_check;
    UPDATE competitor_tracking SET platform = 'meta_ig' WHERE platform = 'instagram';
    ALTER TABLE competitor_tracking
      ADD CONSTRAINT chk_competitor_platform
      CHECK (platform IN ('meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube', 'linkedin', 'threads'));
  END IF;
END $$;

-- 4. Prevent A/B test deletion from deleting historical posts.
DO $$
BEGIN
  IF to_regclass('public.post_queue') IS NOT NULL
     AND to_regclass('public.ab_tests') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'post_queue'
         AND column_name = 'ab_test_id'
     )
  THEN
    ALTER TABLE post_queue DROP CONSTRAINT IF EXISTS fk_post_queue_ab_test;
    ALTER TABLE post_queue
      ADD CONSTRAINT fk_post_queue_ab_test
      FOREIGN KEY (ab_test_id) REFERENCES ab_tests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. The application encrypts/decrypts secrets in TypeScript. Drop the old
-- PostgreSQL helpers so no new incompatible ciphertext can be written.
DROP FUNCTION IF EXISTS encrypt_value(TEXT, TEXT);
DROP FUNCTION IF EXISTS decrypt_value(BYTEA, TEXT);
