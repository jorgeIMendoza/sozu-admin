import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook que entrega las cuentas de cobranza con factura SOZU **timbrada**
 * (paso siguiente al draft) — listas para que Dirección autorice el cobro
 * al desarrollador. Mientras la fila viva aquí su estatus depende de
 * `cuentas_cobranza.estatus_autorizacion_comision`:
 *
 *   BD                  →  UI (columna Estatus)
 *   ───────────────────    ─────────────────────
 *   'En espera'         →  'Por Autorizar'      (default tras timbrar)
 *   'Autorizado'        →  'Autorizado'         (director dio OK al cobro)
 *   'Rechazado'         →  'Declinado'          (director rechazó, ver notas)
 *
 * Filtros base:
 *   1.  cuentas_cobranza.activo = true
 *   2.  cuentas_cobranza.id_cuenta_cobranza_padre IS NULL (excluye mantenimiento)
 *   3.  cuentas_cobranza.precio_final > 0
 *   4.  cuentas_cobranza.porcentaje_comision_venta > 0
 *   5.  cuentas_cobranza.url_factura_comision IS NOT NULL
 *   6.  cuentas_cobranza.es_draft_factura_comision = false  (ya timbrada, no draft)
 *   7.  cuentas_cobranza.es_pagada_comision_venta = false   (aún no cobrada al desarrollador)
 *   8.  propiedades.id_estatus_disponibilidad = 5           (Vendida)
 *   9.  Entidad dueña configurada según el TIPO de cuenta:
 *         - Producto/Servicio → productos_servicios.id_entidad_relacionada_dueno
 *         - Propiedad         → propiedades.id_entidad_relacionada_dueno
 *   10. entidades_relacionadas.facturar_comision_sozu = true del dueño del paso 9
 *       (flag activado ← clave). Mismo criterio que la vista Comisiones.
 *   11. monto_comision (precio × pct, con IVA si aplica) > 0
 */

export type EstatusCobroAutorizacion = "Por Autorizar" | "Autorizado" | "Declinado";

export type CobroPorGestionar = {
  id_cuenta_cobranza: number;
  folio_cuenta: string;
  tipo: "Propiedad" | "Producto" | "Servicio";
  proyecto_nombre: string | null;
  edificio_nombre: string | null;
  modelo_nombre: string | null;
  producto_nombre: string | null;
  numero_departamento: string | null;
  entidad_duena: string | null;
  /** Nombre del comprador principal (lead de la oferta). */
  comprador_nombre: string | null;
  precio_final: number;
  iva_incluido: boolean;
  porcentaje_comision_venta: number;
  /** Monto comisión SOZU = precio_final × pct/100 × (1.16 si IVA). */
  monto_factura: number;
  fecha_compra: string | null;
  /** Estatus traducido para UI (no el valor crudo de BD). */
  estatus: EstatusCobroAutorizacion;
  /** Valor crudo en BD (En espera / Autorizado / Rechazado). */
  estatus_autorizacion_raw: string;
  /** Solo poblado cuando estatus='Rechazado' — sirve para drawer. */
  notas_rechazo: string | null;
  fecha_autorizacion: string | null;
  email_autoriza: string | null;
  /** URL del PDF de la factura SOZU timbrada. */
  url_factura_pdf: string | null;
  /** URL del XML de la factura. */
  url_factura_xml: string | null;
  /** RFC del comprador (lead). */
  cliente_rfc: string | null;
  /** CLABE STP de la entidad dueña para cobro de comisión. */
  cuenta_stp_comisiones: string | null;
  /** Datos fiscales del receptor (entidad dueña) — usados en el drawer expediente. */
  receptor_razon_social: string | null;
  receptor_rfc: string | null;
  receptor_regimen_codigo: string | null;
  receptor_regimen_nombre: string | null;
  receptor_uso_cfdi_codigo: string | null;
  receptor_uso_cfdi_nombre: string | null;
};

const PAD_ID = (id: number) => String(id).padStart(6, "0");

