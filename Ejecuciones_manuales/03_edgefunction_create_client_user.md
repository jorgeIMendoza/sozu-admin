# Edge Function — `create-client-user` (multi-rol con confirmación)

> Reemplaza el contenido de `supabase/functions/create-client-user/index.ts` con el siguiente código y haz **deploy manual**.

## Contrato nuevo

**Body:**
```json
{ "email": "...", "nombre": "...", "id_persona": "...", "confirmAddRole": false }
```

**Respuestas:**
- `200` — flujo normal o multi-rol agregado.
- `409` con `status: "role_conflict"` — el email ya existe con otro rol y falta `confirmAddRole: true`.

## Código Deno

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
          existingRoles: [{
            id: existing.rol_id,
            nombre: (existing as any).roles?.nombre ?? `Rol ${existing.rol_id}`,
          }],
          message: `El email ya está registrado como ${(existing as any).roles?.nombre ?? 'otro rol'}. ¿Deseas agregarle también el rol Cliente?`,
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

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

    // 3) Forzar re-confirmación de email
    await supabaseAdmin
      .from('usuarios')
      .update({ email_confirmado: false, fecha_actualizacion: new Date().toISOString() })
      .ilike('email', email);

    // 4) Generar y enviar email de confirmación
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

## Deploy

```bash
supabase functions deploy create-client-user
```
