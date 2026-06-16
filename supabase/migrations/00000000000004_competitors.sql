-- Migration: 00000000000004_competitors.sql

CREATE TABLE IF NOT EXISTS public.competitor_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'instagram',
    top_posts_json JSONB DEFAULT '[]'::jsonb,
    metrics_json JSONB DEFAULT '{}'::jsonb,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.competitor_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own competitors" 
ON public.competitor_tracking 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
