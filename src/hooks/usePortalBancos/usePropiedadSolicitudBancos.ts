import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detalle de la PROPIEDAD asociada a una solicitud del Portal Bancos.
 *
 * Dado el id de la cuenta de cobranza de la solicitud, resuelve la propiedad
 * (cuentas_cobranza.id_propiedad, con fallback a ofertas.id_propiedad vía
 * cuentas_cobranza.id_oferta — patrón estándar del proyecto) y devuelve:
 *   - datos básicos (proyecto, modelo, edificio, tipo, número, metraje);
 *   - estacionamientos y bodegas ligados, con sus financieros.
 *
 * Es una versión enfocada a UNA propiedad de la lógica por lotes de
 * `SocioBancarioExpedientesPage`. Los visuales de nivel/ubicación/distribución
 * NO se cargan aquí: los cubre `FichaTecnicaSection` vía `useClientePropiedadDetalle`.
 *
 * Degrada a `null` si no resuelve propiedad o si la BD no está disponible
 * (RLS / tablas), sin romper el detalle de la solicitud.
 */

const BODEGA_RE = /bodega/i;
const ESTAC_RE = /estacionamiento/i;

const ccLabel = (id: number) => `CC-${String(id).padStart(6, "0")}`;

export interface EstacionamientoSolicitud {
  id: number;
  nombre: string;
  tipo: string;
  m2: number;
  precioM2: number | null;
  precioFinal: number;
  ubicacion: string | null;
  esIncluido: boolean;
  fechaCompra: string | null;
  cuentaLabel: string | null;
}

export interface BodegaSolicitud {
  id: number;
  nombre: string;
  m2: number;
  precioM2: number | null;
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
  ubicacion: string | null;
  fechaCompra: string | null;
  cuentaLabel: string | null;
  tieneCuenta: boolean;
}

export interface PropiedadSolicitudDetalle {
  propiedadId: number;
  numeroPropiedad: string;
  proyecto: string;
  edificio: string;
  modelo: string;
  tipo: string;
  m2Interiores: number;
  m2Exteriores: number;
  m2Total: number;
  fichaTecnicaUrl: string | null;
  estacionamientos: EstacionamientoSolicitud[];
  bodegas: BodegaSolicitud[];
}

