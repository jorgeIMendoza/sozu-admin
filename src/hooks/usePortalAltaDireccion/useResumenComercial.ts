import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProyectosSozuIds } from "./proyectosSozu";

/**
 * Resumen Comercial del Dashboard General (Portal Alta Dirección).
 *
 * Datos reales de la BD para el MES EN CURSO (salvo Apartados, que es un
 * snapshot "al momento"), con desglose por proyecto:
 *
 *  - Citas:      `reservas_citas.fecha_creacion` en el mes (activo).
 *  - Prospectos: `entidades_relacionadas` id_tipo_entidad=7, fecha_creacion en el mes.
 *  - Ofertas:    `ofertas.fecha_generacion` en el mes (activo).
 *  - Apartados:  `propiedades.id_estatus_disponibilidad=4` (al momento).
 *  - Ventas:     `cuentas_cobranza.fecha_compra` en el mes; venta = propiedad
 *                Vendida (estatus 5) ó Producto/Servicio (sin propiedad).
 *
 * El proyecto se resuelve con waterfall explícito
 * (propiedades → edificios_modelos → edificios → proyectos), nunca con
 * triple-join de PostgREST.
 */

const ESTATUS_APARTADO = 4;
const ESTATUS_VENDIDO = 5;
const TIPO_ENTIDAD_PROSPECTO = 7;
const IN_BATCH = 500;
const SIN_PROYECTO = "Sin proyecto";

export interface MetricaPorProyecto {
  proyecto: string;
  valor: number;
}
export interface MetricaResumen {
  total: number;
  porProyecto: MetricaPorProyecto[];
}
export interface VentasResumen {
  total: number;
  monto: number;
  porProyecto: Array<{ proyecto: string; valor: number; monto: number }>;
}
export interface ResumenComercial {
  mesLabel: string;
  citas: MetricaResumen;
  prospectos: MetricaResumen;
  apartados: MetricaResumen;
  ventas: VentasResumen;
}

