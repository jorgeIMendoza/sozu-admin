import { useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  CreditCard,
  Users,
  AlertTriangle,
  Clock,
  Eye,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Pill } from "@/components/admin/portal-alta-direccion/ui";
import { fmtMxn } from "@/data/altaDireccion/mockData";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ExpedienteDrawer } from "@/components/admin/portal-alta-direccion/drawers/ExpedienteDrawer";
import { VentaParaFacturarContent } from "@/components/admin/portal-alta-direccion/drawers/content/VentaParaFacturarContent";
import { PagoExternoContent } from "@/components/admin/portal-alta-direccion/drawers/content/PagoExternoContent";
import { ComisionInternaContent } from "@/components/admin/portal-alta-direccion/drawers/content/ComisionInternaContent";
import { ExcepcionContent } from "@/components/admin/portal-alta-direccion/drawers/content/ExcepcionContent";
import {
  getVentaContext,
  resolveCobFolio,
} from "@/components/admin/portal-alta-direccion/drawers/ventaContexts";

/* ──────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────── */

type ValidacionVentaFacturar = {
  id_cuenta_cobranza: number;
  folio_cuenta: string;
  tipo_transaccion: "Propiedad" | "Producto" | "Servicio";
  proyecto: string;
  modelo: string | null;
  producto: string | null;
  numero_propiedad: string;
  entidad_duena: string | null;
  comprador_principal: string;
  rfc_comprador: string;
  precio_final: number;
  monto_factura_desarrollador: number;
  fecha_venta: string;
  dias_esperando: number;
  estatus: string;
};

type ValidacionPagoExterno = {
  id_factura: number;
  folio_factura: string;
  agente_nombre: string;
  agente_tipo: "inmobiliaria" | "broker" | "aliado_comercial" | "agente_externo";
  venta_referencia: string;
  monto: number;
  fecha_emision_factura: string;
  dias_esperando: number;
  ya_se_cobro_al_desarrollador: boolean;
};

type ValidacionComisionInterna = {
  id_comisionista: number;
  folio_comision: string;
  comisionista_nombre: string;
  comisionista_rol: string;
  venta_referencia: string;
  porcentaje_comision: number;
  monto: number;
  dias_esperando: number;
};

type ValidacionExcepcion = {
  id_excepcion: number;
  tipo: "descuento_fuera_politica" | "pago_parcial_fuera_esquema" | "ajuste_manual" | "otro";
  descripcion_corta: string;
  solicitante: string;
  venta_referencia: string;
  monto_impactado: number;
  delta: number;
  dias_esperando: number;
};

type SelectedItem =
  | { tipo: "venta"; data: ValidacionVentaFacturar }
  | { tipo: "externo"; data: ValidacionPagoExterno }
  | { tipo: "interna"; data: ValidacionComisionInterna }
  | { tipo: "excepcion"; data: ValidacionExcepcion };

/* ──────────────────────────────────────────────────────────
   Mock data
   ────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────────────────── */

const PAGE_SIZE = 50;
type SortDir = "asc" | "desc";

/* Alineado con el criterio del admin existente
   (src/pages/admin/ComisionesExternas.tsx):
   - EXTERNO = email del comisionista en `personas` con tipo_persona='pm',
     O usuario con rol_id=3 (Agente Inmobiliario) cuyo email NO pertenece
     a dominios del grupo interno.
   - El campo roles.es_rol_interno NO es confiable como discriminador en
     dev (todos los roles operativos lo tienen true). */
const AGENTE_INMOBILIARIO_ROL_ID = 3;
const DOMINIOS_INTERNOS_GRUPO = [
  "sozu.com",
  "investimento.mx",
  "tallwood.mx",
  "daiku.mx",
];
function esEmailDelGrupoInterno(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return DOMINIOS_INTERNOS_GRUPO.some((d) => domain === d);
}

/* ──────────────────────────────────────────────────────────
   Helper compartido — resuelve proyectos por id_propiedad

   `cuentas_cobranza.id_propiedad` NO tiene FK formal, así que
   PostgREST no auto-resuelve. Hacemos la cadena manualmente:
   propiedades → edificios_modelos → edificios → proyectos.

   Devuelve dos Maps:
   - propMap: id_propiedad → { numero_propiedad, id_edificio_modelo }
   - proyectoMap: id_propiedad → nombre del proyecto
   ────────────────────────────────────────────────────────── */

async function loadProyectosByPropiedades(propIds: number[]): Promise<{
  propMap: Map<number, { numero_propiedad: string; id_edificio_modelo: number | null }>;
  proyectoByProp: Map<number, string>;
}> {
  if (propIds.length === 0) {
    return { propMap: new Map(), proyectoByProp: new Map() };
  }
  const { data: props } = (await (supabase as any)
    .from("propiedades")
    .select("id, numero_propiedad, id_edificio_modelo")
    .in("id", propIds)) as any;
  const propMap = new Map<number, any>((props || []).map((p: any) => [p.id, p]));

  const emIds = Array.from(
    new Set((props || []).map((p: any) => p.id_edificio_modelo).filter(Boolean))
  );
  const { data: ems } = emIds.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select("id, id_edificio")
        .in("id", emIds)) as any)
    : { data: [] };
  const edIds = Array.from(new Set((ems || []).map((e: any) => e.id_edificio).filter(Boolean)));
  const { data: eds } = edIds.length
    ? ((await (supabase as any).from("edificios").select("id, id_proyecto").in("id", edIds)) as any)
    : { data: [] };
  const projIds = Array.from(new Set((eds || []).map((e: any) => e.id_proyecto).filter(Boolean)));
  const { data: projs } = projIds.length
    ? ((await (supabase as any).from("proyectos").select("id, nombre").in("id", projIds)) as any)
    : { data: [] };

  const projNameById = new Map<number, string>(
    (projs || []).map((p: any) => [p.id, p.nombre as string])
  );
  const projIdByEd = new Map<number, number>((eds || []).map((e: any) => [e.id, e.id_proyecto]));
  const projIdByEm = new Map<number, number | undefined>(
    (ems || []).map((em: any) => [em.id, projIdByEd.get(em.id_edificio)])
  );

  const proyectoByProp = new Map<number, string>();
  for (const p of props || []) {
    const projId = projIdByEm.get(p.id_edificio_modelo);
    const nombre = projId ? projNameById.get(projId) : undefined;
    if (nombre) proyectoByProp.set(p.id, nombre);
  }

  return { propMap, proyectoByProp };
}

