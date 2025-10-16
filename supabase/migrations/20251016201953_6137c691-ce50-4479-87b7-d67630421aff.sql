-- Agregar columnas de metros cuadrados detallados a la tabla propiedades
ALTER TABLE propiedades
ADD COLUMN IF NOT EXISTS m2_interiores NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS m2_exteriores NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS m2_loft NUMERIC DEFAULT 0;

-- Agregar comentarios a las columnas para documentación
COMMENT ON COLUMN propiedades.m2_interiores IS 'Metros cuadrados interiores de la propiedad';
COMMENT ON COLUMN propiedades.m2_exteriores IS 'Metros cuadrados exteriores de la propiedad (antes m2_escriturables)';
COMMENT ON COLUMN propiedades.m2_loft IS 'Metros cuadrados del loft (si aplica)';