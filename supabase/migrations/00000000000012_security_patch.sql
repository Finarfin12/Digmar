-- Fase 1 Security Patch

-- 1. Fix SECURITY DEFINER pada fungsi encrypt_value dan decrypt_value
-- Dengan menambahkan SET search_path = pg_catalog, pg_temp

CREATE OR REPLACE FUNCTION encrypt_value(plaintext TEXT, enc_key TEXT)
RETURNS BYTEA
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    RETURN encrypt_iv(
        convert_to(plaintext, 'utf8'),
        decode(enc_key, 'hex'),
        decode('00000000000000000000000000000000', 'hex'),
        'aes'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_value(ciphertext BYTEA, enc_key TEXT)
RETURNS TEXT
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    RETURN convert_from(
        decrypt_iv(
            ciphertext,
            decode(enc_key, 'hex'),
            decode('00000000000000000000000000000000', 'hex'),
            'aes'
        ),
        'utf8'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix tipe kolom vision_api_key_encrypted di tabel providers menjadi BYTEA
-- Sebelumnya adalah TEXT (pada migrasi 00000000000008_vision_ai.sql) yang bisa menyebabkan plaintext leakage.

DO $$ 
BEGIN
    -- Coba alter table, jika ada kolomnya
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'providers' AND column_name = 'vision_api_key_encrypted' AND data_type = 'text'
    ) THEN
        -- Untuk amannya, kita kosongkan value-nya saat alter type (karena formatnya beda dan mencegah error conversion)
        ALTER TABLE providers 
        ALTER COLUMN vision_api_key_encrypted DROP DEFAULT,
        ALTER COLUMN vision_api_key_encrypted TYPE BYTEA USING NULL;
    END IF;
END $$;
