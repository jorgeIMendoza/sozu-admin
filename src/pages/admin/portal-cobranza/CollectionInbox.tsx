import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionAccounts, CollectionAccount } from '@/hooks/useCollectionAccounts';
import { useCollectionInboxStore } from '@/lib/portal-cobranza/collection-inbox-store';
import { CobranzaProjectFilter } from '@/components/admin/portal-cobranza/CobranzaProjectFilter';
import { useProyectosCobranza } from '@/hooks/useCobranzaDashboard';
import { formatCuentaCobranzaId } from '@/utils/cuentaCobranzaUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ArrowUpDown, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { CollectionLoading, CollectionError } from '@/components/admin/portal-cobranza/CollectionStates';
import { cn } from '@/lib/utils';
import {
  TipoMultiSelect, nivelDeParcialidades, type TipoCategoria,
} from '@/components/admin/portal-cobranza/CobranzaFilterSelects';
import { CollectionAdvancedFilters } from '@/components/admin/portal-cobranza/CollectionAdvancedFilters';

const PAGE_SIZE = 15;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtCurrencyExact(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

// Derives the display category (shared TipoCategoria values stay in Spanish
// because they are shown to the user and feed the shared TipoMultiSelect).
function accountType(row: CollectionAccount): TipoCategoria {
  if (row.tipo_cuenta === 'Mantenimiento') return 'Mantenimiento';
  if (row.tipo_cuenta === 'Propiedad') return 'Propiedad';
  const pn = (row.producto_nombre ?? '').toLowerCase();
  if (pn.includes('bodega')) return 'Bodega';
  if (pn.includes('estacionamiento')) return 'Estacionamiento';
  return 'Producto';
}

function typeTextClass(type: TipoCategoria) {
  return {
    Propiedad:       'text-sky-700',
    Bodega:          'text-amber-700',
    Estacionamiento: 'text-emerald-700',
    Producto:        'text-violet-700',
    Mantenimiento:   'text-teal-700',
  }[type];
}

function overdueStyle(daysLate: number): string {
  if (daysLate === 0) return 'text-emerald-600';
  if (daysLate < 30)  return 'text-amber-500 font-medium';
  return 'text-red-600 font-semibold';
}

function statusTextClass(status: string | null): string {
  return ({
    'Inventario':    'text-slate-500',
    'Disponible':    'text-sky-600',
    'Apartada':      'text-amber-600',
    'Vendido':       'text-emerald-600',
    'Escrituración': 'text-violet-600',
  } as Record<string, string>)[status ?? ''] ?? 'text-muted-foreground';
}

// Sortable columns and their accessor. Adding one = one line here.
type SortKey = 'account' | 'client' | 'price' | 'overdue' | 'pending'
  | 'installments' | 'invalid' | 'daysLate';

const SORT_ACCESSORS: Record<SortKey, (r: CollectionAccount) => number | string> = {
  account:      r => r.cuenta_id,
  client:       r => (r.cliente_nombre ?? '').toLowerCase(),
  price:        r => r.precio_final ?? 0,
  overdue:      r => r.monto_vencido,
  pending:      r => r.saldo_pendiente,
  installments: r => r.parcialidades_vencidas,
  invalid:      r => r.invalidos ?? 0,
  daysLate:     r => r.dias_sin_pagar,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

// Sortable column header. Click toggles asc/desc.
function SortHeader({
  label, sortKey, sort, onSort, thClass, align = 'center',
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey | null; dir: 'asc' | 'desc' };
  onSort: (k: SortKey) => void;
  thClass?: string;
  align?: 'center' | 'right';
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cn(align === 'right' ? '!text-right' : 'text-center', thClass)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1.5 uppercase select-none transition-colors',
          active ? 'text-success font-semibold' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        <ArrowUpDown
          strokeWidth={2.25}
          className={cn('size-3.5 shrink-0', active ? 'text-success' : 'text-muted-foreground/50')}
        />
      </button>
    </th>
  );
}

// Small colored count badge (shared style between invalid payments and overdue installments).
function CountCircle({ n }: { n: number }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center size-[22px] rounded-full text-[10px] font-bold tabular-nums leading-none select-none',
      n === 0 ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
              : n >= 3 ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
              : n === 2 ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
              : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    )}>
      {n}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CollectionInboxPage() {
  const navigate = useNavigate();
  // Filters in localStorage: cleared only by user decision (logout or clear button).
  const {
    projectId, searchClabe, searchClient, searchUnit,
    filterType, searchAccount, filterPriority, filterInvalidLevel,
    filterModel, filterStatus,
    setFilter, resetFilters,
  } = useCollectionInboxStore();
  const setProjectId          = (v: number | null) => setFilter('projectId', v);
  const setSearchClabe        = (v: string)        => setFilter('searchClabe', v);
  const setSearchClient       = (v: string)        => setFilter('searchClient', v);
  const setSearchUnit         = (v: string)        => setFilter('searchUnit', v);
  const setFilterType         = (v: string[])      => setFilter('filterType', v);
  const setSearchAccount      = (v: string)        => setFilter('searchAccount', v);
  const setFilterPriority     = (v: string[])      => setFilter('filterPriority', v);
  const setFilterInvalidLevel = (v: string[])      => setFilter('filterInvalidLevel', v);
  const setFilterModel        = (v: string[])      => setFilter('filterModel', v);
  const setFilterStatus       = (v: string[])      => setFilter('filterStatus', v);
  const [page, setPage] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Table sort. key=null → default criticality order.
  const [sort, setSort] = useState<{ key: SortKey | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });
  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const { data: projects } = useProyectosCobranza();
  const { data: rawData, isLoading, isError, refetch } = useCollectionAccounts({ projectId });

  // Filter options derived from the actual data (distinct). "They come from the DB".
  const options = useMemo(() => {
    const types = new Set<string>(), statuses = new Set<string>(), models = new Set<string>();
    for (const r of rawData ?? []) {
      types.add(accountType(r));
      if (r.estatus_propiedad) statuses.add(r.estatus_propiedad);
      if (r.modelo) models.add(r.modelo);
    }
    const sortEs = (a: string, b: string) => a.localeCompare(b, 'es');
    return {
      types:    [...types].sort(sortEs),
      statuses: [...statuses].sort(sortEs),
      models:   [...models].sort(sortEs),
    };
  }, [rawData]);

  // Client-side filter + sort (chosen sort, else criticality).
  const filtered = useMemo(() => {
    if (!rawData) return [];
    const cl = searchClient.toLowerCase().trim();
    const ac = searchAccount.toLowerCase().trim();
    const un = searchUnit.toLowerCase().trim();
    const cb = searchClabe.toLowerCase().trim();
    const rows = rawData.filter(r => {
      if (cl && !(r.cliente_nombre ?? '').toLowerCase().includes(cl)
               && !(r.cliente_email ?? '').toLowerCase().includes(cl)) return false;
      if (ac) {
        const fmt = formatCuentaCobranzaId(r.cuenta_id).toLowerCase();
        if (!fmt.includes(ac) && !String(r.cuenta_id).includes(ac)) return false;
      }
      if (un && !(r.numero_propiedad ?? '').toLowerCase().includes(un)) return false;
      if (cb && !(r.clabe_stp ?? '').toLowerCase().includes(cb)) return false;
      if (filterModel.length > 0 && !filterModel.includes(r.modelo ?? '')) return false;
      if (filterType.length > 0 && !filterType.includes(accountType(r))) return false;
      if (filterPriority.length > 0 && !filterPriority.includes(nivelDeParcialidades(r.parcialidades_vencidas))) return false;
      if (filterInvalidLevel.length > 0 && !filterInvalidLevel.includes(nivelDeParcialidades(r.invalidos ?? 0))) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(r.estatus_propiedad ?? '')) return false;
      return true;
    });
    // User-chosen order; if none, criticality (overdue installments DESC, invalid DESC).
    if (sort.key) {
      const acc = SORT_ACCESSORS[sort.key];
      const factor = sort.dir === 'asc' ? 1 : -1;
      return rows.sort((a, b) => {
        const av = acc(a), bv = acc(b);
        const cmp = typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv)
          : (av as number) - (bv as number);
        return factor * cmp;
      });
    }
    return rows.sort((a, b) => {
      const instDiff = b.parcialidades_vencidas - a.parcialidades_vencidas;
      if (instDiff !== 0) return instDiff;
      return (b.invalidos ?? 0) - (a.invalidos ?? 0);
    });
  }, [rawData, searchClient, searchAccount, searchUnit, searchClabe, filterModel, filterType, filterPriority, filterInvalidLevel, filterStatus, sort]);

  // KPIs from filtered set
  const kpis = useMemo(() => ({
    total:      filtered.length,
    overdue:    filtered.reduce((s, r) => s + r.monto_vencido, 0),
    pending:    filtered.reduce((s, r) => s + r.saldo_pendiente, 0),
    inArrears:  filtered.filter(r => r.parcialidades_vencidas > 0).length,
  }), [filtered]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = () => setPage(1);

  const hasFilters = !!searchClient || !!searchAccount || !!searchUnit
    || !!searchClabe || filterType.length > 0 || projectId !== null
    || filterPriority.length > 0 || filterInvalidLevel.length > 0
    || filterModel.length > 0 || filterStatus.length > 0;

  // Count of active ADVANCED filters (those living in the side panel), by field.
  // Type lives in the main bar, so it doesn't count as advanced.
  const advancedActiveCount =
    (filterPriority.length > 0 ? 1 : 0) +
    (filterInvalidLevel.length > 0 ? 1 : 0) +
    (filterStatus.length > 0 ? 1 : 0) +
    (filterModel.length > 0 ? 1 : 0) +
    (searchAccount.trim() ? 1 : 0) +
    (searchClabe.trim() ? 1 : 0);

  const clearFilters = useCallback(() => {
    resetFilters(); setPage(1);
  }, [resetFilters]);

  const clearAdvanced = () => {
    setFilterPriority([]); setFilterInvalidLevel([]);
    setFilterStatus([]); setFilterModel([]); setSearchAccount(''); setSearchClabe('');
    setPage(1);
  };

  // Pagination number list with ellipsis
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | '...')[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  // Primera carga: solo el mensaje centrado (nada de KPIs/tabla). keepPreviousData
  // evita que al cambiar de proyecto se vacíe la vista.
  // Primera carga: solo el mensaje centrado. keepPreviousData evita vaciar la vista
  // al cambiar de proyecto.
  if (isLoading && !rawData) {
    return <CollectionLoading label="Cargando cuentas..." />;
  }

  if (isError) {
    return <CollectionError title="No pudimos cargar las cuentas" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
            Cuentas activas
          </span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : kpis.total.toLocaleString('es-MX')}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">en cuentas de cobranza</p>
        </div>

        <div className="sozu-kpi-card overflow-hidden">
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3',
            !isLoading && kpis.overdue > 0 ? 'text-danger' : 'text-muted-foreground')}>
            Vencido total
          </span>
          <p className={cn('text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 break-all',
            !isLoading && kpis.overdue > 0 ? 'text-danger' : 'text-foreground')}>
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : fmtCurrency(kpis.overdue)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">monto en mora</p>
        </div>

        <div className="sozu-kpi-card overflow-hidden">
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3',
            !isLoading && kpis.pending > 0 ? 'text-warning' : 'text-muted-foreground')}>
            Pendiente total
          </span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : fmtCurrency(kpis.pending)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">saldo por cobrar</p>
        </div>

        <div className="sozu-kpi-card overflow-hidden">
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3',
            !isLoading && kpis.inArrears > 0 ? 'text-danger' : 'text-muted-foreground')}>
            En mora
          </span>
          <p className={cn('text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 break-all',
            !isLoading && kpis.inArrears > 0 ? 'text-danger' : 'text-foreground')}>
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : kpis.inArrears.toLocaleString('es-MX')}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">cuentas con parcialidades vencidas</p>
        </div>
      </div>

      {/* Default filters (main bar). The rest live in the "Filtros avanzados"
          side panel to keep the view clean and let it scale. */}
      <div className="grid grid-cols-2 gap-3 items-end sm:flex sm:flex-wrap sm:gap-x-3 sm:gap-y-3">

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Proyecto</span>
          <CobranzaProjectFilter
            projects={projects ?? []}
            value={projectId}
            onChange={v => { setProjectId(v); resetPage(); }}
            allLabel="Todos"
            className="h-9 w-full sm:w-[150px]"
            popoverClassName="w-[280px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Cliente</span>
          <Input
            value={searchClient}
            onChange={e => { setSearchClient(e.target.value); resetPage(); }}
            placeholder="García López"
            className="h-9 w-full sm:w-[180px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">No. Unidad</span>
          <Input
            value={searchUnit}
            onChange={e => { setSearchUnit(e.target.value); resetPage(); }}
            placeholder="203"
            inputMode="numeric"
            className="h-9 w-full sm:w-[110px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Tipo</span>
          <TipoMultiSelect value={filterType} onChange={v => { setFilterType(v); resetPage(); }} options={options.types} className="w-full sm:w-[150px]" />
        </div>

        {/* Button: opens the advanced-filters panel. Badge = active count. */}
        <div className="flex flex-col gap-1.5 col-span-2 sm:col-auto sm:ml-auto">
          <span className="text-xs font-medium text-muted-foreground/0 select-none px-0.5">Avanzados</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdvancedOpen(true)}
              className={cn(
                'h-9 px-3 text-[13px] gap-1.5 flex-1 sm:flex-none',
                advancedActiveCount > 0 && 'border-primary/50 text-primary bg-primary/5 hover:bg-primary/10',
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              Filtros avanzados
              {advancedActiveCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums leading-none">
                  {advancedActiveCount}
                </span>
              )}
            </Button>
            {hasFilters && (
              <Button
                variant="outline"
                size="icon"
                onClick={clearFilters}
                title="Limpiar filtros"
                className="h-9 w-9 shrink-0 border-success/50 text-success bg-success/5 hover:bg-success/10 hover:border-success"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Advanced-filters side panel */}
      <CollectionAdvancedFilters
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        filterPriority={filterPriority}         setFilterPriority={v => { setFilterPriority(v); resetPage(); }}
        filterInvalidLevel={filterInvalidLevel} setFilterInvalidLevel={v => { setFilterInvalidLevel(v); resetPage(); }}
        filterStatus={filterStatus}             setFilterStatus={v => { setFilterStatus(v); resetPage(); }}
        searchAccount={searchAccount}           setSearchAccount={v => { setSearchAccount(v); resetPage(); }}
        searchClabe={searchClabe}               setSearchClabe={v => { setSearchClabe(v); resetPage(); }}
        filterModel={filterModel}               setFilterModel={v => { setFilterModel(v); resetPage(); }}
        statusOptions={options.statuses}
        modelOptions={options.models}
        activeCount={advancedActiveCount}
        onClearAdvanced={clearAdvanced}
      />

      {/* Row count above table */}
      {!isLoading && !isError && (
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length === 0
              ? 'Sin resultados'
              : `${((page - 1) * PAGE_SIZE + 1).toLocaleString('es-MX')} – ${Math.min(page * PAGE_SIZE, filtered.length).toLocaleString('es-MX')} de ${filtered.length.toLocaleString('es-MX')} cuentas`}
          </span>
        </div>
      )}

      {/* Table (data ready — loading/error are handled with early returns above) */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1420px] table-fixed text-sm whitespace-nowrap">
            <thead className="sozu-thead [&_th]:uppercase [&_th]:tracking-wide [&_th]:px-3">
              <tr>
                <SortHeader label="Cuenta" sortKey="account" sort={sort} onSort={toggleSort} thClass="w-[128px]" />
                <th className="w-[132px] text-center">Proyecto</th>
                <th className="w-[124px] text-center">Tipo</th>
                <th className="w-[120px] text-center">Producto</th>
                <SortHeader label="Cliente" sortKey="client" sort={sort} onSort={toggleSort} thClass="w-[160px]" />
                <SortHeader label="Precio" sortKey="price" sort={sort} onSort={toggleSort} thClass="w-[112px]" align="right" />
                <SortHeader label="Vencido" sortKey="overdue" sort={sort} onSort={toggleSort} thClass="w-[112px]" align="right" />
                <SortHeader label="Pendiente" sortKey="pending" sort={sort} onSort={toggleSort} thClass="w-[124px]" align="right" />
                <SortHeader label="Parc." sortKey="installments" sort={sort} onSort={toggleSort} thClass="w-[84px]" />
                <SortHeader label="Inv." sortKey="invalid" sort={sort} onSort={toggleSort} thClass="w-[78px]" />
                <SortHeader label="Atraso" sortKey="daysLate" sort={sort} onSort={toggleSort} thClass="w-[92px]" />
                <th className="w-[148px] text-center">CLABE</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-14 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Sin resultados</p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="text-[12px] text-primary hover:underline">
                        Limpiar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : pageRows.map((row, idx) => {
                const type = accountType(row);
                const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                const unit = [row.modelo, row.numero_propiedad].filter(Boolean).join(' · ');
                return (
                  <tr
                    key={row.cuenta_id}
                    onClick={() => navigate(`/admin/portal-cobranza/cuentas-cobranza/${row.cuenta_id}/detalle`)}
                    className="border-b border-border transition-colors duration-100 cursor-pointer hover:bg-muted/40 h-[48px]"
                  >
                    <td className="pl-3 pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full text-[10px] font-bold tabular-nums leading-none select-none bg-muted text-muted-foreground/70 ring-1 ring-border/60 shrink-0">
                          {rowNum}
                        </span>
                        <span className="text-[12px] font-mono font-semibold tabular-nums truncate" title={formatCuentaCobranzaId(row.cuenta_id)}>
                          {formatCuentaCobranzaId(row.cuenta_id)}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 text-left">
                      <p className="text-[12px] font-medium truncate" title={row.proyecto ?? undefined}>{row.proyecto ?? '-'}</p>
                      {unit && (
                        <p className="text-[10px] text-muted-foreground truncate" title={unit}>{unit}</p>
                      )}
                    </td>

                    <td className="px-3 text-left">
                      <p className={cn('text-[12px] font-medium truncate', typeTextClass(type))} title={type}>{type}</p>
                      <p className={cn('text-[10px] truncate', statusTextClass(row.estatus_propiedad))} title={row.estatus_propiedad ?? undefined}>
                        {row.estatus_propiedad ?? '-'}
                      </p>
                    </td>

                    <td className="px-2 text-center">
                      {row.producto_nombre ? (
                        <span className="text-[11px] text-muted-foreground truncate block" title={row.producto_nombre}>
                          {row.producto_nombre}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40">No aplica</span>
                      )}
                    </td>

                    <td className="px-3 text-left">
                      <p className="text-[12px] font-medium truncate" title={row.cliente_nombre ?? undefined}>{row.cliente_nombre ?? '-'}</p>
                      {row.cliente_email && (
                        <p className="text-[10px] text-muted-foreground truncate" title={row.cliente_email}>{row.cliente_email}</p>
                      )}
                    </td>

                    <td className="px-2 text-right">
                      <span className="text-[12px] tabular-nums">{fmtCurrencyExact(row.precio_final)}</span>
                    </td>

                    <td className="px-2 text-right">
                      <span className={cn('text-[12px] tabular-nums font-medium',
                        row.monto_vencido === 0 ? 'text-emerald-600' : 'text-danger')}>
                        {fmtCurrencyExact(row.monto_vencido)}
                      </span>
                    </td>

                    <td className="px-2 text-right">
                      <span className={cn('text-[12px] tabular-nums font-medium',
                        row.saldo_pendiente === 0 ? 'text-emerald-600' : 'text-danger')}>
                        {fmtCurrencyExact(row.saldo_pendiente)}
                      </span>
                    </td>

                    <td className="px-2 text-center">
                      <CountCircle n={row.parcialidades_vencidas} />
                    </td>

                    <td className="px-2 text-center">
                      <CountCircle n={row.invalidos ?? 0} />
                    </td>

                    <td className="px-2 text-center">
                      <span className={cn('text-[12px] tabular-nums', overdueStyle(row.dias_sin_pagar))}>
                        {row.dias_sin_pagar === 0 ? '0' : `${row.dias_sin_pagar}d`}
                      </span>
                    </td>

                    <td className="px-2 text-center">
                      <span className="block truncate text-[11px] font-mono tabular-nums text-muted-foreground tracking-tight" title={row.clabe_stp ?? undefined}>
                        {row.clabe_stp ?? '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="text-[12px]">
            {((page - 1) * PAGE_SIZE + 1).toLocaleString('es-MX')} -{' '}
            {Math.min(page * PAGE_SIZE, filtered.length).toLocaleString('es-MX')} de{' '}
            {filtered.length.toLocaleString('es-MX')} cuentas
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft className="size-3.5" />
            </Button>
            {pageNumbers.map((p, i) =>
              p === '...'
                ? <span key={`e${i}`} className="px-1 text-[11px]">...</span>
                : (
                  <Button key={p} variant={p === page ? 'default' : 'outline'}
                    size="sm" className="h-7 w-7 text-[11px]"
                    onClick={() => setPage(p as number)}>
                    {p}
                  </Button>
                )
            )}
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
