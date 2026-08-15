/**
 * MIGRACIÓN A SUPABASE — REQUIERE FIRMA DE JORGE
 *
 * Tablas requeridas (plural, snake_case, consistente con el esquema vigente:
 * proyectos, propiedades, personas, cuentas_cobranza):
 *   versiones_lista        inmutable en estado 'publicada'; sin UPDATE ni DELETE
 *                          por política RLS una vez que estado = 'publicada'
 *   precios_version        snapshot por unidad y versión (FK a versiones_lista
 *                          y a propiedades)
 *   ofertas_vigentes       con índice sobre (id_propiedad, estado); referenciada
 *                          al evaluar bloqueos de publicación
 *
 * La publicación de una versión (transición borrador → publicada) DEBE ejecutarse
 * dentro de una Edge Function transaccional: valida las compuertas duras del lado
 * del servidor, escribe versiones_lista + precios_version, y registra el evento en
 * bitacora_precio, todo o nada. Nunca desde el cliente: un cliente que "confía" en
 * el navegador para congelar precios no es una fuente confiable de verdad.
 *
 * El vencimiento de ofertas (estado vigente → vencida) debe correr por pg_cron,
 * no calculado en cada render del cliente. El cliente puede mostrar "vence en N
 * días" a partir de vence_en, pero el estado autoritativo lo escribe el cron.
 *
 * DESAMBIGUACIÓN DE LLAVES FORÁNEAS: cuando varias FK apuntan a la misma tabla
 * (versiones_lista referencia personas dos veces: creada_por y publicada_por;
 * ofertas_vigentes referencia personas más de una vez), PostgREST no puede
 * inferir la relación. Nombrar el constraint explícitamente tanto en el
 * .select() del cliente como en SQL. Patrón vigente:
 *   personas!versiones_lista_publicada_por_fkey
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActorEvento, VersionLista } from "../types/dominio";

interface EstadoVersiones {
  versionesPorProyecto: Record<string, VersionLista[]>;
}

const estadoInicial: EstadoVersiones = { versionesPorProyecto: {} };

export type DatosVersion = Omit<
  VersionLista,
  "id_version" | "numero" | "estado" | "creada_en" | "publicada_en" | "publicada_por"
>;

interface AccionesVersiones {
  getVersiones: (idProyecto: string) => VersionLista[];
  getPublicada: (idProyecto: string) => VersionLista | null;
  crearBorrador: (datos: DatosVersion) => VersionLista;
  /**
   * Reemplaza el contenido de un borrador. Una versión publicada es inmutable
   * por diseño: cualquier intento de editarla es un error de programación,
   * no un caso de negocio a manejar en silencio.
   */
  actualizarBorrador: (
    idProyecto: string,
    idVersion: string,
    cambios: Partial<DatosVersion>,
  ) => boolean;
  publicar: (
    idProyecto: string,
    idVersion: string,
    actor: ActorEvento,
    notas: string,
  ) => boolean;
  /** Única transición permitida a partir de 'publicada'. */
  archivar: (idProyecto: string, idVersion: string) => boolean;
  reset: () => void;
}

function normalizar(estado: unknown): EstadoVersiones {
  const s = (estado ?? {}) as Partial<EstadoVersiones>;
  return { versionesPorProyecto: s.versionesPorProyecto ?? {} };
}

export const useVersionesStore = create<EstadoVersiones & AccionesVersiones>()(
  persist(
    (set, get) => {
      const mutar = (
        idProyecto: string,
        idVersion: string,
        fn: (v: VersionLista) => VersionLista,
      ): boolean => {
        const lista = get().versionesPorProyecto[idProyecto] ?? [];
        const actual = lista.find((v) => v.id_version === idVersion);
        if (!actual) return false;
        const siguiente = fn(actual);
        set((s) => ({
          ...s,
          versionesPorProyecto: {
            ...s.versionesPorProyecto,
            [idProyecto]: (s.versionesPorProyecto[idProyecto] ?? []).map((v) =>
              v.id_version === idVersion ? siguiente : v,
            ),
          },
        }));
        return true;
      };

      return {
        ...structuredClone(estadoInicial),

        getVersiones: (idProyecto) => get().versionesPorProyecto[idProyecto] ?? [],

        getPublicada: (idProyecto) => {
          const lista = get().versionesPorProyecto[idProyecto] ?? [];
          const publicadas = lista.filter((v) => v.estado === "publicada");
          return publicadas.length > 0
            ? publicadas.reduce((a, b) => (b.numero > a.numero ? b : a))
            : null;
        },

        crearBorrador: (datos) => {
          const lista = get().versionesPorProyecto[datos.id_proyecto] ?? [];
          const numero = lista.reduce((m, v) => Math.max(m, v.numero), 0) + 1;
          const version: VersionLista = {
            ...datos,
            id_version: `ver-${datos.id_proyecto}-${numero}-${Date.now()}`,
            numero,
            estado: "borrador",
            creada_en: new Date().toISOString(),
            publicada_en: null,
            publicada_por: null,
          };
          set((s) => ({
            ...s,
            versionesPorProyecto: {
              ...s.versionesPorProyecto,
              [datos.id_proyecto]: [...lista, version],
            },
          }));
          return version;
        },

        actualizarBorrador: (idProyecto, idVersion, cambios) =>
          mutar(idProyecto, idVersion, (v) => {
            if (v.estado === "publicada") {
              throw new Error(
                `La versión v${v.numero} está publicada y es inmutable: no puede editarse.`,
              );
            }
            return { ...v, ...cambios };
          }),

        publicar: (idProyecto, idVersion, actor, notas) =>
          mutar(idProyecto, idVersion, (v) => {
            if (v.estado !== "borrador") {
              throw new Error(
                `Solo un borrador puede publicarse. La versión v${v.numero} está en estado '${v.estado}'.`,
              );
            }
            return {
              ...v,
              estado: "publicada",
              publicada_en: new Date().toISOString(),
              publicada_por: actor,
              notas,
            };
          }),

        archivar: (idProyecto, idVersion) =>
          mutar(idProyecto, idVersion, (v) => ({ ...v, estado: "archivada" })),

        reset: () => set(structuredClone(estadoInicial)),
      };
    },
    {
      name: "sozu-precios-versiones",
      version: 1,
      migrate: (persistido) => normalizar(persistido) as never,
      merge: (persistido, actual) => ({ ...actual, ...normalizar(persistido) }),
    },
  ),
);
