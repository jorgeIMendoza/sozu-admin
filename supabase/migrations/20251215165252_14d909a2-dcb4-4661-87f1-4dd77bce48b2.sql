-- =====================================================
-- FUNCIONES DE SEGURIDAD PARA CONTROL DE VISIBILIDAD
-- =====================================================

-- 1. Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol_id FROM usuarios WHERE auth_user_id = auth.uid()
$$;

-- 2. Función para obtener el id_persona del usuario actual
CREATE OR REPLACE FUNCTION public.get_current_user_persona_id()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_persona FROM usuarios WHERE auth_user_id = auth.uid()
$$;

-- 3. Función para verificar si es Super Admin (1) o Admin Proyecto (2)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios 
    WHERE auth_user_id = auth.uid() 
    AND rol_id IN (1, 2)
  )
$$;

-- =====================================================
-- POLÍTICAS RLS PARA entidades_relacionadas
-- =====================================================

-- Eliminar política actual permisiva
DROP POLICY IF EXISTS "Allow all access to entidades_relacionadas" ON entidades_relacionadas;

-- Política SELECT: Admins ven todo, otros solo sus prospectos/compradores
CREATE POLICY "select_entidades_relacionadas" ON entidades_relacionadas
FOR SELECT USING (
  public.is_admin_user() 
  OR id_tipo_entidad NOT IN (2, 7)
  OR id_persona_duena_lead = public.get_current_user_persona_id()
  OR id_persona_duena_lead IS NULL
);

-- Política INSERT: Cualquiera puede crear
CREATE POLICY "insert_entidades_relacionadas" ON entidades_relacionadas
FOR INSERT WITH CHECK (true);

-- Política UPDATE: Admins o dueño del lead
CREATE POLICY "update_entidades_relacionadas" ON entidades_relacionadas
FOR UPDATE USING (
  public.is_admin_user() 
  OR id_tipo_entidad NOT IN (2, 7)
  OR id_persona_duena_lead = public.get_current_user_persona_id()
  OR id_persona_duena_lead IS NULL
);

-- Política DELETE: Admins o dueño del lead
CREATE POLICY "delete_entidades_relacionadas" ON entidades_relacionadas
FOR DELETE USING (
  public.is_admin_user() 
  OR id_tipo_entidad NOT IN (2, 7)
  OR id_persona_duena_lead = public.get_current_user_persona_id()
  OR id_persona_duena_lead IS NULL
);

-- =====================================================
-- VINCULAR USUARIOS CON PERSONAS (por email)
-- =====================================================
UPDATE usuarios 
SET id_persona = subq.persona_id
FROM (
  SELECT u.auth_user_id as usuario_auth_id, p.id as persona_id
  FROM usuarios u
  INNER JOIN personas p ON LOWER(p.email) = LOWER(u.email)
  WHERE u.id_persona IS NULL
) subq
WHERE usuarios.auth_user_id = subq.usuario_auth_id;