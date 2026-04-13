import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mockAccounts, mockLegalEntities, executives } from '@/data/cobranza/mockData';
import { getBitacoraEntries, type BitacoraEntry } from '@/data/cobranza/bitacoraData';
import { BitacoraEntryModal } from '@/components/cobranza/BitacoraEntryModal';
import { PriorityBadge, formatCurrency, formatDate } from '@/components/cobranza/StatusBadges';
import { ActiveFilterBanner } from '@/components/cobranza/ActiveFilterBanner';
import type { Account, PriorityLevel, ChargeType } from '@/types/cobranza';
import { chargeTypeLabels, chargeTypeColors } from '@/types/cobranza';
import { getAccountActions, type AccountActionId } from '@/lib/accountActions';
import {
  Eye, Search, X, ChevronRight,
  AlertTriangle, Clock, Plus, MoreHorizontal, CheckCircle2,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EditAccountModal } from '@/components/cobranza/EditAccountModal';
import { AddManualPaymentModal } from '@/components/cobranza/AddManualPaymentModal';
import { CancelAccountModal } from '@/components/cobranza/CancelAccountModal';
import { NewAccountModal } from '@/components/cobranza/NewAccountModal';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const priorityOrder: Record<PriorityLevel, number> = {
  purple: 0, red: 1, yellow: 2, blue: 3, gray: 4, green: 5,
};

type FilterPreset = 'all' | 'critical' | 'sinCEP' | 'pendConciliacion' | 'docIncompleta' | 'promesaActiva' | 'promesaVencida' | 'prelegal' | '100conciliado' | 'pagoDirecto' | 'pldAlerta' | 'legal';

