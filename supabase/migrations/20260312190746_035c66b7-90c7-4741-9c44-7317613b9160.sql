
-- Add plano_arquitectonico column to modelos table
ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS plano_arquitectonico text;

-- Create storage bucket for modelo images
INSERT INTO storage.buckets (id, name, public)
VALUES ('modelos', 'modelos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to modelos bucket
CREATE POLICY "Authenticated users can upload modelo images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'modelos');

-- Allow public read access
CREATE POLICY "Public read access for modelo images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'modelos');

-- Allow authenticated users to update/delete
CREATE POLICY "Authenticated users can update modelo images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'modelos');

CREATE POLICY "Authenticated users can delete modelo images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'modelos');
