import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OfertaVigente } from "../types/dominio";

interface EstadoOfertas {
  ofertas: OfertaVigente[];
}

const estadoInicial: EstadoOfertas = { ofertas: [] };

export interface DatosOferta {
  id_proyecto: string;
  id_propiedad: string;
  precio_ofertado: number;
  id_esquema: string;
  nombre_esquema: string;
  descuento_adicional: number;
  vigencia_dias: number;
  referencia_cliente: string;
  notas: string;
  emitida_por: OfertaVigente["emitida_por"];
}

interface AccionesOfertas {
  registrar: (datos: DatosOferta) => OfertaVigente;
  cancelar: (idOferta: string, motivo: string) => boolean;
  marcarConvertida: (idOferta: string) => void;
  /** Mueve a 'vencida' toda oferta cuya fecha ya pasó. Devuelve las afectadas (ya con estado 'vencida'). */
  recalcularVencimientos: () => OfertaVigente[];
  reset: () => void;
}

function normalizar(estado: unknown): EstadoOfertas {
  const s = (estado ?? {}) as Partial<EstadoOfertas>;
  return { ofertas: Array.isArray(s.ofertas) ? s.ofertas : [] };
}

export const useOfertasStore = create<EstadoOfertas & AccionesOfertas>()(
  persist(
    (set, get) => ({
      ...structuredClone(estadoInicial),

      registrar: (datos) => {
        const emitida = new Date();
        const vence = new Date(emitida);
        vence.setDate(vence.getDate() + datos.vigencia_dias);
        const oferta: OfertaVigente = {
          id_oferta: `of-${emitida.getTime()}-${Math.floor(Math.random() * 1000)}`,
          id_proyecto: datos.id_proyecto,
          id_propiedad: datos.id_propiedad,
          precio_ofertado: datos.precio_ofertado,
          id_esquema: datos.id_esquema,
          nombre_esquema: datos.nombre_esquema,
          descuento_adicional: datos.descuento_adicional,
          emitida_en: emitida.toISOString(),
          vigencia_dias: datos.vigencia_dias,
          vence_en: vence.toISOString(),
          estado: "vigente",
          emitida_por: datos.emitida_por,
          referencia_cliente: datos.referencia_cliente,
          notas: datos.notas,
          cancelada_en: null,
          motivo_cancelacion: null,
          convertida_en: null,
        };
        set((s) => ({ ...s, ofertas: [...s.ofertas, oferta] }));
        return oferta;
      },

      cancelar: (idOferta, motivo) => {
        if (motivo.trim().length < 20) return false;
        const ahora = new Date().toISOString();
        set((s) => ({
          ...s,
          ofertas: s.ofertas.map((o) =>
            o.id_oferta === idOferta && o.estado === "vigente"
              ? {
                  ...o,
                  estado: "cancelada",
                  cancelada_en: ahora,
                  motivo_cancelacion: motivo.trim(),
                }
              : o,
          ),
        }));
        return true;
      },

      marcarConvertida: (idOferta) => {
        const ahora = new Date().toISOString();
        set((s) => ({
          ...s,
          ofertas: s.ofertas.map((o) =>
            o.id_oferta === idOferta && o.estado === "vigente"
              ? { ...o, estado: "convertida", convertida_en: ahora }
              : o,
          ),
        }));
      },

      recalcularVencimientos: () => {
        const ahora = Date.now();
        const vencidas = get().ofertas.filter(
          (o) => o.estado === "vigente" && new Date(o.vence_en).getTime() < ahora,
        );
        if (vencidas.length === 0) return [];
        const ids = new Set(vencidas.map((o) => o.id_oferta));
        set((s) => ({
          ...s,
          ofertas: s.ofertas.map((o) =>
            ids.has(o.id_oferta) ? { ...o, estado: "vencida" } : o,
          ),
        }));
        return vencidas.map((o) => ({ ...o, estado: "vencida" as const }));
      },

      reset: () => set(structuredClone(estadoInicial)),
    }),
    {
      name: "sozu-precios-ofertas",
      version: 1,
      migrate: (persistido) => normalizar(persistido) as never,
      merge: (persistido, actual) => ({ ...actual, ...normalizar(persistido) }),
    },
  ),
);

/** Ids de propiedades con oferta vigente (no vencida) en el proyecto dado. */
export function idsConOfertaVigente(
  ofertas: OfertaVigente[],
  idProyecto: string,
): Set<string> {
  const ahora = Date.now();
  return new Set(
    ofertas
      .filter(
        (o) =>
          o.id_proyecto === idProyecto &&
          o.estado === "vigente" &&
          new Date(o.vence_en).getTime() >= ahora,
      )
      .map((o) => o.id_propiedad),
  );
}

/**
 * Ids de propiedades cuya oferta fue marcada como convertida pero el estatus del
 * inventario (Apartada/Vendida) todavía no se actualiza para reflejarlo.
 */
export function idsConConversionPendiente(
  ofertas: OfertaVigente[],
  idProyecto: string,
  estatusPropiedad: (idPropiedad: string) => string | undefined,
): Set<string> {
  const resultado = new Set<string>();
  for (const o of ofertas) {
    if (o.id_proyecto !== idProyecto || o.estado !== "convertida") continue;
    const estatus = estatusPropiedad(o.id_propiedad);
    if (estatus !== "Apartada" && estatus !== "Vendida") {
      resultado.add(o.id_propiedad);
    }
  }
  return resultado;
}

/** Devuelve la oferta convertida (si existe) cuyo inventario sigue sin actualizarse. */
export function ofertaConConversionPendiente(
  ofertas: OfertaVigente[],
  idPropiedad: string,
  estatusPropiedad: string | undefined,
): OfertaVigente | null {
  if (estatusPropiedad === "Apartada" || estatusPropiedad === "Vendida") return null;
  return (
    ofertas.find(
      (o) => o.id_propiedad === idPropiedad && o.estado === "convertida",
    ) ?? null
  );
}
