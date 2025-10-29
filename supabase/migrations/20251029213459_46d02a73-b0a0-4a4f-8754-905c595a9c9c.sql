
-- Habilitar RLS en la tabla comisionistas
ALTER TABLE public.comisionistas ENABLE ROW LEVEL SECURITY;

-- Agregar políticas de UPDATE e INSERT para usuarios autenticados
CREATE POLICY "Permitir actualización de comisionistas a usuarios autenticados"
ON public.comisionistas
FOR UPDATE
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir inserción de comisionistas a usuarios autenticados"
ON public.comisionistas
FOR INSERT
TO authenticated, anon
WITH CHECK (true);
