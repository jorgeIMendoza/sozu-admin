import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";

/* ──────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────── */

export type TipoNotificacion =
  | "venta_lista_facturar"
  | "pago_externo_validar"
  | "comision_interna_autorizar"
  | "factura_sozu_vencida"
  | "factura_pagar_pendiente";

export interface NotificacionAltaDireccion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  sub_info: string;
  proyecto: string | null;
  folio_cuenta: string;
  fecha_evento: string;
  dias_esperando: number;
  monto: number;
  critico: boolean;
  link_modulo: string;
}

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const DIAS_CREDITO_FACTURA = 30;
const UMBRAL_CRITICO_DIAS = 7;

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
const diasTxt = (d: number) => `${d} ${d === 1 ? "día" : "días"}`;

/* ──────────────────────────────────────────────────────────
   Estructuras base
   ────────────────────────────────────────────────────────── */

type CuentaBase = {
  id: number;
  id_oferta: number | null;
  id_propiedad: number | null;
  precio_final: number | null;
  porcentaje_comision_venta: number | null;
  fecha_compra: string | null;
  url_factura_comision: string | null;
  es_pagada_comision_venta: boolean | null;
};

type EnrichedCuenta = CuentaBase & {
  tipo_cuenta: "Propiedad" | "Producto";
  folio: string;
  proyecto: string | null;
  ubicacion: string;
};

const CUENTA_FIELDS =
  "id, id_oferta, id_propiedad, precio_final, porcentaje_comision_venta, fecha_compra, url_factura_comision, es_pagada_comision_venta";

/* ──────────────────────────────────────────────────────────
   Clasificación interno/externo (no existe columna directa)
   - "externo" = persona con tipo_persona='pm' (inmobiliaria) o
     usuario con rol_id=3 (agente inmobiliario) sin dominio interno.
   ────────────────────────────────────────────────────────── */

const AGENTE_INMOBILIARIO_ROL_ID = 3;
const DOMINIOS_INTERNOS = ["sozu.com", "investimento.mx", "tallwood.mx", "daiku.mx"];

function esDominioInterno(email: string | null | undefined): boolean {
  if (!email) return true;
  const dom = email.split("@")[1]?.toLowerCase();
  if (!dom) return true;
  return DOMINIOS_INTERNOS.includes(dom);
}

async function clasificarPorEmail(
  emails: string[],
): Promise<(email: string | null | undefined) => boolean> {
  if (emails.length === 0) return () => false;

  const [{ data: usuarios }, { data: personas }] = await Promise.all([
    supabase.from("usuarios").select("email, rol_id").in("email", emails),
    (supabase as unknown as { from: typeof supabase.from }).from("personas")
      .select("email, tipo_persona")
      .in("email", emails)
      .eq("activo", true),
  ]);

  const rolPorEmail = new Map<string, number | null>();
  for (const u of (usuarios ?? []) as Array<{ email: string | null; rol_id: number | null }>) {
    if (u.email) rolPorEmail.set(u.email, u.rol_id ?? null);
  }
  const tipoPorEmail = new Map<string, string | null>();
  for (const p of (personas ?? []) as Array<{ email: string | null; tipo_persona: string | null }>) {
    if (p.email) tipoPorEmail.set(p.email, p.tipo_persona ?? null);
  }

  return (email: string | null | undefined) => {
    if (!email) return false;
    const esInmobiliaria = tipoPorEmail.get(email) === "pm";
    const esAgenteExterno =
      rolPorEmail.get(email) === AGENTE_INMOBILIARIO_ROL_ID && !esDominioInterno(email);
    return esInmobiliaria || esAgenteExterno;
  };
}

/* ──────────────────────────────────────────────────────────
   Enrich: completa proyecto/ubicacion/tipo en batch
   ────────────────────────────────────────────────────────── */

