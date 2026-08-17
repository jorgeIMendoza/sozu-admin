import { supabase } from "@/integrations/supabase/client";
import type { Modelo, Propiedad, Proyecto, Torre } from "../types/dominio";

/**
 * INVENTARIO REAL — reemplaza a `mocks/inventario.ts` como fuente del módulo de
 * Precios.
 *
 * El módulo nació sobre un mock con ids de texto (`pry-daiku`) y unidades
 * generadas. Aquí se lee el inventario que de verdad está capturado, y los ids
 * del dominio de Precios pasan a ser el id real de cada fila, en texto:
 *
 *   Proyecto  ← `proyectos`
 *   Torre     ← `edificios`
 *   Modelo    ← `modelos`
 *   Propiedad ← `propiedades`  (vía `edificios_modelos`)
 *
 * Solo entran los proyectos **comercializados por SOZU**: los que tienen una
 * `entidades_relacionadas` de tipo 5 apuntando al proyecto. Es la misma
 * definición que usan el Directorio de Personal y los Canales de Venta, para
 * que "proyecto de SOZU" signifique lo mismo en todo el sistema.
 *
 * Todas las consultas van en waterfall explícito (patrón #1 de CLAUDE.md): el
 * join anidado de PostgREST sobre tres niveles devuelve `null` sin error, y
 * aquí eso se leería como "el proyecto no tiene inventario", que es falso.
 */

/** Entidad relacionada tipo 5 = SOZU (ver "IDs fijos importantes" en CLAUDE.md). */
const TIPO_ENTIDAD_SOZU = 5;

/**
 * "Proyectos" que son catálogos internos (Productos, Servicios) y no
 * desarrollos: comparten la relación con SOZU pero no tienen unidades que
 * preciar. Mismo criterio que `useProyectosSozuCanales`.
 */
const TIPOS_USO_EXCLUIDOS = [9, 10];

/**
 * `.in()` viaja en la URL: con ~1000 unidades la petición excede el límite y
 * PostgREST responde 414. Se trocea.
 */
const TAMANO_LOTE = 200;

async function enLotes<T>(
  ids: Array<number | string>,
  consulta: (lote: Array<number | string>) => Promise<T[]>,
): Promise<T[]> {
  const salida: T[] = [];
  for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
    salida.push(...(await consulta(ids.slice(i, i + TAMANO_LOTE))));
  }
  return salida;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * El piso se guarda como texto libre (`numero_piso`). Casi todo el inventario
 * trae un entero, pero hay capturas como "PB" o "1A": ahí el nivel cae a 1, que
 * es el nivel ancla, en vez de romper el cálculo con NaN.
 */
