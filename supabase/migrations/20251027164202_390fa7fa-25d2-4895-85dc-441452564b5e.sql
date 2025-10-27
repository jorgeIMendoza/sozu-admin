-- Crear bucket para templates de proyecto de escritura
INSERT INTO storage.buckets (id, name, public)
VALUES ('templates_proyecto_escritura', 'templates_proyecto_escritura', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para el bucket templates_proyecto_escritura
-- Permitir lectura a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden ver templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'templates_proyecto_escritura');

-- Permitir subir templates a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden subir templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'templates_proyecto_escritura');

-- Permitir actualizar templates a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden actualizar templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'templates_proyecto_escritura');

-- Permitir eliminar templates a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden eliminar templates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'templates_proyecto_escritura');