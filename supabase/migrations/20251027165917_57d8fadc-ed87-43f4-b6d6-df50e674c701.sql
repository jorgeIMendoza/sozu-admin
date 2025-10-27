-- Primero, asegurar que el bucket existe con configuración correcta
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'templates_proyecto_escritura') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('templates_proyecto_escritura', 'templates_proyecto_escritura', true);
  ELSE
    UPDATE storage.buckets 
    SET public = true 
    WHERE id = 'templates_proyecto_escritura';
  END IF;
END $$;

-- Eliminar todas las políticas existentes para este bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload templates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view templates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update templates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete templates" ON storage.objects;

-- Crear políticas más específicas para el bucket templates_proyecto_escritura
CREATE POLICY "authenticated_users_insert_templates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'templates_proyecto_escritura'
);

CREATE POLICY "authenticated_users_select_templates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'templates_proyecto_escritura'
);

CREATE POLICY "authenticated_users_update_templates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'templates_proyecto_escritura'
)
WITH CHECK (
  bucket_id = 'templates_proyecto_escritura'
);

CREATE POLICY "authenticated_users_delete_templates"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'templates_proyecto_escritura'
);

-- También permitir acceso público para leer (opcional, según tus necesidades)
CREATE POLICY "public_users_select_templates"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'templates_proyecto_escritura'
);