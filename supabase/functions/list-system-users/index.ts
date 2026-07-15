import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLE_ADMINISTRADOR_PROYECTO = 2;
const ROLE_AGENTE_INMOBILIARIO = 3;
const ROLE_INMOBILIARIA = 4;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Falta configuración de Supabase" }, 500);
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Sesión inválida" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: requester, error: requesterError } = await supabaseAdmin
      .from("usuarios")
      .select("rol_id, activo, roles!inner(nombre)")
      .eq("auth_user_id", userData.user.id)
      .eq("activo", true)
      .single();

    if (requesterError || !requester) {
      return jsonResponse({ error: "Usuario no encontrado" }, 403);
    }

    // RBAC: la autorización la decide submenus_permisos (vía user_has_permission),
    // no una lista fija de roles. Se ejecuta con el cliente del usuario para que
    // la RPC resuelva la sesión del solicitante.
    const { data: hasReadPermission, error: permError } = await supabaseUser.rpc(
      "user_has_permission",
      { _submenu_path: "/admin/usuarios", _permission_name: "leer" },
    );

    if (permError) {
      console.error("Error checking user_has_permission:", permError);
      return jsonResponse({ error: "No se pudo verificar permisos" }, 500);
    }

    if (!hasReadPermission) {
      return jsonResponse({ error: "No tienes permisos para consultar usuarios del sistema" }, 403);
    }

    // Pagination: keep pageSize comfortably under PostgREST's db-max-rows (1000)
    // and rely on an empty batch as the stop condition. The previous logic
    // (data.length < pageSize) caused early exits when PostgREST returned a
    // partial page, hiding users at the tail of the alphabet.
    const pageSize = 500;
    const maxIterations = 40; // safety cap: up to 20 000 users
    const allUsers: unknown[] = [];

    for (let i = 0; i < maxIterations; i++) {
      const from = i * pageSize;

      let query = supabaseAdmin
        .from("usuarios")
        .select(`
          email,
          nombre,
          rol_id,
          activo,
          auth_user_id,
          id_persona,
          debe_cambiar_password,
          email_confirmado,
          id_notario,
          notarios (notaria),
          roles!inner (nombre, es_rol_interno),
          personas (nombre_legal, email)
        `)
        .eq("roles.es_rol_interno", true)
        .order("nombre", { ascending: true })
        .order("email", { ascending: true })
        .range(from, from + pageSize - 1);

      if (requester.rol_id === ROLE_ADMINISTRADOR_PROYECTO) {
        query = query.in("rol_id", [ROLE_AGENTE_INMOBILIARIO, ROLE_INMOBILIARIA]);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching system users:", error);
        return jsonResponse({ error: "No se pudieron consultar los usuarios" }, 500);
      }

      const batch = data ?? [];
      allUsers.push(...batch);

      // Stop only when an empty batch is returned. A short (but non-empty)
      // batch can still mean there are more rows on the next offset.
      if (batch.length === 0) break;
    }

    console.log(
      `list-system-users: returned ${allUsers.length} users for rol ${requester.rol_id}`,
    );

    return jsonResponse({ data: allUsers });
  } catch (error) {
    console.error("Unexpected error in list-system-users:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Error inesperado" }, 500);
  }
});