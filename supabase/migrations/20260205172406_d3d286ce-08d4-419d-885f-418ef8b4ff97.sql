-- Table to define which permissions are available for each submenu
CREATE TABLE public.submenus_permisos_disponibles (
    id SERIAL PRIMARY KEY,
    submenu_id INTEGER NOT NULL REFERENCES public.submenus(id) ON DELETE CASCADE,
    permiso_id INTEGER NOT NULL REFERENCES public.permisos(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(submenu_id, permiso_id)
);

-- Enable RLS
ALTER TABLE public.submenus_permisos_disponibles ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read
CREATE POLICY "Authenticated users can read submenus_permisos_disponibles"
ON public.submenus_permisos_disponibles FOR SELECT
TO authenticated
USING (true);

-- Policy for super admin to manage
CREATE POLICY "Super admin can manage submenus_permisos_disponibles"
ON public.submenus_permisos_disponibles FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_user_id = auth.uid()
        AND u.rol_id = 1
        AND u.activo = true
    )
);

-- Initialize: Add all 7 permissions for all existing submenus (so current behavior is preserved)
INSERT INTO public.submenus_permisos_disponibles (submenu_id, permiso_id)
SELECT s.id, p.id
FROM public.submenus s
CROSS JOIN public.permisos p
WHERE p.activo = true
ON CONFLICT (submenu_id, permiso_id) DO NOTHING;