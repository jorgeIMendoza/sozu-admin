import { useMemo, useState } from 'react';
import { useAmbassadors } from '@/store/AmbassadorsContext';
import {
  Ambassador, Advisor, AMBASSADOR_TYPE_LABEL, AmbassadorType, AmbassadorStatus,
  CommissionTrigger, CommissionStatus, COMMISSION_STATUS_LABEL,
  Referral, ReferralStatus, REFERRAL_STATUS_LABEL, InterestType,
  ProtectionStatus, PROTECTION_STATUS_LABEL, DOCUMENT_STATUS_LABEL, DocumentStatus,
  DEFAULT_PAYMENT_DOCS, AssignmentStatus, ASSIGNMENT_STATUS_LABEL,
  nextStepFor, protectionStatusFor, detectDuplicate,
} from '@/types/ambassadors';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Info, Plus, Download, Users, AlertTriangle, Check, X, FileText, Bell, UserPlus, ChevronsUpDown, Pencil, ShieldCheck, Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NuevoEmbajadorDialog from './NuevoEmbajadorDialog';
import { AmbassadorDocsVerifyDialog } from './AmbassadorDocsVerifyDialog';

const PROT_TONE: Record<ProtectionStatus, string> = {
  protegido: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  pendiente: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  duplicado_revision: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  no_valido: 'bg-destructive/10 text-destructive border-destructive/30',
};
const DOC_TONE: Record<DocumentStatus, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  en_revision: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  aprobado: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  rechazado: 'bg-destructive/10 text-destructive border-destructive/30',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

const dateShort = (iso: string) => new Date(iso).toLocaleDateString('es-MX');

function StatusBadge({ status }: { status: ReferralStatus }) {
  const tone =
    status === 'venta_cerrada' || status === 'comision_pagada' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
    status === 'duplicado' || status === 'descartado' ? 'bg-muted text-muted-foreground' :
    status === 'apartado' || status === 'promesa_firmada' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
    'bg-amber-500/10 text-amber-700 border-amber-500/30';
  return <Badge variant="outline" className={tone}>{REFERRAL_STATUS_LABEL[status]}</Badge>;
}

function CommBadge({ status }: { status: CommissionStatus }) {
  const tone =
    status === 'pagada' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
    status === 'autorizada' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
    status === 'generada' ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' :
    status === 'cancelada' ? 'bg-destructive/10 text-destructive border-destructive/30' :
    'bg-muted text-muted-foreground';
  return <Badge variant="outline" className={tone}>{COMMISSION_STATUS_LABEL[status]}</Badge>;
}

