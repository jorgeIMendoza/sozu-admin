import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ENVIRONMENT } from "@/lib/config";

/**
 * Hook que entrega las cuentas de cobranza listas para generar la Factura
 * de Comisión SOZU al desarrollador.
 *
 * Filtro aplicado (definido por Ramón):
 *
 *   1. cuentas_cobranza.activo = true
 *   2. cuentas_cobranza.id_cuenta_cobranza_padre IS NULL (excluye mantenimiento)
 *   3. cuentas_cobranza.estatus_autorizacion_comision = 'En espera'
 *   4. cuentas_cobranza.es_pagada_comision_venta = false
 *   5. cuentas_cobranza.precio_final > 0
 *   6. cuentas_cobranza.porcentaje_comision_venta > 0
 *   7. propiedades.id_estatus_disponibilidad = 5 (Vendida)
 *   8. propiedades.id_entidad_relacionada_dueno IS NOT NULL (entidad dueña configurada)
 *   9. entidades_relacionadas.facturar_comision_sozu = true (flag activado ← clave)
 *  10. monto_comision (precio × pct, con IVA si aplica) > 0
 *  11. No existe ya una factura timbrada (url real presente y es_draft=false ⇒ excluida)
 *
 * Las cuentas permanecen visibles en dos estados:
 *
 *   - estado_factura = 'por_generar' → no hay url_factura_comision
 *   - estado_factura = 'draft' → url presente y es_draft_factura_comision=true
 *
 * El admin valida el draft y decide si timbrar (`useTimbrarFacturaComisionSozu`)
 * o regenerar (`useGenerarFacturaComisionSozu` de nuevo). Cuando la factura
 * se timbra, es_draft pasa a false y la fila desaparece del listado a menos
 * que estatus_autorizacion_comision siga en 'En espera' — eso ya es flujo
 * de la Bandeja de Validaciones del director.
 *
 * Emisor del CFDI: SOZU REAL ESTATE VENTURES S.A. de C.V. (configurado del
 * lado de la edge function `generar-factura-comision-sozu`).
 * Receptor: la entidad dueña de la propiedad (campo `entidad_duena`).
 */

export type EstadoFacturaSozu = "por_generar" | "draft";

export type FacturaComisionSozuPorGenerar = {
  id_cuenta_cobranza: number;
  folio_cuenta: string;
  tipo: "Propiedad" | "Producto" | "Servicio";
  proyecto_nombre: string | null;
  edificio_nombre: string | null;
  modelo_nombre: string | null;
  producto_nombre: string | null;
  numero_departamento: string | null;
  entidad_duena: string | null;
  /** CLABE de comisión (cuentas_cobranza.cuenta_stp_comisiones del dueño). */
  cuenta_stp_comisiones: string | null;
  precio_final: number;
  porcentaje_comision_venta: number;
  iva_incluido: boolean;
  /** Monto total a facturar (precio_final × pct/100, con IVA si aplica). */
  monto_comision: number;
  fecha_compra: string | null;
  /** Estado del CFDI: 'por_generar' (sin url) o 'draft' (url presente + es_draft=true). */
  estado_factura: EstadoFacturaSozu;
  /** URL del PDF de la factura draft (cuando estado='draft'). */
  url_factura_comision: string | null;
  /** URL del XML de la factura. */
  url_factura_xml_comision: string | null;
  /** Cliente (lead/comprador principal). */
  cliente_nombre: string | null;
  cliente_rfc: string | null;
  /** Datos fiscales reales del receptor (= persona dueña de la entidad). */
  receptor_razon_social: string | null;
  receptor_rfc: string | null;
  receptor_regimen_codigo: string | null;
  receptor_regimen_nombre: string | null;
  receptor_uso_cfdi_codigo: string | null;
  receptor_uso_cfdi_nombre: string | null;
};

const PAD_ID = (id: number) => String(id).padStart(6, "0");

const formatId = (id: number, tipo: FacturaComisionSozuPorGenerar["tipo"]) =>
  tipo === "Producto" || tipo === "Servicio"
    ? `CCP-${PAD_ID(id)}`
    : `CC-${PAD_ID(id)}`;

