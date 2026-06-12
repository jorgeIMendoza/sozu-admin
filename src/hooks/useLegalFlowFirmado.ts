import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enrichLegalFlowCases } from "@/hooks/legalFlowEnrich";
import type { LegalRequest } from "@/types/legal-flow";

/**
 * Etapa 6 "Firmado" del Pipeline de Contratos en SOZU Legal Flow.
 *
 * Criterio: cuentas de cobranza con al menos un documento "Contrato
 * firmado completamente" (id_tipo_documento = 18) en estatus de
 * verificación "Validado" (id_estatus_verificacion = 2). El paso de
 * validación lo dispara el área legal en la Etapa 5 — una vez que
 * sucede, el expediente avanza acá y permanece visible aunque la
 * propiedad transicione a Vendida.
 */

const TIPO_DOC_CONTRATO_FIRMADO = 18;
const ESTATUS_VERIFICACION_VALIDADO = 2;

export function useLegalFlowFirmado() {
  return useQuery<LegalRequest[]>({
    queryKey: ["legal_flow_firmado"],
    queryFn: fetchFirmado,
    staleTime: 60_000,
  });
}

async function fetchFirmado(): Promise<LegalRequest[]> {
  // 1) Documentos Contrato firmado completamente con verificación Validada.
  const PAGE = 1000;
  const docsRows: Array<any> = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = ((await (supabase as any)
      .from("documentos")
      .select("id_cuenta_cobranza, fecha_creacion")
      .eq("id_tipo_documento", TIPO_DOC_CONTRATO_FIRMADO)
      .eq("id_estatus_verificacion", ESTATUS_VERIFICACION_VALIDADO)
      .eq("activo", true)
      .not("id_cuenta_cobranza", "is", null)
      .range(offset, offset + PAGE - 1)) as any);
    if (error) throw error;
    const batch = (data || []) as Array<any>;
    docsRows.push(...batch);
    if (batch.length < PAGE) break;
    if (offset > 100_000) break;
  }
  if (!docsRows.length) return [];

  const ccIds = Array.from(
    new Set(docsRows.map((d) => d.id_cuenta_cobranza as number)),
  );

  // 2) Cuentas de cobranza correspondientes.
  const cuentasRows: Array<any> = [];
  const ccCols =
    "id, id_oferta, id_propiedad, precio_final, fecha_compra, fecha_creacion";
  const BATCH = 500;
  for (let i = 0; i < ccIds.length; i += BATCH) {
    const slice = ccIds.slice(i, i + BATCH);
    const { data, error } = ((await (supabase as any)
      .from("cuentas_cobranza")
      .select(ccCols)
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .in("id", slice)) as any);
    if (error) throw error;
    cuentasRows.push(...((data || []) as Array<any>));
  }
  if (!cuentasRows.length) return [];

  // 3) Ofertas (resolver id_propiedad efectivo).
  const ofertaIds = Array.from(
    new Set(cuentasRows.map((c) => c.id_oferta).filter((v): v is number => !!v)),
  );
  const { data: ofs } = ofertaIds.length
    ? ((await (supabase as any)
        .from("ofertas")
        .select("id, id_propiedad, id_producto, id_persona_lead, email_creador")
        .in("id", ofertaIds)) as any)
    : { data: [] };
  const ofertaRows = (ofs || []) as Array<any>;

  // 4) Propiedades — incluye id_estatus_disponibilidad por compatibilidad
  //    con `enrichLegalFlowCases`, pero NO filtramos: aquí no importa
  //    si la propiedad sigue en Apartado o ya transicionó a Vendida.
  const propIds = Array.from(
    new Set(
      cuentasRows
        .map((c) => c.id_propiedad ?? ofertaRows.find((o) => o.id === c.id_oferta)?.id_propiedad ?? null)
        .filter((v): v is number => !!v),
    ),
  );
  const { data: props } = propIds.length
    ? ((await (supabase as any)
        .from("propiedades")
        .select(
          "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
        )
        .in("id", propIds)) as any)
    : { data: [] };
  const propRows = (props || []) as Array<any>;

  return enrichLegalFlowCases({
    cuentas: cuentasRows,
    ofertas: ofertaRows,
    propiedades: propRows,
    status: "Firmado",
    titlePhrase: "Contrato firmado",
  });
}
