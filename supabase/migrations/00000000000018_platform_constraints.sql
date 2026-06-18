-- Fase 2 Security Patch Fix (M28)

-- Menyeragamkan penamaan platform menjadi konsisten di semua tabel terkait:
-- social_accounts, social_conversations, dan competitor_tracking.
-- Semua akan mengizinkan: 'meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube', 'linkedin', 'threads'

-- 1. social_accounts
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS chk_social_accounts_platform;
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_check;
UPDATE social_accounts SET platform = 'meta_ig' WHERE platform = 'instagram';
ALTER TABLE social_accounts
  ADD CONSTRAINT chk_social_accounts_platform CHECK (platform IN ('meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube', 'linkedin', 'threads'));

-- 2. social_conversations
ALTER TABLE social_conversations DROP CONSTRAINT IF EXISTS chk_conversations_platform;
UPDATE social_conversations SET platform = 'meta_ig' WHERE platform = 'instagram';
ALTER TABLE social_conversations
  ADD CONSTRAINT chk_conversations_platform CHECK (platform IN ('meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube', 'linkedin', 'threads'));

-- 3. competitor_tracking
ALTER TABLE competitor_tracking DROP CONSTRAINT IF EXISTS chk_competitor_platform;
UPDATE competitor_tracking SET platform = 'meta_ig' WHERE platform = 'instagram';
ALTER TABLE competitor_tracking
  ADD CONSTRAINT chk_competitor_platform CHECK (platform IN ('meta_ig', 'tiktok', 'facebook', 'twitter', 'youtube', 'linkedin', 'threads'));
