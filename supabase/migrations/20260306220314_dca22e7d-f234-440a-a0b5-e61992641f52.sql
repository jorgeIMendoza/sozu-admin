-- Allow inmobiliaria users to read prospects/compradores owned by their linked agents.
-- Uses SECURITY DEFINER to avoid recursive RLS checks on entidades_relacionadas.
CREATE OR REPLACE FUNCTION public.can_access_agent_owned_lead(_owner_persona_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    is_admin_user()
    OR can_view_all_prospects()
    OR (
      get_current_user_persona_id() IS NOT NULL
      AND _owner_persona_id IS NOT NULL
      AND _owner_persona_id = get_current_user_persona_id()
    )
    OR EXISTS (
      SELECT 1
      FROM public.entidades_relacionadas er_ag
      WHERE er_ag.id_tipo_entidad = 19
        AND er_ag.activo = true
        AND er_ag.id_persona = _owner_persona_id
        AND er_ag.id_persona_duena_lead = get_current_user_persona_id()
    )
  );
$$;

DROP POLICY IF EXISTS "select_entidades_relacionadas" ON public.entidades_relacionadas;

CREATE POLICY "select_entidades_relacionadas"
ON public.entidades_relacionadas
FOR SELECT
TO public
USING (
  is_admin_user()
  OR can_view_all_prospects()
  OR (id_tipo_entidad <> ALL (ARRAY[2, 7]))
  OR (
    id_tipo_entidad = ANY (ARRAY[2, 7])
    AND public.can_access_agent_owned_lead(id_persona_duena_lead)
  )
);