import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mockCEPRecords, cepStatusLabels, type CEPStatus } from '@/data/mockDataExtended';
import { formatCurrency, formatDate } from '@/components/cobranza/StatusBadges';
import { ActiveFilterBanner } from '@/components/cobranza/ActiveFilterBanner';
import { Search, X, FileCheck, Upload, Eye, UserCheck, Clock, AlertTriangle, CheckCircle2, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const cepStatusConfig: Record<CEPStatus, { bg: string; text: string }> = {
  pendiente_busqueda: { bg: 'bg-warning-bg', text: 'text-warning' },
  en_investigacion: { bg: 'bg-info-bg', text: 'text-info' },
  validado: { bg: 'bg-success-bg', text: 'text-success' },
  no_aplica: { bg: 'bg-muted', text: 'text-muted-foreground' },
  requiere_evidencia: { bg: 'bg-warning-bg', text: 'text-warning' },
};

export default function CEPsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<CEPStatus | 'all'>(() => (searchParams.get('estatus') as CEPStatus) || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCEP, setSelectedCEP] = useState<typeof mockCEPRecords[0] | null>(null);

  const clearAllFilters = useCallback(() => {
    setStatusFilter('all');
    setSearchQuery('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const filtered = useMemo(() => {
    let records = [...mockCEPRecords];
    if (statusFilter !== 'all') records = records.filter(r => r.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      records = records.filter(r => r.clientName.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q));
    }
    return records;
  }, [statusFilter, searchQuery]);

  const stats = {
    pendientes: mockCEPRecords.filter(r => r.status === 'pendiente_busqueda').length,
    investigacion: mockCEPRecords.filter(r => r.status === 'en_investigacion').length,
    validados: mockCEPRecords.filter(r => r.status === 'validado').length,
    requiereEvidencia: mockCEPRecords.filter(r => r.status === 'requiere_evidencia').length,
  };

  const hasFilters = statusFilter !== 'all' || searchQuery;

  return (
    <div className="flex h-full -m-5">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-3 space-y-3">
          <div>
            <h1 className="sozu-page-title">CEPs Pendientes</h1>
            <div className="flex items-center gap-3 mt-0.5 text-[13px]">
              <span className="text-muted-foreground">{mockCEPRecords.length} registros</span>
              <span className="text-warning font-medium">{stats.pendientes} pendientes</span>
              <span className="text-info font-medium">{stats.investigacion} en investigación</span>
              <span className="text-success">{stats.validados} validados</span>
              <span className="text-warning">{stats.requiereEvidencia} requiere evidencia</span>
            </div>
          </div>
          <ActiveFilterBanner onClear={clearAllFilters} />
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              <input type="text" placeholder="Buscar cliente o referencia..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-[38px] pl-9 pr-3 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-150" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="sozu-filter-select">
              <option value="all">Estatus</option>
              {Object.entries(cepStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {hasFilters && (
              <button onClick={clearAllFilters}
                className="h-[38px] px-3 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg flex items-center gap-1.5 transition-colors duration-100">
                <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <FileCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground mb-1">No se encontraron CEPs con estos filtros</p>
              <button onClick={clearAllFilters} className="text-[13px] text-primary hover:underline">Limpiar filtros</button>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="sozu-thead">
              <tr>
                <th>Fecha Pago</th>
                <th>Cliente</th>
                <th>Proyecto</th>
                <th className="text-right">Monto</th>
                <th>Referencia</th>
                <th className="text-center">Banxico</th>
                <th>Asignado</th>
                <th className="text-center">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const sc = cepStatusConfig[r.status];
                return (
                  <tr key={r.id} className={cn('sozu-table-row h-[52px]', selectedCEP?.id === r.id && 'bg-primary-muted')} onClick={() => setSelectedCEP(r)}>
                    <td className="px-4 text-[13px] text-muted-foreground tabular-nums">{formatDate(r.paymentDate)}</td>
                    <td className="px-4">
                      <p className="text-[13px] font-medium text-foreground">{r.clientName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{r.accountId}</p>
                    </td>
                    <td className="px-4 text-[13px] text-foreground">{r.projectName}</td>
                    <td className="px-4 text-right text-[13px] font-semibold text-foreground tabular-nums">{formatCurrency(r.amount)}</td>
                    <td className="px-4 font-mono text-[11px] text-muted-foreground">{r.reference || '—'}</td>
                    <td className="px-4 text-center">
                      {r.requiresBanxico
                        ? <AlertTriangle className="w-4 h-4 text-warning mx-auto" strokeWidth={1.75} />
                        : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 text-[13px] text-muted-foreground">{r.assignee}</td>
                    <td className="px-4 text-center"><span className={cn('sozu-chip', sc.bg, sc.text)}>{cepStatusLabels[r.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedCEP && (
        <div className="w-[380px] shrink-0 bg-card border-l border-border flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-[14px] font-semibold text-foreground">Detalle CEP</h3>
            <button onClick={() => setSelectedCEP(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors"><X className="w-4 h-4" strokeWidth={1.75} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <span className={cn('sozu-chip', cepStatusConfig[selectedCEP.status].bg, cepStatusConfig[selectedCEP.status].text)}>
              {cepStatusLabels[selectedCEP.status]}
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <InfoItem label="Cliente" value={selectedCEP.clientName} />
              <InfoItem label="Proyecto" value={selectedCEP.projectName} />
              <InfoItem label="Cuenta" value={selectedCEP.accountId} />
              <InfoItem label="Monto" value={formatCurrency(selectedCEP.amount)} />
              <InfoItem label="Referencia" value={selectedCEP.reference || '—'} />
              <InfoItem label="Fecha Pago" value={formatDate(selectedCEP.paymentDate)} />
              <InfoItem label="Asignado" value={selectedCEP.assignee} />
              <InfoItem label="Actualizado" value={formatDate(selectedCEP.lastUpdated)} />
            </div>
            {selectedCEP.requiresBanxico && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-bg text-warning text-[12px] font-medium">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
                Requiere búsqueda en Banxico
              </div>
            )}
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Observaciones</p>
              <p className="text-[13px] text-muted-foreground">{selectedCEP.observations}</p>
            </div>
            <div className="pt-1 space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Acciones</p>
              <div className="grid grid-cols-2 gap-1.5">
                <ActionBtn icon={Upload} label="Adjuntar CEP" />
                <ActionBtn icon={FileCheck} label="Marcar validado" variant="success" />
                <ActionBtn icon={UserCheck} label="Reasignar" />
                <ActionBtn icon={Eye} label="Ver expediente" onClick={() => navigate(`/cuenta/${selectedCEP.accountId}`)} />
                <ActionBtn icon={FileX} label="No localizado" variant="destructive" />
                <ActionBtn icon={Clock} label="En investigación" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-[13px] font-medium text-foreground">{value}</p></div>;
}

function ActionBtn({ icon: Icon, label, variant, onClick }: { icon: React.ElementType; label: string; variant?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium transition-colors duration-100',
      variant === 'destructive' ? 'bg-danger-bg text-danger hover:bg-danger/10' :
      variant === 'success' ? 'bg-success-bg text-success hover:bg-success/10' :
      'bg-muted hover:bg-border text-foreground')}>
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />{label}
    </button>
  );
}
