-- Fase 1 Security Patch Fix (C14)

-- Memperbaiki tipe kolom vision_api_key_encrypted di tabel ai_providers menjadi BYTEA
-- Migrasi sebelumnya (12) salah menargetkan tabel 'providers'.

DO $$ 
BEGIN
    -- Coba alter table, jika ada kolomnya
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_providers' AND column_name = 'vision_api_key_encrypted' AND data_type = 'text'
    ) THEN
        -- Untuk amannya, kita kosongkan value-nya saat alter type (karena formatnya beda dan mencegah error conversion)
        ALTER TABLE ai_providers 
        ALTER COLUMN vision_api_key_encrypted DROP DEFAULT,
        ALTER COLUMN vision_api_key_encrypted TYPE BYTEA USING NULL;
    END IF;
END $$;