/* ──────────────────────────────────────────────────────────
   "Comisión SOZU" — paginado + ordenable
   Cuentas_cobranza que cumplen TODAS estas condiciones:
   - Propiedad en estatus_disponibilidad = 5 (Vendido)
   - es_pagada_comision_venta = false (estatus Pendiente)
   - url_factura_comision IS NOT NULL AND
     es_draft_factura_comision = false (factura SOZU Timbrada)
   ────────────────────────────────────────────────────────── */

type VentaFacturarFetchResult = {
  items: ValidacionVentaFacturar[];
  total_count: number;
};

async function fetchVentasParaFacturar(
  page: number,
  sortDir: SortDir
): Promise<VentaFacturarFetchResult> {
  const offset = page * PAGE_SIZE;
  const { data: cobs, count, error } = await (supabase as any)
    .from("cuentas_cobranza")
    .select(
      "id, id_oferta, id_propiedad, fecha_compra, precio_final, porcentaje_comision_venta",
      { count: "exact" }
    )
    .eq("activo", true)
    .eq("es_pagada_comision_venta", false)
    .eq("es_draft_factura_comision", false)
    .not("url_factura_comision", "is", null)
    .not("fecha_compra", "is", null)
    .order("fecha_compra", { ascending: sortDir === "asc" })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  const rows = (cobs || []) as Array<any>;
  if (rows.length === 0) return { items: [], total_count: count ?? 0 };

  // Enrich: propiedad+proyecto via helper
  const propIds = Array.from(new Set(rows.map((r) => r.id_propiedad).filter(Boolean)));
  const { propMap, proyectoByProp } = await loadProyectosByPropiedades(propIds);

  // Propiedades extra: estatus_disponibilidad + entidad relacionada dueña + modelo
  const { data: propsExtra } = propIds.length
    ? ((await (supabase as any)
        .from("propiedades")
        .select(
          "id, id_estatus_disponibilidad, id_entidad_relacionada_dueno, id_edificio_modelo"
        )
        .in("id", propIds)) as any)
    : { data: [] };
  const propExtraById = new Map<number, any>(
    (propsExtra || []).map((p: any) => [p.id, p])
  );

  const estatusIds = Array.from(
    new Set((propsExtra || []).map((p: any) => p.id_estatus_disponibilidad).filter(Boolean))
  );
  const { data: estatusDisp } = estatusIds.length
    ? ((await (supabase as any)
        .from("estatus_disponibilidad")
        .select("id, nombre")
        .in("id", estatusIds)) as any)
    : { data: [] };
  const estatusById = new Map<number, string>(
    (estatusDisp || []).map((e: any) => [e.id, e.nombre as string])
  );

  // edificios_modelos.id → modelos.nombre
  const emIds = Array.from(
    new Set((propsExtra || []).map((p: any) => p.id_edificio_modelo).filter(Boolean))
  );
  const { data: ems } = emIds.length
    ? ((await (supabase as any)
        .from("edificios_modelos")
        .select("id, id_modelo")
        .in("id", emIds)) as any)
    : { data: [] };
  const modeloIdByEm = new Map<number, number | null>(
    (ems || []).map((e: any) => [e.id, e.id_modelo])
  );
  const modeloIds = Array.from(
    new Set((ems || []).map((e: any) => e.id_modelo).filter(Boolean))
  );
  const { data: modelos } = modeloIds.length
    ? ((await (supabase as any)
        .from("modelos")
        .select("id, nombre")
        .in("id", modeloIds)) as any)
    : { data: [] };
  const modeloNameById = new Map<number, string>(
    (modelos || []).map((m: any) => [m.id, m.nombre as string])
  );

  // Entidades relacionadas → persona dueña
  const entIds = Array.from(
    new Set(
      (propsExtra || [])
        .map((p: any) => p.id_entidad_relacionada_dueno)
        .filter(Boolean)
    )
  );
  const { data: ents } = entIds.length
    ? ((await (supabase as any)
        .from("entidades_relacionadas")
        .select("id, id_persona")
        .in("id", entIds)) as any)
    : { data: [] };
  const personaDuenaIdByEnt = new Map<number, number | null>(
    (ents || []).map((e: any) => [e.id, e.id_persona])
  );

  // Ofertas → comprador (id_persona_lead) + id_producto
  const ofertaIds = Array.from(new Set(rows.map((r) => r.id_oferta).filter(Boolean)));
  const { data: ofs } = ofertaIds.length
    ? ((await (supabase as any)
        .from("ofertas")
        .select("id, id_persona_lead, id_producto")
        .in("id", ofertaIds)) as any)
    : { data: [] };
  const ofertaById = new Map<number, any>((ofs || []).map((o: any) => [o.id, o]));

  // Productos + categorias para determinar tipo
  const productoIds = Array.from(
    new Set((ofs || []).map((o: any) => o.id_producto).filter(Boolean))
  );
  const { data: prodsRaw } = productoIds.length
    ? ((await (supabase as any)
        .from("productos_servicios")
        .select("id, nombre, id_categoria")
        .in("id", productoIds)) as any)
    : { data: [] };
  const catIds = Array.from(
    new Set((prodsRaw || []).map((p: any) => p.id_categoria).filter(Boolean))
  );
  const { data: cats } = catIds.length
    ? ((await (supabase as any)
        .from("categorias_producto")
        .select("id, nombre")
        .in("id", catIds)) as any)
    : { data: [] };
  const catNameById = new Map<number, string>(
    (cats || []).map((c: any) => [c.id, c.nombre as string])
  );
  const productoById = new Map<number, { nombre: string; categoria: string | null }>(
    (prodsRaw || []).map((p: any) => [
      p.id,
      { nombre: p.nombre, categoria: catNameById.get(p.id_categoria) ?? null },
    ])
  );

  // Personas para comprador (lead) + dueño
  const personaIds = Array.from(
    new Set(
      [
        ...(ofs || []).map((o: any) => o.id_persona_lead).filter(Boolean),
        ...Array.from(personaDuenaIdByEnt.values()).filter(Boolean),
      ] as number[]
    )
  );
  const { data: pers } = personaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal, rfc")
        .in("id", personaIds)) as any)
    : { data: [] };
  const personaById = new Map<number, any>((pers || []).map((p: any) => [p.id, p]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items: ValidacionVentaFacturar[] = rows
    .filter((c) => {
      // Sólo cuentas cuya propiedad esté en estatus Vendido (id=5)
      const propExtra = c.id_propiedad ? propExtraById.get(c.id_propiedad) : null;
      return propExtra?.id_estatus_disponibilidad === 5;
    })
    .map((c) => {
    const prop = c.id_propiedad ? propMap.get(c.id_propiedad) : null;
    const propExtra = c.id_propiedad ? propExtraById.get(c.id_propiedad) : null;
    const proyecto = c.id_propiedad ? proyectoByProp.get(c.id_propiedad) : undefined;
    const oferta = c.id_oferta ? ofertaById.get(c.id_oferta) : null;
    const persona = oferta?.id_persona_lead
      ? personaById.get(oferta.id_persona_lead)
      : null;
    const producto = oferta?.id_producto
      ? productoById.get(oferta.id_producto)
      : null;
    const tipoTransaccion: ValidacionVentaFacturar["tipo_transaccion"] = oferta?.id_producto
      ? producto?.categoria?.toLowerCase() === "servicios"
        ? "Servicio"
        : "Producto"
      : "Propiedad";
    const modeloId = propExtra?.id_edificio_modelo
      ? modeloIdByEm.get(propExtra.id_edificio_modelo)
      : null;
    const modeloNombre = modeloId ? modeloNameById.get(modeloId) ?? null : null;
    const personaDuenaId = propExtra?.id_entidad_relacionada_dueno
      ? personaDuenaIdByEnt.get(propExtra.id_entidad_relacionada_dueno)
      : null;
    const personaDuena = personaDuenaId ? personaById.get(personaDuenaId) : null;
    const estatusNombre = propExtra?.id_estatus_disponibilidad
      ? estatusById.get(propExtra.id_estatus_disponibilidad) ?? "—"
      : "—";
    const fechaCompra = c.fecha_compra ? new Date(c.fecha_compra) : null;
    if (fechaCompra) fechaCompra.setHours(0, 0, 0, 0);
    const dias = fechaCompra
      ? Math.floor((today.getTime() - fechaCompra.getTime()) / 86400000)
      : 0;
    const precio = Number(c.precio_final ?? 0);
    const pct = Number(c.porcentaje_comision_venta ?? 0);
    return {
      id_cuenta_cobranza: c.id,
      folio_cuenta: `COB-${String(c.id).padStart(4, "0")}`,
      tipo_transaccion: tipoTransaccion,
      proyecto: proyecto || "Sin proyecto",
      modelo: modeloNombre,
      producto: producto?.nombre ?? null,
      numero_propiedad: prop?.numero_propiedad || "—",
      entidad_duena: personaDuena?.nombre_legal ?? null,
      comprador_principal: persona?.nombre_legal || "Sin comprador registrado",
      rfc_comprador: persona?.rfc || "—",
      precio_final: precio,
      monto_factura_desarrollador: (precio * pct) / 100,
      fecha_venta: fechaCompra ? fechaCompra.toISOString().slice(0, 10) : "",
      dias_esperando: dias,
      estatus: estatusNombre,
    };
  });

  return { items, total_count: count ?? items.length };
}

/* ──────────────────────────────────────────────────────────
   "Comisionistas pendientes" — universo común para
   "Pagos a Externos" y "Comisiones Internas".

   Carga TODOS los comisionistas activos+aprobados+no-pagados
   (volumen pequeño en dev: ~decenas, en prod podría crecer)
   y los enriquece con clasificación interno/externo.

   Criterio del spec del user:
   - EXTERNO  = email NO existe en usuarios, O existe pero
     roles.es_rol_interno = false
   - INTERNO  = email existe en usuarios Y roles.es_rol_interno
     = true
   ────────────────────────────────────────────────────────── */

type ComisionistaEnriched = {
  id_cuenta_cobranza: number;
  email_usuario: string;
  porcentaje_comision: number;
  fecha_devengo: string;
  fecha_actualizacion: string;
  // Cuenta
  precio_final: number;
  fecha_compra: string | null;
  es_pagada_comision_venta: boolean;
  proyecto: string;
  numero_propiedad: string;
  // Usuario (puede ser null si no está en usuarios)
  nombre_usuario: string | null;
  nombre_legal: string | null;
  rfc: string | null;
  rol_nombre: string | null;
  rol_id: number | null;
  // Persona (si el email es una inmobiliaria como persona moral)
  es_inmobiliaria_pm: boolean;
  // Derivados
  monto: number;
  dias_desde_devengo: number;
  dias_desde_aprobacion: number;
  es_externo: boolean;
};

async function fetchComisionistasPendientes(): Promise<ComisionistaEnriched[]> {
  // 1) Comisionistas activos+aprobados+no-pagados
  const { data: coms, error } = await (supabase as any)
    .from("comisionistas")
    .select(
      "id_cuenta_cobranza, email_usuario, porcentaje_comision, fecha_creacion, fecha_actualizacion"
    )
    .eq("activo", true)
    .eq("aprobada", true)
    .eq("pagada", false)
    .limit(5000);
  if (error) throw error;
  const comisRows = (coms || []) as Array<any>;
  if (comisRows.length === 0) return [];

  // 2) cuentas_cobranza por id (todas las cuentas referenciadas)
  const ccIds = Array.from(new Set(comisRows.map((r) => r.id_cuenta_cobranza).filter(Boolean)));
  const { data: ccs } = ccIds.length
    ? ((await (supabase as any)
        .from("cuentas_cobranza")
        .select(
          "id, precio_final, id_propiedad, fecha_compra, es_pagada_comision_venta"
        )
        .in("id", ccIds)) as any)
    : { data: [] };
  const ccById = new Map<number, any>((ccs || []).map((c: any) => [c.id, c]));

  // 3) propiedad + proyecto
  const propIds = Array.from(
    new Set((ccs || []).map((c: any) => c.id_propiedad).filter(Boolean))
  );
  const { propMap, proyectoByProp } = await loadProyectosByPropiedades(propIds);

  // 4) Usuarios + roles + personas por email
  const emails = Array.from(new Set(comisRows.map((r) => r.email_usuario).filter(Boolean)));
  const { data: usuarios } = emails.length
    ? ((await (supabase as any)
        .from("usuarios")
        .select("email, nombre, rol_id, id_persona")
        .in("email", emails)
        .eq("activo", true)) as any)
    : { data: [] };
  const userByEmail = new Map<string, any>((usuarios || []).map((u: any) => [u.email, u]));

  const rolIds = Array.from(new Set((usuarios || []).map((u: any) => u.rol_id).filter(Boolean)));
  const { data: roles } = rolIds.length
    ? ((await (supabase as any)
        .from("roles")
        .select("id, nombre")
        .in("id", rolIds)) as any)
    : { data: [] };
  const rolById = new Map<number, any>((roles || []).map((r: any) => [r.id, r]));

  // 4a) Personas vinculadas vía usuarios.id_persona (nombre/rfc del beneficiario)
  const personaIds = Array.from(
    new Set((usuarios || []).map((u: any) => u.id_persona).filter(Boolean))
  );
  const { data: persPorId } = personaIds.length
    ? ((await (supabase as any)
        .from("personas")
        .select("id, nombre_legal, rfc")
        .in("id", personaIds)) as any)
    : { data: [] };
  const personaById = new Map<number, any>((persPorId || []).map((p: any) => [p.id, p]));

  // 4b) Personas por EMAIL del comisionista — para detectar inmobiliarias
  //     que están registradas como persona moral pero no necesariamente
  //     como usuario. Este es el criterio principal de "externo" del admin.
  const { data: persPorEmail } = emails.length
    ? ((await (supabase as any)
        .from("personas")
        .select("email, nombre_legal, rfc, tipo_persona")
        .in("email", emails)
        .eq("activo", true)) as any)
    : { data: [] };
  const personaByEmail = new Map<string, any>(
    (persPorEmail || []).map((p: any) => [p.email, p])
  );

  // 5) Enriquecer + clasificar
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const enriched: ComisionistaEnriched[] = comisRows.map((c) => {
    const cc = ccById.get(c.id_cuenta_cobranza);
    const prop = cc?.id_propiedad ? propMap.get(cc.id_propiedad) : null;
    const proyecto = cc?.id_propiedad ? proyectoByProp.get(cc.id_propiedad) : undefined;
    const usuario = userByEmail.get(c.email_usuario) || null;
    const rol = usuario?.rol_id ? rolById.get(usuario.rol_id) : null;
    const personaPorUser = usuario?.id_persona ? personaById.get(usuario.id_persona) : null;
    const personaPorEmail = personaByEmail.get(c.email_usuario) || null;
    const esInmobiliariaPm = personaPorEmail?.tipo_persona === "pm";
    const esAgenteInmobiliarioExterno =
      usuario?.rol_id === AGENTE_INMOBILIARIO_ROL_ID &&
      !esEmailDelGrupoInterno(c.email_usuario);
    const esExterno = esInmobiliariaPm || esAgenteInmobiliarioExterno;
    const precio = Number(cc?.precio_final ?? 0);
    const pct = Number(c.porcentaje_comision ?? 0);
    const fechaDev = c.fecha_creacion ? new Date(c.fecha_creacion) : null;
    const fechaAprob = c.fecha_actualizacion ? new Date(c.fecha_actualizacion) : null;
    if (fechaDev) fechaDev.setHours(0, 0, 0, 0);
    if (fechaAprob) fechaAprob.setHours(0, 0, 0, 0);
    const diasDev = fechaDev
      ? Math.floor((today.getTime() - fechaDev.getTime()) / 86400000)
      : 0;
    const diasAprob = fechaAprob
      ? Math.floor((today.getTime() - fechaAprob.getTime()) / 86400000)
      : 0;
    return {
      id_cuenta_cobranza: c.id_cuenta_cobranza,
      email_usuario: c.email_usuario,
      porcentaje_comision: pct,
      fecha_devengo: c.fecha_creacion,
      fecha_actualizacion: c.fecha_actualizacion,
      precio_final: precio,
      fecha_compra: cc?.fecha_compra ?? null,
      es_pagada_comision_venta: !!cc?.es_pagada_comision_venta,
      proyecto: proyecto || "Sin proyecto",
      numero_propiedad: prop?.numero_propiedad || "—",
      nombre_usuario: usuario?.nombre ?? null,
      nombre_legal: personaPorEmail?.nombre_legal ?? personaPorUser?.nombre_legal ?? null,
      rfc: personaPorEmail?.rfc ?? personaPorUser?.rfc ?? null,
      rol_nombre: rol?.nombre ?? null,
      rol_id: usuario?.rol_id ?? null,
      es_inmobiliaria_pm: esInmobiliariaPm,
      monto: (precio * pct) / 100,
      dias_desde_devengo: diasDev,
      dias_desde_aprobacion: diasAprob,
      es_externo: esExterno,
    };
  });

  return enriched;
}

/* ──────────────────────────────────────────────────────────
   Clasificación de tipo (Externo) — derivado del nombre del rol
   ────────────────────────────────────────────────────────── */

function clasificarTipoExterno(
  c: ComisionistaEnriched
): "inmobiliaria" | "broker" | "aliado_comercial" | "agente_externo" {
  if (c.es_inmobiliaria_pm) return "inmobiliaria";
  const lower = (c.rol_nombre || "").toLowerCase();
  if (lower.includes("broker")) return "broker";
  if (lower.includes("aliado")) return "aliado_comercial";
  if (c.rol_id === AGENTE_INMOBILIARIO_ROL_ID) return "agente_externo";
  return "agente_externo";
}

/* PAGOS_EXTERNOS y COMISIONES_INTERNAS se derivan de comisionistas reales
   vía fetchComisionistasPendientes() en el componente. Los mocks fueron
   removidos en esta iteración. */

const EXCEPCIONES: ValidacionExcepcion[] = [
  {
    id_excepcion: 91,
    tipo: "descuento_fuera_politica",
    descripcion_corta: "Descuento 8% solicitado vs política 5% máximo",
    solicitante: "Carlos Mendoza Ávalos",
    venta_referencia: "Daiku A-205",
    monto_impactado: 360000,
    delta: 28800, // 8% sobre 360,000
    dias_esperando: 4, // > 3 → rojo
  },
  {
    id_excepcion: 92,
    tipo: "pago_parcial_fuera_esquema",
    descripcion_corta: "5 parcialidades vs 3 del esquema estándar",
    solicitante: "Inmobiliaria Vértice SA de CV",
    venta_referencia: "Bottura PH-2",
    monto_impactado: 4200000,
    delta: 1680000, // diferencia financiera del nuevo esquema
    dias_esperando: 2,
  },
];

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const DemoBadge = () => (
  <Pill className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
    Datos demo
  </Pill>
);

function Antiguedad({ dias, umbral }: { dias: number; umbral: number }) {
  const danger = dias > umbral;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        danger ? "text-red-600 font-semibold dark:text-red-400" : "text-muted-foreground"
      )}
      title={danger ? `Supera el umbral de ${umbral} días` : undefined}
    >
      <Clock className="h-3 w-3" />
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}