async function fetchFacturasComisionSozuPorGenerar(): Promise<FacturaComisionSozuPorGenerar[]> {
  // 1) Cuentas base con los 4 filtros del usuario aplicados en BD.
  //    PostgREST en prod tiene max-rows=1000 server-side, así que paginamos
  //    manualmente. Hoy en dev son ~62 candidatos antes del gate Vendida.
  const cuentasRows: Array<any> = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = (await (supabase as any)
      .from("cuentas_cobranza")
      .select(
        `id, precio_final, porcentaje_comision_venta, iva_incluido,
         id_oferta, id_propiedad, fecha_compra,
         url_factura_comision, url_factura_xml_comision, es_draft_factura_comision`,
      )
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .eq("estatus_autorizacion_comision", "En espera")
      .eq("es_pagada_comision_venta", false)
      .gt("precio_final", 0)
      .gt("porcentaje_comision_venta", 0)
      .order("id", { ascending: false })
      .range(offset, offset + PAGE - 1)) as any;
    if (error) throw error;
    const rows = (data || []) as Array<any>;
    cuentasRows.push(...rows);
    if (rows.length < PAGE) break;
    if (offset > 100_000) break; // safety
  }
  if (!cuentasRows.length) return [];

  const cuentasBase = cuentasRows;

  // 2) Cargar ofertas → propiedad / producto (necesario para resolver tipo y
  //    para fallback de id_propiedad cuando cc.id_propiedad es NULL).
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

  // 3) Propiedades (estatus_disponibilidad + edificio_modelo + dueño).
  //    Considera cc.id_propiedad directo + fallback a oferta.id_propiedad.
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

  // 6) edificios_modelos → modelo + id_edificio
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

  // 7) edificios → proyecto
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

  // 8) Productos → categoría (para tipo Propiedad/Producto/Servicio)
  const productoIds = Array.from(
    new Set(
      (ofs || []).map((o: any) => o.id_producto).filter((x: any): x is number => !!x),
    ),
  );
  const { data: prodsRaw } = productoIds.length
    ? ((await (supabase as any)
        .from("productos_servicios")
        .select(
          "id, nombre, id_categoria, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
        )
        .in("id", productoIds)) as any)
    : { data: [] };
  const prodMap = new Map<number, any>(
    (prodsRaw || []).map((p: any) => [p.id, p]),
  );

  // 9) Entidades relacionadas (dueño + STP comisión + datos fiscales del receptor).
  //    Se embed la persona completa con sus campos fiscales (rfc, regimen, uso_cfdi).
  const entIds = Array.from(
    new Set(
      (props || [])
        .map((p: any) => p.id_entidad_relacionada_dueno)
        .filter((x: any): x is number => !!x),
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

  // 9b) Catálogos fiscales (regimen + uso_cfdi) — para traducir códigos a nombres.
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

  // 10) Personas (cliente / lead)
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

  // 8) Componer + único filtro final del usuario: propiedad Vendida.
  const result: FacturaComisionSozuPorGenerar[] = [];
  for (const c of cuentasBase) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const propiedad = idPropEfectivo ? propMap.get(idPropEfectivo) : null;
    const em = propiedad?.id_edificio_modelo ? emMap.get(propiedad.id_edificio_modelo) : null;
    const edificio = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const proyectoNombre = edificio?.id_proyecto ? projMap.get(edificio.id_proyecto) : null;
    const producto = oferta?.id_producto ? prodMap.get(oferta.id_producto) : null;
    const entidad = propiedad?.id_entidad_relacionada_dueno
      ? entMap.get(propiedad.id_entidad_relacionada_dueno)
      : null;
    const persona = oferta?.id_persona_lead ? persMap.get(oferta.id_persona_lead) : null;

    // Gates en JS (campos que viven en tablas anidadas, no en cuentas_cobranza).
    // — Propiedad debe estar Vendida.
    if (propiedad?.id_estatus_disponibilidad !== 5) continue;
    // — Entidad dueña configurada + flag de facturación activo (regla clave).
    if (!entidad) continue;
    if (!entidad.facturar_comision_sozu) continue;

    let tipo: FacturaComisionSozuPorGenerar["tipo"] = "Propiedad";
    if (oferta?.id_producto && producto) {
      const cat = (producto.categorias_producto?.nombre || "").toLowerCase();
      tipo = cat === "servicios" ? "Servicio" : "Producto";
    }

    const precio = Number(c.precio_final ?? 0);
    const pct = Number(c.porcentaje_comision_venta ?? 0);
    const subtotal = (precio * pct) / 100;
    const total = c.iva_incluido ? subtotal * 1.16 : subtotal;
    // — Monto de comisión > 0 (defensa adicional al filtro de precio×pct en BD).
    if (total <= 0) continue;

    const entidadDuena =
      entidad?.personas?.nombre_comercial || entidad?.personas?.nombre_legal || null;

    const url: string | null = c.url_factura_comision ?? null;
    const urlPendiente = !!url && /pendiente-de-generar/i.test(url);
    const esDraft = !!c.es_draft_factura_comision && !!url && !urlPendiente;
    // — Si existe factura timbrada (url real y NO draft), excluir la cuenta.
    const yaTimbrada = !!url && !urlPendiente && !esDraft;
    if (yaTimbrada) continue;
    const estado: EstadoFacturaSozu = esDraft ? "draft" : "por_generar";

    // Datos fiscales del receptor — vienen del embed personas vía la entidad dueña.
    const receptorPersona = entidad?.personas ?? null;
    const regimenCod = (receptorPersona?.regimen as string | null) ?? null;
    const usoCfdiCod = (receptorPersona?.uso_cfdi as string | null) ?? null;

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
      cuenta_stp_comisiones: entidad?.cuenta_stp_comisiones ?? null,
      precio_final: precio,
      porcentaje_comision_venta: pct,
      iva_incluido: !!c.iva_incluido,
      monto_comision: total,
      fecha_compra: c.fecha_compra ?? null,
      estado_factura: estado,
      url_factura_comision: urlPendiente ? null : url,
      url_factura_xml_comision: c.url_factura_xml_comision ?? null,
      cliente_nombre: persona?.nombre_legal ?? null,
      cliente_rfc: persona?.rfc ?? null,
      // Receptor fiscal (usado en el drawer)
      receptor_razon_social: receptorPersona?.nombre_legal ?? null,
      receptor_rfc: (receptorPersona?.rfc as string | null) ?? null,
      receptor_regimen_codigo: regimenCod,
      receptor_regimen_nombre: regimenCod ? regimenMap.get(regimenCod) ?? null : null,
      receptor_uso_cfdi_codigo: usoCfdiCod,
      receptor_uso_cfdi_nombre: usoCfdiCod ? usoCfdiMap.get(usoCfdiCod) ?? null : null,
    });
  }

  return result;
}

