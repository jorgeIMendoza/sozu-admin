import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import type {
  BaseContable,
  IngresoEgresoMovimiento,
  ProyectoSozu,
  TipoIngresoSozu,
} from "@/data/altaDireccion/ingresosEgresosMock";
import type { IngresosEgresosFiltros } from "./useResumenIngresosEgresos";

/**
 * Ledger real de Ingresos y Egresos (Portal Alta Dirección).
 *
 *  - Ingresos = una fila por cuenta_cobranza con fecha_compra (la
 *    comisión SOZU que se factura/cobra al desarrollador).
 *  - Egresos  = una fila por comisionista de cada cuenta. Se clasifica
 *    Externo / Interno con la misma regla que `useComisionesInternas`
 *    (rol agente inmobiliario sin dominio interno + persona tipo PM).
 *
 *  El shape devuelto es `IngresoEgresoMovimiento[]` para que la tabla
 *  del módulo (hoy renderizada desde el mock) lo consuma sin cambios.
 */

const AGENTE_INMOBILIARIO_ROL_ID = 3;
const DOMINIOS_INTERNOS = ["sozu.com", "investimento.mx", "tallwood.mx", "daiku.mx"];
const PAGE_SIZE = 1000;
const IN_BATCH = 500;
const IVA_RATE = 0.16;

function esDominioInterno(email: string | null | undefined): boolean {
  if (!email) return true;
  const dom = email.split("@")[1]?.toLowerCase();
  if (!dom) return true;
  return DOMINIOS_INTERNOS.includes(dom);
}

function ivaOf(subtotal: number) {
  return +(subtotal * IVA_RATE).toFixed(2);
}

const TODAY = new Date();

export function useMovimientosIngresosEgresos(filtros: IngresosEgresosFiltros) {
  return useQuery<IngresoEgresoMovimiento[]>({
    queryKey: [
      "movimientos-ingresos-egresos",
      filtros.proyecto,
      filtros.base,
      filtros.periodoMeses,
      filtros.fechaInicio ?? null,
      filtros.fechaFin ?? null,
      filtros.tipoIngreso,
    ],
    queryFn: () => fetchMovimientos(filtros),
    staleTime: 60_000,
  });
}

