import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildDateRangesFromMonths, getCurrentMonthKey } from "@/components/ui/month-multi-selector";
import { useProyectosSozuIds } from "./proyectosSozu";

/**
 * Fuente de verdad ÚNICA del Pipeline de Ofertas (Portal Alta Dirección).
 *
 * Encapsula el fetch + enriquecimiento + clasificación por etapa de las
 * ofertas, para que tanto la pantalla `Pipeline` como el `Dashboard General`
 * (KPI "Nuevas ofertas" = ofertas Aprobadas) usen exactamente la misma
 * lógica y los conteos coincidan por construcción.
 */

export interface PipelineCard {
  id: number;
  email_creador: string;
  fecha_generacion: string;
  id_esquema_pago_seleccionado: number | null;
  id_estatus_aprobacion: number | null;
  id_propiedad: number | null;
  id_producto: number | null;
  id_persona_lead: number | null;
  lead_nombre?: string;
  propiedad_nombre?: string;
  producto_nombre?: string;
  proyecto_nombre?: string;
  proyecto_id?: number;
  agente_nombre?: string;
  precio?: number | null;
  estatus_disponibilidad?: number;
  cuenta_cobranza_id?: number;
  contrato_draft?: string | null;
  tiene_contrato_firmado?: boolean;
  is_producto?: boolean;
  is_internal?: boolean;
  precio_final_cuenta?: number | null;
  stage?: string;
}

