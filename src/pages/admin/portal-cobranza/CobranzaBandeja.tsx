import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBandejaOperativa, BandejaCuenta } from '@/hooks/useBandejaOperativa';
import { CobranzaProjectFilter } from '@/components/admin/portal-cobranza/CobranzaProjectFilter';
import { useProyectosCobranza } from '@/hooks/useCobranzaDashboard';
import { formatCuentaCobranzaId } from '@/utils/cuentaCobranzaUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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

type TipoCategoria = 'Propiedad' | 'Bodega' | 'Estacionamiento' | 'Producto' | 'Mantenimiento';

function tipoCategoria(row: BandejaCuenta): TipoCategoria {
  if (row.tipo_cuenta === 'Mantenimiento') return 'Mantenimiento';
  if (row.tipo_cuenta === 'Propiedad') return 'Propiedad';
  const pn = (row.producto_nombre ?? '').toLowerCase();
  if (pn.includes('bodega')) return 'Bodega';
  if (pn.includes('estacionamiento')) return 'Estacionamiento';
  return 'Producto';
}

function tipoBadgeClass(tipo: TipoCategoria) {
  return {
    Propiedad:       'border-sky-200 bg-sky-50 text-sky-700',
    Bodega:          'border-amber-200 bg-amber-50 text-amber-700',
    Estacionamiento: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Producto:        'border-violet-200 bg-violet-50 text-violet-700',
    Mantenimiento:   'border-teal-200 bg-teal-50 text-teal-700',
  }[tipo];
}

function atrasoStyle(dias: number): string {
  if (dias === 0) return 'text-emerald-600';
  if (dias < 30)  return 'text-amber-500 font-medium';
  return 'text-red-600 font-semibold';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo: TipoCategoria }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] whitespace-nowrap font-medium', tipoBadgeClass(tipo))}>
      {tipo}
    </Badge>
  );
}

