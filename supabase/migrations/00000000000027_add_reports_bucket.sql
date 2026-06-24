-- Create reports storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for reports bucket
CREATE POLICY "Public access to reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports');

CREATE POLICY "Users can upload reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'reports' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update reports"
ON storage.objects FOR UPDATE
USING (bucket_id = 'reports' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete reports"
ON storage.objects FOR DELETE
USING (bucket_id = 'reports' AND auth.uid() IS NOT NULL);
