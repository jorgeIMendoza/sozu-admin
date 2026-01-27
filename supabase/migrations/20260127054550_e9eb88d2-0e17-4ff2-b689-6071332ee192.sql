-- Solo actualizar el estatus, no es cambio de schema pero usamos esto para UPDATE
-- Actualizar el estatus de la propiedad 307 (id 5218) a Inventario (id 1)
UPDATE propiedades 
SET id_estatus_disponibilidad = 1, fecha_actualizacion = now()
WHERE id = 5218;