-- Alter business_units to add serpapi fields
ALTER TABLE public.business_units
ADD COLUMN IF NOT EXISTS use_serpapi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS serpapi_key TEXT;

-- Create api_usage_logs table
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    api_name TEXT NOT NULL, -- e.g. 'serpapi'
    endpoint TEXT, -- e.g. 'google_trends'
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    month_key TEXT NOT NULL -- e.g. '2026-06'
);

-- Create index for quick usage counting
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_bu_month ON public.api_usage_logs(business_unit_id, api_name, month_key);

-- Create serpapi_caches table
CREATE TABLE IF NOT EXISTS public.serpapi_caches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    search_type TEXT NOT NULL, -- 'trends', 'hashtag', 'competitor'
    query TEXT NOT NULL,
    result_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index for cache lookup
CREATE INDEX IF NOT EXISTS idx_serpapi_caches_lookup ON public.serpapi_caches(business_unit_id, search_type, query);

-- Add RLS Policies
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serpapi_caches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own api usage" 
ON public.api_usage_logs FOR INSERT 
WITH CHECK (
  business_unit_id IN (SELECT id FROM public.business_units WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view their own api usage" 
ON public.api_usage_logs FOR SELECT 
USING (
  business_unit_id IN (SELECT id FROM public.business_units WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage their own caches" 
ON public.serpapi_caches FOR ALL 
USING (
  business_unit_id IN (SELECT id FROM public.business_units WHERE user_id = auth.uid())
)
WITH CHECK (
  business_unit_id IN (SELECT id FROM public.business_units WHERE user_id = auth.uid())
);
