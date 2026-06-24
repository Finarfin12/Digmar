-- Create agency_reports table
CREATE TABLE IF NOT EXISTS public.agency_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    report_name TEXT NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    date_range_start TIMESTAMP WITH TIME ZONE,
    date_range_end TIMESTAMP WITH TIME ZONE,
    included_accounts JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'READY',
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create agency_report_schedules table
CREATE TABLE IF NOT EXISTS public.agency_report_schedules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
    report_name TEXT NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- WEEKLY, MONTHLY
    recipients JSONB DEFAULT '[]'::jsonb,
    included_accounts JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.agency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_report_schedules ENABLE ROW LEVEL SECURITY;

-- Create Policies for agency_reports
CREATE POLICY "Users can view agency_reports for their business units" 
    ON public.agency_reports FOR SELECT 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert agency_reports for their business units" 
    ON public.agency_reports FOR INSERT 
    WITH CHECK (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update agency_reports for their business units" 
    ON public.agency_reports FOR UPDATE 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete agency_reports for their business units" 
    ON public.agency_reports FOR DELETE 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

-- Create Policies for agency_report_schedules
CREATE POLICY "Users can view agency_report_schedules for their business units" 
    ON public.agency_report_schedules FOR SELECT 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert agency_report_schedules for their business units" 
    ON public.agency_report_schedules FOR INSERT 
    WITH CHECK (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update agency_report_schedules for their business units" 
    ON public.agency_report_schedules FOR UPDATE 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete agency_report_schedules for their business units" 
    ON public.agency_report_schedules FOR DELETE 
    USING (business_unit_id IN (
        SELECT id FROM public.business_units WHERE user_id = auth.uid()
    ));

NOTIFY pgrst, 'reload schema';
