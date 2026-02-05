INSERT INTO public.submenus (id, nombre, menu_id, vista_front_end, orden, activo)
OVERRIDING SYSTEM VALUE
VALUES (55, 'Versión Producción', 13, '/admin/version-produccion', 55, true)
ON CONFLICT (id) DO NOTHING;