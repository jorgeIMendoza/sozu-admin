import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enrichLegalFlowCases } from "@/hooks/legalFlowEnrich";
import type { LegalRequest } from "@/types/legal-flow";

/**
 * Expedientes Archivados — cuentas de cobranza tipo Propiedad cuyo bien
 * está en estatus "Vendido" (id_estatus_disponibilidad = 5).
 *
 * Arquitectura: partir de `cuentas_cobranza` paginadas y filtrar Vendido
 * en JS — igual que `useCobrosPorGestionar`. Partir de `propiedades` no
 * funciona porque la BD tiene ~8k Vendido y PostgREST corta a 1000.
 */

const ESTATUS_VENDIDO = 5;

export function useLegalFlowExpedientesArchivados() {
  return useQuery<LegalRequest[]>({
    queryKey: ["legal_flow_expedientes_archivados"],
    queryFn: fetchExpedientesArchivados,
    staleTime: 60_000,
  });
}

async function fetchExpedientesArchivados(): Promise<LegalRequest[]> {
  // 1) Paginar cuentas_cobranza activas sin padre (~1.5k rows).
  const cuentasRows: Array<any> = [];
  const PAGE = 1000;
  const ccCols =
    "id, id_oferta, id_propiedad, precio_final, fecha_compra, fecha_creacion";
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = (await (supabase as any)
      .from("cuentas_cobranza")
      .select(ccCols)
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .order("id", { ascending: false })
      .range(offset, offset + PAGE - 1)) as any;
    if (error) throw error;
    const batch = (data || []) as Array<any>;
    cuentasRows.push(...batch);
    if (batch.length < PAGE) break;
    if (offset > 100_000) break;
  }
  if (!cuentasRows.length) return [];

  // 2) Ofertas para resolver id_propiedad efectivo + id_producto +
  //    id_persona_lead + email_creador (agente vendedor).
  const ofertaIds = Array.from(
    new Set(
      cuentasRows.map((c) => c.id_oferta).filter((v): v is number => !!v),
    ),
  );
  const ofs: Array<any> = [];
  for (let offset = 0; ofertaIds.length && offset < ofertaIds.length; offset += PAGE) {
    const slice = ofertaIds.slice(offset, offset + PAGE);
    const { data, error } = (await (supabase as any)
      .from("ofertas")
      .select("id, id_propiedad, id_producto, id_persona_lead, email_creador")
      .in("id", slice)) as any;
    if (error) throw error;
    ofs.push(...((data || []) as Array<any>));
  }
  const ofMap = new Map<number, any>(ofs.map((o: any) => [o.id, o]));

  // 3) id_propiedad efectivo por cuenta.
  const propIdsEfectivos = Array.from(
    new Set(
      cuentasRows
        .map((c) => c.id_propiedad ?? ofMap.get(c.id_oferta)?.id_propiedad ?? null)
        .filter((v): v is number => !!v),
    ),
  );

  // 4) Propiedades — incluye id_estatus_disponibilidad para filtrar Vendido en JS.
  const props: Array<any> = [];
  for (let offset = 0; propIdsEfectivos.length && offset < propIdsEfectivos.length; offset += PAGE) {
    const slice = propIdsEfectivos.slice(offset, offset + PAGE);
    const { data, error } = (await (supabase as any)
      .from("propiedades")
      .select(
        "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
      )
      .in("id", slice)) as any;
    if (error) throw error;
    props.push(...((data || []) as Array<any>));
  }
  const propMap = new Map<number, any>(props.map((p: any) => [p.id, p]));

  // 5) Filtrar cuentas con propiedad efectiva en estatus Vendido.
  const cuentasVendido = cuentasRows.filter((c) => {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    if (!idPropEfectivo) return false;
    const p = propMap.get(idPropEfectivo);
    return p?.id_estatus_disponibilidad === ESTATUS_VENDIDO;
  });
  if (!cuentasVendido.length) return [];

  // Restringir propiedades al subset relevante para no inflar el enrich.
  const propIdsVendido = new Set<number>();
  cuentasVendido.forEach((c) => {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    if (idPropEfectivo) propIdsVendido.add(idPropEfectivo);
  });
  const propsVendido = props.filter((p) => propIdsVendido.has(p.id));

  return enrichLegalFlowCases({
    cuentas: cuentasVendido,
    ofertas: ofs,
    propiedades: propsVendido,
    status: "archived",
    titlePhrase: "Contrato firmado",
  });
}
