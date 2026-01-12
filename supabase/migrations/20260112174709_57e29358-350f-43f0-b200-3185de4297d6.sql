-- Insertar permisos para el submenu "Usuarios Directivos" (id 43) para Super Administrador (rol_id 1)
INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id)
SELECT 43, p.id, 1
FROM public.permisos p
WHERE p.nombre IN ('leer', 'crear', 'actualizar', 'eliminar', 'aprobar', 'exportar')
ON CONFLICT DO NOTHING;