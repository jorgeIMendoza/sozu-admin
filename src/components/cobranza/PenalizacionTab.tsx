import { useState, useMemo } from 'react';
import { addBitacoraEntry } from '@/data/cobranza/bitacoraData';
import { BitacoraEntryModal } from '@/components/cobranza/BitacoraEntryModal';
import { PriorityBadge, formatCurrency, formatDate } from '@/components/cobranza/StatusBadges';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield, CheckCircle2, AlertTriangle, Clock, Phone, Mail, Send,
  Handshake, Gavel, FileText, StickyNote, TrendingUp, Lightbulb,
  ArrowRight, CalendarDays, User, Building2, Scale, Zap, X,
  MessageSquare, ChevronRight, Target, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Account } from '@/types/cobranza';

// ── Penalización Status ─────────────────────────────────────────
type PenalizacionStatus =
  | 'en_riesgo' | 'penalizada' | 'en_negociacion' | 'propuesta_enviada'
  | 'convenio_enviado' | 'convenio_firmado' | 'convenio_incumplido'
  | 'notificacion_formal' | 'escalada_legal' | 'en_rescision'
  | 'regularizada' | 'cerrada';

const penStatusLabels: Record<PenalizacionStatus, string> = {
  en_riesgo: 'En riesgo',
  penalizada: 'Penalizada',
  en_negociacion: 'En negociación',
  propuesta_enviada: 'Propuesta enviada',
  convenio_enviado: 'Convenio enviado',
  convenio_firmado: 'Convenio firmado',
  convenio_incumplido: 'Convenio incumplido',
  notificacion_formal: 'Notificación formal emitida',
  escalada_legal: 'Escalada a legal',
  en_rescision: 'En rescisión',
  regularizada: 'Regularizada',
  cerrada: 'Cerrada',
};

const penStatusColors: Record<PenalizacionStatus, string> = {
  en_riesgo: 'bg-warning/10 text-warning border-warning/30',
  penalizada: 'bg-destructive/10 text-destructive border-destructive/30',
  en_negociacion: 'bg-info/10 text-info border-info/30',
  propuesta_enviada: 'bg-info/10 text-info border-info/30',
  convenio_enviado: 'bg-primary/10 text-primary border-primary/30',
  convenio_firmado: 'bg-success/10 text-success border-success/30',
  convenio_incumplido: 'bg-destructive/10 text-destructive border-destructive/30',
  notificacion_formal: 'bg-warning/10 text-warning border-warning/30',
  escalada_legal: 'bg-priority-purple/10 text-priority-purple border-priority-purple/30',
  en_rescision: 'bg-destructive/10 text-destructive border-destructive/30',
  regularizada: 'bg-success/10 text-success border-success/30',
  cerrada: 'bg-muted text-muted-foreground border-border',
};

function derivePenStatus(account: Account): PenalizacionStatus {
  if (account.overdueInstallments >= 3 && (account.legalStatus === 'prelegal' || account.legalStatus === 'demanda_preparada')) return 'escalada_legal';
  if (account.overdueInstallments >= 3) return 'penalizada';
  if (account.overdueInstallments >= 2) return 'en_riesgo';
  return 'en_riesgo';
}

function getRecommendation(account: Account): { label: string; description: string; icon: typeof Lightbulb; color: string } {
  if (account.overdueInstallments >= 3 && account.activePromise?.status === 'vencida') {
    return { label: 'Notificación formal', description: 'Promesa incumplida + 3 parcialidades. Proceder con notificación legal.', icon: Mail, color: 'text-destructive' };
  }
  if (account.overdueInstallments >= 3) {
    return { label: 'Convenio de regularización', description: `${account.overdueInstallments} parcialidades vencidas. Negociar reestructura antes de escalar.`, icon: Handshake, color: 'text-warning' };
  }
  if (account.overdueInstallments === 2 && account.activePromise) {
    return { label: 'Seguimiento de promesa', description: 'Hay promesa activa. Dar seguimiento antes de escalar.', icon: Clock, color: 'text-info' };
  }
  if (account.overdueInstallments === 2) {
    return { label: 'Pago parcial + promesa', description: '2 parcialidades vencidas. Negociar anticipo con compromiso.', icon: TrendingUp, color: 'text-warning' };
  }
  return { label: 'Contactar al cliente', description: 'Iniciar contacto preventivo para evitar escalamiento.', icon: Phone, color: 'text-info' };
}

