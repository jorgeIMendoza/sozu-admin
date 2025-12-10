
-- Agregar todos los permisos de Roles y Permisos para Super Admin
INSERT INTO submenus_permisos (submenu_id, permiso_id, rol_id, activo)
VALUES 
  (36, 1, 1, true),  -- leer
  (36, 2, 1, true),  -- crear
  (36, 3, 1, true),  -- actualizar
  (36, 4, 1, true),  -- eliminar
  (36, 5, 1, true),  -- aprobar
  (36, 6, 1, true),  -- exportar
  (36, 7, 1, true)   -- configurar
ON CONFLICT DO NOTHING;
