import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enrichLegalFlowCases } from "@/hooks/legalFlowEnrich";
import type { LegalRequest } from "@/types/legal-flow";

/**
 * Solicitudes Legales recibidas — primera etapa del Pipeline de Contratos
 * en SOZU Legal Flow.
 *
 * Universo: cuentas de cobranza tipo Propiedad cuyo bien está en estatus
 * "Apartado" (id_estatus_disponibilidad = 4).
 *
 * El expediente que se muestra es el folio de la cuenta de cobranza
 * (CC-XXXXXX). El enrich (titular, compradores, agente vendedor,
 * inmobiliaria, fecha límite = compra+15d) lo hace `enrichLegalFlowCases`.
 */

const ESTATUS_APARTADO = 4;

export function useLegalFlowSolicitudesRecibidas() {
  return useQuery<LegalRequest[]>({
    queryKey: ["legal_flow_solicitudes_recibidas"],
    queryFn: fetchSolicitudesRecibidas,
    staleTime: 60_000,
  });
}

async function fetchSolicitudesRecibidas(): Promise<LegalRequest[]> {
  // 1) Propiedades Apartadas (id_estatus = 4). Apartado tiene volumen
  //    chico (< 1000) así que un solo query sin paginación.
  const { data: props, error: propErr } = await (supabase as any)
    .from("propiedades")
    .select(
      "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
    )
    .eq("id_estatus_disponibilidad", ESTATUS_APARTADO);
  if (propErr) throw propErr;
  const propRows = (props || []) as Array<any>;
  if (!propRows.length) return [];
  const propIds = propRows.map((p) => p.id as number);

  // 2) Ofertas que apuntan a esas propiedades.
  const { data: ofs } = ((await (supabase as any)
    .from("ofertas")
    .select("id, id_propiedad, id_producto, id_persona_lead, email_creador")
    .in("id_propiedad", propIds)) as any);
  const ofertaRows = (ofs || []) as Array<any>;
  const ofertaIds = ofertaRows.map((o) => o.id as number);

  // 3) Cuentas de cobranza vinculadas (por id_propiedad directo o vía id_oferta).
  const cuentasMap = new Map<number, any>();
  const ccCols =
    "id, id_oferta, id_propiedad, precio_final, fecha_compra, fecha_creacion";
  if (propIds.length) {
    const { data, error } = (await (supabase as any)
      .from("cuentas_cobranza")
      .select(ccCols)
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .in("id_propiedad", propIds)) as any;
    if (error) throw error;
    (data || []).forEach((c: any) => cuentasMap.set(c.id, c));
  }
  if (ofertaIds.length) {
    const { data, error } = (await (supabase as any)
      .from("cuentas_cobranza")
      .select(ccCols)
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .in("id_oferta", ofertaIds)) as any;
    if (error) throw error;
    (data || []).forEach((c: any) => cuentasMap.set(c.id, c));
  }
  const cuentasRows = Array.from(cuentasMap.values());
  if (!cuentasRows.length) return [];

  return enrichLegalFlowCases({
    cuentas: cuentasRows,
    ofertas: ofertaRows,
    propiedades: propRows,
    status: "request_received",
    titlePhrase: "Solicitud de contrato",
  });
}
