-- Add facturar and nombre_api_key columns to entidades_relacionadas table
ALTER TABLE public.entidades_relacionadas 
ADD COLUMN IF NOT EXISTS facturar BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.entidades_relacionadas 
ADD COLUMN IF NOT EXISTS nombre_api_key TEXT;

-- Add comment to explain the columns
COMMENT ON COLUMN public.entidades_relacionadas.facturar IS 'Indica si la entidad debe facturar';
COMMENT ON COLUMN public.entidades_relacionadas.nombre_api_key IS 'Nombre de la API key almacenada en Supabase Secrets';