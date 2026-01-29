
-- Fix the trigger to include both Agente Inmobiliario (3) AND Agente Interno (9)
CREATE OR REPLACE FUNCTION public.sync_inmobiliaria_project_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inmobiliaria_persona_id INT;
  agent_email TEXT;
BEGIN
  -- Only process if the user has role 4 (Inmobiliaria)
  IF EXISTS (
    SELECT 1 FROM usuarios u 
    WHERE u.email = COALESCE(NEW.usuario_id, OLD.usuario_id) 
    AND u.rol_id = 4
  ) THEN
    -- Get the persona_id of the inmobiliaria
    SELECT p.id INTO inmobiliaria_persona_id
    FROM usuarios u
    JOIN personas p ON p.email = u.email
    WHERE u.email = COALESCE(NEW.usuario_id, OLD.usuario_id)
    AND u.rol_id = 4;

    IF inmobiliaria_persona_id IS NOT NULL THEN
      -- Handle INSERT or UPDATE - propagate access to agents
      IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Find all agents linked to this inmobiliaria (both Agente Inmobiliario AND Agente Interno)
        FOR agent_email IN
          SELECT u.email
          FROM entidades_relacionadas er
          JOIN personas p ON p.id = er.id_persona
          JOIN usuarios u ON u.email = p.email
          WHERE er.id_persona_duena_lead = inmobiliaria_persona_id
          AND er.id_tipo_entidad = 19 -- Agente
          AND er.activo = true
          AND u.rol_id IN (3, 9) -- Agente Inmobiliario (3) AND Agente Interno (9)
          AND u.activo = true
        LOOP
          INSERT INTO proyectos_acceso (usuario_id, proyecto_id, id_entidad_relacionada_dueno, activo)
          VALUES (agent_email, NEW.proyecto_id, NEW.id_entidad_relacionada_dueno, NEW.activo)
          ON CONFLICT (usuario_id, proyecto_id) 
          DO UPDATE SET 
            id_entidad_relacionada_dueno = EXCLUDED.id_entidad_relacionada_dueno,
            activo = EXCLUDED.activo,
            fecha_actualizacion = now();
        END LOOP;
      END IF;

      -- Handle DELETE - remove access from agents
      IF TG_OP = 'DELETE' THEN
        FOR agent_email IN
          SELECT u.email
          FROM entidades_relacionadas er
          JOIN personas p ON p.id = er.id_persona
          JOIN usuarios u ON u.email = p.email
          WHERE er.id_persona_duena_lead = inmobiliaria_persona_id
          AND er.id_tipo_entidad = 19
          AND er.activo = true
          AND u.rol_id IN (3, 9) -- Both agent types
          AND u.activo = true
        LOOP
          DELETE FROM proyectos_acceso 
          WHERE usuario_id = agent_email 
          AND proyecto_id = OLD.proyecto_id;
        END LOOP;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Now sync the existing data: give all Agente Interno users the same access as their Inmobiliaria
INSERT INTO proyectos_acceso (usuario_id, proyecto_id, id_entidad_relacionada_dueno, activo)
SELECT 
  u.email,
  pa.proyecto_id,
  pa.id_entidad_relacionada_dueno,
  true
FROM usuarios u
JOIN entidades_relacionadas er ON er.id_persona = u.id_persona AND er.id_tipo_entidad = 19 AND er.activo = true
JOIN usuarios inmob ON inmob.id_persona = er.id_persona_duena_lead AND inmob.rol_id = 4 AND inmob.activo = true
JOIN proyectos_acceso pa ON pa.usuario_id = inmob.email AND pa.activo = true
WHERE u.rol_id = 9 -- Agente Interno
AND u.activo = true
ON CONFLICT (usuario_id, proyecto_id) 
DO UPDATE SET 
  id_entidad_relacionada_dueno = EXCLUDED.id_entidad_relacionada_dueno,
  activo = EXCLUDED.activo,
  fecha_actualizacion = now();
