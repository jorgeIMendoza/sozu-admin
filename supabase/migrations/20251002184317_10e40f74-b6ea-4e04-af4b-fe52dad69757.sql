-- Renombrar columna id_persona a id_entidad_relacionada_dueno en productos_servicios
ALTER TABLE productos_servicios 
RENAME COLUMN id_persona TO id_entidad_relacionada_dueno;

-- Actualizar el comentario de la columna si existe
COMMENT ON COLUMN productos_servicios.id_entidad_relacionada_dueno IS 'Referencia a la entidad relacionada dueña del producto/servicio';