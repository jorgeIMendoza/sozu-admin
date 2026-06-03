import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClienteImpersonation } from "@/contexts/ClienteImpersonationContext";

export interface AcuerdoProducto {
  id: number;
  concepto: string;
  fecha: string;
  monto: number;
  completado: boolean;
  fechaPago?: string;
  trackingKey?: string;
  cepUrl?: string;
}

export interface ProductoCliente {
  cuentaId: number;
  nombre: string;
  descripcion?: string;
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
  status: "pendiente" | "financiado" | "pagado";
  clabe?: string;
  acuerdos: AcuerdoProducto[];
}

export interface PropiedadConProductos {
  propiedadId: number;
  numPropiedad: string;
  proyectoNombre: string;
  productos: ProductoCliente[];
}

async function fetchProductos(personaId: number): Promise<PropiedadConProductos[]> {
  // 1. Product offers
  const { data: offers } = await supabase
    .from("ofertas")
    .select("id, id_propiedad, id_producto")
    .eq("id_persona_lead", personaId)
    .eq("activo", true)
    .not("id_producto", "is", null);

  if (!offers?.length) return [];

  const offerIds = offers.map((o) => Number(o.id));
  const productoIds = [...new Set(offers.map((o) => Number(o.id_producto)).filter(Boolean))];
  const propiedadIds = [...new Set(offers.map((o) => Number(o.id_propiedad)).filter(Boolean))];

  // 2. Parallel: cuentas, productos_servicios, propiedades
  const [cuentasRes, productosRes, propiedadesRes] = await Promise.all([
    supabase
      .from("cuentas_cobranza")
      .select("id, id_oferta, precio_final, clabe_stp")
      .in("id_oferta", offerIds)
      .eq("activo", true)
      .eq("es_aprobado", true),
    supabase
      .from("productos_servicios")
      .select("id, nombre, descripcion")
      .in("id", productoIds),
    supabase
      .from("propiedades")
      .select("id, numero_propiedad, id_edificio_modelo")
      .in("id", propiedadIds),
  ]);

  const cuentas = cuentasRes.data ?? [];
  if (!cuentas.length) return [];

  const productosMap: Record<number, { nombre: string; descripcion: string | null }> =
    Object.fromEntries(
      (productosRes.data ?? []).map((p) => [
        Number(p.id),
        { nombre: String(p.nombre), descripcion: p.descripcion ? String(p.descripcion) : null },
      ]),
    );
  const propiedades = propiedadesRes.data ?? [];

  // 3. Project chain
  const emIds = [...new Set(propiedades.map((p) => Number(p.id_edificio_modelo)).filter(Boolean))];
  const { data: ems } = emIds.length
    ? await supabase.from("edificios_modelos").select("id, id_edificio").in("id", emIds)
    : { data: [] as { id: number; id_edificio: number }[] };

  const edificioIds = [...new Set((ems ?? []).map((e) => Number(e.id_edificio)).filter(Boolean))];
  const { data: edificios } = edificioIds.length
    ? await supabase.from("edificios").select("id, id_proyecto").in("id", edificioIds)
    : { data: [] as { id: number; id_proyecto: number }[] };

  const proyectoIds = [...new Set((edificios ?? []).map((e) => Number(e.id_proyecto)).filter(Boolean))];
  const { data: proyectos } = proyectoIds.length
    ? await supabase.from("proyectos").select("id, nombre").in("id", proyectoIds)
    : { data: [] as { id: number; nombre: string }[] };

  const emMap = Object.fromEntries((ems ?? []).map((e) => [Number(e.id), e]));
  const edificioMap = Object.fromEntries((edificios ?? []).map((e) => [Number(e.id), e]));
  const proyectoMap = Object.fromEntries((proyectos ?? []).map((p) => [Number(p.id), p]));

  // 4. Acuerdos de pago — use Number() to avoid bigint string comparison bugs
  const cuentaIds = cuentas.map((c) => Number(c.id));

  const [acuerdosRes, conceptosRes] = await Promise.all([
    supabase
      .from("acuerdos_pago")
      .select("id, id_cuenta_cobranza, id_concepto, fecha_pago, monto, pago_completado, orden")
      .in("id_cuenta_cobranza", cuentaIds)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase.from("conceptos_pago").select("id, nombre"),
  ]);

  const acuerdos = acuerdosRes.data ?? [];
  const conceptosMap: Record<number, string> = Object.fromEntries(
    (conceptosRes.data ?? []).map((c) => [Number(c.id), String(c.nombre)]),
  );

  // 5. Pagos for tracking — also use Number()
  const acuerdoIds = acuerdos.map((a) => Number(a.id));
  const [aplicacionesRes, pagosRes] = await Promise.all([
    acuerdoIds.length
      ? supabase
          .from("aplicaciones_pago")
          .select("id_acuerdo_pago, id_pago")
          .in("id_acuerdo_pago", acuerdoIds)
          .eq("activo", true)
      : Promise.resolve({ data: [] as { id_acuerdo_pago: number; id_pago: number }[] }),
    supabase
      .from("pagos")
      .select("id, id_cuenta_cobranza, monto, fecha_pago, clave_rastreo, url_cep")
      .in("id_cuenta_cobranza", cuentaIds)
      .eq("activo", true),
  ]);

  const pagosData = pagosRes.data ?? [];

  // Total pagado por cuenta — Number() on both sides
  const pagadoPorCuenta: Record<number, number> = {};
  for (const p of pagosData) {
    const cId = Number(p.id_cuenta_cobranza);
    pagadoPorCuenta[cId] = (pagadoPorCuenta[cId] ?? 0) + Number(p.monto);
  }

  // Pago info per acuerdo
  const pagoById: Record<number, typeof pagosData[number]> = Object.fromEntries(
    pagosData.map((p) => [Number(p.id), p]),
  );
  const pagoInfoPorAcuerdo: Record<number, { fechaPago?: string; trackingKey?: string; cepUrl?: string }> = {};
  for (const ap of aplicacionesRes.data ?? []) {
    const pago = pagoById[Number(ap.id_pago)];
    if (pago) {
      pagoInfoPorAcuerdo[Number(ap.id_acuerdo_pago)] = {
        fechaPago: pago.fecha_pago ? String(pago.fecha_pago).slice(0, 10) : undefined,
        trackingKey: pago.clave_rastreo ? String(pago.clave_rastreo) : undefined,
        cepUrl: pago.url_cep ? String(pago.url_cep) : undefined,
      };
    }
  }

  // 6. Maps for lookup
  const ofertaToProductoId: Record<number, number> = Object.fromEntries(
    offers.map((o) => [Number(o.id), Number(o.id_producto)]),
  );
  const ofertaToPropId: Record<number, number> = Object.fromEntries(
    offers.map((o) => [Number(o.id), Number(o.id_propiedad)]),
  );
  // cuenta id → oferta id
  const cuentaToOferta: Record<number, number> = Object.fromEntries(
    cuentas.map((c) => [Number(c.id), Number(c.id_oferta)]),
  );
  const propMap = Object.fromEntries(propiedades.map((p) => [Number(p.id), p]));

  // 7. Build products grouped by propiedad
  const byProp: Record<number, ProductoCliente[]> = {};

  for (const cc of cuentas) {
    const cuentaId = Number(cc.id);
    const ofertaId = cuentaToOferta[cuentaId];
    const productoId = ofertaToProductoId[ofertaId];
    const propiedadId = ofertaToPropId[ofertaId];
    if (!productoId || !propiedadId) continue;

    const ps = productosMap[productoId];
    const totalPagado = pagadoPorCuenta[cuentaId] ?? 0;
    const precioFinal = Number(cc.precio_final);
    const saldoPendiente = Math.max(0, precioFinal - totalPagado);

    let status: ProductoCliente["status"];
    if (totalPagado === 0) status = "pendiente";
    else if (saldoPendiente > 0) status = "financiado";
    else status = "pagado";

    // Build payment schedule — Number() on id_cuenta_cobranza comparison
    let parcCount = 0;
    const acuerdosProducto: AcuerdoProducto[] = acuerdos
      .filter((a) => Number(a.id_cuenta_cobranza) === cuentaId)
      .map((a) => {
        const idConcepto = Number(a.id_concepto);
        let concepto = conceptosMap[idConcepto] ?? "Pago";
        if (idConcepto === 5) { parcCount++; concepto = `Parcialidad ${parcCount}`; }
        const info = pagoInfoPorAcuerdo[Number(a.id)] ?? {};
        return {
          id: Number(a.id),
          concepto,
          fecha: String(a.fecha_pago).slice(0, 10),
          monto: Number(a.monto),
          completado: Boolean(a.pago_completado),
          ...info,
        };
      });

    const producto: ProductoCliente = {
      cuentaId,
      nombre: ps?.nombre ?? "Producto",
      descripcion: ps?.descripcion ?? undefined,
      precioFinal,
      totalPagado,
      saldoPendiente,
      status,
      clabe: cc.clabe_stp ? String(cc.clabe_stp) : undefined,
      acuerdos: acuerdosProducto,
    };

    if (!byProp[propiedadId]) byProp[propiedadId] = [];
    byProp[propiedadId].push(producto);
  }

  // 8. Final list
  return Object.entries(byProp).map(([propIdStr, productos]) => {
    const propId = Number(propIdStr);
    const prop = propMap[propId];
    const em = prop ? emMap[Number(prop.id_edificio_modelo)] : null;
    const edificio = em ? edificioMap[Number(em.id_edificio)] : null;
    const proyecto = edificio ? proyectoMap[Number(edificio.id_proyecto)] : null;
    return {
      propiedadId: propId,
      numPropiedad: String(prop?.numero_propiedad ?? "—"),
      proyectoNombre: String(proyecto?.nombre ?? "—"),
      productos,
    };
  });
}

export function useClienteProductos() {
  const { profile } = useAuth();
  const { isImpersonating, impersonatedClientePersonaId } = useClienteImpersonation();

  const personaId: number | null = isImpersonating
    ? impersonatedClientePersonaId
    : profile?.rol_nombre === "Cliente"
    ? (profile?.id_persona ?? null)
    : null;

  return useQuery({
    queryKey: ["cliente-productos", personaId],
    queryFn: () => fetchProductos(personaId!),
    enabled: personaId != null,
    staleTime: 5 * 60_000,
  });
}