async function fetchPropiedadSolicitud(
  idCuentaCobranza: number,
): Promise<PropiedadSolicitudDetalle | null> {
  const sb = supabase as any;

  // 1) Cuenta de la solicitud → propiedad (directo o vía oferta).
  const { data: cuenta } = await sb
    .from("cuentas_cobranza")
    .select("id, id_propiedad, id_oferta")
    .eq("id", idCuentaCobranza)
    .maybeSingle();
  if (!cuenta) return null;

  let propiedadId: number | null = cuenta.id_propiedad ?? null;
  if (!propiedadId && cuenta.id_oferta) {
    const { data: oferta } = await sb
      .from("ofertas")
      .select("id, id_propiedad")
      .eq("id", cuenta.id_oferta)
      .maybeSingle();
    propiedadId = oferta?.id_propiedad ?? null;
  }
  if (!propiedadId) return null;

  // 2) Propiedad (metraje, tipo, ficha técnica, edificio-modelo).
  const { data: prop } = await sb
    .from("propiedades")
    .select(
      "id, numero_propiedad, id_tipo_propiedad, m2_interiores, m2_exteriores, id_edificio_modelo",
    )
    .eq("id", propiedadId)
    .maybeSingle();
  if (!prop) return null;

  // 3) Waterfall proyecto/edificio/modelo (explícito, sin triple join).
  let idEdificio: number | null = null;
  let idModelo: number | null = null;
  if (prop.id_edificio_modelo) {
    const { data: link } = await sb
      .from("edificios_modelos")
      .select("id, id_edificio, id_modelo")
      .eq("id", prop.id_edificio_modelo)
      .maybeSingle();
    idEdificio = link?.id_edificio ?? null;
    idModelo = link?.id_modelo ?? null;
  }

  const [tipoRes, modeloRes, edificioRes] = await Promise.all([
    prop.id_tipo_propiedad
      ? sb.from("tipos_propiedad").select("nombre").eq("id", prop.id_tipo_propiedad).maybeSingle()
      : Promise.resolve({ data: null }),
    idModelo
      ? sb.from("modelos").select("nombre").eq("id", idModelo).maybeSingle()
      : Promise.resolve({ data: null }),
    idEdificio
      ? sb.from("edificios").select("id, nombre, id_proyecto").eq("id", idEdificio).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let proyecto = "";
  let fichaTecnicaUrl: string | null = null;
  const idProyecto = edificioRes.data?.id_proyecto ?? null;
  if (idProyecto) {
    const [proyRes, fichaRes] = await Promise.all([
      sb.from("proyectos").select("nombre").eq("id", idProyecto).maybeSingle(),
      // Ficha técnica del proyecto = documento tipo 49 (mismo criterio que el
      // portal de agentes). El brochure es tipo 30; aquí solo la ficha.
      sb.from("documentos")
        .select("url")
        .eq("id_proyecto", idProyecto)
        .eq("id_tipo_documento", 49)
        .eq("activo", true)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    proyecto = proyRes.data?.nombre ?? "";
    fichaTecnicaUrl = fichaRes.data?.url ?? null;
  }

  // 4) Filas físicas de bodegas y estacionamientos de la propiedad.
  const [bodegaRowsRes, estacRowsRes] = await Promise.all([
    sb.from("bodegas")
      .select("id, id_producto, nombre, m2, ubicacion")
      .eq("id_propiedad", propiedadId).eq("activo", true).order("id"),
    sb.from("estacionamientos")
      .select("id, id_producto, nombre, id_tipo, m2, ubicacion, es_incluido")
      .eq("id_propiedad", propiedadId).eq("activo", true).order("id"),
  ]);
  const bodegaRows: any[] = bodegaRowsRes.data ?? [];
  const estacRows: any[] = estacRowsRes.data ?? [];

  // Catálogo de tipos de estacionamiento (Normal, Tandem, Doble…).
  const estacTipoIds = [...new Set(estacRows.map((e) => e.id_tipo).filter(Boolean))] as number[];
  const tipoEstacById = new Map<number, string>();
  if (estacTipoIds.length) {
    const { data: te } = await sb
      .from("tipos_estacionamiento").select("id, nombre").in("id", estacTipoIds);
    for (const t of te ?? []) tipoEstacById.set(t.id, t.nombre);
  }

  // 5) Cuentas de PRODUCTO de la propiedad (bodega/estacionamiento) para
  //    financieros. Se resuelven vía las ofertas de la propiedad.
  const { data: ofertasProp } = await sb
    .from("ofertas").select("id, id_producto").eq("id_propiedad", propiedadId);
  const ofertaById = new Map<number, any>((ofertasProp ?? []).map((o: any) => [o.id, o]));
  const productIds = [...new Set((ofertasProp ?? []).map((o: any) => o.id_producto).filter(Boolean))] as number[];
  const productById = new Map<number, string>();
  if (productIds.length) {
    const { data: prods } = await sb
      .from("productos_servicios").select("id, nombre").in("id", productIds);
    for (const p of prods ?? []) productById.set(p.id, p.nombre);
  }

  const ofertaIds = [...ofertaById.keys()];
  let bodegaCuentas: any[] = [];
  let estacCuentas: any[] = [];
  if (ofertaIds.length) {
    const { data: cuentasProducto } = await sb
      .from("cuentas_cobranza")
      .select("id, id_oferta, precio_final, fecha_compra")
      .in("id_oferta", ofertaIds).eq("activo", true).order("id");
    const nombreDeCuenta = (c: any): string | null => {
      const off = ofertaById.get(c.id_oferta);
      return off?.id_producto ? productById.get(off.id_producto) ?? null : null;
    };
    for (const c of cuentasProducto ?? []) {
      const n = nombreDeCuenta(c);
      if (!n) continue;
      if (BODEGA_RE.test(n)) bodegaCuentas.push(c);
      else if (ESTAC_RE.test(n)) estacCuentas.push(c);
    }
  }

  // 6) Total pagado por cuenta de producto: Σ aplicaciones_pago (es_multa=false)
  //    vía acuerdos_pago (fuente de verdad, CLAUDE.md).
  const pagoCuentaIds = [...bodegaCuentas, ...estacCuentas].map((c) => c.id);
  const pagadoPorCuenta = new Map<number, number>();
  if (pagoCuentaIds.length) {
    const { data: acuerdos } = await sb
      .from("acuerdos_pago").select("id, id_cuenta_cobranza").in("id_cuenta_cobranza", pagoCuentaIds).eq("activo", true);
    const acuerdoToCuenta = new Map<number, number>((acuerdos ?? []).map((a: any) => [a.id, a.id_cuenta_cobranza]));
    const acuerdoIds = [...acuerdoToCuenta.keys()];
    if (acuerdoIds.length) {
      const { data: aplicaciones } = await sb
        .from("aplicaciones_pago").select("id_acuerdo_pago, monto, es_multa").in("id_acuerdo_pago", acuerdoIds).eq("activo", true);
      for (const ap of aplicaciones ?? []) {
        if (ap.es_multa) continue;
        const cId = acuerdoToCuenta.get(ap.id_acuerdo_pago);
        if (cId == null) continue;
        pagadoPorCuenta.set(cId, (pagadoPorCuenta.get(cId) || 0) + Number(ap.monto || 0));
      }
    }
  }

  // 7) Emparejar filas físicas con cuentas por índice (mismo criterio que la
  //    página de Expedientes: la cuenta aporta financieros, la fila el físico).
  const bodegas: BodegaSolicitud[] = [];
  const nBodegas = Math.max(bodegaRows.length, bodegaCuentas.length);
  for (let i = 0; i < nBodegas; i++) {
    const fila = bodegaRows[i];
    const c = bodegaCuentas[i];
    const m2 = Number(fila?.m2 || 0);
    const precioFinal = c ? Number(c.precio_final || 0) : 0;
    const totalPagado = c ? pagadoPorCuenta.get(c.id) || 0 : 0;
    bodegas.push({
      id: fila?.id ?? c?.id ?? i,
      nombre: fila?.nombre || (c ? productById.get(ofertaById.get(c.id_oferta)?.id_producto) : null) || "Bodega",
      m2,
      precioM2: c && m2 > 0 ? precioFinal / m2 : null,
      precioFinal,
      totalPagado,
      saldoPendiente: precioFinal - totalPagado,
      ubicacion: fila?.ubicacion || null,
      fechaCompra: c?.fecha_compra ?? null,
      cuentaLabel: c ? ccLabel(c.id) : null,
      tieneCuenta: !!c,
    });
  }

  const estacionamientos: EstacionamientoSolicitud[] = [];
  const nEstac = Math.max(estacRows.length, estacCuentas.length);
  for (let i = 0; i < nEstac; i++) {
    const fila = estacRows[i];
    const c = estacCuentas[i];
    const m2 = Number(fila?.m2 || 0);
    const precioFinal = c ? Number(c.precio_final || 0) : 0;
    estacionamientos.push({
      id: fila?.id ?? c?.id ?? i,
      nombre: fila?.nombre || (c ? productById.get(ofertaById.get(c.id_oferta)?.id_producto) : null) || "Estacionamiento",
      tipo: (fila?.id_tipo && tipoEstacById.get(fila.id_tipo)) || "Normal",
      m2,
      precioM2: m2 > 0 && precioFinal > 0 ? precioFinal / m2 : null,
      precioFinal,
      ubicacion: fila?.ubicacion || null,
      esIncluido: !!fila?.es_incluido,
      fechaCompra: c?.fecha_compra ?? null,
      cuentaLabel: c ? ccLabel(c.id) : null,
    });
  }

  const m2Interiores = Number(prop.m2_interiores || 0);
  const m2Exteriores = Number(prop.m2_exteriores || 0);

  return {
    propiedadId,
    numeroPropiedad: prop.numero_propiedad != null ? String(prop.numero_propiedad) : "—",
    proyecto,
    edificio: edificioRes.data?.nombre ?? "",
    modelo: modeloRes.data?.nombre ?? "",
    tipo: tipoRes.data?.nombre ?? "—",
    m2Interiores,
    m2Exteriores,
    m2Total: m2Interiores + m2Exteriores,
    fichaTecnicaUrl,
    estacionamientos,
    bodegas,
  };
}

export function usePropiedadSolicitudBancos(idCuentaCobranza: number | null | undefined) {
  return useQuery({
    queryKey: ["propiedad-solicitud-bancos", idCuentaCobranza],
    queryFn: () => fetchPropiedadSolicitud(idCuentaCobranza as number),
    enabled: idCuentaCobranza != null,
    staleTime: 60_000,
  });
}
