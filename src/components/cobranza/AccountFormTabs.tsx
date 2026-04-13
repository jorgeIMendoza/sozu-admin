import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, User, Landmark, FileText, CreditCard, Receipt, ScrollText, Upload, Plus, Trash2 } from 'lucide-react';
import { projects, mockLegalEntities, executives, paymentOrigins } from '@/data/mockData';
import { chargeTypeFullLabels } from '@/types/cobranza';
import type { ChargeType } from '@/types/cobranza';
import { cn } from '@/lib/utils';

export interface AccountFormData {
  // Property
  projectId: string;
  building: string;
  unitNumber: string;
  chargeType: ChargeType | '';
  sqMeters: string;
  level: string;
  description: string;
  listPrice: string;
  finalPrice: string;
  currency: string;
  purchaseDate: string;
  acquisitionMethod: string;
  // Legal entity
  legalEntityId: string;
  legalEntityRfc: string;
  legalEntityEmail: string;
  legalEntityPhone: string;
  legalEntityPersonType: string;
  // Buyer
  buyerName: string;
  buyerRfc: string;
  buyerCurp: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerPersonType: string;
  buyerFiscalAddress: string;
  buyerParticipation: string;
  buyerDataComplete: boolean;
  // Banking
  clabe: string;
  bank: string;
  linkMethod: string;
  clabeRfc: string;
  bankValidation: string;
  bankNotes: string;
  // Payment plan
  paymentPlan: string;
  downPayment: string;
  monthlyPayments: string;
  deliveryPayment: string;
  paymentDay: string;
  firstDueDate: string;
  lastDueDate: string;
  frequency: string;
  installments: InstallmentRow[];
  // Initial payment
  initialAmount: string;
  initialDate: string;
  initialOrigin: string;
  initialReference: string;
  initialNotes: string;
  generatePaymentRecord: boolean;
  // Escrituracion
  escrituracionStatus: string;
  notary: string;
  estimatedEscrituracion: string;
  estimatedDelivery: string;
  escrituracionNotes: string;
  // Documents
  documents: DocItem[];
  // Executive
  assignedExecutive: string;
}

export interface InstallmentRow {
  id: string;
  concept: string;
  date: string;
  amount: string;
  percentage: string;
  paid: boolean;
  status: string;
}

export interface DocItem {
  name: string;
  uploaded: boolean;
  status: string;
}

const defaultDocs: DocItem[] = [
  { name: 'Contrato firmado', uploaded: false, status: 'pendiente' },
  { name: 'INE', uploaded: false, status: 'pendiente' },
  { name: 'Comprobante de domicilio', uploaded: false, status: 'pendiente' },
  { name: 'Constancia fiscal', uploaded: false, status: 'pendiente' },
  { name: 'CURP', uploaded: false, status: 'pendiente' },
  { name: 'Comprobante de apartado', uploaded: false, status: 'pendiente' },
];

export function getDefaultFormData(): AccountFormData {
  return {
    projectId: '', building: '', unitNumber: '', chargeType: '', sqMeters: '', level: '',
    description: '', listPrice: '', finalPrice: '', currency: 'MXN', purchaseDate: '', acquisitionMethod: '',
    legalEntityId: '', legalEntityRfc: '', legalEntityEmail: '', legalEntityPhone: '', legalEntityPersonType: '',
    buyerName: '', buyerRfc: '', buyerCurp: '', buyerEmail: '', buyerPhone: '', buyerPersonType: '',
    buyerFiscalAddress: '', buyerParticipation: '100', buyerDataComplete: false,
    clabe: '', bank: '', linkMethod: '', clabeRfc: '', bankValidation: '', bankNotes: '',
    paymentPlan: '', downPayment: '', monthlyPayments: '', deliveryPayment: '', paymentDay: '',
    firstDueDate: '', lastDueDate: '', frequency: 'mensual', installments: [],
    initialAmount: '', initialDate: '', initialOrigin: '', initialReference: '', initialNotes: '',
    generatePaymentRecord: true,
    escrituracionStatus: '', notary: '', estimatedEscrituracion: '', estimatedDelivery: '', escrituracionNotes: '',
    documents: [...defaultDocs],
    assignedExecutive: '',
  };
}

