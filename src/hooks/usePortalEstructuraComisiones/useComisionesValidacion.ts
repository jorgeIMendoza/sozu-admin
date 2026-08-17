import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Propuesta + validación de la Estructura de Comisiones por proyecto.
 *
 * El Motor de Comisiones del Portal Estructura de comisiones vive en localStorage
 * (y en Supabase para lo compartido: canales, matriz canal×puesto, config del
 * motor); al "Enviar a validar" se persiste un snapshot autocontenido en
 * `comisiones_propuestas` (upsert por proyecto — una única propuesta vigente
 * por proyecto, sin dimensión de escenario). El Portal Alta Dirección lo
 * visualiza en solo lectura y registra Validar/Rechazar en
 * `comisiones_validaciones` (historial con snapshot).
 *
 * Probe graceful: si las tablas aún no existen (DDL pendiente, ver
 * `Ejecuciones_manuales/motor_comisiones_canales_escenarios.md`), las
 * consultas devuelven `[]` para no romper la UI.
 */

export type EstadoPropuesta = "propuesta" | "validada" | "rechazada";
export type EstadoValidacion = "validada" | "rechazada";

/** Siempre Modo A (sobre venta) — el Motor de Comisiones real no permite elegir modo. */
export interface MotorSnapshot {
  /**
   * Total único del motor. Opcional: solo lo traen los snapshots enviados antes
   * de que la comisión total pasara a definirse por canal.
   */
  totalCommissionPct?: number;
  /**
   * `totalCommissionPct` por canal. Opcional por la misma razón: los snapshots
   * viejos caen al total único de arriba.
   */
  channels: Array<{
    id: string;
    name: string;
    externalCommissionPct: number;
    active: boolean;
    totalCommissionPct?: number;
  }>;
  roles: Array<{ id: string; name: string; belongsTo: string }>;
  roleAssignments: Array<{ roleId: string; baseSalary: number }>;
  /**
   * `comisionista` es opcional a propósito: los snapshots enviados a validar antes
   * de que la comisión pasara de rol a persona no lo traen.
   */
  commissionRules: Array<{
    channelId: string;
    roleId: string;
    percentage: number;
    pool: "sozu" | "project";
    comisionista?: string | null;
    /**
     * Nombre del rol VIGENTE en el Directorio (Roles y Sueldos). Override de
     * `roleId` para mostrar: si a la persona le cambiaron el rol después de
     * grabarse la regla, se muestra el actual en vez del obsoleto.
     */
    rolNombre?: string | null;
    /**
     * Perfil de la persona en la organización, para la columna "Perfil":
     * empleado directo de SOZU o colaborador del Grupo Investimento.
     */
    perfil?: "empleado_sozu" | "colaborador_investimento" | null;
  }>;
}

export interface ComisionPropuesta {
  id: number;
  id_proyecto: number;
  proyecto_nombre: string;
  snapshot: MotorSnapshot;
  estado: EstadoPropuesta;
  propuesta_por: string | null;
  fecha_propuesta: string;
  fecha_actualizacion: string;
}

export interface ComisionValidacion {
  id: number;
  id_proyecto: number;
  snapshot: MotorSnapshot | null;
  estado: EstadoValidacion;
  notas: string | null;
  validado_por: string | null;
  fecha_validacion: string;
}

const PROPUESTAS_KEY = "comisiones-propuestas";
const VALIDACIONES_KEY = "comisiones-validaciones";

/** Propuestas vigentes (opcionalmente filtradas por proyecto). */
export function useComisionesPropuestas(idProyecto?: number | null) {
  return useQuery({
    queryKey: [PROPUESTAS_KEY, idProyecto ?? "all"],
    staleTime: 30_000,
    queryFn: async (): Promise<ComisionPropuesta[]> => {
      let q = (supabase as any)
        .from("comisiones_propuestas")
        .select(
          "id, id_proyecto, snapshot, estado, propuesta_por, fecha_propuesta, fecha_actualizacion, proyectos!comisiones_propuestas_id_proyecto_fkey(nombre)",
        )
        .eq("activo", true)
        .order("fecha_actualizacion", { ascending: false });
      if (idProyecto != null) q = q.eq("id_proyecto", idProyecto);
      const { data, error } = await q;
      if (error || !data) return [];
      return (data as any[]).map((r) => ({
        id: r.id,
        id_proyecto: r.id_proyecto,
        proyecto_nombre: r.proyectos?.nombre ?? `Proyecto ${r.id_proyecto}`,
        snapshot: r.snapshot as MotorSnapshot,
        estado: (r.estado ?? "propuesta") as EstadoPropuesta,
        propuesta_por: r.propuesta_por ?? null,
        fecha_propuesta: r.fecha_propuesta,
        fecha_actualizacion: r.fecha_actualizacion,
      }));
    },
  });
}

