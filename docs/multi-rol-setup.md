# Multi-rol con confirmación — Setup manual

Por las reglas del proyecto, el DDL y el código de Edge Functions deben ejecutarse/desplegarse **manualmente**. A continuación está todo lo que tienes que correr.

## 1) SQL — ejecutar en dev y prod

```sql
-- =========================================================
-- 1.1 Tabla user_roles
-- =========================================================
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

-- Normalizar email siempre en minúsculas y trim
CREATE OR REPLACE FUNCTION public.user_roles_normalize_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  NEW.fecha_actualizacion := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_normalize ON public.user_roles;
CREATE TRIGGER trg_user_roles_normalize
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.user_roles_normalize_email();

-- =========================================================
-- 1.2 RLS
-- =========================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Lectura: super admin O el propio usuario (matcheado por email del JWT)
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Escritura: solo super admin (las edge functions usan service role y la saltan)
DROP POLICY IF EXISTS user_roles_modify ON public.user_roles;
CREATE POLICY user_roles_modify ON public.user_roles
FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- =========================================================
-- 1.3 Helper
-- =========================================================
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

-- =========================================================
-- 1.4 Backfill general desde usuarios.rol_id
-- =========================================================
INSERT INTO public.user_roles (email, rol_id, activo, es_principal, creado_por)
SELECT lower(btrim(u.email)), u.rol_id, true, true, 'system-backfill'
FROM public.usuarios u
WHERE u.rol_id IS NOT NULL
ON CONFLICT (email, rol_id) DO UPDATE
SET activo = true,
    es_principal = EXCLUDED.es_principal;

-- =========================================================
-- 1.5 Caso puntual: luis.munoz@investimento.mx tendrá roles 3 y 23
-- =========================================================
INSERT INTO public.user_roles (email, rol_id, activo, es_principal, creado_por)
VALUES ('luis.munoz@investimento.mx', 3, true, true, 'system-fix-luis')
ON CONFLICT (email, rol_id) DO UPDATE SET activo = true, es_principal = true;

INSERT INTO public.user_roles (email, rol_id, activo, es_principal, creado_por)
VALUES ('luis.munoz@investimento.mx', 23, true, false, 'system-fix-luis')
ON CONFLICT (email, rol_id) DO UPDATE SET activo = true;

-- usuarios.rol_id queda en 3 (Agente). El acceso al portal Cliente lo da user_roles.
```

> Después del SQL, refresca los tipos de Supabase si lo deseas (no es estrictamente necesario para que el frontend funcione porque el código usa `(supabase as any)` para `user_roles`).

## 2) Edge Function `create-client-user` — código actualizado

Reemplaza el contenido de `supabase/functions/create-client-user/index.ts` por el siguiente y haz deploy manual:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLE_CLIENTE = 23;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const POSTMARK_TOKEN = Deno.env.get('POSTMARK_SERVER_TOKEN');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const email = body?.email?.toLowerCase()?.trim();
    const nombre = body?.nombre;
    const confirmAddRole: boolean = body?.confirmAddRole === true;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Buscar usuario existente
    const { data: existing } = await supabaseAdmin
      .from('usuarios')
      .select('email, rol_id, roles(nombre)')
      .ilike('email', email)
      .maybeSingle();

    // 2) Si existe y NO es Cliente, requerir confirmación para multi-rol
    if (existing && existing.rol_id !== ROLE_CLIENTE) {
      // ¿Ya tiene rol Cliente en user_roles?
      const { data: hasClienteRow } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('email', email)
        .eq('rol_id', ROLE_CLIENTE)
        .eq('activo', true)
        .maybeSingle();

      if (!hasClienteRow && !confirmAddRole) {
        return new Response(JSON.stringify({
          status: 'role_conflict',
          existingRoles: [{ id: existing.rol_id, nombre: (existing as any).roles?.nombre ?? `Rol ${existing.rol_id}` }],
          message: `El email ya está registrado como ${(existing as any).roles?.nombre ?? 'otro rol'}. ¿Deseas agregarle también el rol Cliente?`,
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Confirmado: agregar rol Cliente como secundario sin tocar usuarios.rol_id
      if (!hasClienteRow && confirmAddRole) {
        await supabaseAdmin.from('user_roles').upsert({
          email,
          rol_id: ROLE_CLIENTE,
          activo: true,
          es_principal: false,
          creado_por: 'create-client-user',
        }, { onConflict: 'email,rol_id' });
      }
    }

    // 3) Asegurar que email_confirmado quede en false para forzar re-confirmación
    await supabaseAdmin
      .from('usuarios')
      .update({ email_confirmado: false, fecha_actualizacion: new Date().toISOString() })
      .ilike('email', email);

    // 4) Enviar confirmation email (igual que antes)
    const thankYouUrl = `https://clientes.sozu.com/auth/confirmacion-email?email=${encodeURIComponent(email)}&nombre=${encodeURIComponent(nombre || '')}&portal=clientes&destination=change-password`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: thankYouUrl },
    });
    if (linkError) console.error('generateLink error:', linkError);

    let confirmationUrl: string | null = null;
    if (linkData?.properties?.hashed_token) {
      const params = new URLSearchParams({
        email, nombre: nombre || '', portal: 'clientes', destination: 'change-password',
        token_hash: linkData.properties.hashed_token, type: 'magiclink',
      });
      confirmationUrl = `https://clientes.sozu.com/auth/confirmacion-email?${params}`;
    } else if (linkData?.properties?.action_link) {
      confirmationUrl = linkData.properties.action_link;
    }

    if (confirmationUrl && POSTMARK_TOKEN) {
      const htmlBody = `<p>Hola ${nombre || 'Cliente'}, confirma tu email: <a href="${confirmationUrl}">Confirmar</a></p>`;
      try {
        await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': POSTMARK_TOKEN,
          },
          body: JSON.stringify({
            From: 'Notificaciones Sozu <notificaciones@sozu.com>',
            To: email,
            Subject: 'Confirma tu correo electrónico - Sozu',
            HtmlBody: htmlBody,
            MessageStream: 'outbound',
          }),
        });
      } catch (e) { console.error('Postmark error:', e); }
    }

    return new Response(JSON.stringify({
      success: true,
      multiRoleAdded: !!(existing && existing.rol_id !== ROLE_CLIENTE && confirmAddRole),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('create-client-user error:', error);
    return new Response(JSON.stringify({ error: `Unexpected: ${(error as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

## 3) Frontend

Ya está aplicado en `src/pages/admin/UsuariosClientes.tsx`: cuando el EF responde `409 / status: "role_conflict"`, se acumulan los conflictos y se muestra un modal final donde puedes confirmar uno por uno o todos.

## 4) Verificación luis.munoz

Después de correr el SQL del paso 1.5:
- `SELECT * FROM user_roles WHERE email='luis.munoz@investimento.mx';` debe regresar 2 filas (rol 3 principal + rol 23 secundario).
- En el panel "Sistema → Usuarios Clientes" entrará a la lista cuando se actualice el filtro para usar `user_roles` (próximo paso, fuera del alcance de este parche).
- Para enviarle el correo de confirmación de portal Cliente: invoca `create-client-user` con `{ email: 'luis.munoz@investimento.mx', confirmAddRole: true }`.