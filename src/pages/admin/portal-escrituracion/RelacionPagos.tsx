import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Download, ExternalLink, X, FileText,
  Loader2, ChevronDown, DollarSign, AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { useRelacionPagos, type PagoRecord } from '@/hooks/useRelacionPagos';
import { useExportToExcel } from '@/hooks/useExportToExcel';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const pct = (num: number, denom: number) =>
  denom > 0 ? ((num / denom) * 100).toFixed(1) + '%' : '0%';

// Only display Propiedad / Bodega / Cajón; everything else → null ("—")
function normProducto(tipo_cuenta: string | null, producto: string | null): string | null {
  if (tipo_cuenta === 'propiedad') return 'Propiedad';
  const name = (producto ?? '').toLowerCase();
  if (name.includes('bodega')) return 'Bodega';
  if (name.includes('cajón') || name.includes('cajon') || name.includes('estacionamiento')) return 'Cajón';
  return null;
}

// Only display Anticipo / Enganche / Parcialidad / Pago Final; everything else → null ("—")
function normConcepto(
  aplicaciones_detalle: { concepto: string | null }[],
  descripcion: string | null,
): string | null {
  for (const c of [
    ...(aplicaciones_detalle ?? []).map((a) => a.concepto ?? ''),
    descripcion ?? '',
  ]) {
    const lower = c.toLowerCase();
    if (lower.includes('anticipo')) return 'Anticipo';
    if (lower.includes('enganche')) return 'Enganche';
    if (lower.includes('parcialidad')) return 'Parcialidad';
    if (lower.includes('pago final')) return 'Pago Final';
  }
  return null;
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function KpiCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <Shimmer className="h-3 w-24 mb-3" />
      <Shimmer className="h-8 w-28" />
    </div>
  );
}

function DetailCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <Shimmer className="h-3 w-24 mb-3" />
      <Shimmer className="h-8 w-36 mb-2" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Shimmer className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueClass?: string;
  colSpan?: boolean;
}

