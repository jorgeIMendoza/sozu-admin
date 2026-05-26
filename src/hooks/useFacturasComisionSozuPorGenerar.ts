import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ENVIRONMENT } from "@/lib/config";

/**
 * Hook que entrega las cuentas de cobranza listas para generar la Factura
 * de Comisión SOZU al desarrollador.
 *
 * ESPEJO de la lógica del Admin Panel en src/pages/admin/Comisiones.tsx
 * (queryKey ["comisiones"]). Cualquier cambio al criterio "Por generar" en
 * esa página debe replicarse aquí.
 *
 * Filtro aplicado (mismo criterio bajo el cual el Admin Panel pinta el
 * botón Generar/Regenerar habilitado):
 *
 *   1. id_cuenta_cobranza_padre IS NULL (excluye mantenimiento)
 *   2. La cuenta tiene acuerdos_pago de enganche (id_concepto=2 activo)
 *      Y todos esos acuerdos tienen pago_completado=true (enganche pagado)
 *   3. propiedades.id_estatus_disponibilidad = 5 (Vendida)
 *   4. entidades_relacionadas.facturar_comision_sozu = true (el dueño
 *      requiere factura SOZU; cuando es false el Admin Panel pinta "—")
 *   5. (url_factura_comision IS NULL) OR (url contiene "pendiente-de-generar")
 *
 * Los drafts (es_draft_factura_comision=true) NO entran en esta lista —
 * el Admin Panel los muestra con acción "Timbrar" en un flow distinto.
 * Se manejarán en una sección futura del Portal de Administración.
 */

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
  /** Para "Regenerar" (url ya contiene pendiente-de-generar). */
  es_regenerar: boolean;
  /** Cliente (lead/comprador principal). */
  cliente_nombre: string | null;
  cliente_rfc: string | null;
};

const PAD_ID = (id: number) => String(id).padStart(6, "0");

const formatId = (id: number, tipo: FacturaComisionSozuPorGenerar["tipo"]) =>
  tipo === "Producto" || tipo === "Servicio"
    ? `CCP-${PAD_ID(id)}`
    : `CC-${PAD_ID(id)}`;

