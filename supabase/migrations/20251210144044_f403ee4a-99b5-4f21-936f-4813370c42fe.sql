
-- Agregar todos los permisos para Super Admin en submenus faltantes

-- Submenu 37: Administradores
INSERT INTO submenus_permisos (submenu_id, permiso_id, rol_id, activo)
VALUES 
  (37, 1, 1, true),  -- leer
  (37, 2, 1, true),  -- crear
  (37, 3, 1, true),  -- actualizar
  (37, 4, 1, true),  -- eliminar
  (37, 5, 1, true),  -- aprobar
  (37, 6, 1, true),  -- exportar
  (37, 7, 1, true)   -- configurar
ON CONFLICT DO NOTHING;

-- Submenu 38: Cuentas de cobranza
INSERT INTO submenus_permisos (submenu_id, permiso_id, rol_id, activo)
VALUES 
  (38, 1, 1, true),  -- leer
  (38, 2, 1, true),  -- crear
  (38, 3, 1, true),  -- actualizar
  (38, 4, 1, true),  -- eliminar
  (38, 5, 1, true),  -- aprobar
  (38, 6, 1, true),  -- exportar
  (38, 7, 1, true)   -- configurar
ON CONFLICT DO NOTHING;
