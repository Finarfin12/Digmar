-- Chatbot Rules Table
CREATE TABLE IF NOT EXISTS chatbot_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
    trigger_keyword TEXT NOT NULL,
    reply_mode TEXT NOT NULL CHECK (reply_mode IN ('static_text', 'ai_generated', 'human_handoff')),
    response_content TEXT,
    priority INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_rules_unit_priority ON chatbot_rules(business_unit_id, priority DESC);

-- Row-Level Security
ALTER TABLE chatbot_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own data" ON chatbot_rules
    FOR ALL USING (auth.uid() = user_id);
