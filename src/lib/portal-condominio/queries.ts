// Capa de datos del Portal Condominio.
// Resuelve, vía waterfall explícito (regla CLAUDE.md §1), la estructura de
// mantenimiento de un proyecto entregado a partir de su id.
//
// Cadena real (confirmada en BD dev):
//   proyecto -> edificios -> edificios_modelos -> propiedades
//   propiedades -> cuentas_cobranza (venta/padre) -> cuentas_cobranza hijas (mantenimiento)
//   cuenta mantenimiento -> acuerdos_pago (id_concepto = 11, calendario mensual)
//                        -> pagos / aplicaciones_pago / multas
//
// Las cuentas de mantenimiento tienen id_propiedad = NULL y se enlazan a la
// propiedad mediante id_cuenta_cobranza_padre.

import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import {
  formatCuentaCobranzaId,
  formatCuentaMantenimientoId,
} from "@/utils/cuentaCobranzaUtils";
import { fechaISO, hoyISO, etiquetaMes } from "./format";
import type {
  AmenidadCondominio,
  AntiguedadBucket,
  BucketAntiguedad,
  CargoCondominio,
  CategoriaCargo,
  CondominioDataset,
  CondominioKPIs,
  CondominioRef,
  EstatusConciliacion,
  MorosoCondominio,
  PagoCondominio,
  TendenciaMes,
  UnidadCondominio,
} from "@/types/condominio";

const CONCEPTO_MANTENIMIENTO = 11;
const CHUNK = 150; // tamaño de lote para filtros .in() (evita URLs demasiado largas)

