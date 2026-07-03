import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CobranzaProjectFilter } from '@/components/admin/portal-cobranza/CobranzaProjectFilter';
import {
  TipoMultiSelect, EstatusMultiSelect, ESTATUS_PAGO_KEY,
} from '@/components/admin/portal-cobranza/CobranzaFilterSelects';
import { useRelacionPagos, type PagoRecord } from '@/hooks/useRelacionPagos';
import { useProyectosCobranza } from '@/hooks/useCobranzaDashboard';
import { AddCepDialog } from '@/components/admin/AddCepDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IconTip, ClaveCopyable, fmtCurrency } from './cuentaDetalleShared';
import { ActiveFilterBanner } from '@/components/cobranza/ActiveFilterBanner';
import {
  X, Loader2, ChevronLeft, ChevronRight,
  FileCheck, FileWarning, FileText, DollarSign, Eye, Upload, Pencil, ShieldCheck, Loader,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollectionLoading, CollectionError } from '@/components/admin/portal-cobranza/CollectionStates';

const PAGE_SIZE = 15;

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
const ESTATUS_META: Record<PagoRecord['estatus'], { label: string; cls: string }> = {
  valido:      { label: 'Válido',      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  invalido:    { label: 'Inválido',    cls: 'border-red-200 bg-red-50 text-red-700' },
  error:       { label: 'Error',       cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  sin_revisar: { label: 'Sin revisar', cls: 'border-slate-200 bg-slate-50 text-slate-600' },
};

// Opciones para cambiar estatus (estado real en pago_validaciones)
const ESTATUS_OPCIONES: { estado: string; label: string }[] = [
  { estado: 'coincide',    label: 'Válido' },
  { estado: 'no_coincide', label: 'Inválido' },
  { estado: 'error',       label: 'Error' },
];

const TIPO_BADGE: Record<string, string> = {
  Propiedad:       'border-sky-200 bg-sky-50 text-sky-700',
  Bodega:          'border-amber-200 bg-amber-50 text-amber-700',
  Estacionamiento: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Producto:        'border-violet-200 bg-violet-50 text-violet-700',
  Mantenimiento:   'border-teal-200 bg-teal-50 text-teal-700',
};

function atrasoStyle(dias: number): string {
  if (dias <= 0) return 'text-muted-foreground/40';
  if (dias < 30) return 'text-amber-500 font-medium';
  return 'text-red-600 font-semibold';
}

// Relación de Pagos: pagos directos del cliente. Válido = url_cep + validación 'coincide'.
// Filtros tipo bandeja. Correcciones (fecha, estatus, evidencia) inline por pago.
export default function RelacionPagosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: proyectos } = useProyectosCobranza();

  const [projectFilter, setProjectFilter] = useState<number | null>(() => {
    const p = searchParams.get('proyecto');
    return p ? parseInt(p) : null;
  });
  const [searchClabe, setSearchClabe] = useState('');
  const [searchCliente, setSearchCliente] = useState('');
  const [searchUnidad, setSearchUnidad] = useState('');
  const [searchCuenta, setSearchCuenta] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string[]>([]);
  const [filtroEstatus, setFiltroEstatus] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // Dialogs de corrección
  const [cargarPago, setCargarPago] = useState<PagoRecord | null>(null);
  const [fechaPago, setFechaPago] = useState<PagoRecord | null>(null);
  const [fechaValue, setFechaValue] = useState('');
  const [savingFecha, setSavingFecha] = useState(false);
  const [estatusPago, setEstatusPago] = useState<PagoRecord | null>(null);
  const [savingEstatus, setSavingEstatus] = useState<string | null>(null);

  const estatusKeys = filtroEstatus.map(l => ESTATUS_PAGO_KEY[l]).filter(Boolean);

  const {
    pagos, total, totalMonto, totalValidos, totalSinValidar,
    isLoading, error,
  } = useRelacionPagos({
    proyectoId: projectFilter,
    clabe: searchClabe,
    cliente: searchCliente,
    unidad: searchUnidad,
    cuenta: searchCuenta,
    tipos: filtroTipo,
    estatus: estatusKeys,
    page,
    pageSize: PAGE_SIZE,
  });

  const resetPage = () => setPage(1);

  const hasFilters = projectFilter !== null || !!searchClabe || !!searchCliente || !!searchUnidad
    || !!searchCuenta || filtroTipo.length > 0 || filtroEstatus.length > 0;

  const clearAllFilters = useCallback(() => {
    setProjectFilter(null);
    setSearchClabe('');
    setSearchCliente('');
    setSearchUnidad('');
    setSearchCuenta('');
    setFiltroTipo([]);
    setFiltroEstatus([]);
    setPage(1);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const formatCuenta = (id: number | null, tipo: 'propiedad' | 'producto' | null) => {
    if (id == null) return 'Sin cuenta';
    const padded = String(id).padStart(6, '0');
    return tipo === 'producto' ? `CCP-${padded}` : `CC-${padded}`;
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (projectFilter !== null && proyectos && !proyectos.some((p) => p.id === projectFilter)) {
      setProjectFilter(null);
      setPage(1);
    }
  }, [projectFilter, proyectos]);

  const refetchPagos = () => queryClient.invalidateQueries({ queryKey: ['relacion-pagos'] });

  const openEditarFecha = (r: PagoRecord) => {
    setFechaPago(r);
    setFechaValue(r.fecha_pago ?? '');
  };

  async function handleGuardarFecha() {
    if (!fechaPago || !fechaValue) return;
    setSavingFecha(true);
    try {
      const { error: e } = await (supabase as any).from('pagos')
        .update({ fecha_pago: fechaValue }).eq('id', fechaPago.pago_id);
      if (e) throw e;
      toast.success('Fecha del pago actualizada');
      setFechaPago(null);
      refetchPagos();
    } catch (err: any) {
      toast.error(err.message ?? 'Error al actualizar la fecha');
    } finally {
      setSavingFecha(false);
    }
  }

  async function handleCambiarEstatus(estado: string) {
    if (!estatusPago) return;
    setSavingEstatus(estado);
    try {
      const { data: updated } = await (supabase as any).from('pago_validaciones')
        .update({ estado }).eq('id_pago', estatusPago.pago_id).select('id');
      if (!updated || updated.length === 0) {
        const { error: ie } = await (supabase as any).from('pago_validaciones')
          .insert({ id_pago: estatusPago.pago_id, estado });
        if (ie) throw ie;
      }
      toast.success('Estatus de validación actualizado');
      setEstatusPago(null);
      refetchPagos();
    } catch (err: any) {
      toast.error(err.message ?? 'Error al actualizar el estatus');
    } finally {
      setSavingEstatus(null);
    }
  }

  const handleCargarClose = () => { setCargarPago(null); refetchPagos(); };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | '...')[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  // Primera carga: solo el mensaje centrado. keepPreviousData evita parpadeo al filtrar.
  if (isLoading && pagos.length === 0) {
    return <CollectionLoading label="Cargando pagos..." />;
  }

  if (error) {
    return <CollectionError title="No pudimos cargar los pagos" onRetry={refetchPagos} />;
  }

  return (
    <div className="space-y-4">

      {/* KPI cards (estándar Cuentas de Cobranza) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Total pagos</span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all" title={total.toLocaleString()}>
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : formatCompactNumber(total)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">pagos directos del cliente</p>
        </div>
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">Monto total</span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-foreground break-all" title={fmtCurrency(totalMonto)}>
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : formatCompactCurrency(totalMonto)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">suma de pagos</p>
        </div>
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-success block mb-3">Válidos</span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-success break-all" title={totalValidos.toLocaleString()}>
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : formatCompactNumber(totalValidos)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">comprobante validado</p>
        </div>
        <div className="sozu-kpi-card overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-warning block mb-3">Sin validar</span>
          <p className="text-[16px] sm:text-[18px] font-bold tabular-nums leading-none mb-1.5 text-warning break-all" title={totalSinValidar.toLocaleString()}>
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : formatCompactNumber(totalSinValidar)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">pendientes de validar</p>
        </div>
      </div>

      <ActiveFilterBanner onClear={clearAllFilters} />

      {/* Filtros — estilo Cuentas de Cobranza (bandeja) */}
      <div className="grid grid-cols-2 gap-3 items-end sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Proyecto</span>
          <CobranzaProjectFilter
            projects={proyectos ?? []}
            value={projectFilter}
            onChange={v => { setProjectFilter(v); resetPage(); }}
            className="h-9 w-full sm:w-[210px]"
            popoverClassName="w-full sm:w-[210px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">CLABE</span>
          <Input value={searchClabe} onChange={e => { setSearchClabe(e.target.value); resetPage(); }}
            placeholder="646180110400123456" className="h-9 w-full sm:w-[175px] text-sm font-mono" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Cliente</span>
          <Input value={searchCliente} onChange={e => { setSearchCliente(e.target.value); resetPage(); }}
            placeholder="García López" className="h-9 w-full sm:w-[185px] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">No. Unidad</span>
          <Input value={searchUnidad} onChange={e => { setSearchUnidad(e.target.value); resetPage(); }}
            placeholder="A-203" className="h-9 w-full sm:w-[100px] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Tipo</span>
          <TipoMultiSelect value={filtroTipo} onChange={v => { setFiltroTipo(v); resetPage(); }} className="w-full sm:w-[175px]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Cuenta</span>
          <Input value={searchCuenta} onChange={e => { setSearchCuenta(e.target.value); resetPage(); }}
            placeholder="CC-000842" className="h-9 w-full sm:w-[110px] text-sm font-mono" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Estatus</span>
          <EstatusMultiSelect value={filtroEstatus} onChange={v => { setFiltroEstatus(v); resetPage(); }} className="w-full sm:w-[175px]" />
        </div>

        <div className="flex flex-col gap-1.5 col-span-2 sm:col-auto">
          <span className="text-xs font-medium text-muted-foreground/0 select-none px-0.5">Limpiar</span>
          <Button
            variant="outline"
            size="sm"
            onClick={hasFilters ? clearAllFilters : undefined}
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

      {/* Row count */}
      {!isLoading && (
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground tabular-nums">
            {total === 0
              ? 'Sin resultados'
              : `${((page - 1) * PAGE_SIZE + 1).toLocaleString('es-MX')} – ${Math.min(page * PAGE_SIZE, total).toLocaleString('es-MX')} de ${total.toLocaleString('es-MX')} pagos`}
          </span>
        </div>
      )}

      {/* Tabla (diseño del detalle de cuenta de cobranza) */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sozu-thead">
                {['Cuenta', 'Proyecto', 'Tipo', 'Producto', 'Cliente', 'Monto', 'Atraso', 'Estatus', 'Clave rastreo', 'Comprobante', ''].map((h, i) => (
                  <th key={i} className={cn('px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center',
                    i === 9 && 'w-24', i === 10 && 'w-32')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagos.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12">
                  <DollarSign className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No se encontraron pagos</p>
                </td></tr>
              )}
              {pagos.map(r => {
                const m = ESTATUS_META[r.estatus] ?? ESTATUS_META.sin_revisar;
                return (
                <tr key={r.pago_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors duration-100">
                  {/* Cuenta cobranza */}
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <span className="text-[11px] font-mono text-foreground">{formatCuenta(r.id_cuenta_cobranza, r.tipo_cuenta)}</span>
                  </td>
                  {/* Proyecto */}
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[12px] text-foreground truncate max-w-[170px] inline-block align-middle">{r.proyecto || 'Sin proyecto'}</span>
                  </td>
                  {/* Tipo */}
                  <td className="px-3 py-2.5 text-center">
                    {r.tipo_categoria
                      ? <Badge variant="outline" className={cn('text-[10px] whitespace-nowrap font-medium', TIPO_BADGE[r.tipo_categoria] ?? TIPO_BADGE.Producto)}>{r.tipo_categoria}</Badge>
                      : <span className="text-[11px] text-muted-foreground/40">—</span>}
                  </td>
                  {/* Producto */}
                  <td className="px-3 py-2.5 text-center text-[12px] text-foreground truncate max-w-[160px]" title={r.producto || ''}>
                    {r.tipo_cuenta === 'producto' ? (r.producto || 'Sin nombre') : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  {/* Cliente */}
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[12px] font-medium text-foreground truncate max-w-[190px] inline-block align-middle">{r.cliente || 'Sin identificar'}</span>
                  </td>
                  {/* Monto */}
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <span className="text-[12px] font-medium tabular-nums">{fmtCurrency(Number(r.monto))}</span>
                  </td>
                  {/* Atraso */}
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {r.atraso > 0
                      ? <span className={cn('text-[12px] tabular-nums', atrasoStyle(r.atraso))}>{r.atraso}d</span>
                      : <span className="text-[11px] text-muted-foreground/40">—</span>}
                  </td>
                  {/* Estatus */}
                  <td className="px-3 py-2.5 text-center">
                    <Badge variant="outline" className={cn('text-[10px] whitespace-nowrap font-medium', m.cls)}>{m.label}</Badge>
                  </td>
                  {/* Clave rastreo */}
                  <td className="px-3 py-2.5 text-center">
                    <ClaveCopyable value={r.clave_rastreo} />
                  </td>
                  {/* Comprobante: CEP vs Recibo */}
                  <td className="px-3 py-2.5 text-center">
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
                  {/* Acciones (solo iconos) */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <IconTip label="Cargar evidencia (CEP / recibo)">
                        <button onClick={() => setCargarPago(r)} disabled={r.id_cuenta_cobranza == null}
                          className={cn('p-1.5 rounded transition-colors', r.id_cuenta_cobranza == null ? 'text-muted-foreground/25 cursor-not-allowed' : 'text-foreground hover:bg-muted')}>
                          <Upload className="size-4" />
                        </button>
                      </IconTip>
                      <IconTip label="Editar fecha del pago">
                        <button onClick={() => openEditarFecha(r)} className="p-1.5 rounded transition-colors text-foreground hover:bg-muted">
                          <Pencil className="size-4" />
                        </button>
                      </IconTip>
                      <IconTip label="Cambiar estatus de validación">
                        <button onClick={() => setEstatusPago(r)} className="p-1.5 rounded transition-colors text-foreground hover:bg-muted">
                          <ShieldCheck className="size-4" />
                        </button>
                      </IconTip>
                      <IconTip label="Ver detalle de la cuenta">
                        <button
                          onClick={() => { if (r.id_cuenta_cobranza != null) navigate(`/admin/portal-cobranza/cuentas-cobranza/${r.id_cuenta_cobranza}/detalle`); }}
                          disabled={r.id_cuenta_cobranza == null}
                          className={cn('p-1.5 rounded transition-colors', r.id_cuenta_cobranza == null ? 'text-muted-foreground/25 cursor-not-allowed' : 'text-foreground hover:bg-muted')}>
                          <Eye className="size-4" />
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
              Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString()}
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

      {/* Cargar evidencia (mismo componente que el detalle) */}
      {cargarPago && cargarPago.id_cuenta_cobranza != null && (
        <AddCepDialog open={!!cargarPago} onClose={handleCargarClose}
          paymentId={cargarPago.pago_id} cuentaCobranzaId={cargarPago.id_cuenta_cobranza} />
      )}

      {/* Editar fecha */}
      <Dialog open={!!fechaPago} onOpenChange={open => !open && setFechaPago(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar fecha del pago</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Fecha del pago</span>
            <Input type="date" value={fechaValue} onChange={e => setFechaValue(e.target.value)} className="h-9" />
            {fechaPago && <p className="text-[11px] text-muted-foreground">{formatCuenta(fechaPago.id_cuenta_cobranza, fechaPago.tipo_cuenta)} · {fmtCurrency(Number(fechaPago.monto))}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFechaPago(null)}>Cancelar</Button>
            <Button onClick={handleGuardarFecha} disabled={savingFecha || !fechaValue}>
              {savingFecha ? <Loader className="size-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cambiar estatus de validación */}
      <Dialog open={!!estatusPago} onOpenChange={open => !open && setEstatusPago(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cambiar estatus de validación</DialogTitle></DialogHeader>
          {estatusPago && (
            <p className="text-[12px] text-muted-foreground -mt-1">
              {formatCuenta(estatusPago.id_cuenta_cobranza, estatusPago.tipo_cuenta)} · {fmtCurrency(Number(estatusPago.monto))} · actual: <b>{ESTATUS_META[estatusPago.estatus].label}</b>
            </p>
          )}
          <div className="grid gap-2 pt-1">
            {ESTATUS_OPCIONES.map(o => (
              <Button key={o.estado} variant="outline" disabled={!!savingEstatus}
                onClick={() => handleCambiarEstatus(o.estado)} className="justify-start">
                {savingEstatus === o.estado ? <Loader className="size-4 animate-spin mr-2" /> : <ShieldCheck className="size-4 mr-2" />}
                {o.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
