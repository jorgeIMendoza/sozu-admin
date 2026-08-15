/**
 * Modelo de tres capas del Portal Agente (ver Ejecuciones_manuales/crm-portal-agente/).
 *
 *   capa 1  persona x proyecto  -> entidades_relacionadas tipo 7 + crm_leads_atribucion
 *   capa 2  persona x unidad    -> crm_negocios (id_oferta, id_propiedad)
 *   capa 3  persona x cuenta    -> compradores / cuentas_cobranza  (no se toca aquí)
 *
 * Mientras las migraciones 01-06 no estén aplicadas, `crm_negocios` no tiene columna de
 * unidad y no hay pipeline canónico. Todo lo de aquí funciona igual: se deriva la etapa
 * desde la oferta y el estatus de la propiedad, que es exactamente lo que harán los
 * triggers cuando se apliquen. Al aplicarlas, la lectura pasa a la RPC sin cambiar la UI.
 */

import { supabase } from "@/integrations/supabase/client";

/* ─────────────────────────── Etapas canónicas ─────────────────────────── */

export type EtapaClave =
  | "nuevo"
  | "contactado"
  | "cita_programada"
  | "cita_asistida"
  | "negociando"
  | "oferta_enviada"
  | "apartado_pagado"
  | "enganche_contrato"
  | "ganado"
  | "perdido";

export interface EtapaDef {
  clave: EtapaClave;
  label: string;
  orden: number;
  /** true = la mueve un hecho del sistema, el agente no puede asignarla a mano. */
  automatica: boolean;
  chip: string;
}

export const ETAPAS: EtapaDef[] = [
  { clave: "nuevo",             label: "Nuevo",               orden: 10, automatica: false, chip: "bg-gray-100 text-gray-700" },
  { clave: "contactado",        label: "Contactado",          orden: 20, automatica: false, chip: "bg-sky-100 text-sky-800" },
  { clave: "cita_programada",   label: "Cita programada",     orden: 30, automatica: false, chip: "bg-blue-100 text-blue-800" },
  { clave: "cita_asistida",     label: "Asistió a la cita",   orden: 40, automatica: false, chip: "bg-indigo-100 text-indigo-800" },
  { clave: "negociando",        label: "Negociando",          orden: 50, automatica: false, chip: "bg-violet-100 text-violet-800" },
  { clave: "oferta_enviada",    label: "Oferta enviada",      orden: 60, automatica: true,  chip: "bg-amber-100 text-amber-800" },
  { clave: "apartado_pagado",   label: "Apartado pagado",     orden: 70, automatica: true,  chip: "bg-orange-100 text-orange-800" },
  { clave: "enganche_contrato", label: "Enganche y contrato", orden: 80, automatica: true,  chip: "bg-teal-100 text-teal-800" },
  { clave: "ganado",            label: "Cierre ganado",       orden: 90, automatica: true,  chip: "bg-emerald-100 text-emerald-800" },
  { clave: "perdido",           label: "Cierre perdido",      orden: 99, automatica: false, chip: "bg-red-100 text-red-700" },
];

export const etapaDef = (clave: EtapaClave): EtapaDef =>
  ETAPAS.find((e) => e.clave === clave) ?? ETAPAS[0];

/**
 * Etapas canónicas **desde la base**: pipeline `ventas_sozu` (archivo 03 de
 * Ejecuciones_manuales/crm-portal-agente). La BD es la fuente de la verdad: nombre, orden,
 * color y quién mueve cada etapa (`hecho_disparador`) se administran ahí, no en el código.
 * `ETAPAS` queda solo como respaldo mientras la migración no esté aplicada.
 */
export async function fetchEtapasCanonicas(): Promise<EtapaDef[]> {
  const { data, error } = await (supabase as any)
    .from("crm_pipeline_etapas")
    .select("clave, nombre, orden, hecho_disparador, color, crm_pipelines!inner(clave)")
    .eq("crm_pipelines.clave", "ventas_sozu")
    .eq("activo", true)
    .order("orden");

  if (error || !data || data.length === 0) return ETAPAS;

  return (data as any[]).map((e) => ({
    clave: e.clave as EtapaClave,
    label: e.nombre,
    orden: e.orden,
    automatica: e.hecho_disparador != null,
    // El color vive en la BD; si esa columna aún no existe se usa el del respaldo.
    chip: e.color ?? (ETAPAS.find((f) => f.clave === e.clave)?.chip ?? "bg-muted text-muted-foreground"),
  }));
}

