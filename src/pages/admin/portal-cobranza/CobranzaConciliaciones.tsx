import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ActiveFilterBanner } from '@/components/cobranza/ActiveFilterBanner';
import { NewConciliacionModal } from '@/components/cobranza/NewConciliacionModal';
import { ArchiveConciliacionModal } from '@/components/cobranza/ArchiveConciliacionModal';
import { formatCurrency, formatDate } from '@/components/cobranza/StatusBadges';
import { Button } from '@/components/ui/button';
import {
  mockConciliaciones, isFueraSLA, addConciliacionBitacoraEntry,
  conciliacionCaseTypeLabels, conciliacionStatusLabels, conciliacionStatusColors,
  priorityLabels, priorityColors, originLabels,
  type ConciliacionCase, type ConciliacionStatus, type ConciliacionPriority,
  type ArchiveReason, type ConciliacionCaseType,
} from '@/data/cobranza/conciliacionData';
import {
  AlertTriangle, Clock, Plus, Search, X, Eye, FileText, CheckCircle2,
  RotateCcw, Archive, ArrowUpRight, User, Briefcase, MessageSquare,
  ChevronRight, Filter, ArrowUpDown, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/usePagination';
import { SimplePagination } from '@/components/ui/simple-pagination';

const executives = ['Luz Ochoa', 'Tomás Peterson'];

export default function ConciliacionesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // State
  const [cases, setCases] = useState<ConciliacionCase[]>(mockConciliaciones);
  const [statusFilter, setStatusFilter] = useState<ConciliacionStatus | 'all'>(() => (searchParams.get('estado') as ConciliacionStatus) || 'all');
  const [priorityFilter, setPriorityFilter] = useState<ConciliacionPriority | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<ConciliacionCaseType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'sla'>('priority');
  const [selectedCase, setSelectedCase] = useState<ConciliacionCase | null>(null);
  const [detailTab, setDetailTab] = useState<'resumen' | 'historial' | 'acciones'>('resumen');

  // Modals
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveCaseId, setArchiveCaseId] = useState('');

  const clearAllFilters = useCallback(() => {
    setStatusFilter('all'); setPriorityFilter('all'); setAssigneeFilter('all'); setTypeFilter('all');
    setSearchQuery('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Stats
  const stats = useMemo(() => {
    const all = cases;
    return {
      total: all.length,
      abiertas: all.filter(c => c.status === 'abierta').length,
      enRevision: all.filter(c => c.status === 'en_revision').length,
      esperandoCliente: all.filter(c => c.status === 'esperando_cliente').length,
      escaladas: all.filter(c => c.status === 'escalada').length,
      resueltas: all.filter(c => c.status === 'resuelta').length,
      archivadas: all.filter(c => c.status === 'archivada').length,
      fueraSLA: all.filter(c => isFueraSLA(c)).length,
      altaPrioridad: all.filter(c => (c.priority === 'alta' || c.priority === 'critica') && !['resuelta', 'archivada'].includes(c.status)).length,
      montoTotal: all.filter(c => !['resuelta', 'archivada'].includes(c.status)).reduce((s, c) => s + (c.relatedAmount || 0), 0),
    };
  }, [cases]);

  // Filter & Sort
  const filtered = useMemo(() => {
    let list = cases;
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter(c => c.priority === priorityFilter);
    if (assigneeFilter !== 'all') list = list.filter(c => c.assignee === assigneeFilter);
    if (typeFilter !== 'all') list = list.filter(c => c.caseType === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.id.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) || c.accountNumber.toLowerCase().includes(q) ||
        c.projectName.toLowerCase().includes(q)
      );
    }

    const priorityOrder: Record<ConciliacionPriority, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
    list = [...list].sort((a, b) => {
      if (sortBy === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (sortBy === 'date') return new Date(b.openDate).getTime() - new Date(a.openDate).getTime();
      // sla
      return (parseInt(a.sla) || 99) - (parseInt(b.sla) || 99);
    });
    return list;
  }, [cases, statusFilter, priorityFilter, assigneeFilter, typeFilter, searchQuery, sortBy]);

  const hasFilters = statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' || typeFilter !== 'all' || searchQuery.trim();

  const { paginated: paginatedCases, page, setPage, totalPages, total, from, to } = usePagination(filtered, 50);

  // Actions
  const handleNewCase = useCallback((c: ConciliacionCase) => {
    setCases(prev => [c, ...prev]);
    addConciliacionBitacoraEntry(c.accountId, `Caso de conciliación creado: ${c.title}`, c.description, c.assignee);
  }, []);

  const handleStatusChange = useCallback((caseId: string, newStatus: ConciliacionStatus) => {
    setCases(prev => prev.map(c => {
      if (c.id !== caseId) return c;
      const old = c.status;
      addConciliacionBitacoraEntry(c.accountId, `Caso ${caseId}: cambio de estatus`, `De "${conciliacionStatusLabels[old]}" a "${conciliacionStatusLabels[newStatus]}"`, c.assignee);
      const updated = { ...c, status: newStatus, lastMovementDate: new Date().toISOString().split('T')[0],
        history: [...c.history, { id: `h-${Date.now()}`, date: new Date().toISOString(), user: c.assignee, action: 'Cambio de estatus', detail: `${conciliacionStatusLabels[old]} → ${conciliacionStatusLabels[newStatus]}`, previousValue: conciliacionStatusLabels[old], newValue: conciliacionStatusLabels[newStatus] }],
      };
      if (newStatus === 'resuelta') updated.markPendingConciliation = false;
      return updated;
    }));
    if (selectedCase?.id === caseId) {
      setSelectedCase(prev => prev ? { ...prev, status: newStatus, lastMovementDate: new Date().toISOString().split('T')[0] } : null);
    }
  }, [selectedCase]);

  const handlePriorityChange = useCallback((caseId: string, newPriority: ConciliacionPriority) => {
    setCases(prev => prev.map(c => {
      if (c.id !== caseId) return c;
      addConciliacionBitacoraEntry(c.accountId, `Caso ${caseId}: cambio de prioridad`, `De "${priorityLabels[c.priority]}" a "${priorityLabels[newPriority]}"`, c.assignee);
      return { ...c, priority: newPriority, lastMovementDate: new Date().toISOString().split('T')[0],
        history: [...c.history, { id: `h-${Date.now()}`, date: new Date().toISOString(), user: c.assignee, action: 'Cambio de prioridad', detail: `${priorityLabels[c.priority]} → ${priorityLabels[newPriority]}`, previousValue: priorityLabels[c.priority], newValue: priorityLabels[newPriority] }],
      };
    }));
  }, []);

  const handleAssigneeChange = useCallback((caseId: string, newAssignee: string) => {
    setCases(prev => prev.map(c => {
      if (c.id !== caseId) return c;
      addConciliacionBitacoraEntry(c.accountId, `Caso ${caseId}: reasignado`, `De "${c.assignee}" a "${newAssignee}"`, newAssignee);
      return { ...c, assignee: newAssignee, lastMovementDate: new Date().toISOString().split('T')[0],
        history: [...c.history, { id: `h-${Date.now()}`, date: new Date().toISOString(), user: newAssignee, action: 'Reasignación', detail: `Reasignado de ${c.assignee} a ${newAssignee}`, previousValue: c.assignee, newValue: newAssignee }],
      };
    }));
  }, []);

  const handleArchive = useCallback((reason: ArchiveReason, comment: string) => {
    setCases(prev => prev.map(c => {
      if (c.id !== archiveCaseId) return c;
      addConciliacionBitacoraEntry(c.accountId, `Caso ${c.id} archivado`, comment, c.assignee);
      return { ...c, status: 'archivada' as ConciliacionStatus, archiveReason: reason, archiveComment: comment,
        markPendingConciliation: false, lastMovementDate: new Date().toISOString().split('T')[0],
        history: [...c.history, { id: `h-${Date.now()}`, date: new Date().toISOString(), user: c.assignee, action: 'Caso archivado', detail: comment }],
      };
    }));
    if (selectedCase?.id === archiveCaseId) setSelectedCase(null);
  }, [archiveCaseId, selectedCase]);

  const openArchiveModal = useCallback((id: string) => {
    setArchiveCaseId(id);
    setArchiveOpen(true);
  }, []);

  return (
    <div className="flex h-full -m-5">
      {/* Main list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="sozu-page-title">Casos de Conciliación</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Gestión operativa de aclaraciones, incidencias y conciliaciones · {stats.total} casos</p>
            </div>
            <Button size="sm" onClick={() => setNewCaseOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Nuevo caso
            </Button>
          </div>

          <ActiveFilterBanner onClear={clearAllFilters} />

          {/* KPI strip */}
          <div className="flex items-center gap-2 flex-wrap">
            <KPIPill label="Abiertas" value={stats.abiertas} dotColor="bg-danger" onClick={() => setStatusFilter('abierta')} active={statusFilter === 'abierta'} />
            <KPIPill label="En revisión" value={stats.enRevision} dotColor="bg-warning" onClick={() => setStatusFilter('en_revision')} active={statusFilter === 'en_revision'} />
            <KPIPill label="Esperando cliente" value={stats.esperandoCliente} dotColor="bg-info" onClick={() => setStatusFilter('esperando_cliente')} active={statusFilter === 'esperando_cliente'} />
            <KPIPill label="Escaladas" value={stats.escaladas} dotColor="bg-priority-purple" onClick={() => setStatusFilter('escalada')} active={statusFilter === 'escalada'} />
            <KPIPill label="Resueltas" value={stats.resueltas} dotColor="bg-success" onClick={() => setStatusFilter('resuelta')} active={statusFilter === 'resuelta'} />
            <KPIPill label="Fuera SLA" value={stats.fueraSLA} dotColor="bg-danger" alert onClick={() => { /* could filter fueraSLA */ }} />
            <KPIPill label="Alta prioridad" value={stats.altaPrioridad} dotColor="bg-danger" />
            {stats.montoTotal > 0 && (
              <div className="ml-auto text-[12px] text-muted-foreground">
                Monto activo: <span className="font-semibold text-foreground">{formatCurrency(stats.montoTotal)}</span>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar caso, cliente, cuenta..."
                className="w-full h-[34px] rounded-md border border-input bg-background pl-9 pr-3 text-[13px]" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="sozu-filter-select">
              <option value="all">Estado: Todos</option>
              {Object.entries(conciliacionStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)} className="sozu-filter-select">
              <option value="all">Prioridad: Todas</option>
              {Object.entries(priorityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="sozu-filter-select">
              <option value="all">Responsable: Todos</option>
              {executives.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="sozu-filter-select">
              <option value="all">Tipo: Todos</option>
              {Object.entries(conciliacionCaseTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="sozu-filter-select">
              <option value="priority">Ordenar: Prioridad</option>
              <option value="date">Ordenar: Fecha</option>
              <option value="sla">Ordenar: SLA</option>
            </select>
            {hasFilters && (
              <button onClick={clearAllFilters}
                className="h-[34px] px-3 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg flex items-center gap-1.5 transition-colors">
                <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Case list */}
        <div className="flex-1 overflow-auto p-5 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <AlertTriangle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground mb-1">No se encontraron casos con estos filtros</p>
              <button onClick={clearAllFilters} className="text-[13px] text-primary hover:underline">Limpiar filtros</button>
            </div>
          ) : (
            paginatedCases.map(c => (
              <CaseCard key={c.id} caso={c} selected={selectedCase?.id === c.id}
                onClick={() => { setSelectedCase(c); setDetailTab('resumen'); }}
                isFuera={isFueraSLA(c)} />
            ))
          )}
          <SimplePagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={total}
            from={from}
            to={to}
            className="border-t-0 mt-2"
          />
        </div>
      </div>

      {/* Detail panel */}
      {selectedCase && (
        <div className="w-[400px] shrink-0 bg-card border-l border-border flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">{selectedCase.id}</p>
              <h3 className="text-[14px] font-semibold text-foreground leading-tight">{selectedCase.title}</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCase(null)}>
              <X className="w-4 h-4" strokeWidth={1.75} />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['resumen', 'historial', 'acciones'] as const).map(tab => (
              <button key={tab} onClick={() => setDetailTab(tab)}
                className={cn('flex-1 py-2 text-[12px] font-medium transition-colors border-b-2',
                  detailTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {tab === 'resumen' ? 'Resumen' : tab === 'historial' ? 'Historial' : 'Acciones'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {detailTab === 'resumen' && (
              <>
                {/* Status & priority */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('sozu-chip', conciliacionStatusColors[selectedCase.status].bg, conciliacionStatusColors[selectedCase.status].text)}>
                    {conciliacionStatusLabels[selectedCase.status]}
                  </span>
                  <span className={cn('sozu-chip', priorityColors[selectedCase.priority].bg, priorityColors[selectedCase.priority].text)}>
                    {priorityLabels[selectedCase.priority]}
                  </span>
                  {isFueraSLA(selectedCase) && <span className="sozu-chip bg-danger-bg text-danger">Fuera SLA</span>}
                  {selectedCase.markPendingConciliation && <span className="sozu-chip bg-info-bg text-info">Pend. conciliación</span>}
                  {selectedCase.blockProcess && <span className="sozu-chip bg-danger-bg text-danger">Bloqueado</span>}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <InfoItem label="Tipo de caso" value={conciliacionCaseTypeLabels[selectedCase.caseType]} />
                  <InfoItem label="Origen" value={originLabels[selectedCase.origin]} />
                  <InfoItem label="Cliente" value={selectedCase.clientName} />
                  <InfoItem label="Proyecto" value={selectedCase.projectName} />
                  <InfoItem label="Cuenta" value={selectedCase.accountNumber} />
                  <InfoItem label="Unidad" value={selectedCase.unitNumber} />
                  <InfoItem label="Responsable" value={selectedCase.assignee} />
                  <InfoItem label="SLA" value={selectedCase.sla} />
                  <InfoItem label="Apertura" value={formatDate(selectedCase.openDate)} />
                  <InfoItem label="Último mov." value={formatDate(selectedCase.lastMovementDate)} />
                  {selectedCase.relatedAmount && <InfoItem label="Monto" value={formatCurrency(selectedCase.relatedAmount)} />}
                  {selectedCase.reference && <InfoItem label="Referencia" value={selectedCase.reference} />}
                  <InfoItem label="Entidad legal" value={selectedCase.entidadLegal} />
                  <InfoItem label="Tipo cobro" value={selectedCase.tipoCobro} />
                </div>

                {/* Description */}
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Descripción</p>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{selectedCase.description}</p>
                </div>

                {/* Next action */}
                {selectedCase.nextAction && (
                  <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-0.5">Próxima acción</p>
                    <p className="text-[13px] font-medium text-foreground">{selectedCase.nextAction}</p>
                  </div>
                )}

                {/* Impact flags */}
                {(selectedCase.adjustBandejaPriority || selectedCase.forceVisibility || selectedCase.requiresSpecialFollowUp) && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Impacto operativo</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedCase.adjustBandejaPriority && <span className="sozu-chip bg-warning-bg text-warning">↑ Prioridad Bandeja</span>}
                      {selectedCase.forceVisibility && <span className="sozu-chip bg-info-bg text-info">Visibilidad forzada</span>}
                      {selectedCase.requiresSpecialFollowUp && <span className="sozu-chip bg-priority-purple/10 text-priority-purple">Seguimiento especial</span>}
                    </div>
                  </div>
                )}

                {/* Quick link to account */}
                <button onClick={() => navigate(`/cuenta/${selectedCase.accountId}`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted transition-colors text-[13px]">
                  <span className="font-medium text-foreground">Abrir expediente completo</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                </button>
              </>
            )}

            {detailTab === 'historial' && (
              <div className="space-y-3">
                {[...selectedCase.history].reverse().map(h => (
                  <div key={h.id} className="border-l-2 border-border pl-3 py-1">
                    <p className="text-[12px] font-semibold text-foreground">{h.action}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{h.detail}</p>
                    {h.previousValue && h.newValue && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        <span className="line-through">{h.previousValue}</span> → <span className="font-medium text-foreground">{h.newValue}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">{h.user} · {new Date(h.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))}
              </div>
            )}

            {detailTab === 'acciones' && selectedCase.status !== 'archivada' && (
              <div className="space-y-4">
                {/* Status change */}
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Cambiar estatus</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {selectedCase.status !== 'en_revision' && (
                      <ActionBtn icon={RotateCcw} label="En revisión" onClick={() => handleStatusChange(selectedCase.id, 'en_revision')} />
                    )}
                    {selectedCase.status !== 'esperando_cliente' && (
                      <ActionBtn icon={Clock} label="Esperando cliente" onClick={() => handleStatusChange(selectedCase.id, 'esperando_cliente')} />
                    )}
                    {selectedCase.status !== 'escalada' && (
                      <ActionBtn icon={ArrowUpRight} label="Escalar" onClick={() => handleStatusChange(selectedCase.id, 'escalada')} variant="warning" />
                    )}
                    {selectedCase.status !== 'resuelta' && (
                      <ActionBtn icon={CheckCircle2} label="Resolver" onClick={() => handleStatusChange(selectedCase.id, 'resuelta')} variant="success" />
                    )}
                  </div>
                </div>

                {/* Priority change */}
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Cambiar prioridad</p>
                  <select value={selectedCase.priority} onChange={e => handlePriorityChange(selectedCase.id, e.target.value as ConciliacionPriority)}
                    className="w-full h-[34px] rounded-md border border-input bg-background px-3 text-[13px]">
                    {Object.entries(priorityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                {/* Reassign */}
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Reasignar</p>
                  <select value={selectedCase.assignee} onChange={e => handleAssigneeChange(selectedCase.id, e.target.value)}
                    className="w-full h-[34px] rounded-md border border-input bg-background px-3 text-[13px]">
                    {executives.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                  </select>
                </div>

                {/* Archive */}
                <div className="pt-2 border-t border-border">
                  <ActionBtn icon={Archive} label="Archivar caso" onClick={() => openArchiveModal(selectedCase.id)} variant="danger" />
                </div>
              </div>
            )}

            {detailTab === 'acciones' && selectedCase.status === 'archivada' && (
              <div className="text-center py-8">
                <Archive className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">Caso archivado</p>
                {selectedCase.archiveReason && (
                  <p className="text-[12px] text-muted-foreground/70 mt-1">Motivo: {selectedCase.archiveReason}</p>
                )}
                <Button variant="outline" size="sm" className="mt-3" onClick={() => handleStatusChange(selectedCase.id, 'abierta')}>
                  Reabrir caso
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <NewConciliacionModal open={newCaseOpen} onOpenChange={setNewCaseOpen} onCaseCreated={handleNewCase} />
      <ArchiveConciliacionModal open={archiveOpen} onOpenChange={setArchiveOpen} caseId={archiveCaseId} onArchive={handleArchive} />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────
function CaseCard({ caso, selected, onClick, isFuera }: { caso: ConciliacionCase; selected: boolean; onClick: () => void; isFuera: boolean }) {
  const statusCol = conciliacionStatusColors[caso.status];
  const prioCol = priorityColors[caso.priority];
  return (
    <div onClick={onClick}
      className={cn('sozu-kpi-card !p-4 cursor-pointer transition-all', selected && 'ring-1 ring-primary')}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', prioCol.bg)}>
            <AlertTriangle className={cn('w-4 h-4', prioCol.text)} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-muted-foreground font-mono">{caso.id}</p>
              {isFuera && <span className="text-[10px] font-semibold text-danger bg-danger-bg px-1.5 py-0.5 rounded">FUERA SLA</span>}
            </div>
            <p className="text-[13px] font-semibold text-foreground leading-tight mt-0.5">{caso.title}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{caso.clientName} · {caso.projectName} · {caso.accountNumber}</p>
          </div>
        </div>
        <span className={cn('sozu-chip shrink-0', statusCol.bg, statusCol.text)}>
          {conciliacionStatusLabels[caso.status]}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-11 flex-wrap">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={1.75} /> {formatDate(caso.openDate)}</span>
        <span>SLA: {caso.sla}</span>
        <span className="flex items-center gap-1"><User className="w-3 h-3" strokeWidth={1.75} /> {caso.assignee}</span>
        <span className={cn('sozu-chip !py-0 !px-1.5', prioCol.bg, prioCol.text)}>{priorityLabels[caso.priority]}</span>
        {caso.relatedAmount && <span className="font-medium text-foreground">{formatCurrency(caso.relatedAmount)}</span>}
        {caso.nextAction && <span className="text-primary truncate max-w-[180px]">→ {caso.nextAction}</span>}
      </div>
    </div>
  );
}

function KPIPill({ label, value, dotColor, onClick, active, alert: isAlert }: { label: string; value: number; dotColor: string; onClick?: () => void; active?: boolean; alert?: boolean }) {
  return (
    <button onClick={onClick} type="button"
      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] transition-colors',
        active ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border hover:bg-muted',
        isAlert && value > 0 && !active && 'border-danger/30')}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', isAlert && value > 0 ? 'text-danger' : 'text-foreground')}>{value}</span>
    </button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[13px] font-medium text-foreground">{value}</p>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, variant }: { icon: any; label: string; onClick: () => void; variant?: 'success' | 'warning' | 'danger' }) {
  const colors = variant === 'success' ? 'bg-success-bg hover:bg-success/10 text-success'
    : variant === 'warning' ? 'bg-warning-bg hover:bg-warning/10 text-warning'
    : variant === 'danger' ? 'bg-danger-bg hover:bg-danger/10 text-danger'
    : 'bg-muted hover:bg-border text-foreground';
  return (
    <button onClick={onClick} className={cn('flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium transition-colors', colors)}>
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} /> {label}
    </button>
  );
}
