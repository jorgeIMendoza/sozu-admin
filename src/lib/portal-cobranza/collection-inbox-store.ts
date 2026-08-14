import { crearStoreFiltros } from '@/lib/filtrosPersistentes';

/**
 * Filtros del menú Cuentas de Cobranza (portal de cobranza).
 *
 * Construido sobre `crearStoreFiltros`, el único mecanismo de filtros persistidos del proyecto:
 * sobreviven navegación y recarga, y se limpian solo al cerrar sesión o con el botón de limpiar.
 * Los datos siguen viniendo de React Query (`useCollectionAccounts`); aquí solo vive el estado
 * de filtros y de tabla.
 */
export const filtrosCuentasCobranza = crearStoreFiltros('pcobranza_cuentas_cobranza', {
  projectId: null as number | null,
  searchClabe: '',
  searchClient: '',
  searchUnit: '',
  filterType: [] as string[],
  searchAccount: '',
  filterPriority: [] as string[],
  filterInvalidLevel: [] as string[],
  filterModel: [] as string[],
  filterStatus: [] as string[],
  // Estado de tabla: parte de "dónde iba" el usuario, se conserva igual que los filtros.
  page: 1,
  advancedOpen: false,
  sort: { key: null as string | null, dir: 'asc' as 'asc' | 'desc' },
});
