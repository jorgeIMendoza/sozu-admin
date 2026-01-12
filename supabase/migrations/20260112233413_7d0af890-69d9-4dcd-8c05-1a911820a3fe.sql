-- Crear función SECURITY DEFINER para obtener nombres de usuarios por email
-- Esto evita problemas de RLS y permite que cualquier usuario autenticado 
-- pueda ver los nombres de los comisionistas
CREATE OR REPLACE FUNCTION public.get_usuarios_by_emails(_emails text[])
RETURNS TABLE(email text, nombre text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email, u.nombre
  FROM usuarios u
  WHERE u.email = ANY(_emails);
$$;