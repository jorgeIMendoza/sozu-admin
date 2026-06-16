import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  X, Plus, Pencil, Loader2, ShieldCheck, Users, Building2,
  Settings2, AlertTriangle, Check, GitBranch, Trash2, List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'categorias' | 'personal' | 'proveedores' | 'reglas' | 'subcategorias';

interface Subcategoria {
  id: number;
  id_categoria: number;
  nombre: string;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string | null;
  vigencia_dias: number | null;
  sla_critico_horas: number;
  sla_media_horas: number;
  sla_baja_dias: number;
  aplica_a: string | null;
  prioridad_default?: string | null;
  evidencia_obligatoria?: boolean;
  activo: boolean;
}

interface Personal {
  id: number;
  nombre_completo: string;
  puesto: string | null;
  especialidad: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

interface Proveedor {
  id: number;
  nombre_comercial: string;
  contacto_principal: string | null;
  especialidad: string | null;
  telefono: string | null;
  email: string | null;
  sla_default: number | null;
  activo: boolean;
}

interface ReglaAsignacion {
  id: number;
  id_categoria: number;
  tipo_responsable: 'PERSONAL' | 'PROVEEDOR';
  id_responsable: number;
  nombre_responsable?: string;
  sla_override: number | null;
  prioridad_default: string | null;
  activo: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORIDAD_OPTIONS = [
  { value: 'BAJA',    label: 'Baja' },
  { value: 'MEDIA',   label: 'Media' },
  { value: 'ALTA',    label: 'Alta' },
  { value: 'CRITICA', label: 'Crítica' },
];

const PERIODO_OPTIONS = [
  { value: 90,   label: '3 meses' },
  { value: 180,  label: '6 meses' },
  { value: 365,  label: '12 meses' },
  { value: 0,    label: 'Personalizado' },
];

const APLICA_OPTIONS = [
  { value: 'TODAS',    label: 'Todas las unidades' },
  { value: 'DEPARTAMENTO', label: 'Departamento' },
  { value: 'CASA',     label: 'Casa' },
  { value: 'LOCAL',    label: 'Local comercial' },
  { value: 'BODEGA',   label: 'Bodega' },
];

const CATEGORIAS_SUGERIDAS = ['Eléctrica', 'Hidráulica', 'Sanitaria', 'HVAC', 'Calentador', 'Acabados', 'Carpintería'];

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActiveBadge({ activo }: { activo: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
      activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', activo ? 'bg-emerald-500' : 'bg-slate-400')} />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function DdlBanner({ table }: { table: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 m-4">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Tabla <code className="font-mono bg-amber-100 px-1 rounded">{table}</code> no encontrada</p>
        <p className="text-xs text-amber-700 mt-1">
          Ejecuta el DDL en <span className="font-mono">Ejecuciones_manuales/postventa_configuracion_ddl_pendiente.md</span> para habilitar esta sección.
        </p>
      </div>
    </div>
  );
}

function InputField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400';

// ─── Tab: Categorías ──────────────────────────────────────────────────────────

function TabCategorias() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Categoria | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Partial<Categoria>>({});
  const [periodoCustom, setPeriodoCustom] = useState(false);

  const { data: categorias = [], isLoading } = useQuery<Categoria[]>({
    queryKey: ['pv-config-categorias'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('postventa_categorias_garantia')
        .select('*').order('nombre');
      if (error) throw error;
      return data ?? [];
    },
  });

