import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchInBatches } from "@/utils/supabasePagination";

/**
 * Hook que entrega las cuentas de cobranza con al menos una comisión interna
 * pendiente de dispersar al equipo SOZU.
 *
 * Filtros aplicados (alineados con el flujo "Bandeja de Ejecución"):
 *
 *   1. cuentas_cobranza.activo = true
 *   2. cuentas_cobranza.id_cuenta_cobranza_padre IS NULL  (excluye mantenimiento)
 *   3. cuentas_cobranza.precio_final > 0
 *   4. propiedades.id_estatus_disponibilidad = 5          (Vendida)
 *   5. Existe al menos un `comisionistas` con activo = true Y pagada = false
 *      (independiente de `aprobada`: las que aún no están aprobadas se
 *      muestran con estatus "Pendiente aprobación AD").
 *
 * Grano: una fila por cuenta_cobranza. Para cada cuenta se separa:
 *   - `monto_a_dispersar`: suma de comisionistas aprobados-no-pagados
 *      (lo que el Portal de Administración puede ejecutar ya).
 *   - `monto_pendiente_aprobacion`: suma de comisionistas aún sin
 *      autorizar por Alta Dirección.
 *
 *   monto_comisionista = precio_final * (porcentaje_comision / 100)
 *                      * (iva_incluido ? 1.16 : 1)
 */

export type EstadoAprobacionDispersion =
  | "aprobado"
  | "rechazado"
  | "parcial"
  | "pendiente";

export type DispersionInternaPendiente = {
  id_cuenta_cobranza: number;
  folio_cuenta: string;
  tipo: "Propiedad" | "Producto" | "Servicio";
  proyecto_nombre: string | null;
  edificio_nombre: string | null;
  modelo_nombre: string | null;
  producto_nombre: string | null;
  numero_departamento: string | null;
  /** Razón social o nombre comercial de la entidad dueña de la propiedad
   *  (desarrollador). null si no hay propiedad o no tiene dueño asignado. */
  entidad_duena: string | null;
  precio_final: number;
  iva_incluido: boolean;
  /** Suma de comisionistas aprobados-no-pagados (con IVA si aplica). */
  monto_a_dispersar: number;
  /** Suma de comisionistas aún sin autorizar por Alta Dirección. */
  monto_pendiente_aprobacion: number;
  comisionistas_aprobados: number;
  comisionistas_pendientes_aprobacion: number;
  /** "aprobado" = todos autorizados · "pendiente" = ninguno · "parcial" = mezcla. */
  estado_aprobacion: EstadoAprobacionDispersion;
  /** @deprecated reservado para compat; equivale a `comisionistas_aprobados`. */
  comisionistas_pendientes: number;
  fecha_compra: string | null;
};

const PAD_ID = (id: number) => String(id).padStart(6, "0");

const formatId = (id: number, tipo: DispersionInternaPendiente["tipo"]) =>
  tipo === "Producto" || tipo === "Servicio"
    ? `CCP-${PAD_ID(id)}`
    : `CC-${PAD_ID(id)}`;

