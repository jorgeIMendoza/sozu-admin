import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enrichLegalFlowCases } from "@/hooks/legalFlowEnrich";
import type { LegalRequest } from "@/types/legal-flow";

/**
 * Etapas 3 "Aprobado" y 4 "Firma de cliente" del Pipeline de Contratos en
 * SOZU Legal Flow.
 *
 * Ambas etapas se derivan de marcadores escritos en `legal_flow_bitacora`
 * (scope = 'expediente') por las acciones del detalle del expediente —
 * mismo mecanismo con el que "En revisión legal" se calcula a partir de
 * los gates "Abogado asignado" + "Validación inicial completa":
 *
 *   • Etapa 3 "Aprobado": el abogado aprobó la generación del contrato en
 *     la Revisión legal → bitácora "Contrato aprobado para generación".
 *   • Etapa 4 "Firma de cliente": el contrato se generó y se envió al
 *     cliente para firma → bitácora "Contrato enviado a firma de cliente".
 *
 * Universo: cuentas de cobranza cuya propiedad sigue en estatus "Apartado"
 * (id_estatus_disponibilidad = 4) — antes de que el contrato firmado mueva
 * la propiedad a Vendida. Se excluyen las cuentas que ya tienen un
 * documento "Contrato firmado completamente" (tipo 18): ésas pertenecen a
 * las etapas posteriores "Firma titular"/"Firmado".
 *
 * Una cuenta con ambos marcadores se clasifica en la etapa más avanzada
 * ("Firma de cliente").
 */

const ESTATUS_APARTADO = 4;
const TIPO_DOC_CONTRATO_FIRMADO = 18;
// PostgREST: relación (tabla) inexistente — la migración de bitácora puede
// no estar aplicada todavía. Ver useBitacoraCuentaCobranza.
const POSTGREST_TABLE_NOT_FOUND = "42P01";

/** Marcadores de bitácora que disparan cada etapa. Exportados para que las
 *  acciones del detalle (CaseDetail) escriban exactamente el mismo texto. */
export const MARCADOR_APROBADO = "Contrato aprobado para generación";
export const MARCADOR_FIRMA_CLIENTE = "Contrato enviado a firma de cliente";

export interface AprobadoFirmaClienteResult {
  aprobado: LegalRequest[];
  firmaCliente: LegalRequest[];
}

export function useLegalFlowAprobadoFirmaCliente() {
  return useQuery<AprobadoFirmaClienteResult>({
    queryKey: ["legal_flow_aprobado_firma_cliente"],
    queryFn: fetchAprobadoFirmaCliente,
    staleTime: 60_000,
  });
}

async function fetchAprobadoFirmaCliente(): Promise<AprobadoFirmaClienteResult> {
  const empty: AprobadoFirmaClienteResult = { aprobado: [], firmaCliente: [] };

  // 1) Propiedades Apartadas (mismo universo que Solicitud recibida y Firma
  //    titular).
  const { data: props, error: propErr } = await (supabase as any)
    .from("propiedades")
    .select(
      "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
    )
    .eq("id_estatus_disponibilidad", ESTATUS_APARTADO);
  if (propErr) throw propErr;
  const propRows = (props || []) as Array<any>;
  if (!propRows.length) return empty;
  const propIds = propRows.map((p) => p.id as number);

  // 2) Ofertas vinculadas a esas propiedades.
  const { data: ofs } = (await (supabase as any)
    .from("ofertas")
    .select("id, id_propiedad, id_producto, id_persona_lead, email_creador")
    .in("id_propiedad", propIds)) as any;
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
  if (!cuentasRows.length) return empty;
  const ccIds = cuentasRows.map((c) => c.id as number);

  // 4) Bitácora (scope expediente) para detectar los marcadores de etapa.
  const { data: bitacoraRows, error: bitErr } = (await (supabase as any)
    .from("legal_flow_bitacora")
    .select("id_cuenta_cobranza, mensaje")
    .in("id_cuenta_cobranza", ccIds)
    .eq("activo", true)
    .eq("scope", "expediente")) as any;
  if (bitErr) {
    // Migración pendiente — aún no hay datos reales para estas etapas.
    if (bitErr.code === POSTGREST_TABLE_NOT_FOUND) return empty;
    throw bitErr;
  }
  const aprobadoSet = new Set<number>();
  const firmaClienteSet = new Set<number>();
  for (const r of (bitacoraRows || []) as Array<any>) {
    const id = r.id_cuenta_cobranza as number;
    const msg = (r.mensaje ?? "") as string;
    if (msg.includes(MARCADOR_FIRMA_CLIENTE)) firmaClienteSet.add(id);
    else if (msg.includes(MARCADOR_APROBADO)) aprobadoSet.add(id);
  }
  // Si una cuenta tiene ambos marcadores, gana la etapa más avanzada
  // ("Firma de cliente"). Los marcadores pueden venir en filas separadas,
  // así que depuramos el set de aprobados.
  for (const id of firmaClienteSet) aprobadoSet.delete(id);
  if (aprobadoSet.size === 0 && firmaClienteSet.size === 0) return empty;

  // 5) Excluir cuentas que ya tienen "Contrato firmado completamente"
  //    (tipo 18): pertenecen a Firma titular / Firmado, etapas posteriores.
  const candidatosIds = Array.from(new Set([...aprobadoSet, ...firmaClienteSet]));
  const { data: docs18 } = (await (supabase as any)
    .from("documentos")
    .select("id_cuenta_cobranza")
    .in("id_cuenta_cobranza", candidatosIds)
    .eq("id_tipo_documento", TIPO_DOC_CONTRATO_FIRMADO)
    .eq("activo", true)) as any;
  const conDoc18 = new Set<number>(
    ((docs18 || []) as Array<any>).map((d) => d.id_cuenta_cobranza as number),
  );

  const aprobadoCuentas = cuentasRows.filter(
    (c) => aprobadoSet.has(c.id) && !conDoc18.has(c.id),
  );
  const firmaClienteCuentas = cuentasRows.filter(
    (c) => firmaClienteSet.has(c.id) && !conDoc18.has(c.id),
  );

  const [aprobado, firmaCliente] = await Promise.all([
    aprobadoCuentas.length
      ? enrichLegalFlowCases({
          cuentas: aprobadoCuentas,
          ofertas: ofertaRows,
          propiedades: propRows,
          status: "Aprobado",
          titlePhrase: "Contrato aprobado",
        })
      : Promise.resolve([] as LegalRequest[]),
    firmaClienteCuentas.length
      ? enrichLegalFlowCases({
          cuentas: firmaClienteCuentas,
          ofertas: ofertaRows,
          propiedades: propRows,
          status: "Firma cliente",
          titlePhrase: "Contrato en firma de cliente",
        })
      : Promise.resolve([] as LegalRequest[]),
  ]);

  return { aprobado, firmaCliente };
}
