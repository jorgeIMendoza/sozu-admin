-- Agregar foreign key constraint entre propiedades y edificios_modelos
-- Esta relación es necesaria para las queries que usan edificios_modelos!propiedades_id_edificio_modelo_fkey

ALTER TABLE propiedades 
ADD CONSTRAINT propiedades_id_edificio_modelo_fkey 
FOREIGN KEY (id_edificio_modelo) 
REFERENCES edificios_modelos(id) 
ON DELETE RESTRICT 
ON UPDATE CASCADE;

-- Crear índice para mejorar el rendimiento de las queries con JOIN
CREATE INDEX IF NOT EXISTS idx_propiedades_id_edificio_modelo 
ON propiedades(id_edificio_modelo) 
WHERE id_edificio_modelo IS NOT NULL;