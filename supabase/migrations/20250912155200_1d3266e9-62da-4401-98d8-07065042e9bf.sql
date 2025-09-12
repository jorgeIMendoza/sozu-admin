-- Add new decimal fields to proyectos table
ALTER TABLE proyectos 
ADD COLUMN IF NOT EXISTS costo_mantenimiento_m2 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS porcentaje_anual_cuota_extraordinaria NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS porcentaje_anual_cuota_estancia_corta NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS porcentaje_anual_cuota_garantia_renta NUMERIC(5,2);