/** A partir de `apartado_pagado` la unidad deja de ser prospecto y cuenta como cliente. */
export const esCliente = (clave: EtapaClave): boolean => {
  const d = etapaDef(clave);
  return d.orden >= 70 && d.orden !== 99;
};

/** Vigencia de la oferta: 5 días desde su generación (misma regla que el pipeline actual). */
function ofertaVigente(fechaGeneracion?: string | null): boolean {
  if (!fechaGeneracion) return true;
  const expira = new Date(fechaGeneracion);
  expira.setDate(expira.getDate() + 5);
  return expira >= new Date();
}

/**
 * Deriva la etapa canónica de una oferta con los mismos hechos que usarán los triggers:
 * estatus de la propiedad, apartado aplicado y estatus de aprobación de la oferta.
 */
export function etapaDeOferta(o: {
  id_estatus_aprobacion?: number | null;
  fecha_generacion?: string | null;
  estatus_disponibilidad?: number | null;
  cuenta_cobranza_id?: number | null;
  apartado_pagado?: boolean | null;
  tiene_contrato_firmado?: boolean | null;
}): EtapaClave {
  const estatus = o.estatus_disponibilidad ?? null;

  if (estatus != null && [7, 8, 9, 10].includes(estatus)) return "ganado";
  if (estatus === 5 || o.tiene_contrato_firmado) return "enganche_contrato";
  if (o.apartado_pagado || estatus === 4) return "apartado_pagado";

  // Rechazada, o vencida sin haber llegado a cuenta de cobranza.
  if (o.id_estatus_aprobacion === 3) return "perdido";
  if (!o.cuenta_cobranza_id && !ofertaVigente(o.fecha_generacion)) return "perdido";

  return "oferta_enviada";
}

/* ────────────────────── Agrupación: un negocio por unidad ────────────────────── */

/**
 * El negocio es **por unidad**, no por oferta. En prod hay 768 pares persona-unidad con
 * más de una oferta activa (hasta 19 sobre la misma unidad) y en 619 de esos casos cambia
 * el `id_esquema_pago_seleccionado`: son recotizaciones del mismo negocio, no negocios
 * distintos. Se colapsan en una sola fila que conserva:
 *   - la etapa MÁS AVANZADA de todas sus ofertas (una recotización no retrocede el negocio),
 *   - la oferta representativa: la de esa etapa y, a igualdad, la más reciente,
 *   - el conteo de ofertas, para que el agente vea que hubo varias versiones.
 */
export function claveUnidad(o: { id_propiedad?: number | null; id_producto?: number | null }): string {
  // Una oferta de producto (bodega, estacionamiento, paquete de muebles) trae TAMBIÉN el
  // id_propiedad de la unidad a la que cuelga: se emite en par con la oferta de la propiedad,
  // mismo lead y segundos de diferencia. Es un negocio propio, no una recotización de la
  // propiedad, así que el producto manda en la clave — acotado por la propiedad, porque el
  // mismo producto se vende en decenas de unidades (Bodegas Daiku: 39). Con el orden inverso
  // la bodega se agrupaba con su propiedad y, por ser 1 segundo más nueva, la sustituía como
  // representativa: el renglón mostraba "Bodega" y $30,000 en vez de la unidad y $9,519,120.
  if (o.id_producto) return `s:${o.id_producto}:${o.id_propiedad ?? 0}`;
  if (o.id_propiedad) return `p:${o.id_propiedad}`;
  return "sin-unidad";
}

export function agruparOfertasPorUnidad<
  T extends { id: number; stage: EtapaClave; fecha_generacion?: string | null; id_propiedad?: number | null; id_producto?: number | null },
