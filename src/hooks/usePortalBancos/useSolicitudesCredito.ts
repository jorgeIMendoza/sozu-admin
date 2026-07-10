import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PrequalificationData } from "@/lib/portal-cliente/mortgage-data";

/**
 * Solicitudes de crédito bancario (lead de pre-calificación) — Portal Cliente.
 *
 * Persiste el submit del `PreQualificationFlow` (Pago Final → banco aliado) en
 * `public.bancos_solicitudes`. Fuente de verdad de la tabla y su SLA de cambio
 * de banco: `Ejecuciones_manuales/portal_bancos_solicitudes.md`.
 *
 * Probe graceful: si la tabla aún no existe (DDL pendiente), las lecturas
 * devuelven `null` y el insert no rompe el flujo (queda solo en memoria).
 */

export type SolicitudEstatus =
  | "nuevo" | "asignado" | "contactado" | "en_evaluacion"
  | "pre_aprobado" | "oferta_vinculante" | "en_coordinacion"
  | "formalizado" | "rechazado" | "desistido" | "expirada";

export interface SolicitudCredito {
  id: number;
  id_cuenta_cobranza: number;
  id_banco: number;
  estatus: SolicitudEstatus;
  monto_financiar: number;
  plazo_anios: number;
  dias_respuesta_snapshot: number | null;
  fecha_expiracion: string | null;
  fecha_envio: string;
}

const TERMINALES: SolicitudEstatus[] = ["rechazado", "desistido", "expirada", "formalizado"];

/**
 * ¿Puede el cliente cambiar de banco?
 * - Rechazado → sí.
 * - Con fecha_expiracion vencida → sí (aunque el job aún no la marque `expirada`).
 * - `dias_respuesta` null/<1 (fecha_expiracion null) → NO, selección definitiva.
 * - En cualquier otro caso (vigente dentro del SLA) → NO.
 */
export function puedeCambiarBanco(s: SolicitudCredito | null | undefined): boolean {
  if (!s) return true; // sin solicitud aún → libre de elegir
  if (s.estatus === "rechazado" || s.estatus === "expirada" || s.estatus === "desistido") return true;
  if (s.estatus === "formalizado") return false;
  if (!s.fecha_expiracion) return false; // SLA no definido → definitivo
  return new Date(s.fecha_expiracion).getTime() < Date.now();
}

const KEY = (cuentaId?: number | null) => ["solicitud-credito-vigente", cuentaId ?? "none"] as const;

/** Última solicitud vigente (no terminal, o la más reciente) de la cuenta. */
export function useSolicitudCreditoVigente(cuentaId?: number | null) {
  return useQuery({
    queryKey: KEY(cuentaId),
    enabled: cuentaId != null,
    staleTime: 30_000,
    queryFn: async (): Promise<SolicitudCredito | null> => {
      if (cuentaId == null) return null;
      const { data, error } = await (supabase as any)
        .from("bancos_solicitudes")
        .select(
          "id, id_cuenta_cobranza, id_banco, estatus, monto_financiar, plazo_anios, dias_respuesta_snapshot, fecha_expiracion, fecha_envio",
        )
        .eq("id_cuenta_cobranza", cuentaId)
        .eq("activo", true)
        .order("fecha_envio", { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) return null;
      const r = data[0] as any;
      return {
        id: r.id,
        id_cuenta_cobranza: r.id_cuenta_cobranza,
        id_banco: r.id_banco,
        estatus: r.estatus,
        monto_financiar: Number(r.monto_financiar),
        plazo_anios: r.plazo_anios,
        dias_respuesta_snapshot: r.dias_respuesta_snapshot ?? null,
        fecha_expiracion: r.fecha_expiracion ?? null,
        fecha_envio: r.fecha_envio,
      };
    },
  });
}

export interface CrearSolicitudInput {
  cuentaId: number;
  idBanco: number;
  data: PrequalificationData;
}

/**
 * Inserta una solicitud de pre-calificación. Antes de insertar:
 * 1. Da de baja (activo=false) cualquier solicitud vigente previa de la cuenta
 *    (cambio de banco / reenvío) para no chocar con el índice único parcial.
 * 2. Lee el SLA del banco (`bancos_convenio.dias_respuesta`) y calcula
 *    `fecha_expiracion` (null si SLA null/<1 → selección definitiva).
 */
export function useCrearSolicitudCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cuentaId, idBanco, data }: CrearSolicitudInput): Promise<boolean> => {
      // 1. SLA del banco
      let diasRespuesta: number | null = null;
      try {
        const { data: conv } = await (supabase as any)
          .from("bancos_convenio")
          .select("dias_respuesta")
          .eq("id_banco", idBanco)
          .eq("activo", true)
          .limit(1)
          .maybeSingle();
        const d = conv?.dias_respuesta;
        diasRespuesta = d != null && Number(d) >= 1 ? Number(d) : null;
      } catch {
        diasRespuesta = null;
      }
      const fechaExpiracion =
        diasRespuesta != null
          ? new Date(Date.now() + diasRespuesta * 24 * 60 * 60 * 1000).toISOString()
          : null;

      // 2. Baja de la solicitud vigente previa (evita colisión con índice único)
      await (supabase as any)
        .from("bancos_solicitudes")
        .update({ activo: false, fecha_actualizacion: new Date().toISOString() })
        .eq("id_cuenta_cobranza", cuentaId)
        .eq("activo", true)
        .not("estatus", "in", "(rechazado,desistido,expirada,formalizado)");

      // 3. Insert de la nueva solicitud (sin perfil/contacto: ya está en la BD)
      const { error } = await (supabase as any).from("bancos_solicitudes").insert({
        id_cuenta_cobranza: cuentaId,
        id_banco: idBanco,
        monto_financiar: data.montoFinanciar,
        plazo_anios: data.plazoAnios,
        mensualidad_estimada_min: data.estimatedMonthlyMin ?? null,
        mensualidad_estimada_max: data.estimatedMonthlyMax ?? null,
        tasa_estimada_min: data.estimatedRateMin ?? null,
        tasa_estimada_max: data.estimatedRateMax ?? null,
        cat_estimado_min: data.estimatedCatMin ?? null,
        cat_estimado_max: data.estimatedCatMax ?? null,
        estatus: "nuevo",
        dias_respuesta_snapshot: diasRespuesta,
        fecha_expiracion: fechaExpiracion,
        consentimiento_datos: data.consentimientoCompartirDatos,
        fecha_consentimiento: data.consentimientoCompartirDatos ? data.submittedAt : null,
        fecha_envio: data.submittedAt,
      });
      // Graceful: tabla inexistente / error → no romper el flujo (UX en memoria).
      if (error) return false;
      return true;
    },
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: KEY(vars.cuentaId) });
    },
  });
}
