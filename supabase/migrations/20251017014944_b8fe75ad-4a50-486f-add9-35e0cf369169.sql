-- Agregar constraint única para prevenir duplicados en modelos_caracteristicas
-- Esta constraint asegura que no haya registros duplicados de (id_modelo, id_caracteristica)
ALTER TABLE modelos_caracteristicas 
ADD CONSTRAINT modelos_caracteristicas_modelo_caracteristica_unique 
UNIQUE (id_modelo, id_caracteristica);