export function mapAccountToFormData(account: any): AccountFormData {
  return {
    projectId: account.projectId || '',
    building: account.building || '',
    unitNumber: account.unitNumber || '',
    chargeType: account.chargeType || '',
    sqMeters: '', level: '', description: '',
    listPrice: String(account.totalPrice || ''),
    finalPrice: String(account.totalPrice || ''),
    currency: 'MXN',
    purchaseDate: account.separationDate || '',
    acquisitionMethod: '',
    legalEntityId: account.legalEntity?.id || '',
    legalEntityRfc: account.legalEntity?.rfc || '',
    legalEntityEmail: '', legalEntityPhone: '', legalEntityPersonType: '',
    buyerName: account.client?.name || '',
    buyerRfc: account.client?.rfc || '',
    buyerCurp: '',
    buyerEmail: account.client?.email || '',
    buyerPhone: account.client?.phone || '',
    buyerPersonType: '', buyerFiscalAddress: '',
    buyerParticipation: '100',
    buyerDataComplete: account.documentationComplete || false,
    clabe: account.clabe || '',
    bank: '', linkMethod: '', clabeRfc: '', bankValidation: '', bankNotes: '',
    paymentPlan: `${account.totalInstallments} meses`,
    downPayment: '', monthlyPayments: String(account.totalInstallments || ''),
    deliveryPayment: '',
    paymentDay: String(account.paymentDay || ''),
    firstDueDate: '', lastDueDate: '',
    frequency: 'mensual',
    installments: [],
    initialAmount: '', initialDate: account.separationDate || '',
    initialOrigin: '', initialReference: '', initialNotes: '',
    generatePaymentRecord: false,
    escrituracionStatus: '', notary: '',
    estimatedEscrituracion: '', estimatedDelivery: account.estimatedDelivery || '',
    escrituracionNotes: '',
    documents: [...defaultDocs],
    assignedExecutive: account.assignedExecutive || '',
  };
}

interface AccountFormTabsProps {
  data: AccountFormData;
  onChange: (data: AccountFormData) => void;
  mode: 'create' | 'edit';
  criticalFields?: string[];
}

function Field({ label, required, critical, children }: { label: string; required?: boolean; critical?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className={cn('text-xs', critical && 'text-warning')}>
        {label} {required && <span className="text-danger">*</span>}
        {critical && <span className="ml-1 text-[10px] text-warning">(campo crítico)</span>}
      </Label>
      {children}
    </div>
  );
}

const inputCls = 'h-9 text-sm';

