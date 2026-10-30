-- Zona waktu per business unit untuk jadwal rutin & variabel {tanggal}
ALTER TABLE business_units ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta';
