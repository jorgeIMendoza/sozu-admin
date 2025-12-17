-- Add new column for controlling visibility of advanced filters and deleted tab
ALTER TABLE public.roles 
ADD COLUMN ver_filtros_avanzados_eliminados boolean NOT NULL DEFAULT true;

-- Set to false only for Agente Inmobiliario (id=3)
UPDATE public.roles 
SET ver_filtros_avanzados_eliminados = false 
WHERE id = 3;