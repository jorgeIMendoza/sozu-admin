import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mensualidades fijas de la Oferta Digital.
 *
 * `propiedades.mensualidades_fijas` y `proyectos.mensualidades_fijas` son columnas
 * `integer NULL`: NULL = modo dinámico (meses de hoy a la entrega menos 1, la regla
 * histórica); un número = modo fijo, esas mensualidades sin importar la fecha de
 * entrega. El pago a la escritura NO se cuenta ahí — 36 fijas = 36 mensualidades más ese pago.
 *
 * La unidad gana sobre el proyecto. Quien manda de verdad es el RPC
 * `get_oferta_financials`; esto es el espejo en TS para las vistas que no lo consumen
 * (inventario del agente, Propiedades, PDF comercial).
 *
 * Las lecturas van por su propio SELECT y no dentro de los grandes: mientras el DDL no
 * esté aplicado en el ambiente, meter la columna en esas listas tumbaría la pantalla
 * completa (PostgREST 42703). Aquí un error simplemente devuelve `null` = dinámico.
 */

/** Cache por id para no repetir el probe en cada render de una lista. */
const cacheProyecto = new Map<number, number | null>();
const cachePropiedad = new Map<number, number | null>();

function normalizar(valor: unknown): number | null {
  if (valor == null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
}

/** Mensualidades fijas configuradas en el proyecto. `null` = dinámico. */
export async function getMensualidadesFijasProyecto(
  proyectoId: number | null | undefined,
): Promise<number | null> {
  if (!proyectoId) return null;
  if (cacheProyecto.has(proyectoId)) return cacheProyecto.get(proyectoId) ?? null;

  const { data, error } = await (supabase as any)
    .from("proyectos")
    .select("mensualidades_fijas")
    .eq("id", proyectoId)
    .maybeSingle();

  // Columna aún no desplegada en este ambiente → dinámico, sin ruido en consola.
  const valor = error ? null : normalizar((data as any)?.mensualidades_fijas);
  cacheProyecto.set(proyectoId, valor);
  return valor;
}

/** Override por unidad. `null` = hereda del proyecto. */
export async function getMensualidadesFijasPropiedad(
  propiedadId: number | null | undefined,
): Promise<number | null> {
  if (!propiedadId) return null;
  if (cachePropiedad.has(propiedadId)) return cachePropiedad.get(propiedadId) ?? null;

  const { data, error } = await (supabase as any)
    .from("propiedades")
    .select("mensualidades_fijas")
    .eq("id", propiedadId)
    .maybeSingle();

  const valor = error ? null : normalizar((data as any)?.mensualidades_fijas);
  cachePropiedad.set(propiedadId, valor);
  return valor;
}

/**
 * Cascada completa: unidad → proyecto → `null` (dinámico). Mismo orden que el
 * `COALESCE` del RPC.
 */
export async function resolverMensualidadesFijas(
  propiedadId: number | null | undefined,
  proyectoId: number | null | undefined,
): Promise<number | null> {
  const porUnidad = await getMensualidadesFijasPropiedad(propiedadId);
  if (porUnidad != null) return porUnidad;
  return getMensualidadesFijasProyecto(proyectoId);
}

/**
 * Versión hook de `resolverMensualidadesFijas`, para componentes que renderizan planes
 * de pago (plantillas de PDF). Devuelve `null` mientras carga → modo dinámico, que es
 * lo que se pintaba antes de esta configuración.
 */
export function useMensualidadesFijas(
  propiedadId: number | null | undefined,
  proyectoId: number | null | undefined,
): number | null {
  const { data } = useQuery({
    queryKey: ["mensualidades-fijas", propiedadId ?? null, proyectoId ?? null],
    queryFn: () => resolverMensualidadesFijas(propiedadId, proyectoId),
    enabled: !!(propiedadId || proyectoId),
    staleTime: 5 * 60 * 1000,
  });
  return data ?? null;
}

/** Invalida el cache tras editar la configuración del proyecto. */
export function invalidarMensualidadesFijas(proyectoId?: number | null): void {
  if (proyectoId) cacheProyecto.delete(proyectoId);
  else cacheProyecto.clear();
  cachePropiedad.clear();
}
