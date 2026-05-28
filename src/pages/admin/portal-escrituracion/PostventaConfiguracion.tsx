import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  X, Plus, Pencil, Trash2, ChevronRight, Search, Loader2,
  ShieldCheck, Users, Building2, Settings2, AlertTriangle,
  Check, ChevronLeft, User,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  vigencia_dias: number | null;
  sla_critico_horas: number;
  sla_media_horas: number;
  sla_baja_dias: number;
  aplica_a: string | null;
  evidencia_obligatoria: boolean;
  activo: boolean;
}

interface CategoriaPersonal {
  id: number;
  id_categoria: number;
  id_persona: number;
  id_tipo_entidad: number;
  activo: boolean;
  personas: {
    id: number;
    nombre: string | null;
    apellido_paterno: string | null;
    apellido_materno: string | null;
    email: string | null;
    telefono: string | null;
  };
}

interface Persona {
  id: number;
  nombre: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  email: string | null;
  telefono: string | null;
}

interface TipoEntidad {
  id: number;
  nombre: string;
}

const APLICA_OPTIONS = [
  { value: 'TODAS', label: 'Todas las unidades' },
  { value: 'DEPARTAMENTO', label: 'Departamento' },
  { value: 'CASA', label: 'Casa' },
  { value: 'LOCAL', label: 'Local comercial' },
  { value: 'BODEGA', label: 'Bodega' },
];

const EMPTY_CAT_FORM: Omit<Categoria, 'id'> = {
  nombre: '',
  descripcion: null,
  vigencia_dias: 365,
  sla_critico_horas: 4,
  sla_media_horas: 24,
  sla_baja_dias: 5,
  aplica_a: 'TODAS',
  evidencia_obligatoria: false,
  activo: true,
};