function nivelDePiso(piso: unknown): number {
  const m = String(piso ?? "").match(/-?\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return Number.isFinite(n) ? n : 1;
}

/** Sin vista capturada se usa una clave explícita, no cadena vacía. */
export const SIN_VISTA = "Sin vista";

/**
 * El inventario no registra orientación: es un dato que el módulo de Precios
 * modelaba en el mock y que no existe en `propiedades`. Se usa una sola clave
 * para toda la cartera, con factor 1.0000, de modo que la familia quede neutral
 * en vez de inventar una orientación por unidad.
 */
export const SIN_ORIENTACION = "Sin dato";

/** Estacionamiento en tándem: los demás tipos cuentan como cajón independiente. */
const TIPO_ESTACIONAMIENTO_TANDEM = 2;

export interface ProyectoSozuPrecios {
  id: number;
  nombre: string;
}

/**
 * Proyectos comercializados por SOZU y activos. Es el universo del selector de
 * Precios: no se puede preciar un desarrollo que SOZU no comercializa.
 */
export async function obtenerProyectosSozu(): Promise<Proyecto[]> {
  const { data: rels, error: relError } = await supabase
    .from("entidades_relacionadas")
    .select("id_proyecto")
    .eq("id_tipo_entidad", TIPO_ENTIDAD_SOZU)
    .eq("activo", true)
    .not("id_proyecto", "is", null);
  if (relError || !rels?.length) return [];

  const ids = Array.from(new Set(rels.map((r) => r.id_proyecto as number)));

  const { data, error } = await supabase
    .from("proyectos")
    .select("id, nombre, direccion, id_tipo_uso")
    .in("id", ids)
    .eq("activo", true)
    .order("nombre");
  if (error || !data) return [];

  const proyectos = data.filter(
    (p) => !TIPOS_USO_EXCLUIDOS.includes(p.id_tipo_uso as number),
  );
  if (!proyectos.length) return [];

  // El conteo de departamentos se muestra en el encabezado del módulo; se
  // resuelve por proyecto para no traer las ~1000 unidades solo por el número.
  const conteos = await contarUnidadesPorProyecto(proyectos.map((p) => p.id as number));

  return proyectos.map((p) => ({
    id_proyecto: String(p.id),
    nombre: p.nombre as string,
    // El desarrollador no vive en `proyectos`; se muestra la dirección, que es
    // el dato de ubicación que sí está capturado.
    desarrollador: "",
    ciudad: (p.direccion as string | null) ?? "",
    num_departamentos: conteos[String(p.id)] ?? 0,
    activo: true,
  }));
}

async function contarUnidadesPorProyecto(
  idsProyecto: number[],
): Promise<Record<string, number>> {
  const salida: Record<string, number> = {};
  for (const id of idsProyecto) {
    const { modelosVinculados } = await estructuraDeProyecto(id);
    if (!modelosVinculados.length) {
      salida[String(id)] = 0;
      continue;
    }
    const { count } = await supabase
      .from("propiedades")
      .select("id", { count: "exact", head: true })
      .in(
        "id_edificio_modelo",
        modelosVinculados.map((v) => v.id),
      )
      .eq("activo", true);
    salida[String(id)] = count ?? 0;
  }
  return salida;
}

interface VinculoEdificioModelo {
  id: number;
  id_edificio: number;
  id_modelo: number;
}

/** Edificios del proyecto y sus vínculos edificio×modelo, en dos pasos. */
async function estructuraDeProyecto(idProyecto: number): Promise<{
  edificios: Array<{ id: number; nombre: string }>;
  modelosVinculados: VinculoEdificioModelo[];
}> {
  const { data: edificios } = await supabase
    .from("edificios")
    .select("id, nombre")
    .eq("id_proyecto", idProyecto)
    .eq("activo", true)
    .order("nombre");
  if (!edificios?.length) return { edificios: [], modelosVinculados: [] };

  const { data: vinculos } = await supabase
    .from("edificios_modelos")
    .select("id, id_edificio, id_modelo")
    .in(
      "id_edificio",
      edificios.map((e) => e.id),
    )
    .eq("activo", true);

  return {
    edificios: edificios as Array<{ id: number; nombre: string }>,
    modelosVinculados: (vinculos ?? []) as VinculoEdificioModelo[],
  };
}

export interface InventarioProyecto {
  torres: Torre[];
  modelos: Modelo[];
  propiedades: Propiedad[];
}

/**
 * Inventario completo de un proyecto, ya traducido al dominio de Precios.
 *
 * La fecha de entrega se toma del proyecto: `edificios` no la guarda, y el eje
 * temporal de los esquemas de financiamiento la necesita para descontar.
 */
export async function obtenerInventarioProyecto(
  idProyectoTexto: string,
): Promise<InventarioProyecto> {
  const idProyecto = Number(idProyectoTexto);
  if (!Number.isFinite(idProyecto)) return { torres: [], modelos: [], propiedades: [] };

  const [{ edificios, modelosVinculados }, proyectoRes] = await Promise.all([
    estructuraDeProyecto(idProyecto),
    supabase
      .from("proyectos")
      .select("fecha_entrega_proyecto, fecha_entrega")
      .eq("id", idProyecto)
      .maybeSingle(),
  ]);

  if (!edificios.length || !modelosVinculados.length) {
    return { torres: [], modelos: [], propiedades: [] };
  }

  const entrega =
    (proyectoRes.data?.fecha_entrega_proyecto as string | null) ??
    (proyectoRes.data?.fecha_entrega as string | null) ??
    "";

  const torres: Torre[] = edificios.map((e) => ({
    id_torre: String(e.id),
    id_proyecto: idProyectoTexto,
    nombre: e.nombre,
    fecha_entrega_estimada: entrega ? String(entrega).slice(0, 10) : "",
    activo: true,
  }));

  const idsModelo = Array.from(new Set(modelosVinculados.map((v) => v.id_modelo)));
  const { data: modelosData } = await supabase
    .from("modelos")
    .select("id, nombre, numero_recamaras, numero_completo_banos, numero_medio_bano")
    .in("id", idsModelo)
    .eq("activo", true);

  const caracteristicasPorModelo = await caracteristicasDeModelos(idsModelo);

  const modelos: Modelo[] = (modelosData ?? []).map((m) => ({
    id_modelo: String(m.id),
    id_proyecto: idProyectoTexto,
    nombre: m.nombre as string,
    recamaras: num(m.numero_recamaras),
    banos_completos: num(m.numero_completo_banos),
    medios_banos: num(m.numero_medio_bano),
    caracteristicas: caracteristicasPorModelo[String(m.id)] ?? [],
    activo: true,
  }));

  const propiedades = await propiedadesDeProyecto(
    idProyectoTexto,
    modelosVinculados,
    idProyecto,
  );

  return { torres, modelos, propiedades };
}

async function caracteristicasDeModelos(
  idsModelo: number[],
): Promise<Record<string, string[]>> {
  if (!idsModelo.length) return {};
  const enlaces = await enLotes(idsModelo, async (lote) => {
    const { data } = await supabase
      .from("modelos_caracteristicas")
      .select("id_modelo, id_caracteristica")
      .in("id_modelo", lote as number[])
      .eq("activo", true);
    return (data ?? []) as Array<{ id_modelo: number; id_caracteristica: number }>;
  });
  if (!enlaces.length) return {};

  const idsCarac = Array.from(new Set(enlaces.map((e) => e.id_caracteristica)));
  const { data: catalogo } = await supabase
    .from("caracteristicas")
    .select("id, nombre")
    .in("id", idsCarac);
  const nombre = new Map((catalogo ?? []).map((c) => [c.id as number, c.nombre as string]));

  const salida: Record<string, string[]> = {};
  for (const e of enlaces) {
    const n = nombre.get(e.id_caracteristica);
    if (!n) continue;
    const clave = String(e.id_modelo);
    (salida[clave] ??= []).push(n);
  }
  for (const k of Object.keys(salida)) salida[k] = Array.from(new Set(salida[k]!)).sort();
  return salida;
}

async function propiedadesDeProyecto(
  idProyectoTexto: string,
  vinculos: VinculoEdificioModelo[],
  idProyecto: number,
): Promise<Propiedad[]> {
  const filas = await enLotes(
    vinculos.map((v) => v.id),
    async (lote) => {
      const { data } = await supabase
        .from("propiedades")
        .select(
          "id, id_edificio_modelo, id_vista, id_tipo_transaccion, id_tipo_propiedad, " +
            "id_estatus_disponibilidad, id_entidad_relacionada_dueno, numero_propiedad, " +
            "numero_piso, m2_interiores, m2_exteriores, m2_loft, precio_lista",
        )
        .in("id_edificio_modelo", lote as number[])
        .eq("activo", true);
      // La lista de columnas se arma por concatenación, así que los tipos
      // generados no la pueden inferir y hay que pasar por `unknown`.
      return (data ?? []) as unknown as Array<Record<string, unknown>>;
    },
  );
  if (!filas.length) return [];

  const idsPropiedad = filas.map((f) => f.id as number);

  const [vistas, estatus, tiposPropiedad, tiposTransaccion, cajones, bodegas, extras] =
    await Promise.all([
      catalogoVistas(idProyecto),
      indexarCatalogo(supabase.from("estatus_disponibilidad").select("id, nombre")),
      indexarCatalogo(supabase.from("tipos_propiedad").select("id, nombre")),
      indexarCatalogo(supabase.from("tipos_transaccion").select("id, nombre")),
      cajonesPorPropiedad(idsPropiedad),
      bodegasPorPropiedad(idsPropiedad),
      extrasPorPropiedad(idsPropiedad),
    ]);

  const vinculoPorId = new Map(vinculos.map((v) => [v.id, v]));

  return filas.map((f) => {
    const vinculo = vinculoPorId.get(f.id_edificio_modelo as number);
    const id = String(f.id);
    const cajon = cajones[id] ?? { total: 0, tandem: false };
    const bodega = bodegas[id] ?? { m2: 0 };

    return {
      id_propiedad: id,
      id_proyecto: idProyectoTexto,
      id_torre: vinculo ? String(vinculo.id_edificio) : "",
      id_modelo: vinculo ? String(vinculo.id_modelo) : "",
      numero: (f.numero_propiedad as string) ?? id,
      nivel: nivelDePiso(f.numero_piso),
      m2_interiores: num(f.m2_interiores),
      m2_exteriores: num(f.m2_exteriores),
      m2_loft: num(f.m2_loft),
      vista: vistas[String(f.id_vista ?? "")] ?? SIN_VISTA,
      orientacion: SIN_ORIENTACION,
      num_cajones: cajon.total,
      tipo_cajon: cajon.tandem ? "tandem" : "independiente",
      tiene_bodega: bodega.m2 > 0,
      m2_bodega: bodega.m2,
      caracteristicas_extra: extras[id] ?? [],
      // El dueño se resuelve en el módulo de Inventario; aquí no se muestra.
      propietario: "",
      tipo_transaccion: tiposTransaccion[String(f.id_tipo_transaccion ?? "")] ?? "",
      tipo_propiedad: tiposPropiedad[String(f.id_tipo_propiedad ?? "")] ?? "",
      estatus: estatus[String(f.id_estatus_disponibilidad ?? "")] ?? "",
      precio_lista_actual: num(f.precio_lista),
      activo: true,
    } satisfies Propiedad;
  });
}

/** `vistas` es un catálogo por proyecto: la misma clave puede no existir en otro. */
async function catalogoVistas(idProyecto: number): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("vistas")
    .select("id, nombre")
    .eq("id_proyecto", idProyecto)
    .eq("activo", true);
  return Object.fromEntries((data ?? []).map((v) => [String(v.id), v.nombre as string]));
}