async function fetchMovimientos(
  filtros: IngresosEgresosFiltros,
): Promise<IngresoEgresoMovimiento[]> {
  // ── 0) Resolver idProyecto si el filtro trae nombre. ──
  let idProyectoActivo: number | null = null;
  if (filtros.proyecto !== "todos") {
    const { data } = (await (supabase as any)
      .from("proyectos")
      .select("id, nombre")
      .eq("nombre", filtros.proyecto)
      .eq("activo", true)
      .maybeSingle()) as any;
    idProyectoActivo = (data?.id as number | null) ?? null;
    if (idProyectoActivo == null) return [];
  }

  // ── 1) Subset de propiedades cuando hay idProyecto. ──
  let propiedadIdSet: Set<number> | null = null;
  if (idProyectoActivo != null) {
    const { data: edRows } = (await (supabase as any)
      .from("edificios")
      .select("id")
      .eq("id_proyecto", idProyectoActivo)
      .eq("activo", true)) as any;
    const edIds = ((edRows || []) as Array<any>).map((e) => e.id as number);
    if (edIds.length === 0) return [];
    const { data: emRows } = (await (supabase as any)
      .from("edificios_modelos")
      .select("id")
      .in("id_edificio", edIds)) as any;
    const emIds = ((emRows || []) as Array<any>).map((e) => e.id as number);
    if (emIds.length === 0) return [];
    const propIds: number[] = [];
    for (let i = 0; i < emIds.length; i += PAGE_SIZE) {
      const slice = emIds.slice(i, i + PAGE_SIZE);
      const { data } = (await (supabase as any)
        .from("propiedades")
        .select("id")
        .in("id_edificio_modelo", slice)) as any;
      propIds.push(...((data || []) as Array<any>).map((p) => p.id as number));
    }
    if (propIds.length === 0) return [];
    propiedadIdSet = new Set(propIds);
  }

  // ── 2) Cuentas en scope (filtradas por propiedad si aplica). ──
  const cuentaCols =
    "id, id_oferta, id_propiedad, precio_final, porcentaje_comision_venta, iva_incluido, fecha_compra, fecha_pago_comision, es_pagada_comision_venta";
  const cuentas: Array<any> = [];
  if (propiedadIdSet) {
    const seen = new Set<number>();
    const propIds = Array.from(propiedadIdSet);
    for (let i = 0; i < propIds.length; i += IN_BATCH) {
      const slice = propIds.slice(i, i + IN_BATCH);
      const { data } = (await (supabase as any)
        .from("cuentas_cobranza")
        .select(cuentaCols)
        .eq("activo", true)
        .is("id_cuenta_cobranza_padre", null)
        .in("id_propiedad", slice)) as any;
      for (const r of ((data || []) as Array<any>)) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          cuentas.push(r);
        }
      }
    }
    // Ofertas con id_propiedad en el subset → cuentas que sólo tienen id_oferta.
    const { data: ofs } = (await (supabase as any)
      .from("ofertas")
      .select("id")
      .in("id_propiedad", propIds.slice(0, 1000))) as any;
    const ofIds = ((ofs || []) as Array<any>).map((o) => o.id as number);
    for (let i = 0; i < ofIds.length; i += IN_BATCH) {
      const slice = ofIds.slice(i, i + IN_BATCH);
      const { data } = (await (supabase as any)
        .from("cuentas_cobranza")
        .select(cuentaCols)
        .eq("activo", true)
        .is("id_cuenta_cobranza_padre", null)
        .in("id_oferta", slice)) as any;
      for (const r of ((data || []) as Array<any>)) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          cuentas.push(r);
        }
      }
    }
  } else {
    const all = await fetchAllRows<any>((from, to) =>
      (supabase as any)
        .from("cuentas_cobranza")
        .select(cuentaCols)
        .eq("activo", true)
        .is("id_cuenta_cobranza_padre", null)
        .range(from, to),
    );
    cuentas.push(...all);
  }
  if (cuentas.length === 0) return [];

  // ── 3) Ofertas (id_propiedad fallback + id_producto). ──
  const ofertaIds = Array.from(
    new Set(cuentas.map((c) => c.id_oferta).filter((v): v is number => !!v)),
  );
  const ofertas: Array<any> = [];
  for (let i = 0; i < ofertaIds.length; i += IN_BATCH) {
    const slice = ofertaIds.slice(i, i + IN_BATCH);
    const { data } = (await (supabase as any)
      .from("ofertas")
      .select("id, id_propiedad, id_producto")
      .in("id", slice)) as any;
    ofertas.push(...((data || []) as Array<any>));
  }
  const ofMap = new Map<number, any>(ofertas.map((o) => [o.id, o]));

  // ── 4) Propiedades. ──
  const propIdsEfectivos = Array.from(
    new Set(
      cuentas
        .map((c) => c.id_propiedad ?? ofMap.get(c.id_oferta)?.id_propiedad ?? null)
        .filter((v): v is number => !!v),
    ),
  );
  const propsRows: Array<any> = [];
  for (let i = 0; i < propIdsEfectivos.length; i += IN_BATCH) {
    const slice = propIdsEfectivos.slice(i, i + IN_BATCH);
    const { data } = (await (supabase as any)
      .from("propiedades")
      .select(
        "id, numero_propiedad, id_edificio_modelo, id_entidad_relacionada_dueno",
      )
      .in("id", slice)) as any;
    propsRows.push(...((data || []) as Array<any>));
  }
  const propMap = new Map<number, any>(propsRows.map((p) => [p.id, p]));

  // ── 5) edificios_modelos + modelos + edificios + proyectos. ──
  const emIdsAll = Array.from(
    new Set(propsRows.map((p) => p.id_edificio_modelo).filter((v): v is number => !!v)),
  );
  const { data: emRows } = emIdsAll.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select(
          "id, id_edificio, modelos!edificios_modelos_id_modelo_fkey(nombre)",
        )
        .in("id", emIdsAll)) as any)
    : { data: [] };
  const emMap = new Map<number, any>(((emRows || []) as Array<any>).map((e) => [e.id, e]));

  const edIdsAll = Array.from(
    new Set(((emRows || []) as Array<any>).map((e) => e.id_edificio).filter((v): v is number => !!v)),
  );
  const { data: edRows } = edIdsAll.length
    ? ((await (supabase as any)
        .from("edificios")
        .select("id, nombre, id_proyecto")
        .in("id", edIdsAll)) as any)
    : { data: [] };
  const edMap = new Map<number, any>(((edRows || []) as Array<any>).map((e) => [e.id, e]));

  const projIds = Array.from(
    new Set(((edRows || []) as Array<any>).map((e) => e.id_proyecto).filter((v): v is number => !!v)),
  );
  const { data: projRows } = projIds.length
    ? ((await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .in("id", projIds)) as any)
    : { data: [] };
  const projMap = new Map<number, string>(
    ((projRows || []) as Array<any>).map((p) => [p.id as number, p.nombre as string]),
  );

  // ── 6) Productos → tipo (Propiedad/Producto/Servicio). ──
  const productoIds = Array.from(
    new Set(ofertas.map((o) => o.id_producto).filter((v): v is number => !!v)),
  );
  const { data: prodRows } = productoIds.length
    ? ((await (supabase as any)
        .from("productos_servicios")
        .select(
          "id, nombre, categorias_producto!productos_servicios_id_categoria_fkey(nombre)",
        )
        .in("id", productoIds)) as any)
    : { data: [] };
  const productoMap = new Map<number, { nombre: string; tipo: "Producto" | "Servicio" }>(
    ((prodRows || []) as Array<any>).map((p) => {
      const cat = (p.categorias_producto?.nombre ?? "").toLowerCase();
      return [
        p.id as number,
        { nombre: p.nombre as string, tipo: cat === "servicios" ? "Servicio" : "Producto" },
      ];
    }),
  );

  // ── 7) Entidad dueña → persona (contraparte de ingreso). ──
  const entIds = Array.from(
    new Set(
      propsRows.map((p) => p.id_entidad_relacionada_dueno).filter((v): v is number => !!v),
    ),
  );
  const { data: entRows } = entIds.length
    ? ((await (supabase as any)
        .from("entidades_relacionadas")
        .select("id, id_persona")
        .in("id", entIds)) as any)
    : { data: [] };
  const entPersonaMap = new Map<number, number | null>(
    ((entRows || []) as Array<any>).map((e) => [e.id as number, (e.id_persona ?? null) as number | null]),
  );

  // ── 8) Comisionistas de las cuentas. ──
  const cuentaIds = cuentas.map((c) => c.id as number);
  const comisionistas: Array<any> = [];
  for (let i = 0; i < cuentaIds.length; i += IN_BATCH) {
    const slice = cuentaIds.slice(i, i + IN_BATCH);
    const { data } = (await (supabase as any)
      .from("comisionistas")
      .select(
        "id_cuenta_cobranza, email_usuario, porcentaje_comision, aprobada, pagada, fecha_pago_comision, fecha_creacion, fecha_actualizacion",
      )
      .in("id_cuenta_cobranza", slice)
      .eq("activo", true)) as any;
    comisionistas.push(...((data || []) as Array<any>));
  }

  // ── 9) Clasificar comisionistas (externo/interno). ──
  const emailsCom = Array.from(
    new Set(comisionistas.map((c) => c.email_usuario).filter((v): v is string => !!v)),
  );
  const [usuariosResp, personasResp] = await Promise.all([
    emailsCom.length
      ? ((await (supabase as any)
          .from("usuarios")
          .select("email, nombre, rol_id")
          .in("email", emailsCom)) as any)
      : { data: [] as Array<any> },
    emailsCom.length
      ? ((await (supabase as any)
          .from("personas")
          .select("email, nombre_legal, nombre_comercial, tipo_persona")
          .in("email", emailsCom)
          .eq("activo", true)) as any)
      : { data: [] as Array<any> },
  ]);
  const usuariosMap = new Map<string, { nombre: string; rol_id: number | null }>();
  for (const u of ((usuariosResp.data || []) as Array<any>)) {
    if (u.email) usuariosMap.set(u.email, { nombre: u.nombre ?? "", rol_id: u.rol_id ?? null });
  }
  const personasComMap = new Map<string, { nombre: string; tipoPersona: string | null }>();
  for (const p of ((personasResp.data || []) as Array<any>)) {
    if (p.email) {
      personasComMap.set(p.email, {
        nombre: (p.nombre_comercial || p.nombre_legal || "") as string,
        tipoPersona: p.tipo_persona ?? null,
      });
    }
  }
  const rolIds = Array.from(
    new Set(
      ((usuariosResp.data || []) as Array<any>)
        .map((u) => u.rol_id)
        .filter((v): v is number => !!v),
    ),
  );
  const { data: roles } = rolIds.length
    ? ((await (supabase as any)
        .from("roles")
        .select("id, nombre")
        .in("id", rolIds)) as any)
    : { data: [] };
  const rolNombreMap = new Map<number, string>(
    ((roles || []) as Array<any>).map((r) => [r.id, r.nombre as string]),
  );

  // ── 10) Personas para "propietario" (contraparte ingreso). ──
  const personaIdsProp = Array.from(
    new Set(Array.from(entPersonaMap.values()).filter((v): v is number => !!v)),
  );
  const personaNombre = new Map<number, string>();
  for (let i = 0; i < personaIdsProp.length; i += IN_BATCH) {
    const slice = personaIdsProp.slice(i, i + IN_BATCH);
    const { data } = (await (supabase as any)
      .from("personas")
      .select("id, nombre_legal, nombre_comercial")
      .in("id", slice)) as any;
    for (const p of ((data || []) as Array<any>)) {
      personaNombre.set(
        p.id as number,
        (p.nombre_comercial || p.nombre_legal || "Sin propietario") as string,
      );
    }
  }

  // ── 11) Build movimientos. ──
  const rangoActivo = filtros.periodoMeses === "rango" && filtros.fechaInicio && filtros.fechaFin;
  const desde = rangoActivo
    ? new Date(filtros.fechaInicio! + "T00:00:00")
    : filtros.periodoMeses === "este_mes"
      ? new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)
      : (() => {
          const d = new Date(TODAY);
          d.setMonth(d.getMonth() - (filtros.periodoMeses as number));
          return d;
        })();
  const hasta = rangoActivo ? new Date(filtros.fechaFin! + "T23:59:59") : TODAY;

  const out: IngresoEgresoMovimiento[] = [];
  for (const c of cuentas) {
    const oferta = c.id_oferta ? ofMap.get(c.id_oferta) : null;
    const idPropEfectivo: number | null = c.id_propiedad ?? oferta?.id_propiedad ?? null;
    const prop = idPropEfectivo ? propMap.get(idPropEfectivo) : null;
    const em = prop?.id_edificio_modelo ? emMap.get(prop.id_edificio_modelo) : null;
    const ed = em?.id_edificio ? edMap.get(em.id_edificio) : null;
    const idProy = ed?.id_proyecto ?? null;
    const proyectoNombre = idProy ? projMap.get(idProy) ?? "Sin proyecto" : "Sin proyecto";
    const modeloNombre = (em?.modelos?.nombre as string | null) ?? null;
    const numeroDepto = (prop?.numero_propiedad as string | null) ?? null;
    let tipoCuenta: TipoIngresoSozu = "Propiedad";
    if (oferta?.id_producto) {
      tipoCuenta = productoMap.get(oferta.id_producto)?.tipo ?? "Producto";
    }
    const folio = formatCuentaCobranzaId(c.id as number, tipoCuenta) as string;
    const conceptoParts = [proyectoNombre, modeloNombre, tipoCuenta, numeroDepto].filter(Boolean);
    const concepto = conceptoParts.join(" · ");

    // Propietario (contraparte ingreso).
    const entId = prop?.id_entidad_relacionada_dueno as number | null;
    const idPersonaProp = entId ? entPersonaMap.get(entId) ?? null : null;
    const propietario = idPersonaProp ? personaNombre.get(idPersonaProp) ?? "Sin propietario" : "Sin propietario";

    // ── INGRESO (factura SOZU al desarrollador) ──
    if (c.fecha_compra) {
      const precio = Number(c.precio_final ?? 0);
      const pct = Number(c.porcentaje_comision_venta ?? 0);
      const subtotal = +((precio * pct) / 100).toFixed(2);
      const iva = ivaOf(subtotal);
      const total = +(subtotal + iva).toFixed(2);
      const esPagada = !!c.es_pagada_comision_venta;
      const fechaCausacion = (c.fecha_compra as string).slice(0, 10);
      const fechaPago = (c.fecha_pago_comision as string | null) ?? null;
      const fechaRef = filtros.base === "devengado" ? fechaCausacion : fechaPago;

      if (
        subtotal > 0 &&
        fechaRef &&
        new Date(fechaRef) >= desde &&
        new Date(fechaRef) <= hasta &&
        (filtros.tipoIngreso === "todos" || tipoCuenta === filtros.tipoIngreso)
      ) {
        out.push({
          id: `ing:${c.id}`,
          fecha_causacion: fechaCausacion,
          fecha_cobro_pago: fechaPago,
          folio: `F-S-${String(c.id).padStart(6, "0")}`,
          tipo_movimiento: "ingreso",
          tipo_ingreso: tipoCuenta,
          concepto,
          proyecto: proyectoNombre as ProyectoSozu,
          folio_cuenta: folio,
          contraparte: propietario,
          subtotal,
          iva,
          total,
          estado: esPagada ? "cobrada" : "facturada",
          dias_antiguedad: Math.max(
            0,
            Math.floor((TODAY.getTime() - new Date(fechaCausacion).getTime()) / 86_400_000),
          ),
        });
      }
    }

    // ── EGRESOS (comisionistas) ──
    const comisionistasCuenta = comisionistas.filter((cm) => cm.id_cuenta_cobranza === c.id);
    for (const cm of comisionistasCuenta) {
      const usuario = cm.email_usuario ? usuariosMap.get(cm.email_usuario) : undefined;
      const persona = cm.email_usuario ? personasComMap.get(cm.email_usuario) : undefined;
      const esInmobiliaria = persona?.tipoPersona === "pm";
      const esAgenteExt =
        usuario?.rol_id === AGENTE_INMOBILIARIO_ROL_ID && !esDominioInterno(cm.email_usuario);
      const esExterno = esInmobiliaria || esAgenteExt;

      const precio = Number(c.precio_final ?? 0);
      const pct = Number(cm.porcentaje_comision ?? 0);
      const subtotal = +((precio * pct) / 100).toFixed(2);
      if (subtotal <= 0) continue;
      const iva = ivaOf(subtotal);
      const total = +(subtotal + iva).toFixed(2);

      const fechaCausacion = (
        (cm.fecha_creacion as string | null) ??
        (cm.fecha_actualizacion as string | null) ??
        (c.fecha_compra as string | null) ??
        new Date().toISOString()
      ).slice(0, 10);
      const fechaPago = (cm.fecha_pago_comision as string | null) ?? null;
      const fechaRef = filtros.base === "devengado" ? fechaCausacion : fechaPago;
      if (!fechaRef) continue;
      const d = new Date(fechaRef);
      if (d < desde || d > hasta) continue;

      const estado = cm.pagada ? "pagada" : cm.aprobada ? "comprometida" : "rechazada";
      const cobroPrevio = !!c.es_pagada_comision_venta;
      const nombreContraparte =
        persona?.nombre || usuario?.nombre || cm.email_usuario || "Sin nombre";
      const rolNombre = usuario?.rol_id ? rolNombreMap.get(usuario.rol_id) : undefined;

      out.push({
        id: `egr:${c.id}:${cm.email_usuario}`,
        fecha_causacion: fechaCausacion,
        fecha_cobro_pago: fechaPago,
        folio: esExterno
          ? `COM-EXT-${String(c.id).padStart(6, "0")}`
          : `COM-INT-${String(c.id).padStart(6, "0")}`,
        tipo_movimiento: "egreso",
        origen_egreso: esExterno ? "externo" : "interno",
        concepto,
        proyecto: proyectoNombre as ProyectoSozu,
        folio_cuenta: folio,
        contraparte: nombreContraparte,
        rol: rolNombre,
        subtotal,
        iva,
        total,
        estado,
        cobro_previo: cobroPrevio,
        dias_antiguedad: Math.max(
          0,
          Math.floor((TODAY.getTime() - new Date(fechaCausacion).getTime()) / 86_400_000),
        ),
      });
    }
  }

  return out;
}

export type { IngresoEgresoMovimiento, BaseContable };
