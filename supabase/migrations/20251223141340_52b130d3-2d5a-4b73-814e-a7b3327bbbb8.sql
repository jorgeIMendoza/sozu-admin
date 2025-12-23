
-- Desactivar todos los permisos de reportes para roles que NO deben tener acceso
-- Roles que SÍ deben mantener acceso: 7, 12, 14, 17
UPDATE roles_reportes 
SET activo = false, fecha_actualizacion = CURRENT_TIMESTAMP
WHERE rol_id NOT IN (7, 12, 14, 17)
AND activo = true;

-- Asegurar que los roles correctos tengan acceso activo a TODOS los reportes
-- Rol 7: Administrador de Mantenimiento
-- Rol 12: Administrador de cobranza
-- Rol 14: Representante de empresa dueña
-- Rol 17: Gerente general

-- Reactivar permisos para los roles correctos (si estaban desactivados)
UPDATE roles_reportes 
SET activo = true, fecha_actualizacion = CURRENT_TIMESTAMP
WHERE rol_id IN (7, 12, 14, 17);
