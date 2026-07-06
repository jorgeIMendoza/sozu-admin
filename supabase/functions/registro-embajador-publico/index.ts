import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  nombre: string;
  email: string;
  telefono: string;
  clave_pais_telefono: string;
}

const EMBAJADOR_PORTAL_URL = 'https://embajadores.sozu.com';
const ROLE_EMBAJADOR = 25;

// Duplicado manual de DEFAULT_PAYMENT_DOCS (src/types/ambassadors.ts) — Deno no puede
// importar módulos del frontend. Mantener sincronizado si esa lista cambia.
const DEFAULT_PAYMENT_DOCS = [
  { key: 'convenio', label: 'Convenio de Embajador firmado', status: 'pendiente' },
  { key: 'id', label: 'Identificación oficial', status: 'pendiente' },
  { key: 'rfc', label: 'Constancia de situación fiscal', status: 'pendiente' },
  { key: 'bancarios', label: 'Datos bancarios', status: 'pendiente' },
  { key: 'factura', label: 'Factura / recibo (al pago)', status: 'pendiente' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { nombre, email, telefono, clave_pais_telefono } = body;

    console.log('Registro público de embajador:', { nombre, email: email?.substring(0, 5) + '***' });

    // Validate required fields
    if (!nombre || !email || !telefono) {
      return new Response(
        JSON.stringify({ success: false, message: 'Faltan campos requeridos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailLower = email.toLowerCase().trim();
    if (!emailRegex.test(emailLower)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Formato de email inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate phone (10 digits)
    if (telefono.length !== 10) {
      return new Response(
        JSON.stringify({ success: false, message: 'El teléfono debe tener 10 dígitos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ─── 0. Resolver id_tipo_entidad "Embajador" dinámicamente (no hardcodear) ───
    const { data: tipoEntidadData, error: tipoEntidadError } = await supabase
      .from('tipos_entidad')
      .select('id')
      .eq('nombre', 'Embajador')
      .single();

    if (tipoEntidadError || !tipoEntidadData) {
      console.error('Error resolviendo tipos_entidad Embajador:', tipoEntidadError);
      throw new Error('Tipo de entidad "Embajador" no encontrado. Verifica la configuración de tipos_entidad.');
    }
    const TIPO_ENTIDAD_EMBAJADOR = tipoEntidadData.id;

    // Resolver id_tipo_embajador por defecto ("Referidor externo") dinámicamente
    let defaultTipoEmbajadorId = 4; // fallback si la tabla no responde (coincide con FALLBACK_TIPOS del hook)
    const { data: tipoEmbData } = await supabase
      .from('tipos_embajador')
      .select('id')
      .eq('etiqueta', 'Referidor externo')
      .maybeSingle();
    if (tipoEmbData?.id) {
      defaultTipoEmbajadorId = tipoEmbData.id;
    }

    // ─── 1. Check if persona already exists ───
    const { data: existingPersona } = await supabase
      .from('personas')
      .select('id, nombre_legal, telefono')
      .ilike('email', emailLower)
      .eq('activo', true)
      .maybeSingle();

    let personaId: number;

    if (existingPersona) {
      personaId = existingPersona.id;
      console.log('Persona already exists, reusing ID:', personaId);

      // Check if this persona already has an active Embajador entity
      const { data: existingEmbajadorEntity } = await supabase
        .from('entidades_relacionadas')
        .select('id')
        .eq('id_persona', personaId)
        .eq('id_tipo_entidad', TIPO_ENTIDAD_EMBAJADOR)
        .eq('activo', true)
        .maybeSingle();

      if (existingEmbajadorEntity) {
        return new Response(
          JSON.stringify({ success: false, message: `El email ${email} ya está registrado como embajador` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Update phone/name on existing persona if empty
      const updates: Record<string, string> = {};
      if (!existingPersona.telefono && telefono) updates.telefono = telefono.trim();
      if (!existingPersona.nombre_legal && nombre) updates.nombre_legal = nombre.trim();
      if (Object.keys(updates).length > 0) {
        await supabase.from('personas').update(updates).eq('id', personaId);
        console.log('Updated existing persona with missing fields:', Object.keys(updates));
      }
    } else {
      // Create new persona
      const { data: persona, error: personaError } = await supabase
        .from('personas')
        .insert({
          nombre_legal: nombre.trim(),
          email: emailLower,
          telefono: telefono.trim(),
          clave_pais_telefono: clave_pais_telefono || 'MX',
          tipo_persona: 'pf',
          activo: true,
          es_draft: true,
        })
        .select()
        .single();

      if (personaError) {
        console.error('Error creating persona:', personaError);
        throw new Error(`Error al crear persona: ${personaError.message}`);
      }

      personaId = persona.id;
      console.log('Persona created:', personaId);
    }

    // ─── 2. Create entidad_relacionada (tipo Embajador) ───
    const { data: entidad, error: entidadError } = await supabase
      .from('entidades_relacionadas')
      .insert({
        id_persona: personaId,
        id_tipo_entidad: TIPO_ENTIDAD_EMBAJADOR,
        activo: true,
      })
      .select()
      .single();

    if (entidadError) {
      console.error('Error creating entidad:', entidadError);
      if (!existingPersona) {
        await supabase.from('personas').delete().eq('id', personaId);
      }
      throw new Error(`Error al crear entidad: ${entidadError.message}`);
    }

    console.log('Entidad created:', entidad.id);

    // ─── 3. Create embajadores_config ───
    const { error: cfgError } = await supabase
      .from('embajadores_config')
      .insert({
        id_entidad_relacionada: entidad.id,
        empresa: null,
        id_tipo_embajador: defaultTipoEmbajadorId,
        pct_comision: 0.5,
        monto_fijo: null,
        trigger_comision: 'enganche',
        dias_proteccion: 90,
        notas: 'Alta vía autoregistro público',
        estatus: 'pendiente',
        documentos_pago: DEFAULT_PAYMENT_DOCS,
      });

    if (cfgError) {
      console.error('Error creating embajadores_config:', cfgError);
      await supabase.from('entidades_relacionadas').delete().eq('id', entidad.id);
      if (!existingPersona) {
        await supabase.from('personas').delete().eq('id', personaId);
      }
      throw new Error(`Error al crear configuración de embajador: ${cfgError.message}`);
    }

    console.log('embajadores_config created for entidad:', entidad.id);

    // ─── 4. Handle auth user (create or reuse) ───
    const defaultPassword = 'Temporal123!';
    let authUserId: string;

    const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
      email: emailLower,
      password: defaultPassword,
      email_confirm: false,
      user_metadata: { nombre, rol_id: ROLE_EMBAJADOR },
    });

    if (createAuthError) {
      if (createAuthError.message.includes('already been registered') || createAuthError.message.includes('already exists')) {
        console.log('Auth user already exists, searching...');
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const foundUser = authUsers?.users?.find(u => u.email?.toLowerCase() === emailLower);

        if (!foundUser) {
          console.error('Auth user exists but could not be found');
          await supabase.from('embajadores_config').delete().eq('id_entidad_relacionada', entidad.id);
          await supabase.from('entidades_relacionadas').delete().eq('id', entidad.id);
          if (!existingPersona) await supabase.from('personas').delete().eq('id', personaId);
          throw new Error('El usuario existe en auth pero no se pudo encontrar');
        }

        authUserId = foundUser.id;
        console.log('Reusing existing auth user:', authUserId);

        // Reset password to temporary
        await supabase.auth.admin.updateUserById(authUserId, {
          password: defaultPassword,
          email_confirm: false,
        });
      } else {
        console.error('Error creating auth user:', createAuthError);
        await supabase.from('embajadores_config').delete().eq('id_entidad_relacionada', entidad.id);
        await supabase.from('entidades_relacionadas').delete().eq('id', entidad.id);
        if (!existingPersona) await supabase.from('personas').delete().eq('id', personaId);
        throw new Error(`Error al crear usuario de autenticación: ${createAuthError.message}`);
      }
    } else {
      authUserId = authData.user!.id;
      console.log('Auth user created (unconfirmed):', authUserId);
    }

    // ─── 5. Handle usuario record (create or update) ───
    const { data: existingUsuario } = await supabase
      .from('usuarios')
      .select('id, email, rol_id')
      .ilike('email', emailLower)
      .maybeSingle();

    let usuarioId: number;

    if (existingUsuario) {
      // Update existing usuario - switch to Embajador role so the user is visible in admin panels.
      const updatePayload: Record<string, any> = {
        id_persona: personaId,
        auth_user_id: authUserId,
        debe_cambiar_password: true,
        email_confirmado: false,
        telefono: telefono.trim(),
        clave_pais_telefono: clave_pais_telefono || 'MX',
        rol_id: ROLE_EMBAJADOR,
      };

      const { error: updateError } = await supabase
        .from('usuarios')
        .update(updatePayload)
        .eq('id', existingUsuario.id);

      if (updateError) {
        console.error('Error updating usuario:', updateError);
        throw new Error(`Error al actualizar usuario: ${updateError.message}`);
      }

      usuarioId = existingUsuario.id;
      console.log('Existing usuario updated:', usuarioId);
    } else {
      // Create new usuario record
      const { data: usuario, error: usuarioError } = await supabase
        .from('usuarios')
        .insert({
          email: emailLower,
          nombre: nombre.trim(),
          rol_id: ROLE_EMBAJADOR,
          id_persona: personaId,
          auth_user_id: authUserId,
          debe_cambiar_password: true,
          activo: true,
          telefono: telefono.trim(),
          clave_pais_telefono: clave_pais_telefono || 'MX',
          email_confirmado: false,
        })
        .select()
        .single();

      if (usuarioError) {
        console.error('Error creating usuario:', usuarioError);
        await supabase.auth.admin.deleteUser(authUserId);
        await supabase.from('embajadores_config').delete().eq('id_entidad_relacionada', entidad.id);
        await supabase.from('entidades_relacionadas').delete().eq('id', entidad.id);
        if (!existingPersona) await supabase.from('personas').delete().eq('id', personaId);
        throw new Error(`Error al crear usuario: ${usuarioError.message}`);
      }

      usuarioId = usuario.id;
      console.log('Usuario created:', usuarioId);
    }

    // ─── 6. Generate email confirmation link ───
    const thankYouUrl = `${EMBAJADOR_PORTAL_URL}/auth/confirmacion-email?email=${encodeURIComponent(emailLower)}&nombre=${encodeURIComponent(nombre.trim())}&portal=embajadores&destination=change-password`;

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: emailLower,
      password: defaultPassword,
      options: {
        redirectTo: thankYouUrl,
      },
    });

    if (linkError) {
      console.error('Error generating confirmation link:', linkError);
    }

    let confirmationUrl: string | null = null;
    if (linkData?.properties?.hashed_token) {
      const nextUrl = new URL(thankYouUrl);
      nextUrl.searchParams.set('token_hash', linkData.properties.hashed_token);
      nextUrl.searchParams.set('type', 'signup');
      confirmationUrl = nextUrl.toString();
    } else if (linkData?.properties?.action_link) {
      confirmationUrl = linkData.properties.action_link;

      try {
        const actionUrl = new URL(confirmationUrl);
        const token = actionUrl.searchParams.get('token');
        const type = actionUrl.searchParams.get('type');
        if (token) {
          confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=${type || 'signup'}&redirect_to=${encodeURIComponent(thankYouUrl)}`;
        }
      } catch (e) {
        console.error('Error rebuilding confirmation URL:', e);
      }
    }
    console.log('Confirmation link generated:', confirmationUrl ? 'yes' : 'no');

    // ─── 7. Send confirmation email via Postmark ───
    const POSTMARK_TOKEN = Deno.env.get('POSTMARK_SERVER_TOKEN');

    if (POSTMARK_TOKEN && confirmationUrl) {
      try {
        const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#2a9d8f,#264653);padding:30px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;">Confirma tu correo electrónico</h1>
        </td></tr>
        <tr><td style="padding:30px 40px;">
          <p style="font-size:16px;color:#333;">Hola <strong>${nombre.trim()}</strong>,</p>
          <p style="font-size:15px;color:#555;line-height:1.6;">Gracias por registrarte como Embajador Sozu. Para activar tu cuenta y recibir tus credenciales de acceso, confirma tu dirección de email haciendo clic en el siguiente botón:</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${confirmationUrl}" style="display:inline-block;background:linear-gradient(135deg,#2a9d8f,#264653);color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Confirmar mi Email</a>
          </div>
          <p style="font-size:12px;color:#999;text-align:center;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/><a href="${confirmationUrl}" style="color:#2a9d8f;word-break:break-all;">${confirmationUrl}</a></p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:20px;text-align:center;">
          <p style="font-size:12px;color:#aaa;margin:0;">© Sozu — Este correo fue enviado automáticamente.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const confirmRes = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': POSTMARK_TOKEN,
          },
          body: JSON.stringify({
            From: 'Notificaciones Sozu <notificaciones@sozu.com>',
            To: emailLower,
            Subject: 'Confirma tu correo electrónico - Sozu',
            HtmlBody: htmlBody,
            MessageStream: 'outbound',
          }),
        });
        const confirmResult = await confirmRes.json();
        console.log('Confirmation email Postmark response:', confirmRes.status, JSON.stringify(confirmResult).substring(0, 300));
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
      }
    } else {
      console.error('POSTMARK_SERVER_TOKEN not configured or confirmation link not generated');
    }

    // Log the activity
    try {
      await supabase.from('logs_actividad').insert({
        tipo_accion: 'registro_publico',
        tipo_entidad: 'embajador',
        id_entidad: personaId,
        valor_nuevo: JSON.stringify({ nombre: nombre.trim(), email: emailLower }),
        descripcion: `Registro público de embajador: ${nombre.trim()} (pendiente confirmación)`,
      });
    } catch (logError) {
      console.error('Error logging activity:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Se ha enviado un correo de confirmación. Revisa tu bandeja de entrada.',
        data: { persona_id: personaId, usuario_id: usuarioId, entidad_id: entidad.id }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in registro-embajador-publico:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error interno del servidor'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
