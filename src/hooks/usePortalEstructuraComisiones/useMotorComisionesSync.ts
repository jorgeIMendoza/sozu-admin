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

/** Código Postgres de violación de constraint UNIQUE. */
const DUPLICATE_KEY_CODE = "23505";

/**
 * La columna existe en el código pero no en la BD: falta ejecutar el DDL.
 * `42703` lo devuelve Postgres; `PGRST204` lo devuelve PostgREST cuando la
 * columna tampoco está en su schema cache. Reintentar nunca lo resuelve, así
 * que se distingue para poder decirlo en el mensaje.
 */
const COLUMN_MISSING_CODES = ["42703", "PGRST204"];
const isColumnMissing = (error?: { code?: string } | null) =>
  !!error?.code && COLUMN_MISSING_CODES.includes(error.code);

export interface SyncResult {
  ok: boolean;
  /** true cuando el fallo es porque la tabla todavía no existe (DDL pendiente) — no debe mostrarse como error al usuario. */
  tableMissing: boolean;
  /** true cuando el fallo es porque ya existe una fila con la misma combinación canal×persona×proyecto — error de negocio, no técnico. */
  duplicate?: boolean;
  /** true cuando falta una columna en la BD (DDL pendiente). Reintentar no sirve. */
  columnMissing?: boolean;
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
    personalId: row.id_personal != null ? String(row.id_personal) : null,
    percentage: Number(row.porcentaje ?? 0),
    pool: row.pool,
  };
}

/**
 * No incluye `id` — la BD lo asigna (IDENTITY). Válido para insert y update.
 *
 * `id_rol` es `text`, no `bigint`: identifica un rol de "Puestos y Sueldos"
 * (`useSimulator().roles`, ej. 'role-dir-sozu'), que es
 * 100% local (localStorage) y no tiene tabla propia — es un catálogo
 * distinto de `roles_organizacionales` (Directorio de Personal).
 */
