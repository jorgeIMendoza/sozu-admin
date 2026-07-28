import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/portal-estructura-comisiones/types/simulator";

/**
 * "Puestos y Sueldos" — catálogo de roles (`roles_organizacionales`), compartido
 * entre todos los usuarios del portal en vez de vivir solo en `localStorage`
 * (como vivía antes). Ese mismo catálogo es también la fuente de "Directorio
 * de Personal", "Organigrama" y "Motor de Comisiones" — todos leen `roles` de
 * `useSimulator()`, así que conectar este único punto los comparte a los 4.
 *
 * `id` es `text` (no `bigint GENERATED ALWAYS AS IDENTITY`): preserva los ids
 * que ya genera el cliente (`crypto.randomUUID()` en `StructureTab.tsx`) para
 * no romper las referencias que ya existen a esos mismos ids como texto libre
 * en `comisiones_reglas.id_rol` / `puestos_organizacionales.id_rol`.
 *
 * Probe graceful: si la tabla aún no existe (DDL pendiente, ver
 * `Ejecuciones_manuales/directorio_personal_estructura_comisiones.md`), las
 * consultas devuelven `null` y el simulador sigue funcionando 100% local.
 */

const TABLE_MISSING_CODE = "PGRST205";

export interface SyncResult {
  ok: boolean;
  /** true cuando el fallo es porque la tabla todavía no existe (DDL pendiente) — no debe mostrarse como error al usuario. */
  tableMissing: boolean;
}

function roleFromRow(row: any): Role {
  return {
    id: row.id,
    name: row.nombre,
    type: row.tipo,
    belongsTo: row.pertenece_a,
    participatesInCommission: row.participa_comision,
  };
}

function roleToRow(role: Role) {
  return {
    id: role.id,
    nombre: role.name,
    tipo: role.type,
    pertenece_a: role.belongsTo,
    participa_comision: role.participatesInCommission,
    fecha_actualizacion: new Date().toISOString(),
  };
}

export async function fetchRolesReales(): Promise<Role[] | null> {
  const { data, error } = await (supabase as any)
    .from("roles_organizacionales")
    .select("id, nombre, tipo, pertenece_a, participa_comision")
    .eq("activo", true)
    .order("nombre");
  if (error || !data) return null;
  return (data as any[]).map(roleFromRow);
}

/** Siembra la tabla con los roles locales de este navegador cuando existe pero está vacía — así el primer navegador que sincroniza no pierde su catálogo actual. */
export async function seedRolesReales(roles: Role[]): Promise<void> {
  if (!roles.length) return;
  await (supabase as any).from("roles_organizacionales").insert(roles.map(roleToRow));
}

export async function insertRolReal(role: Role): Promise<SyncResult> {
  const { error } = await (supabase as any).from("roles_organizacionales").insert(roleToRow(role));
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}

export async function updateRolReal(role: Role): Promise<SyncResult> {
  const { error } = await (supabase as any)
    .from("roles_organizacionales")
    .update(roleToRow(role))
    .eq("id", role.id);
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}

export async function deleteRolReal(id: string): Promise<SyncResult> {
  const { error } = await (supabase as any).from("roles_organizacionales").delete().eq("id", id);
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}
