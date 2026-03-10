-- Insert menu "Portal del Cliente" with OVERRIDING SYSTEM VALUE
INSERT INTO menus (id, nombre, orden, activo) OVERRIDING SYSTEM VALUE VALUES (18, 'Portal del Cliente', 18, true);

-- Insert submenus
INSERT INTO submenus (nombre, vista_front_end, menu_id, orden, activo) VALUES
  ('Inicio', '/admin/portal-cliente/inicio', 18, 1, true),
  ('Propiedades', '/admin/portal-cliente/propiedades', 18, 2, true),
  ('Perfil', '/admin/portal-cliente/perfil', 18, 3, true);

-- Grant read permissions to Super Admin (rol_id=1)
INSERT INTO submenus_permisos (submenu_id, rol_id, permiso_id, activo)
SELECT s.id, 1, p.id, true
FROM submenus s, permisos p
WHERE s.menu_id = 18 AND p.nombre = 'leer';