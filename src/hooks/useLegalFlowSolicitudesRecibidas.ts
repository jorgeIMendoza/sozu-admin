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

  // 4) Determinar promoción a "En revisión legal" leyendo la bitácora.
  //    Un expediente avanza cuando tiene AMBOS gates marcados:
  //    - Abogado asignado (entrada tipo='sistema', scope='expediente',
  //      titulo='Abogado asignado').
  //    - Validación inicial completa (tipo='validacion',
  //      scope='expediente', titulo='Validación inicial completa').
  const ccIds = cuentasRows.map((c) => c.id as number);
  const { data: bitacoraRows } = ccIds.length
    ? ((await (supabase as any)
        .from("legal_flow_bitacora")
        .select("id_cuenta_cobranza, tipo, scope, mensaje, fecha_creacion")
        .in("id_cuenta_cobranza", ccIds)
        .eq("activo", true)
        .eq("scope", "expediente")) as any)
    : { data: [] };

  const promotedSet = computePromotedCuentas(
    (bitacoraRows || []) as Array<any>,
  );

  const all = await enrichLegalFlowCases({
    cuentas: cuentasRows,
    ofertas: ofertaRows,
    propiedades: propRows,
    status: "Solicitud recibida",
    titlePhrase: "Solicitud de contrato",
  });

  // Reescribir el status de los expedientes promovidos. El title también
  // cambia para reflejar la nueva etapa.
  return all.map((req) => {
    if (!req.idCuentaCobranza || !promotedSet.has(req.idCuentaCobranza)) return req;
    const newTitle = (req.title ?? "").replace(/Solicitud de contrato/, "Contrato en revisión");
    return {
      ...req,
      status: "En revisión legal" as const,
      title: newTitle || req.title,
    };
  });
}

/**
 * Devuelve el set de id_cuenta_cobranza que cumplen AMBOS gates:
 *   - asignación de abogado (entrada sistema con "Abogado asignado")
 *   - validación inicial completa (entrada validacion con
 *     "Validación inicial completa")
 *
 * Tolerante al shape antiguo donde titulo no existía y el dato venía
 * embebido en `mensaje` con `"<titulo>\n\n<descripcion>"`.
 */
function computePromotedCuentas(rows: Array<any>): Set<number> {
  const byCuenta = new Map<number, { lawyer: boolean; intake: boolean }>();
  for (const r of rows) {
    const id = r.id_cuenta_cobranza as number;
    if (!byCuenta.has(id)) byCuenta.set(id, { lawyer: false, intake: false });
    const flags = byCuenta.get(id)!;
    const mensaje: string = (r.mensaje ?? "") as string;
    if (r.tipo === "sistema" && mensaje.includes("Abogado asignado")) {
      flags.lawyer = true;
    }
    if (
      r.tipo === "validacion" &&
      mensaje.includes("Validación inicial completa")
    ) {
      flags.intake = true;
    }
  }
  const promoted = new Set<number>();
  byCuenta.forEach((flags, id) => {
    if (flags.lawyer && flags.intake) promoted.add(id);
  });
  return promoted;
}
