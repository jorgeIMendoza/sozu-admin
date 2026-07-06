import { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare, AlertTriangle, Clock, FileText, XCircle,
  CheckCircle2, Search, X, ChevronDown,
  Building2, Home, AlertCircle, Info,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Kpi, PageHeader, Panel, Pill } from '@/components/admin/portal-escrituracion/ui';
import {
  useUnidadesListasEscriturar,
  type UnidadEscriturable,
  type ConclusionEscrituracion,
  OBLIGATORIO_GRUPOS,
} from '@/hooks/useUnidadesListasEscriturar';

// ─── Constants / Meta ─────────────────────────────────────────────────────────

const CONCLUSION_META: Record<ConclusionEscrituracion, { label: string; cls: string }> = {
  LISTA:              { label: 'Lista',              cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  BLOQUEADA:          { label: 'Bloqueada',          cls: 'bg-red-50 text-red-700 border border-red-200' },
  PENDIENTE_REVISION: { label: 'Pendiente revisión', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

const ESTATUS_META: Record<number, { label: string; cls: string }> = {
  5: { label: 'Vendida',           cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
  7: { label: 'Escrituración',     cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  9: { label: 'Pagada completa',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <Shimmer className="h-3 w-28 mb-3" />
      <Shimmer className="h-8 w-14" />
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function ConclusionBadge({ conclusion }: { conclusion: ConclusionEscrituracion }) {
  const m = CONCLUSION_META[conclusion];
  const Icon = conclusion === 'LISTA' ? CheckCircle2 : conclusion === 'BLOQUEADA' ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      <Icon className="w-3 h-3 shrink-0" />
      {m.label}
    </span>
  );
}

function EstatusPropiedad({ estatusId }: { estatusId: number }) {
  const m = ESTATUS_META[estatusId] ?? { label: `Estatus ${estatusId}`, cls: 'bg-muted text-foreground' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── Expediente Progress ──────────────────────────────────────────────────────

function ExpedienteChip({ docsCompletos }: { docsCompletos: number }) {
  const total = OBLIGATORIO_GRUPOS.length;
  const ok = docsCompletos >= total;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <Progress value={(docsCompletos / total) * 100} className={`h-1.5 flex-1 ${ok ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'}`} />
      <span className={`text-xs tabular-nums font-medium ${ok ? 'text-emerald-600' : 'text-muted-foreground'}`}>
        {docsCompletos}/{total}
      </span>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="text-xs font-medium text-right">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}

function DetalleUnidadModal({ row, onClose }: { row: UnidadEscriturable; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Unidad {row.numeroPropiedad}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{row.proyecto}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Conclusión */}
          <div className="flex items-center gap-2">
            <ConclusionBadge conclusion={row.conclusion} />
            <EstatusPropiedad estatusId={row.estatusDisponibilidadId} />
          </div>

          {/* Bloqueantes */}
          {row.blockers.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Bloqueantes
              </p>
              {row.blockers.map((b, i) => (
                <p key={i} className="text-xs text-red-600 pl-5">{b}</p>
              ))}
            </div>
          )}

          {/* Advertencias */}
          {row.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Pendiente revisión
              </p>
              {row.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 pl-5">{w}</p>
              ))}
            </div>
          )}

          {/* Ficha */}
          <Section title="Inmueble">
            <div className="rounded-lg bg-muted/40 p-3">
              <DetailRow label="Edificio">{row.edificio}</DetailRow>
              <DetailRow label="Modelo">{row.modelo}</DetailRow>
              <DetailRow label="Proyecto">{row.proyecto}</DetailRow>
              <DetailRow label="Estatus"><EstatusPropiedad estatusId={row.estatusDisponibilidadId} /></DetailRow>
            </div>
          </Section>

          {/* Compradores */}
          <Section title="Compradores">
            {row.compradores.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin compradores registrados</p>
            ) : (
              <div className="space-y-1.5">
                {row.compradores.map(c => (
                  <div key={c.id_persona} className="rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{c.nombre}</p>
                      {c.rfc && <p className="text-[11px] text-muted-foreground font-mono">{c.rfc}</p>}
                    </div>
                    {c.porcentaje < 100 && (
                      <span className="text-xs text-muted-foreground font-semibold">{c.porcentaje}%</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Pagos */}
          <Section title="Pagos">
            <div className="rounded-lg bg-muted/40 p-3">
              <DetailRow label="Total pagos">{row.totalPagos}</DetailRow>
              <DetailRow label="Coincide">
                <span className="text-emerald-600 font-semibold">{row.pagosCoincide}</span>
              </DetailRow>
              <DetailRow label="Con error">
                <span className={row.pagosError > 0 ? 'text-red-600 font-semibold' : ''}>{row.pagosError}</span>
              </DetailRow>
              <DetailRow label="Sin validar">
                <span className={row.pagosSinValidar > 0 ? 'text-amber-600' : ''}>{row.pagosSinValidar}</span>
              </DetailRow>
              <DetailRow label="CEP pendiente">
                <span className="text-muted-foreground">{row.pagosCepPendiente}</span>
              </DetailRow>
            </div>
          </Section>

          {/* Expediente */}
          <Section title="Expediente">
            <div className="rounded-lg bg-muted/40 p-3 space-y-3">
              <div className="space-y-1">
                {OBLIGATORIO_GRUPOS.map(g => (
                  <div key={g.key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{g.label}</span>
                    <span className="text-muted-foreground text-[11px]">grupo {g.key}</span>
                  </div>
                ))}
              </div>
              <div>
                <Progress
                  value={(row.docsCompletos / OBLIGATORIO_GRUPOS.length) * 100}
                  className={`h-1.5 ${row.expedienteOk ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-500'}`}
                />
                <p className={`text-[11px] mt-1 font-medium ${row.expedienteOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {row.docsCompletos}/{OBLIGATORIO_GRUPOS.length} grupos obligatorios verificados
                  {!row.expedienteOk && ` · Faltan ${OBLIGATORIO_GRUPOS.length - row.docsCompletos}`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Conservador: mínimo entre todos los compradores
                </p>
              </div>
            </div>
          </Section>

          {/* Morosidad */}
          {row.acuerdosVencidos > 0 && (
            <Section title="Morosidad">
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <DetailRow label="Acuerdos vencidos">
                  <span className="text-red-600 font-semibold">{row.acuerdosVencidos}</span>
                </DetailRow>
                <DetailRow label="Más antiguo">
                  <span className="text-red-600 font-semibold">{row.diasMaxVencimiento} días</span>
                </DetailRow>
              </div>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCards({ unidades, loading }: { unidades: UnidadEscriturable[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
    );
  }

  const total         = unidades.length;
  const listas        = unidades.filter(u => u.conclusion === 'LISTA').length;
  const bloqueadas    = unidades.filter(u => u.conclusion === 'BLOQUEADA').length;
  const pendientes    = unidades.filter(u => u.conclusion === 'PENDIENTE_REVISION').length;
  const conErrPago    = unidades.filter(u => u.pagosError > 0).length;
  const sinExpediente = unidades.filter(u => !u.expedienteOk).length;
  const conMorosidad  = unidades.filter(u => u.acuerdosVencidos > 0).length;
  const enEscriturac  = unidades.filter(u => u.estatusDisponibilidadId === 7).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <Kpi label="Total candidatos"   value={total}         icon={Home}         tone="default"  />
      <Kpi label="Listas"             value={listas}        icon={CheckCircle2} tone="success"  hint={total > 0 ? `${Math.round((listas/total)*100)}% del total` : undefined} />
      <Kpi label="Bloqueadas"         value={bloqueadas}    icon={XCircle}      tone="destructive" />
      <Kpi label="Pendiente revisión" value={pendientes}    icon={Clock}        tone="warning"  />
      <Kpi label="Error en pagos"     value={conErrPago}    icon={AlertCircle}  tone="destructive" />
      <Kpi label="Sin expediente"     value={sinExpediente} icon={FileText}     tone="warning"  />
      <Kpi label="Con morosidad"      value={conMorosidad}  icon={AlertTriangle} tone="destructive" />
      <Kpi label="En escrituración"   value={enEscriturac}  icon={CheckSquare}  tone="primary"  />
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

type FiltroConclusion = 'TODOS' | ConclusionEscrituracion;

function TablaUnidades({
  unidades,
  loading,
  onSelectRow,
}: {
  unidades: UnidadEscriturable[];
  loading: boolean;
  onSelectRow: (u: UnidadEscriturable) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!unidades.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <Home className="w-8 h-8 opacity-40" />
        <p className="text-sm font-medium">Sin unidades para mostrar</p>
        <p className="text-xs">Ajusta los filtros o selecciona otro proyecto</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unidad</TableHead>
            <TableHead>Edificio / Modelo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead className="text-center">Pagos</TableHead>
            <TableHead className="text-center">Expediente</TableHead>
            <TableHead className="text-center">Morosidad</TableHead>
            <TableHead>Conclusión</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {unidades.map(u => (
            <TableRow
              key={u.propiedadId}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onSelectRow(u)}
            >
              <TableCell className="font-medium tabular-nums">{u.numeroPropiedad}</TableCell>
              <TableCell>
                <div className="text-xs">
                  <p className="font-medium">{u.edificio}</p>
                  <p className="text-muted-foreground">{u.modelo}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-xs max-w-[140px]">
                  <p className="font-medium truncate">{u.clienteNombre}</p>
                  {u.compradores.length > 1 && (
                    <p className="text-muted-foreground">{u.compradores.length} compradores</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <EstatusPropiedad estatusId={u.estatusDisponibilidadId} />
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs tabular-nums">{u.totalPagos}</span>
                  {u.pagosError > 0 && (
                    <span className="text-[11px] text-red-600 font-medium">{u.pagosError} error</span>
                  )}
                  {u.pagosSinValidar > 0 && u.pagosError === 0 && (
                    <span className="text-[11px] text-amber-600">{u.pagosSinValidar} s/val</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <ExpedienteChip docsCompletos={u.docsCompletos} />
              </TableCell>
              <TableCell className="text-center">
                {u.acuerdosVencidos > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    {u.diasMaxVencimiento}d
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <ConclusionBadge conclusion={u.conclusion} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function UnidadesListasEscriturar() {
  const [proyectoId, setProyectoId]   = useState<number | null>(null);
  const [search, setSearch]           = useState('');
  const [filtroConclusion, setFiltroConclusion] = useState<FiltroConclusion>('TODOS');
  const [selectedRow, setSelectedRow] = useState<UnidadEscriturable | null>(null);
  const [proyDropdown, setProyDropdown] = useState(false);

  const { unidades, proyectos, isLoading, error } = useUnidadesListasEscriturar(proyectoId);

  // Autoselect primer proyecto
  useEffect(() => {
    if (proyectos.length > 0 && proyectoId === null) {
      setProyectoId(proyectos[0].id);
    }
  }, [proyectos, proyectoId]);

  // Reset filtros al cambiar proyecto
  useEffect(() => {
    setSearch('');
    setFiltroConclusion('TODOS');
  }, [proyectoId]);

  const proyectoNombre = proyectos.find(p => p.id === proyectoId)?.nombre ?? 'Proyecto';

  // Filtros aplicados
  const unidadesFiltradas = useMemo(() => {
    let list = unidades;
    if (filtroConclusion !== 'TODOS') list = list.filter(u => u.conclusion === filtroConclusion);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.numeroPropiedad.toLowerCase().includes(q) ||
        u.clienteNombre.toLowerCase().includes(q) ||
        u.edificio.toLowerCase().includes(q)
      );
    }
    return list;
  }, [unidades, filtroConclusion, search]);

  return (
    <>
      <PageHeader
        title="Unidades listas para escriturar"
        description="Diagnóstico integral de readiness escritural por unidad"
        action={
          <div className="relative">
            <button
              onClick={() => setProyDropdown(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
            >
              <Building2 className="w-4 h-4 text-muted-foreground" />
              {proyectoNombre}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {proyDropdown && (
              <div
                className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-border bg-popover shadow-lg py-1"
                onBlur={() => setProyDropdown(false)}
              >
                {proyectos.map(p => (
                  <button
                    key={p.id}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${p.id === proyectoId ? 'text-primary font-medium' : ''}`}
                    onClick={() => { setProyectoId(p.id); setProyDropdown(false); }}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <KpiCards unidades={unidades} loading={isLoading} />

      <Panel
        title="Unidades candidatas a escrituración"
        description={`${unidadesFiltradas.length} unidades${filtroConclusion !== 'TODOS' ? ` · filtro: ${CONCLUSION_META[filtroConclusion].label}` : ''}`}
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Filtro conclusión */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(['TODOS', 'LISTA', 'PENDIENTE_REVISION', 'BLOQUEADA'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroConclusion(f)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    filtroConclusion === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f === 'TODOS' ? 'Todos' : CONCLUSION_META[f].label}
                </button>
              ))}
            </div>
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar unidad o cliente…"
                className="pl-8 h-8 text-sm w-48"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        }
      >
        {error ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <AlertCircle className="w-7 h-7 text-destructive opacity-70" />
            <p className="text-sm font-medium text-destructive">Error al cargar datos</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : (
          <TablaUnidades
            unidades={unidadesFiltradas}
            loading={isLoading}
            onSelectRow={setSelectedRow}
          />
        )}
      </Panel>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <strong>Bloqueada:</strong> pago con error/no-coincide o morosidad &gt; 30 días
        </span>
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <strong>Pendiente:</strong> pagos sin validar o expediente incompleto
        </span>
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <strong>CEP pendiente:</strong> STP sin CEP dentro de los últimos 10 días hábiles (no bloqueante)
        </span>
      </div>

      {selectedRow && (
        <DetalleUnidadModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </>
  );
}
