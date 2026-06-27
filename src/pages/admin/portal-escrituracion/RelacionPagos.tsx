import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Download, ExternalLink, X, FileText,
  Loader2, ChevronDown, DollarSign, AlertTriangle,
  FolderOpen, ArrowLeft, ShieldCheck, ShieldAlert, Shield, CheckCircle2,
} from 'lucide-react';
import { useRelacionPagos, type PagoRecord } from '@/hooks/useRelacionPagos';
import { useExportToExcel } from '@/hooks/useExportToExcel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCuentaCobranzaFinancials } from '@/hooks/useCuentaCobranzaFinancials';
import { useProyectoFinancials } from '@/hooks/useProyectoFinancials';
import { useAccesoriosFinancials } from '@/hooks/useAccesoriosFinancials';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePldForCuenta, type PldPaymentFlagInfo } from '@/hooks/usePldForCuenta';
import { toast } from 'sonner';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

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
    if (c === 'Múltiples aplicaciones') return 'Múltiples aplicaciones';
    if (c === 'Multa') return 'Multa';
    const lower = c.toLowerCase();
    if (lower.includes('anticipo')) return 'Anticipo';
    if (lower.includes('enganche')) return 'Enganche';
    if (lower.includes('parcialidad')) return 'Parcialidad';
    if (lower.includes('pago final')) return 'Pago Final';
  }
  return null;
}

// ─── Conteo de páginas — fuente única: pdfjs-dist ─────────────────────────────
// El bucket `documentos` es público → fetch() recibe Access-Control-Allow-Origin: *
// y no necesita headers de auth. supabase.storage.download() usa el endpoint
// autenticado (sujeto a RLS SELECT) — para archivos ajenos puede fallar.
// Retorna { pages, failedAt } para distinguir error de descarga vs. error de parseo.

type PageResult = { pages: number | null; failedAt: 'download' | 'parse' | null };

async function getPaginasComprobante(url: string): Promise<PageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let buffer: ArrayBuffer | null = null;

  try {
    console.warn('[PLD] descargando comprobante:', url);
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn('[PLD] fetch no OK', res.status, res.statusText, url);
    } else {
      buffer = await res.arrayBuffer();
      console.warn('[PLD] buffer recibido', {
        sizeKb: (buffer.byteLength / 1024).toFixed(1) + 'KB',
        contentType: res.headers.get('content-type'),
      });
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[PLD] timeout 15s al descargar:', url);
    } else {
      console.warn('[PLD] error de red/CORS al descargar:', url, err);
    }
  } finally {
    clearTimeout(timer);
  }

  if (!buffer) return { pages: null, failedAt: 'download' };

  try {
    const loadingTask = getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const pages = pdf.numPages;
    await pdf.destroy();
    console.warn('[PLD] páginas detectadas por pdfjs:', pages);
    return { pages, failedAt: null };
  } catch (err) {
    console.warn('[PLD] pdfjs error (imagen, PDF cifrado, XFA):', url, err);
    return { pages: null, failedAt: 'parse' };
  }
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

