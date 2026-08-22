import { supabase } from "@/integrations/supabase/client";
import type { ActorEvento, VersionLista } from "../types/dominio";
import type { DatosVersion } from "../stores/versionesStore";
import { ACTOR_ACTUAL } from "./auditoria";

/**
 * ESCENARIOS DE PRECIOS COMPARTIDOS
 *
 * Los escenarios vivían en `localStorage`: lo que guardaba un analista no
 * existía para nadie más, ni para quien tenía que aprobarlo. Este servicio los
 * lleva a `versiones_lista`, donde todos ven los de todos y el Super
 * Administrador puede revisar el trabajo de cualquiera.
 *
 * La tabla la crea `20260821_versiones_lista_escenarios_compartidos.md`, que no
 * se puede ejecutar desde aquí. Hasta que se aplique, el módulo sigue guardando
 * en el navegador; `soportaVersionesCompartidas` es lo que decide cuál de los
 * dos caminos se toma.
 */

const COLUMNAS =
  "id, id_proyecto, numero, nombre, estado, creada_en, creada_por, " +
  "creada_por_nombre, creada_por_rol, publicada_en, publicada_por, " +
  "publicada_por_nombre, snapshot_motor, precios, unidades_incluidas, " +
  "unidades_excluidas, valor_total, notas";

/**
 * ¿La tabla existe?
 *
 * Se memoriza por sesión: una tabla no aparece a media sesión, y preguntarlo en
 * cada guardado agregaría un viaje de red a cada acción.
 */
let soporte: boolean | null = null;
export async function soportaVersionesCompartidas(): Promise<boolean> {
  if (soporte !== null) return soporte;
  const { error } = await (supabase as any)
    .from("versiones_lista")
    .select("id")
    .limit(0);
  soporte = !error;
  return soporte;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Fila de la base a la forma que usa el módulo.
 *
 * El nombre y el rol del autor viajan copiados en la fila, no resueltos contra
 * `usuarios`: así la lista se lee de un tirón y sigue diciendo quién hizo qué
 * aunque esa persona se dé de baja.
 */
function aVersion(f: Record<string, unknown>): VersionLista {
  const autor: ActorEvento = {
    id_persona: String(f.creada_por ?? ""),
    nombre: (f.creada_por_nombre as string) || "Sin identificar",
    rol: (f.creada_por_rol as string) || "—",
  };
  const publicador: ActorEvento | null = f.publicada_por
    ? {
        id_persona: String(f.publicada_por),
        nombre: (f.publicada_por_nombre as string) || "Sin identificar",
        rol: "—",
      }
    : null;

  return {
    id_version: String(f.id),
    id_proyecto: String(f.id_proyecto),
    numero: num(f.numero),
    nombre: (f.nombre as string) ?? "",
    estado: (f.estado as VersionLista["estado"]) ?? "borrador",
    creada_en: String(f.creada_en ?? new Date().toISOString()),
    creada_por: autor,
    publicada_en: f.publicada_en ? String(f.publicada_en) : null,
    publicada_por: publicador,
    snapshot_motor: (f.snapshot_motor ?? {}) as VersionLista["snapshot_motor"],
    precios: (f.precios ?? {}) as VersionLista["precios"],
    unidades_incluidas: (f.unidades_incluidas ?? []) as string[],
    unidades_excluidas: (f.unidades_excluidas ?? []) as VersionLista["unidades_excluidas"],
    valor_total: num(f.valor_total),
    notas: (f.notas as string) ?? "",
  };
}

/** Todos los escenarios del proyecto, del más nuevo al más viejo. */
export async function listarVersiones(idProyecto: string): Promise<VersionLista[]> {
  const id = Number(idProyecto);
  if (!Number.isFinite(id)) return [];
  const { data, error } = await (supabase as any)
    .from("versiones_lista")
    .select(COLUMNAS)
    .eq("id_proyecto", id)
    .order("numero", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(aVersion);
}

/**
 * Alta de un escenario.
 *
 * No se manda `numero` ni `creada_por`: el número lo asigna un trigger por
 * proyecto —calcularlo aquí daría dos v3 si dos personas guardan a la vez— y el
 * autor sale de `auth.uid()` por DEFAULT, que además es lo que la política de
 * RLS exige para dejar insertar.
 */
export async function crearVersionReal(datos: DatosVersion): Promise<VersionLista> {
  const { data, error } = await (supabase as any)
    .from("versiones_lista")
    .insert({
      id_proyecto: Number(datos.id_proyecto),
      nombre: datos.nombre,
      estado: "borrador",
      creada_por_nombre: ACTOR_ACTUAL.nombre,
      creada_por_rol: ACTOR_ACTUAL.rol,
      snapshot_motor: datos.snapshot_motor,
      precios: datos.precios,
      unidades_incluidas: datos.unidades_incluidas,
      unidades_excluidas: datos.unidades_excluidas,
      valor_total: datos.valor_total,
      notas: datos.notas,
    })
    .select(COLUMNAS)
    .single();
  if (error) throw new Error(error.message);
  return aVersion(data as Record<string, unknown>);
}

/**
 * Edición de un borrador.
 *
 * Si la versión está publicada, el trigger de la base la rechaza. Se deja que
 * falle ahí y no aquí: una regla que solo vive en el front deja de aplicarse en
 * cuanto alguien escribe desde otro lado.
 */
export async function actualizarVersionReal(
  idVersion: string,
  cambios: Partial<DatosVersion>,
): Promise<void> {
  const fila: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) fila.nombre = cambios.nombre;
  if (cambios.notas !== undefined) fila.notas = cambios.notas;
  if (cambios.snapshot_motor !== undefined) fila.snapshot_motor = cambios.snapshot_motor;
  if (cambios.precios !== undefined) fila.precios = cambios.precios;
  if (cambios.unidades_incluidas !== undefined) {
    fila.unidades_incluidas = cambios.unidades_incluidas;
  }
  if (cambios.unidades_excluidas !== undefined) {
    fila.unidades_excluidas = cambios.unidades_excluidas;
  }
  if (cambios.valor_total !== undefined) fila.valor_total = cambios.valor_total;
  if (Object.keys(fila).length === 0) return;

  const { error } = await (supabase as any)
    .from("versiones_lista")
    .update(fila)
    .eq("id", Number(idVersion));
  if (error) throw new Error(error.message);
}

/**
 * Publicar.
 *
 * El uuid de quien publica se toma de la sesión y no del actor que llega por
 * parámetro: ese trae el nombre para mostrar, pero quién firmó una lista con la
 * que se vende tiene que quedar atado a la identidad real, no a una cadena.
 */
export async function publicarVersionReal(
  idVersion: string,
  actor: ActorEvento,
  notas: string,
): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from("versiones_lista")
    .update({
      estado: "publicada",
      publicada_en: new Date().toISOString(),
      publicada_por: sesion?.user?.id ?? null,
      publicada_por_nombre: actor.nombre,
      notas,
    })
    .eq("id", Number(idVersion));
  if (error) throw new Error(error.message);
}

/** Retirar un escenario es archivarlo. No hay borrado: la tabla no tiene DELETE. */
export async function archivarVersionReal(idVersion: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("versiones_lista")
    .update({ estado: "archivada" })
    .eq("id", Number(idVersion));
  if (error) throw new Error(error.message);
}
