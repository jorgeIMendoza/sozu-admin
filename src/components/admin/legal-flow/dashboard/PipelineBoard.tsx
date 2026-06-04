import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Clock, AlertTriangle, ArrowRight, User, Building2, LayoutGrid, Maximize2 } from 'lucide-react';
import { mockRequests, STATUS_CONFIG } from '@/data/legalFlow/mockData';
import { useLegalFlowSolicitudesRecibidas } from '@/hooks/useLegalFlowSolicitudesRecibidas';
import { useLegalFlowFirmaTitular } from '@/hooks/useLegalFlowFirmaTitular';
import { useLegalFlowFirmado } from '@/hooks/useLegalFlowFirmado';
import type { CaseStatus, LegalRequest } from '@/types/legal-flow';

const PIPELINE_STAGES: { status: CaseStatus; label: string }[] = [
  { status: 'Solicitud recibida', label: 'Solicitud recibida' },
  { status: 'En revisión legal', label: 'En revisión legal' },
  { status: 'Aprobado', label: 'Aprobado' },
  { status: 'Firma cliente', label: 'Firma de cliente' },
  { status: 'Firma titular', label: 'Firma titular' },
  { status: 'Firmado', label: 'Firmado' },
];

const NEXT_ACTION: Record<string, string> = {
  'Solicitud recibida': 'Revisar',
  'Información faltante': 'Completar',
  'En revisión legal': 'Aprobar',
  'Aprobado': 'Generar',
  'Firma cliente': 'Ver firmas',
  'Firma titular': 'Firmar',
  'En firma': 'Firmar',
  'Parcialmente firmado': 'Firmar',
  'Firmado': 'Archivar',
};

const STAGE_COLORS: Record<string, string> = {
  'Solicitud recibida': 'hsl(var(--status-info))',
  'En revisión legal': 'hsl(var(--status-warning))',
  'Aprobado': 'hsl(var(--status-success))',
  'Firma cliente': 'hsl(var(--status-purple))',
  'Firma titular': 'hsl(200, 72%, 36%)',
  'Firmado': 'hsl(var(--status-success))',
};

interface Props {
  onColumnClick?: (status: CaseStatus) => void;
  search?: string;
}

type ViewMode = 'compact' | 'expanded';

