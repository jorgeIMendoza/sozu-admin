import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { mockAccounts } from '@/data/cobranza/mockData';
import {
  ConciliacionCaseType, ConciliacionPriority, ConciliacionStatus, ConciliacionOrigin,
  conciliacionCaseTypeLabels, priorityLabels, conciliacionStatusLabels, originLabels,
  type ConciliacionCase,
} from '@/data/cobranza/conciliacionData';
import { Search } from 'lucide-react';

const executives = ['Luz Ochoa', 'Tomás Peterson'];
const slaOptions = ['24h', '48h', '72h', 'Personalizado'];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCaseCreated: (c: ConciliacionCase) => void;
}

export function NewConciliacionModal({ open, onOpenChange, onCaseCreated }: Props) {
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [caseType, setCaseType] = useState<ConciliacionCaseType>('pago_no_reflejado');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ConciliacionPriority>('media');
  const [status, setStatus] = useState<ConciliacionStatus>('abierta');
  const [assignee, setAssignee] = useState(executives[0]);
  const [sla, setSla] = useState('48h');
  const [origin, setOrigin] = useState<ConciliacionOrigin>('cobranza');
  const [relatedAmount, setRelatedAmount] = useState('');
  const [reference, setReference] = useState('');
  // Impact
  const [markPending, setMarkPending] = useState(true);
  const [adjustPriority, setAdjustPriority] = useState(false);
  const [forceVisibility, setForceVisibility] = useState(false);
  const [blockProcess, setBlockProcess] = useState(false);
  const [specialFollowUp, setSpecialFollowUp] = useState(false);

  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const selectedAccount = useMemo(() => mockAccounts.find(a => a.id === selectedAccountId), [selectedAccountId]);

  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return [];
    const q = accountSearch.toLowerCase();
    return mockAccounts.filter(a =>
      a.accountNumber.toLowerCase().includes(q) ||
      a.client.name.toLowerCase().includes(q) ||
      a.clabe.includes(q) ||
      a.project.name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [accountSearch]);

  const isValid = selectedAccountId && title.trim() && description.trim();

  const reset = useCallback(() => {
    setAccountSearch(''); setSelectedAccountId(null); setCaseType('pago_no_reflejado');
    setTitle(''); setDescription(''); setPriority('media'); setStatus('abierta');
    setAssignee(executives[0]); setSla('48h'); setOrigin('cobranza');
    setRelatedAmount(''); setReference('');
    setMarkPending(true); setAdjustPriority(false); setForceVisibility(false);
    setBlockProcess(false); setSpecialFollowUp(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isValid || !selectedAccount) return;
    const newCase: ConciliacionCase = {
      id: `CONC-${String(Date.now()).slice(-4)}`,
      accountId: selectedAccount.id,
      clientName: selectedAccount.client.name,
      projectName: selectedAccount.project.name,
      unitNumber: selectedAccount.unitNumber,
      accountNumber: selectedAccount.accountNumber,
      entidadLegal: selectedAccount.legalEntity.name,
      tipoCobro: selectedAccount.chargeType,
      caseType, title: title.trim(), description: description.trim(),
      priority, status, assignee,
      openDate: new Date().toISOString().split('T')[0],
      sla, origin,
      relatedAmount: relatedAmount ? parseFloat(relatedAmount) : undefined,
      reference: reference || undefined,
      markPendingConciliation: markPending,
      adjustBandejaPriority: adjustPriority,
      forceVisibility, blockProcess,
      requiresSpecialFollowUp: specialFollowUp,
      lastMovementDate: new Date().toISOString().split('T')[0],
      nextAction: undefined,
      comments: [],
      history: [{
        id: `h-${Date.now()}`,
        date: new Date().toISOString(),
        user: assignee,
        action: 'Caso creado',
        detail: description.trim(),
      }],
    };
    onCaseCreated(newCase);
    reset();
    onOpenChange(false);
  }, [isValid, selectedAccount, caseType, title, description, priority, status, assignee, sla, origin, relatedAmount, reference, markPending, adjustPriority, forceVisibility, blockProcess, specialFollowUp, onCaseCreated, reset, onOpenChange]);

  const selectClasses = "w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]";
  const inputClasses = "w-full h-[38px] rounded-md border border-input bg-background px-3 text-[13px]";
  const labelClasses = "text-[12px] font-medium text-foreground mb-1 block";
  const checkboxLabel = "flex items-center gap-2 text-[13px] text-foreground cursor-pointer";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Nuevo caso de conciliación</DialogTitle>
          <DialogDescription className="text-[13px]">Vincula el caso a una Cuenta de Cobranza existente.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
          {/* Section 1: Account linking */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vinculación con cuenta</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
              <input
                value={accountSearch}
                onChange={e => { setAccountSearch(e.target.value); setShowAccountDropdown(true); setSelectedAccountId(null); }}
                onFocus={() => setShowAccountDropdown(true)}
                placeholder="Buscar por ID cuenta, nombre, CLABE o proyecto..."
                className={`${inputClasses} pl-9`}
              />
              {showAccountDropdown && filteredAccounts.length > 0 && !selectedAccountId && (
                <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {filteredAccounts.map(acc => (
                    <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setAccountSearch(acc.accountNumber + ' · ' + acc.client.name); setShowAccountDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-[13px] border-b border-border last:border-0">
                      <span className="font-medium">{acc.accountNumber}</span>
                      <span className="text-muted-foreground"> · {acc.client.name} · {acc.project.name} · {acc.unitNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedAccount && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] bg-muted/50 rounded-lg p-3">
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{selectedAccount.client.name}</span></div>
                <div><span className="text-muted-foreground">Proyecto:</span> <span className="font-medium">{selectedAccount.project.name}</span></div>
                <div><span className="text-muted-foreground">Unidad:</span> <span className="font-medium">{selectedAccount.unitNumber}</span></div>
                <div><span className="text-muted-foreground">Entidad legal:</span> <span className="font-medium">{selectedAccount.legalEntity.name}</span></div>
                <div><span className="text-muted-foreground">Tipo cobro:</span> <span className="font-medium">{selectedAccount.chargeType}</span></div>
                <div><span className="text-muted-foreground">CLABE:</span> <span className="font-medium text-[11px]">{selectedAccount.clabe}</span></div>
              </div>
            )}
          </div>

          {/* Section 2: Case data */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Datos del caso</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Tipo de caso *</label>
                <select value={caseType} onChange={e => setCaseType(e.target.value as ConciliacionCaseType)} className={selectClasses}>
                  {Object.entries(conciliacionCaseTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Origen</label>
                <select value={origin} onChange={e => setOrigin(e.target.value as ConciliacionOrigin)} className={selectClasses}>
                  {Object.entries(originLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClasses}>Título del caso *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Pago STP del 20 de marzo no reflejado" className={inputClasses} />
              </div>
              <div className="col-span-2">
                <label className={labelClasses}>Descripción *</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalla la situación del caso..." rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] resize-none" />
              </div>
              <div>
                <label className={labelClasses}>Prioridad</label>
                <select value={priority} onChange={e => setPriority(e.target.value as ConciliacionPriority)} className={selectClasses}>
                  {Object.entries(priorityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Estatus inicial</label>
                <select value={status} onChange={e => setStatus(e.target.value as ConciliacionStatus)} className={selectClasses}>
                  {Object.entries(conciliacionStatusLabels).filter(([k]) => k !== 'archivada').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Responsable *</label>
                <select value={assignee} onChange={e => setAssignee(e.target.value)} className={selectClasses}>
                  {executives.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>SLA objetivo</label>
                <select value={sla} onChange={e => setSla(e.target.value)} className={selectClasses}>
                  {slaOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Monto relacionado</label>
                <input value={relatedAmount} onChange={e => setRelatedAmount(e.target.value)} placeholder="0.00" type="number" className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Referencia / folio</label>
                <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ej: STP-20260320-4582" className={inputClasses} />
              </div>
            </div>
          </div>

          {/* Section 3: Impact */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Impacto en cobranza</p>
            <div className="space-y-2">
              <label className={checkboxLabel}><input type="checkbox" checked={markPending} onChange={e => setMarkPending(e.target.checked)} className="rounded" /> Marcar cuenta como "Pendiente de conciliación"</label>
              <label className={checkboxLabel}><input type="checkbox" checked={adjustPriority} onChange={e => setAdjustPriority(e.target.checked)} className="rounded" /> Ajustar prioridad en Bandeja Operativa</label>
              <label className={checkboxLabel}><input type="checkbox" checked={forceVisibility} onChange={e => setForceVisibility(e.target.checked)} className="rounded" /> Forzar visibilidad en Bandeja Operativa</label>
              <label className={checkboxLabel}><input type="checkbox" checked={blockProcess} onChange={e => setBlockProcess(e.target.checked)} className="rounded" /> Bloquear avance de proceso si aplica</label>
              <label className={checkboxLabel}><input type="checkbox" checked={specialFollowUp} onChange={e => setSpecialFollowUp(e.target.checked)} className="rounded" /> Requiere seguimiento especial</label>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!isValid}>Crear caso</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
