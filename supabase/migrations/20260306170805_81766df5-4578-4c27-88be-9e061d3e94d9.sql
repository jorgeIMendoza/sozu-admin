-- Restore affected agents to visible "Desactivados" state:
-- keep relationship active, set user account inactive.
UPDATE public.usuarios
SET activo = false,
    fecha_actualizacion = now()
WHERE lower(email) IN (
  'luis.vielma@investimento.mx',
  'allan.diaz@sozu.com',
  'bernardo.ortiz@sozu.com'
);

UPDATE public.entidades_relacionadas er
SET activo = true,
    fecha_actualizacion = now()
WHERE er.id_tipo_entidad = 19
  AND er.id_persona IN (
    SELECT u.id_persona
    FROM public.usuarios u
    WHERE lower(u.email) IN (
      'luis.vielma@investimento.mx',
      'allan.diaz@sozu.com',
      'bernardo.ortiz@sozu.com'
    )
  );