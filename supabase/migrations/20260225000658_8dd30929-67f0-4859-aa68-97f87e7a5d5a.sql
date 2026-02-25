
-- 1. Configurar permisos disponibles para cada submenu del Portal Agente
-- Permisos: leer(1), actualizar(3), generar_oferta(8)
INSERT INTO submenus_permisos_disponibles (submenu_id, permiso_id)
SELECT s.id, p.id
FROM (VALUES (67),(68),(69),(70),(71)) AS s(id)
CROSS JOIN (VALUES (1),(3),(8)) AS p(id)
ON CONFLICT DO NOTHING;

-- 2. Asignar permisos a Super Administrador (rol 1) y Agente Inmobiliario (rol 3)
INSERT INTO submenus_permisos (submenu_id, rol_id, permiso_id, activo)
SELECT s.id, r.id, p.id, true
FROM (VALUES (67),(68),(69),(70),(71)) AS s(id)
CROSS JOIN (VALUES (1),(3)) AS r(id)
CROSS JOIN (VALUES (1),(3),(8)) AS p(id)
ON CONFLICT DO NOTHING;
