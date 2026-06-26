import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows, fetchInBatches } from "@/utils/supabasePagination";
import { fetchProyectosSozuIds } from "@/hooks/usePortalAltaDireccion/proyectosSozu";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import type { CuentaProducto, Categoria } from "@/lib/portal-productos/types";

/** Parámetros de acceso (de useProjectAccess) para el RPC de cuentas. */
interface AccessParams {
  hasUnrestrictedAccess: boolean;
  accessibleProjectIds: number[];
  isRepresentanteEmpresaDuena: boolean;
  ownershipEntityIds: number[];
}

interface RpcInfo {
  dueno: string;
  pagado: number;
  restante: number;
}

/**
 * Info AUTORITATIVA por cuenta (propietario, total pagado y saldo restante)
 * desde el RPC `get_cuentas_cobranza_paginadas` (misma fuente que usa
 * Pagos/Cuentas y el Detalle del Admin Panel). Es la fuente correcta de estos
 * valores; reemplaza cálculos propios poco confiables.
 */
async function fetchCuentaRpcInfo(access: AccessParams): Promise<Map<number, RpcInfo>> {
  const map = new Map<number, RpcInfo>();
  const perPage = 1000;
  for (let page = 1; page <= 200; page++) {
    const { data, error } = await (supabase as any).rpc("get_cuentas_cobranza_paginadas", {
      p_page: page,
      p_per_page: perPage,
      p_id_cuenta: null,
      p_proyecto: null,
      p_clabe: null,
      p_no_propiedad: null,
      p_modelo: null,
      p_compradores: null,
      p_producto: null,
      p_estatus_ids: null,
      p_tipos: ["Producto", "Servicio"],
      p_activo: true,
      p_proyecto_ids: access.hasUnrestrictedAccess
        ? null
        : access.accessibleProjectIds.length > 0
          ? access.accessibleProjectIds
          : null,
      p_dueno_entity_ids:
        access.isRepresentanteEmpresaDuena && access.ownershipEntityIds.length > 0
          ? access.ownershipEntityIds
          : null,
      p_search: null,
    });
    if (error) break;
    const rows = (data as any[]) || [];
    for (const r of rows) {
      if (r?.id == null) continue;
      map.set(Number(r.id), {
        dueno: (r.dueno as string) || "",
        pagado: Number(r.pagado ?? 0),
        restante: Number(r.restante ?? 0),
      });
    }
    const total = rows[0]?.total_count ?? 0;
    if (rows.length < perPage || page * perPage >= total) break;
  }
  return map;
}

/**
 * Datos REALES del Portal Productos — reemplaza el mock (`seed.ts`).
 *
 * Productos vendidos ligados a propiedades (Muebles, Bodegas, Condensadoras,
 * Estacionamiento), acotado a proyectos SOZU, con desarrollo, propietario
 * (entidad dueña), compradores y cobranza (acuerdos + aplicaciones).
 *
 * Devuelve `CuentaProducto[]` con el shape exacto que consumen las páginas y
 * `derive.ts`. Probe graceful: ante error devuelve `[]`.
 */

const PAQUETE_RE = /amueblad/i;
const CONDENSADORA_RE = /condensador/i;
const BODEGA_RE = /bodega/i;
const ESTAC_RE = /estacionamiento/i;

const ESTATUS_LABEL: Record<number, string> = {
  2: "Disponible",
  4: "Apartado",
  5: "Vendido",
  7: "Vendido",
  8: "Vendido",
  9: "Vendido",
};

function categoriaDeNombre(nombre: string): Categoria | null {
  if (PAQUETE_RE.test(nombre)) return "Paquete de muebles";
  if (CONDENSADORA_RE.test(nombre)) return "Condensadora";
  if (BODEGA_RE.test(nombre)) return "Bodega";
  if (ESTAC_RE.test(nombre)) return "Estacionamiento";
  return null;
}

const num = (v: any) => Number(v ?? 0) || 0;