// Ejecuta un .in() por lotes y pagina cada lote para superar el límite de ~1000 filas.
async function fetchInChunks<T = any>(
  ids: Array<number | string>,
  build: (chunk: Array<number | string>, from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows = await fetchAllRows<T>((from, to) => build(chunk, from, to));
    out.push(...rows);
  }
  return out;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function bucketAntiguedad(dias: number): BucketAntiguedad {
  if (dias > 90) return "90+";
  if (dias > 60) return "61-90";
  if (dias > 30) return "31-60";
  return "1-30";
}

function diasEntre(desdeISO: string, hastaISO: string): number {
  const a = new Date(desdeISO + "T00:00:00Z").getTime();
  const b = new Date(hastaISO + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// --- Tipos internos crudos ---
interface PropRow {
  id: number;
  numero_propiedad: string | null;
  numero_piso: string | null;
  m2_interiores: number | null;
  m2_exteriores: number | null;
  id_tipo_propiedad: number | null;
  id_entidad_relacionada_dueno: number | null;
  rentado_estancia_corta: boolean | null;
  id_edificio_modelo: number | null;
}
interface AcuerdoRow {
  id: number;
  id_cuenta_cobranza: number;
  fecha_pago: string | null;
  monto: number | null;
  pago_completado: boolean | null;
}
interface PagoRow {
  id: number;
  id_cuenta_cobranza: number;
  monto: number | null;
  fecha_pago: string | null;
  clave_rastreo: string | null;
  descripcion: string | null;
  url_recibo: string | null;
  url_cep: string | null;
  id_metodos_pago: number | null;
}

/**
 * Lista de condominios = proyectos que tienen cuentas de mantenimiento.
 * Recorre la cadena en sentido inverso (acuerdos -> cuenta -> padre -> propiedad -> proyecto).
 */
export async function fetchCondominios(): Promise<CondominioRef[]> {
  // 1. Cuentas con acuerdos de mantenimiento
  const acuerdos = await fetchAllRows<{ id_cuenta_cobranza: number }>((from, to) =>
    supabase
      .from("acuerdos_pago")
      .select("id_cuenta_cobranza")
      .eq("id_concepto", CONCEPTO_MANTENIMIENTO)
      .range(from, to),
  );
  const mantCcIds = uniq(acuerdos.map((a) => a.id_cuenta_cobranza).filter(Boolean));
  if (mantCcIds.length === 0) return [];

  // 2. cuenta mantenimiento -> padre
  const mantCuentas = await fetchInChunks<{ id: number; id_cuenta_cobranza_padre: number | null }>(
    mantCcIds,
    (chunk, from, to) =>
      supabase.from("cuentas_cobranza").select("id, id_cuenta_cobranza_padre").in("id", chunk as number[]).range(from, to),
  );
  const padreIds = uniq(mantCuentas.map((c) => c.id_cuenta_cobranza_padre).filter(Boolean) as number[]);
  if (padreIds.length === 0) return [];

  // 3. padre -> propiedad
  const padres = await fetchInChunks<{ id: number; id_propiedad: number | null }>(padreIds, (chunk, from, to) =>
    supabase.from("cuentas_cobranza").select("id, id_propiedad").in("id", chunk as number[]).range(from, to),
  );
  const propIds = uniq(padres.map((p) => p.id_propiedad).filter(Boolean) as number[]);
  if (propIds.length === 0) return [];

  // 4. propiedad -> edificio_modelo
  const props = await fetchInChunks<{ id: number; id_edificio_modelo: number | null }>(propIds, (chunk, from, to) =>
    supabase.from("propiedades").select("id, id_edificio_modelo").in("id", chunk as number[]).range(from, to),
  );
  const emIds = uniq(props.map((p) => p.id_edificio_modelo).filter(Boolean) as number[]);

  // 5. edificio_modelo -> edificio
  const ems = await fetchInChunks<{ id: number; id_edificio: number | null }>(emIds, (chunk, from, to) =>
    supabase.from("edificios_modelos").select("id, id_edificio").in("id", chunk as number[]).range(from, to),
  );
  const edIds = uniq(ems.map((e) => e.id_edificio).filter(Boolean) as number[]);

  // 6. edificio -> proyecto
  const eds = await fetchInChunks<{ id: number; id_proyecto: number | null }>(edIds, (chunk, from, to) =>
    supabase.from("edificios").select("id, id_proyecto").in("id", chunk as number[]).range(from, to),
  );
  const proyectoIds = uniq(eds.map((e) => e.id_proyecto).filter(Boolean) as number[]);
  if (proyectoIds.length === 0) return [];

  // 7. proyectos
  const proyectos = await fetchInChunks<{ id: number; nombre: string | null }>(proyectoIds, (chunk, from, to) =>
    supabase.from("proyectos").select("id, nombre").in("id", chunk as number[]).eq("activo", true).range(from, to),
  );
  return proyectos
    .map((p) => ({ id: p.id, nombre: p.nombre ?? `Proyecto ${p.id}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Dataset completo del condominio (proyecto entregado). Una sola pasada de
 * queries por waterfall; todas las vistas (dashboard, departamentos, cargos,
 * pagos, cobranza, amenidades) se derivan en cliente.
 */
export async function fetchCondominioDataset(proyectoId: number): Promise<CondominioDataset> {
  const hoy = hoyISO();

  // 0. proyecto (nombre)
  const { data: proyectoRow } = await supabase
    .from("proyectos")
    .select("nombre")
    .eq("id", proyectoId)
    .maybeSingle();
  const proyectoNombre = (proyectoRow as any)?.nombre ?? "—";

  // 1. edificios del proyecto
  const { data: edificios, error: edErr } = await supabase
    .from("edificios")
    .select("id, nombre")
    .eq("id_proyecto", proyectoId)
    .eq("activo", true);
  if (edErr) throw edErr;
  const edIds = (edificios ?? []).map((e: any) => e.id);
  if (edIds.length === 0) return datasetVacio();
  const edificioNombre = new Map<number, string>(
    (edificios ?? []).map((e: any) => [e.id as number, (e.nombre ?? "—") as string]),
  );

  // 2. edificios_modelos
  const ems = await fetchInChunks<{ id: number; id_edificio: number | null; id_modelo: number | null }>(
    edIds,
    (chunk, from, to) =>
      supabase
        .from("edificios_modelos")
        .select("id, id_edificio, id_modelo")
        .in("id_edificio", chunk as number[])
        .range(from, to),
  );
  const emIds = ems.map((e) => e.id);
  if (emIds.length === 0) return datasetVacio();
  const emToEdificio = new Map<number, number>();
  const emToModelo = new Map<number, number>();
  for (const e of ems) {
    if (e.id_edificio) emToEdificio.set(e.id, e.id_edificio);
    if (e.id_modelo) emToModelo.set(e.id, e.id_modelo);
  }

  // 2b. modelos (nombre)
  const modeloIds = uniq(Array.from(emToModelo.values()));
  const modelos = modeloIds.length
    ? await fetchInChunks<{ id: number; nombre: string | null }>(modeloIds, (chunk, from, to) =>
        supabase.from("modelos").select("id, nombre").in("id", chunk as number[]).range(from, to),
      )
    : [];
  const modeloNombre = new Map<number, string>(
    modelos.map((m) => [m.id, m.nombre ?? "—"]),
  );

  // 3. propiedades
  const props = await fetchInChunks<PropRow>(emIds, (chunk, from, to) =>
    supabase
      .from("propiedades")
      .select(
        "id, numero_propiedad, numero_piso, m2_interiores, m2_exteriores, id_tipo_propiedad, id_entidad_relacionada_dueno, rentado_estancia_corta, id_edificio_modelo",
      )
      .in("id_edificio_modelo", chunk as number[])
      .eq("activo", true)
      .range(from, to),
  );
  const propIds = props.map((p) => p.id);
  if (propIds.length === 0) return datasetVacio();
  const propById = new Map(props.map((p) => [p.id, p]));

  // 4. tipos de propiedad
  const tipoIds = uniq(props.map((p) => p.id_tipo_propiedad).filter(Boolean) as number[]);
  const tipos = tipoIds.length
    ? await fetchInChunks<{ id: number; nombre: string | null }>(tipoIds, (chunk, from, to) =>
        supabase.from("tipos_propiedad").select("id, nombre").in("id", chunk as number[]).range(from, to),
      )
    : [];
  const tipoById = new Map(tipos.map((t) => [t.id, t.nombre ?? ""]));

  // 5. cuentas padre (venta) por propiedad
  const padres = await fetchInChunks<{ id: number; id_propiedad: number | null }>(propIds, (chunk, from, to) =>
    supabase.from("cuentas_cobranza").select("id, id_propiedad").in("id_propiedad", chunk as number[]).range(from, to),
  );
  const padreToProp = new Map<number, number>();
  for (const p of padres) if (p.id_propiedad) padreToProp.set(p.id, p.id_propiedad);
  const padreIds = padres.map((p) => p.id);
  if (padreIds.length === 0) return datasetVacio();

  // 6. cuentas hijas (incluye mantenimiento, bodega, estacionamiento)
  const hijas = await fetchInChunks<{ id: number; id_cuenta_cobranza_padre: number | null; clabe_stp: string | null }>(
    padreIds,
    (chunk, from, to) =>
      supabase
        .from("cuentas_cobranza")
        .select("id, id_cuenta_cobranza_padre, clabe_stp")
        .in("id_cuenta_cobranza_padre", chunk as number[])
        .range(from, to),
  );
  const hijaToPadre = new Map<number, number>();
  const hijaClabe = new Map<number, string | null>();
  for (const h of hijas) {
    if (h.id_cuenta_cobranza_padre) hijaToPadre.set(h.id, h.id_cuenta_cobranza_padre);
    hijaClabe.set(h.id, h.clabe_stp);
  }
  const hijaIds = hijas.map((h) => h.id);
  if (hijaIds.length === 0) return datasetVacio();

  // 7. acuerdos de mantenimiento (concepto 11) sobre cuentas hijas -> define cuentas de mantenimiento
  const acuerdos = await fetchInChunks<AcuerdoRow>(hijaIds, (chunk, from, to) =>
    supabase
      .from("acuerdos_pago")
      .select("id, id_cuenta_cobranza, fecha_pago, monto, pago_completado")
      .eq("id_concepto", CONCEPTO_MANTENIMIENTO)
      .in("id_cuenta_cobranza", chunk as number[])
      .range(from, to),
  );
  const mantCcIds = uniq(acuerdos.map((a) => a.id_cuenta_cobranza));
  if (mantCcIds.length === 0) return datasetVacio();

  const acuerdosByCc = new Map<number, AcuerdoRow[]>();
  const acuerdoIdToCc = new Map<number, number>();
  for (const a of acuerdos) {
    if (!acuerdosByCc.has(a.id_cuenta_cobranza)) acuerdosByCc.set(a.id_cuenta_cobranza, []);
    acuerdosByCc.get(a.id_cuenta_cobranza)!.push(a);
    acuerdoIdToCc.set(a.id, a.id_cuenta_cobranza);
  }

  // 8. pagos de las cuentas de mantenimiento
  const pagosRows = await fetchInChunks<PagoRow>(mantCcIds, (chunk, from, to) =>
    supabase
      .from("pagos")
      .select(
        "id, id_cuenta_cobranza, monto, fecha_pago, clave_rastreo, descripcion, url_recibo, url_cep, id_metodos_pago",
      )
      .in("id_cuenta_cobranza", chunk as number[])
      .eq("activo", true)
      .range(from, to),
  );
  const pagosByCc = new Map<number, PagoRow[]>();
  for (const p of pagosRows) {
    if (!pagosByCc.has(p.id_cuenta_cobranza)) pagosByCc.set(p.id_cuenta_cobranza, []);
    pagosByCc.get(p.id_cuenta_cobranza)!.push(p);
  }

  // 8b. métodos de pago (catálogo) — para etiqueta humana en la tabla.
  const metodoIds = uniq(
    pagosRows.map((p) => p.id_metodos_pago).filter((v): v is number => !!v),
  );
  const metodos = metodoIds.length
    ? await fetchInChunks<{ id: number; nombre: string | null }>(metodoIds, (chunk, from, to) =>
        supabase.from("metodos_pago").select("id, nombre").in("id", chunk as number[]).range(from, to),
      )
    : [];
  const metodoNombre = new Map<number, string>(
    metodos.map((m) => [m.id, m.nombre ?? "—"]),
  );

  // 9. aplicaciones de esos pagos (para conciliación)
  const pagoIds = pagosRows.map((p) => p.id);
  const apps = pagoIds.length
    ? await fetchInChunks<{ id_pago: number; monto: number | null; id_acuerdo_pago: number | null }>(pagoIds, (chunk, from, to) =>
        supabase
          .from("aplicaciones_pago")
          .select("id_pago, monto, id_acuerdo_pago")
          .in("id_pago", chunk as number[])
          .eq("activo", true)
          .range(from, to),
      )
    : [];
  const aplicadoPorPago = new Map<number, number>();
  /** Acuerdos por pago (para deducir categoría: si todos los acuerdos
   *  tienen multa asociada → "multa"; sino "mantenimiento"). */
  const acuerdosPorPago = new Map<number, number[]>();
  for (const a of apps) {
    aplicadoPorPago.set(a.id_pago, (aplicadoPorPago.get(a.id_pago) ?? 0) + Number(a.monto ?? 0));
    if (a.id_acuerdo_pago) {
      const arr = acuerdosPorPago.get(a.id_pago) ?? [];
      arr.push(a.id_acuerdo_pago);
      acuerdosPorPago.set(a.id_pago, arr);
    }
  }

  // 10. multas ligadas a acuerdos de mantenimiento
  const acuerdoIds = acuerdos.map((a) => a.id);
  const multas = acuerdoIds.length
    ? await fetchInChunks<{ id: number; id_acuerdo_pago: number; monto: number | null; descripcion: string | null; es_pagada: boolean | null }>(
        acuerdoIds,
        (chunk, from, to) =>
          supabase
            .from("multas")
            .select("id, id_acuerdo_pago, monto, descripcion, es_pagada")
            .in("id_acuerdo_pago", chunk as number[])
            .eq("activo", true)
            .range(from, to),
      )
    : [];

  // 11. dueños: entidad_relacionada -> persona
  const duenoIds = uniq(props.map((p) => p.id_entidad_relacionada_dueno).filter(Boolean) as number[]);
  const ents = duenoIds.length
    ? await fetchInChunks<{ id: number; id_persona: number | null }>(duenoIds, (chunk, from, to) =>
        supabase.from("entidades_relacionadas").select("id, id_persona").in("id", chunk as number[]).range(from, to),
      )
    : [];
  const entToPersona = new Map<number, number>();
  for (const e of ents) if (e.id_persona) entToPersona.set(e.id, e.id_persona);

  // 12. residentes: por cuenta de mantenimiento o su cuenta padre
  const ccParaResidentes = uniq([...mantCcIds, ...padreIds]);
  const residentes = await fetchInChunks<{ id_cuenta_cobranza: number; id_persona: number | null }>(
    ccParaResidentes,
    (chunk, from, to) =>
      supabase
        .from("residentes")
        .select("id_cuenta_cobranza, id_persona")
        .in("id_cuenta_cobranza", chunk as number[])
        .eq("activo", true)
        .range(from, to),
  );
  // mapa cuenta(mant o padre) -> persona residente
  const residentePersonaPorPadre = new Map<number, number>();
  const residentePersonaPorMant = new Map<number, number>();
  for (const r of residentes) {
    if (!r.id_persona) continue;
    if (padreIds.includes(r.id_cuenta_cobranza)) residentePersonaPorPadre.set(r.id_cuenta_cobranza, r.id_persona);
    if (mantCcIds.includes(r.id_cuenta_cobranza)) residentePersonaPorMant.set(r.id_cuenta_cobranza, r.id_persona);
  }

  // personas (dueños + residentes)
  const personaIds = uniq([
    ...Array.from(entToPersona.values()),
    ...Array.from(residentePersonaPorPadre.values()),
    ...Array.from(residentePersonaPorMant.values()),
  ]);
  const personas = personaIds.length
    ? await fetchInChunks<{ id: number; nombre_legal: string | null }>(personaIds, (chunk, from, to) =>
        supabase.from("personas").select("id, nombre_legal").in("id", chunk as number[]).range(from, to),
      )
    : [];
  const personaNombre = new Map<number, string>();
  for (const p of personas) personaNombre.set(p.id, p.nombre_legal ?? "—");

  // Mapa de complementos por cuenta padre (cuentas hijas que NO son
  // de mantenimiento — bodegas, estacionamientos u otras). Devuelve los
  // folios CC-XXXXXX para que la UI pueda listarlos.
  const complementosPorPadre = new Map<number, string[]>();
  const mantCcSet = new Set(mantCcIds);
  for (const h of hijas) {
    if (!h.id_cuenta_cobranza_padre) continue;
    if (mantCcSet.has(h.id)) continue; // saltamos la propia cuenta de mantenimiento
    const arr = complementosPorPadre.get(h.id_cuenta_cobranza_padre) ?? [];
    arr.push(formatCuentaCobranzaId(h.id));
    complementosPorPadre.set(h.id_cuenta_cobranza_padre, arr);
  }

  // --- Derivación de UNIDADES ---
  const unidades: UnidadCondominio[] = [];
  for (const ccId of mantCcIds) {
    const padreId = hijaToPadre.get(ccId);
    const propId = padreId ? padreToProp.get(padreId) : undefined;
    const prop = propId ? propById.get(propId) : undefined;
    if (!prop || !padreId) continue;

    const lista = (acuerdosByCc.get(ccId) ?? []).slice().sort((a, b) => (a.fecha_pago ?? "").localeCompare(b.fecha_pago ?? ""));
    const pendientes = lista.filter((a) => !a.pago_completado);
    const vencidos = pendientes.filter((a) => (fechaISO(a.fecha_pago) ?? "9999") < hoy);
    const cuotaMensual = lista.length ? Number(lista[lista.length - 1].monto ?? 0) : 0;
    const saldoActual = pendientes.reduce((s, a) => s + Number(a.monto ?? 0), 0);
    const saldoVencido = vencidos.reduce((s, a) => s + Number(a.monto ?? 0), 0);

    // Pago acumulado a la fecha: Σ monto de acuerdos cuya fecha de pago ya
    // pasó (devengado, independiente de si están marcados como pagados).
    const pagoAcumulado = lista
      .filter((a) => (fechaISO(a.fecha_pago) ?? "9999") <= hoy)
      .reduce((s, a) => s + Number(a.monto ?? 0), 0);

    const pagosCc = pagosByCc.get(ccId) ?? [];
    const ultimoPago = pagosCc.reduce<string | null>((max, p) => {
      const f = fechaISO(p.fecha_pago);
      return f && (!max || f > max) ? f : max;
    }, null);
    const totalPagado = pagosCc.reduce((s, p) => s + Number(p.monto ?? 0), 0);
    const saldoBalance = +(pagoAcumulado - totalPagado).toFixed(2);

    // Próxima cuota: primer acuerdo no completado con fecha > hoy.
    const proximaFechaPago = lista
      .filter((a) => !a.pago_completado)
      .map((a) => fechaISO(a.fecha_pago))
      .filter((f): f is string => !!f && f > hoy)
      .sort()[0] ?? null;

    // dueño
    const duenoEntId = prop.id_entidad_relacionada_dueno ?? undefined;
    const duenoPersonaId = duenoEntId ? entToPersona.get(duenoEntId) : undefined;
    const propietario = duenoPersonaId ? personaNombre.get(duenoPersonaId) ?? "—" : "—";

    // residente (mant o padre); si no hay, "—"
    const resPersonaId = residentePersonaPorMant.get(ccId) ?? residentePersonaPorPadre.get(padreId);
    const residente = resPersonaId ? personaNombre.get(resPersonaId) ?? "—" : "—";

    const clabe = hijaClabe.get(ccId) ?? "";
    const numero = prop.numero_propiedad ?? String(propId);
    const idEm = prop.id_edificio_modelo ?? null;
    const edificioId = idEm ? emToEdificio.get(idEm) ?? null : null;
    const modeloId = idEm ? emToModelo.get(idEm) ?? null : null;
    const edNombre = edificioId ? edificioNombre.get(edificioId) ?? "—" : "—";
    const modNombre = modeloId ? modeloNombre.get(modeloId) ?? "—" : "—";

    unidades.push({
      id: String(ccId),
      cuentaMantId: ccId,
      cuentaPadreId: padreId,
      propiedadId: prop.id,
      folio_mant: formatCuentaMantenimientoId(ccId),
      numero,
      piso: prop.numero_piso ?? "—",
      tipo: (prop.id_tipo_propiedad && tipoById.get(prop.id_tipo_propiedad)) || "—",
      area_m2: Number(prop.m2_interiores ?? 0) + Number(prop.m2_exteriores ?? 0),
      estatus: prop.rentado_estancia_corta ? "renta_corta" : "ocupado",
      propietario,
      residente,
      clabe,
      referencia_pago: clabe || numero,
      cuota_mensual: cuotaMensual,
      saldo_actual: saldoActual,
      saldo_vencido: saldoVencido,
      ultimo_pago: ultimoPago,
      edificio_nombre: edNombre,
      modelo_nombre: modNombre,
      pago_acumulado: +pagoAcumulado.toFixed(2),
      total_pagado: +totalPagado.toFixed(2),
      saldo_balance: saldoBalance,
      proxima_fecha_pago: proximaFechaPago,
      complementos: complementosPorPadre.get(padreId) ?? [],
    });
  }
  unidades.sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true }));

  const numeroPorCc = new Map<number, string>();
  const unidadIdPorCc = new Map<number, string>();
  for (const u of unidades) {
    numeroPorCc.set(u.cuentaMantId, u.numero);
    unidadIdPorCc.set(u.cuentaMantId, u.id);
  }

  // --- CARGOS (acuerdos de mantenimiento + multas) ---
  const cargos: CargoCondominio[] = [];
  for (const a of acuerdos) {
    const numero = numeroPorCc.get(a.id_cuenta_cobranza);
    if (!numero) continue;
    const f = fechaISO(a.fecha_pago) ?? "";
    const estatus = a.pago_completado ? "pagado" : f && f < hoy ? "vencido" : "pendiente";
    cargos.push({
      id: `ap-${a.id}`,
      unidad_id: unidadIdPorCc.get(a.id_cuenta_cobranza) ?? "",
      unidad_numero: numero,
      concepto: `Cuota de mantenimiento${f ? ` · ${etiquetaMes(f)}` : ""}`,
      categoria: "mantenimiento",
      monto: Number(a.monto ?? 0),
      fecha_generacion: null,
      fecha_vencimiento: f,
      estatus,
    });
  }
  for (const m of multas) {
    const ccId = acuerdoIdToCc.get(m.id_acuerdo_pago);
    const numero = ccId ? numeroPorCc.get(ccId) : undefined;
    if (!numero || !ccId) continue;
    cargos.push({
      id: `multa-${m.id}`,
      unidad_id: unidadIdPorCc.get(ccId) ?? "",
      unidad_numero: numero,
      concepto: m.descripcion || "Multa",
      categoria: "multa",
      monto: Number(m.monto ?? 0),
      fecha_generacion: null,
      fecha_vencimiento: "",
      estatus: m.es_pagada ? "pagado" : "pendiente",
    });
  }

  // --- PAGOS (con conciliación derivada + enrich propietario/residente/categoría) ---
  const unidadPorCcMant = new Map<number, UnidadCondominio>(
    unidades.map((u) => [u.cuentaMantId, u]),
  );
  // Set de id_acuerdo_pago que tienen multa asociada — para derivar categoría.
  const acuerdosConMulta = new Set<number>(
    (multas as Array<any>).map((m) => m.id_acuerdo_pago as number).filter((v) => !!v),
  );
  const pagos: PagoCondominio[] = pagosRows.map((p) => {
    const monto = Number(p.monto ?? 0);
    const aplicado = aplicadoPorPago.get(p.id) ?? 0;
    let estatus: EstatusConciliacion;
    let nota: string | undefined;
    if (aplicado <= 0) {
      estatus = "pendiente";
      nota = "Sin aplicación registrada";
    } else if (Math.abs(aplicado - monto) <= 0.01) {
      estatus = "conciliado";
    } else {
      estatus = "excepcion";
      nota = "Monto aplicado no coincide";
    }
    const unidad = unidadPorCcMant.get(p.id_cuenta_cobranza);
    // Categoría: si TODOS los acuerdos del pago corresponden a una multa,
    // categoría = "multa". Si no, "mantenimiento".
    const acuerdosDelPago = acuerdosPorPago.get(p.id) ?? [];
    const todosMulta =
      acuerdosDelPago.length > 0 && acuerdosDelPago.every((id) => acuerdosConMulta.has(id));
    const categoria: CategoriaCargo = todosMulta ? "multa" : "mantenimiento";
    // Comprobante: STP usa url_cep; transferencia/efectivo usan url_recibo.
    const urlComprobante = p.url_cep || p.url_recibo || null;
    const metodoPago = p.id_metodos_pago
      ? metodoNombre.get(p.id_metodos_pago) ?? "—"
      : "—";
    return {
      id: `pago-${p.id}`,
      unidad_id: unidadIdPorCc.get(p.id_cuenta_cobranza) ?? "",
      unidad_numero: unidad?.numero ?? "—",
      folio_mant: unidad?.folio_mant ?? formatCuentaMantenimientoId(p.id_cuenta_cobranza),
      propietario: unidad?.propietario ?? "—",
      residente: unidad?.residente ?? "—",
      monto,
      fecha: fechaISO(p.fecha_pago) ?? "",
      referencia: p.clave_rastreo ?? "—",
      concepto: p.descripcion || (categoria === "multa" ? "Pago de multa" : "Pago de mantenimiento"),
      categoria,
      url_comprobante: urlComprobante,
      metodo_pago: metodoPago,
      estatus_conciliacion: estatus,
      nota_conciliacion: nota,
    };
  });
  pagos.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

  // --- MOROSOS (cobranza) ---
  const morosos: MorosoCondominio[] = [];
  for (const u of unidades) {
    if (u.saldo_vencido <= 0) continue;
    const lista = (acuerdosByCc.get(u.cuentaMantId) ?? []).filter((a) => !a.pago_completado);
    const vencidos = lista
      .map((a) => fechaISO(a.fecha_pago))
      .filter((f): f is string => !!f && f < hoy)
      .sort();
    const masAntiguo = vencidos[0];
    const dias = masAntiguo ? diasEntre(masAntiguo, hoy) : 0;
    morosos.push({
      id: `mor-${u.cuentaMantId}`,
      unidad_id: u.id,
      unidad_numero: u.numero,
      propietario: u.propietario,
      monto_vencido: u.saldo_vencido,
      antiguedad: bucketAntiguedad(dias),
      ultimo_pago: u.ultimo_pago,
    });
  }
  morosos.sort((a, b) => b.monto_vencido - a.monto_vencido);

  // --- KPIs ---
  const totalEsperado = acuerdos.reduce((s, a) => s + Number(a.monto ?? 0), 0);
  const totalCobrado = pagosRows.reduce((s, p) => s + Number(p.monto ?? 0), 0);
  const totalVencido = unidades.reduce((s, u) => s + u.saldo_vencido, 0);
  const saldoPendiente = unidades.reduce((s, u) => s + u.saldo_actual, 0);
  const excepciones = pagos.filter((p) => p.estatus_conciliacion !== "conciliado").length;
  const kpis: CondominioKPIs = {
    totalEsperado,
    totalCobrado,
    tasaCobranza: totalEsperado > 0 ? Math.round((totalCobrado / totalEsperado) * 100) : 0,
    totalVencido,
    saldoPendiente,
    morosos: morosos.length,
    excepciones,
    numUnidades: unidades.length,
  };

  // --- TENDENCIA MENSUAL (últimos 6 meses con datos) ---
  const esperadoPorMes = new Map<string, number>();
  for (const a of acuerdos) {
    const f = fechaISO(a.fecha_pago);
    if (!f) continue;
    const mes = f.slice(0, 7);
    esperadoPorMes.set(mes, (esperadoPorMes.get(mes) ?? 0) + Number(a.monto ?? 0));
  }
  const cobradoPorMes = new Map<string, number>();
  for (const p of pagosRows) {
    const f = fechaISO(p.fecha_pago);
    if (!f) continue;
    const mes = f.slice(0, 7);
    cobradoPorMes.set(mes, (cobradoPorMes.get(mes) ?? 0) + Number(p.monto ?? 0));
  }
  const meses = uniq([...esperadoPorMes.keys(), ...cobradoPorMes.keys()]).sort();
  const ultimos = meses.slice(-6);
  const tendenciaMensual: TendenciaMes[] = ultimos.map((m) => ({
    mes: etiquetaMes(m + "-01"),
    esperado: esperadoPorMes.get(m) ?? 0,
    cobrado: cobradoPorMes.get(m) ?? 0,
  }));

  // --- ANTIGÜEDAD (buckets) ---
  const buckets: Record<BucketAntiguedad, { monto: number; cuentas: number }> = {
    "1-30": { monto: 0, cuentas: 0 },
    "31-60": { monto: 0, cuentas: 0 },
    "61-90": { monto: 0, cuentas: 0 },
    "90+": { monto: 0, cuentas: 0 },
  };
  for (const m of morosos) {
    buckets[m.antiguedad].monto += m.monto_vencido;
    buckets[m.antiguedad].cuentas += 1;
  }
  const antiguedad: AntiguedadBucket[] = [
    { rango: "1-30 días", monto: buckets["1-30"].monto, cuentas: buckets["1-30"].cuentas },
    { rango: "31-60 días", monto: buckets["31-60"].monto, cuentas: buckets["31-60"].cuentas },
    { rango: "61-90 días", monto: buckets["61-90"].monto, cuentas: buckets["61-90"].cuentas },
    { rango: "90+ días", monto: buckets["90+"].monto, cuentas: buckets["90+"].cuentas },
  ];

  // --- AMENIDADES (catálogo del proyecto) ---
  const amenidades = await fetchAmenidades(proyectoId);

  return {
    proyecto_nombre: proyectoNombre,
    unidades,
    cargos,
    pagos,
    morosos,
    amenidades,
    kpis,
    tendenciaMensual,
    antiguedad,
  };
}

async function fetchAmenidades(proyectoId: number): Promise<AmenidadCondominio[]> {
  const { data: rels, error } = await supabase
    .from("amenidades_proyectos")
    .select("id_amenidad")
    .eq("id_proyecto", proyectoId)
    .eq("activo", true);
  if (error) throw error;
  const amenidadIds = uniq((rels ?? []).map((r: any) => r.id_amenidad).filter(Boolean));
  if (amenidadIds.length === 0) return [];
  const ams = await fetchInChunks<{ id: number; nombre: string | null; url: string | null }>(amenidadIds, (chunk, from, to) =>
    supabase.from("amenidades").select("id, nombre, url").in("id", chunk as number[]).eq("activo", true).range(from, to),
  );
  return ams.map((a) => ({ id: String(a.id), nombre: a.nombre ?? "—", url: a.url ?? null }));
}

export interface CondominioConfig {
  nombre: string;
  costo_mantenimiento_m2: number;
  monto_mensual_cuota_extraordinaria: number;
}

export async function fetchCondominioConfig(proyectoId: number): Promise<CondominioConfig> {
  const { data, error } = await supabase
    .from("proyectos")
    .select("nombre, costo_mantenimiento_m2, monto_mensual_cuota_extraordinaria")
    .eq("id", proyectoId)
    .single();
  if (error) throw error;
  return {
    nombre: (data as any)?.nombre ?? "—",
    costo_mantenimiento_m2: Number((data as any)?.costo_mantenimiento_m2 ?? 0),
    monto_mensual_cuota_extraordinaria: Number((data as any)?.monto_mensual_cuota_extraordinaria ?? 0),
  };
}

function datasetVacio(): CondominioDataset {
  return {
    proyecto_nombre: "—",
    unidades: [],
    cargos: [],
    pagos: [],
    morosos: [],
    amenidades: [],
    kpis: {
      totalEsperado: 0,
      totalCobrado: 0,
      tasaCobranza: 0,
      totalVencido: 0,
      saldoPendiente: 0,
      morosos: 0,
      excepciones: 0,
      numUnidades: 0,
    },
    tendenciaMensual: [],
    antiguedad: [],
  };
}