async function enrichCuentas(rows: CuentaBase[]): Promise<Map<number, EnrichedCuenta>> {
  if (rows.length === 0) return new Map();

  const ofertaIds = Array.from(
    new Set(rows.map((r) => r.id_oferta).filter((x): x is number => !!x)),
  );

  const ofertasMap = new Map<number, { id_producto: number | null; id_propiedad: number | null }>();
  if (ofertaIds.length > 0) {
    const { data: ofs, error } = await supabase
      .from("ofertas")
      .select("id, id_producto, id_propiedad")
      .in("id", ofertaIds);
    if (error) throw error;
    for (const o of ofs ?? []) {
      ofertasMap.set(o.id as number, {
        id_producto: (o as { id_producto: number | null }).id_producto ?? null,
        id_propiedad: (o as { id_propiedad: number | null }).id_propiedad ?? null,
      });
    }
  }

  const propIds = new Set<number>();
  for (const r of rows) {
    if (r.id_propiedad) propIds.add(r.id_propiedad);
    const o = r.id_oferta ? ofertasMap.get(r.id_oferta) : null;
    if (o?.id_propiedad) propIds.add(o.id_propiedad);
  }

  type PropRow = {
    id: number;
    numero_propiedad: string | null;
    edificios_modelos: {
      edificios: {
        nombre: string | null;
        proyectos: { nombre: string | null } | null;
      } | null;
    } | null;
  };

  const propsMap = new Map<number, PropRow>();
  if (propIds.size > 0) {
    const { data: props, error } = await supabase
      .from("propiedades")
      .select(
        `
        id,
        numero_propiedad,
        edificios_modelos!fk_propiedades_edificio_modelo (
          edificios!fk_edificios_modelos_edificio (
            nombre,
            proyectos!fk_edificios_proyecto ( nombre )
          )
        )
      `,
      )
      .in("id", Array.from(propIds));
    if (error) throw error;
    for (const p of (props ?? []) as unknown as PropRow[]) {
      propsMap.set(p.id, p);
    }
  }

  const out = new Map<number, EnrichedCuenta>();
  for (const r of rows) {
    const oferta = r.id_oferta ? ofertasMap.get(r.id_oferta) ?? null : null;
    const tipo_cuenta: "Propiedad" | "Producto" = oferta?.id_producto
      ? "Producto"
      : "Propiedad";
    const propId = r.id_propiedad ?? oferta?.id_propiedad ?? null;
    const prop = propId ? propsMap.get(propId) ?? null : null;
    const proyecto = prop?.edificios_modelos?.edificios?.proyectos?.nombre ?? null;
    const edificio = prop?.edificios_modelos?.edificios?.nombre ?? "";
    const numero = prop?.numero_propiedad ?? "";
    const ubicacion = [edificio, numero].filter(Boolean).join(" ");
    out.set(r.id, {
      ...r,
      tipo_cuenta,
      folio: formatCuentaCobranzaId(r.id, tipo_cuenta),
      proyecto,
      ubicacion,
    });
  }
  return out;
}

/* ──────────────────────────────────────────────────────────
   Q1) Ventas listas para facturar
   ────────────────────────────────────────────────────────── */

async function fetchVentasListasFacturar(): Promise<NotificacionAltaDireccion[]> {
  const { data, error } = await supabase
    .from("cuentas_cobranza")
    .select(CUENTA_FIELDS)
    .eq("activo", true)
    .eq("es_pagada_comision_venta", false)
    .is("id_cuenta_cobranza_padre", null)
    .is("url_factura_comision", null)
    .not("fecha_compra", "is", null)
    .order("fecha_compra", { ascending: true })
    .limit(50);
  if (error) throw error;

  const base = (data ?? []) as CuentaBase[];
  const enriched = await enrichCuentas(base);

  return base.map<NotificacionAltaDireccion>((r) => {
    const c = enriched.get(r.id)!;
    const precio = r.precio_final ?? 0;
    const pct = r.porcentaje_comision_venta ?? 0;
    const comision = precio * (pct / 100);
    const dias = diasDesde(r.fecha_compra);
    const ubic = c.ubicacion ? ` · ${c.ubicacion}` : "";
    return {
      id: `venta-facturar:${r.id}`,
      tipo: "venta_lista_facturar",
      titulo: `Venta lista para facturar · ${c.folio}${c.proyecto ? ` ${c.proyecto}` : ""}`,
      sub_info: `${c.proyecto ?? "Propiedad"}${ubic} · comisión $${fmt(comision)} · ${diasTxt(dias)} desde venta`,
      proyecto: c.proyecto,
      folio_cuenta: c.folio,
      fecha_evento: r.fecha_compra!,
      dias_esperando: dias,
      monto: comision,
      critico: dias > UMBRAL_CRITICO_DIAS,
      link_modulo: "/admin/portal-alta-direccion/bandeja",
    };
  });
}