export interface EnviarPropuestaInput {
  id_proyecto: number;
  snapshot: MotorSnapshot;
  propuesta_por: string | null;
}

/** Upsert de la propuesta por proyecto — usado por Estructura de comisiones. */
export function useEnviarPropuesta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EnviarPropuestaInput) => {
      const { error } = await (supabase as any)
        .from("comisiones_propuestas")
        .upsert(
          {
            id_proyecto: input.id_proyecto,
            snapshot: input.snapshot,
            estado: "propuesta",
            propuesta_por: input.propuesta_por,
            fecha_actualizacion: new Date().toISOString(),
            activo: true,
          },
          { onConflict: "id_proyecto" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROPUESTAS_KEY] }),
  });
}

export interface ValidarPropuestaInput {
  propuestaId: number;
  id_proyecto: number;
  snapshot: MotorSnapshot;
  estado: EstadoValidacion;
  notas: string | null;
  validado_por: string | null;
}

/** Registra una validación/rechazo (con snapshot) y actualiza el estado de la propuesta. */
export function useValidarPropuesta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ValidarPropuestaInput) => {
      const { error: insErr } = await (supabase as any).from("comisiones_validaciones").insert({
        id_proyecto: input.id_proyecto,
        snapshot: input.snapshot,
        estado: input.estado,
        notas: input.notas,
        validado_por: input.validado_por,
      });
      if (insErr) throw insErr;
      const { error: updErr } = await (supabase as any)
        .from("comisiones_propuestas")
        .update({ estado: input.estado, fecha_actualizacion: new Date().toISOString() })
        .eq("id", input.propuestaId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROPUESTAS_KEY] });
      qc.invalidateQueries({ queryKey: [VALIDACIONES_KEY] });
    },
  });
}

