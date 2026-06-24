-- Create ai_brand_voices table
CREATE TABLE IF NOT EXISTS public.ai_brand_voices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    tone_guidelines TEXT,
    dos JSONB DEFAULT '[]'::jsonb,
    donts JSONB DEFAULT '[]'::jsonb,
    example_posts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(business_unit_id)
);

-- Create ai_generation_history table
CREATE TABLE IF NOT EXISTS public.ai_generation_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL,
    tone VARCHAR(100),
    output_caption TEXT,
    output_hashtags TEXT,
    output_thread TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.ai_brand_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_history ENABLE ROW LEVEL SECURITY;

-- Create Policies for ai_brand_voices
CREATE POLICY "Users can view ai_brand_voices for their business units" 
    ON public.ai_brand_voices FOR SELECT 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert ai_brand_voices for their business units" 
    ON public.ai_brand_voices FOR INSERT 
    WITH CHECK (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update ai_brand_voices for their business units" 
    ON public.ai_brand_voices FOR UPDATE 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

-- Create Policies for ai_generation_history
CREATE POLICY "Users can view ai_generation_history for their business units" 
    ON public.ai_generation_history FOR SELECT 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert ai_generation_history for their business units" 
    ON public.ai_generation_history FOR INSERT 
    WITH CHECK (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

NOTIFY pgrst, 'reload schema';
