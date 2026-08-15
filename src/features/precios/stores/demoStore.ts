import { create } from "zustand";

/**
 * Estado de las herramientas de demostración. No se persiste y solo se consume
 * detrás de import.meta.env.DEV.
 */
interface EstadoDemo {
  semilla: number;
  criticasForzadas: string[];
  regenerar: () => void;
  setCriticas: (ids: string[]) => void;
  limpiarCriticas: () => void;
}

export const useDemoStore = create<EstadoDemo>()((set) => ({
  semilla: 0,
  criticasForzadas: [],
  regenerar: () => set((s) => ({ ...s, semilla: s.semilla + 1 })),
  setCriticas: (ids) => set((s) => ({ ...s, criticasForzadas: ids })),
  limpiarCriticas: () => set((s) => ({ ...s, criticasForzadas: [] })),
}));
