-- Add new date fields and location fields to proyectos table
ALTER TABLE proyectos 
ADD COLUMN fecha_lanzamiento_proyecto date,
ADD COLUMN fecha_entrega_proyecto date,
ADD COLUMN direccion_id_pais text,
ADD COLUMN direccion_id_estado integer,
ADD COLUMN direccion_id_municipio integer;

-- Rename existing fecha_inicio to fecha_inicio_construccion  
ALTER TABLE proyectos 
RENAME COLUMN fecha_inicio TO fecha_inicio_construccion;