const formatId = (id: number, tipo: CobroPorGestionar["tipo"]) =>
  tipo === "Producto" || tipo === "Servicio"
    ? `CCP-${PAD_ID(id)}`
    : `CC-${PAD_ID(id)}`;

const mapEstatus = (raw: string | null | undefined): EstatusCobroAutorizacion => {
  if (raw === "Autorizado") return "Autorizado";
  if (raw === "Rechazado") return "Declinado";
  return "Por Autorizar";
};

async function fetchCobrosPorGestionar(): Promise<CobroPorGestionar[]> {
  // 1) Cuentas con factura timbrada (no draft) y filtros base.
  const cuentasRows: Array<any> = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = (await (supabase as any)
      .from("cuentas_cobranza")
      .select(
        `id, precio_final, porcentaje_comision_venta, iva_incluido,
         id_oferta, id_propiedad, fecha_compra,
         estatus_autorizacion_comision, notas_rechazo_comision,
         fecha_autorizacion_comision, email_autoriza_comision,
         url_factura_comision, url_factura_xml_comision`,
      )
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .gt("precio_final", 0)
      .gt("porcentaje_comision_venta", 0)
      .eq("es_draft_factura_comision", false)
      .eq("es_pagada_comision_venta", false)
      .not("url_factura_comision", "is", null)
      .order("id", { ascending: false })
      .range(offset, offset + PAGE - 1)) as any;
    if (error) throw error;
    const rows = (data || []) as Array<any>;
    cuentasRows.push(...rows);
    if (rows.length < PAGE) break;
    if (offset > 100_000) break;
  }
  if (!cuentasRows.length) return [];

  const cuentasBase = cuentasRows;

  // 2) Ofertas → propiedad / producto / lead (comprador).
  const ofertaIds = Array.from(
    new Set(cuentasBase.map((c) => c.id_oferta).filter((x): x is number => !!x)),
  );
  const { data: ofs } = ofertaIds.length
    ? ((await (supabase as any)
        .from("ofertas")
        .select("id, id_propiedad, id_producto, id_persona_lead")
        .in("id", ofertaIds)) as any)
    : { data: [] };
  const ofMap = new Map<number, any>((ofs || []).map((o: any) => [o.id, o]));

  // 3) Propiedades.
  const propIdsCc = cuentasBase.map((c) => c.id_propiedad).filter((x: any): x is number => !!x);
  const propIdsOferta = (ofs || []).map((o: any) => o.id_propiedad).filter((x: any): x is number => !!x);
  const propIds = Array.from(new Set([...propIdsCc, ...propIdsOferta]));
  const { data: props } = propIds.length
    ? ((await (supabase as any)
        .from("propiedades")
        .select(
          "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad",
        )
        .in("id", propIds)) as any)
    : { data: [] };
  const propMap = new Map<number, any>((props || []).map((p: any) => [p.id, p]));

  // 4) edificios_modelos → modelo + id_edificio
  const emIds = Array.from(
    new Set(
      (props || [])
        .map((p: any) => p.id_edificio_modelo)
        .filter((x: any): x is number => !!x),
    ),
  );
  const { data: ems } = emIds.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select(
          "id, id_edificio, modelos!edificios_modelos_id_modelo_fkey(nombre)",
        )
        .in("id", emIds)) as any)
    : { data: [] };
  const emMap = new Map<number, any>((ems || []).map((em: any) => [em.id, em]));

  // 5) edificios → proyecto
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

  // 6) Productos → categoría (tipo Propiedad/Producto/Servicio).
  const productoIds = Array.from(
    new Set(
      (ofs || []).map((o: any) => o.id_producto).filter((x: any): x is number => !!x),
    ),
  );
  const { data: prodsRaw } = productoIds.length
    ? ((await (supabase as any)
        .from("productos_servicios")
        .select(
          "id, nombre, id_categoria, id_entidad_relacionada_dueno, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
        )
        .in("id", productoIds)) as any)
    : { data: [] };
  const prodMap = new Map<number, any>((prodsRaw || []).map((p: any) => [p.id, p]));

  // 7) Entidad dueña + datos fiscales del receptor (persona dueña) + STP comisión.
  //    Incluye dueños de PROPIEDAD y de PRODUCTO: en cuentas de Producto/Servicio
  //    la comisión se factura al dueño del producto (mismo criterio que Comisiones).
  const entIds = Array.from(
    new Set(
      [
        ...(props || []).map((p: any) => p.id_entidad_relacionada_dueno),
        ...(prodsRaw || []).map((pr: any) => pr.id_entidad_relacionada_dueno),
      ].filter((x: any): x is number => !!x),
    ),
  );
  const { data: ents } = entIds.length
    ? ((await (supabase as any)
        .from("entidades_relacionadas")
        .select(
          "id, cuenta_stp_comisiones, facturar_comision_sozu, personas!fk_entrel_persona(nombre_legal, nombre_comercial, rfc, regimen, uso_cfdi)",
        )
        .in("id", entIds)) as any)
    : { data: [] };
  const entMap = new Map<number, any>((ents || []).map((e: any) => [e.id, e]));

  // 7b) Catálogos fiscales (regimen + uso_cfdi) — traducir códigos a nombres.
  const regimenCodigos = Array.from(
    new Set(
      (ents || [])
        .map((e: any) => e.personas?.regimen)
        .filter((x: any): x is string => !!x),
    ),
  );
  const { data: regimenes } = regimenCodigos.length
    ? ((await (supabase as any)
        .from("regimen")
        .select("id, nombre")
        .in("id", regimenCodigos)) as any)
    : { data: [] };
  const regimenMap = new Map<string, string>(
    (regimenes || []).map((r: any) => [String(r.id), r.nombre as string]),
  );

  const usoCfdiCodigos = Array.from(
    new Set(
      (ents || [])
        .map((e: any) => e.personas?.uso_cfdi)
        .filter((x: any): x is string => !!x),
    ),
  );
  const { data: usosCfdi } = usoCfdiCodigos.length
    ? ((await (supabase as any)
        .from("uso_cfdi")
        .select("codigo, nombre")
        .in("codigo", usoCfdiCodigos)) as any)
    : { data: [] };
  const usoCfdiMap = new Map<string, string>(
    (usosCfdi || []).map((u: any) => [u.codigo as string, u.nombre as string]),
  );

  // 8) Personas — comprador (lead de la oferta), incluye RFC.
  const personaIds = Array.from(
    new Set(
      (ofs || [])
        .map((o: any) => o.id_persona_lead)
        .filter((x: any): x is number => !!x),
    ),
  );
  const { data: pers } = personaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal, rfc")
        .in("id", personaIds)) as any)
    : { data: [] };
  const persMap = new Map<number, any>((pers || []).map((p: any) => [p.id, p]));

  // 9) Composición final + gates (Vendida, entidad dueña configurada con flag, monto > 0).
  const result: CobroPorGestionar[] = [];
  for (const c of cuentasBase) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const propiedad = idPropEfectivo ? propMap.get(idPropEfectivo) : null;
    // Propiedad debe estar Vendida.
    if (propiedad?.id_estatus_disponibilidad !== 5) continue;

    const em = propiedad?.id_edificio_modelo ? emMap.get(propiedad.id_edificio_modelo) : null;
    const edificio = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const proyectoNombre = edificio?.id_proyecto ? projMap.get(edificio.id_proyecto) : null;
    const producto = oferta?.id_producto ? prodMap.get(oferta.id_producto) : null;
    const persona = oferta?.id_persona_lead ? persMap.get(oferta.id_persona_lead) : null;

    let tipo: CobroPorGestionar["tipo"] = "Propiedad";
    if (oferta?.id_producto && producto) {
      const cat = (producto.categorias_producto?.nombre || "").toLowerCase();
      tipo = cat === "servicios" ? "Servicio" : "Producto";
    }

    // Entidad dueña (flag facturar_comision_sozu / STP / receptor fiscal) según el tipo:
    //  - Producto/Servicio → dueño del producto (productos_servicios.id_entidad_relacionada_dueno)
    //  - Propiedad         → dueño de la propiedad
    // Mismo criterio que Comisiones.tsx y useFacturasComisionSozuPorGenerar. Antes se
    // leía siempre el dueño de la propiedad, ocultando de Cobros por gestionar las
    // cuentas de producto ya timbradas cuyo dueño real sí requiere facturación.
    const duenoEntidadId =
      tipo === "Producto" || tipo === "Servicio"
        ? (producto?.id_entidad_relacionada_dueno ?? propiedad?.id_entidad_relacionada_dueno ?? null)
        : (propiedad?.id_entidad_relacionada_dueno ?? null);
    // Entidad dueña configurada + flag de facturación activo (regla clave).
    if (!duenoEntidadId) continue;
    const entidad = entMap.get(duenoEntidadId);
    if (!entidad) continue;
    if (!entidad.facturar_comision_sozu) continue;

    const precio = Number(c.precio_final ?? 0);
    const pct = Number(c.porcentaje_comision_venta ?? 0);
    const subtotal = (precio * pct) / 100;
    const montoFactura = c.iva_incluido ? subtotal * 1.16 : subtotal;
    // Monto de comisión > 0 (defensa adicional al filtro de precio×pct en BD).
    if (montoFactura <= 0) continue;

    const entidadDuena =
      entidad?.personas?.nombre_comercial || entidad?.personas?.nombre_legal || null;

    const estatusRaw = (c.estatus_autorizacion_comision as string) || "En espera";

    result.push({
      id_cuenta_cobranza: c.id,
      folio_cuenta: formatId(c.id, tipo),
      tipo,
      proyecto_nombre: proyectoNombre ?? null,
      edificio_nombre: edificio?.nombre ?? null,
      modelo_nombre: em?.modelos?.nombre ?? null,
      producto_nombre: producto?.nombre ?? null,
      numero_departamento: propiedad?.numero_propiedad ?? null,
      entidad_duena: entidadDuena,
      comprador_nombre: persona?.nombre_legal ?? null,
      precio_final: precio,
      iva_incluido: !!c.iva_incluido,
      porcentaje_comision_venta: pct,
      monto_factura: montoFactura,
      fecha_compra: c.fecha_compra ?? null,
      estatus: mapEstatus(estatusRaw),
      estatus_autorizacion_raw: estatusRaw,
      notas_rechazo: c.notas_rechazo_comision ?? null,
      fecha_autorizacion: c.fecha_autorizacion_comision ?? null,
      email_autoriza: c.email_autoriza_comision ?? null,
      url_factura_pdf: c.url_factura_comision ?? null,
      url_factura_xml: c.url_factura_xml_comision ?? null,
      cliente_rfc: (persona?.rfc as string | null) ?? null,
      cuenta_stp_comisiones: (entidad?.cuenta_stp_comisiones as string | null) ?? null,
      receptor_razon_social: (entidad?.personas?.nombre_legal as string | null) ?? null,
      receptor_rfc: (entidad?.personas?.rfc as string | null) ?? null,
      receptor_regimen_codigo: (entidad?.personas?.regimen as string | null) ?? null,
      receptor_regimen_nombre: entidad?.personas?.regimen
        ? regimenMap.get(entidad.personas.regimen) ?? null
        : null,
      receptor_uso_cfdi_codigo: (entidad?.personas?.uso_cfdi as string | null) ?? null,
      receptor_uso_cfdi_nombre: entidad?.personas?.uso_cfdi
        ? usoCfdiMap.get(entidad.personas.uso_cfdi) ?? null
        : null,
    });
  }

  return result;
}

export function useCobrosPorGestionar() {
  return useQuery({
    queryKey: ["cobros_por_gestionar"],
    queryFn: fetchCobrosPorGestionar,
    staleTime: 60_000,
  });
}