export function AccountFormTabs({ data, onChange, mode, criticalFields = [] }: AccountFormTabsProps) {
  const [activeTab, setActiveTab] = useState('propiedad');

  const set = (field: keyof AccountFormData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const isCritical = (field: string) => mode === 'edit' && criticalFields.includes(field);

  const selectedLE = mockLegalEntities.find(le => le.id === data.legalEntityId);

  const addInstallment = () => {
    const row: InstallmentRow = {
      id: `inst-${Date.now()}`,
      concept: `Parcialidad ${data.installments.length + 1}`,
      date: '',
      amount: '',
      percentage: '',
      paid: false,
      status: 'pendiente',
    };
    set('installments', [...data.installments, row]);
  };

  const updateInstallment = (idx: number, field: keyof InstallmentRow, value: any) => {
    const updated = [...data.installments];
    (updated[idx] as any)[field] = value;
    set('installments', updated);
  };

  const removeInstallment = (idx: number) => {
    set('installments', data.installments.filter((_, i) => i !== idx));
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full flex h-auto flex-wrap gap-0.5 bg-muted/50 p-1 rounded-lg">
        {[
          { v: 'propiedad', icon: Building2, l: 'Propiedad' },
          { v: 'vendedor', icon: Landmark, l: 'Entidad Legal' },
          { v: 'comprador', icon: User, l: 'Comprador' },
          { v: 'bancarios', icon: CreditCard, l: 'Datos Bancarios' },
          { v: 'pagos', icon: Receipt, l: 'Acuerdo de Pago' },
          { v: 'apartado', icon: CreditCard, l: 'Pago Inicial' },
          { v: 'escrituracion', icon: ScrollText, l: 'Escrituración' },
          { v: 'documentos', icon: FileText, l: 'Documentos' },
        ].map(tab => (
          <TabsTrigger key={tab.v} value={tab.v} className="text-[11px] px-2.5 py-1.5 gap-1.5 data-[state=active]:bg-background">
            <tab.icon className="w-3 h-3" strokeWidth={1.75} />{tab.l}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* TAB: Propiedad */}
      <TabsContent value="propiedad" className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Proyecto" required critical={isCritical('projectId')}>
            <Select value={data.projectId} onValueChange={v => set('projectId', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Edificio / Torre">
            <Input value={data.building} onChange={e => set('building', e.target.value)} className={inputCls} placeholder="Torre A" />
          </Field>
          <Field label="Unidad / Número" required>
            <Input value={data.unitNumber} onChange={e => set('unitNumber', e.target.value)} className={inputCls} placeholder="3A01" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Tipo de cobro" required critical={isCritical('chargeType')}>
            <Select value={data.chargeType} onValueChange={v => set('chargeType', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {(Object.keys(chargeTypeFullLabels) as ChargeType[]).map(k => (
                  <SelectItem key={k} value={k}>{chargeTypeFullLabels[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="m²">
            <Input value={data.sqMeters} onChange={e => set('sqMeters', e.target.value)} className={inputCls} placeholder="85.5" />
          </Field>
          <Field label="Nivel">
            <Input value={data.level} onChange={e => set('level', e.target.value)} className={inputCls} placeholder="3" />
          </Field>
        </div>
        <Field label="Descripción">
          <Textarea value={data.description} onChange={e => set('description', e.target.value)} rows={2} className="text-sm resize-none" />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Precio de lista" critical={isCritical('listPrice')}>
            <Input value={data.listPrice} onChange={e => set('listPrice', e.target.value)} className={cn(inputCls, 'font-mono')} placeholder="$0.00" />
          </Field>
          <Field label="Precio final" critical={isCritical('finalPrice')}>
            <Input value={data.finalPrice} onChange={e => set('finalPrice', e.target.value)} className={cn(inputCls, 'font-mono')} placeholder="$0.00" />
          </Field>
          <Field label="Moneda">
            <Select value={data.currency} onValueChange={v => set('currency', v)}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de compra / apartado" required critical={isCritical('purchaseDate')}>
            <Input type="date" value={data.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Forma de adquisición">
            <Select value={data.acquisitionMethod} onValueChange={v => set('acquisitionMethod', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contado">Contado</SelectItem>
                <SelectItem value="financiamiento">Financiamiento directo</SelectItem>
                <SelectItem value="credito">Crédito hipotecario</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </TabsContent>

      {/* TAB: Entidad Legal */}
      <TabsContent value="vendedor" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Entidad legal" required critical={isCritical('legalEntityId')}>
            <Select value={data.legalEntityId} onValueChange={v => {
              const le = mockLegalEntities.find(l => l.id === v);
              set('legalEntityId', v);
              if (le?.rfc) set('legalEntityRfc', le.rfc);
            }}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {mockLegalEntities.map(le => <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="RFC entidad">
            <Input value={data.legalEntityRfc} onChange={e => set('legalEntityRfc', e.target.value)} className={cn(inputCls, 'font-mono')} disabled={!!selectedLE} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <Input type="email" value={data.legalEntityEmail} onChange={e => set('legalEntityEmail', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Teléfono">
            <Input value={data.legalEntityPhone} onChange={e => set('legalEntityPhone', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Tipo de persona">
          <Select value={data.legalEntityPersonType} onValueChange={v => set('legalEntityPersonType', v)}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="moral">Persona moral</SelectItem>
              <SelectItem value="fisica">Persona física</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </TabsContent>

      {/* TAB: Comprador */}
      <TabsContent value="comprador" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre completo" required>
            <Input value={data.buyerName} onChange={e => set('buyerName', e.target.value)} className={inputCls} />
          </Field>
          <Field label="RFC" critical={isCritical('buyerRfc')}>
            <Input value={data.buyerRfc} onChange={e => set('buyerRfc', e.target.value)} className={cn(inputCls, 'font-mono uppercase')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CURP">
            <Input value={data.buyerCurp} onChange={e => set('buyerCurp', e.target.value)} className={cn(inputCls, 'font-mono uppercase')} maxLength={18} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={data.buyerEmail} onChange={e => set('buyerEmail', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Teléfono">
            <Input value={data.buyerPhone} onChange={e => set('buyerPhone', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Tipo de persona">
            <Select value={data.buyerPersonType} onValueChange={v => set('buyerPersonType', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fisica">Persona física</SelectItem>
                <SelectItem value="moral">Persona moral</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Domicilio fiscal">
          <Textarea value={data.buyerFiscalAddress} onChange={e => set('buyerFiscalAddress', e.target.value)} rows={2} className="text-sm resize-none" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="% Participación">
            <Input value={data.buyerParticipation} onChange={e => set('buyerParticipation', e.target.value)} className={cn(inputCls, 'font-mono')} />
          </Field>
          <div className="flex items-end pb-1">
            <div className="flex items-center gap-2">
              <Checkbox checked={data.buyerDataComplete} onCheckedChange={c => set('buyerDataComplete', !!c)} id="buyerComplete" />
              <Label htmlFor="buyerComplete" className="text-xs">Datos completos</Label>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* TAB: Datos Bancarios */}
      <TabsContent value="bancarios" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="CLABE interbancaria" critical={isCritical('clabe')}>
            <Input value={data.clabe} onChange={e => set('clabe', e.target.value)} className={cn(inputCls, 'font-mono')} maxLength={18} placeholder="646180..." />
          </Field>
          <Field label="Banco">
            <Input value={data.bank} onChange={e => set('bank', e.target.value)} className={inputCls} placeholder="STP, BBVA, etc." />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Método de vinculación">
            <Select value={data.linkMethod} onValueChange={v => set('linkMethod', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="automatica">Transferencia automática</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="pendiente">Pendiente de vinculación</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="RFC vinculado a CLABE">
            <Input value={data.clabeRfc} onChange={e => set('clabeRfc', e.target.value)} className={cn(inputCls, 'font-mono uppercase')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Estatus de validación bancaria">
            <Select value={data.bankValidation} onValueChange={v => set('bankValidation', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="validado">Validado</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
                <SelectItem value="no_aplica">No aplica</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Observaciones de conciliación">
          <Textarea value={data.bankNotes} onChange={e => set('bankNotes', e.target.value)} rows={2} className="text-sm resize-none" />
        </Field>
      </TabsContent>

      {/* TAB: Acuerdo de Pago */}
      <TabsContent value="pagos" className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Plan de pagos" required>
            <Input value={data.paymentPlan} onChange={e => set('paymentPlan', e.target.value)} className={inputCls} placeholder="48 meses" />
          </Field>
          <Field label="Enganche" critical={isCritical('downPayment')}>
            <Input value={data.downPayment} onChange={e => set('downPayment', e.target.value)} className={cn(inputCls, 'font-mono')} placeholder="$0.00" />
          </Field>
          <Field label="Mensualidades">
            <Input value={data.monthlyPayments} onChange={e => set('monthlyPayments', e.target.value)} className={cn(inputCls, 'font-mono')} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Entrega">
            <Input value={data.deliveryPayment} onChange={e => set('deliveryPayment', e.target.value)} className={cn(inputCls, 'font-mono')} placeholder="$0.00" />
          </Field>
          <Field label="Día de pago" required critical={isCritical('paymentDay')}>
            <Select value={data.paymentDay} onValueChange={v => set('paymentDay', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 25, 28].map(d => <SelectItem key={d} value={String(d)}>Día {d}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Frecuencia">
            <Select value={data.frequency} onValueChange={v => set('frequency', v)}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="quincenal">Quincenal</SelectItem>
                <SelectItem value="personalizada">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha primer vencimiento" required>
            <Input type="date" value={data.firstDueDate} onChange={e => set('firstDueDate', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Fecha último vencimiento">
            <Input type="date" value={data.lastDueDate} onChange={e => set('lastDueDate', e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Installments table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-foreground uppercase tracking-wider">Parcialidades</p>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={addInstallment}>
              <Plus className="w-3 h-3" /> Agregar
            </Button>
          </div>
          {data.installments.length === 0 ? (
            <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed border-border">
              <p className="text-[12px] text-muted-foreground">Sin parcialidades registradas</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Agregue parcialidades manualmente o se generarán al guardar</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Concepto</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Monto</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">%</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Pagado</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.installments.map((row, idx) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1"><Input value={row.concept} onChange={e => updateInstallment(idx, 'concept', e.target.value)} className="h-7 text-[11px] border-0 bg-transparent px-1" /></td>
                      <td className="px-2 py-1"><Input type="date" value={row.date} onChange={e => updateInstallment(idx, 'date', e.target.value)} className="h-7 text-[11px] border-0 bg-transparent px-1" /></td>
                      <td className="px-2 py-1"><Input value={row.amount} onChange={e => updateInstallment(idx, 'amount', e.target.value)} className="h-7 text-[11px] border-0 bg-transparent px-1 text-right font-mono" /></td>
                      <td className="px-2 py-1"><Input value={row.percentage} onChange={e => updateInstallment(idx, 'percentage', e.target.value)} className="h-7 text-[11px] border-0 bg-transparent px-1 text-center" /></td>
                      <td className="px-2 py-1 text-center"><Checkbox checked={row.paid} onCheckedChange={c => updateInstallment(idx, 'paid', !!c)} /></td>
                      <td className="px-1"><button onClick={() => removeInstallment(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>

      {/* TAB: Pago Inicial */}
      <TabsContent value="apartado" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Monto del apartado" required critical={isCritical('initialAmount')}>
            <Input value={data.initialAmount} onChange={e => set('initialAmount', e.target.value)} className={cn(inputCls, 'font-mono')} placeholder="$0.00" />
          </Field>
          <Field label="Fecha del pago" required>
            <Input type="date" value={data.initialDate} onChange={e => set('initialDate', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Origen del pago" required>
            <Select value={data.initialOrigin} onValueChange={v => set('initialOrigin', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {paymentOrigins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Referencia">
            <Input value={data.initialReference} onChange={e => set('initialReference', e.target.value)} className={cn(inputCls, 'font-mono')} />
          </Field>
        </div>
        <Field label="Observaciones">
          <Textarea value={data.initialNotes} onChange={e => set('initialNotes', e.target.value)} rows={2} className="text-sm resize-none" />
        </Field>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox checked={data.generatePaymentRecord} onCheckedChange={c => set('generatePaymentRecord', !!c)} id="genRecord" />
          <Label htmlFor="genRecord" className="text-xs">Generar asiento en Relación de Pagos</Label>
        </div>
        {data.initialOrigin === 'Efectivo' && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-[12px] text-warning font-medium">Pago en efectivo detectado</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">El pago manual quedará registrado en Relación de Pagos, Bitácora y conciliación correspondiente.</p>
          </div>
        )}
      </TabsContent>

      {/* TAB: Escrituración */}
      <TabsContent value="escrituracion" className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Estatus de escrituración">
            <Select value={data.escrituracionStatus} onValueChange={v => set('escrituracionStatus', v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_proceso">En proceso</SelectItem>
                <SelectItem value="lista">Lista para firma</SelectItem>
                <SelectItem value="firmada">Firmada</SelectItem>
                <SelectItem value="inscrita">Inscrita en RPP</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notario asignado">
            <Input value={data.notary} onChange={e => set('notary', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha estimada de escrituración">
            <Input type="date" value={data.estimatedEscrituracion} onChange={e => set('estimatedEscrituracion', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Fecha estimada de entrega">
            <Input type="date" value={data.estimatedDelivery} onChange={e => set('estimatedDelivery', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Observaciones">
          <Textarea value={data.escrituracionNotes} onChange={e => set('escrituracionNotes', e.target.value)} rows={3} className="text-sm resize-none" />
        </Field>
      </TabsContent>

      {/* TAB: Documentos */}
      <TabsContent value="documentos" className="mt-4 space-y-3">
        {data.documents.map((doc, idx) => (
          <div key={doc.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              <div>
                <p className="text-[13px] font-medium text-foreground">{doc.name}</p>
                <p className="text-[11px] text-muted-foreground">{doc.uploaded ? 'Cargado' : 'Pendiente'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {doc.uploaded ? (
                <span className="sozu-chip bg-success/10 text-success text-[10px]">Cargado</span>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1">
                  <Upload className="w-3 h-3" /> Subir
                </Button>
              )}
            </div>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
