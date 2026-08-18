import { supabase } from "@/integrations/supabase/client";

/**
 * Fuentes del selector "Ver como" del Portal del Personal.
 *
 * Hay dos, según quién mira:
 *
 *   1. `fetchUsuariosSistema` — Super Administrador. Ve y busca a CUALQUIER
 *      usuario del sistema (~1.9k activos), para comprobar cómo se vería el
 *      portal para cada uno. Al ser tantos, la búsqueda va contra el servidor:
 *      nunca se traen todos de golpe.
 *   2. `fetchPersonalConCuenta` — el resto de roles con `puede_impersonar`.
 *      Sólo personal de la organización con cuenta del sistema ligada
 *      (`personal_organizacional.email_usuario` → `usuarios.email`, el campo
 *      "Cuenta del sistema" de Estructura de comisiones → Roles y sueldos).
 *
 * OJO con `usuarios`: su llave es el EMAIL, no hay columna `id`. Pedirla hacía
 * fallar la consulta entera y por eso el selector salía vacío.
 */
export interface PersonalConCuenta {
  /** Identidad estable del usuario: su email (llave de `usuarios`). */
  id: string;
  personalId: number | null;
  nombre: string;
  email: string;
  rolId: number | null;
  rolNombre: string;
  personaId: number | null;
  authUserId: string | null;
  tipoPersonal: string | null;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** `%` y `_` son comodines de LIKE: escaparlos evita búsquedas que traen de más. */
const escapeLike = (v: string) => v.replace(/[%_]/g, (c) => `\${c}`);

const USUARIO_COLS = "email, nombre, rol_id, id_persona, auth_user_id, roles(nombre)";

function mapUsuario(u: any, tipoPersonal: string | null = null, personalId: number | null = null): PersonalConCuenta {
  return {
    id: u.email as string,
    personalId,
    nombre: (u.nombre as string) || (u.email as string),
    email: u.email as string,
    rolId: (u.rol_id as number) ?? null,
    rolNombre: (u.roles?.nombre as string) ?? "Usuario",
    personaId: (u.id_persona as number) ?? null,
    authUserId: (u.auth_user_id as string) ?? null,
    tipoPersonal,
  };
}

/**
 * Todos los usuarios del sistema, filtrados en el servidor por nombre o correo.
 * Sin término se devuelve la primera página alfabética, para que el desplegable
 * nunca aparezca vacío.
 */
export async function fetchUsuariosSistema(
  termino = "",
  limite = 50,
): Promise<PersonalConCuenta[]> {
  const q = termino.trim();

  let query = (supabase as any)
    .from("usuarios")
    .select(USUARIO_COLS)
    .eq("activo", true)
    .order("nombre", { ascending: true, nullsFirst: false })
    .limit(limite);

  if (q) {
    const patron = `%${escapeLike(q)}%`;
    query = query.or(`nombre.ilike.${patron},email.ilike.${patron}`);
  }

  const { data, error } = await query;
  if (error || !data?.length) return [];

  // El "tipo de personal" (Empleado REV, etc.) es un dato extra: si no está, el
  // usuario igual se puede seleccionar.
  const emails = (data as any[]).map((u) => u.email).filter(Boolean);
  const tipoPorEmail = await fetchTipoPersonalPorEmail(emails);

  return (data as any[]).map((u) => {
    const extra = tipoPorEmail.get(norm(u.email));
    return mapUsuario(u, extra?.tipoPersonal ?? null, extra?.personalId ?? null);
  });
}

/** Personal de la organización que YA tiene cuenta del sistema. */
export async function fetchPersonalConCuenta(): Promise<PersonalConCuenta[]> {
  const { data: personal, error } = await (supabase as any)
    .from("personal_organizacional")
    .select("id, nombre, email_usuario, tipo_personal")
    .eq("activo", true)
    .not("email_usuario", "is", null)
    .order("nombre");
  if (error || !personal?.length) return [];

  const emails = Array.from(
    new Set((personal as any[]).map((p) => norm(p.email_usuario)).filter(Boolean)),
  );
  if (!emails.length) return [];

  // PostgREST no puede unir por email, así que se resuelve en dos consultas y se
  // compara en minúsculas + trim, como el resto del proyecto.
  const { data: usuarios } = await (supabase as any)
    .from("usuarios")
    .select(USUARIO_COLS)
    .in("email", emails);

  const porEmail = new Map<string, any>();
  for (const u of (usuarios as any[]) ?? []) porEmail.set(norm(u.email), u);

  return (personal as any[])
    .map((p) => {
      const u = porEmail.get(norm(p.email_usuario));
      if (!u) return null;
      const mapped = mapUsuario(u, (p.tipo_personal as string) ?? null, (p.id as number) ?? null);
      // En este listado manda el nombre del directorio de personal.
      return { ...mapped, nombre: (p.nombre as string) || mapped.nombre };
    })
    .filter((v): v is PersonalConCuenta => v !== null);
}

async function fetchTipoPersonalPorEmail(
  emails: string[],
): Promise<Map<string, { tipoPersonal: string | null; personalId: number | null }>> {
  const out = new Map<string, { tipoPersonal: string | null; personalId: number | null }>();
  if (!emails.length) return out;

  // `.in()` compara exacto: se mandan también en minúsculas porque el correo
  // capturado en el directorio de personal no siempre respeta el mismo case.
  const variantes = Array.from(new Set([...emails, ...emails.map((e) => e.toLowerCase())]));
  const { data } = await (supabase as any)
    .from("personal_organizacional")
    .select("id, email_usuario, tipo_personal")
    .in("email_usuario", variantes);

  for (const p of (data as any[]) ?? []) {
    const key = norm(p.email_usuario);
    if (!key || out.has(key)) continue;
    out.set(key, {
      tipoPersonal: (p.tipo_personal as string) ?? null,
      personalId: (p.id as number) ?? null,
    });
  }
  return out;
}
