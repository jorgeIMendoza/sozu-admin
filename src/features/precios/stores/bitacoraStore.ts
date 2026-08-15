import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventoAuditoria } from "../types/dominio";
import {
  HASH_GENESIS,
  crearEvento,
  verificarCadena,
  type DatosEventoBase,
  type ResultadoVerificacion,
} from "../engine/bitacora";

interface EstadoBitacora {
  eventos: EventoAuditoria[];
  ultimaSecuencia: number;
  ultimoHash: string;
}

const estadoInicial: EstadoBitacora = {
  eventos: [],
  ultimaSecuencia: 0,
  ultimoHash: HASH_GENESIS,
};

interface AccionesBitacora {
  /** Único punto de escritura. No existe edición ni borrado de eventos. */
  registrar: (datos: DatosEventoBase) => Promise<EventoAuditoria>;
  verificar: () => Promise<ResultadoVerificacion>;
  /** La bitácora es inmutable por diseño: reset() siempre lanza. */
  reset: () => never;
}

function normalizar(estado: unknown): EstadoBitacora {
  const s = (estado ?? {}) as Partial<EstadoBitacora>;
  const eventos = Array.isArray(s.eventos) ? s.eventos : [];
  const ordenados = [...eventos].sort((a, b) => a.secuencia - b.secuencia);
  const ultimo = ordenados[ordenados.length - 1];
  return {
    eventos: ordenados,
    ultimaSecuencia: ultimo?.secuencia ?? 0,
    ultimoHash: ultimo?.hash ?? HASH_GENESIS,
  };
}

export const useBitacoraStore = create<EstadoBitacora & AccionesBitacora>()(
  persist(
    (set, get) => ({
      ...structuredClone(estadoInicial),

      registrar: async (datos) => {
        const { ultimaSecuencia, ultimoHash } = get();
        const evento = await crearEvento(datos, ultimoHash, ultimaSecuencia + 1);
        set((s) => ({
          ...s,
          eventos: [...s.eventos, evento],
          ultimaSecuencia: evento.secuencia,
          ultimoHash: evento.hash,
        }));
        return evento;
      },

      verificar: async () => verificarCadena(get().eventos),

      reset: () => {
        throw new Error(
          "La bitácora no admite reinicio. Los eventos de auditoría son inmutables por diseño.",
        );
      },
    }),
    {
      name: "sozu-precios-bitacora",
      version: 1,
      migrate: (persistido) => normalizar(persistido) as never,
      merge: (persistido, actual) => ({ ...actual, ...normalizar(persistido) }),
    },
  ),
);
