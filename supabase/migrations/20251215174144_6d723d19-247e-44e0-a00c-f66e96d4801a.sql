
-- Step 1: Enable RLS on entidades_relacionadas
ALTER TABLE entidades_relacionadas ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if any
DROP POLICY IF EXISTS "select_entidades_relacionadas" ON entidades_relacionadas;
DROP POLICY IF EXISTS "insert_entidades_relacionadas" ON entidades_relacionadas;
DROP POLICY IF EXISTS "update_entidades_relacionadas" ON entidades_relacionadas;
DROP POLICY IF EXISTS "delete_entidades_relacionadas" ON entidades_relacionadas;

-- Step 3: Create restrictive SELECT policy
-- Admins can see everything
-- For prospectos (7) and compradores (2): only visible to the owner (id_persona_duena_lead)
-- Unassigned prospectos/compradores (id_persona_duena_lead IS NULL) only visible to admins
-- Other entity types are visible to all authenticated users
CREATE POLICY "select_entidades_relacionadas" ON entidades_relacionadas
FOR SELECT USING (
  public.is_admin_user() 
  OR (
    id_tipo_entidad NOT IN (2, 7)
  )
  OR (
    id_tipo_entidad IN (2, 7)
    AND public.get_current_user_persona_id() IS NOT NULL 
    AND id_persona_duena_lead = public.get_current_user_persona_id()
  )
);

-- Step 4: Create INSERT policy - authenticated users can insert
CREATE POLICY "insert_entidades_relacionadas" ON entidades_relacionadas
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Step 5: Create UPDATE policy - admins or owners can update
CREATE POLICY "update_entidades_relacionadas" ON entidades_relacionadas
FOR UPDATE USING (
  public.is_admin_user()
  OR (
    id_tipo_entidad IN (2, 7)
    AND public.get_current_user_persona_id() IS NOT NULL
    AND id_persona_duena_lead = public.get_current_user_persona_id()
  )
  OR id_tipo_entidad NOT IN (2, 7)
) WITH CHECK (
  public.is_admin_user()
  OR (
    id_tipo_entidad IN (2, 7)
    AND public.get_current_user_persona_id() IS NOT NULL
    AND id_persona_duena_lead = public.get_current_user_persona_id()
  )
  OR id_tipo_entidad NOT IN (2, 7)
);

-- Step 6: Create DELETE policy - only admins can delete
CREATE POLICY "delete_entidades_relacionadas" ON entidades_relacionadas
FOR DELETE USING (
  public.is_admin_user()
);