/** `id → nombre` de un catálogo simple, a partir de su consulta ya construida. */
async function indexarCatalogo(
  consulta: PromiseLike<{ data: Array<{ id: number; nombre: string }> | null }>,
): Promise<Record<string, string>> {
  const { data } = await consulta;
  return Object.fromEntries((data ?? []).map((r) => [String(r.id), r.nombre]));
}

/**
 * Cajones de cada unidad. Basta con que uno sea tándem para que el cajón se
 * cobre al factor de tándem: es el criterio con el que el motor descuenta.
 */
async function cajonesPorPropiedad(
  ids: number[],
): Promise<Record<string, { total: number; tandem: boolean }>> {
  const filas = await enLotes(ids, async (lote) => {
    const { data } = await supabase
      .from("estacionamientos")
      .select("id_propiedad, id_tipo")
      .in("id_propiedad", lote as number[])
      .eq("activo", true);
    return (data ?? []) as Array<{ id_propiedad: number; id_tipo: number | null }>;
  });

  const salida: Record<string, { total: number; tandem: boolean }> = {};
  for (const f of filas) {
    const k = String(f.id_propiedad);
    const acc = (salida[k] ??= { total: 0, tandem: false });
    acc.total += 1;
    if (f.id_tipo === TIPO_ESTACIONAMIENTO_TANDEM) acc.tandem = true;
  }
  return salida;
}

