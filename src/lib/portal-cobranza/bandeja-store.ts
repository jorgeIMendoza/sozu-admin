import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Filtros de la Bandeja Operativa de cobranza.
// Se persisten en sessionStorage para que sobrevivan navegación (ej. ir al
// detalle de una cuenta y volver) y recarga de página, pero se limpien al
// cerrar la pestaña. La data sigue viniendo de React Query (useBandejaOperativa);
// aquí solo vive el estado de filtros client-side.

export interface BandejaFiltros {
  proyectoId: number | null;
  searchClabe: string;
  searchCliente: string;
  searchUnidad: string;
  filtroTipo: string[];
  searchCuenta: string;
  filtroPrioridad: string[];
  filtroInvalidosNivel: string[];
}

const initialFiltros: BandejaFiltros = {
  proyectoId: null,
  searchClabe: '',
  searchCliente: '',
  searchUnidad: '',
  filtroTipo: [],
  searchCuenta: '',
  filtroPrioridad: [],
  filtroInvalidosNivel: [],
};

interface BandejaState extends BandejaFiltros {
  setFiltro: <K extends keyof BandejaFiltros>(key: K, value: BandejaFiltros[K]) => void;
  resetFiltros: () => void;
  hasFiltros: () => boolean;
}

export const useBandejaStore = create<BandejaState>()(
  persist(
    (set, get) => ({
      ...structuredClone(initialFiltros),
      setFiltro: (key, value) => set({ [key]: value } as Pick<BandejaFiltros, typeof key>),
      resetFiltros: () => set(structuredClone(initialFiltros)),
      hasFiltros: () => {
        const s = get();
        return (
          !!s.searchCliente || !!s.searchCuenta || !!s.searchUnidad ||
          !!s.searchClabe || s.filtroTipo.length > 0 || s.proyectoId !== null ||
          s.filtroPrioridad.length > 0 || s.filtroInvalidosNivel.length > 0
        );
      },
    }),
    {
      name: 'cobranza_bandeja_filtros_v1',
      storage: createJSONStorage(() => sessionStorage),
      // Solo persistir los campos de filtro, no las acciones.
      partialize: (s) => ({
        proyectoId: s.proyectoId,
        searchClabe: s.searchClabe,
        searchCliente: s.searchCliente,
        searchUnidad: s.searchUnidad,
        filtroTipo: s.filtroTipo,
        searchCuenta: s.searchCuenta,
        filtroPrioridad: s.filtroPrioridad,
        filtroInvalidosNivel: s.filtroInvalidosNivel,
      }),
    },
  ),
);
