-- Insert submenu for Representantes Comerciales
INSERT INTO submenus (nombre, vista_front_end, menu_id, activo)
VALUES ('Representantes Comerciales', '/admin/representantes-comerciales', 4, true);

-- Get the new submenu ID and all permission IDs, then insert permissions for Super Admin (rol_id = 1)
INSERT INTO submenus_permisos (submenu_id, permiso_id, rol_id, activo)
SELECT 
  (SELECT id FROM submenus WHERE vista_front_end = '/admin/representantes-comerciales'),
  p.id,
  1, -- Super Admin role
  true
FROM permisos p
WHERE p.activo = true;