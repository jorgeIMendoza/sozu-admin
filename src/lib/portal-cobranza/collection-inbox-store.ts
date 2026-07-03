import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Filter state for the Cuentas de Cobranza menu.
// Persisted in localStorage: they are the user's settings, so they don't have to
// re-enter them. They survive navigation, reload AND closing the tab; they are
// cleared ONLY by an explicit user decision:
//   - the user signs out (clearCollectionFilters() in the logout flow), or
//   - the user clears them (clear button / resetFilters).
// Data still comes from React Query (useCollectionAccounts); this store only
// holds the client-side filter state.

// Nombrado como las funciones del portal: p<portal>_<menu>_...
const STORAGE_KEY = 'pcobranza_cuentas_cobranza_filters';

export interface CollectionFilters {
  projectId: number | null;
  searchClabe: string;
  searchClient: string;
  searchUnit: string;
  filterType: string[];
  searchAccount: string;
  filterPriority: string[];
  filterInvalidLevel: string[];
  filterModel: string[];
  filterStatus: string[];
}

const initialFilters: CollectionFilters = {
  projectId: null,
  searchClabe: '',
  searchClient: '',
  searchUnit: '',
  filterType: [],
  searchAccount: '',
  filterPriority: [],
  filterInvalidLevel: [],
  filterModel: [],
  filterStatus: [],
};

interface CollectionFilterState extends CollectionFilters {
  setFilter: <K extends keyof CollectionFilters>(key: K, value: CollectionFilters[K]) => void;
  resetFilters: () => void;
  hasFilters: () => boolean;
}

export const useCollectionInboxStore = create<CollectionFilterState>()(
  persist(
    (set, get) => ({
      ...structuredClone(initialFilters),
      setFilter: (key, value) => set({ [key]: value } as Pick<CollectionFilters, typeof key>),
      resetFilters: () => set(structuredClone(initialFilters)),
      hasFilters: () => {
        const s = get();
        return (
          !!s.searchClient || !!s.searchAccount || !!s.searchUnit ||
          !!s.searchClabe || s.filterType.length > 0 || s.projectId !== null ||
          s.filterPriority.length > 0 || s.filterInvalidLevel.length > 0 ||
          s.filterModel.length > 0 || s.filterStatus.length > 0
        );
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist only the filter fields, not the actions.
      partialize: (s) => ({
        projectId: s.projectId,
        searchClabe: s.searchClabe,
        searchClient: s.searchClient,
        searchUnit: s.searchUnit,
        filterType: s.filterType,
        searchAccount: s.searchAccount,
        filterPriority: s.filterPriority,
        filterInvalidLevel: s.filterInvalidLevel,
        filterModel: s.filterModel,
        filterStatus: s.filterStatus,
      }),
    },
  ),
);

// Clears the persisted filters. Call on logout so they don't survive a user
// switch in the same tab.
export function clearCollectionFilters() {
  try {
    useCollectionInboxStore.getState().resetFilters();
    useCollectionInboxStore.persist?.clearStorage?.();
  } catch {
    // no-op: if storage is unavailable, the in-memory reset is enough.
  }
}