async function fetchDispersionesInternasPendientes(): Promise<DispersionInternaPendiente[]> {
  // 1) Comisionistas no pagados. Disparan la presencia de la cuenta en la
  //    bandeja. Separamos aprobados-por-AD de pendientes-aprobación.
  const comRows: Array<any> = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = (await (supabase as any)
      .from("comisionistas")
      .select("id_cuenta_cobranza, porcentaje_comision, aprobada")
      .eq("activo", true)
      .eq("pagada", false)
      .range(offset, offset + PAGE - 1)) as any;
    if (error) throw error;
    const rows = (data || []) as Array<any>;
    comRows.push(...rows);
    if (rows.length < PAGE) break;
    if (offset > 100_000) break;
  }
  if (!comRows.length) return [];

  // Agrupa por cuenta: porcentaje y conteo separando aprobados / pendientes.
  type Agg = {
    sumPctAprobados: number;
    countAprobados: number;
    sumPctPendientes: number;
    countPendientes: number;
  };
  const comAggMap = new Map<number, Agg>();
  for (const c of comRows) {
    const idCc = c.id_cuenta_cobranza as number;
    const pct = Number(c.porcentaje_comision ?? 0);
    const prev =
      comAggMap.get(idCc) ?? {
        sumPctAprobados: 0,
        countAprobados: 0,
        sumPctPendientes: 0,
        countPendientes: 0,
      };
    if (c.aprobada === true) {
      prev.sumPctAprobados += pct;
      prev.countAprobados += 1;
    } else {
      prev.sumPctPendientes += pct;
      prev.countPendientes += 1;
    }
    comAggMap.set(idCc, prev);
  }
  const ccIds = Array.from(comAggMap.keys());

  // 2) Cuentas de cobranza candidatas — sólo las que tienen comisionistas
  //    pendientes y cumplen los filtros base + las reglas de negocio para
  //    que Administración pueda ejecutar el pago:
  //      - Factura SOZU al desarrollador timbrada
  //        (url_factura_comision NOT NULL Y es_draft_factura_comision = false)
  //      - Pago del desarrollador a SOZU recibido
  //        (es_pagada_comision_venta = true)
  //      - Autorización explícita de Alta Dirección
  //        (estatus_autorizacion_comision_interna = 'Autorizado')
  //    Estas tres reglas son las mismas que filtran la sección "Comisiones
  //    internas" de la Bandeja de Validaciones del Portal Alta Dirección
  //    para que la cuenta sea elegible a autorización — aquí se exige
  //    además el flag Autorizado para que sólo lo ya autorizado se
  //    pueda pagar.
  //
  //    Estatus Vendido se gatea más abajo (cruce con `propiedades`); las
  //    Producto/Servicio puras (sin propiedad) pasan automáticamente.
  //
  //    Fallback escalonado por 42703: si la columna AD no existe aún,
  //    recaemos al SELECT legacy y la decisión de "Aprobado" se deriva
  //    del count-based (comportamiento previo) — modo degradado para no
  //    bloquear ambientes pre-DDL.
  const cuentasRows: Array<any> = [];
  // Trocear el IN(...) en lotes de 500 para no exceder la longitud de URL.
  const BATCH = 500;
  const SELECT_WITH_ESTATUS =
    "id, precio_final, iva_incluido, id_oferta, id_propiedad, fecha_compra, url_factura_comision, es_draft_factura_comision, es_pagada_comision_venta, estatus_autorizacion_comision_interna";
  const SELECT_LEGACY =
    "id, precio_final, iva_incluido, id_oferta, id_propiedad, fecha_compra, url_factura_comision, es_draft_factura_comision, es_pagada_comision_venta";
  let columnaEstatusDisponible = true;
  for (let i = 0; i < ccIds.length; i += BATCH) {
    const slice = ccIds.slice(i, i + BATCH);
    let resp = await (supabase as any)
      .from("cuentas_cobranza")
      .select(columnaEstatusDisponible ? SELECT_WITH_ESTATUS : SELECT_LEGACY)
      .in("id", slice)
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .gt("precio_final", 0)
      // Pago del desarrollador a SOZU recibido + Factura SOZU timbrada (no
      // draft) son condiciones duras; se filtran en BD para no traer
      // cuentas que de cualquier forma vamos a descartar.
      .eq("es_pagada_comision_venta", true)
      .not("url_factura_comision", "is", null)
      .eq("es_draft_factura_comision", false);
    if (resp.error && resp.error.code === "42703" && columnaEstatusDisponible) {
      // Columna AD aún no creada en BD — caemos al SELECT legacy para
      // todos los batches subsecuentes.
      columnaEstatusDisponible = false;
      resp = await (supabase as any)
        .from("cuentas_cobranza")
        .select(SELECT_LEGACY)
        .in("id", slice)
        .eq("activo", true)
        .is("id_cuenta_cobranza_padre", null)
        .gt("precio_final", 0)
        .eq("es_pagada_comision_venta", true)
        .not("url_factura_comision", "is", null)
        .eq("es_draft_factura_comision", false);
    }
    if (resp.error) throw resp.error;
    cuentasRows.push(...((resp.data || []) as Array<any>));
  }
  if (!cuentasRows.length) return [];

  // Las 3 reglas de negocio (Vendido + Factura SOZU timbrada + Pago
  // recibido) ya quedaron aplicadas arriba. Aquí NO se filtra por
  // `estatus_autorizacion_comision_interna` — el Admin debe poder VER
  // todas las cuentas elegibles, incluyendo las que Alta Dirección aún
  // no autoriza, para saber qué viene en el pipeline. La columna
  // `estado_aprobacion` (Aprobado / Rechazado / Pendiente AD) marca cuáles
  // están listas para ejecutar y cuáles no — y la UI cambia la CTA entre
  // "Ejecutar dispersión" y "Ver detalle" según corresponda.
  const cuentasBase = cuentasRows;

  // 3) Ofertas → propiedad / producto.
  const ofertaIds = Array.from(
    new Set(cuentasBase.map((c) => c.id_oferta).filter((x): x is number => !!x)),
  );
  const ofs = await fetchInBatches<any>(ofertaIds, (batch) =>
    (supabase as any)
      .from("ofertas")
      .select("id, id_propiedad, id_producto")
      .in("id", batch as number[]),
  );
  const ofMap = new Map<number, any>((ofs || []).map((o: any) => [o.id, o]));

  // 4) Propiedades (estatus_disponibilidad + edificio_modelo + entidad dueña).
  const propIdsCc = cuentasBase.map((c) => c.id_propiedad).filter((x: any): x is number => !!x);
  const propIdsOferta = (ofs || []).map((o: any) => o.id_propiedad).filter((x: any): x is number => !!x);
  const propIds = Array.from(new Set([...propIdsCc, ...propIdsOferta]));
  const props = await fetchInBatches<any>(propIds, (batch) =>
    (supabase as any)
      .from("propiedades")
      .select(
        "id, numero_propiedad, id_edificio_modelo, id_estatus_disponibilidad, id_entidad_relacionada_dueno",
      )
      .in("id", batch as number[]),
  );
  const propMap = new Map<number, any>((props || []).map((p: any) => [p.id, p]));

  // 4b) Entidad dueña (desarrollador) — entidades_relacionadas → personas
  const entidadDuenoIds = Array.from(
    new Set(
      (props || [])
        .map((p: any) => p.id_entidad_relacionada_dueno)
        .filter((v: any): v is number => v != null),
    ),
  );
  const { data: entidadesDuenas } = entidadDuenoIds.length
    ? ((await (supabase as any)
        .from("entidades_relacionadas")
        .select("id, personas!fk_entrel_persona(nombre_legal, nombre_comercial)")
        .in("id", entidadDuenoIds)) as any)
    : { data: [] };
  const entidadDuenoMap = new Map<number, string>(
    ((entidadesDuenas || []) as Array<any>).map((e) => [
      e.id,
      (e.personas?.nombre_comercial || e.personas?.nombre_legal || "") as string,
    ]),
  );

  // 5) edificios_modelos → modelo + id_edificio
  const emIds = Array.from(
    new Set(
      (props || [])
        .map((p: any) => p.id_edificio_modelo)
        .filter((x: any): x is number => !!x),
    ),
  );
  const ems = await fetchInBatches<any>(emIds, (batch) =>
    (supabase as any)
      .from("edificios_modelos")
      .select("id, id_edificio, modelos!edificios_modelos_id_modelo_fkey(nombre)")
      .in("id", batch as number[]),
  );
  const emMap = new Map<number, any>((ems || []).map((em: any) => [em.id, em]));

  // 6) edificios → proyecto
  const edIds = Array.from(
    new Set(
      (ems || []).map((e: any) => e.id_edificio).filter((x: any): x is number => !!x),
    ),
  );
  const { data: eds } = edIds.length
    ? ((await (supabase as any)
        .from("edificios")
        .select("id, nombre, id_proyecto")
        .in("id", edIds)) as any)
    : { data: [] };
  const edMap = new Map<number, any>((eds || []).map((e: any) => [e.id, e]));

  const projIds = Array.from(
    new Set(
      (eds || []).map((e: any) => e.id_proyecto).filter((x: any): x is number => !!x),
    ),
  );
  const { data: projs } = projIds.length
    ? ((await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .in("id", projIds)) as any)
    : { data: [] };
  const projMap = new Map<number, string>(
    (projs || []).map((p: any) => [p.id, p.nombre as string]),
  );

  // 7) Productos → categoría (para tipo Propiedad/Producto/Servicio).
  const productoIds = Array.from(
    new Set(
      (ofs || []).map((o: any) => o.id_producto).filter((x: any): x is number => !!x),
    ),
  );
  const prodsRaw = await fetchInBatches<any>(productoIds, (batch) =>
    (supabase as any)
      .from("productos_servicios")
      .select(
        "id, nombre, id_categoria, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
      )
      .in("id", batch as number[]),
  );
  const prodMap = new Map<number, any>((prodsRaw || []).map((p: any) => [p.id, p]));

  // 8) Composición final + gate de propiedad Vendida.
  //    Cuando NO hay propiedad efectiva (Producto/Servicio puros) la
  //    cuenta se considera siempre vendida — alineado con la lógica de
  //    Alta Dirección y con la sección "Comisión SOZU" de la Bandeja.
  const result: DispersionInternaPendiente[] = [];
  for (const c of cuentasBase) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const propiedad = idPropEfectivo ? propMap.get(idPropEfectivo) : null;
    const propVendida =
      idPropEfectivo == null || propiedad?.id_estatus_disponibilidad === 5;
    if (!propVendida) continue;

    const em = propiedad?.id_edificio_modelo ? emMap.get(propiedad.id_edificio_modelo) : null;
    const edificio = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const proyectoNombre = edificio?.id_proyecto ? projMap.get(edificio.id_proyecto) : null;
    const producto = oferta?.id_producto ? prodMap.get(oferta.id_producto) : null;

    let tipo: DispersionInternaPendiente["tipo"] = "Propiedad";
    if (oferta?.id_producto && producto) {
      const cat = (producto.categorias_producto?.nombre || "").toLowerCase();
      tipo = cat === "servicios" ? "Servicio" : "Producto";
    }

    const agg = comAggMap.get(c.id) ?? {
      sumPctAprobados: 0,
      countAprobados: 0,
      sumPctPendientes: 0,
      countPendientes: 0,
    };
    const precio = Number(c.precio_final ?? 0);
    const ivaMult = c.iva_incluido ? 1.16 : 1;
    const montoAprobados = ((precio * agg.sumPctAprobados) / 100) * ivaMult;
    const montoPendientes = ((precio * agg.sumPctPendientes) / 100) * ivaMult;
    const totalBruto = montoAprobados + montoPendientes;
    if (totalBruto <= 0) continue;

    // Source-of-truth: la columna `estatus_autorizacion_comision_interna` en
    // `cuentas_cobranza`, escrita por Alta Dirección al guardar decisiones.
    // Si la columna no está disponible (DDL aún no aplicado), recaemos al
    // count-based legacy para no quedarse sin estado. El count-based puede
    // dar falsos "aprobado" porque `comisionistas.aprobada=true` es también
    // el estado inicial de elegibilidad — por eso la columna AD es la
    // fuente correcta una vez aplicada.
    const estatusAD = (c.estatus_autorizacion_comision_interna ?? null) as
      | "Autorizado"
      | "Rechazado"
      | "En espera"
      | null;
    let estado: EstadoAprobacionDispersion;
    if (estatusAD === "Autorizado") estado = "aprobado";
    else if (estatusAD === "Rechazado") estado = "rechazado";
    else if (estatusAD === "En espera") estado = "pendiente";
    else {
      // Fallback pre-DDL.
      if (agg.countAprobados > 0 && agg.countPendientes === 0) estado = "aprobado";
      else if (agg.countAprobados === 0 && agg.countPendientes > 0) estado = "pendiente";
      else estado = "parcial";
    }

    const entidadDuenaNombre = propiedad?.id_entidad_relacionada_dueno != null
      ? entidadDuenoMap.get(propiedad.id_entidad_relacionada_dueno) ?? null
      : null;

    result.push({
      id_cuenta_cobranza: c.id,
      folio_cuenta: formatId(c.id, tipo),
      tipo,
      proyecto_nombre: proyectoNombre ?? null,
      edificio_nombre: edificio?.nombre ?? null,
      modelo_nombre: em?.modelos?.nombre ?? null,
      producto_nombre: producto?.nombre ?? null,
      numero_departamento: propiedad?.numero_propiedad ?? null,
      entidad_duena: entidadDuenaNombre,
      precio_final: precio,
      iva_incluido: !!c.iva_incluido,
      monto_a_dispersar: montoAprobados,
      monto_pendiente_aprobacion: montoPendientes,
      comisionistas_aprobados: agg.countAprobados,
      comisionistas_pendientes_aprobacion: agg.countPendientes,
      estado_aprobacion: estado,
      comisionistas_pendientes: agg.countAprobados,
      fecha_compra: c.fecha_compra ?? null,
    });
  }

  return result;
}

export function useDispersionesInternasPendientes() {
  return useQuery({
    queryKey: ["dispersiones_internas_pendientes"],
    queryFn: fetchDispersionesInternasPendientes,
    staleTime: 60_000,
  });
}