  // DDL probe for extra columns
  const { data: hasExtraCols } = useQuery<boolean>({
    queryKey: ['pv-config-cols-probe'],
    queryFn: async () => {
      const { error } = await (supabase as any)
        .from('postventa_categorias_garantia').select('descripcion').limit(0);
      return !error;
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Categoria>) => {
      const payload: any = {
        nombre: data.nombre!,
        vigencia_dias: data.vigencia_dias,
        sla_critico_horas: data.sla_critico_horas ?? 4,
        sla_media_horas: data.sla_media_horas ?? 24,
        sla_baja_dias: data.sla_baja_dias ?? 5,
        aplica_a: data.aplica_a ?? 'TODAS',
        activo: data.activo ?? true,
      };
      if (hasExtraCols) {
        payload.descripcion = data.descripcion ?? null;
        payload.prioridad_default = data.prioridad_default ?? 'MEDIA';
        payload.evidencia_obligatoria = data.evidencia_obligatoria ?? false;
      }
      if (data.id) {
        const { error } = await (supabase as any).from('postventa_categorias_garantia').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('postventa_categorias_garantia').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? 'Categoría actualizada' : 'Categoría creada');
      qc.invalidateQueries({ queryKey: ['pv-config-categorias'] });
      qc.invalidateQueries({ queryKey: ['pv-categorias'] });
      setSelected(null); setIsNew(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await (supabase as any).from('postventa_categorias_garantia').update({ activo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Estado actualizado'); qc.invalidateQueries({ queryKey: ['pv-config-categorias'] }); },
  });

  function openNew() {
    setForm({ nombre: '', vigencia_dias: 365, sla_critico_horas: 4, sla_media_horas: 24, sla_baja_dias: 5, aplica_a: 'TODAS', prioridad_default: 'MEDIA', activo: true });
    setPeriodoCustom(false); setIsNew(true); setSelected(null);
  }

  function openEdit(cat: Categoria) {
    const presetPeriodo = PERIODO_OPTIONS.find(p => p.value === cat.vigencia_dias && p.value !== 0);
    setPeriodoCustom(!presetPeriodo);
    setForm({ ...cat }); setSelected(cat); setIsNew(false);
  }

  const showForm = isNew || selected !== null;

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-64 shrink-0 border-r border-slate-100 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categorías</span>
          <button onClick={openNew} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : categorias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
            <ShieldCheck className="w-8 h-8 text-slate-200" />
            <p className="text-xs text-slate-400">No hay categorías. Crea la primera.</p>
            <div className="mt-2 w-full space-y-1">
              {CATEGORIAS_SUGERIDAS.map(s => (
                <button key={s} onClick={() => { setForm({ nombre: s, vigencia_dias: 365, sla_critico_horas: 4, sla_media_horas: 24, sla_baja_dias: 5, aplica_a: 'TODAS', prioridad_default: 'MEDIA', activo: true }); setIsNew(true); setSelected(null); }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-50 border border-slate-200">
                  + {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {categorias.map(cat => (
              <button key={cat.id} onClick={() => openEdit(cat)}
                className={cn('w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors', selected?.id === cat.id ? 'bg-emerald-50' : '')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{cat.nombre}</span>
                  <ActiveBadge activo={cat.activo} />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">SLA crítico: {cat.sla_critico_horas}h</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        {!showForm ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-medium text-slate-400">Selecciona una categoría</p>
            <p className="text-xs text-slate-300">o crea una nueva desde el panel izquierdo</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{isNew ? 'Nueva categoría' : 'Editar categoría'}</h3>
              {!isNew && selected && (
                <button onClick={() => toggleActivoMutation.mutate({ id: selected.id, activo: !selected.activo })}
                  className={cn('text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors', selected.activo ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50')}>
                  {selected.activo ? 'Inactivar' : 'Activar'}
                </button>
              )}
            </div>

            <InputField label="Nombre de la categoría" required>
              <input value={form.nombre ?? ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={INPUT_CLS} placeholder="Ej: Eléctrica" />
            </InputField>

            {hasExtraCols && (
              <InputField label="Descripción">
                <textarea value={form.descripcion ?? ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} className={INPUT_CLS + ' resize-none'} placeholder="Descripción de la categoría" />
              </InputField>
            )}

            <InputField label="Período de garantía">
              <select value={periodoCustom ? 0 : (form.vigencia_dias ?? 365)} onChange={e => { const v = Number(e.target.value); if (v === 0) { setPeriodoCustom(true); } else { setPeriodoCustom(false); setForm(f => ({ ...f, vigencia_dias: v })); } }} className={INPUT_CLS}>
                {PERIODO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {periodoCustom && (
                <div className="flex items-center gap-2 mt-2">
                  <input type="number" min={1} value={form.vigencia_dias ?? ''} onChange={e => setForm(f => ({ ...f, vigencia_dias: Number(e.target.value) }))} className={INPUT_CLS} placeholder="Días" />
                  <span className="text-xs text-slate-500 whitespace-nowrap">días</span>
                </div>
              )}
            </InputField>

            <div className="grid grid-cols-3 gap-3">
              <InputField label="SLA Crítico (h)">
                <input type="number" min={1} value={form.sla_critico_horas ?? 4} onChange={e => setForm(f => ({ ...f, sla_critico_horas: Number(e.target.value) }))} className={INPUT_CLS} />
              </InputField>
              <InputField label="SLA Media (h)">
                <input type="number" min={1} value={form.sla_media_horas ?? 24} onChange={e => setForm(f => ({ ...f, sla_media_horas: Number(e.target.value) }))} className={INPUT_CLS} />
              </InputField>
              <InputField label="SLA Baja (días)">
                <input type="number" min={1} value={form.sla_baja_dias ?? 5} onChange={e => setForm(f => ({ ...f, sla_baja_dias: Number(e.target.value) }))} className={INPUT_CLS} />
              </InputField>
            </div>

            {hasExtraCols && (
              <InputField label="Prioridad default">
                <select value={form.prioridad_default ?? 'MEDIA'} onChange={e => setForm(f => ({ ...f, prioridad_default: e.target.value }))} className={INPUT_CLS}>
                  {PRIORIDAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </InputField>
            )}

            <InputField label="Aplica a">
              <select value={form.aplica_a ?? 'TODAS'} onChange={e => setForm(f => ({ ...f, aplica_a: e.target.value }))} className={INPUT_CLS}>
                {APLICA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </InputField>

            {hasExtraCols && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.evidencia_obligatoria ?? false} onChange={e => setForm(f => ({ ...f, evidencia_obligatoria: e.target.checked }))} className="w-4 h-4 accent-emerald-600" />
                <span className="text-sm text-slate-700">Evidencia fotográfica obligatoria</span>
              </label>
            )}

            {!hasExtraCols && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Campos adicionales (descripción, prioridad, evidencia) requieren ejecutar el DDL pendiente.</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setSelected(null); setIsNew(false); }} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button disabled={!form.nombre?.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate(form)}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {form.id ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Personal ────────────────────────────────────────────────────────────

// Tipo entidad id=22 "Personal de mantenimiento"
const ID_TIPO_PERSONAL = 22;

interface PersonalRow {
  erId: number;      // entidades_relacionadas.id
  personaId: number; // personas.id
  nombre: string;
  especialidad: string | null; // nombre_comercial usado como especialidad
  email: string | null;
  telefono: string | null;
  activo: boolean;
}

function TabPersonal() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PersonalRow | null>(null);
  const [form, setForm] = useState({ nombre: '', especialidad: '', email: '', telefono: '', activo: true });

  // Usa personas + entidades_relacionadas (id_tipo_entidad=22 = Personal de mantenimiento)
  const { data: personal = [], isLoading } = useQuery<PersonalRow[]>({
    queryKey: ['pv-personal-er'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entidades_relacionadas')
        .select('id, id_persona, activo, personas(id, nombre_legal, nombre_comercial, email, telefono)')
        .eq('id_tipo_entidad', ID_TIPO_PERSONAL)
        .order('fecha_creacion', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((er: any) => ({
        erId: er.id,
        personaId: er.id_persona,
        nombre: er.personas?.nombre_legal ?? '—',
        especialidad: er.personas?.nombre_comercial ?? null,
        email: er.personas?.email ?? null,
        telefono: er.personas?.telefono ?? null,
        activo: er.activo,
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (d: typeof form & { erId?: number; personaId?: number }) => {
      if (d.personaId) {
        // Editar persona existente
        const { error } = await supabase.from('personas').update({
          nombre_legal: d.nombre,
          nombre_comercial: d.especialidad || null,
          email: d.email || null,
          telefono: d.telefono || null,
        }).eq('id', d.personaId);
        if (error) throw error;
        if (d.erId) {
          const { error: e2 } = await supabase.from('entidades_relacionadas').update({ activo: d.activo }).eq('id', d.erId);
          if (e2) throw e2;
        }
      } else {
        // Crear persona nueva
        const { data: newPersona, error: e1 } = await supabase.from('personas')
          .insert({ nombre_legal: d.nombre, nombre_comercial: d.especialidad || null, email: d.email || null, telefono: d.telefono || null, tipo_persona: 'fisica' })
          .select('id').single();
        if (e1) throw e1;
        const { error: e2 } = await supabase.from('entidades_relacionadas')
          .insert({ id_persona: newPersona.id, id_tipo_entidad: ID_TIPO_PERSONAL, activo: true });
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success('Personal guardado'); qc.invalidateQueries({ queryKey: ['pv-personal-er'] }); setShowForm(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ erId, activo }: { erId: number; activo: boolean }) => {
      const { error } = await supabase.from('entidades_relacionadas').update({ activo }).eq('id', erId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pv-personal-er'] }),
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{personal.length} técnico(s) registrado(s)</p>
        <button onClick={() => { setForm({ nombre: '', especialidad: '', email: '', telefono: '', activo: true }); setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800">
          <Plus className="w-3.5 h-3.5" /> Nuevo técnico
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : personal.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Users className="w-8 h-8 text-slate-200" />
          <p className="text-sm text-slate-400">Sin técnicos registrados</p>
          <button onClick={() => { setForm({ nombre: '', especialidad: '', email: '', telefono: '', activo: true }); setEditing(null); setShowForm(true); }} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800">
            <Plus className="w-3.5 h-3.5" /> Agregar primer técnico
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200">{['Nombre', 'Especialidad', 'Teléfono', 'Correo', 'Estado', ''].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {personal.map(p => (
                <tr key={p.erId} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{p.nombre}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.especialidad ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.telefono ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.email ?? '—'}</td>
                  <td className="px-3 py-2.5"><ActiveBadge activo={p.activo} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(p); setForm({ nombre: p.nombre, especialidad: p.especialidad ?? '', email: p.email ?? '', telefono: p.telefono ?? '', activo: p.activo }); setShowForm(true); }} className="p-1 rounded hover:bg-slate-100"><Pencil className="w-3 h-3 text-slate-400" /></button>
                      <button onClick={() => toggleMutation.mutate({ erId: p.erId, activo: !p.activo })} className="p-1 rounded hover:bg-slate-100">
                        {p.activo ? <Trash2 className="w-3 h-3 text-red-400" /> : <Check className="w-3 h-3 text-emerald-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <h4 className="text-sm font-bold text-slate-800">{editing ? 'Editar técnico' : 'Nuevo técnico'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Nombre completo" required><input value={form.nombre ?? ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={INPUT_CLS} placeholder="Nombre del técnico" /></InputField>
            <InputField label="Especialidad"><input value={form.especialidad ?? ''} onChange={e => setForm(f => ({ ...f, especialidad: e.target.value }))} className={INPUT_CLS} placeholder="Ej: Eléctrica, HVAC" /></InputField>
            <InputField label="Teléfono"><input value={form.telefono ?? ''} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className={INPUT_CLS} /></InputField>
            <InputField label="Email"><input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={INPUT_CLS} /></InputField>
            <InputField label="Estado">
              <select value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))} className={INPUT_CLS}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </InputField>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancelar</button>
            <button disabled={!form.nombre?.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ ...form, erId: editing?.erId, personaId: editing?.personaId })}
              className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Proveedores ─────────────────────────────────────────────────────────

const ID_TIPO_PROVEEDOR = 8;

interface ProveedorRow {
  erId: number;
  personaId: number;
  nombre: string;        // nombre_comercial
  contacto: string | null; // nombre_legal
  especialidad: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
}

function TabProveedores() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProveedorRow | null>(null);
  const [form, setForm] = useState({ nombre: '', contacto: '', especialidad: '', email: '', telefono: '', activo: true });

  // Usa personas + entidades_relacionadas (id_tipo_entidad=8 = Proveedor)
  const { data: proveedores = [], isLoading } = useQuery<ProveedorRow[]>({
    queryKey: ['pv-proveedores-er'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entidades_relacionadas')
        .select('id, id_persona, activo, personas(id, nombre_legal, nombre_comercial, email, telefono)')
        .eq('id_tipo_entidad', ID_TIPO_PROVEEDOR)
        .order('fecha_creacion', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((er: any) => ({
        erId: er.id,
        personaId: er.id_persona,
        nombre: er.personas?.nombre_comercial ?? er.personas?.nombre_legal ?? '—',
        contacto: er.personas?.nombre_legal ?? null,
        especialidad: null,
        email: er.personas?.email ?? null,
        telefono: er.personas?.telefono ?? null,
        activo: er.activo,
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (d: typeof form & { erId?: number; personaId?: number }) => {
      if (d.personaId) {
        const { error } = await supabase.from('personas').update({
          nombre_comercial: d.nombre || null,
          nombre_legal: d.contacto || null,
          email: d.email || null,
          telefono: d.telefono || null,
        }).eq('id', d.personaId);
        if (error) throw error;
        if (d.erId) {
          const { error: e2 } = await supabase.from('entidades_relacionadas').update({ activo: d.activo }).eq('id', d.erId);
          if (e2) throw e2;
        }
      } else {
        const { data: newPersona, error: e1 } = await supabase.from('personas')
          .insert({ nombre_comercial: d.nombre, nombre_legal: d.contacto || null, email: d.email || null, telefono: d.telefono || null, tipo_persona: 'moral' })
          .select('id').single();
        if (e1) throw e1;
        const { error: e2 } = await supabase.from('entidades_relacionadas')
          .insert({ id_persona: newPersona.id, id_tipo_entidad: ID_TIPO_PROVEEDOR, activo: true });
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success('Proveedor guardado'); qc.invalidateQueries({ queryKey: ['pv-proveedores-er'] }); setShowForm(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ erId, activo }: { erId: number; activo: boolean }) => {
      const { error } = await supabase.from('entidades_relacionadas').update({ activo }).eq('id', erId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pv-proveedores-er'] }),
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{proveedores.length} proveedor(es) registrado(s)</p>
        <button onClick={() => { setForm({ nombre: '', contacto: '', especialidad: '', email: '', telefono: '', activo: true }); setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800">
          <Plus className="w-3.5 h-3.5" /> Nuevo proveedor
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : proveedores.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Building2 className="w-8 h-8 text-slate-200" />
          <p className="text-sm text-slate-400">Sin proveedores registrados</p>
          <button onClick={() => { setForm({ nombre: '', contacto: '', especialidad: '', email: '', telefono: '', activo: true }); setEditing(null); setShowForm(true); }} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800">
            <Plus className="w-3.5 h-3.5" /> Agregar primer proveedor
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200">{['Proveedor', 'Contacto', 'Teléfono', 'Correo', 'Estado', ''].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {proveedores.map(p => (
                <tr key={p.erId} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{p.nombre}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.contacto ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.telefono ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.email ?? '—'}</td>
                  <td className="px-3 py-2.5"><ActiveBadge activo={p.activo} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(p); setForm({ nombre: p.nombre, contacto: p.contacto ?? '', especialidad: p.especialidad ?? '', email: p.email ?? '', telefono: p.telefono ?? '', activo: p.activo }); setShowForm(true); }} className="p-1 rounded hover:bg-slate-100"><Pencil className="w-3 h-3 text-slate-400" /></button>
                      <button onClick={() => toggleMutation.mutate({ erId: p.erId, activo: !p.activo })} className="p-1 rounded hover:bg-slate-100">
                        {p.activo ? <Trash2 className="w-3 h-3 text-red-400" /> : <Check className="w-3 h-3 text-emerald-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <h4 className="text-sm font-bold text-slate-800">{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Nombre comercial" required><input value={form.nombre ?? ''} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={INPUT_CLS} placeholder="Empresa o nombre del proveedor" /></InputField>
            <InputField label="Contacto principal"><input value={form.contacto ?? ''} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} className={INPUT_CLS} placeholder="Nombre del contacto" /></InputField>
            <InputField label="Especialidad"><input value={form.especialidad ?? ''} onChange={e => setForm(f => ({ ...f, especialidad: e.target.value }))} className={INPUT_CLS} placeholder="Ej: Plomería, Eléctrica" /></InputField>
            <InputField label="Teléfono"><input value={form.telefono ?? ''} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className={INPUT_CLS} /></InputField>
            <InputField label="Email"><input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={INPUT_CLS} /></InputField>
            <InputField label="Estado">
              <select value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))} className={INPUT_CLS}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </InputField>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancelar</button>
            <button disabled={!form.nombre?.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ ...form, erId: editing?.erId, personaId: editing?.personaId })}
              className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Reglas ──────────────────────────────────────────────────────────────

function TabReglas() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ReglaAsignacion | null>(null);
  const [form, setForm] = useState<Partial<ReglaAsignacion & { tipo_responsable: 'PERSONAL' | 'PROVEEDOR' }>>({ tipo_responsable: 'PERSONAL', activo: true });

  const { data: tableExists } = useQuery<boolean>({
    queryKey: ['pv-reglas-probe'],
    queryFn: async () => { const { error } = await (supabase as any).from('postventa_reglas_asignacion').select('id').limit(0); return !error; },
    staleTime: 60_000,
  });

  const { data: categorias = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['pv-config-categorias-mini'],
    queryFn: async () => { const { data } = await (supabase as any).from('postventa_categorias_garantia').select('id, nombre').eq('activo', true).order('nombre'); return data ?? []; },
  });

  const { data: personalOpts = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['pv-personal-opts'],
    queryFn: async () => {
      const { error, data } = await (supabase as any).from('postventa_personal').select('id, nombre_completo').eq('activo', true).order('nombre_completo');
      if (error) return [];
      return (data ?? []).map((p: any) => ({ id: p.id, nombre: p.nombre_completo }));
    },
  });

  const { data: proveedorOpts = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['pv-proveedores-opts'],
    queryFn: async () => {
      const { error, data } = await (supabase as any).from('postventa_proveedores').select('id, nombre_comercial').eq('activo', true).order('nombre_comercial');
      if (error) return [];
      return (data ?? []).map((p: any) => ({ id: p.id, nombre: p.nombre_comercial }));
    },
  });

  const { data: reglas = [], isLoading } = useQuery<ReglaAsignacion[]>({
    queryKey: ['pv-reglas'],
    enabled: tableExists === true,
    queryFn: async () => { const { data } = await (supabase as any).from('postventa_reglas_asignacion').select('*').order('id_categoria'); return data ?? []; },
  });

  const saveMutation = useMutation({
    mutationFn: async (d: Partial<ReglaAsignacion>) => {
      const payload = { id_categoria: d.id_categoria!, tipo_responsable: d.tipo_responsable!, id_responsable: d.id_responsable!, sla_override: d.sla_override ?? null, prioridad_default: d.prioridad_default ?? 'MEDIA', activo: d.activo ?? true };
      const { error } = d.id
        ? await (supabase as any).from('postventa_reglas_asignacion').update(payload).eq('id', d.id)
        : await (supabase as any).from('postventa_reglas_asignacion').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Regla guardada'); qc.invalidateQueries({ queryKey: ['pv-reglas'] }); setShowForm(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await (supabase as any).from('postventa_reglas_asignacion').update({ activo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pv-reglas'] }),
  });

  if (tableExists === false) return <DdlBanner table="postventa_reglas_asignacion" />;

  const catMap = Object.fromEntries(categorias.map(c => [c.id, c.nombre]));
  const responsableOpts = form.tipo_responsable === 'PERSONAL' ? personalOpts : proveedorOpts;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{reglas.length} regla(s) configurada(s)</p>
        <button onClick={() => { setForm({ tipo_responsable: 'PERSONAL', activo: true, prioridad_default: 'MEDIA' }); setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800">
          <Plus className="w-3.5 h-3.5" /> Nueva regla
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : reglas.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <GitBranch className="w-8 h-8 text-slate-200" />
          <p className="text-sm text-slate-400">Sin reglas configuradas</p>
          <p className="text-xs text-slate-300 text-center">Las reglas permiten asignar automáticamente responsable, SLA y prioridad al crear tickets.</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200">{['Categoría', 'Tipo', 'Responsable', 'SLA', 'Prioridad', 'Estado', ''].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {reglas.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{catMap[r.id_categoria] ?? `Cat. ${r.id_categoria}`}</td>
                  <td className="px-3 py-2.5"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', r.tipo_responsable === 'PERSONAL' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700')}>{r.tipo_responsable}</span></td>
                  <td className="px-3 py-2.5 text-slate-600">{r.nombre_responsable ?? `ID ${r.id_responsable}`}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.sla_override ? `${r.sla_override}h` : '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.prioridad_default ?? '—'}</td>
                  <td className="px-3 py-2.5"><ActiveBadge activo={r.activo} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(r); setForm({ ...r }); setShowForm(true); }} className="p-1 rounded hover:bg-slate-100"><Pencil className="w-3 h-3 text-slate-400" /></button>
                      <button onClick={() => toggleMutation.mutate({ id: r.id, activo: !r.activo })} className="p-1 rounded hover:bg-slate-100">
                        {r.activo ? <Trash2 className="w-3 h-3 text-red-400" /> : <Check className="w-3 h-3 text-emerald-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <h4 className="text-sm font-bold text-slate-800">{editing ? 'Editar regla' : 'Nueva regla de asignación'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Categoría" required>
              <select value={form.id_categoria ?? ''} onChange={e => setForm(f => ({ ...f, id_categoria: Number(e.target.value) }))} className={INPUT_CLS}>
                <option value="" disabled>Selecciona categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </InputField>
            <InputField label="Tipo responsable">
              <select value={form.tipo_responsable ?? 'PERSONAL'} onChange={e => setForm(f => ({ ...f, tipo_responsable: e.target.value as 'PERSONAL' | 'PROVEEDOR', id_responsable: undefined }))} className={INPUT_CLS}>
                <option value="PERSONAL">Personal interno</option>
                <option value="PROVEEDOR">Proveedor externo</option>
              </select>
            </InputField>
            <InputField label="Responsable" required>
              <select value={form.id_responsable ?? ''} onChange={e => setForm(f => ({ ...f, id_responsable: Number(e.target.value) }))} className={INPUT_CLS}>
                <option value="" disabled>Selecciona responsable</option>
                {responsableOpts.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
              {responsableOpts.length === 0 && <p className="text-[11px] text-amber-600 mt-1">Registra {form.tipo_responsable === 'PERSONAL' ? 'personal' : 'proveedores'} primero.</p>}
            </InputField>
            <InputField label="SLA override (horas)"><input type="number" min={1} value={form.sla_override ?? ''} onChange={e => setForm(f => ({ ...f, sla_override: e.target.value ? Number(e.target.value) : null }))} className={INPUT_CLS} placeholder="Opcional" /></InputField>
            <InputField label="Prioridad default">
              <select value={form.prioridad_default ?? 'MEDIA'} onChange={e => setForm(f => ({ ...f, prioridad_default: e.target.value }))} className={INPUT_CLS}>
                {PRIORIDAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </InputField>
            <InputField label="Estado">
              <select value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))} className={INPUT_CLS}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </InputField>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white">Cancelar</button>
            <button disabled={!form.id_categoria || !form.id_responsable || saveMutation.isPending} onClick={() => saveMutation.mutate(form)} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saveMutation.isPending ? 'Guardando…' : 'Guardar regla'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Subcategorías ───────────────────────────────────────────────────────

function TabSubcategorias() {
  const qc = useQueryClient();
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingNombre, setEditingNombre] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newNombre, setNewNombre] = useState('');

  const { data: categorias = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['pv-config-categorias-mini'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('postventa_categorias_garantia')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      return data ?? [];
    },
  });

  const { data: subcategorias = [], isLoading } = useQuery<Subcategoria[]>({
    queryKey: ['pv-subcats-admin', categoriaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('postventa_subcategorias')
        .select('id, id_categoria, nombre, activo, fecha_creacion, fecha_actualizacion')
        .eq('id_categoria', categoriaId!)
        .order('nombre');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!categoriaId,
  });

  const insertMutation = useMutation({
    mutationFn: async (nombre: string) => {
      const { error } = await (supabase as any)
        .from('postventa_subcategorias')
        .insert({ id_categoria: categoriaId, nombre: nombre.trim(), activo: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Subcategoría creada');
      qc.invalidateQueries({ queryKey: ['pv-subcats-admin', categoriaId] });
      qc.invalidateQueries({ queryKey: ['pv-subcats', categoriaId] });
      setNewNombre('');
      setShowNew(false);
    },
    onError: (e: any) => {
      if (e.message?.includes('uq_subcat_categoria_nombre')) {
        toast.error('Ya existe una subcategoría con ese nombre en esta categoría');
      } else {
        toast.error(e.message);
      }
    },
  });

  const updateNombreMutation = useMutation({
    mutationFn: async ({ id, nombre }: { id: number; nombre: string }) => {
      const { error } = await (supabase as any)
        .from('postventa_subcategorias')
        .update({ nombre: nombre.trim() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Nombre actualizado');
      qc.invalidateQueries({ queryKey: ['pv-subcats-admin', categoriaId] });
      qc.invalidateQueries({ queryKey: ['pv-subcats', categoriaId] });
      setEditingId(null);
    },
    onError: (e: any) => {
      if (e.message?.includes('uq_subcat_categoria_nombre')) {
        toast.error('Ya existe una subcategoría con ese nombre en esta categoría');
      } else {
        toast.error(e.message);
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from('postventa_subcategorias')
        .update({ activo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.activo ? 'Subcategoría activada' : 'Subcategoría inactivada');
      qc.invalidateQueries({ queryKey: ['pv-subcats-admin', categoriaId] });
      qc.invalidateQueries({ queryKey: ['pv-subcats', categoriaId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleCategoriaChange(id: number | null) {
    setCategoriaId(id);
    setShowNew(false);
    setEditingId(null);
    setNewNombre('');
  }

  return (
    <div className="p-4 space-y-4">
      {/* Selector de categoría */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Categoría:</label>
        <select
          value={categoriaId ?? ''}
          onChange={e => handleCategoriaChange(Number(e.target.value) || null)}
          className={INPUT_CLS}
        >
          <option value="">Selecciona una categoría…</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {!categoriaId ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <List className="w-8 h-8 text-slate-200" />
          <p className="text-sm text-slate-400">Selecciona una categoría para ver sus subcategorías</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {subcategorias.filter(s => s.activo).length} activa(s) · {subcategorias.filter(s => !s.activo).length} inactiva(s)
            </p>
            {!showNew && (
              <button
                onClick={() => { setShowNew(true); setNewNombre(''); setEditingId(null); }}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar subcategoría
              </button>
            )}
          </div>

          {/* Formulario de nueva subcategoría */}
          {showNew && (
            <div className="flex items-center gap-2 border border-emerald-200 rounded-xl px-3 py-2 bg-emerald-50">
              <input
                autoFocus
                value={newNombre}
                onChange={e => setNewNombre(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newNombre.trim()) insertMutation.mutate(newNombre);
                  if (e.key === 'Escape') { setShowNew(false); setNewNombre(''); }
                }}
                placeholder="Nombre de la subcategoría…"
                className="flex-1 bg-transparent text-sm outline-none text-slate-800 placeholder-slate-400"
              />
              <button
                disabled={!newNombre.trim() || insertMutation.isPending}
                onClick={() => insertMutation.mutate(newNombre)}
                className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
              >
                {insertMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar
              </button>
              <button onClick={() => { setShowNew(false); setNewNombre(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {subcategorias.length === 0 && !showNew ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 border border-dashed border-slate-200 rounded-xl">
              <p className="text-sm text-slate-400">Sin subcategorías configuradas</p>
              <p className="text-xs text-slate-300 text-center">Esta categoría no tiene subcategorías en el catálogo.</p>
            </div>
          ) : subcategorias.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Nombre', 'Estado', 'Actualizado', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subcategorias.map(s => (
                    <tr key={s.id} className={cn('hover:bg-slate-50', !s.activo && 'opacity-60')}>
                      <td className="px-3 py-2.5">
                        {editingId === s.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editingNombre}
                              onChange={e => setEditingNombre(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && editingNombre.trim()) updateNombreMutation.mutate({ id: s.id, nombre: editingNombre });
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="border border-emerald-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-emerald-400 w-56"
                            />
                            <button
                              disabled={!editingNombre.trim() || updateNombreMutation.isPending}
                              onClick={() => updateNombreMutation.mutate({ id: s.id, nombre: editingNombre })}
                              className="p-1 rounded hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                            >
                              {updateNombreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className={cn('font-medium', s.activo ? 'text-slate-800' : 'text-slate-400')}>{s.nombre}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><ActiveBadge activo={s.activo} /></td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {new Date(s.fecha_actualizacion).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            disabled={editingId === s.id}
                            onClick={() => { setEditingId(s.id); setEditingNombre(s.nombre); setShowNew(false); }}
                            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                            title="Editar nombre"
                          >
                            <Pencil className="w-3 h-3 text-slate-400" />
                          </button>
                          <button
                            onClick={() => toggleMutation.mutate({ id: s.id, activo: !s.activo })}
                            className="p-1 rounded hover:bg-slate-100"
                            title={s.activo ? 'Inactivar (baja lógica)' : 'Activar'}
                          >
                            {s.activo ? <Trash2 className="w-3 h-3 text-red-400" /> : <Check className="w-3 h-3 text-emerald-500" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'categorias',    label: 'Categorías',    icon: ShieldCheck },
  { id: 'subcategorias', label: 'Subcategorías', icon: List },
  { id: 'personal',      label: 'Personal',      icon: Users },
  { id: 'proveedores',   label: 'Proveedores',   icon: Building2 },
  { id: 'reglas',        label: 'Reglas',        icon: GitBranch },
];

export function PostventaConfiguracion({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('categorias');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30 pointer-events-auto" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-[860px] h-full bg-white shadow-2xl flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">Configuración de Postventa</p>
              <p className="text-xs text-slate-500">Categorías · Subcategorías · Personal · Proveedores · Reglas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 shrink-0 px-2">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  tab === t.id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700',
                )}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {tab === 'categorias'    && <div className="h-full flex flex-col"><TabCategorias /></div>}
          {tab === 'subcategorias' && <div className="h-full overflow-y-auto"><TabSubcategorias /></div>}
          {tab === 'personal'      && <div className="h-full overflow-y-auto"><TabPersonal /></div>}
          {tab === 'proveedores'   && <div className="h-full overflow-y-auto"><TabProveedores /></div>}
          {tab === 'reglas'        && <div className="h-full overflow-y-auto"><TabReglas /></div>}
        </div>
      </div>
    </div>
  );
}

export default PostventaConfiguracion;
