-- Remove habilitar_asignar column from caracteristicas table if it exists
ALTER TABLE caracteristicas DROP COLUMN IF EXISTS habilitar_asignar;