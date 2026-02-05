-- 1. Add orden column to menus table
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS orden integer DEFAULT 100;

-- 2. Update orden values to maintain order with Datos Inmobiliarios after Entidades
UPDATE public.menus SET orden = 1 WHERE id = 1;  -- Dashboard
UPDATE public.menus SET orden = 2 WHERE id = 2;  -- Inventarios
UPDATE public.menus SET orden = 3 WHERE id = 3;  -- Entidades
UPDATE public.menus SET orden = 4 WHERE id = 12; -- Inmobiliarias -> will be renamed
UPDATE public.menus SET orden = 5 WHERE id = 4;  -- Personas
UPDATE public.menus SET orden = 6 WHERE id = 5;  -- Productos
UPDATE public.menus SET orden = 7 WHERE id = 6;  -- Finanzas
UPDATE public.menus SET orden = 8 WHERE id = 7;  -- Mantenimientos
UPDATE public.menus SET orden = 9 WHERE id = 8;  -- Notario
UPDATE public.menus SET orden = 10 WHERE id = 9; -- Legal
UPDATE public.menus SET orden = 11 WHERE id = 11; -- Reportes
UPDATE public.menus SET orden = 12 WHERE id = 10; -- Sistema

-- 3. Rename "Inmobiliarias" menu to "Datos Inmobiliarios"
UPDATE public.menus SET nombre = 'Datos Inmobiliarios' WHERE id = 12;