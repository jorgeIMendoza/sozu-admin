-- Update submenu "Mi inventario" (ID 47) route from /admin/inmobiliarias/mis-propiedades to /admin/inmobiliarias/inventario
UPDATE public.submenus 
SET vista_front_end = '/admin/inmobiliarias/inventario',
    fecha_actualizacion = now()
WHERE id = 47;