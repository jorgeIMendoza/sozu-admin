-- Agregar todos los permisos de Comisiones Externas al Super Administrador (rol_id = 1)
-- El submenu de comisiones-externas tiene id = 45

-- Insertar permisos para Super Admin en Comisiones Externas
INSERT INTO public.submenus_permisos (submenu_id, rol_id, permiso_id, activo)
SELECT 
  45 as submenu_id,
  1 as rol_id,
  p.id as permiso_id,
  true as activo
FROM public.permisos p
WHERE p.activo = true
ON CONFLICT (submenu_id, rol_id, permiso_id) 
DO UPDATE SET activo = true;