-- Enable RLS on the new estatus_proyecto table
ALTER TABLE public.estatus_proyecto ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy to allow all operations for now (can be refined later)
CREATE POLICY "Allow all access to estatus_proyecto" 
ON public.estatus_proyecto 
FOR ALL 
USING (true) 
WITH CHECK (true);