/* ──────────────────────────────────────────────────────────
   Helper compartido: trae cuentas por ids con campos básicos
   ────────────────────────────────────────────────────────── */

async function fetchCuentasByIds(ids: number[]): Promise<CuentaBase[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("cuentas_cobranza")
    .select(CUENTA_FIELDS)
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as CuentaBase[];
}

/* ──────────────────────────────────────────────────────────
   Q2) Pagos a externos pendientes de validar
   ────────────────────────────────────────────────────────── */

type ComisionistaRow = {
  id_cuenta_cobranza: number;
  email_usuario: string | null;
  porcentaje_comision: number | null;
  fecha_creacion: string | null;
  fecha_actualizacion: string | null;
};

async function fetchPagosExternosValidar(): Promise<NotificacionAltaDireccion[]> {
  const { data, error } = await supabase
    .from("comisionistas")
    .select(
      "id_cuenta_cobranza, email_usuario, porcentaje_comision, fecha_creacion, fecha_actualizacion",
    )
    .eq("activo", true)
    .eq("aprobada", false)
    .eq("pagada", false)
    .order("fecha_actualizacion", { ascending: true })
    .limit(200);
  if (error) throw error;

  const todas = (data ?? []) as ComisionistaRow[];
  if (todas.length === 0) return [];

  const emails = Array.from(
    new Set(todas.map((c) => c.email_usuario).filter((v): v is string => !!v)),
  );
  const esExterno = await clasificarPorEmail(emails);
  const filas = todas.filter((c) => esExterno(c.email_usuario));
  if (filas.length === 0) return [];

  const cuentaIds = Array.from(new Set(filas.map((c) => c.id_cuenta_cobranza)));
  const cuentas = await fetchCuentasByIds(cuentaIds);
  const enriched = await enrichCuentas(cuentas);

  return filas
    .map<NotificacionAltaDireccion | null>((c) => {
      const en = enriched.get(c.id_cuenta_cobranza);
      if (!en) return null;
      const precio = en.precio_final ?? 0;
      const pct = c.porcentaje_comision ?? 0;
      const monto = precio * (pct / 100);
      const fecha =
        c.fecha_actualizacion ??
        c.fecha_creacion ??
        en.fecha_compra ??
        new Date().toISOString();
      const dias = diasDesde(fecha);
      const ubic = en.ubicacion ? ` · ${en.ubicacion}` : "";
      return {
        id: `externo-validar:${c.id_cuenta_cobranza}:${c.email_usuario ?? "x"}`,
        tipo: "pago_externo_validar",
        titulo: `Pago externo por validar · ${en.folio}`,
        sub_info: `${c.email_usuario ?? "Comisionista externo"}${ubic} · ${pct.toFixed(2)}% ≈ $${fmt(monto)} · ${diasTxt(dias)}`,
        proyecto: en.proyecto,
        folio_cuenta: en.folio,
        fecha_evento: fecha,
        dias_esperando: dias,
        monto,
        critico: dias > 5,
        link_modulo: "/admin/portal-alta-direccion/bandeja",
      };
    })
    .filter((n): n is NotificacionAltaDireccion => n !== null);
}

/* ──────────────────────────────────────────────────────────
   Q3) Comisiones internas en espera de autorización
   ────────────────────────────────────────────────────────── */