/** Primer día del mes en curso como 'YYYY-MM-01' (sirve para columnas date y timestamptz). */
function inicioDeMes(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function ordenarDesc(map: Map<string, number>): MetricaPorProyecto[] {
  return Array.from(map.entries())
    .map(([proyecto, valor]) => ({ proyecto, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/** Info por propiedad: estatus de disponibilidad + proyecto (id + nombre). */
type PropInfo = { estatus: number | null; projId: number | null; proyecto: string | null };

/**
 * Resuelve, para un set de id_propiedad, su estatus de disponibilidad y el
 * nombre del proyecto vía la cadena propiedades → edificios_modelos →
 * edificios → proyectos. Pagina los IN(...) en lotes.
 */
async function cargarPropiedades(propIds: number[]): Promise<Map<number, PropInfo>> {
  const out = new Map<number, PropInfo>();
  if (propIds.length === 0) return out;

  const props: Array<any> = [];
  for (let i = 0; i < propIds.length; i += IN_BATCH) {
    const slice = propIds.slice(i, i + IN_BATCH);
    const { data } = (await (supabase as any)
      .from("propiedades")
      .select("id, id_estatus_disponibilidad, id_edificio_modelo")
      .in("id", slice)) as any;
    props.push(...((data || []) as Array<any>));
  }

  const emIds = Array.from(
    new Set(props.map((p) => p.id_edificio_modelo).filter((v): v is number => !!v)),
  );
  const ems: Array<any> = [];
  for (let i = 0; i < emIds.length; i += IN_BATCH) {
    const slice = emIds.slice(i, i + IN_BATCH);
    const { data } = (await (supabase as any)
      .from("edificios_modelos")
      .select("id, id_edificio")
      .in("id", slice)) as any;
    ems.push(...((data || []) as Array<any>));
  }
  const edificioByEm = new Map<number, number | null>(
    ems.map((e: any) => [e.id, e.id_edificio ?? null]),
  );

  const edIds = Array.from(
    new Set(ems.map((e: any) => e.id_edificio).filter((v): v is number => !!v)),
  );
  const { data: eds } = edIds.length
    ? ((await (supabase as any)
        .from("edificios")
        .select("id, id_proyecto")
        .in("id", edIds)) as any)
    : { data: [] };
  const proyectoByEd = new Map<number, number | null>(
    (eds || []).map((e: any) => [e.id, e.id_proyecto ?? null]),
  );

  const projIds = Array.from(
    new Set((eds || []).map((e: any) => e.id_proyecto).filter((v): v is number => !!v)),
  );
  const { data: projs } = projIds.length
    ? ((await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .in("id", projIds)) as any)
    : { data: [] };
  const nombreByProj = new Map<number, string>(
    (projs || []).map((p: any) => [p.id, p.nombre as string]),
  );

  for (const p of props) {
    const emId = p.id_edificio_modelo ?? null;
    const edId = emId != null ? edificioByEm.get(emId) ?? null : null;
    const projId = edId != null ? proyectoByEd.get(edId) ?? null : null;
    const proyecto = projId != null ? nombreByProj.get(projId) ?? null : null;
    out.set(p.id, { estatus: p.id_estatus_disponibilidad ?? null, projId, proyecto });
  }
  return out;
}

async function fetchResumenComercial(): Promise<ResumenComercial> {
  const desde = inicioDeMes();
  const mesLabel = new Date().toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  // Universo: sólo proyectos ACTIVOS comercializados por SOZU. Todas las
  // métricas se restringen a estos proyectos; los registros sin proyecto o
  // de proyectos fuera de este universo no se cuentan.
  const sozuSet = await fetchProyectosSozuIds();

  // ── 1) Citas del mes (join directo a proyectos). ──
  const { data: citasRows, error: citasErr } = (await (supabase as any)
    .from("reservas_citas")
    .select("id, id_proyecto, proyectos(nombre)")
    .eq("activo", true)
    .gte("fecha_creacion", desde)) as any;
  if (citasErr) throw citasErr;
  const citasMap = new Map<string, number>();
  ((citasRows || []) as Array<any>)
    .filter((c) => c.id_proyecto != null && sozuSet.has(c.id_proyecto))
    .forEach((c) => {
      const proy = c.proyectos?.nombre || SIN_PROYECTO;
      citasMap.set(proy, (citasMap.get(proy) ?? 0) + 1);
    });

  // ── 2) Prospectos del mes (entidades_relacionadas tipo 7). ──
  // `entidades_relacionadas` tiene varias FK a `personas`/`proyectos`, así que
  // el embed DEBE desambiguarse con el nombre del constraint (igual que la
  // pantalla Prospectos); sin el hint PostgREST devuelve error y data=null.
  const { data: prospRows, error: prospErr } = (await (supabase as any)
    .from("entidades_relacionadas")
    .select("id, id_proyecto, proyectos!entidades_relacionadas_id_proyecto_fkey(nombre)")
    .eq("id_tipo_entidad", TIPO_ENTIDAD_PROSPECTO)
    .eq("activo", true)
    .gte("fecha_creacion", desde)) as any;
  if (prospErr) throw prospErr;
  const prospMap = new Map<string, number>();
  ((prospRows || []) as Array<any>)
    .filter((p) => p.id_proyecto != null && sozuSet.has(p.id_proyecto))
    .forEach((p) => {
      const proy = p.proyectos?.nombre || SIN_PROYECTO;
      prospMap.set(proy, (prospMap.get(proy) ?? 0) + 1);
    });

  // ── 3) Apartados al momento (propiedades estatus 4). ──
  // (Las "Nuevas ofertas" del dashboard se calculan desde el Pipeline —
  //  ver useResumenOfertasAprobadas— para coincidir con su etapa "Aprobadas".)
  const { data: apartadasRows } = (await (supabase as any)
    .from("propiedades")
    .select("id")
    .eq("activo", true)
    .eq("id_estatus_disponibilidad", ESTATUS_APARTADO)) as any;
  const apartadasIds = ((apartadasRows || []) as Array<any>).map((p) => p.id as number);

  // ── 4) Ventas del mes (cuentas con fecha_compra en el mes). ──
  const { data: cuentasRows } = (await (supabase as any)
    .from("cuentas_cobranza")
    .select("id, id_propiedad, id_oferta, precio_final")
    .eq("activo", true)
    .is("id_cuenta_cobranza_padre", null)
    .gte("fecha_compra", desde)) as any;
  const cuentas = (cuentasRows || []) as Array<any>;

  // Resolver id_propiedad de ofertas referenciadas por cuentas sin propiedad.
  const ofertaIdsCuentas = Array.from(
    new Set(
      cuentas
        .filter((c) => c.id_propiedad == null && c.id_oferta != null)
        .map((c) => c.id_oferta as number),
    ),
  );
  const ofertaPropMap = new Map<number, number | null>();
  for (let i = 0; i < ofertaIdsCuentas.length; i += IN_BATCH) {
    const slice = ofertaIdsCuentas.slice(i, i + IN_BATCH);
    const { data } = (await (supabase as any)
      .from("ofertas")
      .select("id, id_propiedad")
      .in("id", slice)) as any;
    ((data || []) as Array<any>).forEach((o) =>
      ofertaPropMap.set(o.id, o.id_propiedad ?? null),
    );
  }

  // Set único de id_propiedad a resolver (apartados + ventas).
  const ventaPropIds = cuentas
    .map((c) => c.id_propiedad ?? (c.id_oferta ? ofertaPropMap.get(c.id_oferta) : null) ?? null)
    .filter((v): v is number => !!v);
  const allPropIds = Array.from(
    new Set<number>([...apartadasIds, ...ventaPropIds]),
  );
  const propInfo = await cargarPropiedades(allPropIds);

  // Apartados por proyecto (sólo proyectos SOZU activos).
  const apartadosMap = new Map<string, number>();
  for (const id of apartadasIds) {
    const info = propInfo.get(id);
    if (!info || info.projId == null || !sozuSet.has(info.projId)) continue;
    const proy = info.proyecto || SIN_PROYECTO;
    apartadosMap.set(proy, (apartadosMap.get(proy) ?? 0) + 1);
  }

  // Ventas por proyecto (conteo + monto). Válidas: propiedad Vendida (5) ó
  // sin propiedad (producto/servicio).
  const ventasCountMap = new Map<string, number>();
  const ventasMontoMap = new Map<string, number>();
  let ventasTotal = 0;
  let ventasMonto = 0;
  for (const c of cuentas) {
    const propId =
      c.id_propiedad ?? (c.id_oferta ? ofertaPropMap.get(c.id_oferta) ?? null : null);
    const info = propId != null ? propInfo.get(propId) : null;
    const esVenta = propId == null || info?.estatus === ESTATUS_VENDIDO;
    if (!esVenta) continue;
    // Sólo ventas de proyectos SOZU activos (excluye sin-proyecto y no-SOZU).
    if (info?.projId == null || !sozuSet.has(info.projId)) continue;
    const proy = info?.proyecto || SIN_PROYECTO;
    const monto = Number(c.precio_final ?? 0);
    ventasCountMap.set(proy, (ventasCountMap.get(proy) ?? 0) + 1);
    ventasMontoMap.set(proy, (ventasMontoMap.get(proy) ?? 0) + monto);
    ventasTotal += 1;
    ventasMonto += monto;
  }
  const ventasPorProyecto = Array.from(ventasCountMap.entries())
    .map(([proyecto, valor]) => ({
      proyecto,
      valor,
      monto: +(ventasMontoMap.get(proyecto) ?? 0).toFixed(2),
    }))
    .sort((a, b) => b.monto - a.monto);

  const sum = (m: Map<string, number>) =>
    Array.from(m.values()).reduce((s, v) => s + v, 0);

  return {
    mesLabel,
    citas: { total: sum(citasMap), porProyecto: ordenarDesc(citasMap) },
    prospectos: { total: sum(prospMap), porProyecto: ordenarDesc(prospMap) },
    apartados: { total: sum(apartadosMap), porProyecto: ordenarDesc(apartadosMap) },
    ventas: {
      total: ventasTotal,
      monto: +ventasMonto.toFixed(2),
      porProyecto: ventasPorProyecto,
    },
  };
}

export function useResumenComercial() {
  return useQuery<ResumenComercial>({
    queryKey: ["resumen-comercial-dashboard", inicioDeMes()],
    queryFn: fetchResumenComercial,
    staleTime: 5 * 60_000,
  });
}
