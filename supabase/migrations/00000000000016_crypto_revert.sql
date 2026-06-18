-- Fase 2 Security Patch Fix (M26)

-- Mengembalikan algoritma enkripsi ke pgp_sym_encrypt / pgp_sym_decrypt
-- demi mempertahankan kompatibilitas dengan token lama.
-- Tetap mempertahankan fitur keamanan (SECURITY DEFINER dan search_path) dari migrasi sebelumnya.

CREATE OR REPLACE FUNCTION encrypt_value(plaintext TEXT, enc_key TEXT)
RETURNS BYTEA
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    RETURN pgp_sym_encrypt(plaintext, enc_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_value(ciphertext BYTEA, enc_key TEXT)
RETURNS TEXT
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    RETURN pgp_sym_decrypt(ciphertext, enc_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
