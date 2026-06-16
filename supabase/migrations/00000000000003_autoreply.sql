-- Menambahkan kolom pengaturan Auto-Reply pada tabel social_accounts
ALTER TABLE social_accounts 
ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE;
