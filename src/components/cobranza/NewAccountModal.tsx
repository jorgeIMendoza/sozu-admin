import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AccountFormTabs, getDefaultFormData, type AccountFormData } from './AccountFormTabs';
import { toast } from 'sonner';
import { Plus, Search, ArrowLeft, ArrowRight, Building2, CheckCircle2 } from 'lucide-react';
import { projects, executives, mockLegalEntities } from '@/data/cobranza/mockData';
import { chargeTypeLabels } from '@/types/cobranza';
import { cn } from '@/lib/utils';

type Step = 'origin' | 'search' | 'form' | 'summary';

interface NewAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewAccountModal({ open, onOpenChange }: NewAccountModalProps) {
  const [step, setStep] = useState<Step>('origin');
  const [origin, setOrigin] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<AccountFormData>(getDefaultFormData());
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep('origin');
    setOrigin('');
    setSearchQuery('');
    setFormData(getDefaultFormData());
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleNext = () => {
    if (step === 'origin') {
      setStep(origin === 'oferta' ? 'search' : 'form');
    } else if (step === 'search') {
      setStep('form');
    } else if (step === 'form') {
      // Validate required fields
      if (!formData.projectId || !formData.unitNumber || !formData.legalEntityId || !formData.buyerName || !formData.chargeType || !formData.paymentDay || !formData.assignedExecutive) {
        toast.error('Campos requeridos incompletos', { description: 'Revisa: Proyecto, Unidad, Entidad Legal, Comprador, Tipo de cobro, Día de pago y Ejecutivo.' });
        return;
      }
      setStep('summary');
    }
  };

