-- 1. Agregar permisos leer (1) y exportar (6) para submenus de Reportes
-- Submenu 40 = Inventarios, Submenu 41 = Finanzas

-- Agregar permisos disponibles para Inventarios (submenu 40) - sin rol_id para la configuración global
INSERT INTO public.submenus_permisos (submenu_id, permiso_id, activo)
SELECT 40, 1, true WHERE NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos 
    WHERE submenu_id = 40 AND permiso_id = 1 AND rol_id IS NULL
);

INSERT INTO public.submenus_permisos (submenu_id, permiso_id, activo)
SELECT 40, 6, true WHERE NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos 
    WHERE submenu_id = 40 AND permiso_id = 6 AND rol_id IS NULL
);

-- Agregar permisos disponibles para Finanzas (submenu 41)
INSERT INTO public.submenus_permisos (submenu_id, permiso_id, activo)
SELECT 41, 1, true WHERE NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos 
    WHERE submenu_id = 41 AND permiso_id = 1 AND rol_id IS NULL
);

INSERT INTO public.submenus_permisos (submenu_id, permiso_id, activo)
SELECT 41, 6, true WHERE NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos 
    WHERE submenu_id = 41 AND permiso_id = 6 AND rol_id IS NULL
);

-- 2. Asignar estos permisos al Super Admin (rol_id = 1)
INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id, activo)
SELECT 40, 1, 1, true WHERE NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos 
    WHERE submenu_id = 40 AND permiso_id = 1 AND rol_id = 1
);

INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id, activo)
SELECT 40, 6, 1, true WHERE NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos 
    WHERE submenu_id = 40 AND permiso_id = 6 AND rol_id = 1
);

INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id, activo)
SELECT 41, 1, 1, true WHERE NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos 
    WHERE submenu_id = 41 AND permiso_id = 1 AND rol_id = 1
);

INSERT INTO public.submenus_permisos (submenu_id, permiso_id, rol_id, activo)
SELECT 41, 6, 1, true WHERE NOT EXISTS (
    SELECT 1 FROM public.submenus_permisos 
    WHERE submenu_id = 41 AND permiso_id = 6 AND rol_id = 1
);

-- 3. Ocultar el submenu "Configuración de Reportes" (id=42) de la matriz de permisos
UPDATE public.submenus SET activo = false WHERE id = 42;