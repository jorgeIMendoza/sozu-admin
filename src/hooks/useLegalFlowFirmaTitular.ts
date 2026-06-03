import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enrichLegalFlowCases } from "@/hooks/legalFlowEnrich";
import type { LegalRequest } from "@/types/legal-flow";

/**
 * Etapa "Firma titular" del Pipeline de Contratos en SOZU Legal Flow.
 *
 * Criterio: cuentas de cobranza cuya propiedad está en estatus
 * "Apartado" (id_estatus_disponibilidad = 4) y tienen al menos un
 * documento "Contrato firmado completamente" (id_tipo_documento = 18)
 * con estatus de verificación "Pendiente" (id_estatus_verificacion = 1).
 *
 * Semánticamente: el contrato fue firmado en el sistema pero aún
 * falta que Área Legal lo valide.
 */

const ESTATUS_APARTADO = 4;
const TIPO_DOC_CONTRATO_FIRMADO = 18;
const ESTATUS_VERIFICACION_PENDIENTE = 1;

export function useLegalFlowFirmaTitular() {
  return useQuery<LegalRequest[]>({
    queryKey: ["legal_flow_firma_titular"],
    queryFn: fetchFirmaTitular,
    staleTime: 60_000,
  });
}

async function fetchFirmaTitular(): Promise<LegalRequest[]> {
  // 1) Propiedades Apartadas.
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

  // 2) Ofertas vinculadas a esas propiedades.
  const { data: ofs } = ((await (supabase as any)
    .from("ofertas")
    .select("id, id_propiedad, id_producto, id_persona_lead, email_creador")
    .in("id_propiedad", propIds)) as any);
  const ofertaRows = (ofs || []) as Array<any>;
  const ofertaIds = ofertaRows.map((o) => o.id as number);

  // 3) Cuentas de cobranza vinculadas (por id_propiedad o id_oferta).
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

  // 4) Filtrar a las cuentas que tienen un Contrato firmado completamente
  //    (tipo 18) en estatus Pendiente (1).
  const ccIds = cuentasRows.map((c) => c.id as number);
  const { data: docsContrato, error: docsErr } = ((await (supabase as any)
    .from("documentos")
    .select("id_cuenta_cobranza")
    .in("id_cuenta_cobranza", ccIds)
    .eq("id_tipo_documento", TIPO_DOC_CONTRATO_FIRMADO)
    .eq("id_estatus_verificacion", ESTATUS_VERIFICACION_PENDIENTE)
    .eq("activo", true)) as any);
  if (docsErr) throw docsErr;
  const cuentasConContratoPendiente = new Set<number>(
    ((docsContrato || []) as Array<any>).map((d) => d.id_cuenta_cobranza as number),
  );
  const cuentasFiltered = cuentasRows.filter((c) =>
    cuentasConContratoPendiente.has(c.id),
  );
  if (!cuentasFiltered.length) return [];

  return enrichLegalFlowCases({
    cuentas: cuentasFiltered,
    ofertas: ofertaRows,
    propiedades: propRows,
    status: "Firma titular",
    titlePhrase: "Contrato pendiente de validación",
  });
}
