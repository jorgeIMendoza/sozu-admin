import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AMBASSADOR_TYPE_LABEL, DEFAULT_PAYMENT_DOCS } from '@/types/ambassadors';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onCreated: () => void;
}

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  company: string;
  type: string;
  status: string;
  commissionPct: string;
  fixedAmount: string;
  commissionTrigger: string;
  protectionDays: string;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  fullName: '', phone: '', email: '', company: '',
  type: 'otro', status: 'pendiente',
  commissionPct: '0.5', fixedAmount: '',
  commissionTrigger: 'enganche', protectionDays: '90', notes: '',
};

export default function NuevoEmbajadorDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error('Nombre, teléfono y email son obligatorios');
      return;
    }

    setLoading(true);
    try {
      // 1. Obtener tipo_entidad "Embajador"
      const { data: tipoData, error: tipoError } = await supabase
        .from('tipos_entidad')
        .select('id')
        .eq('nombre', 'Embajador')
        .single();
      if (tipoError || !tipoData) throw new Error('Tipo de entidad "Embajador" no encontrado. Ejecuta la migración 20260527000002.');

      // 2. Obtener rol "Embajador"
      const { data: rolData, error: rolError } = await supabase
        .from('roles')
        .select('id')
        .eq('nombre', 'Embajador')
        .single();
      if (rolError || !rolData) throw new Error('Rol "Embajador" no encontrado. Ejecuta la migración 20260527000002.');

      // 3. Crear persona
      const { data: persona, error: personaError } = await supabase
        .from('personas')
        .insert({
          nombre_legal: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          telefono: form.phone.trim(),
          tipo_persona: 'pf',
          activo: true,
        })
        .select('id')
        .single();
      if (personaError || !persona) throw personaError ?? new Error('Error al crear persona');

      // 4. Crear entidad_relacionada tipo Embajador
      const { error: erError } = await supabase
        .from('entidades_relacionadas')
        .insert({
          id_persona: persona.id,
          id_tipo_entidad: tipoData.id,
          activo: true,
        });
      if (erError) throw erError;

      // 5. Crear registro en embajadores
      const { error: embError } = await supabase
        .from('embajadores')
        .insert({
          id_persona: persona.id,
          empresa: form.company.trim() || null,
          tipo: form.type,
          pct_comision: Number(form.commissionPct) || 0,
          monto_fijo: form.fixedAmount ? Number(form.fixedAmount) : null,
          trigger_comision: form.commissionTrigger,
          dias_proteccion: Number(form.protectionDays) || 90,
          notas: form.notes.trim() || null,
          estatus: form.status,
          documentos_pago: DEFAULT_PAYMENT_DOCS.map(d => ({ ...d })),
        });
      if (embError) throw embError;

      // 6. Crear usuario con rol Embajador (envía correo de confirmación)
      const { error: createUserError } = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email.trim().toLowerCase(),
          nombre: form.fullName.trim(),
          rol_id: rolData.id,
          id_persona: persona.id,
          telefono: form.phone.trim(),
        },
      });
      if (createUserError) throw createUserError;

      toast.success(`Embajador creado. Se envió correo de activación a ${form.email}.`);
      setForm(DEFAULT_FORM);
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error al crear embajador:', err);
      toast.error(err?.message ?? 'Error al crear embajador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo embajador</DialogTitle>
          <DialogDescription>
            Se creará un perfil de persona, un registro de embajador y una cuenta de usuario con correo de activación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Nombre completo *</Label>
            <Input value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Teléfono *</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="55 1234 5678" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@ejemplo.com" />
            </div>
          </div>
          <div>
            <Label>Empresa / origen</Label>
            <Input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de embajador</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AMBASSADOR_TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estatus inicial</Label>
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>% Comisión</Label>
              <Input type="number" step="0.1" min="0" value={form.commissionPct} onChange={e => set('commissionPct', e.target.value)} />
            </div>
            <div>
              <Label>Monto fijo (opcional)</Label>
              <Input type="number" value={form.fixedAmount} onChange={e => set('fixedAmount', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Trigger</Label>
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
          <div>
            <Label>Días de protección</Label>
            <Input type="number" min="1" value={form.protectionDays} onChange={e => set('protectionDays', e.target.value)} />
          </div>
          <div>
            <Label>Notas internas</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creando...' : 'Crear embajador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
