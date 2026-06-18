-- Fitur 2: Omnichannel Smart Inbox

-- Tabel percakapan (Conversation)
-- Mengelompokkan pesan berdasarkan pengirim (customer) atau thread komentar
CREATE TABLE IF NOT EXISTS social_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- meta_ig, facebook, threads, tiktok
    type TEXT NOT NULL CHECK (type IN ('dm', 'comment')),
    customer_id TEXT NOT NULL, -- ID dari platform asalnya
    customer_name TEXT NOT NULL,
    customer_avatar_url TEXT,
    latest_message TEXT,
    latest_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ai_sentiment TEXT DEFAULT 'netral', -- positif, negatif, netral, keluhan, tanya_harga
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabel isi pesan (Message)
CREATE TABLE IF NOT EXISTS social_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'brand', 'ai_auto')),
    content TEXT NOT NULL,
    media_url TEXT,
    platform_message_id TEXT, -- ID asli pesan dari API Instagram/dll
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes untuk mempercepat Inbox
CREATE INDEX IF NOT EXISTS idx_social_conversations_unit ON social_conversations(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_social_conversations_updated ON social_conversations(latest_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_messages_convo ON social_messages(conversation_id, created_at ASC);

-- Row-Level Security (RLS)
ALTER TABLE social_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users see own data" ON social_conversations;
    DROP POLICY IF EXISTS "Users see own data" ON social_messages;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Users see own data" ON social_conversations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM business_units 
            WHERE business_units.id = social_conversations.business_unit_id 
            AND business_units.user_id = auth.uid()
        )
    );

CREATE POLICY "Users see own data" ON social_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM social_conversations 
            JOIN business_units ON business_units.id = social_conversations.business_unit_id
            WHERE social_conversations.id = social_messages.conversation_id 
            AND business_units.user_id = auth.uid()
        )
    );