async function bodegasPorPropiedad(ids: number[]): Promise<Record<string, { m2: number }>> {
  const filas = await enLotes(ids, async (lote) => {
    const { data } = await supabase
      .from("bodegas")
      .select("id_propiedad, m2")
      .in("id_propiedad", lote as number[])
      .eq("activo", true);
    return (data ?? []) as Array<{ id_propiedad: number; m2: number | null }>;
  });

  const salida: Record<string, { m2: number }> = {};
  for (const f of filas) {
    const k = String(f.id_propiedad);
    (salida[k] ??= { m2: 0 }).m2 += num(f.m2);
  }
  return salida;
}

/**
 * Extras **de la unidad**, no de su modelo.
 *
 * Las características del modelo ya están dentro de su precio base por m², así
 * que meterlas aquí las cobraría dos veces. `f_extras` solo debe recoger lo que
 * una unidad tiene por encima de su modelo (`propiedades_caracteristicas`).
 */
async function extrasPorPropiedad(ids: number[]): Promise<Record<string, string[]>> {
  const enlaces = await enLotes(ids, async (lote) => {
    const { data } = await supabase
      .from("propiedades_caracteristicas")
      .select("id_propiedad, id_caracteristica")
      .in("id_propiedad", lote as number[])
      .eq("activo", true);
    return (data ?? []) as Array<{ id_propiedad: number; id_caracteristica: number }>;
  });
  if (!enlaces.length) return {};

  const { data: catalogo } = await supabase
    .from("caracteristicas")
    .select("id, nombre")
    .in("id", Array.from(new Set(enlaces.map((e) => e.id_caracteristica))));
  const nombre = new Map((catalogo ?? []).map((c) => [c.id as number, c.nombre as string]));

  const salida: Record<string, string[]> = {};
  for (const e of enlaces) {
    const n = nombre.get(e.id_caracteristica);
    if (!n) continue;
    (salida[String(e.id_propiedad)] ??= []).push(n);
  }
  return salida;
}

/** Catálogo de extras que el motor puede tarifar: el real, no una lista fija. */
export async function obtenerCatalogoExtras(): Promise<string[]> {
  const { data } = await supabase
    .from("caracteristicas")
    .select("nombre")
    .eq("activo", true)
    .order("nombre");
  return (data ?? []).map((c) => c.nombre as string);
}