>(ofertas: T[]): (T & { ofertas_count: number; ofertas_ids: number[] })[] {
  const grupos = new Map<string, T[]>();
  for (const o of ofertas) {
    const k = claveUnidad(o);
    grupos.set(k, [...(grupos.get(k) ?? []), o]);
  }

  const peso = (o: T) => (o.stage === "perdido" ? -1 : etapaDef(o.stage).orden);
  const fecha = (o: T) => (o.fecha_generacion ? new Date(o.fecha_generacion).getTime() : 0);

  return [...grupos.values()].map((grupo) => {
    const ordenado = [...grupo].sort((a, b) => peso(b) - peso(a) || fecha(b) - fecha(a));
    const principal = ordenado[0];
    return { ...principal, ofertas_count: grupo.length, ofertas_ids: grupo.map((g) => g.id) };
  });
}

/* ─────────────────────────── Unidades por lead ─────────────────────────── */

export interface UnidadNegocio {
  id_negocio: number | null;
  id_oferta: number | null;
  id_proyecto: number | null;
  proyecto: string;
  unidad: string;
  /** Propiedad · Bodega · Estacionamiento · Paquete de muebles · Condensadora */
  tipo: string;
  valor: number | null;
  etapa: EtapaClave;
  es_cliente: boolean;
  /** Cuántas ofertas activas hay sobre esta misma unidad (recotizaciones). */
  ofertas_count: number;
}

/**
 * Unidades (capa 2) de un conjunto de personas-lead.
 *
 * Lee de `crm_negocios` cuando ya tiene la columna `id_oferta` (migración 02 aplicada);
 * si no, deriva las unidades desde `ofertas` con el mismo criterio.
 */