async function fetchFacturasComisionSozuPorGenerar(): Promise<FacturaComisionSozuPorGenerar[]> {
  // 1) Cuentas base (sin padre). PostgREST en prod tiene max-rows=1000 server-side,
  //    así que paginamos manualmente hasta cubrir todo (~1.5k cuentas hoy, crece lento).
  const cuentasRows: Array<any> = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = (await (supabase as any)
      .from("cuentas_cobranza")
      .select(
        `id, precio_final, porcentaje_comision_venta, iva_incluido,
         id_oferta, fecha_compra,
         url_factura_comision, es_draft_factura_comision`,
      )
      .is("id_cuenta_cobranza_padre", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1)) as any;
    if (error) throw error;
    const rows = (data || []) as Array<any>;
    cuentasRows.push(...rows);
    if (rows.length < PAGE) break;
    if (offset > 100_000) break; // safety
  }
  if (!cuentasRows.length) return [];

  // 2) Pre-filtrar por url_factura_comision (Por generar = null o pendiente)
  const candidatos = cuentasRows.filter((c) => {
    const url: string | null = c.url_factura_comision ?? null;
    const esPendiente = !!url && /pendiente-de-generar/i.test(url);
    return !url || esPendiente;
  });
  if (!candidatos.length) return [];

  const candidatoIds = candidatos.map((c) => c.id as number);

  // 3) Gate de enganche completado (igual que Admin Panel)
  const { data: acuerdosPend } = (await (supabase as any)
    .from("acuerdos_pago")
    .select("id_cuenta_cobranza")
    .in("id_cuenta_cobranza", candidatoIds)
    .eq("id_concepto", 2)
    .eq("activo", true)
    .eq("pago_completado", false)) as any;
  const ccConEnganchePendiente = new Set<number>(
    (acuerdosPend || []).map((a: any) => a.id_cuenta_cobranza),
  );

  const { data: acuerdosCon } = (await (supabase as any)
    .from("acuerdos_pago")
    .select("id_cuenta_cobranza")
    .in("id_cuenta_cobranza", candidatoIds)
    .eq("id_concepto", 2)
    .eq("activo", true)) as any;
  const ccConEnganche = new Set<number>(
    (acuerdosCon || []).map((a: any) => a.id_cuenta_cobranza),
  );

  const conEnganchePagado = candidatos.filter(
    (c) => ccConEnganche.has(c.id) && !ccConEnganchePendiente.has(c.id),
  );
  if (!conEnganchePagado.length) return [];

  // 4) Cargar ofertas → propiedad / producto
  const ofertaIds = Array.from(
    new Set(conEnganchePagado.map((c) => c.id_oferta).filter((x): x is number => !!x)),
  );
  const { data: ofs } = ofertaIds.length
    ? ((await (supabase as any)
        .from("ofertas")
        .select("id, id_propiedad, id_producto, id_persona_lead")
        .in("id", ofertaIds)) as any)
    : { data: [] };
  const ofMap = new Map<number, any>((ofs || []).map((o: any) => [o.id, o]));

  // 5) Propiedades (estatus_disponibilidad + edificio_modelo + dueño)
  const propIds = Array.from(
    new Set(
      (ofs || []).map((o: any) => o.id_propiedad).filter((x: any): x is number => !!x),
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

  // 9) Entidades relacionadas (dueño + STP comisión + facturar?)
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
          "id, cuenta_stp_comisiones, facturar_comision_sozu, personas!fk_entrel_persona(nombre_legal, nombre_comercial)",
        )
        .in("id", entIds)) as any)
    : { data: [] };
  const entMap = new Map<number, any>((ents || []).map((e: any) => [e.id, e]));

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

  // 11) Componer + filtros finales (vendida + dueño facturar=true)
  const result: FacturaComisionSozuPorGenerar[] = [];
  for (const c of conEnganchePagado) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const propiedad = oferta?.id_propiedad ? propMap.get(oferta.id_propiedad) : null;
    const em = propiedad?.id_edificio_modelo ? emMap.get(propiedad.id_edificio_modelo) : null;
    const edificio = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const proyectoNombre = edificio?.id_proyecto ? projMap.get(edificio.id_proyecto) : null;
    const producto = oferta?.id_producto ? prodMap.get(oferta.id_producto) : null;
    const entidad = propiedad?.id_entidad_relacionada_dueno
      ? entMap.get(propiedad.id_entidad_relacionada_dueno)
      : null;
    const persona = oferta?.id_persona_lead ? persMap.get(oferta.id_persona_lead) : null;

    // Gate Vendida
    if (propiedad?.id_estatus_disponibilidad !== 5) continue;
    // Gate dueño requiere factura SOZU
    if (entidad?.facturar_comision_sozu !== true) continue;

    let tipo: FacturaComisionSozuPorGenerar["tipo"] = "Propiedad";
    if (oferta?.id_producto && producto) {
      const cat = (producto.categorias_producto?.nombre || "").toLowerCase();
      tipo = cat === "servicios" ? "Servicio" : "Producto";
    }

    const precio = Number(c.precio_final ?? 0);
    const pct = Number(c.porcentaje_comision_venta ?? 0);
    const subtotal = (precio * pct) / 100;
    const total = c.iva_incluido ? subtotal * 1.16 : subtotal;

    const entidadDuena =
      entidad?.personas?.nombre_comercial || entidad?.personas?.nombre_legal || null;

    const url: string | null = c.url_factura_comision ?? null;
    const esRegenerar = !!url && /pendiente-de-generar/i.test(url);

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
      es_regenerar: esRegenerar,
      cliente_nombre: persona?.nombre_legal ?? null,
      cliente_rfc: persona?.rfc ?? null,
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
 * (la misma que usa el Admin Panel, mismo body shape).
 *
 * Al éxito, invalida la query del listado para que el item desaparezca.
 */
export function useGenerarFacturaComisionSozu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id_cuenta_cobranza: number) => {
      const { data, error } = await (supabase as any).functions.invoke(
        "generar-factura-comision-sozu",
        { body: { id_cuenta_cobranza, environment: ENVIRONMENT } },
      );
      if (error) throw error;
      return data as { not_applicable?: boolean; already_exists?: boolean; message?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facturas_comision_sozu_por_generar"] });
      // Mantener invalidación cruzada con el Admin Panel para que ambas vistas se sincronicen.
      queryClient.invalidateQueries({ queryKey: ["comisiones"] });
    },
  });
}