async function fetchComisionesInternasEspera(): Promise<NotificacionAltaDireccion[]> {
  const { data, error } = await supabase
    .from("comisionistas")
    .select(
      "id_cuenta_cobranza, email_usuario, porcentaje_comision, fecha_creacion, fecha_actualizacion",
    )
    .eq("activo", true)
    .eq("aprobada", true)
    .eq("pagada", false)
    .order("fecha_actualizacion", { ascending: true })
    .limit(400);
  if (error) throw error;

  const todas = (data ?? []) as ComisionistaRow[];
  if (todas.length === 0) return [];

  const emails = Array.from(
    new Set(todas.map((c) => c.email_usuario).filter((v): v is string => !!v)),
  );
  const esExterno = await clasificarPorEmail(emails);
  const filas = todas.filter((c) => !esExterno(c.email_usuario));
  if (filas.length === 0) return [];

  const porCuenta = new Map<number, ComisionistaRow[]>();
  for (const f of filas) {
    const arr = porCuenta.get(f.id_cuenta_cobranza) ?? [];
    arr.push(f);
    porCuenta.set(f.id_cuenta_cobranza, arr);
  }

  const cuentas = await fetchCuentasByIds(Array.from(porCuenta.keys()));
  const enriched = await enrichCuentas(cuentas);

  const out: NotificacionAltaDireccion[] = [];
  for (const [id, lista] of porCuenta) {
    const en = enriched.get(id);
    if (!en) continue;
    const precio = en.precio_final ?? 0;
    const pctTotal = lista.reduce((s, c) => s + (c.porcentaje_comision ?? 0), 0);
    const monto = precio * (pctTotal / 100);
    const fechas = lista
      .map((c) => c.fecha_actualizacion ?? c.fecha_creacion)
      .filter((x): x is string => !!x);
    const fecha = fechas.length
      ? fechas.sort()[0]
      : en.fecha_compra ?? new Date().toISOString();
    const dias = diasDesde(fecha);
    const ubic = en.ubicacion ? ` · ${en.ubicacion}` : "";
    out.push({
      id: `interna-autorizar:${id}`,
      tipo: "comision_interna_autorizar",
      titulo: `Comisión interna pendiente · ${en.folio}`,
      sub_info: `${lista.length} ${lista.length === 1 ? "comisionista" : "comisionistas"}${ubic} · ${pctTotal.toFixed(2)}% ≈ $${fmt(monto)} · ${diasTxt(dias)} esperando`,
      proyecto: en.proyecto,
      folio_cuenta: en.folio,
      fecha_evento: fecha,
      dias_esperando: dias,
      monto,
      critico: dias > 5,
      link_modulo: "/admin/portal-alta-direccion/bandeja",
    });
  }
  return out;
}

/* ──────────────────────────────────────────────────────────
   Q4) Facturas SOZU vencidas sin cobrar
   ────────────────────────────────────────────────────────── */

async function fetchFacturasSozuVencidas(): Promise<NotificacionAltaDireccion[]> {
  const { data, error } = await supabase
    .from("cuentas_cobranza")
    .select(CUENTA_FIELDS)
    .eq("activo", true)
    .eq("es_pagada_comision_venta", false)
    .is("id_cuenta_cobranza_padre", null)
    .not("url_factura_comision", "is", null)
    .not("fecha_compra", "is", null)
    .order("fecha_compra", { ascending: true })
    .limit(100);
  if (error) throw error;

  const base = (data ?? []) as CuentaBase[];
  const hoy = Date.now();
  const vencidas = base.filter(
    (r) =>
      r.fecha_compra &&
      new Date(r.fecha_compra).getTime() + DIAS_CREDITO_FACTURA * 86_400_000 < hoy,
  );
  if (vencidas.length === 0) return [];

  const enriched = await enrichCuentas(vencidas);

  return vencidas.map<NotificacionAltaDireccion>((r) => {
    const en = enriched.get(r.id)!;
    const precio = r.precio_final ?? 0;
    const pct = r.porcentaje_comision_venta ?? 0;
    const comision = precio * (pct / 100);
    const vencimiento =
      new Date(r.fecha_compra!).getTime() + DIAS_CREDITO_FACTURA * 86_400_000;
    const diasVencida = Math.floor((hoy - vencimiento) / 86_400_000);
    const ubic = en.ubicacion ? ` · ${en.ubicacion}` : "";
    return {
      id: `factura-vencida:${r.id}`,
      tipo: "factura_sozu_vencida",
      titulo: `Factura SOZU vencida sin cobrar · ${en.folio}`,
      sub_info: `${en.proyecto ?? "Cuenta"}${ubic} · $${fmt(comision)} · ${diasTxt(diasVencida)} vencida`,
      proyecto: en.proyecto,
      folio_cuenta: en.folio,
      fecha_evento: r.fecha_compra!,
      dias_esperando: diasVencida,
      monto: comision,
      critico: true,
      link_modulo: "/admin/portal-alta-direccion/facturas-por-cobrar",
    };
  });
}

