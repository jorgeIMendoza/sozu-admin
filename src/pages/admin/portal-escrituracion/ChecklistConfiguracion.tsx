import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ListChecks, Layers, Package, ChevronDown, ChevronRight,
  Pencil, X, Check, Loader2, AlertTriangle, RotateCcw,
  Settings2, FolderOpen, Info, LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/admin/portal-escrituracion/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plantilla {
  id: number;
  nombre: string;
  tipo_checklist: string;
  descripcion: string | null;
  id_proyecto: number | null;
  id_modelo: number | null;
  activo: boolean;
  fecha_actualizacion: string;
}

interface PlantillaCategoria {
  id: number;
  id_plantilla: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
}

interface PlantillaItem {
  id: number;
  id_plantilla_categoria: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
}

type EditTarget =
  | { type: 'cat';  item: PlantillaCategoria }
  | { type: 'item'; item: PlantillaItem }
  | null;

interface EditFormValues {
  nombre: string;
  descripcion: string;
  orden: string;
  activo: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActiveBadge({ activo }: { activo: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0',
      activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', activo ? 'bg-emerald-500' : 'bg-slate-400')} />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function KpiMini({ icon: Icon, label, value, tone = 'slate' }: {
  icon: LucideIcon; label: string; value: number | string; tone?: 'blue' | 'slate';
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <span className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500',
      )}>
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  );
}

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

