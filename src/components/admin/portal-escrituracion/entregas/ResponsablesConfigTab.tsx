import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, UserCheck, Wrench, Loader2, AlertTriangle, Search,
  ToggleLeft, ToggleRight, Plus, Pencil, X, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntidadRow {
  erId: number;
  personaId: number | null;
  id_tipo_entidad: number;
  tipo_nombre: string;
  id_proyecto: number | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  es_supervisor: boolean;
  es_tecnico: boolean;
  activo: boolean;
}

type TipoFilter   = 'all' | '8' | '22';
type RolFilter    = 'all' | 'yes' | 'no';
type ActivoFilter = 'all' | 'activo' | 'inactivo';

interface FormState {
  nombre: string;
  email: string;
  telefono: string;
  id_tipo_entidad: 8 | 22;
  es_supervisor: boolean;
  es_tecnico: boolean;
  activo: boolean;
}

const BLANK_FORM: FormState = {
  nombre: '', email: '', telefono: '',
  id_tipo_entidad: 22,
  es_supervisor: false, es_tecnico: true,
  activo: true,
};

const TIPO_LABEL: Record<number, string> = {
  8:  'Proveedor',
  22: 'Personal de mantenimiento',
};

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';
const SELECT_CLS = 'border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-600';

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, cls }: {
  icon: React.ElementType; label: string; value: number; cls: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cls)}>
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─── DDL Pending Banner ───────────────────────────────────────────────────────

function DdlBanner() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-700 mb-1">
              Vinculación con catálogo institucional pendiente
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              La administración de responsables está pendiente de vinculación con el
              catálogo institucional de personas. Ejecuta el DDL en{' '}
              <span className="font-semibold font-mono">
                Ejecuciones_manuales/responsables_entregas.md
              </span>{' '}
              (Bloques 1 y 2) para habilitar esta pantalla.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          El checklist y el resto del módulo siguen funcionando con normalidad mientras tanto.
        </p>
      </div>
    </div>
  );
}

// ─── Toggle button ────────────────────────────────────────────────────────────

function RolToggle({ active, label, colorOn, icon: Icon, onClick, saving }: {
  active: boolean; label: string; colorOn: string; icon: React.ElementType;
  onClick: () => void; saving: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
        active
          ? `${colorOn} border-current`
          : 'text-slate-400 border-slate-200 hover:border-slate-300',
        saving && 'opacity-50 cursor-not-allowed',
      )}
    >
      {saving
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : active
          ? <ToggleRight className="w-3.5 h-3.5" />
          : <ToggleLeft  className="w-3.5 h-3.5" />}
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ─── Inline Form ──────────────────────────────────────────────────────────────

