import { useState, useRef, type ReactNode } from 'react';
import {
  Copy, ChevronsUpDown, Search, Check, Download, ExternalLink, X,
  LayoutDashboard, Users, Calendar, FileText, RefreshCw, Loader2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── helpers ────────────────────────────────────────────────────────────────────

// Tooltip popup para los iconos de acción de las tablas de pagos.
export function IconTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="text-[11px]">{label}</TooltipContent>
    </Tooltip>
  );
}

export function fmtCurrency(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return '-';
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export function acuerdoEstado(pago_completado: boolean, fecha_pago: string | null) {
  if (pago_completado) return 'pagado';
  if (!fecha_pago) return 'pendiente';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fecha_pago + 'T00:00:00');
  if (fecha < hoy) return 'vencido';
  const pronto = new Date(hoy); pronto.setDate(pronto.getDate() + 30);
  if (fecha <= pronto) return 'proximo';
  return 'pendiente';
}

export function isEmbeddable(url: string) {
  return url.includes('supabase') || /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(url);
}

export function isImage(url: string) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
}

// ── UI primitives ──────────────────────────────────────────────────────────────

export function ClaveCopyable({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground/40 text-[11px]">Sin registro</span>;
  return (
    <span className="inline-flex items-center gap-1 group max-w-full">
      <span className="font-mono text-[12px] text-muted-foreground truncate max-w-[120px]" title={value}>{value}</span>
      <button
        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(value); toast.success('Copiado'); }}
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        title="Copiar clave"
      >
        <Copy className="size-3 text-muted-foreground" />
      </button>
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: string }) {
  const cfg = {
    pagado:    { label: 'Pagado',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    vencido:   { label: 'Vencido',   cls: 'bg-red-50 text-red-700 border-red-200' },
    proximo:   { label: 'Próximo',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pendiente: { label: 'Pendiente', cls: 'bg-muted/50 text-muted-foreground border-border' },
  }[estado] ?? { label: estado, cls: 'bg-muted/50 text-muted-foreground border-border' };
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg.cls)}>{cfg.label}</span>;
}

export function ValidacionBadge({ estado }: { estado: string | null | undefined }) {
  if (!estado || estado === 'sin_validar') return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
      Sin validar
    </span>
  );
  const cfg: Record<string, { label: string; cls: string }> = {
    coincide:         { label: 'Valido',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    error:            { label: 'Error',          cls: 'bg-red-50 text-red-700 border-red-200' },
    no_coincide:      { label: 'No coincide',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    sin_evidencia:    { label: 'Sin evidencia',  cls: 'bg-slate-50 text-slate-600 border-slate-200' },
    monto_ilegible:   { label: 'Monto ilegible', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    monto_ausente_db: { label: 'Monto ausente',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  };
  const c = cfg[estado] ?? { label: estado, cls: 'bg-muted/40 text-muted-foreground border-border' };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', c.cls)}>
      {c.label}
    </span>
  );
}

export function SelectSearch({
  value, onValueChange, options, placeholder = 'Seleccionar...', disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find(o => o.value === value);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;
  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (v) setTimeout(() => inputRef.current?.focus(), 0); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm',
            'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 size-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.length === 0
            ? <p className="py-3 text-center text-sm text-muted-foreground">Sin resultados</p>
            : filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onValueChange(o.value); setOpen(false); setSearch(''); }}
                className={cn(
                  'flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                  value === o.value && 'bg-accent text-accent-foreground font-medium',
                )}
              >
                <Check className={cn('mr-2 size-4 shrink-0', value === o.value ? 'opacity-100' : 'opacity-0')} />
                {o.label}
              </button>
            ))
          }
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DocEstatusBadge({ id }: { id: number | null }) {
  const cfg = id === 2
    ? { label: 'Verificado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : id === 3
    ? { label: 'Rechazado',  cls: 'bg-red-50 text-red-700 border-red-200' }
    : id === 4
    ? { label: 'Expirado',   cls: 'bg-orange-50 text-orange-700 border-orange-200' }
    : { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', cfg.cls)}>{cfg.label}</span>;
}

export function MiniKpiCard({ label, value, accent }: {
  label: string; value: string; accent?: 'success' | 'warning' | 'danger' | 'info';
}) {
  const valueClass = {
    success: 'text-emerald-600', warning: 'text-amber-600',
    danger: 'text-red-600', info: 'text-blue-600',
  }[accent ?? ''] ?? 'text-foreground';
  return (
    <div className="flex-1 rounded-md border border-border/60 bg-card px-3 py-2.5 min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 truncate">{label}</p>
      <p className={cn('text-[14px] font-bold tabular-nums leading-none', valueClass)}>{value}</p>
    </div>
  );
}

export function KpiCard({ label, value, sub, accent, children }: {
  label: string; value: string; sub?: string; accent?: 'success' | 'warning' | 'danger';
  children?: React.ReactNode;
}) {
  const valueClass = { success: 'text-emerald-600', warning: 'text-amber-600', danger: 'text-red-600' }[accent ?? ''] ?? 'text-foreground';
  return (
    <div className="sozu-kpi-card overflow-hidden">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-3">{label}</span>
      <p className={cn('text-[18px] font-bold tabular-nums leading-none mb-1.5', valueClass)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      {children}
    </div>
  );
}

export function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <Icon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-[12px] text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-foreground break-all">{value || '-'}</span>
    </div>
  );
}

export function EvidencePanel({ url, label, onClose, fill }: { url: string; label: string; onClose?: () => void; fill?: boolean }) {
  return (
    <div className={cn(fill ? 'flex flex-col flex-1 min-h-0 p-2 gap-2' : 'space-y-2')}>
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <a href={url} download target="_blank" rel="noopener noreferrer"
            title="Descargar"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <Download className="size-3" />
          </a>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
            <ExternalLink className="size-3" />Abrir
          </a>
          {onClose && (
            <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>
      {isEmbeddable(url)
        ? isImage(url)
          ? <img src={url} alt={label} className={cn('w-full rounded-md border border-border object-contain', fill ? 'flex-1 min-h-0' : 'max-h-[60vh]')} />
          : <iframe src={url} title={label} className={cn('w-full rounded-md border border-border bg-muted/20', fill ? 'flex-1 min-h-0' : 'h-[60vh]')} />
        : (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
            <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12px] text-foreground truncate">{url}</span>
          </a>
        )
      }
    </div>
  );
}

// ── tab config ──────────────────────────────────────────────────────────────────

export type InfoTab = 'resumen' | 'personas';
export type ActivityTab = 'acuerdos' | 'documentos';

export const INFO_TABS: { id: InfoTab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',  label: 'Resumen',  icon: LayoutDashboard },
  { id: 'personas', label: 'Personas', icon: Users },
];
export const ACTIVITY_TABS: { id: ActivityTab; label: string; icon: React.ElementType }[] = [
  { id: 'acuerdos',   label: 'Acuerdos de Pago', icon: Calendar },
  { id: 'documentos', label: 'Documentos',        icon: FileText },
];

export function TabBar<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string; icon: React.ElementType }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex border-b border-border">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors duration-100 whitespace-nowrap',
            active === tab.id
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}>
          <tab.icon className="size-3.5 shrink-0" strokeWidth={1.75} />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Botón "Recalcular dispersión" (compartido por los 3 tipos de detalle) ──────
