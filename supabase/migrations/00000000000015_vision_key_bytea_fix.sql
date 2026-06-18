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
