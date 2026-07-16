import { supabase } from "@/integrations/supabase/client";
import type { Channel, CommissionRule, MotorConfig } from "@/lib/portal-estructura-comisiones/types/simulator";

/**
 * Sincroniza Canales de Venta (`comisiones_canales`), la matriz de
 * Comisiones por canal × puesto (`comisiones_reglas`) y la config del motor
 * (`comisiones_motor_config`) con Supabase, para que sean compartidos entre
 * todos los usuarios del portal en vez de vivir solo en `localStorage`.
 *
 * `comisiones_canales` es único y global (catálogo maestro, no depende de
 * proyecto). `comisiones_reglas` y `comisiones_motor_config` son **por
 * proyecto**: el Motor de Comisiones configura una matriz y un Modo/Total
 * distintos para cada desarrollo (ver `useProyectosMotorComisiones.ts` para
 * el catálogo de proyectos que aplica).
 *
 * Todas usan `id bigint GENERATED ALWAYS AS IDENTITY` — el id nunca lo
 * genera el cliente. Al crear, se inserta sin columna `id` y se usa el id
 * que devuelve la BD.
 *
 * Probe graceful: si las tablas aún no existen (DDL pendiente, ver
 * `Ejecuciones_manuales/motor_comisiones_canales_escenarios.md`), las
 * consultas devuelven `null` y el simulador sigue funcionando 100% local.
 */

/** PostgREST devuelve este código cuando la tabla aún no existe (DDL pendiente) — no es un error real que deba alertarse. */
const TABLE_MISSING_CODE = "PGRST205";

export interface SyncResult {
  ok: boolean;
  /** true cuando el fallo es porque la tabla todavía no existe (DDL pendiente) — no debe mostrarse como error al usuario. */
  tableMissing: boolean;
}

// ================================================================
// Canales de Venta
// ================================================================

function channelFromRow(row: any): Channel {
  return {
    id: String(row.id),
    name: row.nombre,
    externalCommissionPct: Number(row.comision_externa_pct ?? 0),
    minCommissionPct: Number(row.comision_min_pct ?? 0),
    maxCommissionPct: Number(row.comision_max_pct ?? 0),
    active: row.activo ?? true,
    code: row.codigo ?? undefined,
    description: row.descripcion ?? undefined,
    category: row.categoria ?? undefined,
    baseCommissionPct: row.comision_base_pct != null ? Number(row.comision_base_pct) : undefined,
    participatesInScaling: row.participa_escalonamiento ?? true,
    participatesInBonuses: row.participa_bonos ?? true,
    participatesInSimulators: row.participa_simuladores ?? true,
    requiresOnboarding: row.requiere_onboarding ?? false,
    requiresTraining: row.requiere_capacitacion ?? false,
    requiresApproval: row.requiere_aprobacion ?? false,
    leadProtectionDays: row.proteccion_leads_dias ?? 0,
    createdAt: row.fecha_creacion,
    updatedAt: row.fecha_actualizacion,
  };
}

/** No incluye `id` — la BD lo asigna (IDENTITY). Válido para insert y update. */
function channelToRow(channel: Channel) {
  return {
    nombre: channel.name,
    comision_externa_pct: channel.externalCommissionPct,
    comision_min_pct: channel.minCommissionPct,
    comision_max_pct: channel.maxCommissionPct,
    activo: channel.active,
    codigo: channel.code ?? null,
    descripcion: channel.description ?? null,
    categoria: channel.category ?? null,
    comision_base_pct: channel.baseCommissionPct ?? null,
    participa_escalonamiento: channel.participatesInScaling ?? true,
    participa_bonos: channel.participatesInBonuses ?? true,
    participa_simuladores: channel.participatesInSimulators ?? true,
    requiere_onboarding: channel.requiresOnboarding ?? false,
    requiere_capacitacion: channel.requiresTraining ?? false,
    requiere_aprobacion: channel.requiresApproval ?? false,
    proteccion_leads_dias: channel.leadProtectionDays ?? 0,
    fecha_actualizacion: new Date().toISOString(),
  };
}

export async function fetchCanalesReales(): Promise<Channel[] | null> {
  const { data, error } = await (supabase as any).from("comisiones_canales").select("*").order("id");
  if (error || !data) return null;
  return (data as any[]).map(channelFromRow);
}

/** Crea un canal nuevo. El id lo asigna la BD; se devuelve en el resultado. */
export async function insertCanalRemoto(channel: Channel): Promise<{ channel: Channel | null; tableMissing: boolean }> {
  const { data, error } = await (supabase as any).from("comisiones_canales").insert(channelToRow(channel)).select().single();
  if (error) return { channel: null, tableMissing: error.code === TABLE_MISSING_CODE };
  return { channel: channelFromRow(data), tableMissing: false };
}

export async function updateCanalRemoto(channel: Channel): Promise<SyncResult> {
  const { error } = await (supabase as any).from("comisiones_canales").update(channelToRow(channel)).eq("id", Number(channel.id));
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}