export async function fetchUnidadesPorPersona(
  personaIds: number[],
): Promise<{ porPersona: Map<number, UnidadNegocio[]>; viaNegocios: boolean }> {
  const porPersona = new Map<number, UnidadNegocio[]>();
  if (personaIds.length === 0) return { porPersona, viaNegocios: false };

  // ── ¿Ya existe el grano de unidad en crm_negocios? ──
  const probe = await (supabase as any).from("crm_negocios").select("id, id_oferta").limit(0);
  const tieneGranoUnidad = !probe.error;

  // ── Ofertas de esas personas (fuente de la derivación y de la liga a la unidad) ──
  const { data: ofertas } = await (supabase as any)
    .from("ofertas")
    .select("id, id_persona_lead, id_propiedad, id_producto, fecha_generacion, id_estatus_aprobacion")
    .in("id_persona_lead", personaIds)
    .eq("activo", true);

  const lista: any[] = ofertas ?? [];
  if (lista.length === 0) return { porPersona, viaNegocios: tieneGranoUnidad };

  const propIds = [...new Set(lista.map((o) => o.id_propiedad).filter(Boolean))] as number[];
  const prodIds = [...new Set(lista.map((o) => o.id_producto).filter(Boolean))] as number[];
  const ofertaIds = lista.map((o) => o.id);

  const [propRes, prodRes, cuentaRes] = await Promise.all([
    propIds.length
      ? (supabase as any).from("propiedades")
          .select("id, numero_propiedad, precio_lista, id_estatus_disponibilidad, id_edificio_modelo")
          .in("id", propIds)
      : Promise.resolve({ data: [] }),
    prodIds.length
      ? (supabase as any).from("productos_servicios").select("id, nombre, precio_lista, id_proyecto, id_categoria").in("id", prodIds)
      : Promise.resolve({ data: [] }),
    (supabase as any).from("cuentas_cobranza")
      .select("id, id_oferta, precio_final")
      .in("id_oferta", ofertaIds)
      .eq("activo", true),
  ]);

  const propMap = new Map<number, any>((propRes.data ?? []).map((p: any) => [p.id, p]));
  const prodMap = new Map<number, any>((prodRes.data ?? []).map((p: any) => [p.id, p]));
  const cuentaPorOferta = new Map<number, any>();
  (cuentaRes.data ?? []).forEach((c: any) => { if (c.id_oferta) cuentaPorOferta.set(c.id_oferta, c); });

  // Propiedad -> proyecto (waterfall explícito, nunca triple join de PostgREST)
  const propToProyecto = new Map<number, { id: number; nombre: string }>();
  const edModeloIds = [...new Set((propRes.data ?? []).map((p: any) => p.id_edificio_modelo).filter(Boolean))] as number[];
  if (edModeloIds.length) {
    const { data: edModelos } = await (supabase as any)
      .from("edificios_modelos").select("id, id_edificio").in("id", edModeloIds);
    const edificioIds = [...new Set((edModelos ?? []).map((m: any) => m.id_edificio).filter(Boolean))] as number[];
    const { data: edificios } = edificioIds.length
      ? await (supabase as any).from("edificios").select("id, id_proyecto").in("id", edificioIds)
      : { data: [] };
    const proyIds = [...new Set((edificios ?? []).map((e: any) => e.id_proyecto).filter(Boolean))] as number[];
    const { data: proyectos } = proyIds.length
      ? await (supabase as any).from("proyectos").select("id, nombre").in("id", proyIds)
      : { data: [] };

    const proyNombre = new Map<number, string>((proyectos ?? []).map((p: any) => [p.id, p.nombre]));
    const edificioProy = new Map<number, number>((edificios ?? []).map((e: any) => [e.id, e.id_proyecto]));
    const modeloEdificio = new Map<number, number>((edModelos ?? []).map((m: any) => [m.id, m.id_edificio]));

    for (const p of propRes.data ?? []) {
      const idEdificio = modeloEdificio.get(p.id_edificio_modelo);
      const idProyecto = idEdificio ? edificioProy.get(idEdificio) : undefined;
      if (idProyecto) propToProyecto.set(p.id, { id: idProyecto, nombre: proyNombre.get(idProyecto) ?? "" });
    }
  }

  // Tipo de producto (Bodega, Estacionamiento, …) desde el catálogo
  const categoriaNombre = new Map<number, string>();
  {
    const catIds = [...new Set((prodRes.data ?? []).map((p: any) => p.id_categoria).filter(Boolean))] as number[];
    if (catIds.length) {
      const { data } = await (supabase as any).from("categorias_producto").select("id, nombre").in("id", catIds);
      (data ?? []).forEach((c: any) => categoriaNombre.set(c.id, c.nombre));
    }
  }

  // Proyectos de ofertas de producto
  const prodProyIds = [...new Set((prodRes.data ?? []).map((p: any) => p.id_proyecto).filter(Boolean))] as number[];
  const prodProyNombre = new Map<number, string>();
  if (prodProyIds.length) {
    const { data } = await (supabase as any).from("proyectos").select("id, nombre").in("id", prodProyIds);
    (data ?? []).forEach((p: any) => prodProyNombre.set(p.id, p.nombre));
  }

  // ── Apartado efectivamente aplicado (el hecho que vuelve "cliente" a la unidad) ──
  const cuentaIds = [...cuentaPorOferta.values()].map((c: any) => c.id);
  const cuentasConApartado = new Set<number>();
  if (cuentaIds.length) {
    const { data: acuerdos } = await (supabase as any)
      .from("acuerdos_pago")
      .select("id, id_cuenta_cobranza")
      .in("id_cuenta_cobranza", cuentaIds)
      .eq("id_concepto", 1);
    const acuerdoIds = (acuerdos ?? []).map((a: any) => a.id);
    if (acuerdoIds.length) {
      const { data: aplicaciones } = await (supabase as any)
        .from("aplicaciones_pago")
        .select("id_acuerdo_pago, es_multa")
        .in("id_acuerdo_pago", acuerdoIds);
      const cuentaDeAcuerdo = new Map<number, number>((acuerdos ?? []).map((a: any) => [a.id, a.id_cuenta_cobranza]));
      (aplicaciones ?? []).forEach((ap: any) => {
        if (ap.es_multa) return;
        const idCuenta = cuentaDeAcuerdo.get(ap.id_acuerdo_pago);
        if (idCuenta) cuentasConApartado.add(idCuenta);
      });
    }
  }

  // ── Negocios ya existentes, para reusar su id cuando la migración esté aplicada ──
  const negocioPorOferta = new Map<number, number>();
  if (tieneGranoUnidad) {
    const { data: negocios, error } = await (supabase as any)
      .from("crm_negocios").select("id, id_oferta").in("id_oferta", ofertaIds).eq("activo", true);
    if (!error) (negocios ?? []).forEach((n: any) => { if (n.id_oferta) negocioPorOferta.set(n.id_oferta, n.id); });
  }

  for (const o of lista) {
    const prop = o.id_propiedad ? propMap.get(o.id_propiedad) : null;
    const prod = o.id_producto ? prodMap.get(o.id_producto) : null;
    const cuenta = cuentaPorOferta.get(o.id);
    const proyecto = prop
      ? propToProyecto.get(prop.id)
      : prod?.id_proyecto
        ? { id: prod.id_proyecto, nombre: prodProyNombre.get(prod.id_proyecto) ?? "" }
        : undefined;

    const etapa = etapaDeOferta({
      id_estatus_aprobacion: o.id_estatus_aprobacion,
      fecha_generacion: o.fecha_generacion,
      estatus_disponibilidad: prop?.id_estatus_disponibilidad ?? null,
      cuenta_cobranza_id: cuenta?.id ?? null,
      apartado_pagado: cuenta ? cuentasConApartado.has(cuenta.id) : false,
    });

    const unidad: UnidadNegocio & { _clave: string; _fecha: number } = {
      id_negocio: negocioPorOferta.get(o.id) ?? null,
      id_oferta: o.id,
      id_proyecto: proyecto?.id ?? null,
      proyecto: proyecto?.nombre ?? "",
      unidad: prop?.numero_propiedad || prod?.nombre || "—",
      tipo: prop ? "Propiedad" : (prod?.id_categoria ? (categoriaNombre.get(prod.id_categoria) ?? "Producto") : "Producto"),
      valor: cuenta?.precio_final ?? prop?.precio_lista ?? prod?.precio_lista ?? null,
      etapa,
      es_cliente: esCliente(etapa),
      ofertas_count: 1,
      _clave: `${o.id_persona_lead}|${claveUnidad(o)}`,
      _fecha: o.fecha_generacion ? new Date(o.fecha_generacion).getTime() : 0,
    };

    const actuales = (porPersona.get(o.id_persona_lead) ?? []) as any[];
    actuales.push(unidad);
    porPersona.set(o.id_persona_lead, actuales);
  }

  // Colapsar a un negocio por unidad: gana la etapa más avanzada y, a igualdad, la oferta
  // más reciente. `ofertas_count` deja ver cuántas recotizaciones hubo.
  for (const [persona, unidades] of porPersona) {
    const grupos = new Map<string, any[]>();
    for (const u of unidades as any[]) grupos.set(u._clave, [...(grupos.get(u._clave) ?? []), u]);

    const colapsadas: UnidadNegocio[] = [...grupos.values()].map((grupo) => {
      const peso = (u: any) => (u.etapa === "perdido" ? -1 : etapaDef(u.etapa).orden);
      const [principal] = [...grupo].sort((a, b) => peso(b) - peso(a) || b._fecha - a._fecha);
      const { _clave, _fecha, ...limpia } = principal;
      return { ...limpia, ofertas_count: grupo.length } as UnidadNegocio;
    });

    colapsadas.sort((a, b) => etapaDef(b.etapa).orden - etapaDef(a.etapa).orden);
    porPersona.set(persona, colapsadas);
  }

  return { porPersona, viaNegocios: tieneGranoUnidad };
}

/**
 * Mueve la etapa de un negocio. Solo aplica a etapas manuales: las automáticas las dispara
 * un hecho del sistema y la RPC las rechaza con 42501.
 */
export async function setNegocioEtapa(idNegocio: number, clave: EtapaClave): Promise<void> {
  const rpc = await (supabase as any).rpc("set_negocio_etapa", {
    p_id_negocio: idNegocio,
    p_clave_etapa: clave,
  });
  if (!rpc.error) return;

  const faltaFuncion = /function .* does not exist|schema cache/i.test(rpc.error.message ?? "");
  throw new Error(
    faltaFuncion
      ? "Mover etapas a mano requiere el pipeline canónico en la base (migraciones 03, 05 y 06). Las etapas automáticas ya se mueven solas."
      : rpc.error.message,
  );
}
