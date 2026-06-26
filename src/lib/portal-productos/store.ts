import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CuentaProducto, GlobalFilters } from './types';

interface PortalProductosState {
  cuentas: CuentaProducto[];
  filtros: GlobalFilters;
  setCuentas: (c: CuentaProducto[]) => void;
  setFiltros: (f: Partial<GlobalFilters>) => void;
  resetFiltros: () => void;
  refrescar: () => void;
  reset: () => void;
}

const initialFiltros: GlobalFilters = {
  proyecto: 'all', propietario: 'all', categoria: 'all', rangoMeses: 0,
};

export const usePortalProductosStore = create<PortalProductosState>()(
  persist(
    (set, get) => ({
      // Las cuentas se cargan desde la BD real (useProductosReales) vía setCuentas.
      cuentas: [],
      filtros: structuredClone(initialFiltros),
      setCuentas: (c) => set({ cuentas: c }),
      setFiltros: (f) => set({ filtros: { ...get().filtros, ...f } }),
      resetFiltros: () => set({ filtros: structuredClone(initialFiltros) }),
      refrescar: () => set({ cuentas: [...get().cuentas] }),
      reset: () => set({ cuentas: [], filtros: structuredClone(initialFiltros) }),
    }),
    {
      name: 'portal_productos_v2',
      // Solo se persisten los filtros; las cuentas siempre vienen de la BD real.
      partialize: (s) => ({ filtros: s.filtros }),
    },
  ),
);
