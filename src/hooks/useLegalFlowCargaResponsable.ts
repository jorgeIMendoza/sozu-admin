import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLegalFlowSolicitudesRecibidas } from "@/hooks/useLegalFlowSolicitudesRecibidas";
import { useLegalFlowAprobadoFirmaCliente } from "@/hooks/useLegalFlowAprobadoFirmaCliente";
import { useLegalFlowFirmaTitular } from "@/hooks/useLegalFlowFirmaTitular";
import type { LegalRequest } from "@/types/legal-flow";

/**
 * "Carga por responsable" de la Vista Ejecutiva del Panel de Operaciones
 * (SOZU Legal Flow).
 *
 * Datos reales: agrupa los expedientes ACTIVOS del pipeline por el abogado
 * responsable asignado. El responsable se persiste en `legal_flow_bitacora`
 * (tipo 'sistema', scope 'expediente', "Abogado asignado") — la misma
 * entrada que promueve el expediente a "En revisión legal".
 *
 * Activos = etapas Solicitud recibida / En revisión legal / Aprobado /
 * Firma de cliente / Firma titular. Se excluye "Firmado" (no es carga
 * pendiente). Se reutilizan los hooks de etapa (comparten caché de
 * react-query, sin doble fetch) para tomar el estatus correcto de cada
 * expediente.
 *
 * Los expedientes sin abogado asignado todavía no se atribuyen a ningún
 * responsable y no aparecen en el panel.
 */

const POSTGREST_TABLE_NOT_FOUND = "42P01";

export interface CargaResponsable {
  /** Nombre del abogado (también sirve de key estable). */
  name: string;
  /** Expedientes activos asignados. */
  active: number;
  /** Casos enriquecidos con `assignedTo`, para el drawer de detalle. */
  cases: LegalRequest[];
}

/** Extrae el nombre del abogado de una entrada "Abogado asignado".
 *  El mensaje se persiste como "Abogado asignado\n\n<nombre>" (la columna
 *  `titulo` aún no existe en BD), así que removemos el prefijo. */
function extraerNombreAbogado(mensaje: string): string {
  return (mensaje ?? "").replace(/^Abogado asignado\s*\n*\s*/, "").trim();
}

export function useLegalFlowCargaResponsable() {
  const { data: recibidas = [], isLoading: l1 } = useLegalFlowSolicitudesRecibidas();
  const { data: aprobadoFirma, isLoading: l2 } = useLegalFlowAprobadoFirmaCliente();
  const { data: firmaTitular = [], isLoading: l3 } = useLegalFlowFirmaTitular();

  const aprobado = aprobadoFirma?.aprobado ?? [];
  const firmaCliente = aprobadoFirma?.firmaCliente ?? [];

  // Expedientes activos, sin duplicar: cada cuenta aparece una vez en su
  // etapa más avanzada (mismo criterio que el PipelineBoard, sin "Firmado").
  const activeRequests = useMemo<LegalRequest[]>(() => {
    const toIdSet = (rows: LegalRequest[]) =>
      new Set(
        rows.map((r) => r.idCuentaCobranza).filter((v): v is number => !!v),
      );
    const aprobadoSet = toIdSet(aprobado);
    const firmaClienteSet = toIdSet(firmaCliente);
    const firmaTitularSet = toIdSet(firmaTitular);
    const recibidasFiltered = recibidas.filter(
      (r) =>
        !r.idCuentaCobranza ||
        (!aprobadoSet.has(r.idCuentaCobranza) &&
          !firmaClienteSet.has(r.idCuentaCobranza) &&
          !firmaTitularSet.has(r.idCuentaCobranza)),
    );
    return [...recibidasFiltered, ...aprobado, ...firmaCliente, ...firmaTitular];
  }, [recibidas, aprobado, firmaCliente, firmaTitular]);

  const activeCcIds = useMemo(
    () =>
      activeRequests
        .map((r) => r.idCuentaCobranza)
        .filter((v): v is number => !!v),
    [activeRequests],
  );
  const ccKey = useMemo(
    () => [...activeCcIds].sort((a, b) => a - b).join(","),
    [activeCcIds],
  );

  // Mapa cuenta → abogado asignado (último "Abogado asignado" por cuenta).
  const { data: lawyerByCuenta = {}, isLoading: l4 } = useQuery<Record<number, string>>({
    queryKey: ["legal_flow_abogado_por_cuenta", ccKey],
    enabled: activeCcIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = (await (supabase as any)
        .from("legal_flow_bitacora")
        .select("id_cuenta_cobranza, mensaje, tipo, fecha_creacion")
        .in("id_cuenta_cobranza", activeCcIds)
        .eq("activo", true)
        .eq("scope", "expediente")
        .eq("tipo", "sistema")
        .order("fecha_creacion", { ascending: true })) as any;
      if (error) {
        // Migración de bitácora pendiente — sin asignaciones reales aún.
        if (error.code === POSTGREST_TABLE_NOT_FOUND) return {};
        throw error;
      }
      const map: Record<number, string> = {};
      for (const r of (data || []) as Array<any>) {
        const msg = (r.mensaje ?? "") as string;
        if (!msg.startsWith("Abogado asignado")) continue;
        const nombre = extraerNombreAbogado(msg);
        // Orden ascendente: la última asignación sobrescribe a las previas.
        if (nombre) map[r.id_cuenta_cobranza as number] = nombre;
      }
      return map;
    },
  });

  const data = useMemo<CargaResponsable[]>(() => {
    const byLawyer = new Map<string, LegalRequest[]>();
    for (const r of activeRequests) {
      const lawyer = r.idCuentaCobranza
        ? lawyerByCuenta[r.idCuentaCobranza]
        : undefined;
      if (!lawyer) continue; // expediente sin responsable asignado
      const arr = byLawyer.get(lawyer) ?? [];
      arr.push({ ...r, assignedTo: lawyer });
      byLawyer.set(lawyer, arr);
    }
    return Array.from(byLawyer.entries())
      .map(([name, cases]) => ({ name, active: cases.length, cases }))
      .sort((a, b) => b.active - a.active);
  }, [activeRequests, lawyerByCuenta]);

  return { data, isLoading: l1 || l2 || l3 || l4 };
}
