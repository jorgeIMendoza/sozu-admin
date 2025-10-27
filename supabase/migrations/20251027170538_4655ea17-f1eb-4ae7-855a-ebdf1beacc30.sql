-- Eliminar TODAS las políticas del bucket templates_proyecto_escritura
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname LIKE '%template%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Hacer el bucket completamente público y sin restricciones
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'templates_proyecto_escritura';

-- Crear una política permisiva que permita todo a todos
CREATE POLICY "Allow all operations on templates"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'templates_proyecto_escritura')
WITH CHECK (bucket_id = 'templates_proyecto_escritura');