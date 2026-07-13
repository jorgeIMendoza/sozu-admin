import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CobranzaProjectFilter } from '@/components/admin/portal-cobranza/CobranzaProjectFilter';
import { ESTATUS_VALIDACION_KEY, MetodoMultiSelect } from '@/components/admin/portal-cobranza/CobranzaFilterSelects';
import { PaymentsAdvancedFilters } from '@/components/admin/portal-cobranza/PaymentsAdvancedFilters';
import { useRelacionPagos, type PagoRecord } from '@/hooks/useRelacionPagos';
import { useProyectosCobranza } from '@/hooks/useCobranzaDashboard';
import { AddCepDialog } from '@/components/admin/AddCepDialog';
import { PaymentDetailDialog } from '@/components/admin/portal-cobranza/PaymentDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconTip, ClaveCopyable, fmtCurrency, fmtDate, EstadoBadge, ValidacionBadge } from './cuentaDetalleShared';
import { ActiveFilterBanner } from '@/components/cobranza/ActiveFilterBanner';
import {
  X, ChevronLeft, ChevronRight, SlidersHorizontal,
  FileCheck, FileWarning, FileText, DollarSign, Eye, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollectionLoading, CollectionError } from '@/components/admin/portal-cobranza/CollectionStates';
import { SortHeader, toggleSortState, type SortState } from '@/components/admin/portal-cobranza/CollectionSortHeader';

const PAGE_SIZE = 15;
// Se cargan todas las filas del filtro (como Cuentas de Cobranza) para ordenar y
// paginar en cliente = fluido. Cap defensivo del RPC ~5000; con filtros basta.
const LOAD_LIMIT = 5000;

// Columnas ordenables (client-side) y su accessor.
type PaymentsSortKey = 'account' | 'client' | 'amount' | 'status';
const SORT_ACCESSORS: Record<PaymentsSortKey, (r: PagoRecord) => number | string> = {
  account:  r => r.id_cuenta_cobranza ?? 0,
  client:   r => (r.cliente ?? '').toLowerCase(),
  amount:   r => Number(r.monto),
  status:   r => r.estatus,
};

