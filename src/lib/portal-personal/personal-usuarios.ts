import { supabase } from "@/integrations/supabase/client";

/**
 * Personal de la organización que YA tiene cuenta del sistema.
 *
 * El vínculo es `personal_organizacional.email_usuario` → `usuarios.email`
 * (el campo "Cuenta del sistema" de Estructura de comisiones → Roles y sueldos).
 * Sólo estos usuarios son suplantables en el Portal del Personal: sin cuenta del
 * sistema no hay nada que "ver como".
 *
 * Se resuelve en dos consultas (PostgREST no puede unir por email) y se compara
 * en minúsculas + trim, como el resto del proyecto.
 */
export interface PersonalConCuenta {
  id: string;
  personalId: number;
  nombre: string;
  email: string;
  rolId: number | null;
  rolNombre: string;
  tipoPersonal: string | null;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

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

  const { data: usuarios } = await (supabase as any)
    .from("usuarios")
    .select("id, email, nombre, rol_id, roles(nombre)")
    .in("email", emails);

  const porEmail = new Map<string, any>();
  for (const u of (usuarios as any[]) ?? []) porEmail.set(norm(u.email), u);

  return (personal as any[])
    .map((p) => {
      const u = porEmail.get(norm(p.email_usuario));
      if (!u) return null;
      return {
        id: String(u.id),
        personalId: p.id as number,
        nombre: (p.nombre as string) || (u.nombre as string) || (u.email as string),
        email: u.email as string,
        rolId: (u.rol_id as number) ?? null,
        rolNombre: (u.roles?.nombre as string) ?? "Usuario",
        tipoPersonal: (p.tipo_personal as string) ?? null,
      } as PersonalConCuenta;
    })
    .filter((v): v is PersonalConCuenta => v !== null);
}