export async function deleteCanalRemoto(id: string): Promise<SyncResult> {
  const { error } = await (supabase as any).from("comisiones_canales").delete().eq("id", Number(id));
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}

/** Siembra los canales default (mock de seed-data.ts) cuando la tabla existe pero está vacía. */
export async function seedCanalesReales(channels: Channel[]): Promise<void> {
  if (!channels.length) return;
  await (supabase as any).from("comisiones_canales").insert(channels.map(channelToRow));
}

// ================================================================
// Comisiones — matriz canal × puesto por proyecto (`comisiones_reglas`)
// ================================================================

function ruleFromRow(row: any): CommissionRule {
  return {
    id: String(row.id),
    scenarioId: "",
    channelId: String(row.id_canal),
    roleId: row.id_rol,
    percentage: Number(row.porcentaje ?? 0),
    pool: row.pool,
  };
}

/**
 * No incluye `id` — la BD lo asigna (IDENTITY). Válido para insert y update.
 *
 * `id_rol` es `text`, no `bigint`: identifica un rol de "Puestos y Sueldos"
 * (`StructureTab.tsx` / `useSimulator().roles`, ej. 'role-dir-sozu'), que es
 * 100% local (localStorage) y no tiene tabla propia — es un catálogo
 * distinto de `roles_organizacionales` (Directorio de Personal).
 */
function ruleToRow(rule: CommissionRule, idProyecto: number) {
  return {
    id_proyecto: idProyecto,
    id_canal: Number(rule.channelId),
    id_rol: rule.roleId,
    porcentaje: rule.percentage,
    pool: rule.pool,
    fecha_actualizacion: new Date().toISOString(),
  };
}

export async function fetchReglasComisionReales(idProyecto: number): Promise<CommissionRule[] | null> {
  const { data, error } = await (supabase as any).from("comisiones_reglas").select("*").eq("id_proyecto", idProyecto).order("id");
  if (error || !data) return null;
  return (data as any[]).map(ruleFromRow);
}

export async function insertReglaComisionRemota(rule: CommissionRule, idProyecto: number): Promise<{ rule: CommissionRule | null; tableMissing: boolean }> {
  const { data, error } = await (supabase as any).from("comisiones_reglas").insert(ruleToRow(rule, idProyecto)).select().single();
  if (error) return { rule: null, tableMissing: error.code === TABLE_MISSING_CODE };
  return { rule: ruleFromRow(data), tableMissing: false };
}

/** Inserta varias reglas de una vez (usado por "Sincronizar roles y comisiones"). */
export async function insertReglasComisionRemotas(rules: CommissionRule[], idProyecto: number): Promise<{ rules: CommissionRule[]; tableMissing: boolean }> {
  if (!rules.length) return { rules: [], tableMissing: false };
  const { data, error } = await (supabase as any).from("comisiones_reglas").insert(rules.map((r) => ruleToRow(r, idProyecto))).select();
  if (error) return { rules: [], tableMissing: error.code === TABLE_MISSING_CODE };
  return { rules: (data as any[]).map(ruleFromRow), tableMissing: false };
}

/** Update/delete operan por `id` (PK única global) — no necesitan el proyecto. */
export async function updateReglaComisionRemota(rule: CommissionRule): Promise<SyncResult> {
  const { error } = await (supabase as any).from("comisiones_reglas").update({
    id_canal: Number(rule.channelId),
    id_rol: rule.roleId,
    porcentaje: rule.percentage,
    pool: rule.pool,
    fecha_actualizacion: new Date().toISOString(),
  }).eq("id", Number(rule.id));
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}

export async function deleteReglaComisionRemota(id: string): Promise<SyncResult> {
  const { error } = await (supabase as any).from("comisiones_reglas").delete().eq("id", Number(id));
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}

// ================================================================
// Config del Motor de Comisiones por proyecto — Modo A/B + Comisión Total
// (`comisiones_motor_config`, una fila por `id_proyecto`)
// ================================================================

function motorConfigFromRow(row: any): MotorConfig {
  return {
    commissionMode: row.modo,
    totalCommissionPct: Number(row.comision_total_pct ?? 0),
  };
}

export async function fetchMotorConfigReal(idProyecto: number): Promise<MotorConfig | null> {
  const { data, error } = await (supabase as any).from("comisiones_motor_config").select("*").eq("id_proyecto", idProyecto).eq("activo", true).maybeSingle();
  if (error || !data) return null;
  return motorConfigFromRow(data);
}

export async function updateMotorConfigRemoto(config: MotorConfig, idProyecto: number): Promise<SyncResult> {
  const { error } = await (supabase as any).from("comisiones_motor_config").upsert({
    id_proyecto: idProyecto,
    modo: config.commissionMode,
    comision_total_pct: config.totalCommissionPct,
    activo: true,
    fecha_actualizacion: new Date().toISOString(),
  }, { onConflict: "id_proyecto" });
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}