  const handleCreate = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      const proj = projects.find(p => p.id === formData.projectId);
      toast.success('Cuenta de Cobranza creada', {
        description: `${proj?.name || ''} · ${formData.unitNumber} · ${formData.buyerName}`,
      });
      handleClose(false);
    }, 800);
  };

  const handleBack = () => {
    if (step === 'search') setStep('origin');
    else if (step === 'form') setStep(origin === 'oferta' ? 'search' : 'origin');
    else if (step === 'summary') setStep('form');
  };

  const originLabel = origin === 'oferta' ? 'Desde oferta existente' : origin === 'efectivo' ? 'Alta por pago en efectivo' : 'Regularización / excepción';
  const proj = projects.find(p => p.id === formData.projectId);
  const le = mockLegalEntities.find(l => l.id === formData.legalEntityId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[860px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">Nueva Cuenta de Cobranza</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'origin' && 'Selecciona el origen del alta'}
            {step === 'search' && 'Busca la operación base para vincular'}
            {step === 'form' && `Captura de información · ${originLabel}`}
            {step === 'summary' && 'Resumen y confirmación'}
          </DialogDescription>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 pt-2">
            {(['origin', step === 'search' || origin === 'oferta' ? 'search' : null, 'form', 'summary'].filter(Boolean) as string[]).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors',
                  step === s ? 'bg-primary text-primary-foreground' :
                  arr.indexOf(step) > i ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                )}>
                  {arr.indexOf(step) > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < arr.length - 1 && <div className="w-8 h-px bg-border" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Persistent summary bar in form/summary steps */}
        {(step === 'form' || step === 'summary') && (proj || formData.buyerName) && (
          <div className="px-6 py-2 border-b border-border bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 flex-wrap">
            {proj && <span className="font-medium text-foreground">{proj.name}</span>}
            {formData.unitNumber && <span>{formData.unitNumber}</span>}
            {formData.buyerName && <span>{formData.buyerName}</span>}
            {le && <span>{le.name}</span>}
            {formData.chargeType && <span>{chargeTypeLabels[formData.chargeType as keyof typeof chargeTypeLabels]}</span>}
            {formData.assignedExecutive && <span>Ejec: {formData.assignedExecutive}</span>}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step: Origin */}
          {step === 'origin' && (
            <div className="space-y-4">
              <p className="text-sm text-foreground font-medium">¿Cuál es el origen de esta cuenta?</p>
              <RadioGroup value={origin} onValueChange={setOrigin} className="grid gap-3">
                {[
                  { value: 'oferta', title: 'Generada desde oferta existente', desc: 'La cuenta viene de una oferta o apartado ya registrado en el sistema' },
                  { value: 'efectivo', title: 'Alta manual por pago en efectivo', desc: 'El apartado se realizó en efectivo y no existe registro previo' },
                  { value: 'regularizacion', title: 'Alta manual por regularización / excepción', desc: 'Cuenta generada por excepción operativa o regularización' },
                ].map(opt => (
                  <label key={opt.value} className={cn(
                    'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                    origin === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  )}>
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{opt.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step: Search */}
          {step === 'search' && (
            <div className="space-y-4">
              <p className="text-sm text-foreground font-medium">Buscar operación base</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-sm" placeholder="Nombre, RFC, CLABE, proyecto, unidad, ID oferta..." />
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
                <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-[12px] text-muted-foreground">
                  {searchQuery ? 'No se encontraron operaciones. Continúa con alta manual.' : 'Ingresa un término para buscar la operación base.'}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Si no encuentras la operación, puedes continuar con alta manual en el siguiente paso.</p>
            </div>
          )}

          {/* Step: Form */}
          {step === 'form' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="flex-1">
                  <Label className="text-xs">Ejecutivo asignado *</Label>
                  <Select value={formData.assignedExecutive} onValueChange={v => setFormData({ ...formData, assignedExecutive: v })}>
                    <SelectTrigger className="h-9 text-sm mt-1.5"><SelectValue placeholder="Seleccionar ejecutivo..." /></SelectTrigger>
                    <SelectContent>
                      {executives.map(ex => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Origen del alta</Label>
                  <p className="text-sm font-medium text-foreground mt-1.5 h-9 flex items-center">{originLabel}</p>
                </div>
              </div>
              <AccountFormTabs data={formData} onChange={setFormData} mode="create" />
            </div>
          )}

          {/* Step: Summary */}
          {step === 'summary' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">Resumen de la nueva Cuenta de Cobranza</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-background p-4">
                <SummaryItem label="Proyecto" value={proj?.name || '—'} />
                <SummaryItem label="Unidad" value={formData.unitNumber || '—'} />
                <SummaryItem label="Edificio" value={formData.building || '—'} />
                <SummaryItem label="Tipo de cobro" value={formData.chargeType ? chargeTypeLabels[formData.chargeType as keyof typeof chargeTypeLabels] : '—'} />
                <SummaryItem label="Entidad Legal" value={le?.name || '—'} />
                <SummaryItem label="Comprador" value={formData.buyerName || '—'} />
                <SummaryItem label="Email" value={formData.buyerEmail || '—'} />
                <SummaryItem label="RFC" value={formData.buyerRfc || '—'} />
                <SummaryItem label="CLABE" value={formData.clabe || 'No aplica / Pendiente'} />
                <SummaryItem label="Plan de pagos" value={formData.paymentPlan || '—'} />
                <SummaryItem label="Día de pago" value={formData.paymentDay ? `Día ${formData.paymentDay}` : '—'} />
                <SummaryItem label="Ejecutivo asignado" value={formData.assignedExecutive || '—'} />
                <SummaryItem label="Precio final" value={formData.finalPrice ? `$${Number(formData.finalPrice).toLocaleString()}` : '—'} />
                <SummaryItem label="Monto apartado" value={formData.initialAmount ? `$${Number(formData.initialAmount).toLocaleString()}` : '—'} />
                <SummaryItem label="Origen del pago" value={formData.initialOrigin || '—'} />
                <SummaryItem label="Origen del alta" value={originLabel} />
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Se generará automáticamente</p>
                <ul className="text-[12px] text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>ID único de Cuenta de Cobranza</li>
                  <li>Entrada en Bitácora: "Alta manual de cuenta"</li>
                  {formData.initialAmount && <li>Registro de pago inicial en Relación de Pagos</li>}
                  <li>Vinculación con Bandeja Operativa</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between shrink-0 bg-background">
          <div>
            {step !== 'origin' && (
              <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Atrás
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Cancelar</Button>
            {step === 'summary' ? (
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creando...' : 'Crear Cuenta de Cobranza'}
              </Button>
            ) : (
              <Button size="sm" onClick={handleNext} disabled={step === 'origin' && !origin} className="gap-1.5">
                Siguiente <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[13px] font-medium text-foreground">{value}</p>
    </div>
  );
}