function ResponsableForm({
  form, isEditing, isPending, onChange, onSave, onCancel,
}: {
  form: FormState; isEditing: boolean; isPending: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onSave: () => void; onCancel: () => void;
}) {
  const hasName = form.nombre.trim().length > 0;

  return (
    <div className={cn(
      'border rounded-2xl p-4 mb-4',
      isEditing ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200',
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isEditing
            ? <Pencil className="w-4 h-4 text-blue-600" />
            : <Plus   className="w-4 h-4 text-emerald-600" />}
          <span className={cn('text-sm font-semibold', isEditing ? 'text-blue-900' : 'text-emerald-900')}>
            {isEditing ? 'Editar responsable' : 'Nuevo responsable'}
          </span>
        </div>
        <button onClick={onCancel} disabled={isPending} className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nombre / Empresa <span className="text-red-500">*</span>
          </label>
          <input
            className={INPUT_CLS}
            value={form.nombre}
            onChange={e => onChange({ nombre: e.target.value })}
            placeholder="Nombre completo o razón social"
            disabled={isPending}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo institucional</label>
          <select
            className={INPUT_CLS}
            value={form.id_tipo_entidad}
            onChange={e => onChange({ id_tipo_entidad: Number(e.target.value) as 8 | 22 })}
            disabled={isPending || isEditing}
          >
            <option value={22}>Personal de mantenimiento</option>
            <option value={8}>Proveedor</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Correo electrónico</label>
          <input
            type="email"
            className={INPUT_CLS}
            value={form.email}
            onChange={e => onChange({ email: e.target.value })}
            placeholder="correo@ejemplo.com"
            disabled={isPending}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
          <input
            className={INPUT_CLS}
            value={form.telefono}
            onChange={e => onChange({ telefono: e.target.value })}
            placeholder="10 dígitos"
            disabled={isPending}
          />
        </div>

        <div className="col-span-2 flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
              checked={form.es_supervisor}
              onChange={e => onChange({ es_supervisor: e.target.checked })}
              disabled={isPending}
            />
            <span className="text-sm text-slate-700">Supervisor de Entregas</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-orange-500"
              checked={form.es_tecnico}
              onChange={e => onChange({ es_tecnico: e.target.checked })}
              disabled={isPending}
            />
            <span className="text-sm text-slate-700">Técnico de Entregas</span>
          </label>
          {isEditing && (
            <label className="flex items-center gap-2 cursor-pointer select-none ml-auto">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                checked={form.activo}
                onChange={e => onChange({ activo: e.target.checked })}
                disabled={isPending}
              />
              <span className="text-sm text-slate-700">Activo</span>
            </label>
          )}
        </div>

        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={!hasName || isPending}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg text-white disabled:opacity-50 flex items-center gap-1.5',
              isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700',
            )}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEditing ? 'Guardar cambios' : 'Crear responsable'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResponsablesConfigTab() {
  const qc = useQueryClient();
  const [ddlApplied, setDdlApplied]   = useState<boolean | null>(null);
  const [search, setSearch]           = useState('');
  const [tipoFilter, setTipoFilter]   = useState<TipoFilter>('all');
  const [activoFilter, setActivoFilter] = useState<ActivoFilter>('activo');
  const [supFilter, setSupFilter]     = useState<RolFilter>('all');
  const [tecFilter, setTecFilter]     = useState<RolFilter>('all');
  const [saving, setSaving]           = useState<number | null>(null);
  const [showForm, setShowForm]       = useState(false);
  const [editingEr, setEditingEr]     = useState<EntidadRow | null>(null);
  const [form, setForm]               = useState<FormState>(BLANK_FORM);

  const { data: entidades = [], isLoading } = useQuery<EntidadRow[]>({
    queryKey: ['entregas-responsables-tab'],
    queryFn: async () => {
      // DDL probe: detectar si los indicadores ya existen
      const probe = await (supabase as any)
        .from('entidades_relacionadas')
        .select('id, es_supervisor_entregas, es_tecnico_entregas')
        .limit(0);

      if (probe.error) { setDdlApplied(false); return []; }
      setDdlApplied(true);

      const { data: ers } = await (supabase as any)
        .from('entidades_relacionadas')
        .select(`
          id, id_tipo_entidad, id_proyecto, activo,
          es_supervisor_entregas, es_tecnico_entregas,
          personas!entidades_relacionadas_id_persona_fkey(id, nombre_legal, nombre_comercial, email, telefono)
        `)
        .or('id_tipo_entidad.in.(8,22),es_supervisor_entregas.eq.true,es_tecnico_entregas.eq.true')
        .order('id');

      if (!ers?.length) return [];

      const tipoIds = [...new Set((ers as any[]).map((e: any) => e.id_tipo_entidad))];
      const { data: tipos } = await (supabase as any)
        .from('tipos_entidad').select('id, nombre').in('id', tipoIds);
      const tipoMap: Record<number, string> = Object.fromEntries(
        (tipos ?? []).map((t: any) => [t.id, t.nombre])
      );

      return (ers as any[]).map((er: any) => ({
        erId:            er.id,
        personaId:       er.personas?.id ?? null,
        id_tipo_entidad: er.id_tipo_entidad,
        tipo_nombre:     tipoMap[er.id_tipo_entidad] ?? TIPO_LABEL[er.id_tipo_entidad] ?? `Tipo #${er.id_tipo_entidad}`,
        id_proyecto:     er.id_proyecto ?? null,
        nombre:          er.personas?.nombre_legal || er.personas?.nombre_comercial || `Entidad #${er.id}`,
        email:           er.personas?.email ?? null,
        telefono:        er.personas?.telefono ?? null,
        es_supervisor:   er.es_supervisor_entregas ?? false,
        es_tecnico:      er.es_tecnico_entregas ?? false,
        activo:          er.activo ?? true,
      })) as EntidadRow[];
    },
    staleTime: 30_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (d: FormState & { erId?: number; personaId?: number | null }) => {
      if (d.personaId) {
        // ── Editar responsable existente ──────────────────────────────────────
        const { error: e1 } = await (supabase as any).from('personas').update({
          nombre_legal: d.nombre.trim(),
          email:        d.email.trim() || null,
          telefono:     d.telefono.trim() || null,
        }).eq('id', d.personaId);
        if (e1) throw e1;

        const { error: e2 } = await (supabase as any).from('entidades_relacionadas').update({
          activo:                 d.activo,
          es_supervisor_entregas: d.es_supervisor,
          es_tecnico_entregas:    d.es_tecnico,
        }).eq('id', d.erId);
        if (e2) throw e2;

      } else {
        // ── Alta de responsable nuevo ─────────────────────────────────────────
        // 1. Buscar persona existente por email normalizado
        let personaId: number | null = null;
        const emailNorm = d.email.trim().toLowerCase();
        if (emailNorm) {
          const { data: existing } = await (supabase as any)
            .from('personas').select('id').ilike('email', emailNorm).maybeSingle();
          if (existing) personaId = existing.id;
        }

        // 2. Crear persona si no existe
        if (!personaId) {
          const { data: np, error: e1 } = await (supabase as any).from('personas')
            .insert({ nombre_legal: d.nombre.trim(), email: emailNorm || null, telefono: d.telefono.trim() || null, tipo_persona: 'pf' })
            .select('id').single();
          if (e1) throw e1;
          personaId = np.id;
        }

        // 3. Verificar si ya existe vínculo con este tipo
        const { data: vinculo } = await (supabase as any)
          .from('entidades_relacionadas').select('id, activo')
          .eq('id_persona', personaId)
          .eq('id_tipo_entidad', d.id_tipo_entidad)
          .maybeSingle();

        if (vinculo) {
          if (vinculo.activo) throw new Error('Esta persona ya está registrada con este tipo institucional');
          // Reactivar vínculo inactivo y actualizar indicadores
          const { error: e3 } = await (supabase as any).from('entidades_relacionadas')
            .update({ activo: true, es_supervisor_entregas: d.es_supervisor, es_tecnico_entregas: d.es_tecnico })
            .eq('id', vinculo.id);
          if (e3) throw e3;
        } else {
          // Crear vínculo nuevo con indicadores
          const { error: e4 } = await (supabase as any).from('entidades_relacionadas')
            .insert({ id_persona: personaId, id_tipo_entidad: d.id_tipo_entidad, activo: true,
                      es_supervisor_entregas: d.es_supervisor, es_tecnico_entregas: d.es_tecnico });
          if (e4) throw e4;
        }
      }
    },
    onSuccess: () => {
      toast.success(editingEr ? 'Responsable actualizado' : 'Responsable registrado correctamente');
      qc.invalidateQueries({ queryKey: ['entregas-responsables-tab'] });
      qc.invalidateQueries({ queryKey: ['entregas-responsables-cat'] });
      closeForm();
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al guardar'),
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ erId, activo }: { erId: number; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from('entidades_relacionadas').update({ activo }).eq('id', erId);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.activo ? 'Responsable activado' : 'Responsable desactivado');
      qc.invalidateQueries({ queryKey: ['entregas-responsables-tab'] });
      qc.invalidateQueries({ queryKey: ['entregas-responsables-cat'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al cambiar estado'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggle = async (er: EntidadRow, campo: 'es_supervisor_entregas' | 'es_tecnico_entregas') => {
    setSaving(er.erId);
    const valor = campo === 'es_supervisor_entregas' ? !er.es_supervisor : !er.es_tecnico;
    const { error } = await (supabase as any)
      .from('entidades_relacionadas').update({ [campo]: valor }).eq('id', er.erId);
    if (error) {
      toast.error('Error al actualizar');
    } else {
      toast.success(valor ? 'Rol habilitado' : 'Rol deshabilitado');
      qc.invalidateQueries({ queryKey: ['entregas-responsables-tab'] });
      qc.invalidateQueries({ queryKey: ['entregas-responsables-cat'] });
    }
    setSaving(null);
  };

  const openNew = () => { setEditingEr(null); setForm(BLANK_FORM); setShowForm(true); };

  const openEdit = (er: EntidadRow) => {
    setEditingEr(er);
    setForm({
      nombre:          er.nombre,
      email:           er.email ?? '',
      telefono:        er.telefono ?? '',
      id_tipo_entidad: er.id_tipo_entidad as 8 | 22,
      es_supervisor:   er.es_supervisor,
      es_tecnico:      er.es_tecnico,
      activo:          er.activo,
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingEr(null); };

  const handleSave = () => {
    saveMutation.mutate({ ...form, erId: editingEr?.erId, personaId: editingEr?.personaId });
  };

  // ── Guards ────────────────────────────────────────────────────────────────────

  if (ddlApplied === false) return <DdlBanner />;

  // ── Derived state ─────────────────────────────────────────────────────────────

  const supervisoresActivos = entidades.filter(e => e.es_supervisor && e.activo).length;
  const tecnicosActivos     = entidades.filter(e => e.es_tecnico && e.activo).length;
  const catalogoActivos     = entidades.filter(e => e.activo).length;

  const filtered = entidades.filter(e => {
    if (tipoFilter !== 'all' && e.id_tipo_entidad !== Number(tipoFilter)) return false;
    if (activoFilter === 'activo'   && !e.activo)  return false;
    if (activoFilter === 'inactivo' &&  e.activo)  return false;
    if (supFilter === 'yes' && !e.es_supervisor)   return false;
    if (supFilter === 'no'  &&  e.es_supervisor)   return false;
    if (tecFilter === 'yes' && !e.es_tecnico)      return false;
    if (tecFilter === 'no'  &&  e.es_tecnico)      return false;
    const q = search.toLowerCase();
    return !q || e.nombre.toLowerCase().includes(q) || e.tipo_nombre.toLowerCase().includes(q);
  });

  const hasFilters = search || tipoFilter !== 'all' || supFilter !== 'all' || tecFilter !== 'all' || activoFilter !== 'activo';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard icon={UserCheck} label="Supervisores habilitados" value={supervisoresActivos} cls="bg-blue-50 text-blue-600" />
        <KpiCard icon={Wrench}    label="Técnicos habilitados"     value={tecnicosActivos}     cls="bg-orange-50 text-orange-600" />
        <KpiCard icon={Users}     label="Entidades en catálogo"    value={catalogoActivos}     cls="bg-slate-100 text-slate-600" />
      </div>

      {/* Inline form (nuevo / editar) */}
      {showForm && (
        <ResponsableForm
          form={form}
          isEditing={!!editingEr}
          isPending={saveMutation.isPending}
          onChange={patch => setForm(f => ({ ...f, ...patch }))}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
          <input
            className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            placeholder="Buscar por nombre o tipo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className={SELECT_CLS} value={tipoFilter} onChange={e => setTipoFilter(e.target.value as TipoFilter)}>
          <option value="all">Todos los tipos</option>
          <option value="22">Personal mantenimiento</option>
          <option value="8">Proveedor</option>
        </select>

        <select className={SELECT_CLS} value={supFilter} onChange={e => setSupFilter(e.target.value as RolFilter)}>
          <option value="all">Supervisor: todos</option>
          <option value="yes">Supervisor: sí</option>
          <option value="no">Supervisor: no</option>
        </select>

        <select className={SELECT_CLS} value={tecFilter} onChange={e => setTecFilter(e.target.value as RolFilter)}>
          <option value="all">Técnico: todos</option>
          <option value="yes">Técnico: sí</option>
          <option value="no">Técnico: no</option>
        </select>

        <select className={SELECT_CLS} value={activoFilter} onChange={e => setActivoFilter(e.target.value as ActivoFilter)}>
          <option value="activo">Solo activos</option>
          <option value="inactivo">Solo inactivos</option>
          <option value="all">Todos</option>
        </select>

        <button
          onClick={openNew}
          disabled={showForm}
          className="ml-auto flex items-center gap-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl px-3 py-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Nuevo responsable
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          {hasFilters
            ? 'Sin resultados con los filtros actuales'
            : 'Sin entidades en el catálogo. Usa "+ Nuevo responsable" para agregar el primero.'}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Persona / Empresa</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tipo institucional</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Supervisor Entregas</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Técnico Entregas</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(er => (
                <tr
                  key={er.erId}
                  className={cn(
                    'transition-colors',
                    er.activo ? 'hover:bg-slate-50/60' : 'opacity-60 hover:bg-slate-50/40',
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{er.nombre}</p>
                    {er.id_proyecto && (
                      <p className="text-[10px] text-slate-400">Proyecto #{er.id_proyecto}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-medium">
                      {er.tipo_nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RolToggle
                      active={er.es_supervisor}
                      label={er.es_supervisor ? 'Habilitado' : 'Deshab.'}
                      colorOn="text-blue-600 bg-blue-50"
                      icon={UserCheck}
                      saving={saving === er.erId}
                      onClick={() => toggle(er, 'es_supervisor_entregas')}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RolToggle
                      active={er.es_tecnico}
                      label={er.es_tecnico ? 'Habilitado' : 'Deshab.'}
                      colorOn="text-orange-600 bg-orange-50"
                      icon={Wrench}
                      saving={saving === er.erId}
                      onClick={() => toggle(er, 'es_tecnico_entregas')}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      er.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', er.activo ? 'bg-emerald-500' : 'bg-slate-400')} />
                      {er.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(er)}
                        disabled={showForm}
                        title="Editar"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActivoMutation.mutate({ erId: er.erId, activo: !er.activo })}
                        disabled={toggleActivoMutation.isPending}
                        title={er.activo ? 'Desactivar' : 'Activar'}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors disabled:opacity-50',
                          er.activo
                            ? 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'
                            : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50',
                        )}
                      >
                        <span className={cn('w-2.5 h-2.5 rounded-full inline-block', er.activo ? 'bg-emerald-400' : 'bg-slate-300')} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