export function useFacturasComisionSozuPorGenerar() {
  return useQuery({
    queryKey: ["facturas_comision_sozu_por_generar"],
    queryFn: fetchFacturasComisionSozuPorGenerar,
    staleTime: 60_000,
  });
}

/**
 * Mutación: invoca la edge function `generar-factura-comision-sozu`
 * (la misma que usa el Admin Panel, mismo body shape). Genera DRAFT —
 * no timbra. La fila permanece en el listado con estado_factura='draft'.
 */
export function useGenerarFacturaComisionSozu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id_cuenta_cobranza: number) => {
      const { data, error } = await (supabase as any).functions.invoke(
        "generar-factura-comision-sozu",
        { body: { id_cuenta_cobranza, environment: ENVIRONMENT } },
      );
      if (error) throw await extractEdgeFunctionError(error, "generar CFDI de comisión");
      return data as { not_applicable?: boolean; already_exists?: boolean; message?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facturas_comision_sozu_por_generar"] });
      // Mantener invalidación cruzada con el Admin Panel para que ambas vistas se sincronicen.
      queryClient.invalidateQueries({ queryKey: ["comisiones"] });
      queryClient.invalidateQueries({ queryKey: ["expediente_venta_detalle"] });
      // Refresca la lista de Facturas por Cobrar (Portal Administración / Alta
      // Dirección) que reusa este detalle para las facturas "sin_generar".
      queryClient.invalidateQueries({ queryKey: ["facturas_por_cobrar_alta_direccion"] });
    },
  });
}

/**
 * Mutación: invoca la edge function `timbrar-factura-comision-sozu`
 * (la misma que usa el Admin Panel). Aplica sobre un draft previo y
 * deja la factura timbrada (es_draft pasa a false). Tras timbrar la
 * fila desaparece del listado de "Por Generar".
 */
export function useTimbrarFacturaComisionSozu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id_cuenta_cobranza: number) => {
      const { data, error } = await (supabase as any).functions.invoke(
        "timbrar-factura-comision-sozu",
        { body: { id_cuenta_cobranza, environment: ENVIRONMENT } },
      );
      if (error) throw await extractEdgeFunctionError(error, "timbrar CFDI de comisión");
      return data as { message?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facturas_comision_sozu_por_generar"] });
      queryClient.invalidateQueries({ queryKey: ["comisiones"] });
      queryClient.invalidateQueries({ queryKey: ["expediente_venta_detalle"] });
      // Refresca la lista de Facturas por Cobrar (Portal Administración / Alta
      // Dirección) que reusa este detalle para las facturas "sin_generar".
      queryClient.invalidateQueries({ queryKey: ["facturas_por_cobrar_alta_direccion"] });
    },
  });
}

/**
 * Cuando una Edge Function responde con un status >= 400, supabase-js
 * lanza un `FunctionsHttpError` con un mensaje genérico
 * ("Edge Function returned a non-2xx status code") y la respuesta real
 * vive en `error.context` (objeto `Response`). Este helper extrae el
 * `message` del JSON de la respuesta y devuelve un `Error` con el
 * detalle real para que el toast del UI muestre algo accionable.
 */
async function extractEdgeFunctionError(error: any, fallbackAction: string): Promise<Error> {
  try {
    const ctx = error?.context;
    if (ctx) {
      let body: any = null;
      if (typeof ctx.json === "function") {
        try { body = await ctx.clone().json(); } catch { /* ignore */ }
      }
      if (!body && typeof ctx.text === "function") {
        try {
          const txt = await ctx.clone().text();
          if (txt) {
            try { body = JSON.parse(txt); } catch { body = { message: txt }; }
          }
        } catch { /* ignore */ }
      }
      const msg = body?.message || body?.error || body?.detail;
      if (msg && typeof msg === "string") {
        return new Error(msg);
      }
    }
  } catch {
    /* fallthrough */
  }
  return new Error(
    (error?.message as string | undefined) ?? `No fue posible ${fallbackAction}.`,
  );
}
