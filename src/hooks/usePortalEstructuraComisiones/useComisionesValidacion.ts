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
  totalCommissionPct: number;
  channels: Array<{ id: string; name: string; externalCommissionPct: number; active: boolean }>;
  roles: Array<{ id: string; name: string; belongsTo: string }>;
  roleAssignments: Array<{ roleId: string; baseSalary: number }>;
  commissionRules: Array<{ channelId: string; roleId: string; percentage: number; pool: "sozu" | "project" }>;
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
      return data as ComisionValidacion[];
    },
  });
}
