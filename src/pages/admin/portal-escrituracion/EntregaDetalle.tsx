import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronLeft, CheckCircle2, AlertTriangle, Clock, X, Calendar, Home,
  Camera, FileText, Download, Plus, RotateCcw, ChevronRight,
  User, Building2, CalendarDays, MapPin, Wrench, Star,
  ListChecks, ClipboardCheck, Package, ChevronDown,
  ChevronUp, Loader2, CheckCheck, Play,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Catálogo de estatus checklist (fuente de verdad: id numérico) ────────────

const ESTATUS_CHECKLIST = {
  PENDIENTE:               1,
  CUMPLE:                  2,
  NO_CUMPLE:               3,
  NO_APLICA:               4,
  EN_REPARACION:           5,
  REPARADO_PENDIENTE_VOBO: 6,
  VOBO_APROBADO:           7,
  VOBO_RECHAZADO:          8,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type EstatusEntrega = 'PENDIENTE_PRE_ENTREGA' | 'PRE_ENTREGA_EN_PROCESO' | 'LISTO' | 'PROGRAMADA' | 'EN_PROCESO' | 'ENTREGADA' | 'CON_OBSERVACIONES' | 'REPROGRAMADA';
type PrioridadObs = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';

interface EstatusChecklistRow {
  id: number;
  nombre: string;
  activo: boolean;
}

interface ChecklistItem {
  id: number;
  id_categoria: number;
  nombre: string;
  id_estatus_checklist: number;
  observacion: string | null;
  responsable: string | null;
  fecha_revision: string | null;
  fecha_compromiso: string | null;
}

interface ChecklistCategoria {
  id: number;
  nombre: string;
  tipo_checklist?: string;
  responsable: string | null;
  cargo: string | null;
  fecha_vobo: string | null;
  estatus: string;
  total_items: number;
  items_completos: number;
  items: ChecklistItem[];
}

interface ObservacionRow {
  id: number;
  descripcion: string;
  estatus: string;
  prioridad: PrioridadObs;
  fecha_creacion: string;
}

interface PageData {
  entrega: {
    id: number;
    id_propiedad: number;
    id_proyecto: number;
    id_cuenta_cobranza: number;
    estatus: string;
    fecha_programada: string | null;
    fecha_entrega: string | null;
    muebles_daiku_estatus: string;
    entregado_por: string | null;
    punto_reunion: string | null;
    telefono_contacto: string | null;
  } | null;
  propiedad: { id: number; numero_propiedad: string | null; id_edificio_modelo: number; id_estatus_disponibilidad: number };
  edificio: { id: number; nombre: string; id_proyecto: number } | null;
  modelo: { id: number; nombre: string } | null;
  proyecto: { id: number; nombre: string } | null;
  cuenta: { id: number; id_propiedad: number } | null;
  clienteNombre: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESTATUS_META: Record<string, { label: string; cls: string }> = {
  PENDIENTE_PRE_ENTREGA:  { label: 'Pendiente de pre-entrega', cls: 'bg-slate-50 text-slate-600 border border-slate-200' },
  PRE_ENTREGA_EN_PROCESO: { label: 'Pre-entrega en proceso',   cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
  LISTO:                  { label: 'Lista p/entrega',           cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  PROGRAMADA:             { label: 'Programada',                cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  EN_PROCESO:             { label: 'En proceso',                cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ENTREGADA:              { label: 'Entregada',                 cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  CON_OBSERVACIONES:      { label: 'Con observaciones',         cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  REPROGRAMADA:           { label: 'Reprogramada',              cls: 'bg-red-50 text-red-700 border border-red-200' },
};

const ITEM_CLS: Record<number, string> = {
  [ESTATUS_CHECKLIST.CUMPLE]:                  'text-emerald-600',
  [ESTATUS_CHECKLIST.PENDIENTE]:               'text-amber-600',
  [ESTATUS_CHECKLIST.NO_CUMPLE]:               'text-red-500',
  [ESTATUS_CHECKLIST.NO_APLICA]:               'text-slate-400',
  [ESTATUS_CHECKLIST.EN_REPARACION]:           'text-orange-500',
  [ESTATUS_CHECKLIST.REPARADO_PENDIENTE_VOBO]: 'text-blue-500',
  [ESTATUS_CHECKLIST.VOBO_APROBADO]:           'text-emerald-700',
  [ESTATUS_CHECKLIST.VOBO_RECHAZADO]:          'text-red-700',
};

const PRIORIDAD_META: Record<PrioridadObs, { label: string; cls: string }> = {
  CRITICA: { label: 'Crítica', cls: 'bg-red-50 text-red-700 border border-red-200' },
  ALTA:    { label: 'Alta',    cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  MEDIA:   { label: 'Media',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  BAJA:    { label: 'Baja',    cls: 'bg-slate-100 text-slate-600' },
};

const fmt  = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('es-MX') : '—';
const fmtDt = (d: string | null | undefined) => d ? new Date(d).toLocaleString('es-MX')   : '—';

// ─── Signature Canvas ─────────────────────────────────────────────────────────

function SignatureCanvas({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getXY = (e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const { x, y } = getXY(e, c.getBoundingClientRect());
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const { x, y } = getXY(e, c.getBoundingClientRect());
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b'; ctx.lineTo(x, y); ctx.stroke();
    setHasSignature(true);
  };

  const end = () => {
    drawing.current = false;
    const c = canvasRef.current;
    if (c && hasSignature) onChange(c.toDataURL());
  };

  const clear = () => {
    const c = canvasRef.current; if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setHasSignature(false); onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas ref={canvasRef} width={440} height={140}
        className="w-full border-2 border-dashed border-slate-200 rounded-2xl bg-white cursor-crosshair touch-none"
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={end}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Dibuja tu firma en el área de arriba</p>
        <button onClick={clear} className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Limpiar
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EntregaDetalle() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isPropMode = id.startsWith('prop-');
  const propiedadIdFromUrl = isPropMode ? parseInt(id.replace('prop-', '')) : null;
  const entregaIdFromUrl   = !isPropMode ? parseInt(id) : null;

  const [activeTab, setActiveTab] = useState<'resumen' | 'checklist' | 'muebles' | 'programacion' | 'acta' | 'observaciones' | 'documentos' | 'historial'>('resumen');
  const [expandedCats, setExpandedCats] = useState<number[]>([]);
  const [selectedCat, setSelectedCat] = useState<ChecklistCategoria | null>(null);
  const [actaStep, setActaStep] = useState(1);
  const [firmaNombre, setFirmaNombre] = useState('');
  const [firmaData, setFirmaData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [itemsLoading, setItemsLoading] = useState<Set<number>>(new Set());
  const [noCumpleModal, setNoCumpleModal] = useState<{ itemId: number; nombre: string } | null>(null);
  const [noCumpleObs, setNoCumpleObs] = useState('');

  // ── Query principal: propiedad + edificio + modelo + proyecto + cliente ──────
  const { data: pageData, isLoading: pageLoading, error: pageError } = useQuery<PageData | null>({
    queryKey: ['entrega-page', id],
    queryFn: async () => {
      let entregaRow: PageData['entrega'] = null;
      let propiedadId: number;

      if (!isPropMode && entregaIdFromUrl) {
        const { data: e } = await supabase
          .from('entregas')
          .select('id, id_propiedad, id_proyecto, id_cuenta_cobranza, estatus, fecha_programada, fecha_entrega, muebles_daiku_estatus, entregado_por, punto_reunion, telefono_contacto')
          .eq('id', entregaIdFromUrl)
          .eq('activo', true)
          .single();
        if (!e) return null;
        entregaRow = e as PageData['entrega'];
        propiedadId = (e as any).id_propiedad;
      } else if (propiedadIdFromUrl) {
        propiedadId = propiedadIdFromUrl;
      } else {
        return null;
      }

      const { data: propiedad } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, id_edificio_modelo, id_estatus_disponibilidad')
        .eq('id', propiedadId)
        .single();
      if (!propiedad) return null;

      const { data: edificioModelo } = await supabase
        .from('edificios_modelos')
        .select('id, id_edificio, id_modelo')
        .eq('id', (propiedad as any).id_edificio_modelo)
        .single();

      const [edificioRes, modeloRes] = await Promise.all([
        edificioModelo
          ? supabase.from('edificios').select('id, nombre, id_proyecto').eq('id', (edificioModelo as any).id_edificio).single()
          : Promise.resolve({ data: null }),
        (edificioModelo as any)?.id_modelo
          ? supabase.from('modelos').select('id, nombre').eq('id', (edificioModelo as any).id_modelo).single()
          : Promise.resolve({ data: null }),
      ]);

      const edificio = edificioRes.data as PageData['edificio'];
      const modelo   = modeloRes.data   as PageData['modelo'];

      const proyectoRes = (edificio as any)?.id_proyecto
        ? await supabase.from('proyectos').select('id, nombre').eq('id', (edificio as any).id_proyecto).single()
        : { data: null };
      const proyecto = proyectoRes.data as PageData['proyecto'];

      const { data: cuentas } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad')
        .eq('id_propiedad', propiedadId)
        .eq('activo', true)
        .limit(10);
      const cuenta = (cuentas?.[0] ?? null) as PageData['cuenta'];

      let clienteNombre = '—';
      if (cuenta?.id) {
        const { data: compradores } = await supabase
          .from('compradores')
          .select('id_persona')
          .eq('id_cuenta_cobranza', cuenta.id)
          .eq('activo', true)
          .limit(1);
        const personaId = (compradores as any)?.[0]?.id_persona;
        if (personaId) {
          const { data: persona } = await supabase
            .from('personas')
            .select('nombre_legal')
            .eq('id', personaId)
            .single();
          clienteNombre = (persona as any)?.nombre_legal ?? '—';
        }
      }

      return { entrega: entregaRow, propiedad: propiedad as any, edificio, modelo, proyecto, cuenta, clienteNombre };
    },
    enabled: !!id,
  });

  const entregaId = pageData?.entrega?.id ?? null;

  // ── Checklist ────────────────────────────────────────────────────────────────
  const { data: checklist = [] } = useQuery<ChecklistCategoria[]>({
    queryKey: ['checklist-entrega', entregaId],
    queryFn: async () => {
      const { data: cats } = await (supabase as any)
        .from('entregas_checklist_categorias')
        .select('id, nombre, tipo_checklist, responsable, cargo, fecha_vobo, estatus, total_items, items_completos, id_plantilla_categoria')
        .eq('id_entrega', entregaId!)
        .eq('activo', true)
        .order('id_plantilla_categoria', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });

      const catIds = (cats ?? []).map((c: any) => c.id);
      if (!catIds.length) return [];

      const { data: items } = await supabase
        .from('entregas_checklist_items')
        .select('id, id_categoria, nombre, id_estatus_checklist, observacion, responsable, fecha_revision, fecha_compromiso')
        .in('id_categoria', catIds)
        .eq('activo', true)
        .order('id', { ascending: true });

      const itemsByCat: Record<number, ChecklistItem[]> = {};
      (items ?? []).forEach((item: any) => {
        if (!itemsByCat[item.id_categoria]) itemsByCat[item.id_categoria] = [];
        itemsByCat[item.id_categoria].push(item as ChecklistItem);
      });

      return (cats ?? []).map((cat: any) => ({
        ...cat,
        items: itemsByCat[cat.id] ?? [],
      } as ChecklistCategoria));
    },
    enabled: !!entregaId,
  });

  // ── Observaciones ─────────────────────────────────────────────────────────────
  const { data: observaciones = [] } = useQuery<ObservacionRow[]>({
    queryKey: ['observaciones-entrega', entregaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('entregas_observaciones')
        .select('id, descripcion, estatus, prioridad, fecha_creacion')
        .eq('id_entrega', entregaId!)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });
      return (data ?? []) as ObservacionRow[];
    },
    enabled: !!entregaId,
  });

  // ── Catálogo de estatus checklist ────────────────────────────────────────────
  const { data: estatusCatalogo = [] } = useQuery<EstatusChecklistRow[]>({
    queryKey: ['estatus-checklist-catalogo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('estatus_checklist')
        .select('id, nombre, activo')
        .eq('activo', true)
        .order('id');
      return (data ?? []) as EstatusChecklistRow[];
    },
  });

  const getEstatusNombre = (id: number) =>
    estatusCatalogo.find(e => e.id === id)?.nombre ?? 'Sin estatus';

  // ── Plantilla preview (prop-mode: resumen del checklist a crear) ─────────────
  const modeloIdForPreview   = isPropMode ? (pageData?.modelo?.id ?? null) : null;
  const proyectoIdForPreview = isPropMode ? ((pageData?.edificio as any)?.id_proyecto ?? null) : null;

  const { data: plantillaPreview = [] } = useQuery<{ nombre: string; total_items: number }[]>({
    queryKey: ['checklist-plantilla-preview', modeloIdForPreview, proyectoIdForPreview],
    queryFn: async () => {
      const { data: plantillas } = await (supabase as any)
        .from('checklist_plantillas')
        .select('id, id_proyecto, id_modelo')
        .eq('tipo_checklist', 'PRE_ENTREGA')
        .eq('activo', true);
      if (!plantillas?.length) return [];

      const byModelo   = (plantillas as any[]).find(p => modeloIdForPreview !== null && p.id_modelo === modeloIdForPreview);
      const byProyecto = (plantillas as any[]).find(p => p.id_proyecto === proyectoIdForPreview && p.id_modelo === null);
      const global     = (plantillas as any[]).find(p => p.id_proyecto === null && p.id_modelo === null);
      const plantilla  = byModelo ?? byProyecto ?? global;
      if (!plantilla) return [];

      const { data: cats } = await (supabase as any)
        .from('checklist_plantilla_categorias')
        .select('id, nombre, orden')
        .eq('id_plantilla', plantilla.id)
        .eq('activo', true)
        .order('orden', { ascending: true });
      if (!cats?.length) return [];

      const catIds = (cats as any[]).map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from('checklist_plantilla_items')
        .select('id, id_plantilla_categoria')
        .in('id_plantilla_categoria', catIds)
        .eq('activo', true);

      const countByCat: Record<number, number> = {};
      (items ?? []).forEach((i: any) => {
        countByCat[i.id_plantilla_categoria] = (countByCat[i.id_plantilla_categoria] ?? 0) + 1;
      });

      return (cats as any[]).map((c: any) => ({ nombre: c.nombre, total_items: countByCat[c.id] ?? 0 }));
    },
    enabled: isPropMode && !!pageData,
    staleTime: 60_000,
  });

  // ── Acciones de checklist ─────────────────────────────────────────────────────

  const setItemLoading = (itemId: number, loading: boolean) =>
    setItemsLoading(prev => {
      const next = new Set(prev);
      loading ? next.add(itemId) : next.delete(itemId);
      return next;
    });

  const handleActualizarEstatus = async (itemId: number, nuevoEstatus: number) => {
    setItemLoading(itemId, true);
    const { error } = await supabase
      .from('entregas_checklist_items')
      .update({ id_estatus_checklist: nuevoEstatus })
      .eq('id', itemId);
    if (error) {
      toast.error('Error al actualizar el ítem');
    } else {
      toast.success(`Ítem actualizado: ${getEstatusNombre(nuevoEstatus)}`);
      queryClient.invalidateQueries({ queryKey: ['checklist-entrega', entregaId] });
    }
    setItemLoading(itemId, false);
  };

  const handleGuardarNoCumple = async () => {
    if (!noCumpleModal || !noCumpleObs.trim() || !entregaId) return;
    const { itemId, nombre } = noCumpleModal;
    setItemLoading(itemId, true);

    const [itemRes, obsRes] = await Promise.all([
      supabase
        .from('entregas_checklist_items')
        .update({ id_estatus_checklist: ESTATUS_CHECKLIST.NO_CUMPLE, observacion: noCumpleObs.trim() })
        .eq('id', itemId),
      supabase
        .from('entregas_observaciones')
        .insert({
          id_entrega:  entregaId,
          descripcion: `[Checklist] ${nombre}: ${noCumpleObs.trim()}`,
          prioridad:   'MEDIA',
          estatus:     'ABIERTA',
          activo:      true,
        }),
    ]);

    if (itemRes.error || obsRes.error) {
      toast.error('Error al registrar No cumple');
    } else {
      toast.success('Ítem marcado como No cumple');
      queryClient.invalidateQueries({ queryKey: ['checklist-entrega', entregaId] });
      queryClient.invalidateQueries({ queryKey: ['observaciones-entrega', entregaId] });
      setNoCumpleModal(null);
      setNoCumpleObs('');
    }
    setItemLoading(itemId, false);
  };

  // ── Iniciar pre-entrega (fuente: BD) ─────────────────────────────────────────
  const handleIniciarPreEntrega = async () => {
    if (!pageData?.propiedad || !pageData?.cuenta || !pageData?.edificio) {
      toast.error('No se encontraron los datos necesarios para iniciar la pre-entrega');
      return;
    }
    setStarting(true);
    try {
      const propiedadId = pageData.propiedad.id;
      const proyectoId  = (pageData.edificio as any).id_proyecto as number;
      const modeloId    = pageData.modelo?.id ?? null;

      // ── Guard: propiedad ya tiene entrega inicializada ──────────────────────
      const { data: entregasExistentes } = await supabase
        .from('entregas')
        .select('id')
        .eq('id_propiedad', propiedadId)
        .eq('activo', true)
        .limit(1);

      if (entregasExistentes?.length) {
        const idExistente = (entregasExistentes[0] as any).id;
        const { count } = await (supabase as any)
          .from('entregas_checklist_categorias')
          .select('id', { count: 'exact', head: true })
          .eq('id_entrega', idExistente)
          .eq('activo', true);
        if (count && count > 0) {
          toast.info('La pre-entrega ya fue inicializada.');
          navigate(`/admin/portal-escrituracion/entregas/${idExistente}`);
          return;
        }
      }

      // ── Fase 1: Resolver plantilla activa ───────────────────────────────────
      // Prioridad: específica de modelo > específica de proyecto > global
      const { data: plantillas } = await (supabase as any)
        .from('checklist_plantillas')
        .select('id, id_proyecto, id_modelo')
        .eq('tipo_checklist', 'PRE_ENTREGA')
        .eq('activo', true);

      if (!plantillas?.length) throw new Error('No hay una plantilla de checklist activa para PRE_ENTREGA');

      const byModelo   = (plantillas as any[]).find(p => modeloId !== null && p.id_modelo === modeloId);
      const byProyecto = (plantillas as any[]).find(p => p.id_proyecto === proyectoId && p.id_modelo === null);
      const global     = (plantillas as any[]).find(p => p.id_proyecto === null && p.id_modelo === null);
      const plantilla  = byModelo ?? byProyecto ?? global;

      if (!plantilla) throw new Error('No se encontró una plantilla de checklist aplicable a esta unidad');

      // ── Fase 1b: Cargar categorías e ítems ordenados ────────────────────────
      const { data: plantillaCats, error: plantillaCatErr } = await (supabase as any)
        .from('checklist_plantilla_categorias')
        .select('id, nombre, orden')
        .eq('id_plantilla', plantilla.id)
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (plantillaCatErr || !plantillaCats?.length)
        throw new Error('La plantilla no tiene categorías activas');

      const plantillaCatIds = (plantillaCats as any[]).map((c: any) => c.id);

      const { data: plantillaItems, error: plantillaItemErr } = await (supabase as any)
        .from('checklist_plantilla_items')
        .select('id, id_plantilla_categoria, nombre, orden')
        .in('id_plantilla_categoria', plantillaCatIds)
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (plantillaItemErr || !plantillaItems?.length)
        throw new Error('La plantilla no tiene ítems activos');

      const itemsByCat: Record<number, any[]> = {};
      (plantillaItems as any[]).forEach(item => {
        if (!itemsByCat[item.id_plantilla_categoria]) itemsByCat[item.id_plantilla_categoria] = [];
        itemsByCat[item.id_plantilla_categoria].push(item);
      });

      // ── Fase 3: Crear registro de entrega ───────────────────────────────────
      const { data: nuevaEntrega, error: eErr } = await supabase
        .from('entregas')
        .insert({
          id_propiedad:          propiedadId,
          id_cuenta_cobranza:    pageData.cuenta.id,
          id_proyecto:           proyectoId,
          estatus:               'PRE_ENTREGA_EN_PROCESO',
          muebles_daiku_estatus: 'PENDIENTE',
          activo:                true,
        })
        .select('id')
        .single();

      if (eErr || !nuevaEntrega) throw new Error(eErr?.message ?? 'Error al crear la pre-entrega');

      // ── Fase 2: Insertar categorías con trazabilidad ────────────────────────
      const { data: cats, error: catErr } = await (supabase as any)
        .from('entregas_checklist_categorias')
        .insert(
          (plantillaCats as any[]).map(cat => ({
            id_entrega:             (nuevaEntrega as any).id,
            id_plantilla_categoria: cat.id,
            nombre:                 cat.nombre,
            tipo_checklist:         'PRE_ENTREGA',
            estatus:                'PENDIENTE',
            total_items:            (itemsByCat[cat.id] ?? []).length,
            items_completos:        0,
            activo:                 true,
          }))
        )
        .select('id, id_plantilla_categoria');

      if (catErr || !cats?.length) throw new Error(catErr?.message ?? 'Error al crear categorías del checklist');

      // ── Fase 2b: Insertar ítems con trazabilidad ────────────────────────────
      const itemInserts: {
        id_categoria: number;
        id_plantilla_item: number;
        nombre: string;
        id_estatus_checklist: number;
        activo: boolean;
      }[] = [];

      (cats as any[]).forEach(catDb => {
        const catItems = itemsByCat[catDb.id_plantilla_categoria] ?? [];
        catItems.forEach(pItem => {
          itemInserts.push({
            id_categoria:         catDb.id,
            id_plantilla_item:    pItem.id,
            nombre:               pItem.nombre,
            id_estatus_checklist: ESTATUS_CHECKLIST.PENDIENTE,
            activo:               true,
          });
        });
      });

      const { error: itemErr } = await supabase.from('entregas_checklist_items').insert(itemInserts);
      if (itemErr) throw new Error(itemErr.message ?? 'Error al crear ítems del checklist');

      queryClient.invalidateQueries({ queryKey: ['entregas-rows'] });
      queryClient.invalidateQueries({ queryKey: ['entrega-detalle'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-entrega'] });

      navigate(`/admin/portal-escrituracion/entregas/${(nuevaEntrega as any).id}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al iniciar la pre-entrega');
    } finally {
      setStarting(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────────
  // Conteo desde ítems reales: aplicables = todos excepto NO_APLICA; cumplidos = CUMPLE
  const allChecklistItems = checklist.flatMap(c => c.items);
  const aplicables        = allChecklistItems.filter(i => i.id_estatus_checklist !== ESTATUS_CHECKLIST.NO_APLICA);
  const cumplidos         = aplicables.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.CUMPLE);
  const checklistGlobal   = aplicables.length > 0 ? Math.round((cumplidos.length / aplicables.length) * 100) : 0;
  const entregaEstatus = pageData?.entrega?.estatus ?? 'PENDIENTE_PRE_ENTREGA';
  const estatusMeta = ESTATUS_META[entregaEstatus] ?? { label: entregaEstatus, cls: 'bg-slate-50 text-slate-600 border border-slate-200' };

  const toggleCat = (catId: number) => {
    setExpandedCats(prev => prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]);
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (pageError || !pageData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
        <AlertTriangle className="w-8 h-8 text-amber-400" />
        <p className="text-sm font-medium">No se pudo cargar la información de la unidad</p>
        <button onClick={() => navigate('/admin/portal-escrituracion/entregas')}
          className="text-xs text-blue-600 hover:underline">
          Volver al listado
        </button>
      </div>
    );
  }

  const { propiedad, edificio, modelo, proyecto, clienteNombre } = pageData;
  const unidadLabel = propiedad.numero_propiedad ?? '—';
  const torreLabel  = edificio?.nombre ?? '—';
  const proyectoLabel = proyecto?.nombre ?? '—';
  const modeloLabel = modelo?.nombre ?? '—';

  // ── MODO PROP: pre-entrega no iniciada ────────────────────────────────────────
  if (isPropMode) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-slate-50/40">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 pt-4 pb-5">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
            <button onClick={() => navigate('/admin/portal-escrituracion/entregas')}
              className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Entregas
            </button>
            <span>/</span>
            <span className="text-slate-600 font-medium">{unidadLabel} · {torreLabel}</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0">
              <Building2 className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900">{unidadLabel} · {torreLabel}</h1>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                  Pendiente de pre-entrega
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                <span><span className="font-medium text-slate-700">Cliente:</span> {clienteNombre}</span>
                <span><span className="font-medium text-slate-700">Modelo:</span> {modeloLabel}</span>
                <span><span className="font-medium text-slate-700">Proyecto:</span> {proyectoLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body: estado vacío */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <Wrench className="w-10 h-10 text-slate-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Pre-entrega no iniciada</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Esta unidad aún no tiene un proceso de pre-entrega activo.
                Al iniciar, se creará el registro y se cargarán las {plantillaPreview.length} categorías
                y {plantillaPreview.reduce((s, c) => s + c.total_items, 0)} ítems estándar del checklist técnico.
              </p>
            </div>

            {/* Datos de la unidad */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-left space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos de la unidad</p>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
                {[
                  ['Unidad', unidadLabel], ['Torre / Edificio', torreLabel],
                  ['Proyecto', proyectoLabel], ['Modelo', modeloLabel],
                  ['Cliente', clienteNombre],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-slate-400">{l}</p>
                    <p className="font-medium text-slate-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen del checklist a crear */}
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-left">
              <p className="text-xs font-semibold text-sky-800 mb-2">Se crearán automáticamente:</p>
              <ul className="space-y-1">
                {plantillaPreview.map(cat => (
                  <li key={cat.nombre} className="flex items-center justify-between text-xs text-sky-700">
                    <span>{cat.nombre}</span>
                    <span className="font-medium">{cat.total_items} ítems</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleIniciarPreEntrega}
              disabled={starting}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {starting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando…</>
                : <><Play className="w-4 h-4" /> Iniciar pre-entrega</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MODO ENTREGA: tabs completos ──────────────────────────────────────────────
  const TABS = [
    { id: 'resumen',       label: 'Resumen' },
    { id: 'checklist',     label: `Checklist${checklist.length > 0 ? ` (${checklistGlobal}%)` : ''}` },
    { id: 'muebles',       label: 'Paquete Muebles' },
    { id: 'programacion',  label: 'Programación' },
    { id: 'acta',          label: 'Acta de entrega' },
    { id: 'observaciones', label: `Observaciones${observaciones.length > 0 ? ` (${observaciones.length})` : ''}` },
    { id: 'documentos',    label: 'Documentos' },
    { id: 'historial',     label: 'Historial' },
  ] as const;

  const entrega = pageData.entrega!;
  const daikuEstatus = entrega.muebles_daiku_estatus ?? 'PENDIENTE';

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/40">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4 pb-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
          <button onClick={() => navigate('/admin/portal-escrituracion/entregas')}
            className="hover:text-blue-600 transition-colors flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Entregas
          </button>
          <span>/</span>
          <span className="text-slate-600 font-medium">{unidadLabel} · {torreLabel}</span>
        </div>

        {/* Unit info */}
        <div className="flex items-start justify-between gap-6 mb-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0">
              <Building2 className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900">{unidadLabel} · {torreLabel}</h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${estatusMeta.cls}`}>
                  {estatusMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                <span><span className="font-medium text-slate-700">Cliente:</span> {clienteNombre}</span>
                <span><span className="font-medium text-slate-700">Modelo:</span> {modeloLabel}</span>
                <span><span className="font-medium text-slate-700">Proyecto:</span> {proyectoLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-6 shrink-0 text-xs text-slate-500">
            <div>
              <div className="flex items-center gap-1 text-slate-400 mb-0.5"><CalendarDays className="w-3.5 h-3.5" /> Fecha programada</div>
              <p className="font-medium text-slate-800">{fmt(entrega.fecha_programada)}</p>
            </div>
            {entrega.entregado_por && (
              <div>
                <div className="flex items-center gap-1 text-slate-400 mb-0.5"><User className="w-3.5 h-3.5" /> Entregado por</div>
                <p className="font-medium text-slate-800">{entrega.entregado_por}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveTab('acta')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                <FileText className="w-3.5 h-3.5" /> Ver acta digital
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-0 -mb-px">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* ── RESUMEN ── */}
        {activeTab === 'resumen' && (
          <div className="space-y-5 max-w-4xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Checklist técnico', value: `${checklistGlobal}%`, sub: `${cumplidos.length}/${aplicables.length} ítems`, ok: checklistGlobal === 100, icon: ListChecks },
                { label: 'Paquete Muebles', value: daikuEstatus === 'COMPLETADO' ? 'Completado' : daikuEstatus === 'NO_APLICA' ? 'No aplica' : 'Pendiente', sub: '', ok: daikuEstatus !== 'PENDIENTE', icon: Package, tab: 'muebles' as const },
                { label: 'Observaciones', value: `${observaciones.filter(o => o.estatus !== 'RESUELTA').length} abiertas`, sub: observaciones.some(o => o.prioridad === 'CRITICA' && o.estatus !== 'RESUELTA') ? 'Hay obs. críticas' : 'Sin obs. críticas', ok: !observaciones.some(o => o.prioridad === 'CRITICA' && o.estatus !== 'RESUELTA'), icon: AlertTriangle },
                { label: 'Firmas', value: entrega.estatus === 'ENTREGADA' ? 'Firmado' : 'Pendiente', sub: '', ok: entrega.estatus === 'ENTREGADA', icon: ClipboardCheck },
              ].map(s => {
                const Icon = s.icon;
                const hasTab = 'tab' in s && s.tab;
                return (
                  <div
                    key={s.label}
                    onClick={hasTab ? () => setActiveTab((s as any).tab) : undefined}
                    className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ${hasTab ? 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.ok ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                        <Icon className={`w-4 h-4 ${s.ok ? 'text-emerald-600' : 'text-amber-600'}`} />
                      </div>
                      {s.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-amber-400" />}
                    </div>
                    <p className="text-lg font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    {s.sub && <p className="text-[11px] text-slate-400 mt-1">{s.sub}</p>}
                    {hasTab && <p className="text-[11px] text-blue-500 mt-1.5 flex items-center gap-0.5">Ver detalle <ChevronRight className="w-3 h-3" /></p>}
                  </div>
                );
              })}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-900 mb-3">Datos de la entrega</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                {[
                  ['Unidad', unidadLabel], ['Torre / Edificio', torreLabel], ['Proyecto', proyectoLabel],
                  ['Modelo', modeloLabel], ['Cliente', clienteNombre],
                  ['Fecha programada', fmt(entrega.fecha_programada)],
                  ['Fecha de entrega', fmt(entrega.fecha_entrega)],
                  ['Entregado por', entrega.entregado_por ?? '—'],
                  ['Punto de reunión', entrega.punto_reunion ?? '—'],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-slate-400 mb-0.5">{l}</p>
                    <p className="text-sm font-medium text-slate-800">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKLIST ── */}
        {activeTab === 'checklist' && (
          <div className="flex gap-5 max-w-[1200px]">
            <div className="flex-1 min-w-0 space-y-4">
              {/* Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Progreso del checklist</p>
                    {/* La edición de catálogo de checklist debe hacerse desde una futura pantalla de
                        Configuración de Checklist por proyecto/modelo/categoría.
                        No se debe editar la plantilla desde una entrega individual. */}
                  </div>
                  {checklist.length > 0 && (
                    <button onClick={() => setExpandedCats(expandedCats.length > 0 ? [] : checklist.map(c => c.id))}
                      className="text-xs text-blue-600 hover:underline">
                      {expandedCats.length > 0 ? 'Colapsar todo' : 'Expandir todo'}
                    </button>
                  )}
                </div>
                {checklist.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No hay ítems en el checklist aún.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {(() => {
                      const allItems = checklist.flatMap(c => c.items);
                      const cumple    = allItems.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.CUMPLE).length;
                      const pendiente = allItems.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.PENDIENTE).length;
                      const noCumple  = allItems.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.NO_CUMPLE).length;
                      const noAplica  = allItems.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.NO_APLICA).length;
                      return [
                        { label: 'Cumple',     value: cumple,    cls: 'text-emerald-600' },
                        { label: 'Pendientes', value: pendiente, cls: 'text-amber-600' },
                        { label: 'No cumple',  value: noCumple,  cls: 'text-red-500' },
                        { label: 'No aplica',  value: noAplica,  cls: 'text-slate-400' },
                      ].map(s => (
                        <div key={s.label} className="text-center bg-slate-50 rounded-2xl p-3">
                          <p className={`text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
                          <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {checklist.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoría / Concepto</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estatus</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">VoBo</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {checklist.map(cat => (
                        <>
                          <tr key={cat.id}
                            onClick={() => { toggleCat(cat.id); setSelectedCat(cat); }}
                            className={`cursor-pointer transition-colors ${selectedCat?.id === cat.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {expandedCats.includes(cat.id)
                                  ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                <div>
                                  <p className="font-semibold text-slate-900 text-xs">{cat.nombre}</p>
                                  {(() => {
                                    const catApl = cat.items.filter(i => i.id_estatus_checklist !== ESTATUS_CHECKLIST.NO_APLICA);
                                    const catCum = catApl.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.CUMPLE);
                                    const catPct = catApl.length > 0 ? Math.round((catCum.length / catApl.length) * 100) : 0;
                                    return (
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${catPct}%` }} />
                                        </div>
                                        <span className="text-[10px] text-slate-500">{catCum.length}/{catApl.length}</span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                cat.estatus === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-700' :
                                cat.estatus === 'NO_CUMPLE'  ? 'bg-red-50 text-red-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>
                                {cat.estatus === 'COMPLETADO' && <CheckCircle2 className="w-3 h-3" />}
                                {cat.estatus === 'COMPLETADO' ? 'Completado' : cat.estatus === 'NO_CUMPLE' ? 'Con observación' : 'Pendiente'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {cat.estatus === 'COMPLETADO'
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                : <Clock className="w-4 h-4 text-amber-400" />}
                            </td>
                            <td className="px-4 py-3">
                              {cat.responsable
                                ? <>
                                    <p className="text-xs font-medium text-slate-700">{cat.responsable}</p>
                                    {cat.cargo && <p className="text-[10px] text-slate-400">{cat.cargo}</p>}
                                  </>
                                : <span className="text-xs text-slate-400">—</span>}
                            </td>
                          </tr>
                          {expandedCats.includes(cat.id) && cat.items.map(item => {
                            const isLoading = itemsLoading.has(item.id);
                            return (
                              <tr key={item.id} className="bg-slate-50/60 hover:bg-slate-50">
                                <td className="pl-12 pr-4 py-2" colSpan={4}>
                                  <div className="flex items-center justify-between gap-3">
                                    {/* Nombre + ícono de estatus */}
                                    <div className="flex items-center gap-2 min-w-0">
                                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`} />
                                      <span className="text-xs text-slate-700 truncate">{item.nombre}</span>
                                    </div>
                                    {/* Estatus label + acciones */}
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className={`text-[11px] font-medium ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`}>
                                        {getEstatusNombre(item.id_estatus_checklist)}
                                      </span>
                                      {isLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          {/* Pendiente → Cumple / No cumple / N/A */}
                                          {item.id_estatus_checklist === ESTATUS_CHECKLIST.PENDIENTE && (<>
                                            <button
                                              onClick={() => handleActualizarEstatus(item.id, ESTATUS_CHECKLIST.CUMPLE)}
                                              className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors">
                                              Cumple
                                            </button>
                                            <button
                                              onClick={() => { setNoCumpleModal({ itemId: item.id, nombre: item.nombre }); setNoCumpleObs(''); }}
                                              className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 text-[11px] font-medium hover:bg-red-100 border border-red-200 transition-colors">
                                              No cumple
                                            </button>
                                            <button
                                              onClick={() => handleActualizarEstatus(item.id, ESTATUS_CHECKLIST.NO_APLICA)}
                                              className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-medium hover:bg-slate-200 transition-colors">
                                              N/A
                                            </button>
                                          </>)}
                                          {/* No cumple → Enviar a reparación */}
                                          {item.id_estatus_checklist === ESTATUS_CHECKLIST.NO_CUMPLE && (
                                            <button
                                              onClick={() => handleActualizarEstatus(item.id, ESTATUS_CHECKLIST.EN_REPARACION)}
                                              className="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-700 text-[11px] font-medium hover:bg-orange-100 border border-orange-200 transition-colors flex items-center gap-1">
                                              <Wrench className="w-3 h-3" /> Enviar a reparación
                                            </button>
                                          )}
                                          {/* En reparación → Marcar terminada */}
                                          {item.id_estatus_checklist === ESTATUS_CHECKLIST.EN_REPARACION && (
                                            <button
                                              onClick={() => handleActualizarEstatus(item.id, ESTATUS_CHECKLIST.REPARADO_PENDIENTE_VOBO)}
                                              className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1">
                                              <CheckCircle2 className="w-3 h-3" /> Reparación terminada
                                            </button>
                                          )}
                                          {/* Reparado pendiente VoBo → Aprobar / Rechazar */}
                                          {item.id_estatus_checklist === ESTATUS_CHECKLIST.REPARADO_PENDIENTE_VOBO && (<>
                                            <button
                                              onClick={() => handleActualizarEstatus(item.id, ESTATUS_CHECKLIST.VOBO_APROBADO)}
                                              className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1">
                                              <CheckCheck className="w-3 h-3" /> Aprobar VoBo
                                            </button>
                                            <button
                                              onClick={() => handleActualizarEstatus(item.id, ESTATUS_CHECKLIST.VOBO_RECHAZADO)}
                                              className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 text-[11px] font-medium hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1">
                                              <X className="w-3 h-3" /> Rechazar VoBo
                                            </button>
                                          </>)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* Observación registrada */}
                                  {item.observacion && (
                                    <p className="ml-5 mt-1 text-[11px] text-slate-400 italic truncate">
                                      Obs: {item.observacion}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* VoBo Panel */}
            {selectedCat && (
              <div className="w-[300px] min-w-[300px] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden self-start sticky top-0">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">Detalle del VoBo</p>
                    <button onClick={() => setSelectedCat(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedCat.nombre}</p>
                    {(() => {
                      const panelApl = selectedCat.items.filter(i => i.id_estatus_checklist !== ESTATUS_CHECKLIST.NO_APLICA);
                      const panelCum = panelApl.filter(i => i.id_estatus_checklist === ESTATUS_CHECKLIST.CUMPLE);
                      const panelPct = panelApl.length > 0 ? Math.round((panelCum.length / panelApl.length) * 100) : 0;
                      return (
                        <>
                          <div className="flex items-center justify-between mt-2 mb-1">
                            <span className="text-xs text-slate-500">Conceptos</span>
                            <span className="text-xs font-semibold text-emerald-600">
                              {panelCum.length}/{panelApl.length} completos
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${panelPct}%` }} />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {selectedCat.responsable && (
                    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{selectedCat.responsable}</p>
                          {selectedCat.cargo && <p className="text-[11px] text-slate-500">{selectedCat.cargo}</p>}
                        </div>
                      </div>
                      {selectedCat.fecha_vobo && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                          <Clock className="w-3 h-3" /> {fmtDt(selectedCat.fecha_vobo)}
                        </div>
                      )}
                    </div>
                  )}
                  {!selectedCat.responsable && (
                    <p className="text-xs text-slate-400">VoBo aún no registrado.</p>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Ítems ({selectedCat.items.length})</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {selectedCat.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-700 leading-tight">{item.nombre}</span>
                          <span className={`text-[11px] font-medium shrink-0 ${ITEM_CLS[item.id_estatus_checklist] ?? 'text-slate-400'}`}>
                            {getEstatusNombre(item.id_estatus_checklist)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PAQUETE MUEBLES ── */}
        {activeTab === 'muebles' && (
          <div className="max-w-3xl space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
              daikuEstatus === 'COMPLETADO' ? 'bg-emerald-50 border-emerald-200' :
              daikuEstatus === 'NO_APLICA'  ? 'bg-slate-50 border-slate-200' :
              'bg-amber-50 border-amber-200'
            }`}>
              <Package className={`w-6 h-6 shrink-0 ${
                daikuEstatus === 'COMPLETADO' ? 'text-emerald-600' :
                daikuEstatus === 'NO_APLICA'  ? 'text-slate-400' : 'text-amber-600'
              }`} />
              <div>
                <p className="text-sm font-bold text-slate-900">Paquete de Muebles</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {daikuEstatus === 'COMPLETADO'     && 'Entregado e instalado correctamente.'}
                  {daikuEstatus === 'NO_APLICA'      && 'Esta unidad no incluye paquete de muebles.'}
                  {daikuEstatus === 'PENDIENTE'      && 'Pendiente de entrega e instalación.'}
                  {daikuEstatus === 'EN_INSTALACION' && 'En proceso de instalación.'}
                  {!['COMPLETADO','NO_APLICA','PENDIENTE','EN_INSTALACION'].includes(daikuEstatus) && daikuEstatus}
                </p>
              </div>
            </div>
            {daikuEstatus === 'NO_APLICA' ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center text-center shadow-sm">
                <Package className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">Esta unidad no incluye paquete de muebles.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-bold text-slate-900 mb-3">Estatus del paquete de muebles</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ['Estatus actual', daikuEstatus.replace('_', ' ')],
                    ['Entrega', entrega.fecha_entrega ? fmt(entrega.fecha_entrega) : '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-slate-400 mb-0.5">{l}</p>
                      <p className="font-medium text-slate-800">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PROGRAMACIÓN ── */}
        {activeTab === 'programacion' && (
          <div className="max-w-xl bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-slate-900">Programación de entrega</p>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Fecha programada</label>
              <input type="date" readOnly
                defaultValue={entrega.fecha_programada?.split('T')[0] ?? ''}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
            {[
              ['Punto de reunión', entrega.punto_reunion ?? ''],
              ['Teléfono de contacto', entrega.telefono_contacto ?? ''],
              ['Entregado por', entrega.entregado_por ?? ''],
            ].map(([l, v]) => (
              <div key={l}>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">{l}</label>
                <input type="text" readOnly defaultValue={v}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>
            ))}
            <p className="text-xs text-slate-400">La edición de programación estará disponible próximamente.</p>
          </div>
        )}

        {/* ── ACTA DE ENTREGA ── */}
        {activeTab === 'acta' && (
          <div className="flex gap-6 max-w-[1100px]">
            <div className="flex-1 min-w-0 space-y-5">
              {/* Steps */}
              <div className="flex items-center gap-0">
                {['Información', 'Checklist', 'Observaciones', 'Firmas', 'Finalizar'].map((s, i) => {
                  const num = i + 1;
                  const done = num < actaStep;
                  const active = num === actaStep;
                  return (
                    <div key={s} className="flex items-center flex-1">
                      <button onClick={() => setActaStep(num)} className="flex flex-col items-center gap-1 w-full group">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {done ? <CheckCheck className="w-4 h-4" /> : num}
                        </div>
                        <span className={`text-[10px] text-center ${active ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>{s}</span>
                      </button>
                      {i < 4 && <div className={`h-0.5 flex-1 -mt-5 transition-all ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                    </div>
                  );
                })}
              </div>

              {checklistGlobal === 100 && (
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-800">
                    <span className="font-semibold">Checklist completado al 100%.</span> La unidad está lista para la entrega.
                  </p>
                </div>
              )}

              {actaStep === 1 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <p className="text-sm font-bold text-slate-900">Acta de entrega digital</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Unidad', unidadLabel], ['Proyecto', proyectoLabel],
                      ['Modelo', modeloLabel],
                      ['Cliente', clienteNombre],
                      ['Fecha programada', fmt(entrega.fecha_programada)],
                      ['Entregado por', entrega.entregado_por ?? '—'],
                    ].map(([l, v]) => (
                      <div key={l} className="bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{l}</p>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-800 mb-2">Declaración de conformidad</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Por medio de la presente, el cliente recibe de conformidad la unidad descrita anteriormente, con todas sus instalaciones, equipamiento y accesorios en condiciones funcionales, de acuerdo con el checklist verificado y la información proporcionada por el desarrollador.
                    </p>
                  </div>
                </div>
              )}

              {actaStep === 4 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
                  <p className="text-sm font-bold text-slate-900">Firma del cliente</p>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nombre completo del cliente<span className="text-red-500 ml-0.5">*</span></label>
                    <input type="text" value={firmaNombre} onChange={e => setFirmaNombre(e.target.value)}
                      placeholder="Nombre tal como aparece en la identificación"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Firma digital<span className="text-red-500 ml-0.5">*</span></label>
                    <SignatureCanvas onChange={setFirmaData} />
                    {firmaData && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Firma capturada correctamente
                      </div>
                    )}
                  </div>
                </div>
              )}

              {actaStep === 5 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <p className="text-sm font-bold text-slate-900">Resumen y finalización</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Checklist técnico', ok: checklistGlobal === 100, value: `${checklistGlobal}%` },
                      { label: 'Paquete Muebles', ok: daikuEstatus !== 'PENDIENTE', value: daikuEstatus === 'NO_APLICA' ? 'No aplica' : daikuEstatus === 'COMPLETADO' ? 'Completado' : 'Pendiente' },
                      { label: 'Observaciones', ok: !observaciones.some(o => o.prioridad === 'CRITICA' && o.estatus !== 'RESUELTA'), value: `${observaciones.filter(o => o.estatus !== 'RESUELTA').length} abiertas` },
                      { label: 'Firma del cliente', ok: !!firmaData && !!firmaNombre, value: firmaData && firmaNombre ? firmaNombre : 'Pendiente' },
                    ].map(s => (
                      <div key={s.label} className={`flex items-center justify-between p-3 rounded-xl border ${s.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center gap-2">
                          {s.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                          <span className="text-sm font-medium text-slate-800">{s.label}</span>
                        </div>
                        <span className={`text-xs font-medium ${s.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Al finalizar: se cambiará el estatus a <strong>Entregada</strong>, se generarán los documentos y se activará el módulo de Postventa.
                  </p>
                  <button onClick={async () => {
                    if (!firmaData) { toast.error('La firma del cliente es requerida'); return; }
                    if (!firmaNombre.trim()) { toast.error('Ingresa el nombre completo del cliente'); return; }
                    setSaving(true);
                    await new Promise(r => setTimeout(r, 1000));
                    setSaving(false);
                    toast.info('La finalización del acta estará disponible próximamente.');
                  }} disabled={saving || !firmaData || !firmaNombre}
                    className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando…</> : <><CheckCheck className="w-4 h-4" /> Finalizar entrega</>}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button onClick={() => setActaStep(s => Math.max(1, s - 1))} disabled={actaStep === 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Regresar
                </button>
                {actaStep < 5 && (
                  <button onClick={() => setActaStep(s => Math.min(5, s + 1))}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                    Continuar <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Observaciones panel */}
            <div className="w-[280px] min-w-[280px] space-y-4 self-start sticky top-0">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Observaciones</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-200 mt-1">
                      {observaciones.length} registradas
                    </span>
                  </div>
                </div>
                {observaciones.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">Sin observaciones registradas.</p>
                ) : (
                  <div className="space-y-3">
                    {observaciones.slice(0, 5).map(obs => (
                      <div key={obs.id} className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{obs.descripcion}</p>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${PRIORIDAD_META[obs.prioridad]?.cls ?? 'bg-slate-100 text-slate-600'}`}>
                            {PRIORIDAD_META[obs.prioridad]?.label ?? obs.prioridad}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{fmtDt(obs.fecha_creacion)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── OBSERVACIONES ── */}
        {activeTab === 'observaciones' && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">
                {observaciones.length} observación{observaciones.length !== 1 ? 'es' : ''} registrada{observaciones.length !== 1 ? 's' : ''}
              </p>
            </div>
            {observaciones.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 flex flex-col items-center text-center shadow-sm">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
                <p className="text-sm font-medium text-slate-600">Sin observaciones registradas</p>
                <p className="text-xs text-slate-400 mt-1">Esta unidad no tiene observaciones abiertas.</p>
              </div>
            ) : (
              observaciones.map(obs => (
                <div key={obs.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-sm font-medium text-slate-900 leading-snug">{obs.descripcion}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORIDAD_META[obs.prioridad]?.cls ?? 'bg-slate-100 text-slate-600'}`}>
                        {PRIORIDAD_META[obs.prioridad]?.label ?? obs.prioridad}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                        {obs.estatus}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end text-xs text-slate-400">
                    <span>{fmtDt(obs.fecha_creacion)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── DOCUMENTOS ── */}
        {activeTab === 'documentos' && (
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-bold text-slate-900">Documentos de la entrega</p>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs text-amber-700">Los documentos se generarán automáticamente al finalizar el acta de entrega.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { nombre: 'Acta de entrega',           pendiente: entrega.estatus !== 'ENTREGADA' },
                { nombre: 'Checklist técnico PDF',     pendiente: checklistGlobal < 100 },
                { nombre: 'Manual del propietario',    pendiente: false },
                { nombre: 'Garantías',                 pendiente: false },
                { nombre: 'Instructivo chapa digital', pendiente: false },
                { nombre: 'Manual de boiler',          pendiente: false },
                { nombre: 'Manual de A/C',             pendiente: false },
                { nombre: 'Documentos CFE',            pendiente: true },
                { nombre: 'Documentos SIAPA',          pendiente: true },
                { nombre: 'Reglamento',                pendiente: false },
              ].map(doc => (
                <div key={doc.nombre} className={`flex items-center justify-between bg-white border rounded-2xl p-4 shadow-sm ${doc.pendiente ? 'border-dashed border-slate-200 opacity-60' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <FileText className={`w-4 h-4 shrink-0 ${doc.pendiente ? 'text-slate-300' : 'text-slate-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{doc.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{doc.pendiente ? 'Pendiente de generación' : 'Disponible'}</p>
                    </div>
                  </div>
                  {!doc.pendiente && (
                    <button onClick={() => toast.info(`Descarga de ${doc.nombre} no disponible aún`)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {activeTab === 'historial' && (
          <div className="max-w-2xl space-y-4">
            <p className="text-sm font-bold text-slate-900">Bitácora de eventos</p>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Evento inicial: pre-entrega iniciada */}
              <div className="flex items-start gap-4 p-4 border-b border-slate-50">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-sky-50 text-sky-600">
                  <Wrench className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Pre-entrega iniciada</p>
                  <p className="text-xs text-slate-500 mt-0.5">Registro de pre-entrega creado · estatus PRE_ENTREGA_EN_PROCESO</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">—</p>
                </div>
              </div>
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-slate-400">El historial completo de eventos estará disponible próximamente.</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal: No cumple ─────────────────────────────────────────────────── */}
      {noCumpleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Marcar como No cumple</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{noCumpleModal.nombre}</p>
              </div>
              <button onClick={() => setNoCumpleModal(null)} className="text-slate-400 hover:text-slate-600 mt-0.5 ml-4 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Observación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={noCumpleObs}
                onChange={e => setNoCumpleObs(e.target.value)}
                placeholder="Describe el problema encontrado…"
                rows={4}
                autoFocus
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                La observación se guardará en el ítem y en el log de observaciones de la entrega.
              </p>
              {/* TODO: evidencia fotográfica — implementar cuando exista tabla entregas_checklist_evidencias */}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setNoCumpleModal(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleGuardarNoCumple}
                disabled={!noCumpleObs.trim() || itemsLoading.has(noCumpleModal.itemId)}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {itemsLoading.has(noCumpleModal.itemId)
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                  : 'Guardar y marcar No cumple'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
