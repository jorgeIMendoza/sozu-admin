-- Habilitar RLS en la tabla documentos si no está habilitado
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- Política para permitir a usuarios autenticados insertar documentos
CREATE POLICY "Usuarios autenticados pueden insertar documentos"
ON public.documentos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para permitir a usuarios autenticados ver documentos
CREATE POLICY "Usuarios autenticados pueden ver documentos"
ON public.documentos
FOR SELECT
TO authenticated
USING (true);

-- Política para permitir a usuarios autenticados actualizar documentos
CREATE POLICY "Usuarios autenticados pueden actualizar documentos"
ON public.documentos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Política para permitir a usuarios autenticados eliminar documentos
CREATE POLICY "Usuarios autenticados pueden eliminar documentos"
ON public.documentos
FOR DELETE
TO authenticated
USING (true);