function TableRowSkeleton({ colCount = 10 }: { colCount?: number }) {
  return (
    <tr>
      {Array.from({ length: colCount }).map((_, i) => (
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
            {fmtMxn(disponible)}
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

interface AccesorioCardProps {
  titulo: string;
  precioFinal: number;
  totalPagado: number;
  saldoPendiente: number;
}
function AccesorioCard({ titulo, precioFinal, totalPagado, saldoPendiente }: AccesorioCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{titulo}</p>
        <DollarSign className="w-4 h-4 text-slate-400" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-slate-400">Precio Final</span>
          <span className="text-sm font-bold text-slate-900 tabular-nums">{fmtMxn(precioFinal)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-slate-400">Total Pagado</span>
          <span className="text-sm font-semibold text-emerald-600 tabular-nums">{fmtMxn(totalPagado)}</span>
        </div>
        <div className="border-t border-slate-100 pt-2 flex justify-between items-baseline">
          <span className="text-xs text-slate-400">Saldo Pendiente</span>
          <span className={`text-sm font-bold tabular-nums ${saldoPendiente <= 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
            {fmtMxn(saldoPendiente)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── PLD sub-components ───────────────────────────────────────────────────────

const PLD_STATUS_CFG: Record<string, { label: string; dotClass: string; cardClass: string; icon: React.ReactNode }> = {
  BLOQUEADO: { label: 'Bloqueado',       dotClass: 'bg-red-500',     cardClass: 'border-red-300',    icon: <ShieldAlert className="w-4 h-4 text-red-500" /> },
  OBSERVADO: { label: 'En observación',  dotClass: 'bg-amber-500',   cardClass: 'border-amber-300',  icon: <ShieldAlert className="w-4 h-4 text-amber-500" /> },
  APROBADO:  { label: 'Aprobado',        dotClass: 'bg-emerald-500', cardClass: 'border-emerald-200', icon: <ShieldCheck className="w-4 h-4 text-emerald-500" /> },
  PENDIENTE: { label: 'Pendiente',       dotClass: 'bg-slate-400',   cardClass: 'border-slate-200',  icon: <Shield className="w-4 h-4 text-slate-400" /> },
};

const FLAG_DOT: Record<string, string> = {
  verde:    'bg-emerald-500',
  amarillo: 'bg-amber-400',
  naranja:  'bg-orange-500',
  rojo:     'bg-red-500',
  gris:     'bg-slate-300',
};

interface PldSummaryCardProps {
  pldStatus: string;
  motivoPrincipal: string;
  escrituraBloqueada: boolean;
  cuentaId: number;
}

function PldSummaryCard({ pldStatus, motivoPrincipal, escrituraBloqueada, cuentaId }: PldSummaryCardProps) {
  const navigate = useNavigate();
  const cfg = PLD_STATUS_CFG[pldStatus] ?? PLD_STATUS_CFG.PENDIENTE;
  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm ${cfg.cardClass}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PLD</p>
        {cfg.icon}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dotClass}`} />
        <p className={`text-lg font-bold ${
          pldStatus === 'BLOQUEADO' ? 'text-red-600' :
          pldStatus === 'OBSERVADO' ? 'text-amber-600' :
          pldStatus === 'APROBADO'  ? 'text-emerald-600' : 'text-slate-700'
        }`}>{cfg.label}</p>
      </div>
      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{motivoPrincipal}</p>
      {escrituraBloqueada && (
        <div className="mt-2 flex items-center gap-1 text-xs text-red-600 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Escritura bloqueada
        </div>
      )}
      <button
        onClick={() => navigate(`/admin/portal-escrituracion/pld?cuenta=${cuentaId}`)}
        className="mt-3 text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 underline underline-offset-2 decoration-dotted"
      >
        <ExternalLink className="w-3 h-3 shrink-0" />
        Ver en PLD
      </button>
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

interface PldPaymentMeta {
  idMetodosPago: number;
  clave_rastreo: string | null;
  validado: boolean;
}

interface PaymentsTableProps {
  pagos: PagoRecord[];
  isLoading: boolean;
  onViewComprobante: (url: string) => void;
  flagsPorPago?: Map<number, PldPaymentFlagInfo>;
  pldMeta?: Map<number, PldPaymentMeta>;
  onToggleValidacion?: (pagoId: number, value: boolean) => Promise<void>;
  onAnalizarComprobante?: (pagoId: number, url: string) => Promise<void>;
  validandoPagoId?: number | null;
}

function PaymentsTable({ pagos, isLoading, onViewComprobante, flagsPorPago, pldMeta, onToggleValidacion, onAnalizarComprobante, validandoPagoId }: PaymentsTableProps) {
  const hasPld = !!flagsPorPago;
  const HEADERS = [
    'Proyecto', 'Estatus', 'Comprador', 'Depto', 'Producto',
    'Fecha del Pago', 'Concepto', 'Pago', 'Método de Pago',
    ...(hasPld ? ['PLD'] : []),
    'Comprobante',
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
              ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} colCount={HEADERS.length} />)
              : pagos.map((p) => {
                  const comprobanteUrl = p.url_cep || p.url_recibo;
                  const pldInfo = hasPld ? flagsPorPago!.get(p.pago_id) : undefined;
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
                      {hasPld && (
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {pldInfo ? (
                            <span
                              title={pldInfo.tooltip}
                              className={`inline-block w-3 h-3 rounded-full cursor-default ${FLAG_DOT[pldInfo.flag] ?? 'bg-slate-300'}`}
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3.5 min-w-[160px]">
                        <div className="flex flex-col gap-1">
                          {comprobanteUrl ? (
                            <button
                              onClick={() => onViewComprobante(comprobanteUrl)}
                              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 underline underline-offset-2 decoration-dotted whitespace-nowrap"
                            >
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              Ver comprobante
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs whitespace-nowrap">Sin comprobante</span>
                          )}
                          {(() => {
                            const meta = pldMeta?.get(p.pago_id);
                            if (!meta || meta.idMetodosPago !== 1 || meta.clave_rastreo || !p.url_recibo) return null;
                            if (!onToggleValidacion && !onAnalizarComprobante) return null;
                            const isPending = validandoPagoId === p.pago_id;
                            return meta.validado ? (
                              <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  Validado PLD
                                </span>
                                <button
                                  onClick={() => onToggleValidacion?.(p.pago_id, false)}
                                  disabled={isPending}
                                  className="text-xs text-slate-400 hover:text-red-500 underline decoration-dotted disabled:opacity-50 whitespace-nowrap"
                                >
                                  {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Quitar'}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => onAnalizarComprobante?.(p.pago_id, p.url_recibo!)}
                                disabled={isPending}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 underline decoration-dotted disabled:opacity-50 whitespace-nowrap"
                              >
                                {isPending
                                  ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                  : <CheckCircle2 className="w-3 h-3 shrink-0" />}
                                Validar ticket + EC
                              </button>
                            );
                          })()}
                        </div>
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Parámetros de deep-link desde Workflow (wf_num = número de unidad, wf_cuenta = id cuenta)
  const wfNum    = searchParams.get('wf_num')    ?? '';
  const wfCuenta = searchParams.get('wf_cuenta') ?? '';
  const fromWorkflow = !!(wfNum || wfCuenta);

  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState(wfNum || wfCuenta ? `CC-${wfCuenta.padStart(6,'0')}` : '');
  const [search, setSearch] = useState(wfNum || wfCuenta ? `CC-${wfCuenta.padStart(6,'0')}` : '');
  const [page, setPage] = useState(1);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [validandoPagoId, setValidandoPagoId] = useState<number | null>(null);
  const autoValidadosRef = useRef<Set<number>>(new Set());
  const { exportToExcel, isExporting } = useExportToExcel();
  const qc = useQueryClient();

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

  // Only fetch when a project is selected.
  // IMPORTANT: pass `search` to the RPC so the DB filters first, avoiding the
  // p_limit:5000 cap cutting off pagos when a project has thousands of records.
  // Client-side filter below further narrows to exact num_propiedad match.
  const { pagos: allPagos, isLoading } = useRelacionPagos({
    proyectoId,
    search,          // server-side pre-filter
    page: 1,
    pageSize: 5000,
    tipoCuenta: 'propiedad',
    enabled: !!proyectoId,
  });

  // Client-side exact filter on top of the server pre-filter:
  //   numeric → exact unit match  |  text → substring on client name
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

  // Todas las cuentas visibles en los pagos filtrados
  const visibleCuentaIds = useMemo(() => {
    return [...new Set(
      filteredPagos.map((p) => p.id_cuenta_cobranza).filter((id): id is number => id != null),
    )];
  }, [filteredPagos]);

  // ── Cuenta PRINCIPAL de propiedad ────────────────────────────────────────────
  // La RPC clasifica como tipo_cuenta='propiedad' tanto la cuenta de departamento
  // como bodegas/estacionamientos (si tienen cc.id_propiedad set). La distinción
  // es que los accesorios tienen p.producto != null (nombre del producto asociado).
  // Solo usamos la cuenta con producto=null como fuente de verdad financiera.
  const primaryCuentaId = useMemo(() => {
    const mainIds = [...new Set(
      filteredPagos
        .filter(p => p.tipo_cuenta === 'propiedad' && p.producto === null)
        .map(p => p.id_cuenta_cobranza)
        .filter((id): id is number => id != null),
    )];
    return mainIds.length === 1 ? mainIds[0] : null;
  }, [filteredPagos]);

  // singleCuentaId: cuenta única total (puede incluir bodegas — solo para legacy)
  const singleCuentaId = useMemo(() =>
    visibleCuentaIds.length === 1 ? visibleCuentaIds[0] : null,
  [visibleCuentaIds]);

  // Hook financiero exacto — usa primaryCuentaId (cuenta de propiedad, sin bodegas)
  const { data: financials, isLoading: financialsLoading } = useCuentaCobranzaFinancials(primaryCuentaId);

  // Financials de accesorios (bodega + cajón) — depende de idPropiedad del hook principal
  const { data: accesorios, isLoading: accesoriosLoading } = useAccesoriosFinancials(financials?.idPropiedad ?? null);

  // ── Queries directas — fuente idéntica a "Pagos Aplicados" en DetalleCuentaCobranza ──
  // Reemplazan el RPC como fuente de la tabla cuando hay cuenta principal identificada.
  const { data: rpPagosCuenta, isLoading: rpPagosLoading } = useQuery({
    queryKey: ['rp-pagos-cuenta', primaryCuentaId],
    enabled: !!primaryCuentaId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('pagos')
        .select('id, fecha_pago, monto, clave_rastreo, id_metodos_pago, descripcion, url_recibo, url_cep, validacion_documental_efectivo, metodos_pago!pagos_id_metodos_pago_fkey(nombre)')
        .eq('id_cuenta_cobranza', primaryCuentaId!)
        .eq('activo', true)
        .order('fecha_pago', { ascending: true });
      return (data ?? []) as Array<{
        id: number; fecha_pago: string; monto: number; clave_rastreo: string | null;
        id_metodos_pago: number; descripcion: string | null;
        url_recibo: string | null; url_cep: string | null;
        validacion_documental_efectivo: boolean;
        metodos_pago: { nombre: string } | null;
      }>;
    },
  });

  const { data: rpAplicacionesPorPago, isLoading: rpAplicacionesLoading } = useQuery({
    queryKey: ['rp-aplicaciones-por-pago', primaryCuentaId],
    enabled: !!primaryCuentaId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: pagosData } = await supabase
        .from('pagos')
        .select('id')
        .eq('id_cuenta_cobranza', primaryCuentaId!)
        .eq('activo', true);
      if (!pagosData?.length) return [];
      const pagoIds = pagosData.map((p) => p.id);
      const { data } = await (supabase as any)
        .from('aplicaciones_pago')
        .select(`id, monto, id_pago, id_acuerdo_pago, es_multa, acuerdos_pago!aplicaciones_pago_id_acuerdo_pago_fkey(fecha_pago, orden, conceptos_pago!acuerdos_pago_id_concepto_fkey(nombre))`)
        .in('id_pago', pagoIds)
        .eq('activo', true);
      return (data ?? []) as Array<{
        id: number; monto: number; id_pago: number; id_acuerdo_pago: number; es_multa: boolean;
        acuerdos_pago: { fecha_pago: string; orden: number; conceptos_pago: { nombre: string } | null } | null;
      }>;
    },
  });

  // isRpMode: activo cuando hay cuenta principal identificada — usa queries directas en tabla
  const isRpMode = !!primaryCuentaId;

  // Financials de proyecto — solo en modo global (sin cuenta principal identificada).
  // Disabled en rpMode: para ese caso useCuentaCobranzaFinancials es la fuente.
  const {
    data: proyectoFinancials,
    isLoading: proyectoFinancialsLoading,
    isError: proyectoFinancialsError,
  } = useProyectoFinancials(isRpMode ? null : proyectoId);

  // Transforma pagos directos en PagoRecord[] para reutilizar PaymentsTable sin modificarla
  const rpTableRows = useMemo((): PagoRecord[] => {
    if (!isRpMode || !rpPagosCuenta?.length) return [];
    const contextRow = filteredPagos.find((p) => p.id_cuenta_cobranza === primaryCuentaId);
    const proyectoNombre = proyectos.find((p) => p.id === proyectoId)?.nombre ?? null;
    return rpPagosCuenta.map((pago) => {
      const apls = (rpAplicacionesPorPago ?? []).filter((a) => a.id_pago === pago.id);
      let conceptoDisplay: string | null = null;
      if (apls.length === 1) {
        conceptoDisplay = apls[0].es_multa
          ? 'Multa'
          : (apls[0].acuerdos_pago?.conceptos_pago?.nombre ?? null);
      } else if (apls.length > 1) {
        conceptoDisplay = 'Múltiples aplicaciones';
      }
      return {
        pago_id: pago.id,
        monto: pago.monto,
        fecha_pago: pago.fecha_pago,
        clave_rastreo: pago.clave_rastreo,
        url_cep: pago.url_cep,
        url_recibo: pago.url_recibo,
        descripcion: pago.descripcion,
        id_cuenta_cobranza: primaryCuentaId,
        metodo_pago: pago.metodos_pago?.nombre ?? 'Otro',
        clabe_stp: null,
        cliente: contextRow?.cliente ?? null,
        num_propiedad: contextRow?.num_propiedad ?? null,
        producto: null,           // normProducto('propiedad', null) → 'Propiedad'
        tipo_cuenta: 'propiedad' as const,
        proyecto: proyectoNombre,
        proyecto_id: proyectoId,
        tiene_cep: !!(pago.url_cep || pago.url_recibo),
        monto_aplicado: apls.reduce((s, a) => s + Number(a.monto ?? 0), 0),
        num_aplicaciones: apls.length,
        aplicaciones_detalle: conceptoDisplay
          ? [{ concepto: conceptoDisplay, orden: null, monto: 0 }]
          : [],
      };
    });
  }, [isRpMode, rpPagosCuenta, rpAplicacionesPorPago, filteredPagos, primaryCuentaId, proyectos, proyectoId]);

  // ── Queries Pagos de Bodega ───────────────────────────────────────────────────
  // Waterfall: bodegas → ofertas (scoped a id_propiedad) → cuentas_cobranza → pagos
  // Fuente idéntica a tab "Pagos Aplicados" de /admin/cuentas-cobranza/905/detalle
  const idPropiedad = financials?.idPropiedad ?? null;

  const { data: rpBodegaPagos, isLoading: rpBodegaPagosLoading } = useQuery({
    queryKey: ['rp-bodega-pagos', idPropiedad],
    enabled: !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: bodegas } = await supabase
        .from('bodegas')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const bodegaProductIds = [...new Set(
        (bodegas ?? []).map((b) => b.id_producto).filter(Boolean),
      )] as number[];
      if (!bodegaProductIds.length) return [];

      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id')
        .in('id_producto', bodegaProductIds)
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const ofertaIds = (ofertas ?? []).map((o) => o.id);
      if (!ofertaIds.length) return [];

      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id')
        .in('id_oferta', ofertaIds)
        .eq('activo', true);
      const cuentaBodegaIds = (cuentas ?? []).map((c) => c.id);
      if (!cuentaBodegaIds.length) return [];

      const { data } = await (supabase as any)
        .from('pagos')
        .select('id, fecha_pago, monto, clave_rastreo, id_metodos_pago, descripcion, url_recibo, url_cep, id_cuenta_cobranza, metodos_pago!pagos_id_metodos_pago_fkey(nombre)')
        .in('id_cuenta_cobranza', cuentaBodegaIds)
        .eq('activo', true)
        .order('fecha_pago', { ascending: true });
      return (data ?? []) as Array<{
        id: number; fecha_pago: string; monto: number; clave_rastreo: string | null;
        id_metodos_pago: number; descripcion: string | null;
        url_recibo: string | null; url_cep: string | null;
        id_cuenta_cobranza: number;
        metodos_pago: { nombre: string } | null;
      }>;
    },
  });

  // Aplicaciones de bodega — waterfall independiente (patrón de DetalleCuentaCobranza)
  const { data: rpBodegaAplicaciones, isLoading: rpBodegaAplicacionesLoading } = useQuery({
    queryKey: ['rp-bodega-aplicaciones', idPropiedad],
    enabled: !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: bodegas } = await supabase
        .from('bodegas')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const bodegaProductIds = [...new Set(
        (bodegas ?? []).map((b) => b.id_producto).filter(Boolean),
      )] as number[];
      if (!bodegaProductIds.length) return [];

      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id')
        .in('id_producto', bodegaProductIds)
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const ofertaIds = (ofertas ?? []).map((o) => o.id);
      if (!ofertaIds.length) return [];

      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id')
        .in('id_oferta', ofertaIds)
        .eq('activo', true);
      const cuentaBodegaIds = (cuentas ?? []).map((c) => c.id);
      if (!cuentaBodegaIds.length) return [];

      const { data: pagosData } = await supabase
        .from('pagos')
        .select('id')
        .in('id_cuenta_cobranza', cuentaBodegaIds)
        .eq('activo', true);
      if (!pagosData?.length) return [];
      const pagoIds = pagosData.map((p) => p.id);

      const { data } = await (supabase as any)
        .from('aplicaciones_pago')
        .select(`id, monto, id_pago, id_acuerdo_pago, es_multa, acuerdos_pago!aplicaciones_pago_id_acuerdo_pago_fkey(fecha_pago, orden, conceptos_pago!acuerdos_pago_id_concepto_fkey(nombre))`)
        .in('id_pago', pagoIds)
        .eq('activo', true);
      return (data ?? []) as Array<{
        id: number; monto: number; id_pago: number; id_acuerdo_pago: number; es_multa: boolean;
        acuerdos_pago: { fecha_pago: string; orden: number; conceptos_pago: { nombre: string } | null } | null;
      }>;
    },
  });

  const rpBodegaTotalMonto = useMemo(
    () => (rpBodegaPagos ?? []).reduce((s, p) => s + Number(p.monto ?? 0), 0),
    [rpBodegaPagos],
  );
  const rpBodegaConComprobante = useMemo(
    () => (rpBodegaPagos ?? []).filter((p) => !!(p.url_cep || p.url_recibo)).length,
    [rpBodegaPagos],
  );

  // Transforma pagos de bodega a PagoRecord[] — mismo patrón que rpTableRows
  const rpBodegaTableRows = useMemo((): PagoRecord[] => {
    if (!rpBodegaPagos?.length) return [];
    const contextRow = filteredPagos.find((p) => p.id_cuenta_cobranza === primaryCuentaId);
    const proyectoNombre = proyectos.find((p) => p.id === proyectoId)?.nombre ?? null;
    return rpBodegaPagos.map((pago) => {
      const apls = (rpBodegaAplicaciones ?? []).filter((a) => a.id_pago === pago.id);
      let conceptoDisplay: string | null = null;
      if (apls.length === 1) {
        conceptoDisplay = apls[0].es_multa
          ? 'Multa'
          : (apls[0].acuerdos_pago?.conceptos_pago?.nombre ?? null);
      } else if (apls.length > 1) {
        conceptoDisplay = 'Múltiples aplicaciones';
      }
      return {
        pago_id: pago.id,
        monto: pago.monto,
        fecha_pago: pago.fecha_pago,
        clave_rastreo: pago.clave_rastreo,
        url_cep: pago.url_cep,
        url_recibo: pago.url_recibo,
        descripcion: pago.descripcion,
        id_cuenta_cobranza: pago.id_cuenta_cobranza,
        metodo_pago: pago.metodos_pago?.nombre ?? 'Otro',
        clabe_stp: null,
        cliente: contextRow?.cliente ?? null,
        num_propiedad: contextRow?.num_propiedad ?? null,
        producto: 'Bodegas',          // normProducto('producto','Bodegas') → 'Bodega'
        tipo_cuenta: 'producto' as const,
        proyecto: proyectoNombre,
        proyecto_id: proyectoId,
        tiene_cep: !!(pago.url_cep || pago.url_recibo),
        monto_aplicado: apls.reduce((s, a) => s + Number(a.monto ?? 0), 0),
        num_aplicaciones: apls.length,
        aplicaciones_detalle: conceptoDisplay
          ? [{ concepto: conceptoDisplay, orden: null, monto: 0 }]
          : [],
      };
    });
  }, [rpBodegaPagos, rpBodegaAplicaciones, filteredPagos, primaryCuentaId, proyectos, proyectoId]);

  // ── Queries Pagos de Estacionamiento ─────────────────────────────────────────
  // Waterfall: estacionamientos → ofertas (scoped a id_propiedad) → cuentas_cobranza → pagos
  // Fuente idéntica a tab "Pagos Aplicados" de /admin/cuentas-cobranza/1299/detalle
  const { data: rpEstPagos, isLoading: rpEstPagosLoading } = useQuery({
    queryKey: ['rp-est-pagos', idPropiedad],
    enabled: !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: estacionamientos } = await supabase
        .from('estacionamientos')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const estProductIds = [...new Set(
        (estacionamientos ?? []).map((e) => e.id_producto).filter(Boolean),
      )] as number[];
      if (!estProductIds.length) return [];

      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id')
        .in('id_producto', estProductIds)
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const ofertaIds = (ofertas ?? []).map((o) => o.id);
      if (!ofertaIds.length) return [];

      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id')
        .in('id_oferta', ofertaIds)
        .eq('activo', true);
      const cuentaEstIds = (cuentas ?? []).map((c) => c.id);
      if (!cuentaEstIds.length) return [];

      const { data } = await (supabase as any)
        .from('pagos')
        .select('id, fecha_pago, monto, clave_rastreo, id_metodos_pago, descripcion, url_recibo, url_cep, id_cuenta_cobranza, metodos_pago!pagos_id_metodos_pago_fkey(nombre)')
        .in('id_cuenta_cobranza', cuentaEstIds)
        .eq('activo', true)
        .order('fecha_pago', { ascending: true });
      return (data ?? []) as Array<{
        id: number; fecha_pago: string; monto: number; clave_rastreo: string | null;
        id_metodos_pago: number; descripcion: string | null;
        url_recibo: string | null; url_cep: string | null;
        id_cuenta_cobranza: number;
        metodos_pago: { nombre: string } | null;
      }>;
    },
  });

  // Aplicaciones de estacionamiento — waterfall independiente (patrón de DetalleCuentaCobranza)
  const { data: rpEstAplicaciones, isLoading: rpEstAplicacionesLoading } = useQuery({
    queryKey: ['rp-est-aplicaciones', idPropiedad],
    enabled: !!idPropiedad,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: estacionamientos } = await supabase
        .from('estacionamientos')
        .select('id_producto')
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const estProductIds = [...new Set(
        (estacionamientos ?? []).map((e) => e.id_producto).filter(Boolean),
      )] as number[];
      if (!estProductIds.length) return [];

      const { data: ofertas } = await supabase
        .from('ofertas')
        .select('id')
        .in('id_producto', estProductIds)
        .eq('id_propiedad', idPropiedad!)
        .eq('activo', true);
      const ofertaIds = (ofertas ?? []).map((o) => o.id);
      if (!ofertaIds.length) return [];

      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id')
        .in('id_oferta', ofertaIds)
        .eq('activo', true);
      const cuentaEstIds = (cuentas ?? []).map((c) => c.id);
      if (!cuentaEstIds.length) return [];

      const { data: pagosData } = await supabase
        .from('pagos')
        .select('id')
        .in('id_cuenta_cobranza', cuentaEstIds)
        .eq('activo', true);
      if (!pagosData?.length) return [];
      const pagoIds = pagosData.map((p) => p.id);

      const { data } = await (supabase as any)
        .from('aplicaciones_pago')
        .select(`id, monto, id_pago, id_acuerdo_pago, es_multa, acuerdos_pago!aplicaciones_pago_id_acuerdo_pago_fkey(fecha_pago, orden, conceptos_pago!acuerdos_pago_id_concepto_fkey(nombre))`)
        .in('id_pago', pagoIds)
        .eq('activo', true);
      return (data ?? []) as Array<{
        id: number; monto: number; id_pago: number; id_acuerdo_pago: number; es_multa: boolean;
        acuerdos_pago: { fecha_pago: string; orden: number; conceptos_pago: { nombre: string } | null } | null;
      }>;
    },
  });

  const rpEstTotalMonto = useMemo(
    () => (rpEstPagos ?? []).reduce((s, p) => s + Number(p.monto ?? 0), 0),
    [rpEstPagos],
  );
  const rpEstConComprobante = useMemo(
    () => (rpEstPagos ?? []).filter((p) => !!(p.url_cep || p.url_recibo)).length,
    [rpEstPagos],
  );

  // Transforma pagos de estacionamiento a PagoRecord[] — mismo patrón que rpBodegaTableRows
  const rpEstTableRows = useMemo((): PagoRecord[] => {
    if (!rpEstPagos?.length) return [];
    const contextRow = filteredPagos.find((p) => p.id_cuenta_cobranza === primaryCuentaId);
    const proyectoNombre = proyectos.find((p) => p.id === proyectoId)?.nombre ?? null;
    return rpEstPagos.map((pago) => {
      const apls = (rpEstAplicaciones ?? []).filter((a) => a.id_pago === pago.id);
      let conceptoDisplay: string | null = null;
      if (apls.length === 1) {
        conceptoDisplay = apls[0].es_multa
          ? 'Multa'
          : (apls[0].acuerdos_pago?.conceptos_pago?.nombre ?? null);
      } else if (apls.length > 1) {
        conceptoDisplay = 'Múltiples aplicaciones';
      }
      return {
        pago_id: pago.id,
        monto: pago.monto,
        fecha_pago: pago.fecha_pago,
        clave_rastreo: pago.clave_rastreo,
        url_cep: pago.url_cep,
        url_recibo: pago.url_recibo,
        descripcion: pago.descripcion,
        id_cuenta_cobranza: pago.id_cuenta_cobranza,
        metodo_pago: pago.metodos_pago?.nombre ?? 'Otro',
        clabe_stp: null,
        cliente: contextRow?.cliente ?? null,
        num_propiedad: contextRow?.num_propiedad ?? null,
        producto: 'Estacionamiento',     // normProducto('producto','Estacionamiento') → 'Cajón'
        tipo_cuenta: 'producto' as const,
        proyecto: proyectoNombre,
        proyecto_id: proyectoId,
        tiene_cep: !!(pago.url_cep || pago.url_recibo),
        monto_aplicado: apls.reduce((s, a) => s + Number(a.monto ?? 0), 0),
        num_aplicaciones: apls.length,
        aplicaciones_detalle: conceptoDisplay
          ? [{ concepto: conceptoDisplay, orden: null, monto: 0 }]
          : [],
      };
    });
  }, [rpEstPagos, rpEstAplicaciones, filteredPagos, primaryCuentaId, proyectos, proyectoId]);

  // Resumen de cuentas — funciona para cualquier cantidad de cuentas visibles
  // queryKey incluye primaryCuentaId para forzar re-fetch cuando cambia la cuenta principal
  const { data: cuentaResumen, isLoading: isLoadingResumen } = useQuery({
    queryKey: ['cuenta-resumen-rp', visibleCuentaIds.join(','), primaryCuentaId],
    enabled: visibleCuentaIds.length > 0 && filteredPagos.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Precio final y valor_uma de la cuenta PRINCIPAL (o todas si no hay una principal)
      const idsToFetch = primaryCuentaId ? [primaryCuentaId] : visibleCuentaIds;
      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id, precio_final, valor_uma, id_propiedad')
        .in('id', idsToFetch);
      if (!cuentas?.length) return null;

      const precioFinalTotal = cuentas.reduce((s, c) => s + Number(c.precio_final ?? 0), 0);
      const valorUma = cuentas[0]?.valor_uma ?? 0;

      // 2. Breakdown de acuerdos — para cuenta principal cuando existe
      let totalPagadoCuenta = 0;
      let breakdown: { duranteObra: number; aLaEntrega: number; parcialidadesRestantes: number } | null = null;

      const cuentaIdParaBreakdown = primaryCuentaId ?? singleCuentaId;
      if (cuentaIdParaBreakdown) {
        const cuentaId = cuentaIdParaBreakdown;
        const { data: acuerdosRaw } = await supabase
          .from('acuerdos_pago').select('id, monto, pago_completado, id_concepto')
          .eq('id_cuenta_cobranza', cuentaId).eq('activo', true);

        if (acuerdosRaw?.length) {
          const conceptoIds = [...new Set(acuerdosRaw.map((a) => a.id_concepto).filter(Boolean))];
          const { data: conceptos } = await supabase
            .from('conceptos_pago').select('id, nombre').in('id', conceptoIds);
          const conceptoMap: Record<number, string> = {};
          (conceptos ?? []).forEach((c) => { conceptoMap[c.id] = c.nombre; });

          const { data: aplicaciones } = await supabase
            .from('aplicaciones_pago').select('id_acuerdo_pago, monto, es_multa')
            .in('id_acuerdo_pago', acuerdosRaw.map((a) => a.id)).eq('activo', true);

          totalPagadoCuenta = (aplicaciones ?? [])
            .filter((ap) => !ap.es_multa).reduce((s, ap) => s + ap.monto, 0);

          const aplicadoById: Record<number, number> = {};
          (aplicaciones ?? []).forEach((ap) => {
            if (!ap.es_multa) aplicadoById[ap.id_acuerdo_pago] = (aplicadoById[ap.id_acuerdo_pago] || 0) + ap.monto;
          });

          const acuerdos = acuerdosRaw.map((a) => ({
            ...a, concepto: (conceptoMap[a.id_concepto] ?? '').toLowerCase(),
            aplicado: aplicadoById[a.id] ?? 0,
          }));
          const contra = acuerdos.filter((a) => a.concepto === 'pago a contra entrega');
          const noCon   = acuerdos.filter((a) => a.concepto !== 'pago a contra entrega');
          breakdown = {
            aLaEntrega: contra.reduce((s, a) => s + Math.max(0, (a.monto ?? 0) - a.aplicado), 0),
            duranteObra: noCon.filter((a) => !a.pago_completado).reduce((s, a) => s + Math.max(0, (a.monto ?? 0) - a.aplicado), 0),
            parcialidadesRestantes: acuerdos.filter((a) => a.concepto === 'parcialidad' && !a.pago_completado).length,
          };
        }
      }

      // 3. Valor de escrituración: precio de bodegas/estac no incluidas de TODAS las propiedades
      const propIds = [...new Set(cuentas.map((c) => c.id_propiedad).filter(Boolean))] as number[];
      let escrituracion = precioFinalTotal;
      if (propIds.length) {
        const [{ data: bodegas }, { data: estac }] = await Promise.all([
          supabase.from('bodegas').select('id_producto').in('id_propiedad', propIds).eq('es_incluido', false).eq('activo', true),
          supabase.from('estacionamientos').select('id_producto').in('id_propiedad', propIds).eq('es_incluido', false).eq('activo', true),
        ]);
        const productIds = [...(bodegas ?? []), ...(estac ?? [])].map((r) => r.id_producto).filter(Boolean);
        if (productIds.length) {
          const { data: ofertas } = await supabase.from('ofertas').select('id').in('id_producto', productIds).eq('activo', true);
          if (ofertas?.length) {
            const { data: ctas } = await supabase.from('cuentas_cobranza').select('precio_final')
              .in('id_oferta', ofertas.map((o) => o.id)).eq('activo', true);
            escrituracion += (ctas ?? []).reduce((s, c) => s + (c.precio_final ?? 0), 0);
          }
        }
      }

      return { precioFinal: precioFinalTotal, valorUma, totalPagadoCuenta, breakdown, escrituracion };
    },
  });

  // ── Derived card values ─────────────────────────────────────────────────────
  // Switch: rpMode (cuenta individual) → financials + cuentaResumen (sin cambios)
  //         global (proyecto completo) → proyectoFinancials RPC (datos reales)
  const precioFinal = isRpMode
    ? (financials?.precioFinal ?? (cuentaResumen?.precioFinal ?? 0))
    : (proyectoFinancials?.precio_final ?? 0);

  const totalPagadoCuenta = isRpMode
    ? (financials?.totalPagadoAplicaciones ?? (cuentaResumen?.totalPagadoCuenta ?? totalMonto))
    : (proyectoFinancials?.total_pagado ?? 0);

  const haySobrepago   = isRpMode ? (financials?.haySobrepago ?? false) : false;
  const totalPendiente = isRpMode
    ? (financials?.saldoPendiente ?? Math.max(0, precioFinal - totalPagadoCuenta))
    : (proyectoFinancials?.saldo_pendiente ?? 0);
  const montoSobrepago = isRpMode ? (financials?.montoSobrepago ?? 0) : 0;
  const esPagadoCompleto = isRpMode
    ? (!!financials && precioFinal > 0 && !financials.haySobrepago && financials.saldoPendiente === 0)
    : false;

  const limiteEfectivo = isRpMode
    ? (financials?.limiteEfectivo ?? (((cuentaResumen?.valorUma ?? 0) || 0) * 8025))
    : (proyectoFinancials?.limite_efectivo ?? 0);
  const pagadoEfectivo = isRpMode
    ? (financials?.pagadoEfectivo ?? 0)
    : (proyectoFinancials?.efectivo_pagado ?? 0);
  const aunPermitidoEfectivo = isRpMode
    ? (financials?.aunPermitidoEfectivo ?? (limiteEfectivo - pagadoEfectivo))
    : (proyectoFinancials?.efectivo_aun_permitido ?? 0);

  const valorEscrituracion = isRpMode
    ? (financials?.valorEscrituracion ?? cuentaResumen?.escrituracion)
    : (proyectoFinancials?.valor_escrituracion ?? null);

  const isLoadingCards = isRpMode
    ? (isLoadingResumen || financialsLoading)
    : proyectoFinancialsLoading;

  // ── PLD — hook acotado a la cuenta principal ────────────────────────────────
  // Llamado aquí porque depende de precioFinal y cuentaResumen?.valorUma.
  const pld = usePldForCuenta(
    primaryCuentaId,
    rpPagosCuenta ?? [],
    cuentaResumen?.valorUma ?? 0,
    precioFinal,
  );

  // Mapa pago_id → metadata PLD para botón de validación documental
  const pldMeta = useMemo(() => {
    const map = new Map<number, PldPaymentMeta>();
    for (const p of rpPagosCuenta ?? []) {
      map.set(p.id, {
        idMetodosPago: p.id_metodos_pago,
        clave_rastreo: p.clave_rastreo,
        validado: p.validacion_documental_efectivo,
      });
    }
    return map;
  }, [rpPagosCuenta]);

  const toggleValidacion = async (pagoId: number, value: boolean) => {
    setValidandoPagoId(pagoId);
    try {
      const { error } = await (supabase as any)
        .from('pagos')
        .update({ validacion_documental_efectivo: value })
        .eq('id', pagoId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['rp-pagos-cuenta', primaryCuentaId] });
    } finally {
      setValidandoPagoId(null);
    }
  };

  // Valida comprobante de efectivo contando páginas via pdfjs — sin lógica de extensión
  const handleAnalizarComprobante = async (pagoId: number, url: string) => {
    if (pld.hasEfectivoExcedido) {
      toast.error('Límite de efectivo excedido — no se puede validar documentalmente.');
      return;
    }
    console.warn('[PLD] analizarComprobante inicio', { pagoId, url });
    setValidandoPagoId(pagoId);
    try {
      const { pages, failedAt } = await getPaginasComprobante(url);
      if (pages !== null && pages >= 2) {
        const { error } = await (supabase as any)
          .from('pagos')
          .update({ validacion_documental_efectivo: true })
          .eq('id', pagoId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['rp-pagos-cuenta', primaryCuentaId] });
        toast.success(`Comprobante validado: ${pages} páginas detectadas.`);
      } else if (pages === 1) {
        toast.warning('El comprobante tiene solo 1 página — se requiere ticket + estado de cuenta en un mismo PDF.');
      } else if (failedAt === 'download') {
        toast.warning('No se pudo descargar el comprobante (error de red). Revisa la consola del navegador con filtro [PLD].');
      } else {
        toast.warning('El archivo adjunto no pudo leerse como PDF. Revisa la consola del navegador con filtro [PLD].');
      }
    } catch (err) {
      console.error('[PLD] error al guardar validación', err);
      toast.error('Error al guardar la validación — intenta de nuevo.');
    } finally {
      setValidandoPagoId(null);
    }
  };

  // Auto-valida comprobantes de efectivo al cargar la cuenta — sin interacción del usuario
  useEffect(() => {
    if (!rpPagosCuenta || !primaryCuentaId || pld.isLoading || pld.hasEfectivoExcedido) return;

    const pendientes = rpPagosCuenta.filter(p =>
      p.id_metodos_pago === 1 &&
      !p.clave_rastreo &&
      !!p.url_recibo &&
      !p.validacion_documental_efectivo &&
      !autoValidadosRef.current.has(p.id),
    );

    if (pendientes.length === 0) return;

    // Marcar antes de iniciar para evitar re-ejecución cuando invalidateQueries recarga datos
    pendientes.forEach(p => autoValidadosRef.current.add(p.id));

    (async () => {
      const results = await Promise.all(
        pendientes.map(async (p) => {
          try {
            const { pages } = await getPaginasComprobante(p.url_recibo!);
            if (pages !== null && pages >= 2) {
              const { error } = await (supabase as any)
                .from('pagos')
                .update({ validacion_documental_efectivo: true })
                .eq('id', p.id);
              if (!error) return true;
              console.warn('[PLD] auto-validación: error al actualizar pago', p.id, error);
            } else {
              console.warn('[PLD] auto-validación: no validable', { pagoId: p.id, pages });
            }
          } catch (err) {
            console.warn('[PLD] auto-validación: error inesperado', p.id, err);
          }
          return false;
        }),
      );
      if (results.some(Boolean)) {
        qc.invalidateQueries({ queryKey: ['rp-pagos-cuenta', primaryCuentaId] });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpPagosCuenta, primaryCuentaId, pld.isLoading, pld.hasEfectivoExcedido]);

  // KPI de tabla en rpMode — calculados desde pagos directos (SUM pagos.monto)
  const rpTotalMonto = useMemo(
    () => (rpPagosCuenta ?? []).reduce((s, p) => s + Number(p.monto ?? 0), 0),
    [rpPagosCuenta],
  );
  const rpConComprobante = useMemo(
    () => (rpPagosCuenta ?? []).filter((p) => !!(p.url_cep || p.url_recibo)).length,
    [rpPagosCuenta],
  );

  // ── Debug temporal — borrar después de validar ────────────────────────────
  console.log('RELACION_PAGOS_DEBUG', {
    proyectoId,
    searchTerm: search,
    visibleCuentaIds,
    singleCuentaId,
    primaryCuentaId,
    cuentaIdUsadoEnHook: primaryCuentaId,
    financialsRaw: financials,
    precioFinal,
    totalPagadoAplicaciones: financials?.totalPagadoAplicaciones,
    totalPagadoReal: financials?.totalPagadoReal,
    saldoPendiente: financials?.saldoPendiente,
    limiteEfectivo,
    pagadoEfectivo,
    aunPermitidoEfectivo,
    valorEscrituracion,
    cuentaResumenFallback: cuentaResumen,
  });

  // Fuente activa de la tabla: queries directas (rpMode) o RPC (fallback para vista global)
  const displayRows = isRpMode ? rpTableRows : filteredPagos;
  const displayTotal = isRpMode ? rpTableRows.length : total;
  const displayLoading = isLoading || (isRpMode && (rpPagosLoading || rpAplicacionesLoading));
  const totalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));
  const pagedPagos = useMemo(
    () => displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [displayRows, page],
  );

  const exportTotal = isRpMode
    ? rpTableRows.length + rpBodegaTableRows.length + rpEstTableRows.length
    : displayTotal;

  const handleExport = async () => {
    const rowsToExport = isRpMode
      ? [...rpTableRows, ...rpBodegaTableRows, ...rpEstTableRows]
      : displayRows;
    const rows = rowsToExport.map((p) => ({
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

      {/* ── Breadcrumb de vuelta a Workflow ─────────────────────────────────── */}
      {fromWorkflow && (
        <button
          onClick={() => navigate('/admin/portal-escrituracion/workflow')}
          className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 mb-4 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          Volver a Workflow
          {wfNum && <span className="ml-1 text-slate-400">· Unidad {wfNum}</span>}
        </button>
      )}

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
          disabled={
            isExporting ||
            exportTotal === 0 ||
            (isRpMode && (rpBodegaPagosLoading || rpEstPagosLoading))
          }
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
              <KpiCard label="Total pagos" value={(isRpMode ? (rpPagosCuenta?.length ?? 0) : (proyectoFinancials?.total_pagos ?? 0)).toLocaleString('es-MX')} />
              <KpiCard
                label="Total pagado"
                value={fmtMxn(isRpMode ? rpTotalMonto : (proyectoFinancials?.total_pagado_todas_cuentas ?? 0))}
                valueClass="text-emerald-600"
              />
              <KpiCard label="Con comprobante" value={(isRpMode ? rpConComprobante : (proyectoFinancials?.total_con_comprobante ?? 0)).toLocaleString('es-MX')} colSpan />
            </>
          )}
        </div>
      )}

      {/* Aviso discreto si falla la RPC de proyecto (modo global) */}
      {hasResults && !isRpMode && proyectoFinancialsError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          No se pudo cargar el resumen financiero del proyecto. Reintenta o recarga la página.
        </div>
      )}

      {/* ── Cards financieros — siempre visibles cuando hay resultados ─────── */}
      {hasResults && (isLoadingCards || (isRpMode ? (!!cuentaResumen || !!financials) : !!proyectoFinancials)) && (
        <div className="space-y-4 mb-6">
          {/* Fila 1: 4 cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoadingCards ? (
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

                {/* Saldo Pendiente / Pagado / Sobrepago */}
                {haySobrepago ? (
                  <DetailCard
                    label="Sobrepago"
                    icon={<AlertTriangle className="w-4 h-4 text-orange-400" />}
                    value={fmtMxn(montoSobrepago)}
                    valueClass="text-orange-500"
                    borderClass="border-orange-300"
                  />
                ) : esPagadoCompleto ? (
                  <DetailCard
                    label="Saldo Pendiente"
                    icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                    value={fmtMxn(0)}
                    valueClass="text-emerald-600"
                    sub="Cuenta completamente pagada"
                    borderClass="border-emerald-200"
                  />
                ) : (
                  <DetailCard
                    label="Saldo Pendiente"
                    icon={<DollarSign className="w-4 h-4 text-amber-400" />}
                    value={fmtMxn(totalPendiente)}
                    valueClass="text-amber-500"
                    sub={precioFinal > 0 ? `${pct(totalPendiente, precioFinal)} restante` : undefined}
                  >
                    {cuentaResumen?.breakdown && (
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
                )}

                {/* Pago en Efectivo */}
                <CashPaymentCard
                  limite={limiteEfectivo}
                  pagado={pagadoEfectivo}
                  disponible={aunPermitidoEfectivo}
                />
              </>
            )}
          </div>

          {/* Fila 2: Valor de escrituración + Bodega + Cajón */}
          {(isLoadingCards || accesoriosLoading || valorEscrituracion != null || accesorios?.bodega || accesorios?.cajon) && (
            <div className="flex flex-wrap gap-4">
              {/* Escrituración */}
              {isLoadingCards ? (
                <div className="md:w-72"><DetailCardSkeleton /></div>
              ) : valorEscrituracion != null && (
                <div className="md:w-72"><EscrituracionCard value={valorEscrituracion} /></div>
              )}

              {/* Bodega */}
              {accesoriosLoading ? (
                <div className="md:w-72"><DetailCardSkeleton /></div>
              ) : accesorios?.bodega && (
                <div className="md:w-72">
                  <AccesorioCard
                    titulo="Bodega"
                    precioFinal={accesorios.bodega.precioFinal}
                    totalPagado={accesorios.bodega.totalPagadoAplicaciones}
                    saldoPendiente={accesorios.bodega.saldoPendiente}
                  />
                </div>
              )}

              {/* Cajón / Estacionamiento */}
              {accesoriosLoading ? (
                <div className="md:w-72"><DetailCardSkeleton /></div>
              ) : accesorios?.cajon && (
                <div className="md:w-72">
                  <AccesorioCard
                    titulo="Cajón / Estacionamiento"
                    precioFinal={accesorios.cajon.precioFinal}
                    totalPagado={accesorios.cajon.totalPagadoAplicaciones}
                    saldoPendiente={accesorios.cajon.saldoPendiente}
                  />
                </div>
              )}

              {/* PLD — solo en rpMode */}
              {isRpMode && primaryCuentaId && (
                pld.isLoading ? (
                  <div className="md:w-72"><DetailCardSkeleton /></div>
                ) : (
                  <div className="md:w-72">
                    <PldSummaryCard
                      pldStatus={pld.pldStatus}
                      motivoPrincipal={pld.motivoPrincipal}
                      escrituraBloqueada={pld.escrituraBloqueada}
                      cuentaId={primaryCuentaId}
                    />
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      {hasResults && (
        <>
          {/* Estado vacío (proyecto seleccionado pero sin resultados) */}
          {!displayLoading && displayTotal === 0 ? (
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
                isLoading={displayLoading}
                onViewComprobante={setViewerUrl}
                flagsPorPago={isRpMode ? pld.flagsPorPago : undefined}
                pldMeta={isRpMode ? pldMeta : undefined}
                onToggleValidacion={isRpMode ? toggleValidacion : undefined}
                onAnalizarComprobante={isRpMode ? handleAnalizarComprobante : undefined}
                validandoPagoId={validandoPagoId}
              />

              {/* Paginación */}
              {!displayLoading && displayTotal > 0 && (
                <div className="mt-3 px-1 flex items-center justify-between text-sm text-slate-500">
                  <span>
                    Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, displayTotal)} de{' '}
                    {displayTotal.toLocaleString('es-MX')} pagos
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

      {/* ── Pagos de Bodega ───────────────────────────────────────────────── */}
      {isRpMode && !rpBodegaPagosLoading && !!rpBodegaPagos && rpBodegaPagos.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Pagos de Bodega</h2>
            <span className="text-sm text-slate-500">({rpBodegaPagos.length} pagos)</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <KpiCard label="Total pagos" value={rpBodegaPagos.length.toLocaleString('es-MX')} />
            <KpiCard
              label="Total pagado"
              value={fmtMxn(rpBodegaTotalMonto)}
              valueClass="text-emerald-600"
            />
            <KpiCard
              label="Con comprobante"
              value={rpBodegaConComprobante.toLocaleString('es-MX')}
              colSpan
            />
          </div>

          <PaymentsTable
            pagos={rpBodegaTableRows}
            isLoading={rpBodegaAplicacionesLoading}
            onViewComprobante={setViewerUrl}
          />
        </div>
      )}

      {/* ── Pagos de Estacionamiento ──────────────────────────────────────── */}
      {isRpMode && !rpEstPagosLoading && !!rpEstPagos && rpEstPagos.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Pagos de Estacionamiento</h2>
            <span className="text-sm text-slate-500">({rpEstPagos.length} pagos)</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <KpiCard label="Total pagos" value={rpEstPagos.length.toLocaleString('es-MX')} />
            <KpiCard
              label="Total pagado"
              value={fmtMxn(rpEstTotalMonto)}
              valueClass="text-emerald-600"
            />
            <KpiCard
              label="Con comprobante"
              value={rpEstConComprobante.toLocaleString('es-MX')}
              colSpan
            />
          </div>

          <PaymentsTable
            pagos={rpEstTableRows}
            isLoading={rpEstAplicacionesLoading}
            onViewComprobante={setViewerUrl}
          />
        </div>
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