// ── Modal types ──────────────────────────────────────────────────
type ModalType = 'convenio' | 'contacto' | 'propuesta' | 'notificacion' | 'legal' | 'nota' | null;

// ── Field helper ─────────────────────────────────────────────────
function Field({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-[13px] font-medium tabular-nums', mono && 'font-mono text-[11px]', highlight ? 'text-destructive' : 'text-foreground')}>{value}</p>
    </div>
  );
}

// ── Timeline mock data ───────────────────────────────────────────
function getRecoveryTimeline(accountId: string) {
  return [
    { date: '2026-03-15', event: 'Recordatorio automático enviado', type: 'sistema' as const, user: 'Sistema' },
    { date: '2026-03-18', event: 'Llamada de seguimiento — sin respuesta', type: 'comunicacion' as const, user: 'Luz Ochoa' },
    { date: '2026-03-20', event: 'Contacto por WhatsApp — cliente pide plazo', type: 'comunicacion' as const, user: 'Luz Ochoa' },
    { date: '2026-03-22', event: 'Promesa de pago registrada', type: 'cobranza' as const, user: 'Luz Ochoa' },
    { date: '2026-03-28', event: 'Promesa de pago vencida', type: 'cobranza' as const, user: 'Sistema' },
    { date: '2026-04-01', event: 'Cuenta marcada en riesgo de penalización', type: 'sistema' as const, user: 'Sistema' },
    { date: '2026-04-02', event: 'Notificación formal en preparación', type: 'legal' as const, user: 'Luz Ochoa' },
  ];
}

const timelineTypeColors: Record<string, string> = {
  sistema: 'bg-muted text-muted-foreground',
  comunicacion: 'bg-info/10 text-info',
  cobranza: 'bg-warning/10 text-warning',
  legal: 'bg-priority-purple/10 text-priority-purple',
};

