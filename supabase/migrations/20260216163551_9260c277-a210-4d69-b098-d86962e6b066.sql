-- Add facturar_comision_sozu flag to entidades_relacionadas
ALTER TABLE public.entidades_relacionadas 
ADD COLUMN IF NOT EXISTS facturar_comision_sozu boolean NOT NULL DEFAULT false;

-- Set JMDQ (entity id 1108) to true
UPDATE public.entidades_relacionadas 
SET facturar_comision_sozu = true 
WHERE id = 1108;