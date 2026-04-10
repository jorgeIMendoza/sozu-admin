INSERT INTO storage.buckets (id, name, public)
VALUES ('legacy-uploads', 'legacy-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read legacy-uploads"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'legacy-uploads');

CREATE POLICY "Service insert legacy-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'legacy-uploads');