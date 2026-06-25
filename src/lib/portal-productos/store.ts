import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CuentaProducto, GlobalFilters } from './types';
import { generarSeed } from './seed';

interface PortalProductosState {
  cuentas: CuentaProducto[];
  filtros: GlobalFilters;
  setFiltros: (f: Partial<GlobalFilters>) => void;
  resetFiltros: () => void;
  refrescar: () => void;
  reset: () => void;
}

const initialFiltros: GlobalFilters = {
  proyecto: 'all', propietario: 'all', categoria: 'all', rangoMeses: 0,
};

const initialState = {
  cuentas: [] as CuentaProducto[],
  filtros: structuredClone(initialFiltros),
};

export const usePortalProductosStore = create<PortalProductosState>()(
  persist(
    (set, get) => ({
      ...structuredClone(initialState),
      setFiltros: (f) => set({ filtros: { ...get().filtros, ...f } }),
      resetFiltros: () => set({ filtros: structuredClone(initialFiltros) }),
      refrescar: () => {
        set({ cuentas: [...get().cuentas] });
      },
      reset: () => {
        set({ ...structuredClone(initialState), cuentas: generarSeed() });
      },
    }),
    {
      name: 'portal_productos_mock_v1',
      onRehydrateStorage: () => (state) => {
        if (state && (!state.cuentas || state.cuentas.length === 0)) {
          state.cuentas = generarSeed();
        }
      },
    },
  ),
);