-- Crear menú Configuraciones/Logs
INSERT INTO public.menus (id, nombre, orden, activo)
OVERRIDING SYSTEM VALUE
VALUES (13, 'Configuraciones/Logs', 13, true)
ON CONFLICT (id) DO NOTHING;

-- Crear los 4 submenus
INSERT INTO public.submenus (id, nombre, menu_id, vista_front_end, orden, activo)
OVERRIDING SYSTEM VALUE
VALUES
(51, 'Pregunta a Aloris-IA', 13, '/admin/consultas-ia', 51, true),
(52, 'Logs de Actividad', 13, '/admin/logs-actividad', 52, true),
(53, 'Rastreo CLABEs STP', 13, '/admin/rastreo-clabes-stp', 53, true),
(54, 'Rastreo Pagos STP', 13, '/admin/rastreo-pagos-stp', 54, true)
ON CONFLICT (id) DO NOTHING;