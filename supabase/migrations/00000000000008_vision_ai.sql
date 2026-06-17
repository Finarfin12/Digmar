-- Menambahkan konfigurasi AI Vision di tabel ai_providers
ALTER TABLE ai_providers
ADD COLUMN IF NOT EXISTS vision_base_url TEXT,
ADD COLUMN IF NOT EXISTS vision_api_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS vision_model TEXT;

-- Menambahkan toggle use_vision_ai di tabel business_units
ALTER TABLE business_units
ADD COLUMN IF NOT EXISTS use_vision_ai BOOLEAN DEFAULT false;
