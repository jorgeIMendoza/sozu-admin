-- Habilitar RLS en tabla comisionistas
ALTER TABLE public.comisionistas ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura de comisionistas a usuarios autenticados
CREATE POLICY "Permitir lectura de comisionistas a usuarios autenticados"
ON public.comisionistas
FOR SELECT
TO authenticated
USING (true);

-- Política para permitir lectura de comisionistas con anon key (para admin)
CREATE POLICY "Permitir lectura de comisionistas con anon"
ON public.comisionistas
FOR SELECT
TO anon
USING (true);

-- Habilitar RLS en tabla usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura de usuarios a usuarios autenticados
CREATE POLICY "Permitir lectura de usuarios a usuarios autenticados"
ON public.usuarios
FOR SELECT
TO authenticated
USING (true);

-- Política para permitir lectura de usuarios con anon key (para admin)
CREATE POLICY "Permitir lectura de usuarios con anon"
ON public.usuarios
FOR SELECT
TO anon
USING (true);