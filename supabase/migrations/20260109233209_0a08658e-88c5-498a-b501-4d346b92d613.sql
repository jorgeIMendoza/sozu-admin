-- Cambiar propiedad 203 de Daiku (id 5201) a estatus "Apartado" (4)
UPDATE propiedades 
SET id_estatus_disponibilidad = 4, fecha_actualizacion = NOW() 
WHERE id = 5201;