async function fetchProductosReales(access: AccessParams): Promise<CuentaProducto[]> {
  const [sozuIds, rpcInfoPorCuenta] = await Promise.all([
    fetchProyectosSozuIds(),
    fetchCuentaRpcInfo(access),
  ]);
  if (sozuIds.size === 0) return [];

  // 1) Cuentas de cobranza principales (candidatas a producto).
  const cuentas = await fetchAllRows<any>((from, to) =>
    (supabase as any)
      .from("cuentas_cobranza")
      .select("id, id_oferta, id_propiedad, precio_final, fecha_compra, clabe_stp")
      .eq("activo", true)
      .is("id_cuenta_cobranza_padre", null)
      .order("id", { ascending: false })
      .range(from, to),
  );

  // 2) Ofertas → id_producto (define que es producto) + propiedad/lead/agente.
  const ofertaIds = [...new Set(cuentas.map((c) => c.id_oferta).filter(Boolean))] as number[];
  const ofertas = await fetchInBatches<any>(ofertaIds, (b) =>
    (supabase as any).from("ofertas").select("id, id_propiedad, id_producto, id_persona_lead, email_creador").in("id", b as number[]),
  );
  const ofMap = new Map<number, any>(ofertas.map((o) => [o.id, o]));

  // Agente Vendedor: nombre del usuario creador de la oferta (ofertas.email_creador → usuarios.nombre).
  const creadorEmails = [...new Set(ofertas.map((o) => o.email_creador).filter(Boolean))] as string[];
  const usuariosVendedores = creadorEmails.length
    ? ((await (supabase as any).from("usuarios").select("email, nombre").in("email", creadorEmails)).data ?? [])
    : [];
  const nombreAgentePorEmail = new Map<string, string>(
    (usuariosVendedores as any[]).map((u) => [u.email, u.nombre || u.email]),
  );
  const agenteVendedorDeOferta = (oferta: any): string => {
    const email = oferta?.email_creador;
    if (!email) return "—";
    return nombreAgentePorEmail.get(email) || email;
  };

  // 3) Productos/servicios (nombre, categoría, SAT, precio lista).
  const productoIds = [...new Set(ofertas.map((o) => o.id_producto).filter(Boolean))] as number[];
  const productos = await fetchInBatches<any>(productoIds, (b) =>
    (supabase as any)
      .from("productos_servicios")
      .select("id, nombre, descripcion, precio_lista, sat_id, id_unidad_sat, id_entidad_relacionada_dueno")
      .in("id", b as number[]),
  );
  const prodMap = new Map<number, any>(productos.map((p) => [p.id, p]));

  // Cuentas que SÍ son producto de las 4 categorías de interés.
  type Pendiente = { cuenta: any; oferta: any; prod: any; categoria: Categoria; idPropiedad: number | null };
  const vendidos: Pendiente[] = [];
  for (const c of cuentas) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    if (!oferta?.id_producto) continue;
    const prod = prodMap.get(oferta.id_producto);
    if (!prod?.nombre) continue;
    const categoria = categoriaDeNombre(prod.nombre);
    if (!categoria) continue;
    vendidos.push({ cuenta: c, oferta, prod, categoria, idPropiedad: c.id_propiedad ?? oferta.id_propiedad ?? null });
  }

  // 4) Bodegas / estacionamientos INCLUIDOS (cortesía, sin cuenta).
  const [bodegasInc, estacInc] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      (supabase as any).from("bodegas").select("id, id_propiedad, nombre, m2, ubicacion, es_incluido")
        .eq("activo", true).eq("es_incluido", true).range(from, to),
    ),
    fetchAllRows<any>((from, to) =>
      (supabase as any).from("estacionamientos").select("id, id_propiedad, nombre, m2, ubicacion, es_incluido")
        .eq("activo", true).eq("es_incluido", true).range(from, to),
    ),
  ]);

  // 5) Propiedades (todas las referenciadas) + waterfall a proyecto + dueño.
  const propIds = [
    ...new Set([
      ...vendidos.map((v) => v.idPropiedad).filter(Boolean),
      ...bodegasInc.map((b) => b.id_propiedad).filter(Boolean),
      ...estacInc.map((e) => e.id_propiedad).filter(Boolean),
    ]),
  ] as number[];
  const propiedades = await fetchInBatches<any>(propIds, (b) =>
    (supabase as any).from("propiedades")
      .select("id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno, id_estatus_disponibilidad, m2_interiores, m2_exteriores")
      .in("id", b as number[]),
  );
  const propMap = new Map<number, any>(propiedades.map((p) => [p.id, p]));

  const emIds = [...new Set(propiedades.map((p) => p.id_edificio_modelo).filter(Boolean))] as number[];
  const ems = await fetchInBatches<any>(emIds, (b) =>
    (supabase as any).from("edificios_modelos").select("id, id_edificio, id_modelo").in("id", b as number[]),
  );
  const emMap = new Map<number, any>(ems.map((e) => [e.id, e]));

  const edIds = [...new Set(ems.map((e) => e.id_edificio).filter(Boolean))] as number[];
  const eds = await fetchInBatches<any>(edIds, (b) =>
    (supabase as any).from("edificios").select("id, nombre, id_proyecto").in("id", b as number[]),
  );
  const edMap = new Map<number, any>(eds.map((e) => [e.id, e]));

  const modeloIds = [...new Set(ems.map((e) => e.id_modelo).filter(Boolean))] as number[];
  const modelos = await fetchInBatches<any>(modeloIds, (b) =>
    (supabase as any).from("modelos").select("id, nombre").in("id", b as number[]),
  );
  const modeloMap = new Map<number, string>(modelos.map((m) => [m.id, m.nombre ?? ""]));

  const projIds = [...new Set(eds.map((e) => e.id_proyecto).filter(Boolean))] as number[];
  const projs = await fetchInBatches<any>(projIds, (b) =>
    (supabase as any).from("proyectos").select("id, nombre").in("id", b as number[]),
  );
  const projMap = new Map<number, string>(projs.map((p) => [p.id, p.nombre ?? ""]));

  // Dueño (propietario) → persona. Incluye dueños de PRODUCTO (propietario real
  // del producto) y dueños de PROPIEDAD (fallback para incluidos).
  const entIds = [
    ...new Set([
      ...propiedades.map((p) => p.id_entidad_relacionada_dueno).filter(Boolean),
      ...productos.map((p) => p.id_entidad_relacionada_dueno).filter(Boolean),
    ]),
  ] as number[];
  const ents = await fetchInBatches<any>(entIds, (b) =>
    (supabase as any).from("entidades_relacionadas")
      .select("id, personas!fk_entrel_persona(nombre_legal, nombre_comercial)").in("id", b as number[]),
  );
  const ownerMap = new Map<number, string>(
    ents.map((e: any) => [e.id, e.personas?.nombre_comercial || e.personas?.nombre_legal || "—"]),
  );

  // Resolver dimensiones de una propiedad → { proyectoId, proyecto, edificio, modelo, propietario, ... }.
  const resolverProp = (idPropiedad: number | null) => {
    const prop = idPropiedad ? propMap.get(idPropiedad) : null;
    const em = prop?.id_edificio_modelo ? emMap.get(prop.id_edificio_modelo) : null;
    const ed = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const proyectoId = ed?.id_proyecto ?? null;
    return {
      prop,
      proyectoId,
      proyecto: proyectoId ? projMap.get(proyectoId) ?? "—" : "—",
      edificio: ed?.nombre ?? "—",
      modelo: em?.id_modelo ? modeloMap.get(em.id_modelo) ?? "—" : "—",
      propietario: prop?.id_entidad_relacionada_dueno ? ownerMap.get(prop.id_entidad_relacionada_dueno) ?? "—" : "—",
      numeroPropiedad: prop?.numero_propiedad ?? "—",
      metraje: num(prop?.m2_interiores) + num(prop?.m2_exteriores) || null,
      estatus: (prop?.id_estatus_disponibilidad && ESTATUS_LABEL[prop.id_estatus_disponibilidad]) || "Vendido",
    };
  };

  // 6) Compradores + cobranza SOLO para las cuentas vendidas que pasan SOZU.
  const vendidosSozu = vendidos.filter((v) => {
    const dims = resolverProp(v.idPropiedad);
    return dims.proyectoId != null && sozuIds.has(dims.proyectoId);
  });
  const cuentaIds = vendidosSozu.map((v) => v.cuenta.id);

  const compradores = await fetchInBatches<any>(cuentaIds, (b) =>
    (supabase as any).from("compradores").select("id_cuenta_cobranza, id_persona, porcentaje_copropiedad")
      .eq("activo", true).in("id_cuenta_cobranza", b as number[]),
  );
  const compradorPersonaIds = [...new Set(compradores.map((c) => c.id_persona).filter(Boolean))] as number[];
  const personas = await fetchInBatches<any>(compradorPersonaIds, (b) =>
    (supabase as any).from("personas").select("id, nombre_legal, rfc").in("id", b as number[]),
  );
  const personaMap = new Map<number, any>(personas.map((p) => [p.id, p]));
  const compradoresPorCuenta = new Map<number, { persona: { id: string; nombreLegal: string; rfc: string }; porcentaje: number }[]>();
  for (const c of compradores) {
    const per = personaMap.get(c.id_persona);
    const arr = compradoresPorCuenta.get(c.id_cuenta_cobranza) ?? [];
    arr.push({
      persona: { id: String(c.id_persona), nombreLegal: per?.nombre_legal ?? "—", rfc: per?.rfc ?? "" },
      porcentaje: c.porcentaje_copropiedad != null ? Number(c.porcentaje_copropiedad) / 100 : 1,
    });
    compradoresPorCuenta.set(c.id_cuenta_cobranza, arr);
  }

  // Acuerdos de pago + concepto.
  const acuerdos = await fetchInBatches<any>(cuentaIds, (b) =>
    (supabase as any).from("acuerdos_pago")
      .select("id, id_cuenta_cobranza, id_concepto, monto, pago_completado, orden, fecha_pago")
      .eq("activo", true).in("id_cuenta_cobranza", b as number[]),
  );
  const conceptoIds = [...new Set(acuerdos.map((a) => a.id_concepto).filter(Boolean))] as number[];
  const conceptos = conceptoIds.length
    ? ((await (supabase as any).from("conceptos_pago").select("id, nombre").in("id", conceptoIds)).data ?? [])
    : [];
  const conceptoMap = new Map<number, string>((conceptos as any[]).map((c) => [c.id, c.nombre ?? "Acuerdo"]));
  const acuerdosPorCuenta = new Map<number, any[]>();
  for (const a of acuerdos) {
    const arr = acuerdosPorCuenta.get(a.id_cuenta_cobranza) ?? [];
    arr.push(a);
    acuerdosPorCuenta.set(a.id_cuenta_cobranza, arr);
  }

  // Aplicaciones (pagos reales) por acuerdo.
  const acuerdoIds = acuerdos.map((a) => a.id);
  const aplicaciones = await fetchInBatches<any>(acuerdoIds, (b) =>
    (supabase as any).from("aplicaciones_pago")
      .select("id, id_acuerdo_pago, id_pago, monto, es_multa")
      .eq("activo", true).in("id_acuerdo_pago", b as number[]),
  );
  const pagoIds = [...new Set(aplicaciones.map((a) => a.id_pago).filter(Boolean))] as number[];
  const pagos = await fetchInBatches<any>(pagoIds, (b) =>
    (supabase as any).from("pagos").select("id, id_metodos_pago, fecha_pago, clave_rastreo, url_recibo, url_cep").in("id", b as number[]),
  );
  const pagoMap = new Map<number, any>(pagos.map((p) => [p.id, p]));
  const aplicacionesPorAcuerdo = new Map<number, any[]>();
  for (const ap of aplicaciones) {
    if (ap.es_multa) continue; // no cuenta para total pagado
    const arr = aplicacionesPorAcuerdo.get(ap.id_acuerdo_pago) ?? [];
    arr.push(ap);
    aplicacionesPorAcuerdo.set(ap.id_acuerdo_pago, arr);
  }

  const result: CuentaProducto[] = [];

  // ── Productos VENDIDOS (con cuenta) ──
  for (const v of vendidosSozu) {
    const dims = resolverProp(v.idPropiedad);
    const precioFinal = num(v.cuenta.precio_final);
    const cuentaAcuerdos = (acuerdosPorCuenta.get(v.cuenta.id) ?? []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    const acuerdosOut = cuentaAcuerdos.map((a, i) => ({
      id: String(a.id),
      orden: a.orden ?? i + 1,
      nombre: (a.id_concepto && conceptoMap.get(a.id_concepto)) || "Acuerdo",
      porcentaje: precioFinal > 0 ? +((num(a.monto) / precioFinal) * 100).toFixed(2) : 0,
      monto: num(a.monto),
      fechaCompromiso: a.fecha_pago ?? null,
      pagoCompletado: !!a.pago_completado,
    }));

    const aplicacionesOut: CuentaProducto["aplicaciones"] = [];
    let totalPagado = 0;
    for (const a of cuentaAcuerdos) {
      for (const ap of aplicacionesPorAcuerdo.get(a.id) ?? []) {
        const pago = ap.id_pago ? pagoMap.get(ap.id_pago) : null;
        const montoAplicado = num(ap.monto);
        totalPagado += montoAplicado;
        const claveRastreo = pago?.clave_rastreo ?? "";
        aplicacionesOut.push({
          id: String(ap.id),
          acuerdoId: String(a.id),
          fechaPago: pago?.fecha_pago ?? v.cuenta.fecha_compra ?? "",
          metodo: claveRastreo ? "STP" : "Transferencia",
          claveRastreo,
          montoAplicado,
          evidencia: pago?.url_cep ?? pago?.url_recibo ?? null,
        });
      }
    }

    const categoria = v.categoria;
    const idTipo: "Loft" | "Departamento" = "Departamento";
    // Info autoritativa del RPC del sistema (propietario + pagado/restante).
    const rpc = rpcInfoPorCuenta.get(v.cuenta.id);
    const propietario =
      rpc?.dueno ||
      (v.prod.id_entidad_relacionada_dueno && ownerMap.get(v.prod.id_entidad_relacionada_dueno)) ||
      dims.propietario;
    // Total pagado / saldo: del RPC (misma fuente que Admin Panel); fallback a la suma de aplicaciones.
    const totalPagadoFinal = rpc ? rpc.pagado : totalPagado;
    const saldoFinal = rpc ? rpc.restante : Math.max(precioFinal - totalPagado, 0);
    result.push({
      id: formatCcp(v.cuenta.id),
      tipo: "Producto",
      producto: {
        id: String(v.prod.id),
        nombre: v.prod.nombre ?? "—",
        descripcion: v.prod.descripcion ?? "",
        categoria,
        proyecto: dims.proyecto as any,
        precioLista: num(v.prod.precio_lista),
        satId: v.prod.sat_id ?? null,
        unidadSat: v.prod.id_unidad_sat ?? null,
        propietario: propietario as any,
        clabe: v.cuenta.clabe_stp ?? "",
      },
      propiedad: {
        id: String(v.idPropiedad ?? ""),
        noPropiedad: dims.numeroPropiedad,
        modelo: dims.modelo,
        edificio: dims.edificio,
        proyecto: dims.proyecto as any,
        tipo: idTipo,
        metraje: dims.metraje,
        estatus: dims.estatus as any,
      },
      proyecto: dims.proyecto as any,
      compradores: compradoresPorCuenta.get(v.cuenta.id) ?? [],
      agenteVendedor: agenteVendedorDeOferta(v.oferta),
      ofertaId: v.oferta?.id ? `OF-${String(v.oferta.id).padStart(6, "0")}` : "—",
      clabeStp: v.cuenta.clabe_stp ?? "",
      fechaCompra: v.cuenta.fecha_compra ?? "",
      precioFinal,
      totalPagado: +totalPagadoFinal.toFixed(2),
      saldoPendiente: +saldoFinal.toFixed(2),
      acuerdos: acuerdosOut,
      aplicaciones: aplicacionesOut,
    });
  }

  // ── INCLUIDOS (cortesía, precio 0, sin cobranza) ──
  const pushIncluido = (row: any, categoria: Categoria, prefijo: string) => {
    const dims = resolverProp(row.id_propiedad);
    if (dims.proyectoId == null || !sozuIds.has(dims.proyectoId)) return;
    result.push({
      id: `${prefijo}-${String(row.id).padStart(6, "0")}`,
      tipo: "Producto",
      producto: {
        id: `${prefijo.toLowerCase()}-${row.id}`,
        nombre: row.nombre ?? categoria,
        descripcion: row.ubicacion ?? "Incluido",
        categoria,
        proyecto: dims.proyecto as any,
        precioLista: 0,
        satId: null,
        unidadSat: null,
        propietario: dims.propietario as any,
        clabe: "",
      },
      propiedad: {
        id: String(row.id_propiedad ?? ""),
        noPropiedad: dims.numeroPropiedad,
        modelo: dims.modelo,
        edificio: dims.edificio,
        proyecto: dims.proyecto as any,
        tipo: "Departamento",
        metraje: num(row.m2) || null,
        estatus: dims.estatus as any,
      },
      proyecto: dims.proyecto as any,
      compradores: [],
      agenteVendedor: "—",
      ofertaId: "—",
      clabeStp: "",
      fechaCompra: "",
      precioFinal: 0,
      totalPagado: 0,
      saldoPendiente: 0,
      acuerdos: [],
      aplicaciones: [],
    });
  };
  for (const b of bodegasInc) pushIncluido(b, "Bodega", "BOD");
  for (const e of estacInc) pushIncluido(e, "Estacionamiento", "EST");

  return result;
}

function formatCcp(id: number): string {
  return `CCP-${String(id).padStart(6, "0")}`;
}

export function useProductosReales() {
  const {
    accessibleProjectIds,
    hasUnrestrictedAccess,
    isLoading: isLoadingAccess,
    isRepresentanteEmpresaDuena,
    ownershipEntityIds,
  } = useProjectAccess();

  return useQuery<CuentaProducto[]>({
    queryKey: [
      "portal-productos-reales",
      hasUnrestrictedAccess,
      accessibleProjectIds,
      isRepresentanteEmpresaDuena,
      ownershipEntityIds,
    ],
    enabled: !isLoadingAccess,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        return await fetchProductosReales({
          hasUnrestrictedAccess,
          accessibleProjectIds: accessibleProjectIds ?? [],
          isRepresentanteEmpresaDuena,
          ownershipEntityIds: ownershipEntityIds ?? [],
        });
      } catch {
        return [];
      }
    },
  });
}