const REFERRAL_STATUSES: ReferralStatus[] = [
  'registrado','validado','contactado','cita_agendada','cita_realizada','en_seguimiento',
  'apartado','promesa_firmada','venta_cerrada','comision_generada','comision_pagada','descartado','duplicado',
];

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// =============== Ambassador edit sheet (solo edición) ===============
function AmbassadorEditSheet({
  open, onOpenChange, ambassador,
}: { open: boolean; onOpenChange: (b: boolean) => void; ambassador: Ambassador }) {
  const { updateAmbassador, refresh } = useAmbassadors();
  const [form, setForm] = useState<Partial<Ambassador>>(ambassador);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Ambassador, v: any) => setForm(p => ({ ...p, [k]: v }));

  const emailInvalid = (form.email ?? '').trim().length > 0 && !EMAIL_REGEX.test((form.email ?? '').trim());
  const phoneInvalid = (form.phone ?? '').length > 0 && (form.phone ?? '').length !== 10;

  const submit = async () => {
    const newEmail = (form.email ?? '').trim().toLowerCase();
    const newPhone = (form.phone ?? '').trim();
    const newName = (form.fullName ?? '').trim();

    if (!newName || !newEmail || !newPhone) {
      toast.error('Nombre, teléfono y email son obligatorios');
      return;
    }
    if (!EMAIL_REGEX.test(newEmail)) {
      toast.error('El correo no tiene un formato válido');
      return;
    }
    if (newPhone.length !== 10) {
      toast.error('El teléfono debe tener exactamente 10 dígitos');
      return;
    }

    setSaving(true);
    try {
      // 1. Actualizar embajadores_config (estatus, tipo, comisión, etc.)
      updateAmbassador(ambassador.id, form);

      // 2. Actualizar persona (nombre, teléfono, clave_pais)
      if (ambassador.idPersona) {
        const { error: personaError } = await supabase
          .from('personas')
          .update({
            nombre_legal: newName,
            telefono: newPhone,
            clave_pais_telefono: form.clavePaisTelefono ?? 'MX',
          })
          .eq('id', ambassador.idPersona);
        if (personaError) throw personaError;
      }

      // 3. Actualizar usuarios (nombre, telefono, clave_pais) por email actual
      await supabase
        .from('usuarios')
        .update({
          nombre: newName,
          telefono: newPhone,
          clave_pais_telefono: form.clavePaisTelefono ?? 'MX',
        })
        .eq('email', ambassador.email.toLowerCase());

      // 4. Si cambió el email → edge function update-user-email + personas.email
      if (newEmail !== ambassador.email.toLowerCase()) {
        const { data: updateResult, error: emailErr } = await supabase.functions.invoke('update-user-email', {
          body: { oldEmail: ambassador.email.toLowerCase(), newEmail },
        });
        if (emailErr || (updateResult && updateResult.success === false)) {
          throw new Error(emailErr?.message ?? updateResult?.message ?? 'Error al cambiar el correo');
        }
        if (ambassador.idPersona) {
          await supabase.from('personas').update({ email: newEmail }).eq('id', ambassador.idPersona);
        }
      }

      toast.success('Embajador actualizado');
      await refresh();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error al actualizar embajador:', err);
      toast.error(err?.message ?? 'Error al actualizar embajador');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar embajador</SheetTitle>
          <SheetDescription>{ambassador.code}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          <div><Label>Nombre completo *</Label>
            <Input value={form.fullName ?? ''} onChange={e => set('fullName', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teléfono *</Label>
              <div className="flex gap-2">
                <Select value={form.clavePaisTelefono ?? 'MX'} onValueChange={v => set('clavePaisTelefono', v)}>
                  <SelectTrigger className="w-[110px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MX">🇲🇽 +52</SelectItem>
                    <SelectItem value="US">🇺🇸 +1</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone ?? ''}
                  onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10 dígitos"
                  className={phoneInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
              </div>
              {phoneInvalid && <p className="text-xs text-destructive mt-1">Debe tener 10 dígitos</p>}
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={e => set('email', e.target.value)}
                className={emailInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {emailInvalid && <p className="text-xs text-destructive mt-1">Formato de correo no válido</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AMBASSADOR_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Estatus</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pendiente">Pendiente de validación</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Empresa / origen</Label><Input value={form.company ?? ''} onChange={e => set('company', e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>% Comisión</Label><Input type="number" step="0.1" value={form.commissionPct ?? 0} onChange={e => set('commissionPct', Number(e.target.value))} /></div>
            <div><Label>Monto fijo</Label><Input type="number" value={form.fixedAmount ?? ''} onChange={e => set('fixedAmount', e.target.value ? Number(e.target.value) : undefined)} /></div>
            <div><Label>Trigger</Label>
              <Select value={form.commissionTrigger} onValueChange={v => set('commissionTrigger', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartado">Al apartado</SelectItem>
                  <SelectItem value="promesa">Promesa</SelectItem>
                  <SelectItem value="enganche">Enganche</SelectItem>
                  <SelectItem value="escrituracion">Escrituración</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Días de protección</Label><Input type="number" value={form.protectionDays ?? 90} onChange={e => set('protectionDays', Number(e.target.value))} /></div>
          <div><Label>Notas internas</Label><Textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} /></div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving || emailInvalid || phoneInvalid}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =============== Combobox de asesor con búsqueda y top-10 ===============
function AdvisorCombobox({
  value, onChange, advisors,
}: { value: string; onChange: (v: string) => void; advisors: Advisor[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = advisors.find(a => a.id === value);
  const sorted = [...advisors].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const filtered = query.trim()
    ? sorted.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase()))
    : sorted;
  const visible = filtered.slice(0, 10);
  const hiddenCount = filtered.length - visible.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected
            ? <span className="truncate">{selected.name}</span>
            : <span className="text-muted-foreground">Sin asignar (se puede asignar después)</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar asesor..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No se encontraron asesores.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onChange(''); setOpen(false); }}
                className="text-muted-foreground"
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                — Sin asignar —
              </CommandItem>
              {visible.map(a => (
                <CommandItem
                  key={a.id}
                  value={a.name}
                  onSelect={() => { onChange(a.id); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === a.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span className="text-sm">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.email}</span>
                  </div>
                </CommandItem>
              ))}
              {hiddenCount > 0 && (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
                  +{hiddenCount} más. Escribe para filtrar.
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// =============== Referral form dialog (Supabase) ===============
export function ReferralFormDialog({
  open, onOpenChange, defaultAmbassadorId, hideAdvisor,
}: { open: boolean; onOpenChange: (b: boolean) => void; defaultAmbassadorId?: string; hideAdvisor?: boolean }) {
  const { ambassadors, advisors, referrals, refresh } = useAmbassadors();
  const [form, setForm] = useState<any>({
    ambassadorId: defaultAmbassadorId ?? ambassadors[0]?.id ?? '',
    interestType: 'indefinido', consent: true, advisorId: '',
    clavePaisTelefono: 'MX', phone: '',
  });
  const [duplicate, setDuplicate] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const emailInvalid = (form.email ?? '').trim().length > 0 && !EMAIL_REGEX.test((form.email ?? '').trim());
  const phoneInvalid = (form.phone ?? '').length > 0 && (form.phone ?? '').length !== 10;

  const submit = async (force = false) => {
    if (!form.ambassadorId || !form.clientName || !form.phone || !form.email) {
      toast.error('Completa nombre, teléfono y email'); return;
    }
    if (!EMAIL_REGEX.test((form.email ?? '').trim())) {
      toast.error('El correo no tiene un formato válido'); return;
    }
    if ((form.phone ?? '').length !== 10) {
      toast.error('El teléfono debe tener exactamente 10 dígitos'); return;
    }

    if (!force) {
      const dup = detectDuplicate(referrals, { clientName: form.clientName, phone: form.phone, email: form.email });
      if (dup) { setDuplicate(dup); return; }
    }

    setLoading(true);
    try {
      // Obtener tipo_entidad "Prospecto"
      const { data: tipoData } = await supabase
        .from('tipos_entidad')
        .select('id')
        .eq('nombre', 'Prospecto')
        .maybeSingle();

      const tipoProspectoId = tipoData?.id ?? 7;

      // Embajador y asesor seleccionados
      const emb = ambassadors.find(a => a.id === form.ambassadorId);
      const adv = form.advisorId ? advisors.find(a => a.id === form.advisorId) : null;

      const emailNorm = form.email.trim().toLowerCase();

      // Reusar persona existente si el email ya está registrado (evita violar personas_email_key)
      const { data: personaExistente } = await supabase
        .from('personas')
        .select('id')
        .eq('email', emailNorm)
        .maybeSingle();

      let persona: { id: number } | null = personaExistente ?? null;

      if (!persona) {
        // Crear persona del cliente
        const { data: nuevaPersona, error: personaError } = await supabase
          .from('personas')
          .insert({
            nombre_legal: form.clientName.trim(),
            email: emailNorm,
            telefono: form.phone.trim(),
            clave_pais_telefono: form.clavePaisTelefono ?? 'MX',
            tipo_persona: 'pf',
            activo: true,
          })
          .select('id')
          .single();
        if (personaError || !nuevaPersona) throw personaError ?? new Error('Error al crear persona');
        persona = nuevaPersona;
      }

      // Crear entidad_relacionada tipo Prospecto (id_persona_duena_lead = embajador)
      const { data: erData, error: erError } = await supabase
        .from('entidades_relacionadas')
        .insert({
          id_persona: persona.id,
          id_tipo_entidad: tipoProspectoId,
          id_persona_duena_lead: emb?.idPersona ?? null,
          activo: true,
        })
        .select('id')
        .single();
      if (erError || !erData) throw erError ?? new Error('Error al crear entidad_relacionada');

      // Crear referido en bridge table
      const { error: refError } = await supabase.from('embajadores_referidos').insert({
        id_entidad_relacionada: erData.id,
        id_entidad_relacionada_emb: Number(form.ambassadorId),
        id_persona_embajador: emb?.idPersona ?? 0,
        tipo_interes: form.interestType,
        producto_interes: form.productInterest || null,
        relacion_embajador: form.relationship || null,
        comentarios: form.comments || null,
        consentimiento: form.consent ?? true,
        id_asesor_asignado: adv?.id || null,
        id_persona_asesor: adv?.idPersona ?? null,
        nombre_asesor: adv?.name || null,
        rol_asesor: adv?.role || null,
        telefono_asesor: adv?.phone || null,
        email_asesor: adv?.email || null,
        estatus_asignacion: adv ? 'asignado' : 'sin_asignar',
        fecha_asignacion: adv ? new Date().toISOString() : null,
        audit_trail: [{ timestamp: new Date().toISOString(), actor: 'admin', type: 'creado' }],
      });
      if (refError) throw refError;

      toast.success('Referido registrado');
      setForm({ ambassadorId: defaultAmbassadorId ?? ambassadors[0]?.id ?? '', interestType: 'indefinido', consent: true, advisorId: '', clavePaisTelefono: 'MX', phone: '' });
      setDuplicate(null);
      await refresh();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? 'Error al registrar referido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar cliente referido</DialogTitle>
          <DialogDescription>El equipo SOZU dará seguimiento comercial al referido.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!defaultAmbassadorId && (
            <div><Label>Embajador</Label>
              <Select value={form.ambassadorId} onValueChange={v => set('ambassadorId', v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona embajador" /></SelectTrigger>
                <SelectContent>{ambassadors.map(a => <SelectItem key={a.id} value={a.id}>{a.fullName} ({a.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Nombre del cliente *</Label><Input value={form.clientName ?? ''} onChange={e => set('clientName', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teléfono *</Label>
              <div className="flex gap-2">
                <Select value={form.clavePaisTelefono ?? 'MX'} onValueChange={v => set('clavePaisTelefono', v)}>
                  <SelectTrigger className="w-[110px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MX">🇲🇽 +52</SelectItem>
                    <SelectItem value="US">🇺🇸 +1</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone ?? ''}
                  onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10 dígitos"
                  className={phoneInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
              </div>
              {phoneInvalid && <p className="text-xs text-destructive mt-1">Debe tener 10 dígitos</p>}
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={e => set('email', e.target.value)}
                className={emailInvalid ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {emailInvalid && <p className="text-xs text-destructive mt-1">Formato de correo no válido</p>}
            </div>
          </div>
          <div><Label>Relación con el embajador</Label><Input value={form.relationship ?? ''} onChange={e => set('relationship', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Interés</Label>
              <Select value={form.interestType} onValueChange={v => set('interestType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vivir">Vivir</SelectItem>
                  <SelectItem value="inversion">Inversión</SelectItem>
                  <SelectItem value="patrimonial">Patrimonial</SelectItem>
                  <SelectItem value="indefinido">No definido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Producto</Label>
              <Select value={form.productInterest ?? ''} onValueChange={v => set('productInterest', v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2 recámaras">2 recámaras</SelectItem>
                  <SelectItem value="3 recámaras">3 recámaras</SelectItem>
                  <SelectItem value="Residencia grande">Residencia grande</SelectItem>
                  <SelectItem value="No definido">No definido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {!hideAdvisor && (
            <div><Label>Asesor SOZU asignado</Label>
              <AdvisorCombobox
                value={form.advisorId ?? ''}
                onChange={v => set('advisorId', v)}
                advisors={advisors.filter(a => a.active)}
              />
            </div>
          )}
          <div><Label>Comentarios</Label><Textarea value={form.comments ?? ''} onChange={e => set('comments', e.target.value)} /></div>

          {duplicate && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" /> Posible cliente duplicado
              </div>
              <p className="text-muted-foreground mt-1">
                Coincide con: <strong>{duplicate.clientName}</strong> · {duplicate.phone} · {dateShort(duplicate.registeredAt)}
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setDuplicate(null)}>Cancelar</Button>
                <Button size="sm" onClick={() => submit(true)}>Registrar de todos modos</Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={() => submit(false)} disabled={!!duplicate || loading || emailInvalid || phoneInvalid}>
            {loading ? 'Registrando...' : 'Registrar referido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============== Referral detail sheet ===============
function ReferralDetailSheet({
  referralId, onOpenChange,
}: { referralId: string | null; onOpenChange: (id: string | null) => void }) {
  const {
    referrals, ambassadors, advisors, updateReferralStatus, validateReferral,
    markDuplicate, assignAdvisor, setAssignmentStatus, addInternalNote, setSaleAmount, setCommissionStatus,
    setPublicComments, setNextStep, setProtectionStatus, setEstimatedPaymentDate, setDocumentStatus,
  } = useAmbassadors();
  const ref = referrals.find(r => r.id === referralId) ?? null;
  const amb = ref ? ambassadors.find(a => a.id === ref.ambassadorId) : null;
  const [note, setNote] = useState('');
  const [sale, setSale] = useState('');
  const [nextStepDraft, setNextStepDraft] = useState('');
  const [publicDraft, setPublicDraft] = useState('');
  const [estPayDraft, setEstPayDraft] = useState('');

  if (!ref) return <Sheet open={false} onOpenChange={() => onOpenChange(null)}><SheetContent /></Sheet>;

  const activeAdvisors = advisors.filter(a => a.active);
  const assignmentHistory = ref.auditTrail.filter(e =>
    ['asesor_asignado','asesor_reasignado','asesor_removido'].includes(e.type) || e.type.startsWith('assignment:'),
  );

  return (
    <Sheet open={!!ref} onOpenChange={o => !o && onOpenChange(null)}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{ref.clientName}</SheetTitle>
          <SheetDescription>
            Embajador: {amb?.fullName} ({amb?.code}) · Registrado {dateShort(ref.registeredAt)}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Teléfono:</span> {ref.phone}</div>
            <div><span className="text-muted-foreground">Email:</span> {ref.email}</div>
            <div><span className="text-muted-foreground">Interés:</span> {ref.interestType}</div>
            <div><span className="text-muted-foreground">Producto:</span> {ref.productInterest ?? '—'}</div>
          </div>

          <div>
            <Label>Estatus interno</Label>
            <Select value={ref.status} onValueChange={v => updateReferralStatus(ref.id, v as ReferralStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REFERRAL_STATUSES.map(s => <SelectItem key={s} value={s}>{REFERRAL_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => validateReferral(ref.id)}><Check className="h-3 w-3 mr-1" />Validar</Button>
              <Button size="sm" variant="outline" onClick={() => markDuplicate(ref.id)}><X className="h-3 w-3 mr-1" />Marcar duplicado</Button>
            </div>
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Asignación de asesor</Label>
              <Badge variant="outline">{ASSIGNMENT_STATUS_LABEL[ref.assignmentStatus ?? 'sin_asignar']}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Asesor asignado</Label>
                <Select
                  value={ref.assignedAdvisorId ?? 'none'}
                  onValueChange={v => {
                    assignAdvisor(ref.id, v === 'none' ? null : v);
                    toast.success(v === 'none' ? 'Asignación removida' : 'Asesor asignado');
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona asesor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Quitar asignación —</SelectItem>
                    {activeAdvisors.map(a => <SelectItem key={a.id} value={a.id}>{a.name} · {a.role}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estatus de seguimiento</Label>
                <Select value={ref.assignmentStatus ?? 'sin_asignar'} onValueChange={v => setAssignmentStatus(ref.id, v as AssignmentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ASSIGNMENT_STATUS_LABEL) as AssignmentStatus[]).map(k => (
                      <SelectItem key={k} value={k}>{ASSIGNMENT_STATUS_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {ref.assignedAdvisorName && (
              <div className="text-xs text-muted-foreground">
                <strong>{ref.assignedAdvisorName}</strong> ({ref.assignedAdvisorRole}) · {ref.assignedAdvisorPhone} · {ref.assignedAdvisorEmail}
                {ref.assignedAt && <> · Asignado {dateShort(ref.assignedAt)}</>}
              </div>
            )}
            {assignmentHistory.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Historial</div>
                <ul className="text-xs space-y-0.5 max-h-32 overflow-auto">
                  {assignmentHistory.slice().reverse().map((e, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-mono">{new Date(e.timestamp).toLocaleString('es-MX')}</span> · {e.type}{e.details ? ` · ${e.details}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <Label>Monto de venta</Label>
            <div className="flex gap-2">
              <Input type="number" value={sale || ref.saleAmount || ''} onChange={e => setSale(e.target.value)} />
              <Button size="sm" onClick={() => { if (sale) { setSaleAmount(ref.id, Number(sale)); toast.success('Monto actualizado'); setSale(''); } }}>Guardar</Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="text-muted-foreground">Comisión calculada</div>
                <div className="text-lg font-semibold">{fmt(ref.commissionAmount)}</div>
              </div>
              <CommBadge status={ref.commissionStatus} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => setCommissionStatus(ref.id, 'generada')}>Generar</Button>
              <Button size="sm" variant="outline" onClick={() => setCommissionStatus(ref.id, 'autorizada')}>Autorizar</Button>
              <Button size="sm" onClick={() => setCommissionStatus(ref.id, 'pagada')}>Marcar pagada</Button>
              <Button size="sm" variant="outline" onClick={() => setCommissionStatus(ref.id, 'cancelada')}>Cancelar</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Próximo paso (visible al embajador)</Label>
              <div className="flex gap-2">
                <Input
                  value={nextStepDraft || ref.nextStepOverride || nextStepFor(ref.status)}
                  onChange={e => setNextStepDraft(e.target.value)}
                  placeholder={nextStepFor(ref.status)}
                />
                <Button size="sm" onClick={() => { if (nextStepDraft) { setNextStep(ref.id, nextStepDraft); toast.success('Guardado'); setNextStepDraft(''); } }}>Guardar</Button>
              </div>
            </div>
            <div>
              <Label>Protección del referido</Label>
              <Select value={protectionStatusFor(ref)} onValueChange={v => { setProtectionStatus(ref.id, v as ProtectionStatus); toast.success('Actualizado'); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROTECTION_STATUS_LABEL) as ProtectionStatus[]).map(k => (
                    <SelectItem key={k} value={k}>{PROTECTION_STATUS_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-1">
                <Badge variant="outline" className={PROT_TONE[protectionStatusFor(ref)]}>
                  {PROTECTION_STATUS_LABEL[protectionStatusFor(ref)]}
                </Badge>
              </div>
            </div>
            <div>
              <Label>Fecha estimada de pago</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={estPayDraft || (ref.estimatedPaymentDate ? ref.estimatedPaymentDate.slice(0, 10) : '')}
                  onChange={e => setEstPayDraft(e.target.value)}
                />
                <Button size="sm" onClick={() => { if (estPayDraft) { setEstimatedPaymentDate(ref.id, new Date(estPayDraft).toISOString()); toast.success('Guardado'); setEstPayDraft(''); } }}>Guardar</Button>
              </div>
            </div>
            <div>
              <Label>Comentarios visibles al embajador</Label>
              <div className="flex gap-2">
                <Textarea
                  className="min-h-16"
                  value={publicDraft || ref.publicComments || ''}
                  onChange={e => setPublicDraft(e.target.value)}
                />
                <Button size="sm" onClick={() => { setPublicComments(ref.id, publicDraft); toast.success('Actualizado'); setPublicDraft(''); }}>Guardar</Button>
              </div>
            </div>
          </div>

          {amb && (
            <div>
              <Label className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Documentación del embajador</Label>
              <div className="mt-2 space-y-2">
                {(amb.paymentDocs ?? DEFAULT_PAYMENT_DOCS).map(d => (
                  <div key={d.key} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-sm">
                    <div className="flex-1">
                      <div>{d.label}</div>
                      {d.fileName && <div className="text-[10px] text-muted-foreground font-mono">{d.fileName}</div>}
                    </div>
                    <Badge variant="outline" className={DOC_TONE[d.status]}>{DOCUMENT_STATUS_LABEL[d.status]}</Badge>
                    <Select value={d.status} onValueChange={v => setDocumentStatus(amb.id, d.key, v as DocumentStatus)}>
                      <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(DOCUMENT_STATUS_LABEL) as DocumentStatus[]).map(k => (
                          <SelectItem key={k} value={k}>{DOCUMENT_STATUS_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Notas internas</Label>
            <div className="flex gap-2">
              <Textarea value={note} onChange={e => setNote(e.target.value)} className="min-h-16" />
              <Button size="sm" onClick={() => { if (note) { addInternalNote(ref.id, note); setNote(''); toast.success('Nota agregada'); } }}>Agregar</Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {ref.internalNotes.map((n, i) => <li key={i} className="rounded bg-muted/40 px-2 py-1">{n}</li>)}
            </ul>
          </div>

          <div>
            <Label>Auditoría</Label>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {ref.auditTrail.slice().reverse().map((e, i) => (
                <li key={i}>
                  <span className="font-mono">{new Date(e.timestamp).toLocaleString('es-MX')}</span> · {e.actor} · {e.type}{e.details ? ` · ${e.details}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =============== KPI ===============
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

// =============== Advisors manager ===============
function AdvisorsManager() {
  const { advisors, updateAdvisor } = useAmbassadors();

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Asesores internos SOZU</h3>
          <span className="text-xs text-muted-foreground">Los asesores se gestionan desde Gestión de Usuarios.</span>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nombre</TableHead><TableHead>Rol</TableHead><TableHead>Teléfono</TableHead>
            <TableHead>Email</TableHead><TableHead>Disponible</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {advisors.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay asesores con roles internos activos.
                </TableCell>
              </TableRow>
            )}
            {advisors.map(a => (
              <TableRow key={a.id}>
                <TableCell>{a.name}</TableCell>
                <TableCell className="text-xs">{a.role}</TableCell>
                <TableCell className="text-xs">{a.phone ?? '—'}</TableCell>
                <TableCell className="text-xs">{a.email ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={a.active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-muted'}>
                    {a.active ? 'Disponible' : 'No disponible'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => updateAdvisor(a.id, { active: !a.active })}>
                    {a.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// =============== Main admin tab ===============
export default function AmbassadorsAdminTab() {
  const {
    ambassadors, referrals, advisors, advisorNotifications, settings,
    assignAdvisor, markAdvisorNotifRead, loading, refresh,
  } = useAmbassadors();

  const [showNuevoEmb, setShowNuevoEmb] = useState(false);
  const [showEditEmb, setShowEditEmb] = useState(false);
  const [editingAmb, setEditingAmb] = useState<Ambassador | null>(null);
  const [showVerifyDocs, setShowVerifyDocs] = useState(false);
  const [verifyAmb, setVerifyAmb] = useState<Ambassador | null>(null);
  const [showRefForm, setShowRefForm] = useState(false);
  const [openRefId, setOpenRefId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const active = ambassadors.filter(a => a.status === 'activo').length;
    const sales = referrals.filter(r => ['venta_cerrada','comision_generada','comision_pagada'].includes(r.status)).length;
    const conv = referrals.length ? (sales / referrals.length) * 100 : 0;
    const potential = referrals.filter(r => r.commissionStatus === 'potencial' || r.commissionStatus === 'generada').reduce((s, r) => s + r.commissionAmount, 0);
    const authorized = referrals.filter(r => r.commissionStatus === 'autorizada').reduce((s, r) => s + r.commissionAmount, 0);
    const paid = referrals.filter(r => r.commissionStatus === 'pagada').reduce((s, r) => s + r.commissionAmount, 0);
    return { active, total: referrals.length, sales, conv, potential, authorized, paid };
  }, [ambassadors, referrals]);

  const ranking = useMemo(() => {
    return ambassadors.map(a => {
      const refs = referrals.filter(r => r.ambassadorId === a.id);
      const valid = refs.filter(r => r.status !== 'duplicado' && r.status !== 'descartado').length;
      const sales = refs.filter(r => ['venta_cerrada','comision_generada','comision_pagada'].includes(r.status)).length;
      const amount = refs.reduce((s, r) => s + (r.saleAmount ?? 0), 0);
      const commGen = refs.filter(r => r.commissionStatus !== 'potencial' && r.commissionStatus !== 'cancelada').reduce((s, r) => s + r.commissionAmount, 0);
      const commPaid = refs.filter(r => r.commissionStatus === 'pagada').reduce((s, r) => s + r.commissionAmount, 0);
      const conv = refs.length ? (sales / refs.length) * 100 : 0;
      return { a, refs: refs.length, valid, sales, amount, commGen, commPaid, conv };
    }).sort((x, y) => y.commGen - x.commGen);
  }, [ambassadors, referrals]);

  const exportCsv = () => {
    const rows = [
      ['Embajador','Código','Referidos','Válidos','Ventas','Monto','Comisión generada','Comisión pagada','Conversión %'],
      ...ranking.map(r => [r.a.fullName, r.a.code, r.refs, r.valid, r.sales, r.amount, r.commGen, r.commPaid, r.conv.toFixed(1)]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'embajadores-reporte.csv'; a.click();
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Embajadores</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              Los embajadores únicamente refieren clientes. No participan en negociación ni cierre. El seguimiento comercial es del equipo interno SOZU.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNuevoEmb(true)}>
              <Users className="h-4 w-4 mr-1" /> Nuevo embajador
            </Button>
            <Button onClick={() => setShowRefForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Registrar referido
            </Button>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground">Cargando datos...</div>
        )}

        {/* Alertas operativas */}
        {!loading && (() => {
          const now = Date.now();
          const unassigned = referrals.filter(r =>
            !r.assignedAdvisorId &&
            !['descartado','duplicado'].includes(r.status) &&
            (now - new Date(r.registeredAt).getTime()) / 3600000 > settings.unassignedAlertHours,
          );
          const stale = referrals.filter(r => {
            if (!r.assignedAdvisorId) return false;
            const last = r.lastAdvisorUpdate ?? r.assignedAt;
            if (!last) return false;
            return (now - new Date(last).getTime()) / 86400000 > settings.noUpdateAlertDays;
          });
          const reassigned = referrals.filter(r => r.assignmentStatus === 'reasignado');
          if (!unassigned.length && !stale.length && !reassigned.length) return null;
          return (
            <Card className="p-4 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-2">
                <AlertTriangle className="h-4 w-4" /> Alertas operativas
              </div>
              <div className="grid md:grid-cols-3 gap-3 text-xs">
                {unassigned.length > 0 && (
                  <div className="rounded border border-border bg-card p-3">
                    <div className="font-semibold">{unassigned.length} referido(s) sin asesor</div>
                    <div className="text-muted-foreground">Más de {settings.unassignedAlertHours}h sin asignación.</div>
                    <ul className="mt-1">{unassigned.slice(0,3).map(r => <li key={r.id}><button className="underline" onClick={() => setOpenRefId(r.id)}>{r.clientName}</button></li>)}</ul>
                  </div>
                )}
                {stale.length > 0 && (
                  <div className="rounded border border-border bg-card p-3">
                    <div className="font-semibold">{stale.length} referido(s) sin seguimiento</div>
                    <div className="text-muted-foreground">Sin actualización en {settings.noUpdateAlertDays}+ días.</div>
                    <ul className="mt-1">{stale.slice(0,3).map(r => <li key={r.id}><button className="underline" onClick={() => setOpenRefId(r.id)}>{r.clientName}</button></li>)}</ul>
                  </div>
                )}
                {reassigned.length > 0 && (
                  <div className="rounded border border-border bg-card p-3">
                    <div className="font-semibold">{reassigned.length} referido(s) reasignado(s)</div>
                    <div className="text-muted-foreground">Cambio reciente de asesor responsable.</div>
                  </div>
                )}
              </div>
            </Card>
          );
        })()}

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="ambassadors">Embajadores</TabsTrigger>
            <TabsTrigger value="referrals">Referidos</TabsTrigger>
            <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
            <TabsTrigger value="advisors">Asesores</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="commissions">Comisiones</TabsTrigger>
            <TabsTrigger value="reports">Reportes</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Embajadores activos" value={String(stats.active)} sub={`${ambassadors.length} totales`} />
              <Kpi label="Referidos totales" value={String(stats.total)} sub={`${stats.sales} con venta`} />
              <Kpi label="Conversión" value={`${stats.conv.toFixed(1)}%`} />
              <Kpi label="Comisión en curso" value={fmt(stats.potential)} sub="No visible al embajador" />
              <Kpi label="Comisión autorizada" value={fmt(stats.authorized)} />
              <Kpi label="Comisión pagada" value={fmt(stats.paid)} />
            </div>
            <Card className="p-4">
              <h3 className="font-medium mb-3">Ranking de embajadores</h3>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Embajador</TableHead><TableHead>Referidos</TableHead><TableHead>Ventas</TableHead>
                  <TableHead>Monto</TableHead><TableHead>Comisión</TableHead><TableHead>Conv.</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ranking.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin datos</TableCell></TableRow>}
                  {ranking.map(r => (
                    <TableRow key={r.a.id}>
                      <TableCell>{r.a.fullName} <span className="text-muted-foreground text-xs">({r.a.code})</span></TableCell>
                      <TableCell>{r.refs}</TableCell>
                      <TableCell>{r.sales}</TableCell>
                      <TableCell>{fmt(r.amount)}</TableCell>
                      <TableCell>{fmt(r.commGen)}</TableCell>
                      <TableCell>{r.conv.toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="ambassadors">
            <Card className="p-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Estatus</TableHead><TableHead>Comisión</TableHead><TableHead>Trigger</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ambassadors.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin embajadores registrados</TableCell></TableRow>}
                  {ambassadors.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.code}</TableCell>
                      <TableCell>
                        <div>{a.fullName}</div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {a.email && (
                            <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{a.email}</span>
                          )}
                          {a.phone && (
                            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{a.phone}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{AMBASSADOR_TYPE_LABEL[a.type]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          a.status === 'activo' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                          a.status === 'pendiente' ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' :
                          'bg-muted text-muted-foreground'
                        }>{a.status}</Badge>
                      </TableCell>
                      <TableCell>{a.commissionPct}%{a.fixedAmount ? ` + ${fmt(a.fixedAmount)}` : ''}</TableCell>
                      <TableCell className="text-xs">{a.commissionTrigger}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => { setEditingAmb(a); setShowEditEmb(true); }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => { setVerifyAmb(a); setShowVerifyDocs(true); }}
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Verificar documentos</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card className="p-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Cliente</TableHead><TableHead>Embajador</TableHead><TableHead>Fecha</TableHead>
                  <TableHead>Estatus</TableHead><TableHead>Asesor</TableHead><TableHead>Comisión</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {referrals.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin referidos registrados</TableCell></TableRow>}
                  {referrals.map(r => {
                    const amb = ambassadors.find(a => a.id === r.ambassadorId);
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenRefId(r.id)}>
                        <TableCell>
                          <div>{r.clientName}</div>
                          <div className="text-xs text-muted-foreground">{r.email} · {r.phone}</div>
                        </TableCell>
                        <TableCell className="text-xs">{amb?.fullName} <span className="text-muted-foreground">({amb?.code})</span></TableCell>
                        <TableCell className="text-xs">{dateShort(r.registeredAt)}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-xs">{r.assignedAdvisorName ?? '—'}</TableCell>
                        <TableCell>
                          <div>{fmt(r.commissionAmount)}</div>
                          <CommBadge status={r.commissionStatus} />
                        </TableCell>
                        <TableCell><Button size="sm" variant="ghost">Detalle</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-3">
                Pipeline interno completo. Haz clic en cualquier referido para ver el detalle.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {REFERRAL_STATUSES.map(st => {
                  const items = referrals.filter(r => r.status === st);
                  return (
                    <div key={st} className="rounded-md border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide">{REFERRAL_STATUS_LABEL[st]}</span>
                        <Badge variant="outline">{items.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {items.length === 0 && <p className="text-[11px] text-muted-foreground italic">Vacío</p>}
                        {items.map(r => {
                          const amb = ambassadors.find(a => a.id === r.ambassadorId);
                          return (
                            <button
                              key={r.id}
                              onClick={() => setOpenRefId(r.id)}
                              className="w-full text-left rounded border border-border bg-card p-2 hover:border-primary transition"
                            >
                              <div className="text-xs font-medium truncate">{r.clientName}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{amb?.code}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {fmt(r.commissionAmount)} · {COMMISSION_STATUS_LABEL[r.commissionStatus]}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="commissions">
            <Card className="p-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Cliente</TableHead><TableHead>Embajador</TableHead>
                  <TableHead>Monto venta</TableHead><TableHead>Comisión</TableHead>
                  <TableHead>Estatus</TableHead><TableHead>Pago</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {referrals.filter(r => r.commissionStatus !== 'cancelada').length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin comisiones</TableCell></TableRow>
                  )}
                  {referrals.filter(r => r.commissionStatus !== 'cancelada').map(r => {
                    const amb = ambassadors.find(a => a.id === r.ambassadorId);
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenRefId(r.id)}>
                        <TableCell>{r.clientName}</TableCell>
                        <TableCell className="text-xs">{amb?.code}</TableCell>
                        <TableCell>{fmt(r.saleAmount ?? 0)}</TableCell>
                        <TableCell>{fmt(r.commissionAmount)}</TableCell>
                        <TableCell><CommBadge status={r.commissionStatus} /></TableCell>
                        <TableCell className="text-xs">{r.paymentDate ? dateShort(r.paymentDate) : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="p-4 space-y-3">
              <div className="flex justify-between">
                <h3 className="font-medium">Reporte general</h3>
                <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Embajador</TableHead><TableHead>Referidos</TableHead><TableHead>Válidos</TableHead>
                  <TableHead>Ventas</TableHead><TableHead>Monto</TableHead>
                  <TableHead>Comisión generada</TableHead><TableHead>Pagada</TableHead><TableHead>Conv.</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ranking.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin datos</TableCell></TableRow>}
                  {ranking.map(r => (
                    <TableRow key={r.a.id}>
                      <TableCell>{r.a.fullName}</TableCell>
                      <TableCell>{r.refs}</TableCell>
                      <TableCell>{r.valid}</TableCell>
                      <TableCell>{r.sales}</TableCell>
                      <TableCell>{fmt(r.amount)}</TableCell>
                      <TableCell>{fmt(r.commGen)}</TableCell>
                      <TableCell>{fmt(r.commPaid)}</TableCell>
                      <TableCell>{r.conv.toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Asignación de referidos</h3>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Cliente</TableHead><TableHead>Embajador</TableHead><TableHead>Registro</TableHead>
                    <TableHead>Estatus</TableHead><TableHead>Asesor</TableHead><TableHead>Seguimiento</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {referrals.filter(r => !['descartado','duplicado'].includes(r.status)).length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin referidos activos</TableCell></TableRow>
                    )}
                    {referrals.filter(r => !['descartado','duplicado'].includes(r.status)).map(r => {
                      const amb = ambassadors.find(a => a.id === r.ambassadorId);
                      const aStatus: AssignmentStatus = r.assignmentStatus ?? 'sin_asignar';
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{r.clientName}</TableCell>
                          <TableCell className="text-xs">{amb?.code}</TableCell>
                          <TableCell className="text-xs">{dateShort(r.registeredAt)}</TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell>
                            <Select
                              value={r.assignedAdvisorId ?? 'none'}
                              onValueChange={v => {
                                assignAdvisor(r.id, v === 'none' ? null : v);
                                toast.success(v === 'none' ? 'Asignación removida' : 'Asesor asignado');
                              }}
                            >
                              <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Sin asignar —</SelectItem>
                                {advisors.filter(a => a.active).map(a => (
                                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell><Badge variant="outline">{ASSIGNMENT_STATUS_LABEL[aStatus]}</Badge></TableCell>
                          <TableCell><Button size="sm" variant="ghost" onClick={() => setOpenRefId(r.id)}>Detalle</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              <Card className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2"><Bell className="h-4 w-4" /> Notificaciones enviadas a asesores</h3>
                {advisorNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin notificaciones registradas.</p>
                ) : (
                  <ul className="space-y-2 max-h-96 overflow-auto">
                    {advisorNotifications.slice(0,30).map(n => {
                      const adv = advisors.find(a => a.id === n.advisorId);
                      return (
                        <li key={n.id} className={`p-3 rounded border ${n.read ? 'border-border' : 'border-primary/30 bg-primary/5'}`}>
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{n.title} · <span className="text-muted-foreground font-normal">{adv?.name ?? n.advisorId}</span></div>
                              <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleString('es-MX')}</div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => setOpenRefId(n.referralId)}>Abrir referido</Button>
                              {!n.read && <Button size="sm" variant="ghost" onClick={() => markAdvisorNotifRead(n.id)}>Leída</Button>}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="advisors">
            <AdvisorsManager />
          </TabsContent>
        </Tabs>

        {/* Dialogs / Sheets */}
        <NuevoEmbajadorDialog
          open={showNuevoEmb}
          onOpenChange={setShowNuevoEmb}
          onCreated={refresh}
        />

        {editingAmb && (
          <AmbassadorEditSheet
            open={showEditEmb}
            onOpenChange={setShowEditEmb}
            ambassador={editingAmb}
          />
        )}

        <AmbassadorDocsVerifyDialog
          open={showVerifyDocs}
          onOpenChange={setShowVerifyDocs}
          idPersona={verifyAmb?.idPersona}
          ambassadorName={verifyAmb?.fullName}
        />

        <ReferralFormDialog open={showRefForm} onOpenChange={setShowRefForm} />
        <ReferralDetailSheet referralId={openRefId} onOpenChange={setOpenRefId} />
      </div>
    </TooltipProvider>
  );
}
