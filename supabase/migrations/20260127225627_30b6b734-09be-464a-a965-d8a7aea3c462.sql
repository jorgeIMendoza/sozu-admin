-- Drop the existing unique constraint
ALTER TABLE public.entidades_relacionadas 
DROP CONSTRAINT IF EXISTS uq_entrel_persona_tipo_proy;

-- Create a new unique constraint that includes cuenta_madre_stp
-- This allows the same persona to be added multiple times to a project
-- as long as they have different cuenta_madre_stp values
-- Note: We use COALESCE to handle NULL values - treating NULL as a unique value
CREATE UNIQUE INDEX uq_entrel_persona_tipo_proy_cuenta 
ON public.entidades_relacionadas (id_persona, id_tipo_entidad, id_proyecto, COALESCE(cuenta_madre_stp, ''))
WHERE activo = true;