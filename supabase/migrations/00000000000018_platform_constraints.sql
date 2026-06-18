-- Fase 2 Security Patch Fix (M28)

-- Menyeragamkan penamaan platform menjadi 'meta_ig' seperti di social_accounts
-- pada tabel social_conversations dan competitor_tracking.

ALTER TABLE social_conversations DROP CONSTRAINT IF EXISTS chk_conversations_platform;
ALTER TABLE social_conversations
  ADD CONSTRAINT chk_conversations_platform CHECK (platform IN ('meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube'));

ALTER TABLE competitor_tracking DROP CONSTRAINT IF EXISTS chk_competitor_platform;
ALTER TABLE competitor_tracking
  ADD CONSTRAINT chk_competitor_platform CHECK (platform IN ('meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube'));