function formatWithThousands(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${formatWithThousands(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${formatWithThousands(n / 1_000)}K`;
  return n.toLocaleString();
}
function formatCompactCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${formatWithThousands(n / 1_000_000)}M`;
  if (abs >= 1_000) return `$${formatWithThousands(n / 1_000)}K`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Mapea el estatus del pago al estado crudo que espera ValidacionBadge (del detalle).
const VALIDACION_RAW: Record<PagoRecord['estatus'], string> = {
  valido:      'coincide',
  invalido:    'no_coincide',
  error:       'error',
  sin_revisar: 'sin_validar',
};

// Texto de color por tipo (mismo estándar que Cuentas de Cobranza; sin pastilla).
function typeTextClass(tipo: string | null): string {
  return ({
    Propiedad:       'text-sky-700',
    Bodega:          'text-amber-700',
    Estacionamiento: 'text-emerald-700',
    Producto:        'text-violet-700',
    Mantenimiento:   'text-teal-700',
    Adicional:       'text-indigo-700',
  } as Record<string, string>)[tipo ?? ''] ?? 'text-foreground';
}

// Color del estatus de propiedad (secundario bajo Tipo), igual que Cuentas de Cobranza.
function propStatusTextClass(status: string | null): string {
  return ({
    'Inventario':    'text-slate-500',
    'Disponible':    'text-sky-600',
    'Apartada':      'text-amber-600',
    'Vendido':       'text-emerald-600',
    'Escrituración': 'text-violet-600',
  } as Record<string, string>)[status ?? ''] ?? 'text-muted-foreground';
}

// Relación de Pagos: pagos directos del cliente. Válido = url_cep + validación 'coincide'.
// Filtros: barra principal (Proyecto/Cliente/Unidad/Estatus) + panel avanzado.
// Correcciones (fecha, estatus, evidencia) inline por pago.
export default function CollectionPayments() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: projects } = useProyectosCobranza();

  const [projectId, setProjectId] = useState<number | null>(() => {
    const p = searchParams.get('proyecto');
    return p ? parseInt(p) : null;
  });
  const [searchClabe, setSearchClabe] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [searchUnit, setSearchUnit] = useState('');
  const [searchAccount, setSearchAccount] = useState('');
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterMetodo, setFilterMetodo] = useState<string[]>([]);
  const [filterEstatusProp, setFilterEstatusProp] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Orden de la tabla (client-side). key=null → orden del servidor.
  const [sort, setSort] = useState<SortState<PaymentsSortKey>>({ key: null, dir: 'asc' });
  const toggleSort = (key: PaymentsSortKey) => { setSort(s => toggleSortState(s, key)); setPage(1); };

  // Cargar evidencia (icono Upload) + detalle del pago (icono Eye).
  const [loadPayment, setLoadPayment] = useState<PagoRecord | null>(null);
  const [detailPayment, setDetailPayment] = useState<PagoRecord | null>(null);

  // Estatus pago = 6 estados de validación crudos (P27 §E.2), filtrado client-side por estado_validacion.
  const statusKeys = filterStatus.map(l => ESTATUS_VALIDACION_KEY[l]).filter(Boolean);

  const {
    pagos: payments, total, totalMonto: totalAmount,
    totalValidos: totalValid, totalSinValidar: totalUnverified,
    isLoading, error,
  } = useRelacionPagos({
    proyectoId: projectId,
    clabe: searchClabe,
    cliente: searchClient,
    unidad: searchUnit,
    cuenta: searchAccount,
    tipos: filterType,
    estatus: [], // Estatus pago se filtra client-side por estado_validacion (6 estados).
    page: 1,
    pageSize: LOAD_LIMIT,
  });

  const resetPage = () => setPage(1);

  // Métodos: catálogo completo (metodos_pago), no derivado de los pagos cargados
  // (así salen TODOS aunque el set actual no los incluya).
  const { data: metodoOptions = [] } = useQuery({
    queryKey: ['metodos-pago-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metodos_pago').select('nombre').eq('activo', true).order('nombre');
      if (error) throw error;
      return (data ?? []).map((m: { nombre: string }) => m.nombre);
    },
    staleTime: 60 * 60 * 1000,
  });

  // Estatus propiedad: opciones desde los pagos cargados (client-side).
  const estatusPropOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of payments) if (p.estatus_propiedad) s.add(p.estatus_propiedad);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [payments]);
  const clientFiltered = useMemo(
    () => payments.filter(p =>
      (filterMetodo.length === 0 || filterMetodo.includes(p.metodo_pago ?? '')) &&
      (filterEstatusProp.length === 0 || filterEstatusProp.includes(p.estatus_propiedad ?? '')) &&
      (statusKeys.length === 0 || statusKeys.includes(p.estado_validacion ?? 'sin_validar')),
    ),
    [payments, filterMetodo, filterEstatusProp, statusKeys],
  );

  // Orden + paginación en cliente (fluido, sin viaje al servidor).
  const sortedRows = useMemo(() => {
    if (!sort.key) return clientFiltered;
    const acc = SORT_ACCESSORS[sort.key];
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...clientFiltered].sort((a, b) => {
      const av = acc(a), bv = acc(b);
      const cmp = typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv)
        : (av as number) - (bv as number);
      return factor * cmp;
    });
  }, [clientFiltered, sort]);

  const shown = sortedRows.length;
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = projectId !== null || !!searchClabe || !!searchClient || !!searchUnit
    || !!searchAccount || filterType.length > 0 || filterStatus.length > 0
    || filterMetodo.length > 0 || filterEstatusProp.length > 0;

  // Barra principal: Proyecto, Cliente, No. Unidad, Método.
  // Avanzados (orden): Estatus pago, Tipo unidad, Estatus propiedad, Cuenta, CLABE.
  const advancedActiveCount =
    (filterStatus.length > 0 ? 1 : 0) +
    (filterType.length > 0 ? 1 : 0) +
    (filterEstatusProp.length > 0 ? 1 : 0) +
    (searchAccount.trim() ? 1 : 0) +
    (searchClabe.trim() ? 1 : 0);

  const clearFilters = useCallback(() => {
    setProjectId(null);
    setSearchClabe('');
    setSearchClient('');
    setSearchUnit('');
    setSearchAccount('');
    setFilterType([]);
    setFilterStatus([]);
    setFilterMetodo([]);
    setFilterEstatusProp([]);
    setPage(1);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const clearAdvanced = () => {
    setFilterStatus([]); setFilterType([]); setFilterEstatusProp([]); setSearchAccount(''); setSearchClabe(''); setPage(1);
  };

  const formatAccount = (id: number | null, tipo: 'propiedad' | 'producto' | null) => {
    if (id == null) return 'Sin cuenta';
    const padded = String(id).padStart(6, '0');
    return tipo === 'producto' ? `CCP-${padded}` : `CC-${padded}`;
  };

  const totalPages = Math.max(1, Math.ceil(shown / PAGE_SIZE));

  useEffect(() => {
    if (projectId !== null && projects && !projects.some((p) => p.id === projectId)) {
      setProjectId(null);
      setPage(1);
    }
  }, [projectId, projects]);

  const refetchPayments = () => queryClient.invalidateQueries({ queryKey: ['relacion-pagos'] });

  const handleLoadClose = () => { setLoadPayment(null); refetchPayments(); };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | '...')[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  // Primera carga: solo el mensaje centrado. keepPreviousData evita parpadeo al filtrar.
  if (isLoading && payments.length === 0) {
    return <CollectionLoading label="Cargando pagos..." />;
  }

  if (error) {
    return <CollectionError title="No pudimos cargar los pagos" onRetry={refetchPayments} />;
  }

  return (
    <div className="space-y-4">

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Total pagos</span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all" title={total.toLocaleString()}>
            {formatCompactNumber(total)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">pagos directos del cliente</p>
        </div>
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Monto total</span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all" title={fmtCurrency(totalAmount)}>
            {formatCompactCurrency(totalAmount)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">suma de pagos</p>
        </div>
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-success block mb-3">Válidos</span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-success break-all" title={totalValid.toLocaleString()}>
            {formatCompactNumber(totalValid)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">comprobante validado</p>
        </div>
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-warning block mb-3">Sin validar</span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-warning break-all" title={totalUnverified.toLocaleString()}>
            {formatCompactNumber(totalUnverified)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">pendientes de validar</p>
        </div>
      </div>

      <ActiveFilterBanner onClear={clearFilters} />

      {/* Filtros por defecto (barra principal) + botón avanzados + limpiar compacto */}
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
          <Input value={searchClient} onChange={e => { setSearchClient(e.target.value); resetPage(); }}
            placeholder="García López" className="h-9 w-full sm:w-[180px] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Propiedad</span>
          <Input value={searchUnit} onChange={e => { setSearchUnit(e.target.value); resetPage(); }}
            placeholder="203" inputMode="numeric" className="h-9 w-full sm:w-[110px] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Método pago</span>
          <MetodoMultiSelect value={filterMetodo} onChange={v => { setFilterMetodo(v); resetPage(); }} options={metodoOptions} className="w-full sm:w-[150px]" />
        </div>

        {/* Botón avanzados + limpiar compacto (Estatus se movió a Filtros avanzados) */}
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

      <PaymentsAdvancedFilters
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        filterStatus={filterStatus}       setFilterStatus={v => { setFilterStatus(v); resetPage(); }}
        filterType={filterType}           setFilterType={v => { setFilterType(v); resetPage(); }}
        filterEstatusProp={filterEstatusProp} setFilterEstatusProp={v => { setFilterEstatusProp(v); resetPage(); }}
        estatusPropOptions={estatusPropOptions}
        searchAccount={searchAccount}     setSearchAccount={v => { setSearchAccount(v); resetPage(); }}
        searchClabe={searchClabe}         setSearchClabe={v => { setSearchClabe(v); resetPage(); }}
        activeCount={advancedActiveCount}
        onClearAdvanced={clearAdvanced}
      />

      {/* Row count */}
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground tabular-nums">
          {shown === 0
            ? 'Sin resultados'
            : `${((page - 1) * PAGE_SIZE + 1).toLocaleString('es-MX')} – ${Math.min(page * PAGE_SIZE, shown).toLocaleString('es-MX')} de ${shown.toLocaleString('es-MX')} pagos`}
        </span>
      </div>

      {/* Tabla estándar (columnas fijas, uppercase, truncate + tooltip) */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1580px] table-fixed text-sm whitespace-nowrap">
            <thead className="sozu-thead [&_th]:uppercase [&_th]:tracking-wide [&_th]:px-3">
              <tr>
                <SortHeader label="Cuenta" sortKey="account" sort={sort} onSort={toggleSort} thClass="w-[116px]" />
                <th className="w-[122px] text-center">Proyecto</th>
                <th className="w-[124px] text-center">Tipo</th>
                <th className="w-[120px] text-center">Producto</th>
                <SortHeader label="Cliente" sortKey="client" sort={sort} onSort={toggleSort} thClass="w-[160px]" />
                <th className="w-[100px] text-center">F. Pagado</th>
                <th className="w-[116px] text-center">Método</th>
                <th className="w-[148px] text-center">Clave rastreo</th>
                <SortHeader label="Monto" sortKey="amount" sort={sort} onSort={toggleSort} thClass="w-[112px]" />
                <th className="w-[118px] text-center">Aplicado</th>
                <th className="w-[100px] text-center">Estado</th>
                <SortHeader label="Validado" sortKey="status" sort={sort} onSort={toggleSort} thClass="w-[104px]" />
                <th className="w-[56px]" aria-label="Comprobante" />
                <th className="w-[80px] text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {shown === 0 && (
                <tr><td colSpan={14} className="py-14 text-center">
                  <DollarSign className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No se encontraron pagos</p>
                </td></tr>
              )}
              {pageRows.map((r, idx) => {
                const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                const accountId = formatAccount(r.id_cuenta_cobranza, r.tipo_cuenta);
                const unit = [r.modelo, r.num_propiedad].filter(Boolean).join(' · ');
                return (
                <tr key={r.pago_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors duration-100 h-[48px]">
                  {/* Cuenta: nº de fila + id (estilo Cuentas de Cobranza) */}
                  <td className="pl-3 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full text-[10px] font-bold tabular-nums leading-none select-none bg-muted text-muted-foreground/70 ring-1 ring-border/60 shrink-0">
                        {rowNum}
                      </span>
                      <span className="text-[12px] font-mono font-semibold tabular-nums truncate" title={accountId}>{accountId}</span>
                    </div>
                  </td>
                  <td className="px-3 text-left">
                    <p className="text-[12px] font-medium text-foreground truncate" title={r.proyecto ?? undefined}>{r.proyecto || 'Sin proyecto'}</p>
                    {unit && <p className="text-[10px] text-muted-foreground truncate" title={unit}>{unit}</p>}
                  </td>
                  <td className="px-3 text-left">
                    {r.tipo_categoria
                      ? <p className={cn('text-[12px] font-medium truncate', typeTextClass(r.tipo_categoria))} title={r.tipo_categoria}>{r.tipo_categoria}</p>
                      : <p className="text-[11px] text-muted-foreground/40">-</p>}
                    {r.estatus_propiedad && <p className={cn('text-[10px] truncate', propStatusTextClass(r.estatus_propiedad))} title={r.estatus_propiedad}>{r.estatus_propiedad}</p>}
                  </td>
                  <td className="px-3 text-center">
                    {r.tipo_cuenta === 'producto'
                      ? <span className="text-[12px] text-foreground truncate block" title={r.producto ?? undefined}>{r.producto || 'Sin nombre'}</span>
                      : <span className="text-[11px] text-muted-foreground/40">No aplica</span>}
                  </td>
                  <td className="px-3 text-left">
                    <p className="text-[12px] font-medium text-foreground truncate" title={r.cliente ?? undefined}>{r.cliente || 'Sin identificar'}</p>
                    {r.cliente_email && <p className="text-[10px] text-muted-foreground truncate" title={r.cliente_email}>{r.cliente_email}</p>}
                  </td>
                  {/* F. Pagado */}
                  <td className="px-2 text-center">
                    <span className="text-[12px] tabular-nums">{r.fecha_pago ? fmtDate(r.fecha_pago) : '—'}</span>
                  </td>
                  {/* Método */}
                  <td className="px-2 text-center">
                    <span className="text-[12px] text-foreground truncate block" title={r.metodo_pago ?? undefined}>{r.metodo_pago || '—'}</span>
                  </td>
                  {/* Clave rastreo */}
                  <td className="px-2 text-left">
                    <ClaveCopyable value={r.clave_rastreo} />
                  </td>
                  {/* Monto */}
                  <td className="px-2 text-center">
                    <span className="text-[12px] tabular-nums">{fmtCurrency(Number(r.monto))}</span>
                  </td>
                  {/* Aplicado */}
                  <td className="px-2 text-center">
                    {r.monto_aplicado == null
                      ? <span className="text-[11px] text-muted-foreground/40">Sin registro</span>
                      : <span className="text-[12px] tabular-nums">{fmtCurrency(Number(r.monto_aplicado))}</span>}
                  </td>
                  {/* Estado (acuerdo) */}
                  <td className="px-2 text-center">
                    {r.estado_acuerdo
                      ? <EstadoBadge estado={r.estado_acuerdo} />
                      : <span className="text-[11px] text-muted-foreground/40">Sin registro</span>}
                  </td>
                  {/* Validado (validación) */}
                  <td className="px-2 text-center">
                    <ValidacionBadge estado={VALIDACION_RAW[r.estatus]} />
                  </td>
                  <td className="px-2 text-center">
                    <IconTip label={r.url_cep ? 'CEP (comprobante fiscal)' : r.url_recibo ? 'Recibo (evidencia sin CEP)' : 'Sin comprobante'}>
                      <span className="p-1 inline-flex shrink-0">
                        {r.url_cep ? (
                          <FileCheck className="size-4 shrink-0 text-emerald-500" />
                        ) : r.url_recibo ? (
                          <FileWarning className="size-4 shrink-0 text-amber-500" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-muted-foreground/25" />
                        )}
                      </span>
                    </IconTip>
                  </td>
                  <td className="px-2">
                    <div className="flex items-center justify-center gap-1">
                      <IconTip label="Detalle del pago">
                        <button onClick={() => setDetailPayment(r)}
                          className="p-1.5 rounded transition-colors text-foreground hover:bg-muted">
                          <Eye className="size-4" />
                        </button>
                      </IconTip>
                      <IconTip label="Cargar evidencia (CEP / recibo)">
                        <button onClick={() => setLoadPayment(r)} disabled={r.id_cuenta_cobranza == null}
                          className={cn('p-1.5 rounded transition-colors', r.id_cuenta_cobranza == null ? 'text-muted-foreground/25 cursor-not-allowed' : 'text-foreground hover:bg-muted')}>
                          <Upload className="size-4" />
                        </button>
                      </IconTip>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-[12px] text-muted-foreground tabular-nums">
              Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, shown)} de {shown.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
              </button>
              {pageNumbers.map((p, i) => p === '...'
                ? <span key={`e${i}`} className="px-1.5 text-[12px] text-muted-foreground">…</span>
                : <button key={p} onClick={() => setPage(p as number)}
                    className={cn('min-w-[28px] h-7 px-1.5 rounded-md text-[12px] tabular-nums transition-colors',
                      p === page ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-muted-foreground')}>
                    {p}
                  </button>
              )}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cargar evidencia */}
      {loadPayment && loadPayment.id_cuenta_cobranza != null && (
        <AddCepDialog open={!!loadPayment} onClose={handleLoadClose}
          paymentId={loadPayment.pago_id} cuentaCobranzaId={loadPayment.id_cuenta_cobranza} />
      )}

      {/* Detalle del pago (info + edición en una sola vista) */}
      <PaymentDetailDialog
        payment={detailPayment}
        onClose={() => setDetailPayment(null)}
        onSaved={refetchPayments}
      />
    </div>
  );
}