/* ──────────────────────────────────────────────────────────
   Q5) Facturas por pagar autorizadas sin liquidar
   ────────────────────────────────────────────────────────── */

async function fetchFacturasPorPagarPendientes(): Promise<NotificacionAltaDireccion[]> {
  const { data, error } = await supabase
    .from("comisionistas")
    .select(
      "id_cuenta_cobranza, email_usuario, porcentaje_comision, fecha_creacion, fecha_actualizacion",
    )
    .eq("activo", true)
    .eq("aprobada", true)
    .eq("pagada", false)
    .order("fecha_actualizacion", { ascending: true })
    .limit(200);
  if (error) throw error;

  const todas = (data ?? []) as ComisionistaRow[];
  if (todas.length === 0) return [];

  const emails = Array.from(
    new Set(todas.map((c) => c.email_usuario).filter((v): v is string => !!v)),
  );
  const esExterno = await clasificarPorEmail(emails);
  const filas = todas.filter((c) => esExterno(c.email_usuario));
  if (filas.length === 0) return [];

  const cuentaIds = Array.from(new Set(filas.map((c) => c.id_cuenta_cobranza)));
  const cuentas = await fetchCuentasByIds(cuentaIds);
  const enriched = await enrichCuentas(cuentas);

  return filas
    .map<NotificacionAltaDireccion | null>((c) => {
      const en = enriched.get(c.id_cuenta_cobranza);
      if (!en) return null;
      // Sólo aplican aquellas donde el desarrollador YA pagó a SOZU,
      // porque si no, no se puede dispersar todavía.
      if (!en.es_pagada_comision_venta) return null;

      const precio = en.precio_final ?? 0;
      const pct = c.porcentaje_comision ?? 0;
      const monto = precio * (pct / 100);
      const fecha =
        c.fecha_actualizacion ??
        c.fecha_creacion ??
        en.fecha_compra ??
        new Date().toISOString();
      const dias = diasDesde(fecha);
      const ubic = en.ubicacion ? ` · ${en.ubicacion}` : "";
      return {
        id: `por-pagar:${c.id_cuenta_cobranza}:${c.email_usuario ?? "x"}`,
        tipo: "factura_pagar_pendiente",
        titulo: `Factura por pagar · ${en.folio}`,
        sub_info: `${c.email_usuario ?? "Externo"}${ubic} · $${fmt(monto)} autorizados sin liquidar · ${diasTxt(dias)}`,
        proyecto: en.proyecto,
        folio_cuenta: en.folio,
        fecha_evento: fecha,
        dias_esperando: dias,
        monto,
        critico: dias > UMBRAL_CRITICO_DIAS,
        link_modulo: "/admin/portal-alta-direccion/facturas-por-pagar",
      };
    })
    .filter((n): n is NotificacionAltaDireccion => n !== null);
}

/* ──────────────────────────────────────────────────────────
   Hook público
   ────────────────────────────────────────────────────────── */

export function useNotificacionesAltaDireccion() {
  return useQuery<NotificacionAltaDireccion[]>({
    queryKey: ["notificaciones-alta-direccion"],
    queryFn: async () => {
      const [q1, q2, q3, q4, q5] = await Promise.all([
        fetchVentasListasFacturar(),
        fetchPagosExternosValidar(),
        fetchComisionesInternasEspera(),
        fetchFacturasSozuVencidas(),
        fetchFacturasPorPagarPendientes(),
      ]);
      const all = [...q1, ...q2, ...q3, ...q4, ...q5];
      return all.sort(
        (a, b) => new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime(),
      );
    },
    staleTime: 60 * 1000,
  });
}