/** Historial de validaciones de un proyecto. */
export function useValidacionesHistorial(idProyecto?: number | null) {
  return useQuery({
    queryKey: [VALIDACIONES_KEY, idProyecto ?? "all"],
    enabled: idProyecto != null,
    staleTime: 30_000,
    queryFn: async (): Promise<ComisionValidacion[]> => {
      if (idProyecto == null) return [];
      const { data, error } = await (supabase as any)
        .from("comisiones_validaciones")
        .select("id, id_proyecto, snapshot, estado, notas, validado_por, fecha_validacion")
        .eq("id_proyecto", idProyecto)
        .order("fecha_validacion", { ascending: false });
      if (error || !data) return [];
      // Excluir las filas de validación POR CANAL (marcadas es_canal en snapshot).
      return (data as ComisionValidacion[]).filter((r) => !(r.snapshot as any)?.es_canal);
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * Validación POR CANAL — una decisión por canal, sobre la MISMA tabla
 * `comisiones_validaciones` (sin DDL nuevo). Cada decisión por canal es una
 * fila cuyo `snapshot` lleva el marcador `es_canal: true` + `id_canal` +
 * `snapshot_fecha` (la fecha de la propuesta validada). La decisión vigente de
 * un canal es la fila más reciente para ese canal. El proyecto se valida cuando
 * todos sus canales están validados.
 * ───────────────────────────────────────────────────────────────────────── */

const VALIDACIONES_CANAL_KEY = "comisiones-validaciones-canal";

export type EstadoValidacionCanal = "validada" | "rechazada";

/** Hash determinista corto (djb2) → base36. */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Huella del CONTENIDO de un canal dentro de un snapshot de propuesta: lo que
 * define su estructura de comisión (comisión externa, total, activo, y por cada
 * comisionista su nombre + % + pool). Si esto no cambia, la validación previa
 * del canal SIGUE vigente aunque se reenvíe la propuesta por un cambio en OTRO
 * canal. Se ignora el rol/perfil (se derivan del Directorio y no son una
 * modificación del canal). Se calcula sobre el snapshot CRUDO de la propuesta.
 */
export function fingerprintCanal(snapshot: MotorSnapshot | null | undefined, idCanal: string): string {
  if (!snapshot) return "";
  const ch = snapshot.channels?.find((c) => c.id === idCanal);
  const reglas = (snapshot.commissionRules ?? [])
    .filter((r) => r.channelId === idCanal)
    .map((r) => ({ c: r.comisionista ?? null, p: r.percentage ?? 0, pool: r.pool }))
    .sort((a, b) => `${a.c}`.localeCompare(`${b.c}`) || a.pool.localeCompare(b.pool) || a.p - b.p);
  const payload = JSON.stringify({
    ext: ch?.externalCommissionPct ?? null,
    tot: ch?.totalCommissionPct ?? snapshot.totalCommissionPct ?? null,
    active: ch?.active ?? null,
    reglas,
  });
  return hashStr(payload);
}

export interface ValidacionCanal {
  id: number;
  id_proyecto: number;
  id_canal: string;
  nombre_canal: string | null;
  estado: EstadoValidacionCanal;
  notas: string | null;
  validado_por: string | null;
  /** `fecha_actualizacion` de la propuesta que se estaba validando (compat). */
  snapshot_fecha: string;
  /**
   * Huella del contenido del canal al validarse (ver `fingerprintCanal`). La
   * decisión sigue vigente mientras coincida con la huella actual del canal, sin
   * importar que se haya reenviado la propuesta por cambios en otros canales.
   * `null` en filas viejas guardadas antes de este esquema (caen a `snapshot_fecha`).
   */
  canal_hash: string | null;
  fecha_validacion: string;
}

/** Decisiones vigentes por canal de un proyecto (última por canal). */
export function useValidacionesCanal(idProyecto?: number | null) {
  return useQuery<ValidacionCanal[]>({
    queryKey: [VALIDACIONES_CANAL_KEY, idProyecto ?? "all"],
    enabled: idProyecto != null,
    staleTime: 15_000,
    queryFn: async () => {
      if (idProyecto == null) return [];
      const { data, error } = await (supabase as any)
        .from("comisiones_validaciones")
        .select("id, id_proyecto, snapshot, estado, notas, validado_por, fecha_validacion")
        .eq("id_proyecto", idProyecto)
        .order("fecha_validacion", { ascending: false });
      if (error || !data) return [];
      // Solo filas por-canal; nos quedamos con la más reciente de cada canal.
      const vistos = new Set<string>();
      const out: ValidacionCanal[] = [];
      for (const r of data as any[]) {
        const s = r.snapshot ?? {};
        if (!s.es_canal || !s.id_canal || vistos.has(s.id_canal)) continue;
        vistos.add(s.id_canal);
        out.push({
          id: r.id,
          id_proyecto: r.id_proyecto,
          id_canal: s.id_canal,
          nombre_canal: s.nombre_canal ?? null,
          estado: r.estado as EstadoValidacionCanal,
          notas: r.notas ?? null,
          validado_por: r.validado_por ?? null,
          snapshot_fecha: s.snapshot_fecha ?? "",
          canal_hash: s.canal_hash ?? null,
          fecha_validacion: r.fecha_validacion,
        });
      }
      return out;
    },
  });
}

export interface ValidarCanalInput {
  id_proyecto: number;
  id_canal: string;
  nombre_canal: string;
  estado: EstadoValidacionCanal;
  notas: string | null;
  validado_por: string | null;
  /** `fecha_actualizacion` de la propuesta vigente. */
  snapshot_fecha: string;
  /** Huella del contenido del canal validado (ver `fingerprintCanal`). */
  canal_hash: string;
}

/** Registra la decisión de UN canal (fila en comisiones_validaciones, marcada es_canal). */
export function useValidarCanalComision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ValidarCanalInput) => {
      const { error } = await (supabase as any).from("comisiones_validaciones").insert({
        id_proyecto: input.id_proyecto,
        estado: input.estado,
        notas: input.notas,
        validado_por: input.validado_por,
        snapshot: {
          es_canal: true,
          id_canal: input.id_canal,
          nombre_canal: input.nombre_canal,
          snapshot_fecha: input.snapshot_fecha,
          canal_hash: input.canal_hash,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [VALIDACIONES_CANAL_KEY] });
      qc.invalidateQueries({ queryKey: [VALIDACIONES_KEY] });
    },
  });
}

/**
 * Actualiza SOLO el `estado` agregado de la propuesta (derivado de los canales).
 * NO toca `fecha_actualizacion`: hacerlo invalidaría el `snapshot_fecha` con el
 * que se compararon las decisiones por canal (aparecerían como pendientes).
 */
export function useActualizarEstadoPropuesta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { propuestaId: number; estado: EstadoPropuesta }) => {
      const { error } = await (supabase as any)
        .from("comisiones_propuestas")
        .update({ estado: input.estado })
        .eq("id", input.propuestaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROPUESTAS_KEY] }),
  });
}
