-- Función para verificar si el usuario es Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    WHERE u.email = auth.email()
    AND r.nombre = 'Super Administrador'
  )
$$;

-- Política para INSERT en roles_reportes
CREATE POLICY "Super admins can insert roles_reportes"
ON public.roles_reportes
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

-- Política para UPDATE en roles_reportes
CREATE POLICY "Super admins can update roles_reportes"
ON public.roles_reportes
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Política para DELETE en roles_reportes
CREATE POLICY "Super admins can delete roles_reportes"
ON public.roles_reportes
FOR DELETE
TO authenticated
USING (public.is_super_admin());