export const STAGES = [
  { key: "expiradas", label: "Expiradas", color: "bg-muted text-muted-foreground" },
  { key: "nuevas", label: "Nuevas Ofertas", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { key: "pendientes", label: "Pendientes de Aprobación", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { key: "aprobadas", label: "Aprobadas", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { key: "rechazadas", label: "Rechazadas", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { key: "revision", label: "En Revisión", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { key: "apartado", label: "Apartado", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { key: "gen_contrato", label: "Generación de Contrato", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { key: "firma_contrato", label: "Firma de Contrato", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  { key: "cierre", label: "Cierre de Venta", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
];

function isVigente(fechaGeneracion: string): boolean {
  const fecha = new Date(fechaGeneracion);
  const expira = new Date(fecha);
  expira.setDate(expira.getDate() + 5);
  return expira >= new Date();
}

export function classifyOffer(o: PipelineCard): string {
  if (o.estatus_disponibilidad === 5) return "cierre";
  if (o.tiene_contrato_firmado) return "firma_contrato";
  if (o.contrato_draft) return "gen_contrato";
  if (o.cuenta_cobranza_id && o.estatus_disponibilidad === 4) return "apartado";
  const vigente = isVigente(o.fecha_generacion);
  if (!vigente && !o.cuenta_cobranza_id) return "expiradas";
  if (!o.id_esquema_pago_seleccionado) return vigente ? "nuevas" : "expiradas";
  if (o.id_estatus_aprobacion === 1) return vigente ? "pendientes" : "expiradas";
  if (o.id_estatus_aprobacion === 2) return "aprobadas";
  if (o.id_estatus_aprobacion === 3) return vigente ? "rechazadas" : "expiradas";
  if (o.id_estatus_aprobacion === 4) return vigente ? "revision" : "expiradas";
  return "nuevas";
}

function dedup(arr: any[]): any[] {
  const seen = new Set<number>();
  return arr.filter((o: any) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

async function enrichOfertas(data: any[]): Promise<PipelineCard[]> {
  if (!data.length) return [];

  const propIds = [...new Set(data.map((o: any) => o.id_propiedad).filter(Boolean))] as number[];
  const leadIds = [...new Set(data.map((o: any) => o.id_persona_lead).filter(Boolean))] as number[];
  const productoIds = [...new Set(data.map((o: any) => o.id_producto).filter(Boolean))] as number[];
  const ofertaIds = data.map((o: any) => o.id);

  // Resolve creator emails → name + role (Alta Dirección sees ALL agents, no a-priori list)
  const allEmails = [...new Set(data.map((o: any) => o.email_creador).filter(Boolean))] as string[];
  const nameMap = new Map<string, string>();
  const agentRoleEmails = new Set<string>();
  for (let i = 0; i < allEmails.length; i += 200) {
    const batch = allEmails.slice(i, i + 200);
    const { data: usuarios } = (await supabase
      .from("usuarios").select("email, id_persona, nombre, rol_id").in("email", batch)) as any;
    if (usuarios?.length) {
      const pIds = [...new Set(usuarios.map((u: any) => u.id_persona).filter(Boolean))] as number[];
      const pMap = new Map<number, string>();
      if (pIds.length) {
        const { data: personas } = (await supabase
          .from("personas").select("id, nombre_legal, nombre_comercial").in("id", pIds)) as any;
        (personas || []).forEach((p: any) => pMap.set(p.id, p.nombre_legal || p.nombre_comercial || ""));
      }
      usuarios.forEach((u: any) => {
        const personaName = u.id_persona ? pMap.get(u.id_persona) : "";
        const fallbackName = u.nombre || u.email?.split("@")[0] || "Usuario";
        nameMap.set(u.email, personaName || fallbackName);
        if (u.rol_id === 3 || u.rol_id === 9) {
          agentRoleEmails.add(u.email);
          agentRoleEmails.add((u.email || "").toLowerCase());
        }
      });
    }
  }

  const [propRes, leadRes, cuentaRes, productosRes] = await Promise.all([
    propIds.length > 0
      ? (supabase.from("propiedades").select("id, numero_propiedad, precio_lista, id_estatus_disponibilidad, id_edificio_modelo").in("id", propIds) as any)
      : { data: [] },
    leadIds.length > 0
      ? (supabase.from("personas").select("id, nombre_legal, nombre_comercial").in("id", leadIds) as any)
      : { data: [] },
    ofertaIds.length > 0
      ? (supabase.from("cuentas_cobranza").select("id, id_oferta, contrato_draft, precio_final").in("id_oferta", ofertaIds).eq("activo", true) as any)
      : { data: [] },
    productoIds.length > 0
      ? (supabase.from("productos_servicios").select("id, nombre, precio_lista, id_proyecto").in("id", productoIds) as any)
      : { data: [] },
  ]);

  const propMap = new Map<number, any>();
  (propRes.data || []).forEach((p: any) => propMap.set(p.id, p));
  const leadMap = new Map<number, string>();
  (leadRes.data || []).forEach((l: any) => leadMap.set(l.id, l.nombre_legal || l.nombre_comercial || "Sin nombre"));
  const productoMap = new Map<number, any>();
  (productosRes.data || []).forEach((p: any) => productoMap.set(p.id, p));
  const cuentaMap = new Map<number, any>();
  (cuentaRes.data || []).forEach((c: any) => { if (c.id_oferta) cuentaMap.set(c.id_oferta, c); });

  // Signed contracts
  const cuentaIds = (cuentaRes.data || []).map((c: any) => c.id);
  const firmadoSet = new Set<number>();
  if (cuentaIds.length > 0) {
    const { data: docs } = (await supabase
      .from("documentos").select("id_cuenta_cobranza")
      .in("id_cuenta_cobranza", cuentaIds)
      .eq("id_tipo_documento", 42)
      .eq("activo", true)) as any;
    (docs || []).forEach((d: any) => firmadoSet.add(d.id_cuenta_cobranza));
  }

  // Resolve projects from propiedades
  const emIds = [...new Set((propRes.data || []).map((p: any) => p.id_edificio_modelo).filter(Boolean))] as number[];
  const proyectoByProp = new Map<number, { id: number; nombre: string }>();
  if (emIds.length > 0) {
    const { data: ems } = (await supabase.from("edificios_modelos").select("id, id_edificio").in("id", emIds)) as any;
    const edIds = [...new Set((ems || []).map((e: any) => e.id_edificio).filter(Boolean))] as number[];
    if (edIds.length > 0) {
      const { data: eds } = (await supabase.from("edificios").select("id, id_proyecto").in("id", edIds)) as any;
      const projIds = [...new Set((eds || []).map((e: any) => e.id_proyecto).filter(Boolean))] as number[];
      if (projIds.length > 0) {
        const { data: projs } = await supabase.from("proyectos").select("id, nombre").in("id", projIds);
        const projMap = new Map<number, { id: number; nombre: string }>();
        (projs || []).forEach((p: any) => projMap.set(p.id, { id: p.id, nombre: p.nombre }));
        const edToPj = new Map<number, number>();
        (eds || []).forEach((e: any) => edToPj.set(e.id, e.id_proyecto));
        const emToPj = new Map<number, number>();
        (ems || []).forEach((em: any) => { const pj = edToPj.get(em.id_edificio); if (pj) emToPj.set(em.id, pj); });
        (propRes.data || []).forEach((p: any) => {
          const pjId = emToPj.get(p.id_edificio_modelo);
          if (pjId) {
            const proj = projMap.get(pjId);
            if (proj) proyectoByProp.set(p.id, proj);
          }
        });
      }
    }
  }

  // Resolve projects from productos
  const productoProjIds = [...new Set((productosRes.data || []).map((p: any) => p.id_proyecto).filter(Boolean))] as number[];
  const productoProyMap = new Map<number, { id: number; nombre: string }>();
  if (productoProjIds.length > 0) {
    const { data: projs } = await supabase.from("proyectos").select("id, nombre").in("id", productoProjIds);
    (projs || []).forEach((p: any) => productoProyMap.set(p.id, { id: p.id, nombre: p.nombre }));
  }

  return data.map((o: any) => {
    const prop = o.id_propiedad ? propMap.get(o.id_propiedad) : null;
    const producto = o.id_producto ? productoMap.get(o.id_producto) : null;
    const cuenta = cuentaMap.get(o.id);
    const isProducto = !!o.id_producto;
    const projInfo = isProducto
      ? (producto?.id_proyecto ? productoProyMap.get(producto.id_proyecto) : null)
      : (o.id_propiedad ? proyectoByProp.get(o.id_propiedad) : null);

    const card: PipelineCard = {
      ...o,
      lead_nombre: o.id_persona_lead ? leadMap.get(o.id_persona_lead) : undefined,
      propiedad_nombre: prop?.numero_propiedad || undefined,
      producto_nombre: producto?.nombre || undefined,
      proyecto_nombre: projInfo?.nombre || undefined,
      proyecto_id: projInfo?.id || undefined,
      agente_nombre: nameMap.get(o.email_creador) || nameMap.get((o.email_creador || "").toLowerCase()) || o.email_creador,
      is_internal: !agentRoleEmails.has(o.email_creador) && !agentRoleEmails.has((o.email_creador || "").toLowerCase()),
      precio: isProducto ? (producto?.precio_lista || null) : (prop?.precio_lista || null),
      estatus_disponibilidad: prop?.id_estatus_disponibilidad,
      cuenta_cobranza_id: cuenta?.id,
      contrato_draft: cuenta?.contrato_draft,
      tiene_contrato_firmado: cuenta ? firmadoSet.has(cuenta.id) : false,
      is_producto: isProducto,
      precio_final_cuenta: cuenta?.precio_final ?? null,
    };
    card.stage = classifyOffer(card);
    return card;
  });
}

const OFERTA_COLS =
  "id, email_creador, fecha_generacion, id_esquema_pago_seleccionado, id_estatus_aprobacion, id_propiedad, id_producto, id_persona_lead";

async function fetchOfertasPipeline(selectedMonths: string[]): Promise<PipelineCard[]> {
  const hasMonthFilter = selectedMonths.length > 0;
  if (hasMonthFilter) {
    const dateRanges = buildDateRangesFromMonths(selectedMonths);
    const allOfertas: any[] = [];
    for (const range of dateRanges) {
      const { data } = (await supabase
        .from("ofertas")
        .select(OFERTA_COLS)
        .eq("activo", true)
        .gte("fecha_generacion", range.start)
        .lte("fecha_generacion", range.end)
        .order("fecha_generacion", { ascending: false })
        .limit(3000)) as any;
      if (data) allOfertas.push(...data);
    }
    return enrichOfertas(dedup(allOfertas));
  }

  // Sin filtro de mes: recientes (último mes) + avanzadas (más viejas con cuenta).
  const recentDate = new Date();
  recentDate.setMonth(recentDate.getMonth() - 1);
  const RECENT = recentDate.toISOString().slice(0, 10);

  const [recentRes, advancedRes] = await Promise.all([
    supabase.from("ofertas")
      .select(OFERTA_COLS)
      .eq("activo", true).gte("fecha_generacion", RECENT)
      .order("fecha_generacion", { ascending: false })
      .limit(2000) as any,
    supabase.from("ofertas")
      .select(OFERTA_COLS)
      .eq("activo", true).lt("fecha_generacion", RECENT)
      .order("fecha_generacion", { ascending: false })
      .limit(3000) as any,
  ]);

  const recentData = recentRes.data || [];
  const olderData = advancedRes.data || [];
  let advancedFiltered: any[] = [];
  if (olderData.length > 0) {
    const olderIds = olderData.map((o: any) => o.id);
    const { data: cuentas } = (await supabase
      .from("cuentas_cobranza").select("id_oferta")
      .in("id_oferta", olderIds).eq("activo", true)) as any;
    const withCuenta = new Set((cuentas || []).map((c: any) => c.id_oferta));
    advancedFiltered = olderData.filter((o: any) => withCuenta.has(o.id));
  }
  return enrichOfertas(dedup([...recentData, ...advancedFiltered]));
}

/**
 * Ofertas del Pipeline enriquecidas y clasificadas por etapa (`stage`).
 * `selectedMonths` usa el formato de `MonthMultiSelector` ("YYYY-M", mes
 * 0-based). Vacío = recientes + avanzadas.
 */
export function useOfertasPipeline(selectedMonths: string[]) {
  return useQuery<PipelineCard[]>({
    queryKey: ["altadir-pipeline-ofertas", selectedMonths],
    queryFn: () => fetchOfertasPipeline(selectedMonths),
    staleTime: 2 * 60_000,
  });
}

export interface OfertasAprobadasResumen {
  total: number;
  porProyecto: Array<{ proyecto: string; valor: number }>;
  /** Mes en curso (formato MonthMultiSelector) para construir el CTA al Pipeline. */
  mesKey: string;
}

/**
 * KPI "Nuevas ofertas" del Dashboard General = ofertas en etapa "Aprobadas"
 * de tipo Propiedad en el mes en curso, desglosadas por proyecto. Comparte la
 * misma clasificación que el Pipeline, así que los conteos coinciden.
 */
export function useResumenOfertasAprobadas() {
  const mesKey = getCurrentMonthKey();
  const query = useOfertasPipeline([mesKey]);
  const sozuQuery = useProyectosSozuIds();
  const data = useMemo<OfertasAprobadasResumen>(() => {
    const sozuSet = sozuQuery.data ?? new Set<number>();
    const ofertas = query.data ?? [];
    // Sólo ofertas Aprobadas, tipo Propiedad, de proyectos SOZU activos.
    const aprobadas = ofertas.filter(
      (o) =>
        o.stage === "aprobadas" &&
        !o.is_producto &&
        o.proyecto_id != null &&
        sozuSet.has(o.proyecto_id),
    );
    const map = new Map<string, number>();
    aprobadas.forEach((o) => {
      const p = o.proyecto_nombre || "Sin proyecto";
      map.set(p, (map.get(p) ?? 0) + 1);
    });
    return {
      total: aprobadas.length,
      porProyecto: Array.from(map.entries())
        .map(([proyecto, valor]) => ({ proyecto, valor }))
        .sort((a, b) => b.valor - a.valor),
      mesKey,
    };
  }, [query.data, sozuQuery.data, mesKey]);
  return { data, isLoading: query.isLoading || sozuQuery.isLoading };
}
