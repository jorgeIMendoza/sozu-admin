import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ListChecks, Layers, Package, ChevronDown, ChevronRight,
  Pencil, X, Check, Loader2, AlertTriangle, RotateCcw,
  Settings2, FolderOpen, Info, LucideIcon,
  ArrowUp, ArrowDown, Plus, Search, Eye, EyeOff,
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

interface Sibling {
  id: number;
  nombre: string;
  orden: number;
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

function HighlightText({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-800 rounded px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function validateForm(form: EditFormValues, siblings: Sibling[], editingId: number): string | null {
  if (!form.nombre.trim()) return 'El nombre es obligatorio';
  const o = Number(form.orden);
  if (!Number.isInteger(o) || o < 1) return 'El orden debe ser un entero positivo (≥ 1)';
  const dupNombre = siblings.find(
    s => s.nombre.trim().toLowerCase() === form.nombre.trim().toLowerCase() && s.id !== editingId,
  );
  if (dupNombre) return `Ya existe "${dupNombre.nombre}" en este mismo grupo`;
  const dupOrden = siblings.find(s => s.activo && s.orden === o && s.id !== editingId);
  if (dupOrden) return `Orden ${o} ya está en uso por un elemento activo`;
  return null;
}

// ─── Item Form (create & edit) ────────────────────────────────────────────────

interface ItemFormProps {
  mode: 'create' | 'edit';
  type: 'categoría' | 'ítem';
  form: EditFormValues;
  siblings: Sibling[];
  editingId: number;
  saving: boolean;
  onChange: (patch: Partial<EditFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ItemForm({ mode, type, form, siblings, editingId, saving, onChange, onSave, onCancel }: ItemFormProps) {
  const err = validateForm(form, siblings, editingId);
  const isCreate = mode === 'create';

  return (
    <div className={cn(
      'border rounded-2xl p-4',
      isCreate ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200',
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isCreate
            ? <Plus className="w-4 h-4 text-emerald-600" />
            : <Pencil className="w-4 h-4 text-blue-600" />}
          <span className={cn('text-sm font-semibold', isCreate ? 'text-emerald-900' : 'text-blue-900')}>
            {isCreate ? `Nueva ${type}` : `Editando ${type}`}
          </span>
        </div>
        <button onClick={onCancel} disabled={saving} className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Nombre" required>
          <input
            className={INPUT_CLS}
            value={form.nombre}
            onChange={e => onChange({ nombre: e.target.value })}
            placeholder={`Nombre de la ${type}`}
            disabled={saving}
            autoFocus
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

        {!isCreate && type !== 'categoría' && (
          <div className="col-span-2">
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
          </div>
        )}

        <div className="col-span-2 flex items-center justify-between pt-1 gap-3">
          <div className="flex-1 min-w-0">
            {err && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{err}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
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
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5',
                isCreate ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700',
              )}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isCreate ? `Crear ${type}` : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Desactivar Dialog ────────────────────────────────────────────────

function ConfirmDesactivar({
  cat, catItems, isPending, onConfirm, onCancel,
}: {
  cat: PlantillaCategoria;
  catItems: PlantillaItem[];
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const active = catItems.filter(i => i.activo);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Desactivar categoría</h3>
            <p className="text-sm text-slate-600">
              Vas a desactivar <span className="font-semibold">"{cat.nombre}"</span>.
            </p>
          </div>
        </div>

        {active.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              También se desactivarán sus {active.length} ítem{active.length !== 1 ? 's' : ''} activo{active.length !== 1 ? 's' : ''}:
            </p>
            <ul className="space-y-0.5 max-h-36 overflow-y-auto">
              {active.map(item => (
                <li key={item.id} className="text-xs text-amber-700 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                  {item.nombre}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-slate-400 mb-5">Las entregas ya generadas no se verán afectadas.</p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Desactivar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChecklistConfiguracion() {
  const qc = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId]                     = useState<number | null>(null);
  const [expandedCats, setExpandedCats]                 = useState<Set<number>>(new Set());
  const [editing, setEditing]                           = useState<EditTarget>(null);
  const [form, setForm]                                 = useState<EditFormValues>({ nombre: '', descripcion: '', orden: '1', activo: true });

  const [addingCat, setAddingCat]                       = useState(false);
  const [newCatForm, setNewCatForm]                     = useState<EditFormValues>({ nombre: '', descripcion: '', orden: '1', activo: true });

  const [addingItemForCat, setAddingItemForCat]         = useState<number | null>(null);
  const [newItemForm, setNewItemForm]                   = useState<EditFormValues>({ nombre: '', descripcion: '', orden: '1', activo: true });

  const [confirmDesactivarCat, setConfirmDesactivarCat] = useState<PlantillaCategoria | null>(null);
  const [searchTerm, setSearchTerm]                     = useState('');
  const [showPreview, setShowPreview]                   = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: plantillas = [], isLoading: loadingPlant } = useQuery<Plantilla[]>({
    queryKey: ['chk-plantillas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('checklist_plantillas').select('*').order('id');
      if (error) throw error;
      return (data ?? []) as Plantilla[];
    },
    staleTime: 30_000,
  });

  const { data: categorias = [], isLoading: loadingCats } = useQuery<PlantillaCategoria[]>({
    queryKey: ['chk-cats', selectedId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('checklist_plantilla_categorias').select('*').eq('id_plantilla', selectedId!).order('orden');
      if (error) throw error;
      return (data ?? []) as PlantillaCategoria[];
    },
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  const catIds = categorias.map(c => c.id);

  const { data: allItems = [], isLoading: loadingItems } = useQuery<PlantillaItem[]>({
    queryKey: ['chk-items', selectedId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('checklist_plantilla_items').select('*').in('id_plantilla_categoria', catIds).order('orden');
      if (error) throw error;
      return (data ?? []) as PlantillaItem[];
    },
    enabled: !!selectedId && catIds.length > 0,
    staleTime: 30_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const mutateCat = useMutation({
    mutationFn: async (p: { id: number; nombre: string; descripcion: string | null; orden: number; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from('checklist_plantilla_categorias')
        .update({ nombre: p.nombre, descripcion: p.descripcion, orden: p.orden, activo: p.activo })
        .eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Categoría actualizada');
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
      toast.success('Ítem actualizado');
      qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al guardar el ítem'),
  });

  const insertCat = useMutation({
    mutationFn: async (p: { id_plantilla: number; nombre: string; descripcion: string | null; orden: number }) => {
      const { error } = await (supabase as any)
        .from('checklist_plantilla_categorias')
        .insert({ id_plantilla: p.id_plantilla, nombre: p.nombre, descripcion: p.descripcion, orden: p.orden, activo: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Categoría creada correctamente');
      qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] });
      setAddingCat(false);
      setNewCatForm({ nombre: '', descripcion: '', orden: '1', activo: true });
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al crear la categoría'),
  });

  const insertItem = useMutation({
    mutationFn: async (p: { id_plantilla_categoria: number; nombre: string; descripcion: string | null; orden: number }) => {
      const { error } = await (supabase as any)
        .from('checklist_plantilla_items')
        .insert({ id_plantilla_categoria: p.id_plantilla_categoria, nombre: p.nombre, descripcion: p.descripcion, orden: p.orden, activo: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ítem creado correctamente');
      qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
      setAddingItemForCat(null);
      setNewItemForm({ nombre: '', descripcion: '', orden: '1', activo: true });
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al crear el ítem'),
  });

  const desactivarCategoria = useMutation({
    mutationFn: async (catId: number) => {
      const { error: e1 } = await (supabase as any)
        .from('checklist_plantilla_categorias').update({ activo: false }).eq('id', catId);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from('checklist_plantilla_items').update({ activo: false }).eq('id_plantilla_categoria', catId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success('Categoría e ítems desactivados');
      qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] });
      qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
      setConfirmDesactivarCat(null);
    },
    onError: (e: any) => {
      toast.error(e.message ?? 'Error al desactivar');
      qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] });
      qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
    },
  });

  const reactivarCategoria = useMutation({
    mutationFn: async (catId: number) => {
      const { error } = await (supabase as any)
        .from('checklist_plantilla_categorias').update({ activo: true }).eq('id', catId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info('Categoría reactivada. Revisa manualmente qué ítems deben estar activos.');
      qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al reactivar'),
  });

  const toggleActivoItem = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await (supabase as any)
        .from('checklist_plantilla_items').update({ activo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.activo ? 'Ítem reactivado' : 'Ítem desactivado');
      qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al cambiar estado del ítem'),
  });

  const reordenarCat = useMutation({
    mutationFn: async (p: { a: { id: number; orden: number }; b: { id: number; orden: number } }) => {
      const { error: e1 } = await (supabase as any)
        .from('checklist_plantilla_categorias').update({ orden: p.a.orden }).eq('id', p.a.id);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from('checklist_plantilla_categorias').update({ orden: p.b.orden }).eq('id', p.b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] }),
    onError: (e: any) => {
      toast.error(e.message ?? 'Error al reordenar');
      qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] });
    },
  });

  const reordenarItem = useMutation({
    mutationFn: async (p: { a: { id: number; orden: number }; b: { id: number; orden: number } }) => {
      const { error: e1 } = await (supabase as any)
        .from('checklist_plantilla_items').update({ orden: p.a.orden }).eq('id', p.a.id);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from('checklist_plantilla_items').update({ orden: p.b.orden }).eq('id', p.b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chk-items', selectedId] }),
    onError: (e: any) => {
      toast.error(e.message ?? 'Error al reordenar');
      qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
    },
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const anyPending =
    mutateCat.isPending || mutateItem.isPending ||
    insertCat.isPending || insertItem.isPending ||
    desactivarCategoria.isPending || reactivarCategoria.isPending ||
    toggleActivoItem.isPending || reordenarCat.isPending || reordenarItem.isPending;

  const searchTrimmed = searchTerm.trim().toLowerCase();
  const canReorder    = !searchTrimmed;

  const allSortedCats = [...categorias].sort((a, b) => a.orden - b.orden);

  const filteredCats = searchTrimmed
    ? categorias.filter(cat => {
        if (cat.nombre.toLowerCase().includes(searchTrimmed)) return true;
        return allItems.filter(i => i.id_plantilla_categoria === cat.id)
          .some(i => i.nombre.toLowerCase().includes(searchTrimmed));
      })
    : categorias;

  const sortedCats = [...filteredCats].sort((a, b) => a.orden - b.orden);

  const getIsExpanded = (cat: PlantillaCategoria, catItemsSorted: PlantillaItem[]) => {
    if (searchTrimmed) return catItemsSorted.some(i => i.nombre.toLowerCase().includes(searchTrimmed));
    return expandedCats.has(cat.id);
  };

  const editingSiblings: Sibling[] = (() => {
    if (!editing) return [];
    if (editing.type === 'cat') {
      return categorias.map(c => ({ id: c.id, nombre: c.nombre, orden: c.orden, activo: c.activo }));
    }
    const catId = (editing.item as PlantillaItem).id_plantilla_categoria;
    return allItems.filter(i => i.id_plantilla_categoria === catId)
      .map(i => ({ id: i.id, nombre: i.nombre, orden: i.orden, activo: i.activo }));
  })();

  const newCatSiblings: Sibling[] = categorias.map(c => ({ id: c.id, nombre: c.nombre, orden: c.orden, activo: c.activo }));

  const newItemSiblings: Sibling[] = addingItemForCat
    ? allItems.filter(i => i.id_plantilla_categoria === addingItemForCat)
        .map(i => ({ id: i.id, nombre: i.nombre, orden: i.orden, activo: i.activo }))
    : [];

  const previewCats = allSortedCats
    .filter(c => c.activo)
    .map(cat => ({
      ...cat,
      activeItemCount: allItems.filter(i => i.id_plantilla_categoria === cat.id && i.activo).length,
    }));
  const totalPreviewItems = previewCats.reduce((s, c) => s + c.activeItemCount, 0);

  const selectedPlantilla  = plantillas.find(p => p.id === selectedId) ?? null;
  const totalActivePlant   = plantillas.filter(p => p.activo).length;
  const activeItemCount    = allItems.filter(i => i.activo).length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRecargar = () => {
    qc.invalidateQueries({ queryKey: ['chk-plantillas'] });
    qc.invalidateQueries({ queryKey: ['chk-cats', selectedId] });
    qc.invalidateQueries({ queryKey: ['chk-items', selectedId] });
  };

  const selectPlantilla = (id: number) => {
    setSelectedId(id);
    setEditing(null);
    setExpandedCats(new Set());
    setAddingCat(false);
    setAddingItemForCat(null);
    setSearchTerm('');
    setShowPreview(false);
  };

  const toggleCat = (id: number) =>
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const startEditCat = (cat: PlantillaCategoria) => {
    setEditing({ type: 'cat', item: cat });
    setForm({ nombre: cat.nombre, descripcion: cat.descripcion ?? '', orden: String(cat.orden), activo: cat.activo });
    setAddingCat(false);
    setAddingItemForCat(null);
  };

  const startEditItem = (item: PlantillaItem) => {
    setEditing({ type: 'item', item });
    setForm({ nombre: item.nombre, descripcion: item.descripcion ?? '', orden: String(item.orden), activo: item.activo });
    setAddingCat(false);
    setAddingItemForCat(null);
    setExpandedCats(prev => { const next = new Set(prev); next.add(item.id_plantilla_categoria); return next; });
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

  const openAddCat = () => {
    const nextOrden = categorias.length > 0 ? Math.max(...categorias.map(c => c.orden)) + 1 : 1;
    setNewCatForm({ nombre: '', descripcion: '', orden: String(nextOrden), activo: true });
    setAddingCat(true);
    setEditing(null);
    setAddingItemForCat(null);
  };

  const openAddItem = (catId: number) => {
    const catItems = allItems.filter(i => i.id_plantilla_categoria === catId);
    const nextOrden = catItems.length > 0 ? Math.max(...catItems.map(i => i.orden)) + 1 : 1;
    setNewItemForm({ nombre: '', descripcion: '', orden: String(nextOrden), activo: true });
    setAddingItemForCat(catId);
    setEditing(null);
    setAddingCat(false);
    setExpandedCats(prev => { const next = new Set(prev); next.add(catId); return next; });
  };

  const handleCreateCat = () => {
    if (!selectedId) return;
    insertCat.mutate({
      id_plantilla: selectedId,
      nombre:       newCatForm.nombre.trim(),
      descripcion:  newCatForm.descripcion.trim() || null,
      orden:        Number(newCatForm.orden),
    });
  };

  const handleCreateItem = () => {
    if (!addingItemForCat) return;
    insertItem.mutate({
      id_plantilla_categoria: addingItemForCat,
      nombre:                 newItemForm.nombre.trim(),
      descripcion:            newItemForm.descripcion.trim() || null,
      orden:                  Number(newItemForm.orden),
    });
  };

  const handleToggleCatActivo = (cat: PlantillaCategoria) => {
    if (cat.activo) {
      setConfirmDesactivarCat(cat);
    } else {
      reactivarCategoria.mutate(cat.id);
    }
  };

  const handleReordenarCat = (cat: PlantillaCategoria, dir: 'up' | 'down') => {
    const sorted = [...categorias].sort((a, b) => a.orden - b.orden);
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    reordenarCat.mutate({ a: { id: cat.id, orden: other.orden }, b: { id: other.id, orden: cat.orden } });
  };

  const handleReordenarItem = (item: PlantillaItem, catItemsSorted: PlantillaItem[], dir: 'up' | 'down') => {
    const idx = catItemsSorted.findIndex(i => i.id === item.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= catItemsSorted.length) return;
    const other = catItemsSorted[swapIdx];
    reordenarItem.mutate({ a: { id: item.id, orden: other.orden }, b: { id: other.id, orden: item.orden } });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Confirmation dialog */}
      {confirmDesactivarCat && (
        <ConfirmDesactivar
          cat={confirmDesactivarCat}
          catItems={allItems.filter(i => i.id_plantilla_categoria === confirmDesactivarCat.id)}
          isPending={desactivarCategoria.isPending}
          onConfirm={() => desactivarCategoria.mutate(confirmDesactivarCat.id)}
          onCancel={() => setConfirmDesactivarCat(null)}
        />
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
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

        <div className="grid grid-cols-3 gap-3 mb-4">
          <KpiMini icon={ListChecks} label="Plantillas activas" value={loadingPlant ? '—' : totalActivePlant} tone="blue" />
          <KpiMini icon={Layers}     label="Categorías"         value={!selectedId ? '—' : loadingCats  ? '…' : categorias.length} />
          <KpiMini icon={Package}    label="Ítems activos"      value={!selectedId ? '—' : loadingItems ? '…' : activeItemCount} />
        </div>

        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Los cambios aplican únicamente a nuevas entregas.</span>{' '}
            Las entregas ya generadas conservan su snapshot histórico y no serán modificadas retroactivamente.
          </p>
        </div>
      </div>

      {/* ── Split layout ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left sidebar */}
        <div className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Plantillas ({plantillas.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingPlant ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
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
                    <span className={cn('text-sm font-semibold truncate', selectedId === p.id ? 'text-blue-900' : 'text-slate-800')}>
                      {p.nombre}
                    </span>
                    <ActiveBadge activo={p.activo} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-slate-400">{p.tipo_checklist}</p>
                    <p className="text-[11px] text-slate-400">
                      {p.id_modelo ? `Modelo ID ${p.id_modelo}` : p.id_proyecto ? `Proyecto ID ${p.id_proyecto}` : 'Alcance global'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto bg-slate-50/40">
          {!selectedPlantilla ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-1">Selecciona una plantilla</p>
                <p className="text-xs text-slate-400">Verás sus categorías e ítems aquí para administrarlos</p>
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
                <div className="text-right shrink-0 text-[11px] text-slate-400">
                  {categorias.length} cat · {allItems.length} ítems
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                  <input
                    className="w-full border border-slate-200 rounded-lg pl-8 pr-7 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    placeholder="Buscar categorías o ítems..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowPreview(v => !v)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors whitespace-nowrap',
                    showPreview
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  Vista previa
                </button>
              </div>

              {/* Preview panel */}
              {showPreview && (
                <div className="bg-white border border-blue-100 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-semibold text-blue-800">
                      Vista previa — Así se verá la próxima pre-entrega
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400 shrink-0">
                      {previewCats.length} cats · {totalPreviewItems} ítems
                    </span>
                  </div>
                  {previewCats.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Sin categorías activas</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      {previewCats.map((cat, i) => (
                        <div key={cat.id} className="flex items-center gap-1.5 text-xs text-slate-600 py-0.5">
                          <span className="text-slate-300 font-mono w-5 text-right shrink-0">{i + 1}.</span>
                          <span className="flex-1 truncate">{cat.nombre}</span>
                          <span className="text-slate-400 shrink-0">({cat.activeItemCount})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                    Solo se incluyen categorías e ítems con activo = true
                  </p>
                </div>
              )}

              {/* Add category: form or button */}
              <div className="mb-4">
                {addingCat ? (
                  <ItemForm
                    mode="create"
                    type="categoría"
                    form={newCatForm}
                    siblings={newCatSiblings}
                    editingId={-1}
                    saving={insertCat.isPending}
                    onChange={patch => setNewCatForm(prev => ({ ...prev, ...patch }))}
                    onSave={handleCreateCat}
                    onCancel={() => setAddingCat(false)}
                  />
                ) : (
                  <button
                    onClick={openAddCat}
                    disabled={anyPending}
                    className="flex items-center gap-2 w-full text-sm text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva categoría
                  </button>
                )}
              </div>

              {/* Categories */}
              {loadingCats ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : sortedCats.length === 0 ? (
                searchTrimmed ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-slate-400">
                      Sin resultados para <span className="font-medium">"{searchTerm}"</span>
                    </p>
                    <button onClick={() => setSearchTerm('')} className="mt-2 text-xs text-blue-500 hover:underline">
                      Limpiar búsqueda
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    Esta plantilla no tiene categorías
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {sortedCats.map(cat => {
                    const catItemsSorted = allItems
                      .filter(i => i.id_plantilla_categoria === cat.id)
                      .sort((a, b) => a.orden - b.orden);
                    const expanded       = getIsExpanded(cat, catItemsSorted);
                    const isEditingCat   = editing?.type === 'cat' && editing.item.id === cat.id;
                    const isAddingHere   = addingItemForCat === cat.id;
                    const activeItems    = catItemsSorted.filter(i => i.activo).length;
                    const hasInactive    = catItemsSorted.some(i => !i.activo);

                    const globalIdx = allSortedCats.findIndex(c => c.id === cat.id);
                    const isFirst   = globalIdx === 0;
                    const isLast    = globalIdx === allSortedCats.length - 1;

                    // Inline cat edit — replace card with form
                    if (isEditingCat) {
                      return (
                        <ItemForm
                          key={cat.id}
                          mode="edit"
                          type="categoría"
                          form={form}
                          siblings={editingSiblings}
                          editingId={editing!.item.id}
                          saving={mutateCat.isPending}
                          onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
                          onSave={handleSave}
                          onCancel={() => setEditing(null)}
                        />
                      );
                    }

                    return (
                      <div
                        key={cat.id}
                        className={cn(
                          'bg-white border rounded-2xl overflow-hidden transition-all',
                          'border-slate-200',
                          !cat.activo && 'opacity-70',
                        )}
                      >
                        {/* Category row */}
                        <div className="flex items-center gap-2 px-4 py-3">
                          <button
                            onClick={() => toggleCat(cat.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
                            <span className="text-[11px] font-mono text-slate-300 w-5 shrink-0 text-right">{cat.orden}</span>
                            {expanded
                              ? <ChevronDown  className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <span className={cn(
                                'text-sm font-semibold',
                                cat.activo ? 'text-slate-800' : 'text-slate-400 line-through',
                              )}>
                                <HighlightText text={cat.nombre} term={searchTrimmed} />
                              </span>
                              {hasInactive && cat.activo && (
                                <span className="ml-2 text-[10px] text-amber-500">
                                  {activeItems}/{catItemsSorted.length} ítems activos
                                </span>
                              )}
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                              {catItemsSorted.length}
                            </span>

                            {/* Reorder */}
                            <button
                              onClick={() => handleReordenarCat(cat, 'up')}
                              disabled={isFirst || !canReorder || anyPending}
                              title={!canReorder ? 'Limpiar búsqueda para reordenar' : 'Subir'}
                              className="p-1 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleReordenarCat(cat, 'down')}
                              disabled={isLast || !canReorder || anyPending}
                              title={!canReorder ? 'Limpiar búsqueda para reordenar' : 'Bajar'}
                              className="p-1 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => startEditCat(cat)}
                              title="Editar categoría"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Toggle activo */}
                            <button
                              onClick={() => handleToggleCatActivo(cat)}
                              disabled={anyPending}
                              title={cat.activo ? 'Desactivar categoría' : 'Reactivar categoría'}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors disabled:opacity-50',
                                cat.activo
                                  ? 'text-emerald-500 hover:text-amber-500 hover:bg-amber-50'
                                  : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50',
                              )}
                            >
                              <span className={cn('w-2.5 h-2.5 rounded-full inline-block', cat.activo ? 'bg-emerald-400' : 'bg-slate-300')} />
                            </button>
                          </div>
                        </div>

                        {/* Items section */}
                        {expanded && (
                          <div className="border-t border-slate-100 bg-slate-50/60">
                            {loadingItems ? (
                              <div className="flex justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                              </div>
                            ) : (
                              <div>
                                {catItemsSorted.length === 0 && !isAddingHere && (
                                  <p className="text-center text-xs text-slate-400 py-3">Sin ítems — añade el primero</p>
                                )}

                                {catItemsSorted.length > 0 && (
                                  <div className="divide-y divide-slate-100/80">
                                    {catItemsSorted.map((item, itemIdx) => {
                                      const isEditingItem = editing?.type === 'item' && editing.item.id === item.id;
                                      const isFirstItem   = itemIdx === 0;
                                      const isLastItem    = itemIdx === catItemsSorted.length - 1;

                                      // Inline item edit
                                      if (isEditingItem) {
                                        return (
                                          <div key={item.id} className="p-3">
                                            <ItemForm
                                              mode="edit"
                                              type="ítem"
                                              form={form}
                                              siblings={editingSiblings}
                                              editingId={editing!.item.id}
                                              saving={mutateItem.isPending}
                                              onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
                                              onSave={handleSave}
                                              onCancel={() => setEditing(null)}
                                            />
                                          </div>
                                        );
                                      }

                                      return (
                                        <div
                                          key={item.id}
                                          className={cn(
                                            'flex items-center gap-2 px-5 py-2 transition-colors hover:bg-white/60',
                                            !item.activo && 'opacity-50',
                                          )}
                                        >
                                          <span className="text-[10px] font-mono text-slate-300 w-5 text-right shrink-0">
                                            {item.orden}
                                          </span>
                                          <span className={cn(
                                            'text-xs flex-1 min-w-0 truncate',
                                            item.activo ? 'text-slate-700' : 'text-slate-400 line-through',
                                          )}>
                                            <HighlightText text={item.nombre} term={searchTrimmed} />
                                          </span>

                                          <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                              onClick={() => handleReordenarItem(item, catItemsSorted, 'up')}
                                              disabled={isFirstItem || !canReorder || anyPending}
                                              title={!canReorder ? 'Limpiar búsqueda para reordenar' : 'Subir ítem'}
                                              className="p-1 rounded text-slate-200 hover:text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed"
                                            >
                                              <ArrowUp className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => handleReordenarItem(item, catItemsSorted, 'down')}
                                              disabled={isLastItem || !canReorder || anyPending}
                                              title={!canReorder ? 'Limpiar búsqueda para reordenar' : 'Bajar ítem'}
                                              className="p-1 rounded text-slate-200 hover:text-slate-500 disabled:opacity-20 disabled:cursor-not-allowed"
                                            >
                                              <ArrowDown className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => startEditItem(item)}
                                              title="Editar ítem"
                                              className="p-1 rounded text-slate-200 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => toggleActivoItem.mutate({ id: item.id, activo: !item.activo })}
                                              disabled={anyPending}
                                              title={item.activo ? 'Desactivar ítem' : 'Reactivar ítem'}
                                              className={cn(
                                                'p-1 rounded transition-colors disabled:opacity-50',
                                                item.activo
                                                  ? 'text-emerald-400 hover:text-amber-400'
                                                  : 'text-slate-300 hover:text-emerald-500',
                                              )}
                                            >
                                              <span className={cn('w-2 h-2 rounded-full inline-block', item.activo ? 'bg-emerald-400' : 'bg-slate-300')} />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* New item form */}
                                {isAddingHere && (
                                  <div className={cn('p-3', catItemsSorted.length > 0 && 'border-t border-slate-100')}>
                                    <ItemForm
                                      mode="create"
                                      type="ítem"
                                      form={newItemForm}
                                      siblings={newItemSiblings}
                                      editingId={-1}
                                      saving={insertItem.isPending}
                                      onChange={patch => setNewItemForm(prev => ({ ...prev, ...patch }))}
                                      onSave={handleCreateItem}
                                      onCancel={() => setAddingItemForCat(null)}
                                    />
                                  </div>
                                )}

                                {/* Add item button */}
                                {!isAddingHere && (
                                  <div className={cn('px-5 py-2', catItemsSorted.length > 0 && 'border-t border-slate-100/80')}>
                                    <button
                                      onClick={() => openAddItem(cat.id)}
                                      disabled={anyPending}
                                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Agregar ítem a "{cat.nombre}"
                                    </button>
                                  </div>
                                )}
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
