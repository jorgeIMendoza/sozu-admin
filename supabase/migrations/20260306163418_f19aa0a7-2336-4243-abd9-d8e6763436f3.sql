
-- Migration: Assign all public Sozu projects to independent agents
-- Independent agents = users with rol_id = 3, active, who do NOT have an entry
-- in entidades_relacionadas with id_tipo_entidad = 19 (or whose entry has null id_persona_duena_lead)

INSERT INTO public.proyectos_acceso (usuario_id, proyecto_id, activo)
SELECT u.email, p.id, true
FROM usuarios u
CROSS JOIN proyectos p
WHERE u.rol_id = 3
  AND u.activo = true
  AND p.activo = true
  AND p.publicar = true
  AND NOT EXISTS (
    -- Exclude agents that have an inmobiliaria linked
    SELECT 1 FROM entidades_relacionadas er
    WHERE er.id_persona = u.id_persona
      AND er.id_tipo_entidad = 19
      AND er.activo = true
      AND er.id_persona_duena_lead IS NOT NULL
  )
  AND NOT EXISTS (
    -- Avoid duplicates
    SELECT 1 FROM proyectos_acceso pa
    WHERE pa.usuario_id = u.email
      AND pa.proyecto_id = p.id
  );