function personaLabel(p: Pick<Persona, 'nombre' | 'apellido_paterno' | 'apellido_materno' | 'email'>): string {
  const parts = [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (p.email ?? 'Sin nombre');
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PostventaConfiguracionProps {
  open: boolean;
  onClose: () => void;
}

export default function PostventaConfiguracion({ open, onClose }: PostventaConfiguracionProps) {
  const qc = useQueryClient();

  // ── UI state
  const [selectedCatId, setSelectedCatId]   = useState<number | null>(null);
  const [editingCatId, setEditingCatId]     = useState<number | 'new' | null>(null);
  const [catForm, setCatForm]               = useState<Omit<Categoria, 'id'>>(EMPTY_CAT_FORM);
  const [addMode, setAddMode]               = useState<'mantenimiento' | 'proveedor' | null>(null);
  const [searchPersona, setSearchPersona]   = useState('');
  const [savingCat, setSavingCat]           = useState(false);
  const [mobileView, setMobileView]         = useState<'list' | 'detail'>('list');

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedCatId(null);
      setEditingCatId(null);
      setCatForm(EMPTY_CAT_FORM);
      setAddMode(null);
      setSearchPersona('');
      setMobileView('list');
    }
  }, [open]);

  // ── DDL probe: does postventa_categorias_personal exist?
  const { data: ddlReady } = useQuery<boolean>({
    queryKey: ['pv-config-ddl-probe'],
    queryFn: async () => {
      const probe = await (supabase as any)
        .from('postventa_categorias_personal')
        .select('id')
        .limit(0);
      return !probe.error;
    },
    staleTime: 60_000,
  });

  // ── tipos_entidad — find "Personal de mantenimiento" id dynamically
  const { data: tiposEntidad = [] } = useQuery<TipoEntidad[]>({
    queryKey: ['tipos-entidad'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('tipos_entidad')
        .select('id, nombre')
        .order('id');
      return (data ?? []) as TipoEntidad[];
    },
  });

  const idMantenimiento = tiposEntidad.find(t =>
    t.nombre.toLowerCase().includes('mantenimiento')
  )?.id ?? null;

  const ID_PROVEEDOR = 8;

  // ── Categorias
  const { data: categorias = [], isLoading: catLoading } = useQuery<Categoria[]>({
    queryKey: ['pv-categorias-config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('postventa_categorias_garantia')
        .select('id, nombre, descripcion, vigencia_dias, sla_critico_horas, sla_media_horas, sla_baja_dias, aplica_a, evidencia_obligatoria, activo')
        .order('nombre');
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
    enabled: open,
  });

  const selectedCat = categorias.find(c => c.id === selectedCatId) ?? null;

  // ── Personal asignado a la categoría seleccionada
  const { data: personalAsignado = [], refetch: refetchPersonal } = useQuery<CategoriaPersonal[]>({
    queryKey: ['pv-cat-personal', selectedCatId],
    queryFn: async () => {
      if (!selectedCatId) return [];
      const { data, error } = await (supabase as any)
        .from('postventa_categorias_personal')
        .select(`
          id, id_categoria, id_persona, id_tipo_entidad, activo,
          personas(id, nombre, apellido_paterno, apellido_materno, email, telefono)
        `)
        .eq('id_categoria', selectedCatId)
        .eq('activo', true);
      if (error) return [];
      return (data ?? []) as CategoriaPersonal[];
    },
    enabled: open && !!selectedCatId && ddlReady === true,
  });

  const mantAsignado     = personalAsignado.filter(p => p.id_tipo_entidad === idMantenimiento);
  const provAsignado     = personalAsignado.filter(p => p.id_tipo_entidad === ID_PROVEEDOR);

  // ── Picker: proveedores disponibles (entidades_relacionadas tipo 8)
  const { data: proveedoresDisponibles = [] } = useQuery<Persona[]>({
    queryKey: ['pv-proveedores-picker'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('entidades_relacionadas')
        .select('personas(id, nombre, apellido_paterno, apellido_materno, email, telefono)')
        .eq('id_tipo_entidad', ID_PROVEEDOR)
        .eq('activo', true);
      return ((data ?? []) as any[]).map((r: any) => r.personas).filter(Boolean) as Persona[];
    },
    enabled: open && addMode === 'proveedor',
  });

  // ── Picker: todo el personal de mantenimiento disponible (personas activas)
  const { data: personasDisponibles = [] } = useQuery<Persona[]>({
    queryKey: ['pv-personas-picker'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('personas')
        .select('id, nombre, apellido_paterno, apellido_materno, email, telefono')
        .eq('activo', true)
        .order('apellido_paterno');
      return (data ?? []) as Persona[];
    },
    enabled: open && addMode === 'mantenimiento',
  });

  // ── Filtered picker list
  const pickerSource = addMode === 'proveedor' ? proveedoresDisponibles : personasDisponibles;
  const assignedIds  = personalAsignado
    .filter(p => addMode === 'proveedor'
      ? p.id_tipo_entidad === ID_PROVEEDOR
      : p.id_tipo_entidad === idMantenimiento)
    .map(p => p.id_persona);

  const pickerFiltered = pickerSource.filter(p => {
    if (assignedIds.includes(p.id)) return false;
    const q = searchPersona.toLowerCase();
    if (!q) return true;
    return personaLabel(p).toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q);
  });

  // ── Mutation: save category (create or update)
  const saveCategoria = useCallback(async () => {
    setSavingCat(true);
    try {
      const payload: any = {
        nombre:               catForm.nombre.trim(),
        descripcion:          catForm.descripcion?.trim() || null,
        vigencia_dias:        catForm.vigencia_dias,
        sla_critico_horas:    catForm.sla_critico_horas,
        sla_media_horas:      catForm.sla_media_horas,
        sla_baja_dias:        catForm.sla_baja_dias,
        aplica_a:             catForm.aplica_a,
        evidencia_obligatoria: catForm.evidencia_obligatoria,
        activo:               catForm.activo,
      };

      if (!payload.nombre) { toast.error('El nombre es obligatorio'); return; }

      if (editingCatId === 'new') {
        const { error } = await (supabase as any)
          .from('postventa_categorias_garantia')
          .insert(payload);
        if (error) { toast.error(error.message); return; }
        toast.success('Categoría creada');
      } else {
        const { error } = await (supabase as any)
          .from('postventa_categorias_garantia')
          .update(payload)
          .eq('id', editingCatId);
        if (error) { toast.error(error.message); return; }
        toast.success('Categoría actualizada');
      }

      qc.invalidateQueries({ queryKey: ['pv-categorias-config'] });
      qc.invalidateQueries({ queryKey: ['pv-categorias'] });
      setEditingCatId(null);
    } finally {
      setSavingCat(false);
    }
  }, [catForm, editingCatId, qc]);

  // ── Mutation: add person to category
  const addPersonal = useMutation({
    mutationFn: async ({ personaId, tipoEntidad }: { personaId: number; tipoEntidad: number }) => {
      const { error } = await (supabase as any)
        .from('postventa_categorias_personal')
        .insert({
          id_categoria:    selectedCatId,
          id_persona:      personaId,
          id_tipo_entidad: tipoEntidad,
          activo:          true,
        });
      if (error && error.code !== '23505') throw error; // 23505 = unique violation (already assigned)
    },
    onSuccess: () => {
      refetchPersonal();
      setSearchPersona('');
      setAddMode(null);
      toast.success('Persona asignada a la categoría');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Mutation: remove person from category (soft delete)
  const removePersonal = useMutation({
    mutationFn: async (relId: number) => {
      const { error } = await (supabase as any)
        .from('postventa_categorias_personal')
        .update({ activo: false })
        .eq('id', relId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPersonal();
      toast.success('Persona removida');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Open edit form
  function openEdit(cat: Categoria) {
    setCatForm({
      nombre:               cat.nombre,
      descripcion:          cat.descripcion,
      vigencia_dias:        cat.vigencia_dias,
      sla_critico_horas:    cat.sla_critico_horas,
      sla_media_horas:      cat.sla_media_horas,
      sla_baja_dias:        cat.sla_baja_dias,
      aplica_a:             cat.aplica_a,
      evidencia_obligatoria: cat.evidencia_obligatoria,
      activo:               cat.activo,
    });
    setEditingCatId(cat.id);
    setAddMode(null);
  }

  function openNew() {
    setCatForm(EMPTY_CAT_FORM);
    setEditingCatId('new');
    setSelectedCatId(null);
    setAddMode(null);
    setMobileView('detail');
  }

  function selectCat(cat: Categoria) {
    setSelectedCatId(cat.id);
    setEditingCatId(null);
    setAddMode(null);
    setSearchPersona('');
    setMobileView('detail');
  }

  if (!open) return null;

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto flex flex-col w-full max-w-5xl h-full bg-white shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Configuración de Postventa</h2>
              <p className="text-xs text-slate-500">Categorías de garantía · Personal · Proveedores</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── DDL Banner ─────────────────────────────────────────────────────── */}
        {ddlReady === false && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800">
              <p className="font-semibold">DDL pendiente</p>
              <p>La tabla <code className="bg-amber-100 px-1 rounded">postventa_categorias_personal</code> aún no existe en la BD.
              Ejecuta los pasos en <strong>Ejecuciones_manuales/postventa_config_personal_ddl.md</strong> para habilitar
              la asignación de personal y proveedores a categorías.</p>
            </div>
          </div>
        )}

        {/* ── Body: two-pane layout ───────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left: Category list ─────────────────────────────────────────── */}
          <div className={`
            flex flex-col border-r border-slate-200 bg-slate-50
            w-full sm:w-72 md:w-80 shrink-0
            ${mobileView === 'detail' ? 'hidden sm:flex' : 'flex'}
          `}>
            {/* List header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Categorías</span>
              <button
                onClick={openNew}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva
              </button>
            </div>

            {/* List body */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {catLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : categorias.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No hay categorías. Crea la primera.
                </div>
              ) : (
                categorias.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => selectCat(cat)}
                    className={`
                      w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between group transition-colors
                      ${selectedCatId === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-white text-slate-700'
                      }
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${selectedCatId === cat.id ? 'text-white' : 'text-slate-800'}`}>
                        {cat.nombre}
                      </p>
                      <p className={`text-xs truncate ${selectedCatId === cat.id ? 'text-blue-100' : 'text-slate-400'}`}>
                        SLA crítico: {cat.sla_critico_horas}h · {cat.activo ? 'Activa' : 'Inactiva'}
                      </p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${selectedCatId === cat.id ? 'text-blue-200' : 'text-slate-300 group-hover:text-slate-500'}`} />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right panel ─────────────────────────────────────────────────── */}
          <div className={`
            flex-1 flex flex-col overflow-hidden
            ${mobileView === 'list' ? 'hidden sm:flex' : 'flex'}
          `}>

            {/* Mobile back button */}
            <div className="sm:hidden px-4 py-2 border-b border-slate-200">
              <button
                onClick={() => setMobileView('list')}
                className="flex items-center gap-1 text-xs text-blue-600 font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Volver a categorías
              </button>
            </div>

            {/* ─── EDITING FORM ─────────────────────────────────────────────── */}
            {editingCatId !== null ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {editingCatId === 'new' ? 'Nueva categoría de garantía' : `Editar: ${selectedCat?.nombre ?? ''}`}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Nombre */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={catForm.nombre}
                        onChange={e => setCatForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Ej. Eléctrica, Hidráulica..."
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Descripción */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Descripción</label>
                      <textarea
                        value={catForm.descripcion ?? ''}
                        onChange={e => setCatForm(f => ({ ...f, descripcion: e.target.value || null }))}
                        placeholder="Descripción breve de la categoría..."
                        rows={2}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    {/* Vigencia + Aplica a */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Vigencia (días)</label>
                        <input
                          type="number"
                          min={0}
                          value={catForm.vigencia_dias ?? ''}
                          onChange={e => setCatForm(f => ({ ...f, vigencia_dias: parseInt(e.target.value) || null }))}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Aplica a</label>
                        <select
                          value={catForm.aplica_a ?? 'TODAS'}
                          onChange={e => setCatForm(f => ({ ...f, aplica_a: e.target.value }))}
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {APLICA_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* SLAs */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">Tiempos de SLA</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Crítico (horas)</label>
                          <input
                            type="number"
                            min={1}
                            value={catForm.sla_critico_horas}
                            onChange={e => setCatForm(f => ({ ...f, sla_critico_horas: parseInt(e.target.value) || 4 }))}
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Media (horas)</label>
                          <input
                            type="number"
                            min={1}
                            value={catForm.sla_media_horas}
                            onChange={e => setCatForm(f => ({ ...f, sla_media_horas: parseInt(e.target.value) || 24 }))}
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Baja (días)</label>
                          <input
                            type="number"
                            min={1}
                            value={catForm.sla_baja_dias}
                            onChange={e => setCatForm(f => ({ ...f, sla_baja_dias: parseInt(e.target.value) || 5 }))}
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={catForm.evidencia_obligatoria}
                          onChange={e => setCatForm(f => ({ ...f, evidencia_obligatoria: e.target.checked }))}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span className="text-xs text-slate-700">Evidencia fotográfica obligatoria</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={catForm.activo}
                          onChange={e => setCatForm(f => ({ ...f, activo: e.target.checked }))}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <span className="text-xs text-slate-700">Categoría activa</span>
                      </label>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={saveCategoria}
                        disabled={savingCat || !catForm.nombre.trim()}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        {savingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Guardar
                      </button>
                      <button
                        onClick={() => {
                          setEditingCatId(null);
                          if (editingCatId === 'new') setSelectedCatId(null);
                        }}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            /* ─── CATEGORY DETAIL VIEW ────────────────────────────────────── */
            ) : selectedCat ? (
              <div className="flex-1 overflow-y-auto">
                {/* Category header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{selectedCat.nombre}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedCat.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {selectedCat.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    {selectedCat.descripcion && (
                      <p className="text-xs text-slate-500 mt-0.5">{selectedCat.descripcion}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Vigencia: <strong>{selectedCat.vigencia_dias ?? '—'} días</strong></span>
                      <span>SLA crítico: <strong>{selectedCat.sla_critico_horas}h</strong></span>
                      <span>SLA media: <strong>{selectedCat.sla_media_horas}h</strong></span>
                      <span>SLA baja: <strong>{selectedCat.sla_baja_dias} días</strong></span>
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(selectedCat)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>
                </div>

                <div className="p-6 space-y-6">

                  {/* ─── PERSONAL DE MANTENIMIENTO ─────────────────────────── */}
                  <PersonalCard
                    title="Personal de mantenimiento"
                    icon={<Users className="w-4 h-4 text-indigo-600" />}
                    iconBg="bg-indigo-50"
                    items={mantAsignado}
                    ddlReady={ddlReady === true}
                    idMantenimientoReady={!!idMantenimiento}
                    onAdd={() => { setAddMode('mantenimiento'); setSearchPersona(''); }}
                    onRemove={id => removePersonal.mutate(id)}
                    removing={removePersonal.isPending}
                  />

                  {/* ─── PROVEEDORES ────────────────────────────────────────── */}
                  <PersonalCard
                    title="Proveedores asignados"
                    icon={<Building2 className="w-4 h-4 text-emerald-600" />}
                    iconBg="bg-emerald-50"
                    items={provAsignado}
                    ddlReady={ddlReady === true}
                    idMantenimientoReady={true}
                    onAdd={() => { setAddMode('proveedor'); setSearchPersona(''); }}
                    onRemove={id => removePersonal.mutate(id)}
                    removing={removePersonal.isPending}
                  />
                </div>
              </div>

            /* ─── EMPTY STATE ─────────────────────────────────────────────── */
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <ShieldCheck className="w-10 h-10 mb-3 text-slate-200" />
                <p className="text-sm font-medium text-slate-600">Selecciona una categoría</p>
                <p className="text-xs mt-1">o crea una nueva desde el panel izquierdo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Picker overlay ───────────────────────────────────────────────────── */}
      {addMode && selectedCat && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setAddMode(null); setSearchPersona(''); }} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[70vh]">

            {/* Picker header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {addMode === 'mantenimiento'
                  ? <Users className="w-4 h-4 text-indigo-600" />
                  : <Building2 className="w-4 h-4 text-emerald-600" />
                }
                <span className="text-sm font-semibold text-slate-900">
                  {addMode === 'mantenimiento' ? 'Agregar personal de mantenimiento' : 'Agregar proveedor'}
                </span>
              </div>
              <button
                onClick={() => { setAddMode(null); setSearchPersona(''); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchPersona}
                  onChange={e => setSearchPersona(e.target.value)}
                  placeholder="Buscar por nombre o email..."
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {pickerFiltered.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  {searchPersona ? 'Sin resultados' : 'No hay personas disponibles'}
                </div>
              ) : (
                pickerFiltered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addPersonal.mutate({
                      personaId:   p.id,
                      tipoEntidad: addMode === 'proveedor' ? ID_PROVEEDOR : (idMantenimiento ?? 0),
                    })}
                    disabled={addPersonal.isPending}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100">
                      <User className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{personaLabel(p)}</p>
                      {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
                      {p.telefono && <p className="text-xs text-slate-400">{p.telefono}</p>}
                    </div>
                    <Plus className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0" />
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400 text-center">
              {pickerFiltered.length} resultado{pickerFiltered.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PersonalCard subcomponent ────────────────────────────────────────────────

interface PersonalCardProps {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  items: CategoriaPersonal[];
  ddlReady: boolean;
  idMantenimientoReady: boolean;
  onAdd: () => void;
  onRemove: (relId: number) => void;
  removing: boolean;
}

function PersonalCard({ title, icon, iconBg, items, ddlReady, idMantenimientoReady, onAdd, onRemove, removing }: PersonalCardProps) {
  const canAdd = ddlReady && idMantenimientoReady;

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{items.length}</span>
        </div>
        <button
          onClick={onAdd}
          disabled={!canAdd}
          title={!ddlReady ? 'Ejecuta el DDL primero' : (!idMantenimientoReady ? 'Insertar "Personal de mantenimiento" en tipos_entidad primero' : undefined)}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar
        </button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-5 text-center text-xs text-slate-400">
          {!ddlReady
            ? <span className="text-amber-600">Ejecuta el DDL para habilitar esta sección</span>
            : 'Sin asignaciones. Usa "+ Agregar" para asignar.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {items.map(rel => (
            <div key={rel.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">
                  {personaLabel(rel.personas)}
                </p>
                {rel.personas.email && (
                  <p className="text-xs text-slate-400 truncate">{rel.personas.email}</p>
                )}
              </div>
              <button
                onClick={() => onRemove(rel.id)}
                disabled={removing}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