function groupByStage(requests: LegalRequest[]) {
  const groups: Record<string, LegalRequest[]> = {};
  for (const stage of PIPELINE_STAGES) groups[stage.status] = [];
  for (const r of requests) {
    if (r.status === 'Información faltante') groups['Solicitud recibida']?.push(r);
    else if (r.status === 'Parcialmente firmado') groups['Firma titular']?.push(r);
    else if (r.status === 'En firma') groups['Firma titular']?.push(r);
    else if (groups[r.status]) groups[r.status].push(r);
  }
  return groups;
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const isOverdue = (d: string) => new Date(d) < new Date();

export default function PipelineBoard({ onColumnClick, search = '' }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('expanded');
  const { data: solicitudesRecibidas } = useLegalFlowSolicitudesRecibidas();
  const { data: firmaTitular } = useLegalFlowFirmaTitular();
  const { data: firmado } = useLegalFlowFirmado();

  // Etapas alimentadas con datos reales:
  //   • Solicitud recibida + En revisión legal: cuentas Apartado con/sin
  //     promoción según bitácora.
  //   • Firma titular: cuentas con Contrato firmado completamente (tipo 18)
  //     en estatus de verificación Pendiente.
  //   • Firmado: cuentas con el mismo documento en estatus Validado. Una
  //     vez el contrato se valida, el expediente vive aquí y no regresa
  //     a Solicitud recibida ni a Firma titular.
  // El resto del pipeline sigue usando mock hasta que cada etapa tenga
  // su origen propio.
  const activeRequests = useMemo<LegalRequest[]>(() => {
    const firmadoSet = new Set(
      (firmado ?? [])
        .map((r) => r.idCuentaCobranza)
        .filter((v): v is number => !!v),
    );
    const firmaTitularSet = new Set(
      (firmaTitular ?? [])
        .map((r) => r.idCuentaCobranza)
        .filter((v): v is number => !!v),
    );
    // Una cuenta en "Firmado" sale de Firma titular y de Solicitud
    // recibida; una cuenta en "Firma titular" sale de Solicitud recibida.
    const firmaTitularFiltered = (firmaTitular ?? []).filter(
      (r) => !r.idCuentaCobranza || !firmadoSet.has(r.idCuentaCobranza),
    );
    const recibidasFiltered = (solicitudesRecibidas ?? []).filter(
      (r) =>
        !r.idCuentaCobranza ||
        (!firmaTitularSet.has(r.idCuentaCobranza) && !firmadoSet.has(r.idCuentaCobranza)),
    );
    const downstreamMock = mockRequests.filter(
      (r) =>
        ![
          'Solicitud recibida',
          'Información faltante',
          'En revisión legal',
          'Firma titular',
          'En firma',
          'Parcialmente firmado',
          'Firmado',
          'Cancelado',
          'Rechazado',
          'Archivado',
        ].includes(r.status),
    );
    return [
      ...recibidasFiltered,
      ...firmaTitularFiltered,
      ...(firmado ?? []),
      ...downstreamMock,
    ];
  }, [solicitudesRecibidas, firmaTitular, firmado]);

  // Búsqueda por ID de cuenta (folio CC-XXXXXX), contraparte
  // (titular/compradores) o unidad ("Unidad 1005" o solo "1005").
  const visibleRequests = useMemo<LegalRequest[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeRequests;
    return activeRequests.filter((r) => {
      if (r.id.toLowerCase().includes(q)) return true;
      if (r.counterparty?.toLowerCase().includes(q)) return true;
      if (r.counterparties?.some((cp) => cp.toLowerCase().includes(q))) return true;
      if (r.property?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [activeRequests, search]);

  const grouped = groupByStage(visibleRequests);

  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">
            Pipeline de Contratos
          </h2>
          <span className="text-[12px] text-muted-foreground bg-muted rounded-md px-2 py-0.5 tabular-nums font-medium">
            {visibleRequests.length} activos
          </span>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('compact')}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'compact' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3 w-3" />
            Compacta
          </button>
          <button
            onClick={() => setViewMode('expanded')}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'expanded' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Maximize2 className="h-3 w-3" />
            Expandida
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="relative overflow-x-auto scrollbar-thin">
        {/* Fade hints */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent z-10" />
        <div
          className="flex gap-5 p-6"
          style={{ minWidth: viewMode === 'expanded' ? '2100px' : '1400px' }}
        >
          {PIPELINE_STAGES.map((stage) => {
            const items = grouped[stage.status] || [];
            const overdueCount = items.filter(r => isOverdue(r.dueDate)).length;
            const urgentCount = items.filter(r => r.priority === 'Alto').length;
            const stageColor = STAGE_COLORS[stage.status] || 'hsl(var(--muted-foreground))';

            return (
              <div
                key={stage.status}
                className="flex-1 flex flex-col"
                style={{ minWidth: viewMode === 'expanded' ? '320px' : '200px' }}
              >
                {/* Column header */}
                <button
                  onClick={() => onColumnClick?.(stage.status)}
                  className="flex flex-col gap-2 mb-4 text-left group cursor-pointer rounded-xl border border-border/60 bg-muted/30 px-4 py-3.5 hover:border-primary/30 hover:bg-muted/50 transition-all"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stageColor }} />
                      <span className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                        {stage.label}
                      </span>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums bg-card border border-border rounded-lg px-2.5 py-1 shadow-sm">
                      {items.length}
                    </span>
                  </div>
                  {/* Alerts row */}
                  {(overdueCount > 0 || urgentCount > 0) && (
                    <div className="flex items-center gap-3">
                      {overdueCount > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          <span className="text-[11px] text-destructive font-medium">
                            {overdueCount} vencido{overdueCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {urgentCount > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                          <span className="text-[11px] text-destructive/80 font-medium">
                            {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </button>

                {/* Cards */}
                <div
                  className="flex-1 space-y-3 overflow-y-auto scrollbar-thin pr-1"
                  style={{ maxHeight: viewMode === 'expanded' ? '520px' : '400px' }}
                >
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-border/50 bg-muted/10">
                      <p className="text-[12px] text-muted-foreground/50 font-medium">Sin expedientes</p>
                      <p className="text-[11px] text-muted-foreground/30 mt-1">No hay pendientes por ahora</p>
                    </div>
                  ) : (
                    items.map((r) => (
                      <PipelineCard key={r.id} request={r} viewMode={viewMode} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function PipelineCard({ request: r, viewMode }: { request: LegalRequest; viewMode: ViewMode }) {
  const overdue = isOverdue(r.dueDate) && !['Firmado', 'Archivado'].includes(r.status);
  const action = NEXT_ACTION[r.status];
  const isCompact = viewMode === 'compact';

  return (
    <Link
      to={`/admin/legal-flow/cases/${r.id}`}
      className={`block rounded-xl border bg-card transition-all duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] group cursor-pointer ${
        overdue ? 'border-destructive/30' : 'border-border hover:border-primary/30'
      } ${isCompact ? 'p-3.5' : 'p-5'}`}
    >
      {/* Title */}
      <p className={`font-semibold text-foreground leading-snug group-hover:text-primary transition-colors ${
        isCompact ? 'text-[12px] line-clamp-1' : 'text-[13px] line-clamp-2'
      }`}>
        {r.title}
      </p>

      {/* Counterparty */}
      <p className={`text-muted-foreground truncate ${isCompact ? 'text-[11px] mt-1' : 'text-[12px] mt-2'}`}>
        {r.counterparty}
      </p>

      {!isCompact && (
        <>
          {/* Project / Property */}
          {(r.project || r.property) && (
            <div className="flex items-center gap-1.5 mt-2">
              <Building2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className="text-[11px] text-muted-foreground/70 truncate">
                {[r.project, r.property].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}

          {/* Assigned to */}
          {r.assignedTo && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <User className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className="text-[11px] text-muted-foreground/70 truncate">{r.assignedTo}</span>
            </div>
          )}
        </>
      )}

      {/* Date + alerts row */}
      <div className={`flex items-center justify-between ${isCompact ? 'mt-2' : 'mt-3'}`}>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground/40" />
          <span className={`text-[11px] tabular-nums font-mono ${overdue ? 'text-destructive font-semibold' : 'text-muted-foreground/60'}`}>
            {formatDate(r.dueDate)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {r.priority === 'Alto' && (
            <span className="status-badge status-danger text-[10px] px-2 py-0.5">Urgente</span>
          )}
          {overdue && (
            <span className="status-badge status-warning text-[10px] px-2 py-0.5">Vencido</span>
          )}
        </div>
      </div>

      {/* CTA */}
      {action && (
        <div className={`border-t border-border/40 ${isCompact ? 'mt-2.5 pt-2.5' : 'mt-4 pt-4'}`}>
          <span className={`inline-flex items-center gap-1.5 w-full justify-center font-semibold text-primary-foreground bg-primary rounded-lg group-hover:bg-primary/90 transition-colors ${
            isCompact ? 'text-[11px] px-3 py-1.5' : 'text-[12px] px-4 py-2'
          }`}>
            {action} <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      )}
    </Link>
  );
}