function InvalidosCircle({ n }: { n: number }) {
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

function ParcialesCircle({ n }: { n: number }) {
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

// ── Prioridad helpers ──────────────────────────────────────────────────────────

type NivelPrioridad = 'Al día' | 'Alerta' | 'Urgente' | 'Crítico';
const NIVELES_PRIORIDAD: NivelPrioridad[] = ['Al día', 'Alerta', 'Urgente', 'Crítico'];

function nivelDeParcialidades(n: number): NivelPrioridad {
  if (n === 0) return 'Al día';
  if (n === 1) return 'Alerta';
  if (n === 2) return 'Urgente';
  return 'Crítico';
}

function NivelMultiSelect({
  value,
  onChange,
  niveles,
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  niveles: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  const toggle = (nivel: string) => {
    onChange(value.includes(nivel) ? value.filter(v => v !== nivel) : [...value, nivel]);
  };

  const label = value.length === 0
    ? 'Todos'
    : value.length === 1
    ? value[0]
    : `${value.length} niveles`;

  return (
    <div
      className={cn("relative", className ?? "w-[155px]")}
      onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
      onFocus={() => clearTimeout(blurTimer.current)}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'h-9 w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent/50 focus:outline-none',
          open ? 'ring-1 ring-ring border-ring' : ''
        )}
      >
        <span className={cn('truncate text-left flex-1', value.length === 0 ? 'text-muted-foreground' : 'text-foreground')}>
          {label}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md py-1">
          {niveles.map(nivel => (
            <button
              key={nivel}
              type="button"
              onMouseDown={e => { e.preventDefault(); toggle(nivel); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-accent text-left transition-colors"
            >
              <div className={cn(
                'size-[14px] rounded-[3px] border flex items-center justify-center shrink-0',
                value.includes(nivel)
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-input bg-background'
              )}>
                {value.includes(nivel) && <Check className="size-[9px]" />}
              </div>
              <span className="text-[12px] text-foreground">{nivel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PrioridadMultiSelect = ({ value, onChange, className }: { value: string[]; onChange: (v: string[]) => void; className?: string }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={NIVELES_PRIORIDAD} className={className} />;

const InvalidosMultiSelect = ({ value, onChange, className }: { value: string[]; onChange: (v: string[]) => void; className?: string }) =>
  <NivelMultiSelect value={value} onChange={onChange} niveles={NIVELES_PRIORIDAD} className={className} />;

// ── TipoMultiSelect ────────────────────────────────────────────────────────────

const TIPOS: TipoCategoria[] = ['Propiedad', 'Bodega', 'Estacionamiento', 'Producto', 'Mantenimiento'];

function TipoMultiSelect({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = TIPOS.filter(t =>
    !search.trim() || t.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (tipo: string) => {
    onChange(value.includes(tipo) ? value.filter(v => v !== tipo) : [...value, tipo]);
  };

  const label = value.length === 0
    ? 'Todos los tipos'
    : value.length === 1
    ? value[0]
    : `${value.length} tipos`;

  return (
    <div
      className={cn("relative", className ?? "w-[175px]")}
      onBlur={() => { blurTimer.current = setTimeout(() => { setOpen(false); setSearch(''); }, 150); }}
      onFocus={() => clearTimeout(blurTimer.current)}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(o => !o);
          if (!open) setTimeout(() => searchRef.current?.focus(), 10);
        }}
        className={cn(
          'h-9 w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent/50 focus:outline-none',
          open ? 'ring-1 ring-ring border-ring' : ''
        )}
      >
        <span className={cn('truncate text-left flex-1', value.length === 0 ? 'text-muted-foreground' : 'text-foreground')}>
          {label}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar tipos"
              className="flex-1 text-[12px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="py-1">
            {filtered.map(tipo => (
              <button
                key={tipo}
                type="button"
                onMouseDown={e => { e.preventDefault(); toggle(tipo); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-accent text-left transition-colors"
              >
                <div className={cn(
                  'size-[14px] rounded-[3px] border flex items-center justify-center shrink-0',
                  value.includes(tipo)
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-input bg-background'
                )}>
                  {value.includes(tipo) && <Check className="size-[9px]" />}
                </div>
                <span className="text-[12px] text-foreground">{tipo}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BandejaOperativaPage() {
  const navigate = useNavigate();
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const [searchClabe, setSearchClabe]     = useState('');
  const [searchCliente, setSearchCliente] = useState('');
  const [searchUnidad, setSearchUnidad]   = useState('');
  const [filtroTipo, setFiltroTipo]         = useState<string[]>([]);
  const [searchCuenta, setSearchCuenta]     = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string[]>([]);
  const [filtroInvalidosNivel, setFiltroInvalidosNivel] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const { data: proyectos } = useProyectosCobranza();
  const { data: rawData, isLoading } = useBandejaOperativa({ proyectoId });

  // Client-side filter + sort by criticality (Parc. DESC, Inv. DESC)
  const filtered = useMemo(() => {
    if (!rawData) return [];
    const cl = searchCliente.toLowerCase().trim();
    const cu = searchCuenta.toLowerCase().trim();
    const un = searchUnidad.toLowerCase().trim();
    const cb = searchClabe.toLowerCase().trim();
    const rows = rawData.filter(r => {
      if (cl && !(r.cliente_nombre ?? '').toLowerCase().includes(cl)
               && !(r.cliente_email ?? '').toLowerCase().includes(cl)) return false;
      if (cu) {
        const fmt = formatCuentaCobranzaId(r.cuenta_id).toLowerCase();
        if (!fmt.includes(cu) && !String(r.cuenta_id).includes(cu)) return false;
      }
      if (un && !(r.numero_propiedad ?? '').toLowerCase().includes(un)) return false;
      if (cb && !(r.clabe_stp ?? '').toLowerCase().includes(cb)) return false;
      if (filtroTipo.length > 0 && !filtroTipo.includes(tipoCategoria(r))) return false;
      if (filtroPrioridad.length > 0 && !filtroPrioridad.includes(nivelDeParcialidades(r.parcialidades_vencidas))) return false;
      if (filtroInvalidosNivel.length > 0 && !filtroInvalidosNivel.includes(nivelDeParcialidades(r.invalidos ?? 0))) return false;
      return true;
    });
    return rows.sort((a, b) => {
      const parcDiff = b.parcialidades_vencidas - a.parcialidades_vencidas;
      if (parcDiff !== 0) return parcDiff;
      return (b.invalidos ?? 0) - (a.invalidos ?? 0);
    });
  }, [rawData, searchCliente, searchCuenta, searchUnidad, searchClabe, filtroTipo, filtroPrioridad, filtroInvalidosNivel]);

  // KPIs from filtered set
  const kpis = useMemo(() => ({
    total:     filtered.length,
    vencido:   filtered.reduce((s, r) => s + r.monto_vencido, 0),
    pendiente: filtered.reduce((s, r) => s + r.saldo_pendiente, 0),
    enMora:    filtered.filter(r => r.parcialidades_vencidas > 0).length,
  }), [filtered]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = () => setPage(1);

  const hasFilters = !!searchCliente || !!searchCuenta || !!searchUnidad
    || !!searchClabe || filtroTipo.length > 0 || proyectoId !== null
    || filtroPrioridad.length > 0 || filtroInvalidosNivel.length > 0;

  const clearFilters = useCallback(() => {
    setSearchCliente(''); setSearchCuenta(''); setSearchUnidad('');
    setSearchClabe(''); setFiltroTipo([]); setProyectoId(null);
    setFiltroPrioridad([]); setFiltroInvalidosNivel([]); setPage(1);
  }, []);

  // Pagination number list with ellipsis
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | '...')[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

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
          <p className="text-[11px] text-muted-foreground leading-snug">en bandeja operativa</p>
        </div>

        <div className="sozu-kpi-card overflow-hidden">
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3',
            !isLoading && kpis.vencido > 0 ? 'text-danger' : 'text-muted-foreground')}>
            Vencido total
          </span>
          <p className={cn('text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 break-all',
            !isLoading && kpis.vencido > 0 ? 'text-danger' : 'text-foreground')}>
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : fmtCurrency(kpis.vencido)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">monto en mora</p>
        </div>

        <div className="sozu-kpi-card overflow-hidden">
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3',
            !isLoading && kpis.pendiente > 0 ? 'text-warning' : 'text-muted-foreground')}>
            Pendiente total
          </span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all">
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : fmtCurrency(kpis.pendiente)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">saldo por cobrar</p>
        </div>

        <div className="sozu-kpi-card overflow-hidden">
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider block mb-3',
            !isLoading && kpis.enMora > 0 ? 'text-danger' : 'text-muted-foreground')}>
            En mora
          </span>
          <p className={cn('text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 break-all',
            !isLoading && kpis.enMora > 0 ? 'text-danger' : 'text-foreground')}>
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : kpis.enMora.toLocaleString('es-MX')}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">cuentas con parcialidades vencidas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 items-end sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-3">

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Proyecto</span>
          <CobranzaProjectFilter
            projects={proyectos ?? []}
            value={proyectoId}
            onChange={v => { setProyectoId(v); resetPage(); }}
            className="h-9 w-full sm:w-[210px]"
            popoverClassName="w-full sm:w-[210px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">CLABE</span>
          <Input
            value={searchClabe}
            onChange={e => { setSearchClabe(e.target.value); resetPage(); }}
            placeholder="646180110400123456"
            className="h-9 w-full sm:w-[175px] text-sm font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Cliente</span>
          <Input
            value={searchCliente}
            onChange={e => { setSearchCliente(e.target.value); resetPage(); }}
            placeholder="García López"
            className="h-9 w-full sm:w-[185px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">No. Unidad</span>
          <Input
            value={searchUnidad}
            onChange={e => { setSearchUnidad(e.target.value); resetPage(); }}
            placeholder="A-203"
            className="h-9 w-full sm:w-[100px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Tipo</span>
          <TipoMultiSelect value={filtroTipo} onChange={v => { setFiltroTipo(v); resetPage(); }} className="w-full sm:w-[175px]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Cuenta</span>
          <Input
            value={searchCuenta}
            onChange={e => { setSearchCuenta(e.target.value); resetPage(); }}
            placeholder="CC-000842"
            className="h-9 w-full sm:w-[110px] text-sm font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Prioridad</span>
          <PrioridadMultiSelect value={filtroPrioridad} onChange={v => { setFiltroPrioridad(v); resetPage(); }} className="w-full sm:w-[155px]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Pagos inválidos</span>
          <InvalidosMultiSelect value={filtroInvalidosNivel} onChange={v => { setFiltroInvalidosNivel(v); resetPage(); }} className="w-full sm:w-[155px]" />
        </div>

        <div className="flex flex-col gap-1.5 col-span-2 sm:col-auto">
          <span className="text-xs font-medium text-muted-foreground/0 select-none px-0.5">Limpiar</span>
          <Button
            variant="outline"
            size="sm"
            onClick={hasFilters ? clearFilters : undefined}
            className={cn(
              'h-9 px-3 text-[13px] gap-1.5 transition-all duration-150 w-full sm:w-auto',
              hasFilters
                ? 'border-success/50 text-success bg-success/5 hover:bg-success/10 hover:border-success cursor-pointer'
                : 'border-border/40 text-muted-foreground/35 bg-transparent pointer-events-none',
            )}
          >
            <X className="size-3.5" />Limpiar
          </Button>
        </div>
      </div>

      {/* Row count above table */}
      {!isLoading && (
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length === 0
              ? 'Sin resultados'
              : `${((page - 1) * PAGE_SIZE + 1).toLocaleString('es-MX')} – ${Math.min(page * PAGE_SIZE, filtered.length).toLocaleString('es-MX')} de ${filtered.length.toLocaleString('es-MX')} cuentas`}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sozu-thead">
              <tr>
                <th className="w-[148px] text-center">Cuenta</th>
                <th className="w-[185px] text-center">Proyecto</th>
                <th className="w-[108px] text-center">Tipo</th>
                <th className="w-[155px] text-center">Producto</th>
                <th className="w-[170px] text-center">Cliente</th>
                <th className="w-[118px] !text-right">Precio</th>
                <th className="w-[110px] !text-right">Vencido</th>
                <th className="w-[110px] !text-right">Pendiente</th>
                <th className="w-[58px] !text-center">Parc.</th>
                <th className="w-[52px] !text-center" title="Pagos inválidos">Inv.</th>
                <th className="w-[68px] !text-center">Atraso</th>
                <th className="w-[175px] text-center">CLABE</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="py-14 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="size-5 animate-spin" />
                      <span className="text-sm">Cargando cuentas...</span>
                    </div>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
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
                const tipo = tipoCategoria(row);
                const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                const unidad = [row.modelo, row.numero_propiedad].filter(Boolean).join(' · ');
                return (
                  <tr
                    key={row.cuenta_id}
                    onClick={() => navigate(`/admin/portal-cobranza/cuenta/${row.cuenta_id}`)}
                    className="border-b border-border transition-colors duration-100 cursor-pointer hover:bg-muted/40 h-[48px]"
                  >
                    <td className="pl-3 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full text-[10px] font-bold tabular-nums leading-none select-none bg-muted text-muted-foreground/70 ring-1 ring-border/60 shrink-0">
                          {rowNum}
                        </span>
                        <span className="text-[12px] font-mono font-semibold tabular-nums">
                          {formatCuentaCobranzaId(row.cuenta_id)}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 max-w-[185px] text-center">
                      <p className="text-[12px] font-medium truncate">{row.proyecto ?? '-'}</p>
                      {unidad && (
                        <p className="text-[10px] text-muted-foreground truncate">{unidad}</p>
                      )}
                    </td>

                    <td className="px-3 text-center">
                      <TipoBadge tipo={tipo} />
                    </td>

                    <td className="px-3 max-w-[155px] text-center">
                      {row.producto_nombre ? (
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {row.producto_nombre}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40">No aplica</span>
                      )}
                    </td>

                    <td className="px-3 max-w-[170px] text-center">
                      <p className="text-[12px] font-medium truncate">{row.cliente_nombre ?? '-'}</p>
                      {row.cliente_email && (
                        <p className="text-[10px] text-muted-foreground truncate">{row.cliente_email}</p>
                      )}
                    </td>

                    <td className="px-3 text-right">
                      <span className="text-[12px] tabular-nums">{fmtCurrencyExact(row.precio_final)}</span>
                    </td>

                    <td className="px-3 text-right">
                      <span className={cn('text-[12px] tabular-nums font-medium',
                        row.monto_vencido === 0 ? 'text-emerald-600' : 'text-danger')}>
                        {fmtCurrencyExact(row.monto_vencido)}
                      </span>
                    </td>

                    <td className="px-3 text-right">
                      <span className={cn('text-[12px] tabular-nums font-medium',
                        row.saldo_pendiente === 0 ? 'text-emerald-600' : 'text-danger')}>
                        {fmtCurrencyExact(row.saldo_pendiente)}
                      </span>
                    </td>

                    <td className="px-3 text-center">
                      <ParcialesCircle n={row.parcialidades_vencidas} />
                    </td>

                    <td className="px-3 text-center">
                      <InvalidosCircle n={row.invalidos ?? 0} />
                    </td>

                    <td className="px-3 text-center">
                      <span className={cn('text-[12px] tabular-nums', atrasoStyle(row.dias_sin_pagar))}>
                        {row.dias_sin_pagar === 0 ? '0' : `${row.dias_sin_pagar}d`}
                      </span>
                    </td>

                    <td className="px-3 text-center">
                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground tracking-tight">
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
