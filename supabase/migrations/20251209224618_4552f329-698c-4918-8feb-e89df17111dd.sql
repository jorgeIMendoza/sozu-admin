-- Add unique constraint for submenus_permisos table
-- This allows the upsert operation to work correctly when saving permissions

ALTER TABLE public.submenus_permisos 
ADD CONSTRAINT submenus_permisos_unique_submenu_permiso_rol 
UNIQUE (submenu_id, permiso_id, rol_id);