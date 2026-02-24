
-- Crear menú padre para el Portal de Agente
INSERT INTO menus (id, nombre, orden, activo)
OVERRIDING SYSTEM VALUE
VALUES (16, 'Portal Agente', 16, true)
ON CONFLICT (id) DO NOTHING;

-- Crear submenús para cada tab del portal
INSERT INTO submenus (id, nombre, vista_front_end, menu_id, orden, activo)
OVERRIDING SYSTEM VALUE
VALUES
  (67, 'Inicio', '/admin/agent/inicio', 16, 1, true),
  (68, 'Inventario', '/admin/agent/inventario', 16, 2, true),
  (69, 'Pipeline', '/admin/agent/pipeline', 16, 3, true),
  (70, 'Comisiones', '/admin/agent/comisiones', 16, 4, true),
  (71, 'Perfil', '/admin/agent/perfil', 16, 5, true)
ON CONFLICT (id) DO NOTHING;