export default function BandejaOperativaPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projectFilter, setProjectFilter] = useState(() => searchParams.get('proyecto') || 'all');
  const [executiveFilter, setExecutiveFilter] = useState(() => searchParams.get('ejecutivo') || 'all');
  const [legalEntityFilter, setLegalEntityFilter] = useState(() => searchParams.get('entidadLegal') || 'all');
  const [chargeTypeFilter, setChargeTypeFilter] = useState<ChargeType | 'all'>(() => (searchParams.get('tipoCobro') as ChargeType) || 'all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'all'>(() => (searchParams.get('prioridad') as PriorityLevel) || 'all');
  const [paymentDayFilter, setPaymentDayFilter] = useState(() => searchParams.get('diaPago') || 'all');
  const [presetFilter, setPresetFilter] = useState<FilterPreset>(() => (searchParams.get('preset') as FilterPreset) || 'all');
  const [parcVencidasFilter, setParcVencidasFilter] = useState(() => searchParams.get('parcVencidas') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<Account | null>(null);
  const [cancelAccount, setCancelAccount] = useState<Account | null>(null);
  const [showNewAccount, setShowNewAccount] = useState(false);

  const clearAllFilters = useCallback(() => {
    setProjectFilter('all');
    setExecutiveFilter('all');
    setLegalEntityFilter('all');
    setChargeTypeFilter('all');
    setPriorityFilter('all');
    setPaymentDayFilter('all');
    setPresetFilter('all');
    setParcVencidasFilter('all');
    setSearchQuery('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const sortedAccounts = useMemo(() => {
    let accounts = [...mockAccounts];
    if (projectFilter !== 'all') accounts = accounts.filter(a => a.project.name === projectFilter);
    if (executiveFilter !== 'all') accounts = accounts.filter(a => a.assignedExecutive === executiveFilter);
    if (legalEntityFilter !== 'all') accounts = accounts.filter(a => a.legalEntity.name === legalEntityFilter);
    if (chargeTypeFilter !== 'all') accounts = accounts.filter(a => a.chargeType === chargeTypeFilter);
    if (priorityFilter !== 'all') accounts = accounts.filter(a => a.priority === priorityFilter);
    if (paymentDayFilter !== 'all') accounts = accounts.filter(a => a.paymentDay === Number(paymentDayFilter));

    if (parcVencidasFilter === '1') accounts = accounts.filter(a => a.overdueInstallments === 1);
    else if (parcVencidasFilter === '2') accounts = accounts.filter(a => a.overdueInstallments === 2);
    else if (parcVencidasFilter === '3plus') accounts = accounts.filter(a => a.overdueInstallments >= 3);

    if (presetFilter === 'critical') accounts = accounts.filter(a => a.priority === 'purple' || a.priority === 'red');
    if (presetFilter === 'sinCEP') accounts = accounts.filter(a => a.conciliationPending);
    if (presetFilter === 'pendConciliacion') accounts = accounts.filter(a => a.conciliationPending);
    if (presetFilter === 'docIncompleta') accounts = accounts.filter(a => !a.documentationComplete);
    if (presetFilter === 'promesaActiva') accounts = accounts.filter(a => a.activePromise?.status === 'activa');
    if (presetFilter === 'prelegal') accounts = accounts.filter(a => a.overdueInstallments >= 3);
    if (presetFilter === '100conciliado') accounts = accounts.filter(a => a.fullyReconciled);
    if (presetFilter === 'pldAlerta') accounts = accounts.filter(a => a.pldStatus !== 'validado' && a.pldStatus !== 'liberado_pld');
    if (presetFilter === 'legal') accounts = accounts.filter(a => a.legalStatus !== 'sin_accion');

    if (searchQuery) {
      const q = searchQuery.toLowerCase().replace(/[-\s]/g, '');
      accounts = accounts.filter(a =>
        a.client.name.toLowerCase().includes(q) ||
        a.accountNumber.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
        a.accountId.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
        a.clabe.includes(q)
      );
    }
    return accounts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [projectFilter, executiveFilter, legalEntityFilter, chargeTypeFilter, priorityFilter, paymentDayFilter, presetFilter, parcVencidasFilter, searchQuery]);

  const counts = useMemo(() => ({
    total: sortedAccounts.length,
    critical: sortedAccounts.filter(a => a.priority === 'purple' || a.priority === 'red').length,
    pending: sortedAccounts.filter(a => a.priority === 'yellow').length,
    ok: sortedAccounts.filter(a => a.priority === 'green').length,
  }), [sortedAccounts]);

  const hasFilters = projectFilter !== 'all' || executiveFilter !== 'all' || legalEntityFilter !== 'all' || chargeTypeFilter !== 'all' || priorityFilter !== 'all' || paymentDayFilter !== 'all' || presetFilter !== 'all' || parcVencidasFilter !== 'all' || searchQuery;

  return (
    <div className="flex h-full -m-5">
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-200">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="sozu-page-title">Bandeja Operativa</h1>
              <div className="flex items-center gap-3 mt-0.5 text-[13px]">
                <span className="text-muted-foreground">{counts.total} cuentas</span>
                <span className="text-danger font-medium">{counts.critical} críticas</span>
                <span className="text-warning font-medium">{counts.pending} seguimiento</span>
                <span className="text-success">{counts.ok} al corriente</span>
              </div>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowNewAccount(true)}>
              <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Nueva Cuenta de Cobranza
            </Button>
          </div>
          <ActiveFilterBanner onClear={clearAllFilters} />
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              <input type="text" placeholder="ID Cuenta, CLABE, nombre..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-[38px] pl-9 pr-3 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-150" />
            </div>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="sozu-filter-select">
              <option value="all">Proyecto</option>
              <option value="Daiku">Daiku</option><option value="Bottura">Bottura</option><option value="Margot">Margot</option>
            </select>
            <select value={executiveFilter} onChange={e => setExecutiveFilter(e.target.value)} className="sozu-filter-select">
              <option value="all">Ejecutivo</option>
              {executives.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
            <select value={legalEntityFilter} onChange={e => setLegalEntityFilter(e.target.value)} className="sozu-filter-select">
              <option value="all">Entidad Legal</option>
              {mockLegalEntities.map(le => <option key={le.id} value={le.name}>{le.name}</option>)}
            </select>
            <select value={chargeTypeFilter} onChange={e => setChargeTypeFilter(e.target.value as ChargeType | 'all')} className="sozu-filter-select">
              <option value="all">Tipo de cobro</option>
              <option value="propiedad">Propiedad</option><option value="bodega">Bodega</option><option value="paquete_muebles">Paq. muebles</option><option value="condensadora">Condensadora</option><option value="estacionamiento">Estacionamiento</option><option value="servicios">Servicios</option>
            </select>
            <select value={paymentDayFilter} onChange={e => setPaymentDayFilter(e.target.value)} className="sozu-filter-select">
              <option value="all">Día pago</option>
              <option value="5">Día 5</option><option value="15">Día 15</option><option value="28">Día 28</option>
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as PriorityLevel | 'all')} className="sozu-filter-select">
              <option value="all">Prioridad</option>
              <option value="purple">3+ / Prelegal</option><option value="red">2 vencidas</option><option value="yellow">1 vencida</option>
              <option value="blue">Conciliación</option><option value="gray">Doc. incompleta</option><option value="green">Al corriente</option>
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
          {sortedAccounts.length === 0 ? (
            <div className="text-center py-16">
              <AlertTriangle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground mb-1">No se encontraron cuentas con estos filtros</p>
              <button onClick={clearAllFilters} className="text-[13px] text-primary hover:underline">Limpiar filtros</button>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="sozu-thead">
              <tr>
                <th className="w-[100px]">Prioridad</th>
                <th>Cliente / Cuenta</th>
                <th>Proyecto / Concepto</th>
                <th>Entidad Legal</th>
                <th className="text-center w-[70px]">Tipo</th>
                <th className="text-center w-[50px]">Día</th>
                <th className="text-right">Vencido</th>
                <th className="text-right">Por Cobrar</th>
                <th className="text-center w-[45px]">Parc.</th>
                <th>Próx. Venc.</th>
                <th>Ejecutivo</th>
                <th className="text-center w-[40px]">Doc</th>
                <th className="text-center w-[40px]">PLD</th>
                <th className="text-center w-[40px]">Conc</th>
                <th className="text-center w-[50px]">Legal</th>
                <th>Acción Sugerida</th>
                <th className="text-center w-[100px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedAccounts.map((account) => (
                <tr key={account.id}
                  className={cn('sozu-table-row h-[52px]', selectedAccount?.id === account.id && 'bg-primary-muted')}
                  onClick={() => setSelectedAccount(account)}>
                  <td className="px-3"><PriorityBadge priority={account.priority} /></td>
                  <td className="px-3">
                    <p className="text-[13px] font-semibold text-foreground leading-snug">{account.client.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-1 tracking-wide">{account.accountId}</p>
                  </td>
                  <td className="px-3">
                    <p className="text-[13px] text-foreground">{account.project.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {account.chargeType === 'propiedad' ? `${account.building} · ${account.unitNumber}` : chargeTypeLabels[account.chargeType]}
                    </p>
                  </td>
                  <td className="px-3 text-[12px] text-muted-foreground">{account.legalEntity.name}</td>
                  <td className="px-3 text-center">
                    {(() => {
                      const c = chargeTypeColors[account.chargeType];
                      return <span className={cn('sozu-chip text-[9px]', c.bg, c.text)}>{chargeTypeLabels[account.chargeType]}</span>;
                    })()}
                  </td>
                  <td className="px-3 text-center text-[12px] text-muted-foreground tabular-nums">{account.paymentDay}</td>
                  <td className="px-3 text-right">
                    {account.overdueAmount > 0
                      ? <span className="text-[13px] font-semibold text-danger tabular-nums">{formatCurrency(account.overdueAmount)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 text-right text-[13px] text-foreground tabular-nums">{formatCurrency(account.balance)}</td>
                  <td className="px-3 text-center">
                    {account.overdueInstallments > 0
                      ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-danger-bg text-danger text-xs font-semibold">{account.overdueInstallments}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 text-[13px] text-muted-foreground tabular-nums">{formatDate(account.nextDueDate)}</td>
                  <td className="px-3 text-[12px] text-muted-foreground">{account.assignedExecutive.split(' ')[0]}</td>
                  <td className="px-3 text-center">
                    {account.documentationComplete
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-success mx-auto" strokeWidth={1.75} />
                      : <AlertTriangle className="w-3.5 h-3.5 text-warning mx-auto" strokeWidth={1.75} />}
                  </td>
                  <td className="px-3 text-center">
                    {account.pldStatus === 'validado' || account.pldStatus === 'liberado_pld'
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-success mx-auto" strokeWidth={1.75} />
                      : account.pldStatus === 'bloqueado_pld'
                        ? <AlertTriangle className="w-3.5 h-3.5 text-danger mx-auto" strokeWidth={1.75} />
                        : <Clock className="w-3.5 h-3.5 text-warning mx-auto" strokeWidth={1.75} />}
                  </td>
                  <td className="px-3 text-center">
                    {account.fullyReconciled
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-success mx-auto" strokeWidth={1.75} />
                      : account.conciliationPending
                        ? <Clock className="w-3.5 h-3.5 text-warning mx-auto" strokeWidth={1.75} />
                        : <span className="text-muted-foreground text-[11px]">—</span>}
                  </td>
                  <td className="px-3 text-center">
                    {account.legalStatus !== 'sin_accion'
                      ? <span className="sozu-chip bg-priority-purple/10 text-priority-purple text-[9px]">Legal</span>
                      : <span className="text-muted-foreground text-[11px]">—</span>}
                  </td>
                  <td className="px-3"><span className="text-[12px] text-primary font-medium">{account.suggestedAction}</span></td>
                  <td className="px-3">
                    <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                      <button className="p-1.5 rounded-md hover:bg-muted transition-colors duration-100" title="Ver expediente" onClick={() => navigate(`/cuenta/${account.id}`)}>
                        <Eye className="w-[14px] h-[14px] text-muted-foreground" strokeWidth={1.75} />
                      </button>
                      <TableActionsDropdown account={account} navigate={navigate} setEditAccount={setEditAccount} setPaymentAccount={setPaymentAccount} setCancelAccount={setCancelAccount} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {selectedAccount && (
        <DetailPanel key={selectedAccount.id} account={selectedAccount} onClose={() => setSelectedAccount(null)} onOpenFull={() => { navigate(`/cuenta/${selectedAccount.id}`); setSelectedAccount(null); }} onEdit={() => setEditAccount(selectedAccount)} onPayment={() => setPaymentAccount(selectedAccount)} onCancel={() => setCancelAccount(selectedAccount)} />
      )}

      {editAccount && (
        <EditAccountModal open={!!editAccount} onOpenChange={open => !open && setEditAccount(null)} account={editAccount} />
      )}
      {paymentAccount && (
        <AddManualPaymentModal open={!!paymentAccount} onOpenChange={open => !open && setPaymentAccount(null)} account={paymentAccount} />
      )}
      {cancelAccount && (
        <CancelAccountModal open={!!cancelAccount} onOpenChange={open => !open && setCancelAccount(null)} account={cancelAccount} />
      )}
      <NewAccountModal open={showNewAccount} onOpenChange={setShowNewAccount} />
    </div>
  );
}

function DetailPanel({ account, onClose, onOpenFull, onEdit, onPayment, onCancel }: { account: Account; onClose: () => void; onOpenFull: () => void; onEdit: () => void; onPayment: () => void; onCancel: () => void }) {
  const navigate = useNavigate();
  const [bitacoraEntries, setBitacoraEntries] = useState<BitacoraEntry[]>(() => getBitacoraEntries(account.id));
  const [showAddModal, setShowAddModal] = useState(false);

  const handleEntryAdded = useCallback((entry: BitacoraEntry) => {
    setBitacoraEntries(prev => [entry, ...prev]);
  }, []);

  const actions = getAccountActions(account);

  const handleAction = (id: AccountActionId) => {
    switch (id) {
      case 'view': onOpenFull(); break;
      case 'downloadStatement': toast.info('Estado de cuenta descargado', { description: account.accountId }); break;
      case 'edit': onEdit(); break;
      case 'addPayment': onPayment(); break;
      case 'downloadOffer': toast.info('Oferta comercial descargada', { description: account.accountId }); break;
      case 'cancel': onCancel(); break;
    }
  };

  return (
    <div className="fixed right-0 top-[56px] bottom-0 w-[400px] z-50 bg-card border-l border-border flex flex-col shadow-xl animate-slide-in-right overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground font-mono">{account.accountId}</p>
          <h3 className="text-[14px] font-semibold text-foreground truncate">{account.client.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenFull} title="Abrir expediente">
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={account.priority} />
          {account.activePromise && <span className="sozu-chip bg-info-bg text-info">Promesa activa</span>}
          {account.conciliationPending && <span className="sozu-chip bg-info-bg text-info">Conciliación pend.</span>}
          {!account.documentationComplete && <span className="sozu-chip bg-warning-bg text-warning">Doc. incompleta</span>}
          {account.fullyReconciled && <span className="sozu-chip bg-success-bg text-success">100% conciliado</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <InfoItem label="Proyecto" value={`${account.project.name} · ${account.building}`} />
          <InfoItem label="Unidad" value={account.unitNumber} />
          <InfoItem label="Entidad Legal" value={account.legalEntity.name} />
          <InfoItem label="Tipo de cobro" value={chargeTypeLabels[account.chargeType]} />
          <InfoItem label="CLABE" value={account.clabe} />
          <InfoItem label="Ejecutivo" value={account.assignedExecutive} />
          <InfoItem label="Día de pago" value={`Día ${account.paymentDay}`} />
          <InfoItem label="Próx. vencimiento" value={formatDate(account.nextDueDate)} />
          <InfoItem label="Vencido" value={formatCurrency(account.overdueAmount)} />
          <InfoItem label="Por cobrar" value={formatCurrency(account.balance)} />
          <InfoItem label="Parc. vencidas" value={String(account.overdueInstallments)} />
          <InfoItem label="Cobrado acum." value={formatCurrency(account.balance * 1.5)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[12px] font-semibold text-foreground uppercase tracking-wider">Bitácora</h4>
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary/5 transition-colors">
              <Plus className="w-3 h-3" strokeWidth={2} /> Agregar
            </button>
          </div>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {bitacoraEntries.slice(0, 5).map(entry => (
              <div key={entry.id} className="px-3 py-2 rounded-lg bg-background border border-border-light">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[12px] font-medium text-foreground">{entry.title}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(entry.date)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{entry.description}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{entry.user}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Acciones de la Cuenta</p>
          <div className="grid grid-cols-2 gap-1.5">
            {actions.map(action => (
              <button
                key={action.id}
                onClick={() => !action.disabled && handleAction(action.id)}
                disabled={action.disabled}
                title={action.disabled ? action.disabledReason : undefined}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium transition-colors duration-100',
                  action.destructive
                    ? 'bg-destructive/5 hover:bg-destructive/10 text-destructive'
                    : 'bg-muted hover:bg-border text-foreground',
                  action.disabled && 'opacity-40 cursor-not-allowed',
                )}
              >
                <action.icon className="w-3.5 h-3.5" strokeWidth={1.75} />{action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BitacoraEntryModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        accountId={account.id}
        onEntryAdded={handleEntryAdded}
      />
    </div>
  );
}

function TableActionsDropdown({ account, navigate, setEditAccount, setPaymentAccount, setCancelAccount }: {
  account: Account;
  navigate: ReturnType<typeof useNavigate>;
  setEditAccount: (a: Account) => void;
  setPaymentAccount: (a: Account) => void;
  setCancelAccount: (a: Account) => void;
}) {
  const actions = getAccountActions(account);

  const handleAction = (id: AccountActionId) => {
    switch (id) {
      case 'view': navigate(`/cuenta/${account.id}`); break;
      case 'downloadStatement': toast.info('Estado de cuenta descargado', { description: account.accountId }); break;
      case 'edit': setEditAccount(account); break;
      case 'addPayment': setPaymentAccount(account); break;
      case 'downloadOffer': toast.info('Oferta comercial descargada', { description: account.accountId }); break;
      case 'cancel': setCancelAccount(account); break;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1.5 rounded-md hover:bg-muted transition-colors duration-100" title="Más acciones">
          <MoreHorizontal className="w-[14px] h-[14px] text-muted-foreground" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actions.map((action, i) => (
          <span key={action.id}>
            {action.destructive && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => handleAction(action.id)}
              disabled={action.disabled}
              className={cn(action.destructive && 'text-destructive focus:text-destructive focus:bg-destructive/10')}
            >
              <action.icon className="w-3.5 h-3.5 mr-2" strokeWidth={1.75} /> {action.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-[13px] font-medium text-foreground">{value}</p></div>;
}
