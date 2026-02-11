
-- Fix submenus sequence
SELECT setval(pg_get_serial_sequence('submenus', 'id'), (SELECT MAX(id) FROM submenus));

-- Menu Comunicación
INSERT INTO menus (id, nombre, orden, activo) OVERRIDING SYSTEM VALUE VALUES (14, 'Comunicación', 14, true);

-- Submenus with explicit IDs
INSERT INTO submenus (id, nombre, vista_front_end, menu_id, orden, activo) OVERRIDING SYSTEM VALUE VALUES
  (57, 'Administrar Avisos', '/admin/comunicacion/administrar-avisos', 14, 1, true),
  (58, 'Enviar Avisos', '/admin/comunicacion/enviar-avisos', 14, 2, true),
  (59, 'Ejecuciones', '/admin/comunicacion/ejecuciones', 14, 3, true);

-- Reset sequence after explicit inserts
SELECT setval(pg_get_serial_sequence('submenus', 'id'), 59);

-- Permisos disponibles para cada submenu nuevo
INSERT INTO submenus_permisos_disponibles (submenu_id, permiso_id, activo)
SELECT s.id, p.id, true
FROM submenus s
CROSS JOIN permisos p
WHERE s.menu_id = 14 AND s.activo = true;

-- Permisos para Super Admin (rol_id = 1)
INSERT INTO submenus_permisos (submenu_id, rol_id, permiso_id, activo)
SELECT s.id, 1, p.id, true
FROM submenus s
CROSS JOIN permisos p
WHERE s.menu_id = 14 AND s.activo = true;