// ══════════════════════════════════════════════════════════════════
// MAIN TAB COMPONENT
// ══════════════════════════════════════════════════════════════════
export function PenalizacionTab({ account }: { account: Account }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [showBitacora, setShowBitacora] = useState(false);
  const [penStatus, setPenStatus] = useState<PenalizacionStatus>(() => derivePenStatus(account));

  const isAtRisk = account.overdueInstallments >= 2;
  const isPenalized = account.overdueInstallments >= 3;
  const recommendation = useMemo(() => getRecommendation(account), [account]);
  const timeline = useMemo(() => getRecoveryTimeline(account.id), [account.id]);
  const daysOverdue = useMemo(() => {
    if (!account.nextDueDate) return 0;
    const diff = Date.now() - new Date(account.nextDueDate).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  }, [account.nextDueDate]);

  if (!isAtRisk) {
    return (
      <div className="sozu-kpi-card flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="w-10 h-10 text-success mb-3" strokeWidth={1.75} />
        <p className="text-foreground font-medium text-[13px]">Sin riesgo de penalización</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">Esta cuenta está al corriente o con atraso menor.</p>
      </div>
    );
  }

  const handleActionComplete = (title: string, description: string, newStatus?: PenalizacionStatus) => {
    addBitacoraEntry({
      id: `bit-pen-${Date.now()}`,
      accountId: account.id,
      category: 'legal',
      eventType: 'avance_rescision',
      title,
      description,
      user: 'Operador Cobranza',
      date: new Date().toISOString(),
      origin: 'manual',
      result: 'completado',
    });
    if (newStatus) setPenStatus(newStatus);
    setActiveModal(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── A) RESUMEN DEL CASO ──────────────────────────── */}
      <div className={cn('sozu-kpi-card !p-4 border-l-4', isPenalized ? 'border-l-destructive' : 'border-l-warning')}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Shield className={cn('w-5 h-5', isPenalized ? 'text-destructive' : 'text-warning')} strokeWidth={1.75} />
            <h4 className="text-[14px] font-semibold text-foreground">Mesa de Recuperación</h4>
          </div>
          <Badge variant="outline" className={cn('text-[11px] font-semibold px-2.5 py-0.5', penStatusColors[penStatus])}>
            {penStatusLabels[penStatus]}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Field label="Parcialidades vencidas" value={String(account.overdueInstallments)} highlight />
          <Field label="Días de atraso" value={`${daysOverdue}d`} highlight={daysOverdue > 30} />
          <Field label="Monto vencido" value={formatCurrency(account.overdueAmount)} highlight />
          <Field label="Saldo total" value={formatCurrency(account.balance)} />
          <Field label="Último pago" value={formatDate(account.lastPaymentDate)} />
          <Field label="Último contacto" value={account.lastContactChannel || 'Sin contacto'} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3 pt-3 border-t border-border">
          <Field label="Proyecto" value={account.project.name} />
          <Field label="Unidad" value={`${account.building}-${account.unitNumber}`} />
          <Field label="Entidad legal" value={account.legalEntity.name} />
          <Field label="Ejecutivo" value={account.assignedExecutive} />
          <Field label="Nivel de riesgo" value={isPenalized ? 'Crítico' : 'Alto'} highlight={isPenalized} />
          <Field label="Estatus legal" value={account.legalStatus === 'sin_accion' ? 'Sin acción' : account.legalStatus.replace(/_/g, ' ')} />
        </div>
      </div>

      {/* ── B) RECOMENDACIÓN DEL SISTEMA ──────────────────── */}
      <div className="sozu-kpi-card !p-4 border border-primary/20 bg-primary/[0.03]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-0.5">Recomendación del sistema</p>
            <p className="text-[14px] font-semibold text-foreground">{recommendation.label}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{recommendation.description}</p>
          </div>
          <recommendation.icon className={cn('w-5 h-5 shrink-0 mt-1', recommendation.color)} strokeWidth={1.75} />
        </div>
      </div>

      {/* ── C) OPCIONES DE REGULARIZACIÓN ──────────────────── */}
      <div className="sozu-kpi-card space-y-3">
        <h3 className="sozu-section-title">Opciones de Regularización</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RegularizationCard
            title="Pago total inmediato"
            description={`Liquidar ${formatCurrency(account.overdueAmount)} para regularizar inmediatamente.`}
            impact="Regularización inmediata"
            minAmount={formatCurrency(account.overdueAmount)}
            risk="Sin riesgo"
            approval={false}
            recommended={account.overdueInstallments === 2}
          />
          <RegularizationCard
            title="Pago parcial + promesa"
            description="Anticipo de 50% y compromiso firmado por el saldo restante."
            impact="Reducción parcial de mora"
            minAmount={formatCurrency(account.overdueAmount * 0.5)}
            risk="Medio — depende del cumplimiento"
            approval={false}
            recommended={account.overdueInstallments === 2 && !account.activePromise}
          />
          <RegularizationCard
            title="Convenio de regularización"
            description="Reestructurar el adeudo vencido en parcialidades a 2-3 meses."
            impact="Estabilización de la cuenta"
            minAmount="Variable — según convenio"
            risk="Medio — requiere seguimiento"
            approval
            recommended={account.overdueInstallments >= 3}
          />
          <RegularizationCard
            title="Escalamiento legal"
            description="Proceder con notificación formal y/o proceso legal."
            impact="Bloqueo de cuenta + proceso jurídico"
            minAmount="N/A"
            risk="Alto — rescisión o demanda"
            approval
            recommended={false}
            destructive
          />
        </div>
      </div>

      {/* ── D) ACCIONES EJECUTABLES ──────────────────────── */}
      <div className="sozu-kpi-card !p-4 space-y-4">
        <h3 className="sozu-section-title">Acciones</h3>
        <div className="space-y-3">
          {/* Negociación */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Negociación</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-9 text-[12px]" onClick={() => setActiveModal('contacto')}>
                <Phone className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Contactar cliente
              </Button>
              <Button variant="outline" size="sm" className="h-9 text-[12px]" onClick={() => setActiveModal('propuesta')}>
                <Send className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Enviar propuesta
              </Button>
              <Button variant="outline" size="sm" className="h-9 text-[12px]" onClick={() => setActiveModal('convenio')}>
                <Handshake className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Crear convenio
              </Button>
            </div>
          </div>
          {/* Formalización */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Formalización</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-9 text-[12px] border-warning/40 text-warning hover:bg-warning/10 hover:text-warning" onClick={() => setActiveModal('notificacion')}>
                <Mail className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Notificación formal
              </Button>
            </div>
          </div>
          {/* Escalamiento */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Escalamiento</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-9 text-[12px] border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setActiveModal('legal')}>
                <Gavel className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Escalar a legal
              </Button>
            </div>
          </div>
          {/* Registro */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Registro</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-9 text-[12px]" onClick={() => setShowBitacora(true)}>
                <StickyNote className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Registrar nota
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── E) BITÁCORA DE RECUPERACIÓN ──────────────────── */}
      <div className="sozu-kpi-card !p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="sozu-section-title">Bitácora de Recuperación</h3>
        </div>
        <div className="px-5 py-4 space-y-0">
          {timeline.map((item, i) => (
            <div key={i} className="flex items-start gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0', timelineTypeColors[item.type] || 'bg-muted text-muted-foreground')}>
                  {item.type === 'sistema' && <Zap className="w-3 h-3" strokeWidth={2} />}
                  {item.type === 'comunicacion' && <MessageSquare className="w-3 h-3" strokeWidth={2} />}
                  {item.type === 'cobranza' && <Target className="w-3 h-3" strokeWidth={2} />}
                  {item.type === 'legal' && <Gavel className="w-3 h-3" strokeWidth={2} />}
                </div>
                {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
              </div>
              <div className="flex-1 min-w-0 -mt-0.5">
                <p className="text-[13px] font-medium text-foreground">{item.event}</p>
                <p className="text-[11px] text-muted-foreground">{item.user} · {formatDate(item.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────── */}
      <ConvenioModal open={activeModal === 'convenio'} onClose={() => setActiveModal(null)} account={account} onComplete={handleActionComplete} />
      <ContactoModal open={activeModal === 'contacto'} onClose={() => setActiveModal(null)} account={account} onComplete={handleActionComplete} />
      <PropuestaModal open={activeModal === 'propuesta'} onClose={() => setActiveModal(null)} account={account} onComplete={handleActionComplete} />
      <NotificacionModal open={activeModal === 'notificacion'} onClose={() => setActiveModal(null)} account={account} onComplete={handleActionComplete} />
      <LegalModal open={activeModal === 'legal'} onClose={() => setActiveModal(null)} account={account} onComplete={handleActionComplete} />
      <BitacoraEntryModal open={showBitacora} onOpenChange={setShowBitacora} accountId={account.id} onEntryAdded={() => {}} />
    </div>
  );
}

// ── Regularization Card ──────────────────────────────────────────
function RegularizationCard({ title, description, impact, minAmount, risk, approval, recommended, destructive }: {
  title: string; description: string; impact: string; minAmount: string; risk: string; approval: boolean; recommended?: boolean; destructive?: boolean;
}) {
  return (
    <div className={cn(
      'p-3.5 rounded-lg border transition-colors',
      recommended ? 'border-primary/40 bg-primary/[0.03]' : destructive ? 'border-destructive/20 bg-destructive/[0.02]' : 'border-border bg-background',
    )}>
      <div className="flex items-start justify-between mb-2">
        <p className={cn('text-[13px] font-semibold', destructive ? 'text-destructive' : 'text-foreground')}>{title}</p>
        {recommended && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary bg-primary/10">Sugerido</Badge>}
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">{description}</p>
      <div className="grid grid-cols-2 gap-2">
        <div><p className="text-[10px] text-muted-foreground">Impacto</p><p className="text-[11px] font-medium text-foreground">{impact}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Monto mínimo</p><p className="text-[11px] font-medium text-foreground tabular-nums">{minAmount}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Riesgo</p><p className="text-[11px] font-medium text-foreground">{risk}</p></div>
        <div><p className="text-[10px] text-muted-foreground">Aprobación</p><p className="text-[11px] font-medium text-foreground">{approval ? 'Sí — supervisor' : 'No requerida'}</p></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ACTION MODALS
// ══════════════════════════════════════════════════════════════════

interface ModalProps {
  open: boolean;
  onClose: () => void;
  account: Account;
  onComplete: (title: string, desc: string, newStatus?: PenalizacionStatus) => void;
}

// ── CONVENIO ─────────────────────────────────────────────────────
function ConvenioModal({ open, onClose, account, onComplete }: ModalProps) {
  const [tipo, setTipo] = useState('regularizacion');
  const [anticipo, setAnticipo] = useState('');
  const [parcialidades, setParcialidades] = useState('3');
  const [frecuencia, setFrecuencia] = useState('mensual');
  const [fechaInicio, setFechaInicio] = useState('');
  const [condonacion, setCondonacion] = useState('0');
  const [requiereAprobacion, setRequiereAprobacion] = useState(true);
  const [responsable, setResponsable] = useState('Luz Ochoa');
  const [observaciones, setObservaciones] = useState('');

  const montoReestructurar = account.overdueAmount - (parseFloat(anticipo) || 0) - (parseFloat(condonacion) || 0);
  const montoParcialidad = parcialidades ? (montoReestructurar / parseInt(parcialidades)) : 0;

  const handleSubmit = () => {
    onComplete(
      'Convenio de regularización creado',
      `Tipo: ${tipo}. Anticipo: ${formatCurrency(parseFloat(anticipo) || 0)}. ${parcialidades} parcialidades de ${formatCurrency(montoParcialidad)}. Responsable: ${responsable}.`,
      'convenio_enviado'
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2"><Handshake className="w-4 h-4 text-primary" strokeWidth={1.75} />Crear Convenio de Regularización</DialogTitle>
          <DialogDescription className="text-[12px]">Cuenta {account.accountId} · {account.client.name} · Vencido: {formatCurrency(account.overdueAmount)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[12px]">Tipo de convenio</Label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="regularizacion">Convenio de regularización</option>
                <option value="reestructura">Reestructura temporal</option>
                <option value="terminacion">Terminación negociada</option>
                <option value="rescate">Rescate por penalización</option>
              </select>
            </div>
            <div><Label className="text-[12px]">Responsable</Label>
              <select value={responsable} onChange={e => setResponsable(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="Luz Ochoa">Luz Ochoa</option>
                <option value="Tomás Peterson">Tomás Peterson</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Cálculo del convenio</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[12px]">Monto vencido base</Label><p className="text-[13px] font-semibold text-foreground tabular-nums mt-1">{formatCurrency(account.overdueAmount)}</p></div>
              <div><Label className="text-[12px]">Anticipo requerido</Label><Input type="number" value={anticipo} onChange={e => setAnticipo(e.target.value)} placeholder="0.00" className="h-9 mt-1 text-[13px]" /></div>
              <div><Label className="text-[12px]">Condonación / descuento</Label><Input type="number" value={condonacion} onChange={e => setCondonacion(e.target.value)} placeholder="0.00" className="h-9 mt-1 text-[13px]" /></div>
              <div><Label className="text-[12px]">Monto a reestructurar</Label><p className="text-[13px] font-semibold text-primary tabular-nums mt-1">{formatCurrency(Math.max(0, montoReestructurar))}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-[12px]">Parcialidades</Label><Input type="number" value={parcialidades} onChange={e => setParcialidades(e.target.value)} min="1" max="12" className="h-9 mt-1 text-[13px]" /></div>
            <div><Label className="text-[12px]">Frecuencia</Label>
              <select value={frecuencia} onChange={e => setFrecuencia(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div><Label className="text-[12px]">Fecha primer pago</Label><Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-9 mt-1 text-[13px]" /></div>
          </div>

          {montoParcialidad > 0 && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/[0.03]">
              <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-1">Simulación del plan</p>
              <p className="text-[13px] text-foreground">{parcialidades} pagos {frecuencia === 'quincenal' ? 'quincenales' : 'mensuales'} de <span className="font-semibold tabular-nums">{formatCurrency(montoParcialidad)}</span></p>
              {parseFloat(anticipo) > 0 && <p className="text-[12px] text-muted-foreground">+ Anticipo de {formatCurrency(parseFloat(anticipo))}</p>}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="req-aprobacion" checked={requiereAprobacion} onChange={e => setRequiereAprobacion(e.target.checked)} className="rounded border-border" />
            <Label htmlFor="req-aprobacion" className="text-[12px] cursor-pointer">Requiere aprobación de supervisor</Label>
          </div>

          <div><Label className="text-[12px]">Observaciones</Label><Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} placeholder="Condiciones especiales, notas internas..." className="mt-1 text-[13px]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!fechaInicio || !parcialidades}><Handshake className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Crear convenio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CONTACTAR CLIENTE ────────────────────────────────────────────
function ContactoModal({ open, onClose, account, onComplete }: ModalProps) {
  const [canal, setCanal] = useState('llamada');
  const [motivo, setMotivo] = useState('seguimiento_mora');
  const [resultado, setResultado] = useState('');
  const [respondio, setRespondio] = useState('');
  const [compromiso, setCompromiso] = useState(false);
  const [fechaCompromiso, setFechaCompromiso] = useState('');
  const [fechaSeguimiento, setFechaSeguimiento] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const handleSubmit = () => {
    onComplete(
      `Contacto con cliente vía ${canal}`,
      `Motivo: ${motivo}. Resultado: ${resultado || 'N/A'}. ${compromiso ? `Compromiso: ${formatDate(fechaCompromiso)}` : 'Sin compromiso'}.`,
      compromiso ? 'en_negociacion' : undefined
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2"><Phone className="w-4 h-4 text-primary" strokeWidth={1.75} />Contactar Cliente</DialogTitle>
          <DialogDescription className="text-[12px]">{account.client.name} · {account.client.phone} · {account.client.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[12px]">Canal</Label>
              <select value={canal} onChange={e => setCanal(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="llamada">Llamada telefónica</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Correo electrónico</option>
              </select>
            </div>
            <div><Label className="text-[12px]">Motivo del contacto</Label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="seguimiento_mora">Seguimiento de mora</option>
                <option value="cobro_parcialidad">Cobro de parcialidad</option>
                <option value="negociacion">Negociación</option>
                <option value="seguimiento_promesa">Seguimiento de promesa</option>
                <option value="aviso_penalizacion">Aviso de penalización</option>
              </select>
            </div>
          </div>
          <div><Label className="text-[12px]">¿Cliente respondió?</Label>
            <select value={respondio} onChange={e => setRespondio(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
              <option value="">Seleccionar...</option>
              <option value="si">Sí — contactado</option>
              <option value="no">No — sin respuesta</option>
              <option value="buzon">Buzón / No disponible</option>
              <option value="numero_incorrecto">Número incorrecto</option>
            </select>
          </div>
          <div><Label className="text-[12px]">Resultado del contacto</Label>
            <select value={resultado} onChange={e => setResultado(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
              <option value="">Seleccionar...</option>
              <option value="compromiso_pago">Se obtuvo compromiso de pago</option>
              <option value="pide_plazo">Cliente pide plazo</option>
              <option value="acepta_convenio">Cliente acepta convenio</option>
              <option value="rechaza_pago">Cliente rechaza pago</option>
              <option value="sin_respuesta">Sin respuesta</option>
              <option value="otros">Otros</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="compromiso-check" checked={compromiso} onChange={e => setCompromiso(e.target.checked)} className="rounded border-border" />
            <Label htmlFor="compromiso-check" className="text-[12px] cursor-pointer">Se obtuvo compromiso de pago</Label>
          </div>
          {compromiso && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[12px]">Fecha compromiso</Label><Input type="date" value={fechaCompromiso} onChange={e => setFechaCompromiso(e.target.value)} className="h-9 mt-1 text-[13px]" /></div>
              <div><Label className="text-[12px]">Fecha seguimiento</Label><Input type="date" value={fechaSeguimiento} onChange={e => setFechaSeguimiento(e.target.value)} className="h-9 mt-1 text-[13px]" /></div>
            </div>
          )}
          <div><Label className="text-[12px]">Observaciones</Label><Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} placeholder="Detalles de la conversación..." className="mt-1 text-[13px]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!respondio}><Phone className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Registrar contacto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ENVIAR PROPUESTA ─────────────────────────────────────────────
function PropuestaModal({ open, onClose, account, onComplete }: ModalProps) {
  const [tipo, setTipo] = useState('regularizacion');
  const [canal, setCanal] = useState('email');
  const [asunto, setAsunto] = useState(`Propuesta de regularización — ${account.client.name}`);
  const [anticipo, setAnticipo] = useState('');
  const [vigencia, setVigencia] = useState('5');
  const [comentario, setComentario] = useState('');

  const handleSubmit = () => {
    onComplete(
      'Propuesta de regularización enviada',
      `Tipo: ${tipo}. Canal: ${canal}. Anticipo sugerido: ${formatCurrency(parseFloat(anticipo) || 0)}. Vigencia: ${vigencia} días.`,
      'propuesta_enviada'
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2"><Send className="w-4 h-4 text-primary" strokeWidth={1.75} />Enviar Propuesta</DialogTitle>
          <DialogDescription className="text-[12px]">{account.client.name} · {account.client.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[12px]">Tipo de propuesta</Label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="regularizacion">Regularización</option>
                <option value="parcial">Pago parcial</option>
                <option value="convenio">Convenio</option>
                <option value="terminacion">Terminación negociada</option>
              </select>
            </div>
            <div><Label className="text-[12px]">Canal de envío</Label>
              <select value={canal} onChange={e => setCanal(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="email">Correo electrónico</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          </div>
          <div><Label className="text-[12px]">Asunto</Label><Input value={asunto} onChange={e => setAsunto(e.target.value)} className="h-9 mt-1 text-[13px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[12px]">Monto vencido</Label><p className="text-[13px] font-semibold text-foreground tabular-nums mt-1">{formatCurrency(account.overdueAmount)}</p></div>
            <div><Label className="text-[12px]">Anticipo sugerido</Label><Input type="number" value={anticipo} onChange={e => setAnticipo(e.target.value)} placeholder="0.00" className="h-9 mt-1 text-[13px]" /></div>
          </div>
          <div><Label className="text-[12px]">Vigencia de propuesta (días)</Label><Input type="number" value={vigencia} onChange={e => setVigencia(e.target.value)} className="h-9 mt-1 text-[13px]" /></div>
          <div><Label className="text-[12px]">Comentario adicional</Label><Textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2} className="mt-1 text-[13px]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit}><Send className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Enviar propuesta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── NOTIFICACIÓN FORMAL ──────────────────────────────────────────
function NotificacionModal({ open, onClose, account, onComplete }: ModalProps) {
  const [causa, setCausa] = useState('mora_3plus');
  const [fechaLimite, setFechaLimite] = useState('');
  const [clausula, setClausula] = useState('');
  const [canalEntrega, setCanalEntrega] = useState('notario');
  const [folio, setFolio] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const handleSubmit = () => {
    onComplete(
      'Notificación formal emitida',
      `Causa: ${causa}. Fecha límite: ${formatDate(fechaLimite)}. Canal: ${canalEntrega}. Folio: ${folio || 'Pendiente'}.`,
      'notificacion_formal'
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2"><Mail className="w-4 h-4 text-warning" strokeWidth={1.75} />Notificación Formal</DialogTitle>
          <DialogDescription className="text-[12px]">Documento legal para {account.client.name} · {account.overdueInstallments} parcialidades vencidas</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-[12px] text-warning">Esta acción generará un documento legal formal. Asegúrate de haber agotado las vías de negociación previas.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[12px]">Causa</Label>
              <select value={causa} onChange={e => setCausa(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="mora_3plus">Mora de 3+ parcialidades</option>
                <option value="promesa_incumplida">Promesa de pago incumplida</option>
                <option value="convenio_incumplido">Convenio incumplido</option>
                <option value="sin_respuesta">Sin respuesta del cliente</option>
              </select>
            </div>
            <div><Label className="text-[12px]">Canal de entrega</Label>
              <select value={canalEntrega} onChange={e => setCanalEntrega(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="notario">Notario / Corredor</option>
                <option value="mensajeria">Mensajería certificada</option>
                <option value="personal">Entrega personal</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[12px]">Parcialidades vencidas</Label><p className="text-[13px] font-semibold text-destructive mt-1">{account.overdueInstallments}</p></div>
            <div><Label className="text-[12px]">Monto vencido</Label><p className="text-[13px] font-semibold text-destructive tabular-nums mt-1">{formatCurrency(account.overdueAmount)}</p></div>
          </div>
          <div><Label className="text-[12px]">Fecha límite para regularizar</Label><Input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} className="h-9 mt-1 text-[13px]" /></div>
          <div><Label className="text-[12px]">Cláusula contractual de referencia</Label><Input value={clausula} onChange={e => setClausula(e.target.value)} placeholder="Ej: Cláusula 12.3 — Incumplimiento" className="h-9 mt-1 text-[13px]" /></div>
          <div><Label className="text-[12px]">Folio interno</Label><Input value={folio} onChange={e => setFolio(e.target.value)} placeholder="Ej: NF-2026-0041" className="h-9 mt-1 text-[13px]" /></div>
          <div><Label className="text-[12px]">Observaciones</Label><Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="mt-1 text-[13px]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="bg-warning text-warning-foreground hover:bg-warning/90" onClick={handleSubmit} disabled={!fechaLimite}>
            <Mail className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Emitir notificación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ESCALAR A LEGAL ──────────────────────────────────────────────
function LegalModal({ open, onClose, account, onComplete }: ModalProps) {
  const [motivo, setMotivo] = useState('mora_persistente');
  const [resumen, setResumen] = useState(`Cliente con ${account.overdueInstallments} parcialidades vencidas por ${formatCurrency(account.overdueAmount)}. Sin respuesta a gestiones previas de cobranza.`);
  const [docCompleta, setDocCompleta] = useState(account.documentationComplete);
  const [contratoFirmado, setContratoFirmado] = useState(true);
  const [notificacionEmitida, setNotificacionEmitida] = useState(false);
  const [responsableLegal, setResponsableLegal] = useState('');
  const [prioridadLegal, setPrioridadLegal] = useState('alta');
  const [comentarios, setComentarios] = useState('');

  const handleSubmit = () => {
    onComplete(
      'Caso escalado a legal',
      `Motivo: ${motivo}. Prioridad: ${prioridadLegal}. Documentación: ${docCompleta ? 'Completa' : 'Incompleta'}. Contrato: ${contratoFirmado ? 'Sí' : 'No'}. Notificación: ${notificacionEmitida ? 'Sí' : 'No'}.`,
      'escalada_legal'
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px] flex items-center gap-2"><Gavel className="w-4 h-4 text-destructive" strokeWidth={1.75} />Escalar a Legal</DialogTitle>
          <DialogDescription className="text-[12px]">{account.client.name} · {account.accountId} · Vencido: {formatCurrency(account.overdueAmount)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-[12px] text-destructive">Esta acción inicia un proceso legal formal. Asegúrate de que la documentación esté completa y que se hayan agotado las vías de negociación.</p>
            </div>
          </div>
          <div><Label className="text-[12px]">Motivo del escalamiento</Label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
              <option value="mora_persistente">Mora persistente sin respuesta</option>
              <option value="promesa_incumplida">Promesas reiteradas incumplidas</option>
              <option value="convenio_incumplido">Convenio incumplido</option>
              <option value="sin_contacto">Imposibilidad de contacto</option>
              <option value="rechazo_pago">Rechazo abierto de pago</option>
            </select>
          </div>
          <div><Label className="text-[12px]">Resumen del caso</Label><Textarea value={resumen} onChange={e => setResumen(e.target.value)} rows={3} className="mt-1 text-[13px]" /></div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Checklist pre-escalamiento</p>
            <label className="flex items-center gap-2 text-[12px] text-foreground">
              <input type="checkbox" checked={docCompleta} onChange={e => setDocCompleta(e.target.checked)} className="rounded border-border" />
              Documentación completa
            </label>
            <label className="flex items-center gap-2 text-[12px] text-foreground">
              <input type="checkbox" checked={contratoFirmado} onChange={e => setContratoFirmado(e.target.checked)} className="rounded border-border" />
              Contrato firmado
            </label>
            <label className="flex items-center gap-2 text-[12px] text-foreground">
              <input type="checkbox" checked={notificacionEmitida} onChange={e => setNotificacionEmitida(e.target.checked)} className="rounded border-border" />
              Notificación formal emitida
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[12px]">Responsable legal</Label><Input value={responsableLegal} onChange={e => setResponsableLegal(e.target.value)} placeholder="Nombre del abogado / despacho" className="h-9 mt-1 text-[13px]" /></div>
            <div><Label className="text-[12px]">Prioridad legal</Label>
              <select value={prioridadLegal} onChange={e => setPrioridadLegal(e.target.value)} className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-md text-foreground mt-1">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </div>
          <div><Label className="text-[12px]">Comentarios</Label><Textarea value={comentarios} onChange={e => setComentarios(e.target.value)} rows={2} className="mt-1 text-[13px]" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={!notificacionEmitida && !docCompleta}>
            <Gavel className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />Confirmar escalamiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