// Aparece SOLO cuando hay dinero recibido (pagos) que aún no está distribuido en
// aplicaciones_pago (`show`). Dispara la edge function `recalcular-aplicaciones`.
export function RecalcularDispersionButton({ show, loading, onClick }: {
  show: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (!show) return null;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title="Hay pagos registrados que aún no se han distribuido en los acuerdos. Recalcula la dispersión."
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-[12px] font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      Recalcular dispersión
    </button>
  );
}

// ── CuentaDetalleCtx ───────────────────────────────────────────────────────────

export interface CuentaDetalleCtx {
  cuentaId: number;
  clabe_stp: string | null;
  precio_final: number;
  fecha_compra: string | null;
  valor_uma: number | null;
  activo: boolean;
  esMantenimiento: boolean;
  clienteNombre: string;
  compradores: any[];
  agente: any | null;
  ofertaId: number | null;
  ofertaProductoId: number | null;
  propiedadId: number | null;
  esquemaNombre: string;
  esquemaPct: any;
  proyectoNombre: string;
  edificioNombre: string;
  modeloNombre: string;
  numero_propiedad: string | null;
  productoNombre: string | null;
  tipo: string;
  m2Interiores: number;
  m2Exteriores: number;
  precioM2: number | null;
  estatusPropiedad: string;
  totalPagado: number;
  saldoPendiente: number;
  montoVencido: number;
  parcialidadesVencidas: number;
  pagadoEfectivo: number;
  acuerdos: any[];
  pagos: any[];
  aplicacionesList: any[];
  docs: any[];
  docsLoading: boolean;
  limiteEfectivo: number;
  aunPermitido: number;
  acuerdosPendientes: number;
  planIsModified: boolean;
  esquemaNombreDisplay: string | null;
  isEnDemanda: boolean;
  porcentajePagado: number;
  montoValidado: number;
  montoSinValidar: number;
  pagoIdToFechaDebida: Record<number, string | null>;
  pagoIdToMontoAplicado: Record<number, number>;
  conceptoGroups: Record<string, { total: number; pagado: number; count: number; fechas: (string | null)[] }>;
  _planParcAcuerdos: any[];
  _planEngTotal: number;
  _planParcTotal: number;
  _planEntTotal: number;
  _planPctE: number;
  _planPctP: number;
  _planPctEnt: number;
  acuerdosPage: number;
  setAcuerdosPage: React.Dispatch<React.SetStateAction<number>>;
  expandedAcuerdos: Set<number>;
  setExpandedAcuerdos: React.Dispatch<React.SetStateAction<Set<number>>>;
  selectedPagoId: number | null;
  setSelectedPagoId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedPago: any | null;
  setPagoDialog: (v: boolean) => void;
  setUploadDialog: (v: boolean) => void;
  openCargarEvidencia: (pago: any) => void;
  setEditCuentaDialog: (v: boolean) => void;
  setDemandaDialog: (v: boolean) => void;
  setQuitarDemandaDialog: (v: boolean) => void;
  setMultaAcuerdoId: (v: number | null) => void;
  setMultaDialog: (v: boolean) => void;
  setMultaGestionAcuerdoId: (v: number | null) => void;
  setMultaGestionDialog: (v: boolean) => void;
  setPagoEvidenciaModal: React.Dispatch<React.SetStateAction<any | null>>;
  setPdfPreviewModal: (v: { url: string; title: string } | null) => void;
  hayDiscrepancia: boolean;
  sumaAcuerdos: number;
  hayDiscrepanciaAplicaciones: boolean;
  recalculandoAplic: boolean;
  handleRecalcularAplicaciones: () => void;
  generatingPDF: boolean;
  downloadingOferta: boolean;
  handleEstadoCuenta: () => void;
  handleDownloadOferta: () => void;
  setTransferDialog: (v: boolean) => void;
}