function KpiCard({ label, value, sub, valueClass = 'text-slate-900', colSpan }: KpiCardProps) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-sm ${colSpan ? 'col-span-2 md:col-span-1' : ''}`}>
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

interface DetailCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueClass?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  borderClass?: string;
}

function DetailCard({ label, icon, value, sub, valueClass = 'text-slate-900', children, borderClass = 'border-slate-200' }: DetailCardProps) {
  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {children}
    </div>
  );
}

interface CashPaymentCardProps {
  limite: number;
  pagado: number;
  disponible: number;
}

function CashPaymentCard({ limite, pagado, disponible }: CashPaymentCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pago en efectivo</p>
        <DollarSign className="w-4 h-4 text-slate-400" />
      </div>
      <div className="space-y-2 mt-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Límite:</span>
          <span className="font-medium text-slate-700">{fmtMxn(limite)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Pagado:</span>
          <span className="font-medium text-slate-700">{fmtMxn(pagado)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Aún permitido:</span>
          <span className={`font-medium ${disponible < 0 ? 'text-red-500' : 'text-slate-700'}`}>
            {fmtMxn(Math.max(0, disponible))}
          </span>
        </div>
      </div>
    </div>
  );
}

function EscrituracionCard({ value }: { value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor de escrituración</p>
        <FileText className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-purple-600">{fmtMxn(value)}</p>
      <p className="text-xs text-slate-400 mt-1">
        Suma de precio final de propiedad, bodegas y estacionamientos
      </p>
    </div>
  );
}

interface FilterBarProps {
  proyectoId: number | null;
  proyectos: { id: number; nombre: string }[];
  searchInput: string;
  onProyectoChange: (id: number | null) => void;
  onSearchChange: (v: string) => void;
}

function FilterBar({ proyectoId, proyectos, searchInput, onProyectoChange, onSearchChange }: FilterBarProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-medium text-slate-500">Proyecto</span>
        <div className="relative">
          <select
            value={proyectoId ?? ''}
            onChange={(e) => onProyectoChange(e.target.value ? Number(e.target.value) : null)}
            className="appearance-none bg-white border border-slate-200 text-sm rounded-lg py-1.5 pl-3 pr-8 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          >
            <option value="">Seleccionar proyecto…</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="relative flex-1 min-w-[280px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por número de depto o nombre del comprador…"
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={!proyectoId}
        />
      </div>
    </div>
  );
}

interface PaymentsTableProps {
  pagos: PagoRecord[];
  isLoading: boolean;
  onViewComprobante: (url: string) => void;
}

function PaymentsTable({ pagos, isLoading, onViewComprobante }: PaymentsTableProps) {
  const HEADERS = [
    'Proyecto', 'Estatus', 'Comprador', 'Depto', 'Producto',
    'Fecha del Pago', 'Concepto', 'Pago', 'Método de Pago', 'Comprobante',
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              {HEADERS.map((h) => (
                <th key={h} className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
              : pagos.map((p) => {
                  const comprobanteUrl = p.url_cep || p.url_recibo;
                  return (
                    <tr key={p.pago_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">{p.proyecto ?? '—'}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          Activa
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap max-w-[200px] truncate">{p.cliente ?? '—'}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 whitespace-nowrap">{p.num_propiedad ?? '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{normProducto(p.tipo_cuenta, p.producto) ?? '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{p.fecha_pago ? fmtDate(p.fecha_pago) : '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 max-w-[180px] truncate">{normConcepto(p.aplicaciones_detalle ?? [], p.descripcion) ?? '—'}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums">{fmtMxn(p.monto)}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">{p.metodo_pago ?? '—'}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {comprobanteUrl ? (
                          <button
                            onClick={() => onViewComprobante(comprobanteUrl)}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 underline underline-offset-2 decoration-dotted"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            Ver comprobante
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">Sin comprobante</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function RelacionPagos() {
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [page, setPage] = useState(1);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const { exportToExcel, isExporting } = useExportToExcel();

  // Debounce: only apply filter after 300 ms of inactivity
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset when project changes
  const handleProyectoChange = useCallback((id: number | null) => {
    setProyectoId(id);
    setSearchInput('');
    setSearch('');
    setPage(1);
  }, []);

  // Proyectos SOZU publicados
  const { data: proyectos = [] } = useQuery({
    queryKey: ['proyectos-relacion-pagos'],
    queryFn: async () => {
      const { data: sozuRels } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
      const ids = (sozuRels ?? []).map((r) => r.id_proyecto).filter(Boolean);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .in('id', ids)
        .eq('publicar', true)
        .eq('activo', true)
        .order('nombre');
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });

  // Only fetch when a project is selected
  const { pagos: allPagos, isLoading } = useRelacionPagos({
    proyectoId,
    page: 1,
    pageSize: 5000,
    tipoCuenta: 'propiedad',
    enabled: !!proyectoId,
  });

  // Client-side filtering: numeric → exact unit, text → substring on client name
  const filteredPagos = useMemo(() => {
    const term = search.trim();
    if (!term) return allPagos;
    if (/^\d+$/.test(term)) return allPagos.filter((p) => p.num_propiedad === term);
    const lower = term.toLowerCase();
    return allPagos.filter((p) => p.cliente?.toLowerCase().includes(lower));
  }, [allPagos, search]);

  // Generic KPI totals
  const total = filteredPagos.length;
  const totalMonto = useMemo(() => filteredPagos.reduce((s, p) => s + (p.monto ?? 0), 0), [filteredPagos]);
  const totalConCep = useMemo(() => filteredPagos.filter((p) => p.tiene_cep).length, [filteredPagos]);

  // Detect single-account view
  const singleCuentaId = useMemo(() => {
    if (!filteredPagos.length) return null;
    const ids = new Set(filteredPagos.map((p) => p.id_cuenta_cobranza));
    return ids.size === 1 ? [...ids][0] : null;
  }, [filteredPagos]);

  // Full account summary — only for single-account view
  const { data: cuentaResumen, isLoading: isLoadingResumen } = useQuery({
    queryKey: ['cuenta-resumen-rp', singleCuentaId],
    enabled: !!singleCuentaId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: cuenta } = await supabase
        .from('cuentas_cobranza')
        .select('precio_final, valor_uma, id_propiedad')
        .eq('id', singleCuentaId)
        .maybeSingle();
      if (!cuenta) return null;

      // Acuerdos + conceptos + aplicaciones
      const { data: acuerdosRaw } = await supabase
        .from('acuerdos_pago')
        .select('id, monto, pago_completado, id_concepto')
        .eq('id_cuenta_cobranza', singleCuentaId)
        .eq('activo', true);

      let totalPagadoCuenta = 0;
      let breakdown: { duranteObra: number; aLaEntrega: number; parcialidadesRestantes: number } | null = null;

      if (acuerdosRaw?.length) {
        const conceptoIds = [...new Set(acuerdosRaw.map((a) => a.id_concepto).filter(Boolean))];
        const { data: conceptos } = await supabase
          .from('conceptos_pago').select('id, nombre').in('id', conceptoIds);
        const conceptoMap: Record<number, string> = {};
        (conceptos ?? []).forEach((c) => { conceptoMap[c.id] = c.nombre; });

        const acuerdoIds = acuerdosRaw.map((a) => a.id);
        const { data: aplicaciones } = await supabase
          .from('aplicaciones_pago')
          .select('id_acuerdo_pago, monto, es_multa')
          .in('id_acuerdo_pago', acuerdoIds)
          .eq('activo', true);

        totalPagadoCuenta = (aplicaciones ?? [])
          .filter((ap) => !ap.es_multa)
          .reduce((s, ap) => s + ap.monto, 0);

        const aplicadoById: Record<number, number> = {};
        (aplicaciones ?? []).forEach((ap) => {
          if (!ap.es_multa) aplicadoById[ap.id_acuerdo_pago] = (aplicadoById[ap.id_acuerdo_pago] || 0) + ap.monto;
        });

        const acuerdos = acuerdosRaw.map((a) => ({
          ...a, concepto: (conceptoMap[a.id_concepto] ?? '').toLowerCase(),
          aplicado: aplicadoById[a.id] ?? 0,
        }));

        const contra = acuerdos.filter((a) => a.concepto === 'pago a contra entrega');
        const noCon = acuerdos.filter((a) => a.concepto !== 'pago a contra entrega');

        breakdown = {
          aLaEntrega: contra.reduce((s, a) => s + Math.max(0, a.monto - a.aplicado), 0),
          duranteObra: noCon.filter((a) => !a.pago_completado).reduce((s, a) => s + Math.max(0, a.monto - a.aplicado), 0),
          parcialidadesRestantes: acuerdos.filter((a) => a.concepto === 'parcialidad' && !a.pago_completado).length,
        };
      }

      // Valor de escrituración
      let escrituracion = cuenta.precio_final;
      if (cuenta.id_propiedad) {
        const [{ data: bodegas }, { data: estac }] = await Promise.all([
          supabase.from('bodegas').select('id_producto').eq('id_propiedad', cuenta.id_propiedad).eq('es_incluido', false).eq('activo', true),
          supabase.from('estacionamientos').select('id_producto').eq('id_propiedad', cuenta.id_propiedad).eq('es_incluido', false).eq('activo', true),
        ]);
        const productIds = [...(bodegas ?? []), ...(estac ?? [])].map((r) => r.id_producto).filter(Boolean);
        if (productIds.length) {
          const { data: ofertas } = await supabase.from('ofertas').select('id').in('id_producto', productIds).eq('activo', true);
          if (ofertas?.length) {
            const { data: ctas } = await supabase.from('cuentas_cobranza').select('precio_final').in('id_oferta', ofertas.map((o) => o.id)).eq('activo', true);
            escrituracion += (ctas ?? []).reduce((s, c) => s + (c.precio_final || 0), 0);
          }
        }
      }

      return { precioFinal: cuenta.precio_final, valorUma: cuenta.valor_uma || 0, totalPagadoCuenta, breakdown, escrituracion };
    },
  });

  // Derived account-level values
  const precioFinal = cuentaResumen?.precioFinal ?? 0;
  const totalPagadoCuenta = cuentaResumen?.totalPagadoCuenta ?? 0;
  const totalPendiente = Math.max(0, precioFinal - totalPagadoCuenta);
  const haySobrepago = precioFinal > 0 && totalPagadoCuenta > precioFinal;
  const montoSobrepago = Math.max(0, totalPagadoCuenta - precioFinal);
  const limiteEfectivo = (cuentaResumen?.valorUma ?? 0) * 8025;
  const pagadoEfectivo = useMemo(
    () => filteredPagos.filter((p) => p.metodo_pago?.toLowerCase().includes('efectivo')).reduce((s, p) => s + p.monto, 0),
    [filteredPagos],
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagedPagos = useMemo(
    () => filteredPagos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredPagos, page],
  );

  const handleExport = async () => {
    const rows = filteredPagos.map((p) => ({
      proyecto: p.proyecto ?? '—',
      estatus: 'Activa',
      comprador: p.cliente ?? '—',
      depto: p.num_propiedad ?? '—',
      producto: normProducto(p.tipo_cuenta, p.producto) ?? '—',
      fecha_pago: p.fecha_pago ? fmtDate(p.fecha_pago) : '—',
      concepto: normConcepto(p.aplicaciones_detalle ?? [], p.descripcion) ?? '—',
      pago: p.monto,
      metodo_pago: p.metodo_pago ?? '—',
      comprobante: p.url_cep || p.url_recibo || '—',
    }));
    await exportToExcel({
      data: rows,
      filename: 'relacion-pagos',
      columnas_visibles: [
        { key: 'proyecto', label: 'Proyecto' },
        { key: 'estatus', label: 'Estatus' },
        { key: 'comprador', label: 'Comprador' },
        { key: 'depto', label: 'Depto' },
        { key: 'producto', label: 'Producto' },
        { key: 'fecha_pago', label: 'Fecha del Pago' },
        { key: 'concepto', label: 'Concepto' },
        { key: 'pago', label: 'Pago' },
        { key: 'metodo_pago', label: 'Método de Pago' },
        { key: 'comprobante', label: 'Comprobante' },
      ],
    });
  };

  const hasResults = !!proyectoId && (isLoading || total > 0);

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 font-sans bg-slate-50/50 min-h-screen">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Relación de Pagos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Historial de pagos por comprador y unidad para el expediente de escrituración
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting || total === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar Excel
        </button>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <FilterBar
        proyectoId={proyectoId}
        proyectos={proyectos}
        searchInput={searchInput}
        onProyectoChange={handleProyectoChange}
        onSearchChange={setSearchInput}
      />

      {/* ── Sin proyecto seleccionado ─────────────────────────────────────── */}
      {!proyectoId && (
        <div className="py-24 text-center text-slate-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-25" />
          <p className="text-base font-medium text-slate-500">Selecciona un proyecto para comenzar</p>
          <p className="text-sm text-slate-400 mt-1">Los pagos y resumen aparecerán aquí</p>
        </div>
      )}

      {/* ── KPI genéricos ─────────────────────────────────────────────────── */}
      {hasResults && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {isLoading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : (
            <>
              <KpiCard label="Total pagos" value={total.toLocaleString('es-MX')} />
              <KpiCard label="Total pagado" value={fmtMxn(totalMonto)} valueClass="text-emerald-600" />
              <KpiCard label="Con comprobante" value={totalConCep.toLocaleString('es-MX')} colSpan />
            </>
          )}
        </div>
      )}

      {/* ── Cards detallados de cuenta (single-account view) ─────────────── */}
      {hasResults && singleCuentaId && (
        <div className="space-y-4 mb-6">
          {/* Fila 1: 4 cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoadingResumen ? (
              <>
                <DetailCardSkeleton />
                <DetailCardSkeleton />
                <DetailCardSkeleton />
                <DetailCardSkeleton />
              </>
            ) : (
              <>
                {/* Precio Final */}
                <DetailCard
                  label="Precio Final"
                  icon={<DollarSign className="w-4 h-4 text-slate-400" />}
                  value={fmtMxn(precioFinal)}
                />

                {/* Total Pagado (desde aplicaciones) */}
                <DetailCard
                  label="Total Pagado"
                  icon={<DollarSign className="w-4 h-4 text-emerald-500" />}
                  value={fmtMxn(totalPagadoCuenta)}
                  valueClass="text-emerald-600"
                  sub={precioFinal > 0 ? `${pct(totalPagadoCuenta, precioFinal)} del total` : undefined}
                />

                {/* Saldo Pendiente / Sobrepago */}
                <DetailCard
                  label={haySobrepago ? 'Sobrepago' : 'Saldo Pendiente'}
                  icon={haySobrepago
                    ? <AlertTriangle className="w-4 h-4 text-orange-400" />
                    : <DollarSign className="w-4 h-4 text-amber-400" />}
                  value={fmtMxn(haySobrepago ? montoSobrepago : totalPendiente)}
                  valueClass={haySobrepago ? 'text-orange-500' : 'text-amber-500'}
                  sub={!haySobrepago && precioFinal > 0 ? `${pct(totalPendiente, precioFinal)} restante` : undefined}
                  borderClass={haySobrepago ? 'border-orange-300' : 'border-slate-200'}
                >
                  {!haySobrepago && cuentaResumen?.breakdown && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Durante obra:</span>
                        <span className="font-medium text-slate-700">{fmtMxn(cuentaResumen.breakdown.duranteObra)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">A la entrega:</span>
                        <span className="font-medium text-slate-700">{fmtMxn(cuentaResumen.breakdown.aLaEntrega)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Parcialidades restantes:</span>
                        <span className="font-medium text-slate-700">{cuentaResumen.breakdown.parcialidadesRestantes}</span>
                      </div>
                    </div>
                  )}
                </DetailCard>

                {/* Pago en Efectivo */}
                <CashPaymentCard
                  limite={limiteEfectivo}
                  pagado={pagadoEfectivo}
                  disponible={limiteEfectivo - pagadoEfectivo}
                />
              </>
            )}
          </div>

          {/* Fila 2: Valor de escrituración */}
          {!isLoadingResumen && cuentaResumen?.escrituracion !== undefined && (
            <div className="md:w-72">
              <EscrituracionCard value={cuentaResumen.escrituracion} />
            </div>
          )}
          {isLoadingResumen && (
            <div className="md:w-72">
              <DetailCardSkeleton />
            </div>
          )}
        </div>
      )}

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      {hasResults && (
        <>
          {/* Estado vacío (proyecto seleccionado pero sin resultados) */}
          {!isLoading && total === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm py-20 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-25" />
              <p className="text-sm font-medium">
                {search.trim()
                  ? 'No se encontraron pagos con esa búsqueda.'
                  : 'No hay pagos registrados para este proyecto.'}
              </p>
            </div>
          ) : (
            <>
              <PaymentsTable
                pagos={pagedPagos}
                isLoading={isLoading}
                onViewComprobante={setViewerUrl}
              />

              {/* Paginación */}
              {!isLoading && total > 0 && (
                <div className="mt-3 px-1 flex items-center justify-between text-sm text-slate-500">
                  <span>
                    Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de{' '}
                    {total.toLocaleString('es-MX')} pagos
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50"
                    >{'<'}</button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pg = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                      return (
                        <button
                          key={pg}
                          onClick={() => setPage(pg)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                            pg === page ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >{pg}</button>
                      );
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50"
                    >{'>'}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Visor de comprobante ──────────────────────────────────────────── */}
      <Dialog open={!!viewerUrl} onOpenChange={() => setViewerUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
            <span className="font-semibold text-slate-900 text-sm">Comprobante de Pago</span>
            <div className="flex items-center gap-2">
              <a
                href={viewerUrl ?? '#'}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </a>
              <button
                onClick={() => setViewerUrl(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={viewerUrl ?? ''}
              className="w-full h-full"
              style={{ minHeight: 'calc(92vh - 56px)' }}
              title="Comprobante de pago"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
