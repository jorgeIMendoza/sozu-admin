import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Extras (solo lectura) del detalle de una Cuenta de Cobranza de producto,
 * para el Portal de Productos: pagos reales (con comprobantes y validación),
 * multas por acuerdo y documentos ligados.
 *
 * NO incluye KPIs ni acuerdos/aplicaciones base: esos vienen del mismo
 * `CuentaProducto` del store (misma fuente que la lista de Cartera) para que
 * Total Pagado / Saldo Pendiente reconcilien al céntimo. Aquí solo se añaden
 * datos adicionales del detalle. Cero escrituras.
 */

export interface PagoAplicacion {
  id: number;
  idAcuerdo: number;
  monto: number;
  esMulta: boolean;
}
export interface PagoReal {
  id: number;
  monto: number;
  metodo: string;
  claveRastreo: string | null;
  fecha: string | null;
  urlCep: string | null;
  urlRecibo: string | null;
  descripcion: string | null;
  validacion: { estado: string; motivo: string | null } | null;
  apps: PagoAplicacion[];
}
export interface MultaReal {
  id: number;
  idAcuerdo: number;
  monto: number;
  descripcion: string | null;
  esPagada: boolean;
}
export interface DocumentoReal {
  id: number;
  tipo: string;
  numero: string | null;
  url: string | null;
  esDraft: boolean;
  estatusId: number | null;
}

export interface CuentaProductoExtras {
  pagos: PagoReal[];
  multasPorAcuerdo: Record<string, MultaReal[]>;
  documentos: DocumentoReal[];
}

const EMPTY: CuentaProductoExtras = { pagos: [], multasPorAcuerdo: {}, documentos: [] };

export function useCuentaProductoDetalle(cuentaId: number | null, acuerdoIds: number[]) {
  return useQuery<CuentaProductoExtras>({
    queryKey: ["portal-productos-detalle", cuentaId, acuerdoIds],
    enabled: cuentaId != null,
    staleTime: 60_000,
    queryFn: async () => {
      if (cuentaId == null) return EMPTY;
      try {
        // Pagos reales de la cuenta.
        const { data: pagosRows } = await (supabase as any)
          .from("pagos")
          .select("id, monto, fecha_pago, clave_rastreo, id_metodos_pago, url_cep, url_recibo, descripcion")
          .eq("id_cuenta_cobranza", cuentaId)
          .eq("activo", true);
        const pagos = (pagosRows ?? []) as any[];
        const pagoIds = pagos.map((p) => p.id);

        // Catálogos + relaciones (en paralelo).
        const metodoIds = [...new Set(pagos.map((p) => p.id_metodos_pago).filter(Boolean))] as number[];
        const [metodosRes, aplicRes, validRes, multasRes, docsRows] = await Promise.all([
          metodoIds.length
            ? (supabase as any).from("metodos_pago").select("id, nombre").in("id", metodoIds)
            : Promise.resolve({ data: [] }),
          pagoIds.length
            ? (supabase as any).from("aplicaciones_pago").select("id, id_pago, id_acuerdo_pago, monto, es_multa").eq("activo", true).in("id_pago", pagoIds)
            : Promise.resolve({ data: [] }),
          pagoIds.length
            ? (supabase as any).from("pago_validaciones").select("id_pago, estado, motivo").in("id_pago", pagoIds)
            : Promise.resolve({ data: [] }),
          acuerdoIds.length
            ? (supabase as any).from("multas").select("id, id_acuerdo_pago, monto, descripcion, es_pagada").in("id_acuerdo_pago", acuerdoIds)
            : Promise.resolve({ data: [] }),
          (supabase as any).from("documentos").select("id, id_tipo_documento, url, numero, es_draft, id_estatus_verificacion").eq("id_cuenta_cobranza", cuentaId).eq("activo", true),
        ]);

        const metodoMap = new Map<number, string>(((metodosRes.data ?? []) as any[]).map((m) => [m.id, m.nombre]));
        const validMap = new Map<number, { estado: string; motivo: string | null }>(
          ((validRes.data ?? []) as any[]).map((v) => [v.id_pago, { estado: v.estado, motivo: v.motivo ?? null }]),
        );
        const aplicPorPago = new Map<number, PagoAplicacion[]>();
        for (const a of (aplicRes.data ?? []) as any[]) {
          const arr = aplicPorPago.get(a.id_pago) ?? [];
          arr.push({ id: a.id, idAcuerdo: a.id_acuerdo_pago, monto: Number(a.monto || 0), esMulta: !!a.es_multa });
          aplicPorPago.set(a.id_pago, arr);
        }

        const pagosReales: PagoReal[] = pagos.map((p) => ({
          id: p.id,
          monto: Number(p.monto || 0),
          metodo: (p.id_metodos_pago && metodoMap.get(p.id_metodos_pago)) || "Otro",
          claveRastreo: p.clave_rastreo ?? null,
          fecha: p.fecha_pago ?? null,
          urlCep: p.url_cep ?? null,
          urlRecibo: p.url_recibo ?? null,
          descripcion: p.descripcion ?? null,
          validacion: validMap.get(p.id) ?? null,
          apps: aplicPorPago.get(p.id) ?? [],
        }));

        const multasPorAcuerdo: Record<string, MultaReal[]> = {};
        for (const m of (multasRes.data ?? []) as any[]) {
          const key = String(m.id_acuerdo_pago);
          (multasPorAcuerdo[key] ||= []).push({
            id: m.id,
            idAcuerdo: m.id_acuerdo_pago,
            monto: Number(m.monto || 0),
            descripcion: m.descripcion ?? null,
            esPagada: !!m.es_pagada,
          });
        }

        // Tipos de documento.
        const docs = (docsRows.data ?? []) as any[];
        const tipoIds = [...new Set(docs.map((d) => d.id_tipo_documento).filter(Boolean))] as number[];
        const tiposRes = tipoIds.length
          ? await (supabase as any).from("tipos_documento").select("id, nombre").in("id", tipoIds)
          : { data: [] };
        const tipoMap = new Map<number, string>(((tiposRes.data ?? []) as any[]).map((t) => [t.id, t.nombre]));
        const documentos: DocumentoReal[] = docs.map((d) => ({
          id: d.id,
          tipo: (d.id_tipo_documento && tipoMap.get(d.id_tipo_documento)) || "Documento",
          numero: d.numero ?? null,
          url: d.url ?? null,
          esDraft: !!d.es_draft,
          estatusId: d.id_estatus_verificacion ?? null,
        }));

        return { pagos: pagosReales, multasPorAcuerdo, documentos };
      } catch {
        return EMPTY;
      }
    },
  });
}
