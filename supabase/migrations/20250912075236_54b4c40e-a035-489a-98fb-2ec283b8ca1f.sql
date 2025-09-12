-- Add latitude and longitude columns to proyectos table
ALTER TABLE public.proyectos 
ADD COLUMN latitud DECIMAL(10, 8),
ADD COLUMN longitud DECIMAL(11, 8);