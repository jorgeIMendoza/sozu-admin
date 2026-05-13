# Multi-rol — DDL, RLS, Funciones y Backfill (BD)

> Ejecutar manualmente en **dev** y **prod** (Supabase SQL Editor). Idempotente.

## 1) DDL: tabla `user_roles`

```sql
CREATE TABLE IF NOT EXISTS public.user_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  rol_id          integer NOT NULL REFERENCES public.roles(id),
  activo          boolean NOT NULL DEFAULT true,
  es_principal    boolean NOT NULL DEFAULT false,
  creado_por      text,
  fecha_creacion       timestamptz NOT NULL DEFAULT now(),
  fecha_actualizacion  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_email_rol_unique UNIQUE (email, rol_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_email ON public.user_roles (lower(email));
CREATE INDEX IF NOT EXISTS idx_user_roles_rol   ON public.user_roles (rol_id);
```

## 2) Función + Trigger: normalizar email

```sql

```

## 3) RLS

```sql
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS user_roles_modify ON public.user_roles;
CREATE POLICY user_roles_modify ON public.user_roles
FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());
```

## 4) Helper `user_has_role`

```sql
CREATE OR REPLACE FUNCTION public.user_has_role(_email text, _rol_id integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE lower(email) = lower(btrim(_email))
      AND rol_id = _rol_id
      AND activo = true
  );
$$;
```

## 5) Backfill general (DML)

```sql
INSERT INTO public.user_roles (email, rol_id, activo, es_principal, creado_por)
SELECT lower(btrim(u.email)), u.rol_id, true, true, 'system-backfill'
FROM public.usuarios u
WHERE u.rol_id IS NOT NULL
ON CONFLICT (email, rol_id) DO UPDATE
SET activo = true,
    es_principal = EXCLUDED.es_principal;
```

## 6) Verificación

```sql
SELECT count(*) FROM public.user_roles;
SELECT * FROM public.user_roles ORDER BY fecha_creacion DESC LIMIT 10;
```
