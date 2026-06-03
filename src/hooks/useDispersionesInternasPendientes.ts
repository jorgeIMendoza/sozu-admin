import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export type EstadoAprobacionDispersion = "aprobado" | "parcial" | "pendiente";

export type DispersionInternaPendiente = {
  id_cuenta_cobranza: number;
  folio_cuenta: string;
  tipo: "Propiedad" | "Producto" | "Servicio";
  proyecto_nombre: string | null;
  edificio_nombre: string | null;
  modelo_nombre: string | null;
  producto_nombre: string | null;
  numero_departamento: string | null;
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
  //    pendientes y cumplen los filtros base.
  const cuentasRows: Array<any> = [];
  // Trocear el IN(...) en lotes de 500 para no exceder la longitud de URL.
  const BATCH = 500;
  for (let i = 0; i < ccIds.length; i += BATCH) {
    const slice = ccIds.slice(i, i + BATCH);
    const { data, error } = (await (supabase as any)
      .from("cuentas_cobranza")
      .select(
        `id, precio_final, iva_incluido, id_oferta, id_propiedad, fecha_compra`,
      )
      .in("id", slice)
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .gt("precio_final", 0)) as any;
    if (error) throw error;
    cuentasRows.push(...((data || []) as Array<any>));
  }
  if (!cuentasRows.length) return [];

  const cuentasBase = cuentasRows;

  // 3) Ofertas → propiedad / producto.
  const ofertaIds = Array.from(
    new Set(cuentasBase.map((c) => c.id_oferta).filter((x): x is number => !!x)),
  );
  const { data: ofs } = ofertaIds.length
    ? ((await (supabase as any)
        .from("ofertas")
        .select("id, id_propiedad, id_producto")
        .in("id", ofertaIds)) as any)
    : { data: [] };
  const ofMap = new Map<number, any>((ofs || []).map((o: any) => [o.id, o]));

  // 4) Propiedades (estatus_disponibilidad + edificio_modelo).
  const propIdsCc = cuentasBase.map((c) => c.id_propiedad).filter((x: any): x is number => !!x);
  const propIdsOferta = (ofs || []).map((o: any) => o.id_propiedad).filter((x: any): x is number => !!x);
  const propIds = Array.from(new Set([...propIdsCc, ...propIdsOferta]));
  const { data: props } = propIds.length
    ? ((await (supabase as any)
        .from("propiedades")
        .select("id, numero_propiedad, id_edificio_modelo, id_estatus_disponibilidad")
        .in("id", propIds)) as any)
    : { data: [] };
  const propMap = new Map<number, any>((props || []).map((p: any) => [p.id, p]));

  // 5) edificios_modelos → modelo + id_edificio
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
  const { data: prodsRaw } = productoIds.length
    ? ((await (supabase as any)
        .from("productos_servicios")
        .select(
          "id, nombre, id_categoria, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
        )
        .in("id", productoIds)) as any)
    : { data: [] };
  const prodMap = new Map<number, any>((prodsRaw || []).map((p: any) => [p.id, p]));

  // 8) Composición final + gate de propiedad Vendida.
  const result: DispersionInternaPendiente[] = [];
  for (const c of cuentasBase) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const propiedad = idPropEfectivo ? propMap.get(idPropEfectivo) : null;
    if (propiedad?.id_estatus_disponibilidad !== 5) continue;

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

    let estado: EstadoAprobacionDispersion;
    if (agg.countAprobados > 0 && agg.countPendientes === 0) estado = "aprobado";
    else if (agg.countAprobados === 0 && agg.countPendientes > 0) estado = "pendiente";
    else estado = "parcial";

    result.push({
      id_cuenta_cobranza: c.id,
      folio_cuenta: formatId(c.id, tipo),
      tipo,
      proyecto_nombre: proyectoNombre ?? null,
      edificio_nombre: edificio?.nombre ?? null,
      modelo_nombre: em?.modelos?.nombre ?? null,
      producto_nombre: producto?.nombre ?? null,
      numero_departamento: propiedad?.numero_propiedad ?? null,
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
