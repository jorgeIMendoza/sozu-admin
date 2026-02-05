-- Add solo_usuarioA column to submenus table
ALTER TABLE public.submenus 
ADD COLUMN IF NOT EXISTS solo_usuarioA BOOLEAN DEFAULT false;

-- Insert the new submenu for Administrar Menus
INSERT INTO public.submenus (id, nombre, menu_id, vista_front_end, orden, activo, solo_usuarioA)
OVERRIDING SYSTEM VALUE
VALUES (56, 'Administrar Menus', 13, '/admin/administrar-menus', 56, true, true)
ON CONFLICT (id) DO NOTHING;

-- Insert permissions for Super Admin (rol_id=1) for the new submenu
INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id, activo)
SELECT 56, id, 1, true FROM permisos
ON CONFLICT DO NOTHING;