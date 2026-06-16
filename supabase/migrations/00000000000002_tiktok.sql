-- Menghapus constraint platform lama jika ada
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_check;

-- Membuat constraint platform baru dengan tambahan 'tiktok'
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_platform_check 
CHECK (platform IN ('meta_ig', 'linkedin', 'threads', 'tiktok'));
