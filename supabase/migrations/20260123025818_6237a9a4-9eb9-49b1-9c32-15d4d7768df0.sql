-- Rollback para pruebas: Eliminar aplicaciones y desactivar pago HSB5290755
DELETE FROM aplicaciones_pago WHERE id IN (31180, 31181);

UPDATE pagos SET activo = false, fecha_actualizacion = CURRENT_TIMESTAMP 
WHERE id = 3584 AND clave_rastreo = 'HSB5290755';