function FieldGroup({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function validateForm(
  form: EditFormValues,
  siblings: { id: number; nombre: string }[],
  editingId: number,
): string | null {
  if (!form.nombre.trim()) return 'El nombre es obligatorio';
  const o = Number(form.orden);
  if (!Number.isInteger(o) || o < 1) return 'El orden debe ser un entero positivo (≥ 1)';
  const dup = siblings.find(
    s => s.nombre.trim().toLowerCase() === form.nombre.trim().toLowerCase() && s.id !== editingId,
  );
  if (dup) return `Ya existe "${dup.nombre}" en este mismo grupo`;
  return null;
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  type: 'categoría' | 'ítem';
  form: EditFormValues;
  siblings: { id: number; nombre: string }[];
  editingId: number;
  saving: boolean;
  onChange: (patch: Partial<EditFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ type, form, siblings, editingId, saving, onChange, onSave, onCancel }: EditFormProps) {
  const err = validateForm(form, siblings, editingId);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">Editando {type}</span>
        </div>
        <button onClick={onCancel} disabled={saving}
          className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Nombre" required>
          <input
            className={INPUT_CLS}
            value={form.nombre}
            onChange={e => onChange({ nombre: e.target.value })}
            placeholder="Nombre del elemento"
            disabled={saving}
          />
        </FieldGroup>

        <FieldGroup label="Orden">
          <input
            type="number"
            min="1"
            className={INPUT_CLS}
            value={form.orden}
            onChange={e => onChange({ orden: e.target.value })}
            disabled={saving}
          />
        </FieldGroup>

        <div className="col-span-2">
          <FieldGroup label="Descripción">
            <textarea
              className={cn(INPUT_CLS, 'resize-none')}
              rows={2}
              value={form.descripcion}
              onChange={e => onChange({ descripcion: e.target.value })}
              placeholder="Descripción opcional"
              disabled={saving}
            />
          </FieldGroup>
        </div>

        <div className="col-span-2 flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
              checked={form.activo}
              onChange={e => onChange({ activo: e.target.checked })}
              disabled={saving}
            />
            <span className="text-sm text-slate-700">Activo</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving || !!err}
              title={err ?? undefined}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5" />}
              Guardar cambios
            </button>
          </div>
        </div>

        {err && (
          <div className="col-span-2 flex items-center gap-1.5 text-xs text-red-600 -mt-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {err}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChecklistConfiguracion() {
  const qc = useQueryClient();

  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [editing, setEditing]           = useState<EditTarget>(null);
  const [form, setForm]                 = useState<EditFormValues>({
    nombre: '', descripcion: '', orden: '1', activo: true,
  });

  // ── Queries ──────────────────────────────────────────────────────────────────

  const {
    data: plantillas = [],
    isLoading: loadingPlant,
  } = useQuery<Plantilla[]>({
    queryKey: ['chk-plantillas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('checklist_plantillas')
        .select('*')
        .order('id');
      if (error) throw error;
      return (data ?? []) as Plantilla[];
    },
    staleTime: 30_000,
  });

  const {
    data: categorias = [],
    isLoading: loadingCats,
  } = useQuery<PlantillaCategoria[]>({
    queryKey: ['chk-cats', selectedId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('checklist_plantilla_categorias')
        .select('*')
        .eq('id_plantilla', selectedId!)
        .order('orden');
      if (error) throw error;
      return (data ?? []) as PlantillaCategoria[];
    },
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  const catIds = categorias.map(c => c.id);

  const {
    data: allItems = [],
    isLoading: loadingItems,
  } = useQuery<PlantillaItem[]>({
    queryKey: ['chk-items', selectedId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('checklist_plantilla_items')
        .select('*')
        .in('id_plantilla_categoria', catIds)
        .order('orden');
      if (error) throw error;
      return (data ?? []) as PlantillaItem[];
    },
    enabled: !!selectedId && catIds.length > 0,
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const mutateCat = useMutation({
    mutationFn: async (p: { id: number; nombre: string; descripcion: string | null; orden: number; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from('checklist_plantilla_categorias')
        .update({ nombre: p.nombre, descripcion: p.descripcion, orden: p.orden, activo: p.activo })
        .eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Categoría actualizada correctamente');
      qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al guardar la categoría'),
  });

  const mutateItem = useMutation({
    mutationFn: async (p: { id: number; nombre: string; descripcion: string | null; orden: number; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from('checklist_plantilla_items')
        .update({ nombre: p.nombre, descripcion: p.descripcion, orden: p.orden, activo: p.activo })
        .eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ítem actualizado correctamente');
      qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al guardar el ítem'),
  });

  const saving = mutateCat.isPending || mutateItem.isPending;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const startEditCat = (cat: PlantillaCategoria) => {
    setEditing({ type: 'cat', item: cat });
    setForm({ nombre: cat.nombre, descripcion: cat.descripcion ?? '', orden: String(cat.orden), activo: cat.activo });
  };

  const startEditItem = (item: PlantillaItem) => {
    setEditing({ type: 'item', item: item });
    setForm({ nombre: item.nombre, descripcion: item.descripcion ?? '', orden: String(item.orden), activo: item.activo });
  };

  const handleSave = () => {
    if (!editing) return;
    const payload = {
      id:          editing.item.id,
      nombre:      form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      orden:       Number(form.orden),
      activo:      form.activo,
    };
    editing.type === 'cat' ? mutateCat.mutate(payload) : mutateItem.mutate(payload);
  };

  const handleRecargar = () => {
    qc.invalidateQueries({ queryKey: ['chk-plantillas'] });
    qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] });
    qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
  };

  const toggleCat = (id: number) =>
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectPlantilla = (id: number) => {
    setSelectedId(id);
    setEditing(null);
    setExpandedCats(new Set());
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const selectedPlantilla = plantillas.find(p => p.id === selectedId) ?? null;

  const editingSiblings: { id: number; nombre: string }[] = (() => {
    if (!editing) return [];
    if (editing.type === 'cat') return categorias.map(c => ({ id: c.id, nombre: c.nombre }));
    const catId = (editing.item as PlantillaItem).id_plantilla_categoria;
    return allItems
      .filter(i => i.id_plantilla_categoria === catId)
      .map(i => ({ id: i.id, nombre: i.nombre }));
  })();

  const totalActivePlantillas = plantillas.filter(p => p.activo).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-5 pb-4 bg-white border-b border-slate-100">
        <PageHeader
          title="Configuración de Checklist"
          description="Administra las plantillas que alimentan la generación de pre-entregas"
          action={
            <button
              onClick={handleRecargar}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recargar
            </button>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <KpiMini icon={ListChecks} label="Plantillas activas" value={loadingPlant ? '—' : totalActivePlantillas} tone="blue" />
          <KpiMini icon={Layers}     label={selectedPlantilla ? 'Categorías' : 'Categorías'} value={loadingCats || !selectedId ? (selectedId ? '…' : '—') : categorias.length} />
          <KpiMini icon={Package}    label={selectedPlantilla ? 'Ítems' : 'Ítems'}           value={loadingItems || !selectedId ? (selectedId ? '…' : '—') : allItems.length} />
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Los cambios aplican únicamente a nuevas entregas.</span>{' '}
            Las entregas ya generadas conservan su snapshot histórico y no serán modificadas retroactivamente.
          </p>
        </div>
      </div>

      {/* ── Split layout ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: plantilla list ─────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Plantillas ({plantillas.length})
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingPlant ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
              </div>
            ) : plantillas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Sin plantillas registradas</p>
            ) : (
              plantillas.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPlantilla(p.id)}
                  className={cn(
                    'w-full text-left rounded-xl p-3 border transition-all',
                    selectedId === p.id
                      ? 'border-blue-200 bg-blue-50 shadow-sm'
                      : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/70',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={cn(
                      'text-sm font-semibold truncate',
                      selectedId === p.id ? 'text-blue-900' : 'text-slate-800',
                    )}>
                      {p.nombre}
                    </span>
                    <ActiveBadge activo={p.activo} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-slate-400">{p.tipo_checklist}</p>
                    <p className="text-[11px] text-slate-400">
                      {p.id_modelo
                        ? `Modelo ID ${p.id_modelo}`
                        : p.id_proyecto
                        ? `Proyecto ID ${p.id_proyecto}`
                        : 'Alcance global'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: detail ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-slate-50/40">
          {!selectedPlantilla ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-1">Selecciona una plantilla</p>
                <p className="text-xs text-slate-400">Verás sus categorías e ítems aquí para revisarlos y editarlos</p>
              </div>
            </div>
          ) : (
            <div className="p-5">
              {/* Plantilla header */}
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Settings2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-slate-800">{selectedPlantilla.nombre}</span>
                    <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                      {selectedPlantilla.tipo_checklist}
                    </span>
                    <ActiveBadge activo={selectedPlantilla.activo} />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {selectedPlantilla.id_modelo
                      ? `Plantilla específica — Modelo ID ${selectedPlantilla.id_modelo}`
                      : selectedPlantilla.id_proyecto
                      ? `Plantilla específica — Proyecto ID ${selectedPlantilla.id_proyecto}`
                      : 'Plantilla global — aplica a todas las unidades sin plantilla específica'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-400">{categorias.length} categorías · {allItems.length} ítems</p>
                </div>
              </div>

              {/* Edit form */}
              {editing && (
                <EditForm
                  type={editing.type === 'cat' ? 'categoría' : 'ítem'}
                  form={form}
                  siblings={editingSiblings}
                  editingId={editing.item.id}
                  saving={saving}
                  onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                />
              )}

              {/* Categories list */}
              {loadingCats ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : categorias.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  Esta plantilla no tiene categorías
                </div>
              ) : (
                <div className="space-y-2">
                  {categorias.map(cat => {
                    const catItems  = allItems.filter(i => i.id_plantilla_categoria === cat.id);
                    const expanded  = expandedCats.has(cat.id);
                    const isEditing = editing?.type === 'cat' && editing.item.id === cat.id;

                    return (
                      <div
                        key={cat.id}
                        className={cn(
                          'bg-white border rounded-2xl overflow-hidden transition-all',
                          isEditing ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200',
                        )}
                      >
                        {/* Category header row */}
                        <div className="flex items-center gap-2 px-4 py-3">
                          <button
                            onClick={() => toggleCat(cat.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
                            <span className="text-[11px] font-mono text-slate-300 w-5 shrink-0 text-right">
                              {cat.orden}
                            </span>
                            {expanded
                              ? <ChevronDown  className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            <span className={cn(
                              'text-sm font-semibold flex-1 truncate',
                              cat.activo ? 'text-slate-800' : 'text-slate-400 line-through',
                            )}>
                              {cat.nombre}
                            </span>
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            <ActiveBadge activo={cat.activo} />
                            <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                              {catItems.length} ítems
                            </span>
                            <button
                              onClick={() => startEditCat(cat)}
                              title="Editar categoría"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {cat.descripcion && !expanded && (
                          <p className="px-11 pb-2.5 text-[11px] text-slate-400 truncate">{cat.descripcion}</p>
                        )}

                        {/* Items */}
                        {expanded && (
                          <div className="border-t border-slate-100 bg-slate-50/60">
                            {loadingItems ? (
                              <div className="flex justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                              </div>
                            ) : catItems.length === 0 ? (
                              <p className="text-center text-xs text-slate-400 py-4">Sin ítems en esta categoría</p>
                            ) : (
                              <div className="divide-y divide-slate-100/80">
                                {catItems.map(item => {
                                  const itemEditing = editing?.type === 'item' && editing.item.id === item.id;
                                  return (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        'flex items-center gap-2.5 px-6 py-2.5 transition-colors',
                                        itemEditing ? 'bg-blue-50/60' : 'hover:bg-white/60',
                                      )}
                                    >
                                      <span className="text-[10px] font-mono text-slate-300 w-4 text-right shrink-0">
                                        {item.orden}
                                      </span>
                                      <span className={cn(
                                        'text-xs flex-1 min-w-0 truncate',
                                        item.activo ? 'text-slate-700' : 'text-slate-400 line-through',
                                      )}>
                                        {item.nombre}
                                      </span>
                                      {item.descripcion && (
                                        <span className="text-[10px] text-slate-400 truncate max-w-[100px] hidden md:block">
                                          {item.descripcion}
                                        </span>
                                      )}
                                      <ActiveBadge activo={item.activo} />
                                      <button
                                        onClick={() => startEditItem(item)}
                                        title="Editar ítem"
                                        className="p-1 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors shrink-0"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
