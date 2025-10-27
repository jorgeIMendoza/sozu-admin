-- Crear bucket para proyectos de escritura
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proyectos_escritura',
  'proyectos_escritura',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']
);

-- Política para permitir subir archivos (usuarios autenticados)
CREATE POLICY "Usuarios autenticados pueden subir proyectos de escritura"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proyectos_escritura');

-- Política para permitir ver archivos (usuarios autenticados)
CREATE POLICY "Usuarios autenticados pueden ver proyectos de escritura"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'proyectos_escritura');

-- Política para permitir actualizar archivos (usuarios autenticados)
CREATE POLICY "Usuarios autenticados pueden actualizar proyectos de escritura"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'proyectos_escritura');

-- Política para permitir eliminar archivos (usuarios autenticados)
CREATE POLICY "Usuarios autenticados pueden eliminar proyectos de escritura"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'proyectos_escritura');