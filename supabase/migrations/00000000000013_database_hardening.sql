-- M14 & M15: Tambahkan CHECK constraints
ALTER TABLE competitor_tracking
  ADD CONSTRAINT chk_competitor_platform CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'twitter', 'youtube'));

ALTER TABLE social_conversations
  ADD CONSTRAINT chk_conversations_platform CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'twitter', 'youtube')),
  ADD CONSTRAINT chk_conversations_sentiment CHECK (ai_sentiment IN ('positif', 'negatif', 'netral', 'keluhan', 'tanya_harga') OR ai_sentiment IS NULL);

-- M16: Tambahkan UNIQUE constraints
ALTER TABLE competitor_tracking
  ADD CONSTRAINT uq_competitor_tracking UNIQUE (user_id, handle, platform);

ALTER TABLE caption_templates
  ADD CONSTRAINT uq_caption_templates UNIQUE (user_id, business_unit_id, title);

ALTER TABLE chatbot_rules
  ADD CONSTRAINT uq_chatbot_rules UNIQUE (business_unit_id, trigger_keyword);

ALTER TABLE posting_schedules
  ADD CONSTRAINT uq_posting_schedules UNIQUE (business_unit_id, day_of_week, time_of_day);

ALTER TABLE social_conversations
  ADD CONSTRAINT uq_social_conversations UNIQUE (account_id, platform, customer_id, type);

-- M18: Tambahkan kolom updated_at pada tabel yang belum punya
ALTER TABLE posting_schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Aktifkan ekstensi moddatetime (biasanya sudah aktif di Supabase, tapi just in case)
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- M17: Terapkan trigger updated_at untuk SEMUA tabel yang memiliki kolom updated_at
CREATE TRIGGER handle_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_business_units BEFORE UPDATE ON business_units FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_social_accounts BEFORE UPDATE ON social_accounts FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_competitor_tracking BEFORE UPDATE ON competitor_tracking FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_ai_providers BEFORE UPDATE ON ai_providers FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_chatbot_rules BEFORE UPDATE ON chatbot_rules FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_post_queue BEFORE UPDATE ON post_queue FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_content_queue BEFORE UPDATE ON content_queue FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_posting_schedules BEFORE UPDATE ON posting_schedules FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_media_assets BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_caption_templates BEFORE UPDATE ON caption_templates FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_hashtag_banks BEFORE UPDATE ON hashtag_banks FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_social_conversations BEFORE UPDATE ON social_conversations FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
CREATE TRIGGER handle_updated_at_social_messages BEFORE UPDATE ON social_messages FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
