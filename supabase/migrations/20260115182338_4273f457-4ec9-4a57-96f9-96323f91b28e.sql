-- Actualizar todos los agentes existentes para que tengan tipo_persona = 'pf'
UPDATE public.personas p
SET tipo_persona = 'pf'
FROM public.entidades_relacionadas er
WHERE er.id_persona = p.id
AND er.id_tipo_entidad = 19
AND er.activo = true
AND (p.tipo_persona IS NULL OR p.tipo_persona = 'fisica');