function ruleToRow(rule: CommissionRule, idProyecto: number) {
  return {
    id_proyecto: idProyecto,
    id_canal: Number(rule.channelId),
    id_rol: rule.roleId,
    id_personal: rule.personalId != null ? Number(rule.personalId) : null,
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

/**
 * Inserta/actualiza varias reglas de una vez (usado por "Sincronizar roles y
 * comisiones" y por "Guardar cambios" del Motor de Comisiones).
 *
 * Usa `upsert` (no `insert` puro) sobre la unique key real de la tabla
 * (`id_proyecto, id_canal, id_personal`, ver `comisiones_reglas_persona_uq`).
 * Necesario porque el estado local (`commissionRules`) puede quedar
 * momentáneamente desfasado de la BD al cambiar de proyecto (fetch en vuelo)
 * o por dos sesiones sincronizando a la vez — con `insert` puro, intentar
 * crear una fila que ya existe para esa persona×canal×proyecto revienta con
 * `23505 duplicate key`. Con `upsert` esa misma fila simplemente se
 * actualiza en vez de fallar.
 *
 * Antes la unicidad era por rol (`id_canal, id_rol, id_proyecto`), lo que
 * impedía tener dos personas del mismo rol comisionando en un canal.
 */
export async function insertReglasComisionRemotas(rules: CommissionRule[], idProyecto: number): Promise<{ rules: CommissionRule[]; tableMissing: boolean; columnMissing: boolean }> {
  if (!rules.length) return { rules: [], tableMissing: false, columnMissing: false };
  const { data, error } = await (supabase as any).from("comisiones_reglas")
    .upsert(rules.map((r) => ruleToRow(r, idProyecto)), { onConflict: "id_proyecto,id_canal,id_personal" })
    .select();
  if (error) {
    return { rules: [], tableMissing: error.code === TABLE_MISSING_CODE, columnMissing: isColumnMissing(error) };
  }
  return { rules: (data as any[]).map(ruleFromRow), tableMissing: false, columnMissing: false };
}

/** Update/delete operan por `id` (PK única global) — no necesitan el proyecto. */
export async function updateReglaComisionRemota(rule: CommissionRule): Promise<SyncResult> {
  const { error } = await (supabase as any).from("comisiones_reglas").update({
    id_canal: Number(rule.channelId),
    id_rol: rule.roleId,
    id_personal: rule.personalId != null ? Number(rule.personalId) : null,
    porcentaje: rule.percentage,
    pool: rule.pool,
    fecha_actualizacion: new Date().toISOString(),
  }).eq("id", Number(rule.id));
  return {
    ok: !error,
    tableMissing: error?.code === TABLE_MISSING_CODE,
    duplicate: error?.code === DUPLICATE_KEY_CODE,
    columnMissing: isColumnMissing(error),
  };
}

export async function deleteReglaComisionRemota(id: string): Promise<SyncResult> {
  const { error } = await (supabase as any).from("comisiones_reglas").delete().eq("id", Number(id));
  return { ok: !error, tableMissing: error?.code === TABLE_MISSING_CODE };
}

// ================================================================
// Comisión total POR CANAL y por proyecto (`comisiones_canal_config`)
//
// Sustituye a `comisiones_motor_config`, que el front consultaba pero que
// nunca existió en la BD: el total se leía como `null`, caía a un default de
// 6% y ningún cambio se persistía. Ahora cada Canal de Venta define su propio
// porcentaje sobre el precio de venta final, y puede diferir entre desarrollos.
// ================================================================

/** Devuelve el mapa `channelId -> comisión total %` del proyecto. */
export async function fetchMotorConfigReal(idProyecto: number): Promise<MotorConfig | null> {
  const { data, error } = await (supabase as any)
    .from("comisiones_canal_config")
    .select("id_canal, comision_total_pct")
    .eq("id_proyecto", idProyecto)
    .eq("activo", true);
  if (error || !data) return null;
  const channelTotals: Record<string, number> = {};
  for (const row of data as any[]) {
    channelTotals[String(row.id_canal)] = Number(row.comision_total_pct ?? 0);
  }
  return { channelTotals };
}

/**
 * Persiste el total de cada canal con un solo upsert.
 *
 * `onConflict` apunta a `comisiones_canal_config_proyecto_canal_uq`, que es un
 * índice único NO parcial justamente para que PostgREST pueda inferirlo.
 */
export async function updateMotorConfigRemoto(config: MotorConfig, idProyecto: number): Promise<SyncResult> {
  const filas = Object.entries(config.channelTotals).map(([channelId, pct]) => ({
    id_proyecto: idProyecto,
    id_canal: Number(channelId),
    comision_total_pct: pct,
    activo: true,
    fecha_actualizacion: new Date().toISOString(),
  }));
  if (!filas.length) return { ok: true, tableMissing: false };

  const { error } = await (supabase as any)
    .from("comisiones_canal_config")
    .upsert(filas, { onConflict: "id_proyecto,id_canal" });
  return {
    ok: !error,
    tableMissing: error?.code === TABLE_MISSING_CODE,
    columnMissing: isColumnMissing(error),
  };
}

// ================================================================
// Canales POR PROYECTO — membresía y porcentajes propios
// (`comisiones_canal_config`, columnas del Anexo 7)
//
// `comisiones_canales` sigue siendo el catálogo maestro global (nombre, código,
// categoría, banderas). Aquí vive lo que varía por desarrollo: si el canal
// aplica y con qué porcentajes. Los porcentajes NULL heredan del catálogo.
// ================================================================

/** Configuración de un canal para un proyecto. `null` = hereda del catálogo. */
export interface CanalConfigProyecto {
  idCanal: string;
  /** Membresía: si el canal aplica a este proyecto. */
  aplica: boolean;
  comisionTotalPct: number;
  comisionExternaPct: number | null;
  comisionMinPct: number | null;
  comisionMaxPct: number | null;
  /** Cuándo se guardó por última vez esta configuración. */
  fechaActualizacion?: string | null;
  /** Quién la guardó. `null` = se configuró antes de registrar autoría. */
  actualizadoPor?: string | null;
}

/**
 * Lee la configuración de todos los canales del proyecto, incluidos los que se
 * quitaron (`aplica = false`): la pantalla necesita mostrarlos para poder
 * volver a habilitarlos.
 *
 * Devuelve `null` si la tabla no existe (DDL del Anexo 5 pendiente). Si existe
 * pero le faltan las columnas del Anexo 7, relee sin ellas y todo queda como
 * heredado — la pantalla sigue funcionando.
 */
export async function fetchCanalesConfigProyecto(idProyecto: number): Promise<CanalConfigProyecto[] | null> {
  const completo = await (supabase as any)
    .from("comisiones_canal_config")
    .select("id_canal, activo, comision_total_pct, comision_externa_pct, comision_min_pct, comision_max_pct, fecha_actualizacion, actualizado_por")
    .eq("id_proyecto", idProyecto);

  if (!completo.error && completo.data) {
    return (completo.data as any[]).map(mapCanalConfig);
  }
  if (!isColumnMissing(completo.error)) return null;

  // Sin `actualizado_por` (DDL de autoría pendiente) se relee con la fecha, que
  // sí existe desde antes: se pierde el autor, no el rastro del cambio.
  const sinAutor = await (supabase as any)
    .from("comisiones_canal_config")
    .select("id_canal, activo, comision_total_pct, comision_externa_pct, comision_min_pct, comision_max_pct, fecha_actualizacion")
    .eq("id_proyecto", idProyecto);
  if (!sinAutor.error && sinAutor.data) {
    return (sinAutor.data as any[]).map(mapCanalConfig);
  }

  const parcial = await (supabase as any)
    .from("comisiones_canal_config")
    .select("id_canal, activo, comision_total_pct")
    .eq("id_proyecto", idProyecto);
  if (parcial.error || !parcial.data) return null;
  return (parcial.data as any[]).map(mapCanalConfig);
}

function mapCanalConfig(row: any): CanalConfigProyecto {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    idCanal: String(row.id_canal),
    aplica: row.activo ?? true,
    comisionTotalPct: Number(row.comision_total_pct ?? 0),
    comisionExternaPct: num(row.comision_externa_pct),
    comisionMinPct: num(row.comision_min_pct),
    comisionMaxPct: num(row.comision_max_pct),
    fechaActualizacion: row.fecha_actualizacion ?? null,
    actualizadoPor: row.actualizado_por ?? null,
  };
}

/**
 * Alta, baja o modificación de un canal en un proyecto, en una sola operación.
 *
 * Es un upsert sobre `(id_proyecto, id_canal)`: agregar un canal que nunca se
 * configuró crea la fila, y quitarlo solo cambia `activo` — así no se pierde el
 * porcentaje capturado ni el contexto de las reglas ya registradas.
 */
export async function guardarCanalConfigProyecto(
  idProyecto: number,
  config: CanalConfigProyecto,
  actualizadoPor?: string | null,
): Promise<SyncResult> {
  const fila: Record<string, unknown> = {
    id_proyecto: idProyecto,
    id_canal: Number(config.idCanal),
    activo: config.aplica,
    comision_total_pct: config.comisionTotalPct,
    comision_externa_pct: config.comisionExternaPct,
    comision_min_pct: config.comisionMinPct,
    comision_max_pct: config.comisionMaxPct,
    fecha_actualizacion: new Date().toISOString(),
  };

  const upsert = (datos: Record<string, unknown>) => (supabase as any)
    .from("comisiones_canal_config")
    .upsert(datos, { onConflict: "id_proyecto,id_canal" });

  const { error } = await upsert({ ...fila, actualizado_por: actualizadoPor ?? null });
  if (!error) return { ok: true, tableMissing: false, columnMissing: false };

  // Sin la columna de autoría el cambio igual se guarda: perder el nombre del
  // autor no justifica perder la configuración que el usuario acaba de capturar.
  if (isColumnMissing(error)) {
    const reintento = await upsert(fila);
    return {
      ok: !reintento.error,
      tableMissing: reintento.error?.code === TABLE_MISSING_CODE,
      columnMissing: isColumnMissing(reintento.error),
    };
  }

  return {
    ok: false,
    tableMissing: error?.code === TABLE_MISSING_CODE,
    columnMissing: false,
  };
}