const TIPO_EXTERNO_LABEL: Record<ValidacionPagoExterno["agente_tipo"], string> = {
  inmobiliaria: "Inmobiliaria",
  broker: "Broker",
  aliado_comercial: "Aliado comercial",
  agente_externo: "Agente externo",
};

const TIPO_EXCEPCION_LABEL: Record<ValidacionExcepcion["tipo"], string> = {
  descuento_fuera_politica: "Descuento fuera de política",
  pago_parcial_fuera_esquema: "Pago parcial fuera de esquema",
  ajuste_manual: "Ajuste manual",
  otro: "Otro",
};

/* ──────────────────────────────────────────────────────────
   KPI card (clickeable, scrollea a sección)
   ────────────────────────────────────────────────────────── */

function KpiCard({
  label,
  count,
  amountLabel,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  amountLabel: string;
  icon: typeof Receipt;
  tone: "emerald" | "amber" | "blue" | "rose";
  onClick: () => void;
}) {
  const toneClasses: Record<typeof tone, { bg: string; ring: string; iconBg: string; iconText: string }> = {
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      ring: "ring-emerald-200 dark:ring-emerald-900/40 hover:ring-emerald-300",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
      iconText: "text-emerald-700 dark:text-emerald-300",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      ring: "ring-amber-200 dark:ring-amber-900/40 hover:ring-amber-300",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      iconText: "text-amber-700 dark:text-amber-300",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      ring: "ring-blue-200 dark:ring-blue-900/40 hover:ring-blue-300",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      iconText: "text-blue-700 dark:text-blue-300",
    },
    rose: {
      bg: "bg-rose-50 dark:bg-rose-950/30",
      ring: "ring-rose-200 dark:ring-rose-900/40 hover:ring-rose-300",
      iconBg: "bg-rose-100 dark:bg-rose-900/50",
      iconText: "text-rose-700 dark:text-rose-300",
    },
  };
  const c = toneClasses[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ir a sección ${label}`}
      className={cn(
        "group text-left rounded-xl p-4 ring-1 transition-all duration-150",
        c.bg,
        c.ring,
        "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{count}</p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{amountLabel}</p>
        </div>
        <span className={cn("grid h-10 w-10 place-items-center rounded-lg shrink-0", c.iconBg, c.iconText)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        Ver detalle <ArrowDown className="h-3 w-3" />
      </p>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────
   Sección genérica
   ────────────────────────────────────────────────────────── */

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  count,
  right,
}: {
  icon: typeof Receipt;
  iconColor: string;
  title: string;
  count: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={cn("grid h-8 w-8 place-items-center rounded-lg", iconColor)}>
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <Badge variant="secondary" className="ml-1">
        {count}
      </Badge>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Controles UI compartidos (ordenamiento + paginación)
   ────────────────────────────────────────────────────────── */

function SortToggle({
  value,
  onChange,
}: {
  value: SortDir;
  onChange: (v: SortDir) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortDir)}>
      <SelectTrigger className="h-7 w-[200px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="asc">Más antiguas primero</SelectItem>
        <SelectItem value="desc">Más recientes primero</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PaginationBar({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  loading,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  loading?: boolean;
}) {
  if (totalCount === 0) return null;
  const from = totalCount === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(totalCount, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-end gap-2 mt-3 text-xs">
      <span className="tabular-nums text-muted-foreground mr-2">
        {from}–{to} de {totalCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={page === 0 || loading}
        onClick={() => onPageChange(Math.max(0, page - 1))}
      >
        <ChevronLeft className="h-3.5 w-3.5 mr-1" />
        Anterior
      </Button>
      <span className="tabular-nums text-muted-foreground">
        Página <span className="font-semibold text-foreground">{page + 1}</span> de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2"
        disabled={page >= totalPages - 1 || loading}
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
      >
        Siguiente
        <ChevronRight className="h-3.5 w-3.5 ml-1" />
      </Button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Página
   ────────────────────────────────────────────────────────── */

export default function AltaDireccionBandejaValidacionesPage() {
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  const ventasRef = useRef<HTMLDivElement>(null);
  const externosRef = useRef<HTMLDivElement>(null);
  const internasRef = useRef<HTMLDivElement>(null);
  const excepcionesRef = useRef<HTMLDivElement>(null);

  /* ─── Sort + page state por sección ─── */
  const [sortVentas, setSortVentas] = useState<SortDir>("asc");
  const [pageVentas, setPageVentas] = useState(0);
  const [sortExternos, setSortExternos] = useState<SortDir>("asc");
  const [pageExternos, setPageExternos] = useState(0);
  const [sortInternas, setSortInternas] = useState<SortDir>("asc");
  const [pageInternas, setPageInternas] = useState(0);
  const [sortExcepciones, setSortExcepciones] = useState<SortDir>("asc");
  const [pageExcepciones, setPageExcepciones] = useState(0);

  /* ─── 1. Ventas para Facturar (BD real, paginada en BD) ─── */
  const {
    data: ventasFacturarData,
    isLoading: ventasLoading,
    error: ventasError,
  } = useQuery({
    queryKey: ["bandeja-ventas-para-facturar", pageVentas, sortVentas],
    queryFn: () => fetchVentasParaFacturar(pageVentas, sortVentas),
    staleTime: 60_000,
  });
  const VENTAS_FACTURAR: ValidacionVentaFacturar[] = ventasFacturarData?.items ?? [];
  const ventasGlobalCount = ventasFacturarData?.total_count ?? VENTAS_FACTURAR.length;
  const ventasTotalPages = Math.max(1, Math.ceil(ventasGlobalCount / PAGE_SIZE));

  /* ─── 2 y 3. Comisionistas pendientes (BD real, paginado en cliente) ─── */
  const {
    data: comisionistasPendientes,
    isLoading: comisLoading,
    error: comisError,
  } = useQuery({
    queryKey: ["bandeja-comisionistas-pendientes"],
    queryFn: fetchComisionistasPendientes,
    staleTime: 60_000,
  });

  // Externos: filter + sort + paginate
  const externosAll = useMemo(
    () => (comisionistasPendientes ?? []).filter((c) => c.es_externo),
    [comisionistasPendientes]
  );
  const externosSorted = useMemo(() => {
    const sorted = [...externosAll].sort((a, b) => {
      const dir = sortExternos === "asc" ? 1 : -1;
      return (new Date(a.fecha_devengo).getTime() - new Date(b.fecha_devengo).getTime()) * dir;
    });
    return sorted;
  }, [externosAll, sortExternos]);
  const externosTotalPages = Math.max(1, Math.ceil(externosSorted.length / PAGE_SIZE));
  const PAGOS_EXTERNOS: ValidacionPagoExterno[] = useMemo(() => {
    const offset = pageExternos * PAGE_SIZE;
    return externosSorted.slice(offset, offset + PAGE_SIZE).map<ValidacionPagoExterno>((c) => ({
      id_factura: c.id_cuenta_cobranza,
      folio_factura: `COB-${String(c.id_cuenta_cobranza).padStart(4, "0")} · ${c.email_usuario}`,
      agente_nombre: c.nombre_legal || c.nombre_usuario || c.email_usuario,
      agente_tipo: clasificarTipoExterno(c),
      venta_referencia: `COB-${String(c.id_cuenta_cobranza).padStart(4, "0")} · ${c.proyecto}`,
      monto: c.monto,
      fecha_emision_factura: c.fecha_devengo?.slice(0, 10) ?? "",
      dias_esperando: c.dias_desde_devengo,
      ya_se_cobro_al_desarrollador: c.es_pagada_comision_venta,
    }));
  }, [externosSorted, pageExternos]);

  // Internas: filter + sort + paginate
  const internasAll = useMemo(
    () => (comisionistasPendientes ?? []).filter((c) => !c.es_externo),
    [comisionistasPendientes]
  );
  const internasSorted = useMemo(() => {
    const sorted = [...internasAll].sort((a, b) => {
      const dir = sortInternas === "asc" ? 1 : -1;
      return (
        (new Date(a.fecha_actualizacion).getTime() -
          new Date(b.fecha_actualizacion).getTime()) *
        dir
      );
    });
    return sorted;
  }, [internasAll, sortInternas]);
  const internasTotalPages = Math.max(1, Math.ceil(internasSorted.length / PAGE_SIZE));
  const COMISIONES_INTERNAS: ValidacionComisionInterna[] = useMemo(() => {
    const offset = pageInternas * PAGE_SIZE;
    return internasSorted
      .slice(offset, offset + PAGE_SIZE)
      .map<ValidacionComisionInterna>((c, idx) => ({
        id_comisionista: c.id_cuenta_cobranza * 1000 + idx,
        folio_comision: `COM-${String(c.id_cuenta_cobranza).padStart(4, "0")}-${c.email_usuario
          .split("@")[0]
          .slice(0, 6)}`,
        comisionista_nombre: c.nombre_legal || c.nombre_usuario || c.email_usuario,
        comisionista_rol: c.rol_nombre || "Sin rol",
        venta_referencia: `COB-${String(c.id_cuenta_cobranza).padStart(4, "0")} · ${c.proyecto}`,
        porcentaje_comision: c.porcentaje_comision,
        monto: c.monto,
        dias_esperando: c.dias_desde_aprobacion,
      }));
  }, [internasSorted, pageInternas]);

  /* ─── 4. Excepciones — mock paginado y ordenado en cliente ─── */
  const excepcionesSorted = useMemo(() => {
    const arr = [...EXCEPCIONES].sort((a, b) => {
      const dir = sortExcepciones === "asc" ? -1 : 1; // asc = más antiguas primero (mayor dias_esperando)
      return (a.dias_esperando - b.dias_esperando) * dir;
    });
    return arr;
  }, [sortExcepciones]);
  const excepcionesTotalPages = Math.max(1, Math.ceil(excepcionesSorted.length / PAGE_SIZE));
  const EXCEPCIONES_PAGE = useMemo(() => {
    const offset = pageExcepciones * PAGE_SIZE;
    return excepcionesSorted.slice(offset, offset + PAGE_SIZE);
  }, [excepcionesSorted, pageExcepciones]);

  const totales = useMemo(
    () => ({
      ventas: VENTAS_FACTURAR.reduce((s, v) => s + v.monto_factura_desarrollador, 0),
      externos: externosAll.reduce((s, c) => s + c.monto, 0),
      internas: internasAll.reduce((s, c) => s + c.monto, 0),
    }),
    [VENTAS_FACTURAR, externosAll, internasAll]
  );

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader
        title="Bandeja de Validaciones"
        description="Pendientes de decisión — Dirección General"
        action={<DemoBadge />}
      />

      {/* ─── Resumen ejecutivo ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard
          label="Comisión SOZU"
          count={ventasGlobalCount}
          amountLabel={
            ventasLoading
              ? "Cargando…"
              : ventasGlobalCount > VENTAS_FACTURAR.length
                ? `${fmtMxn(totales.ventas)} (top ${VENTAS_FACTURAR.length} más antiguas)`
                : fmtMxn(totales.ventas)
          }
          icon={Receipt}
          tone="emerald"
          onClick={() => scrollTo(ventasRef)}
        />
        <KpiCard
          label="Pagos a externos"
          count={externosAll.length}
          amountLabel={
            comisLoading
              ? "Cargando…"
              : externosAll.length === 0
                ? "—"
                : fmtMxn(totales.externos)
          }
          icon={CreditCard}
          tone="amber"
          onClick={() => scrollTo(externosRef)}
        />
        <KpiCard
          label="Comisiones internas"
          count={internasAll.length}
          amountLabel={
            comisLoading
              ? "Cargando…"
              : internasAll.length === 0
                ? "—"
                : fmtMxn(totales.internas)
          }
          icon={Users}
          tone="blue"
          onClick={() => scrollTo(internasRef)}
        />
        <KpiCard
          label="Excepciones"
          count={EXCEPCIONES.length}
          amountLabel="Requieren VoBo"
          icon={AlertTriangle}
          tone="rose"
          onClick={() => scrollTo(excepcionesRef)}
        />
      </div>

      {/* ─── 1. Comisión SOZU (BD real, paginada en BD) ─── */}
      <section ref={ventasRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={Receipt}
          iconColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
          title="Comisión SOZU"
          count={ventasGlobalCount}
          right={
            <SortToggle
              value={sortVentas}
              onChange={(v) => {
                setSortVentas(v);
                setPageVentas(0);
              }}
            />
          }
        />
        <Card>
          <CardContent className="p-0">
            {ventasLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Cargando ventas pendientes de facturar…
              </div>
            ) : ventasError ? (
              <div className="py-10 text-center text-sm text-red-600">
                Error al cargar: {(ventasError as Error).message}
              </div>
            ) : VENTAS_FACTURAR.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No hay ventas pendientes de facturar al desarrollador.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cuenta</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Proyecto</TableHead>
                      <TableHead className="text-xs">Modelo</TableHead>
                      <TableHead className="text-xs">Producto</TableHead>
                      <TableHead className="text-xs">No. Depa</TableHead>
                      <TableHead className="text-xs">Entidad Dueña</TableHead>
                      <TableHead className="text-xs">Comprador</TableHead>
                      <TableHead className="text-xs text-right">Precio final</TableHead>
                      <TableHead className="text-xs text-right">Monto factura</TableHead>
                      <TableHead className="text-xs">Fecha · Antigüedad</TableHead>
                      <TableHead className="text-xs">Estatus</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {VENTAS_FACTURAR.map((v) => (
                      <TableRow key={v.id_cuenta_cobranza}>
                        <TableCell className="text-sm whitespace-nowrap">
                          <div className="font-medium">{v.folio_cuenta}</div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            #{v.id_cuenta_cobranza}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {v.tipo_transaccion}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{v.proyecto}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.modelo || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.producto || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{v.numero_propiedad}</TableCell>
                        <TableCell className="text-xs">
                          {v.entidad_duena || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{v.comprador_principal}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {v.rfc_comprador}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                          {fmtMxn(v.precio_final)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold tabular-nums">
                          {fmtMxn(v.monto_factura_desarrollador)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-xs text-muted-foreground">{v.fecha_venta}</div>
                          <Antiguedad dias={v.dias_esperando} umbral={7} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {v.estatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setSelected({ tipo: "venta", data: v })}
                            aria-label={`Revisar venta para facturar ${v.folio_cuenta}`}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <PaginationBar
          page={pageVentas}
          totalPages={ventasTotalPages}
          totalCount={ventasGlobalCount}
          pageSize={PAGE_SIZE}
          onPageChange={setPageVentas}
          loading={ventasLoading}
        />
      </section>

      {/* ─── 2. Pagos a externos (BD real) ─── */}
      <section ref={externosRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={CreditCard}
          iconColor="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          title="Pagos a externos"
          count={externosAll.length}
          right={
            <SortToggle
              value={sortExternos}
              onChange={(v) => {
                setSortExternos(v);
                setPageExternos(0);
              }}
            />
          }
        />
        <Card>
          <CardContent className="p-0">
            {comisLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Cargando pagos a externos…
              </div>
            ) : comisError ? (
              <div className="py-10 text-center text-sm text-red-600">
                Error al cargar: {(comisError as Error).message}
              </div>
            ) : externosAll.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No hay pagos a externos pendientes.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Folio</TableHead>
                    <TableHead className="text-xs">Beneficiario</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Venta</TableHead>
                    <TableHead className="text-xs text-right">Monto</TableHead>
                    <TableHead className="text-xs">Emisión</TableHead>
                    <TableHead className="text-xs">Antigüedad</TableHead>
                    <TableHead className="text-xs">Flag cobro</TableHead>
                    <TableHead className="text-xs text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PAGOS_EXTERNOS.map((p) => (
                    <TableRow
                      key={`${p.id_factura}-${p.folio_factura}`}
                      className={cn(!p.ya_se_cobro_al_desarrollador && "bg-amber-50/50 dark:bg-amber-950/20")}
                    >
                      <TableCell className="font-medium text-xs font-mono">
                        {p.folio_factura}
                      </TableCell>
                      <TableCell className="text-sm">{p.agente_nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {TIPO_EXTERNO_LABEL[p.agente_tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.venta_referencia}</TableCell>
                      <TableCell className="text-sm text-right font-semibold tabular-nums">{fmtMxn(p.monto)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.fecha_emision_factura}</TableCell>
                      <TableCell>
                        <Antiguedad dias={p.dias_esperando} umbral={7} />
                      </TableCell>
                      <TableCell>
                        {p.ya_se_cobro_al_desarrollador ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                          >
                            Cobrado
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                            title="No pagar antes de cobrar al desarrollador"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Pendiente cobrar al desarrollador
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setSelected({ tipo: "externo", data: p })}
                          aria-label={`Revisar pago externo ${p.folio_factura}`}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <PaginationBar
          page={pageExternos}
          totalPages={externosTotalPages}
          totalCount={externosAll.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPageExternos}
          loading={comisLoading}
        />
      </section>

      {/* ─── 3. Comisiones internas (BD real) ─── */}
      <section ref={internasRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={Users}
          iconColor="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          title="Comisiones internas"
          count={internasAll.length}
          right={
            <SortToggle
              value={sortInternas}
              onChange={(v) => {
                setSortInternas(v);
                setPageInternas(0);
              }}
            />
          }
        />
        <Card>
          <CardContent className="p-0">
            {comisLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Cargando comisiones internas…
              </div>
            ) : comisError ? (
              <div className="py-10 text-center text-sm text-red-600">
                Error al cargar: {(comisError as Error).message}
              </div>
            ) : internasAll.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No hay comisiones internas pendientes de autorización.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Folio</TableHead>
                    <TableHead className="text-xs">Comisionista</TableHead>
                    <TableHead className="text-xs">Rol</TableHead>
                    <TableHead className="text-xs">Venta</TableHead>
                    <TableHead className="text-xs text-right">%</TableHead>
                    <TableHead className="text-xs text-right">Monto</TableHead>
                    <TableHead className="text-xs">Antigüedad</TableHead>
                    <TableHead className="text-xs text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMISIONES_INTERNAS.map((c) => (
                    <TableRow key={c.id_comisionista}>
                      <TableCell className="font-medium text-xs font-mono">
                        {c.folio_comision}
                      </TableCell>
                      <TableCell className="text-sm">{c.comisionista_nombre}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.comisionista_rol}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.venta_referencia}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{c.porcentaje_comision.toFixed(2)}%</TableCell>
                      <TableCell className="text-sm text-right font-semibold tabular-nums">{fmtMxn(c.monto)}</TableCell>
                      <TableCell>
                        <Antiguedad dias={c.dias_esperando} umbral={5} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setSelected({ tipo: "interna", data: c })}
                          aria-label={`Revisar comisión interna ${c.folio_comision}`}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <PaginationBar
          page={pageInternas}
          totalPages={internasTotalPages}
          totalCount={internasAll.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPageInternas}
          loading={comisLoading}
        />
      </section>

      {/* ─── 4. Excepciones (mock, hasta materializar tabla excepciones_solicitadas) ─── */}
      <section ref={excepcionesRef} className="mb-8" style={{ scrollMarginTop: 72 }}>
        <SectionHeader
          icon={AlertTriangle}
          iconColor="bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
          title="Excepciones"
          count={EXCEPCIONES.length}
          right={
            <SortToggle
              value={sortExcepciones}
              onChange={(v) => {
                setSortExcepciones(v);
                setPageExcepciones(0);
              }}
            />
          }
        />
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/40 p-3">
          <Info className="h-4 w-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            <span className="font-semibold">Sección en datos demo.</span> La conexión con BD
            real se habilita cuando se materialice la tabla{" "}
            <code className="font-mono">excepciones_solicitadas</code> (o se confirme la
            semántica de <code className="font-mono">ofertas.id_estatus_aprobacion</code> +{" "}
            <code className="font-mono">comentario_justificacion</code> como modelo de excepción).
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Descripción</TableHead>
                  <TableHead className="text-xs">Solicitante</TableHead>
                  <TableHead className="text-xs">Venta</TableHead>
                  <TableHead className="text-xs text-right">Monto impactado</TableHead>
                  <TableHead className="text-xs text-right">Delta solicitado</TableHead>
                  <TableHead className="text-xs">Antigüedad</TableHead>
                  <TableHead className="text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EXCEPCIONES_PAGE.map((e) => (
                  <TableRow key={e.id_excepcion}>
                    <TableCell className="font-medium text-sm">#{e.id_excepcion}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {TIPO_EXCEPCION_LABEL[e.tipo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[260px]">{e.descripcion_corta}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.solicitante}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.venta_referencia}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                      {fmtMxn(e.monto_impactado)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                      {fmtMxn(e.delta)}
                    </TableCell>
                    <TableCell>
                      <Antiguedad dias={e.dias_esperando} umbral={3} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setSelected({ tipo: "excepcion", data: e })}
                        aria-label={`Revisar excepción #${e.id_excepcion}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <PaginationBar
          page={pageExcepciones}
          totalPages={excepcionesTotalPages}
          totalCount={EXCEPCIONES.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPageExcepciones}
        />
      </section>

      {/* ─── Drawer unificado del Portal Alta Dirección ─── */}
      {selected && (() => {
        const close = () => setSelected(null);
        const open = !!selected;
        const onOpenChange = (o: boolean) => { if (!o) close(); };

        if (selected.tipo === "venta") {
          const v = selected.data;
          const vctx = getVentaContext(v.folio_cuenta);
          return (
            <ExpedienteDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="venta_para_facturar"
              entityId={v.folio_cuenta}
              ventaContext={vctx}
            >
              <VentaParaFacturarContent
                entity={{
                  folio_cuenta: v.folio_cuenta,
                  fecha_venta: v.fecha_venta,
                  dias_esperando: v.dias_esperando,
                  monto_factura_desarrollador: v.monto_factura_desarrollador,
                  comprador_principal: v.comprador_principal,
                  rfc_comprador: v.rfc_comprador,
                  desarrollador_nombre: v.proyecto === "Daiku"
                    ? "Grupo Daiku Desarrollos SA de CV"
                    : v.proyecto === "Bottura"
                      ? "Grupo Bottura SA de CV"
                      : "Constructora Monócolo SA de CV",
                }}
                ventaContext={vctx}
                onClose={close}
              />
            </ExpedienteDrawer>
          );
        }

        if (selected.tipo === "externo") {
          const p = selected.data;
          const cob = resolveCobFolio(p.venta_referencia);
          const vctx = getVentaContext(cob);
          return (
            <ExpedienteDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="pago_externo"
              entityId={p.folio_factura}
              ventaContext={vctx}
            >
              <PagoExternoContent
                entity={{
                  folio_cfdi: p.folio_factura,
                  beneficiario_nombre: p.agente_nombre,
                  beneficiario_tipo: p.agente_tipo,
                  monto: p.monto,
                  fecha_emision: p.fecha_emision_factura,
                  dias_desde_emision: p.dias_esperando,
                  ya_se_cobro_al_desarrollador: p.ya_se_cobro_al_desarrollador,
                }}
                ventaContext={vctx}
                onClose={close}
              />
            </ExpedienteDrawer>
          );
        }

        if (selected.tipo === "interna") {
          const c = selected.data;
          const cob = resolveCobFolio(c.venta_referencia);
          const vctx = getVentaContext(cob);
          return (
            <ExpedienteDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="comision_interna"
              entityId={c.folio_comision}
              ventaContext={vctx}
            >
              <ComisionInternaContent
                entity={{
                  folio: c.folio_comision,
                  comisionista_nombre: c.comisionista_nombre,
                  comisionista_rol: c.comisionista_rol,
                  porcentaje_comision: c.porcentaje_comision,
                  monto: c.monto,
                  dias_esperando_director: c.dias_esperando,
                  estado: "aprobada",
                }}
                ventaContext={vctx}
                onClose={close}
              />
            </ExpedienteDrawer>
          );
        }

        if (selected.tipo === "excepcion") {
          const e = selected.data;
          const cob = resolveCobFolio(e.venta_referencia);
          const vctx = getVentaContext(cob);
          return (
            <ExpedienteDrawer
              open={open}
              onOpenChange={onOpenChange}
              entityType="excepcion"
              entityId={`#${e.id_excepcion}`}
              ventaContext={vctx}
            >
              <ExcepcionContent
                entity={{
                  id_excepcion: e.id_excepcion,
                  tipo: e.tipo,
                  descripcion_corta: e.descripcion_corta,
                  solicitante: e.solicitante,
                  monto_impactado: e.monto_impactado,
                  delta: e.delta,
                }}
                ventaContext={vctx}
                onClose={close}
              />
            </ExpedienteDrawer>
          );
        }

        return null;
      })()}
    </>
  );
}
