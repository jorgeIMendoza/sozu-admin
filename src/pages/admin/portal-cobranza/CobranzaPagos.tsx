import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mockPaymentRecords, reconciliationStatusLabels, type ReconciliationStatus } from '@/data/mockDataExtended';
import { mockAccounts, mockLegalEntities } from '@/data/mockData';
import { formatCurrency, formatDate } from '@/components/cobranza/StatusBadges';
import { ActiveFilterBanner } from '@/components/cobranza/ActiveFilterBanner';
import { Search, X, CheckCircle2, Clock, AlertTriangle, FileText, Link2, Eye, MessageSquare, DollarSign, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { chargeTypeLabels, chargeTypeColors, type ChargeType } from '@/types/cobranza';

const reconStatusConfig: Record<ReconciliationStatus, { bg: string; text: string }> = {
  conciliado: { bg: 'bg-success-bg', text: 'text-success' },
  cien_conciliado: { bg: 'bg-success-bg', text: 'text-success' },
  pendiente_cep: { bg: 'bg-warning-bg', text: 'text-warning' },
  pendiente_comprobante: { bg: 'bg-warning-bg', text: 'text-warning' },
  en_revision: { bg: 'bg-info-bg', text: 'text-info' },
  excepcion: { bg: 'bg-danger-bg', text: 'text-danger' },
  no_identificado: { bg: 'bg-danger-bg', text: 'text-danger' },
  pago_directo: { bg: 'bg-priority-purple/10', text: 'text-priority-purple' },
};

type QuickFilter = 'all' | 'conciliado' | 'cien_conciliado' | 'pendiente_cep' | 'en_revision' | 'excepcion' | 'no_identificado' | 'pago_directo';

export default function RelacionPagosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(() => (searchParams.get('estatus') as QuickFilter) || 'all');
  const [projectFilter, setProjectFilter] = useState(() => searchParams.get('proyecto') || 'all');
  const [originFilter, setOriginFilter] = useState(() => searchParams.get('origen') || 'all');
  const [legalEntityFilter, setLegalEntityFilter] = useState(() => searchParams.get('entidadLegal') || 'all');
  const [chargeTypeFilter, setChargeTypeFilter] = useState(() => searchParams.get('tipoCobro') || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  const clearAllFilters = useCallback(() => {
    setQuickFilter('all'); setProjectFilter('all'); setOriginFilter('all'); setLegalEntityFilter('all'); setChargeTypeFilter('all'); setSearchQuery('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const filtered = useMemo(() => {
    let records = [...mockPaymentRecords];
    if (quickFilter !== 'all') records = records.filter(r => r.reconciliationStatus === quickFilter);
    if (projectFilter !== 'all') records = records.filter(r => r.projectName === projectFilter);
    if (originFilter !== 'all') records = records.filter(r => r.origin === originFilter);
    if (legalEntityFilter !== 'all') {
      records = records.filter(r => {
        const acc = mockAccounts.find(a => a.id === r.accountId);
        return acc?.legalEntity.name === legalEntityFilter;
      });
    }
    if (chargeTypeFilter !== 'all') {
      records = records.filter(r => {
        const acc = mockAccounts.find(a => a.id === r.accountId);
        return acc?.chargeType === chargeTypeFilter;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase().replace(/[-\s]/g, '');
      records = records.filter(r => {
        const acc = mockAccounts.find(a => a.id === r.accountId);
        return r.clientName.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q) ||
          r.accountId.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
          (acc?.accountId.toLowerCase().replace(/[-\s]/g, '').includes(q)) ||
          (acc?.clabe.includes(q));
      });
    }
    return records;
  }, [quickFilter, projectFilter, originFilter, legalEntityFilter, chargeTypeFilter, searchQuery]);

  const stats = {
    total: mockPaymentRecords.length,
    totalAmount: mockPaymentRecords.reduce((s, r) => s + r.amount, 0),
    conciliados: mockPaymentRecords.filter(r => r.reconciliationStatus === 'conciliado' || r.reconciliationStatus === 'cien_conciliado').length,
    conciliadoAmount: mockPaymentRecords.filter(r => r.reconciliationStatus === 'conciliado' || r.reconciliationStatus === 'cien_conciliado').reduce((s, r) => s + r.amount, 0),
    sinCEP: mockPaymentRecords.filter(r => !r.hasCEP && r.reconciliationStatus !== 'pago_directo').length,
    excepciones: mockPaymentRecords.filter(r => r.reconciliationStatus === 'excepcion' || r.reconciliationStatus === 'no_identificado').length,
    excepcionAmount: mockPaymentRecords.filter(r => r.reconciliationStatus === 'excepcion' || r.reconciliationStatus === 'no_identificado').reduce((s, r) => s + r.amount, 0),
    pagosDirectos: mockPaymentRecords.filter(r => r.reconciliationStatus === 'pago_directo').length,
    cienConciliado: mockPaymentRecords.filter(r => r.reconciliationStatus === 'cien_conciliado').length,
  };


  const hasFilters = quickFilter !== 'all' || projectFilter !== 'all' || originFilter !== 'all' || legalEntityFilter !== 'all' || chargeTypeFilter !== 'all' || searchQuery;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _clearAll = clearAllFilters;

  return (
    <div className="space-y-5 animate-fade-in -m-5">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="sozu-page-title">Relación de Pagos</h1>
            <div className="flex items-center gap-3 mt-0.5 text-[13px]">
              <span className="text-muted-foreground">{stats.total} pagos · {formatCurrency(stats.totalAmount)}</span>
              <span className="text-success font-medium">{stats.conciliados} conciliados · {formatCurrency(stats.conciliadoAmount)}</span>
              <span className="text-warning font-medium">{stats.sinCEP} sin CEP</span>
              <span className="text-danger font-medium">{stats.excepciones} excepciones</span>
              <span className="text-priority-purple font-medium">{stats.pagosDirectos} pagos directos</span>
            </div>
          </div>
        </div>
        <ActiveFilterBanner onClear={clearAllFilters} />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
            <input type="text" placeholder="ID Cuenta, CLABE, nombre, referencia..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-[38px] pl-9 pr-3 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-150" />
          </div>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="sozu-filter-select">
            <option value="all">Proyecto</option>
            <option>Daiku</option><option>Bottura</option><option>Margot</option>
          </select>
          <select value={originFilter} onChange={e => setOriginFilter(e.target.value)} className="sozu-filter-select">
            <option value="all">Origen</option>
            <option value="STP">STP</option>
            <option value="transferencia_directa">Transferencia directa</option>
            <option value="deposito_efectivo">Depósito efectivo</option>
          </select>
          <select value={legalEntityFilter} onChange={e => setLegalEntityFilter(e.target.value)} className="sozu-filter-select">
            <option value="all">Entidad Legal</option>
            {mockLegalEntities.map(le => <option key={le.id} value={le.name}>{le.name}</option>)}
          </select>
          <select value={chargeTypeFilter} onChange={e => setChargeTypeFilter(e.target.value)} className="sozu-filter-select">
            <option value="all">Tipo de cobro</option>
            <option value="propiedad">Propiedad</option><option value="bodega">Bodega</option><option value="paquete_muebles">Paq. muebles</option><option value="condensadora">Condensadora</option><option value="estacionamiento">Estacionamiento</option><option value="servicios">Servicios</option>
          </select>
          {hasFilters && (
            <button onClick={clearAllFilters}
              className="h-[38px] px-3 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg flex items-center gap-1.5 transition-colors duration-100">
              <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="px-5 grid grid-cols-5 gap-3">
        <div className="sozu-kpi-card !p-4">
          <div className="flex items-center gap-1.5 mb-1"><DollarSign className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} /><span className="text-[11px] text-muted-foreground">Cobrado Periodo</span></div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(stats.totalAmount)}</p>
        </div>
        <div className="sozu-kpi-card !p-4">
          <div className="flex items-center gap-1.5 mb-1"><CheckCircle2 className="w-3.5 h-3.5 text-success" strokeWidth={1.75} /><span className="text-[11px] text-muted-foreground">Conciliado</span></div>
          <p className="text-lg font-semibold text-success tabular-nums">{formatCurrency(stats.conciliadoAmount)}</p>
        </div>
        <div className="sozu-kpi-card !p-4">
          <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-warning" strokeWidth={1.75} /><span className="text-[11px] text-muted-foreground">Sin CEP</span></div>
          <p className="text-lg font-semibold text-warning tabular-nums">{stats.sinCEP} pagos</p>
        </div>
        <div className="sozu-kpi-card !p-4">
          <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5 text-danger" strokeWidth={1.75} /><span className="text-[11px] text-muted-foreground">Excepciones</span></div>
          <p className="text-lg font-semibold text-danger tabular-nums">{formatCurrency(stats.excepcionAmount)}</p>
        </div>
        <div className="sozu-kpi-card !p-4">
          <div className="flex items-center gap-1.5 mb-1"><Shield className="w-3.5 h-3.5 text-priority-purple" strokeWidth={1.75} /><span className="text-[11px] text-muted-foreground">Pagos Directos</span></div>
          <p className="text-lg font-semibold text-priority-purple tabular-nums">{stats.pagosDirectos} pagos</p>
        </div>
      </div>

      <div className="px-5">
        <div className="sozu-kpi-card !p-0 overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sozu-thead">
                <tr>
                  <th>Fecha</th>
                  <th>ID / Cliente</th>
                  <th>Proyecto / Concepto</th>
                  <th>Entidad Legal</th>
                  <th className="text-center">Tipo de cobro</th>
                  <th className="text-right">Monto</th>
                  <th>Referencia</th>
                  <th>Origen / Vía</th>
                  <th className="text-center">CEP</th>
                  <th className="text-center">Estatus</th>
                  <th className="text-center w-[120px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const sc = reconStatusConfig[r.reconciliationStatus];
                  const acc = mockAccounts.find(a => a.id === r.accountId);
                  return (
                    <tr key={r.id} className="sozu-table-row h-[52px]">
                      <td className="px-4 text-[13px] text-muted-foreground tabular-nums">{formatDate(r.date)}</td>
                      <td className="px-4">
                        <p className="text-[13px] font-medium text-foreground">{r.clientName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{acc?.accountId || r.accountId}</p>
                      </td>
                      <td className="px-4">
                        <p className="text-[13px] text-foreground">{r.projectName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {acc?.chargeType === 'propiedad' ? r.unitNumber : ''}
                        </p>
                      </td>
                      <td className="px-4 text-[12px] text-muted-foreground">{acc?.legalEntity.name || '—'}</td>
                      <td className="px-4 text-center">
                        {acc && (() => {
                          const c = chargeTypeColors[acc.chargeType];
                          return <span className={cn('sozu-chip text-[9px]', c.bg, c.text)}>{chargeTypeLabels[acc.chargeType]}</span>;
                        })()}
                      </td>
                      <td className="px-4 text-right text-[13px] font-semibold text-foreground tabular-nums">{formatCurrency(r.amount)}</td>
                      <td className="px-4 font-mono text-[11px] text-muted-foreground">{r.reference || '—'}</td>
                      <td className="px-4">
                        <p className="text-[13px] text-foreground">{r.origin.replace(/_/g, ' ')}</p>
                        <p className="text-[11px] text-muted-foreground">{r.via}</p>
                      </td>
                      <td className="px-4 text-center">
                        {r.hasCEP
                          ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" strokeWidth={1.75} />
                          : <Clock className="w-4 h-4 text-warning mx-auto" strokeWidth={1.75} />}
                      </td>
                      <td className="px-4 text-center">
                        <span className={cn('sozu-chip', sc.bg, sc.text)}>{reconciliationStatusLabels[r.reconciliationStatus]}</span>
                      </td>
                      <td className="px-4">
                        <div className="flex items-center justify-center gap-0.5">
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors duration-100" title="Vincular a cuenta">
                            <Link2 className="w-[14px] h-[14px] text-muted-foreground" strokeWidth={1.75} />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors duration-100" title="Adjuntar CEP">
                            <FileText className="w-[14px] h-[14px] text-muted-foreground" strokeWidth={1.75} />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors duration-100" title="Ver expediente"
                            onClick={() => navigate(`/cuenta/${r.accountId}`)}>
                            <Eye className="w-[14px] h-[14px] text-muted-foreground" strokeWidth={1.75} />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors duration-100" title="Comentario">
                            <MessageSquare className="w-[14px] h-[14px] text-muted-foreground" strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
