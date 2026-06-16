import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Home, Calendar, CheckCircle2, AlertTriangle, Clock, RotateCcw,
  ChevronRight, Building2, Search, X, Star, MoreHorizontal,
  Truck, Eye, ChevronDown, RefreshCw, Download, AlertCircle, Loader2, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type EstatusEntrega = 'PENDIENTE_PRE_ENTREGA' | 'PRE_ENTREGA_EN_PROCESO' | 'LISTO' | 'PROGRAMADA' | 'EN_PROCESO' | 'ENTREGADA' | 'CON_OBSERVACIONES' | 'REPROGRAMADA';

interface EntregaRow {
  id: string;
  unidad: string;
  torre: string;
  proyecto: string;
  proyectoId: number;
  cliente: string;
  modelo: string;
  cuentaId: number;
  precioFinal: number;
  estatus: EstatusEntrega;
  fechaProgramada: string | null;
  fechaEntrega: string | null;
  checklistPct: number;
  daikuEstatus: 'COMPLETADO' | 'PENDIENTE' | 'EN_INSTALACION' | 'NO_APLICA';
  actaEstatus: 'FIRMADA' | 'PENDIENTE' | 'GENERADA';
  actaUrl: string | null;
  observaciones: number;
  entregadoPor: string | null;
}

// tipos_documento.id = 24 → "Acta de entrega"
// estatus_disponibilidad: 5=Vendido 7=Escrituración 8=Entregado 9=Pagada completamente
const ID_TIPO_ACTA_ENTREGA = 24;
const ESTATUS_ENTREGA_IDS = [5, 7, 8, 9] as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTATUS_META: Record<EstatusEntrega, { label: string; cls: string; dot: string; color: string }> = {
  PENDIENTE_PRE_ENTREGA:  { label: 'Pendiente de pre-entrega', cls: 'bg-slate-50 text-slate-600 border border-slate-200',       dot: 'bg-slate-400',   color: '#94A3B8' },
  PRE_ENTREGA_EN_PROCESO: { label: 'Pre-entrega en proceso',   cls: 'bg-sky-50 text-sky-700 border border-sky-200',             dot: 'bg-sky-500',     color: '#0EA5E9' },
  LISTO:                  { label: 'Lista p/entrega',           cls: 'bg-blue-50 text-blue-700 border border-blue-200',         dot: 'bg-blue-500',    color: '#3B82F6' },
  PROGRAMADA:             { label: 'Programada',                cls: 'bg-violet-50 text-violet-700 border border-violet-200',   dot: 'bg-violet-500',  color: '#7C3AED' },
  EN_PROCESO:             { label: 'En proceso',                cls: 'bg-amber-50 text-amber-700 border border-amber-200',      dot: 'bg-amber-500',   color: '#F59E0B' },
  ENTREGADA:              { label: 'Entregada',                 cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', color: '#10B981' },
  CON_OBSERVACIONES:      { label: 'Con observaciones',         cls: 'bg-orange-50 text-orange-700 border border-orange-200',  dot: 'bg-orange-500',  color: '#F97316' },
  REPROGRAMADA:           { label: 'Reprogramada',              cls: 'bg-red-50 text-red-700 border border-red-200',            dot: 'bg-red-500',     color: '#EF4444' },
};

const DAIKU_META = {
  COMPLETADO:     { label: 'Completado',     cls: 'text-emerald-600 bg-emerald-50' },
  PENDIENTE:      { label: 'Pendiente',      cls: 'text-amber-600 bg-amber-50' },
  EN_INSTALACION: { label: 'En instalación', cls: 'text-blue-600 bg-blue-50' },
  NO_APLICA:      { label: 'No aplica',      cls: 'text-slate-500 bg-slate-100' },
};

const ACTA_META = {
  FIRMADA:   { label: 'Firmada',   cls: 'text-emerald-600 bg-emerald-50' },
  GENERADA:  { label: 'Generada',  cls: 'text-blue-600 bg-blue-50' },
  PENDIENTE: { label: 'Pendiente', cls: 'text-slate-500 bg-slate-100' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const fmtFechaProgramada = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

const fmtFechaSemana = (s: string) => {
  const d = new Date(s);
  return {
    dia: d.toLocaleDateString('es-MX', { day: 'numeric' }),
    mes: d.toLocaleDateString('es-MX', { month: 'short' }),
    hora: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 animate-pulse rounded-lg ${className}`} />;
}

function EstatusBadge({ estatus }: { estatus: EstatusEntrega }) {
  const m = ESTATUS_META[estatus];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function ChecklistBar({ pct }: { pct: number }) {
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums shrink-0 ${pct === 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
    </div>
  );
}

function KpiCard({
  value, label, icon: Icon, color, bg, onClick, active, loading,
}: {
  value: number; label: string; icon: React.ElementType;
  color: string; bg: string; onClick?: () => void; active?: boolean; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group text-left bg-white rounded-2xl border-2 p-5 shadow-sm transition-all hover:shadow-md flex-1 min-w-[150px] ${
        active ? 'border-current ring-2' : 'border-slate-200 hover:border-slate-300'
      }`}
      style={active ? { borderColor: color, '--tw-ring-color': color + '30' } as React.CSSProperties : {}}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {loading ? (
        <Shimmer className="h-8 w-16 mb-1" />
      ) : (
        <p className="text-3xl font-bold tabular-nums text-slate-900 mb-1">{value}</p>
      )}
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-xs text-slate-400 mt-1 group-hover:text-blue-500 transition-colors flex items-center gap-0.5">
        Ver detalle <ChevronRight className="w-3 h-3" />
      </p>
    </button>
  );
}

function CircleGauge({ value, size = 90, color = '#10b981', label }: { value: number; size?: number; color?: string; label?: string }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-900">{value}%</span>
        </div>
      </div>
      {label && <p className="text-[10px] text-slate-500 text-center">{label}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EntregasDashboard() {
  const navigate = useNavigate();
  const [proyectoId, setProyectoId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusEntrega | 'TODOS'>('TODOS');
  const [filtroTorre, setFiltroTorre] = useState('Todas');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [entregasExist, setEntregasExist] = useState<boolean | null>(null);

  // ── Check if entregas table exists ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { error } = await (supabase as any).from('entregas').select('id').limit(1);
      setEntregasExist(!error);
    })();
  }, []);

  // ── Projects query (solo proyectos SOZU publicados) ────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['proyectos-entregas-sozu'],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
      const ids = (rels ?? []).map((r: any) => r.id_proyecto).filter(Boolean);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .in('id', ids)
        .eq('publicar', true)
        .eq('activo', true)
        .order('nombre');
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });

  // ── Main data query ─────────────────────────────────────────────────────────
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['entregas-rows', proyectoId, proyectos.map(p => p.id).join(','), entregasExist],
    queryFn: async (): Promise<EntregaRow[]> => {
      const proyectoIds = proyectoId ? [proyectoId] : proyectos.map(p => p.id);
      if (!proyectoIds.length) return [];

      // ── 1. Edificios ──────────────────────────────────────────────────────
      const { data: edificios } = await supabase
        .from('edificios')
        .select('id, nombre, id_proyecto')
        .in('id_proyecto', proyectoIds)
        .eq('activo', true);
      const edificioIds = (edificios ?? []).map((e: any) => e.id);
      if (!edificioIds.length) return [];
      const edificioMap: Record<number, { nombre: string; proyectoId: number }> = Object.fromEntries(
        (edificios ?? []).map((e: any) => [e.id, { nombre: e.nombre, proyectoId: e.id_proyecto }])
      );

      // ── 2. Modelos (con nombre real) ──────────────────────────────────────
      const { data: edificioModelos } = await supabase
        .from('edificios_modelos')
        .select('id, id_edificio, id_modelo')
        .in('id_edificio', edificioIds);
      const modeloIds = (edificioModelos ?? []).map((m: any) => m.id);
      if (!modeloIds.length) return [];
      const modeloEdificioMap: Record<number, number> = Object.fromEntries(
        (edificioModelos ?? []).map((m: any) => [m.id, m.id_edificio])
      );
      // Fetch nombres de modelos
      const idModeloSet = [...new Set((edificioModelos ?? []).map((m: any) => m.id_modelo).filter(Boolean))];
      const modeloNombreMap: Record<number, string> = {};
      if (idModeloSet.length) {
        const { data: mods } = await supabase.from('modelos').select('id, nombre').in('id', idModeloSet as any);
        (mods ?? []).forEach((m: any) => { modeloNombreMap[m.id] = m.nombre ?? '—'; });
      }
      // edificioModeloId → nombre del modelo
      const emModeloNombre: Record<number, string> = Object.fromEntries(
        (edificioModelos ?? []).map((m: any) => [m.id, modeloNombreMap[m.id_modelo] ?? '—'])
      );

      // ── 3. Propiedades — solo estatus de escrituración/entrega ────────────
      // 5=Vendido  7=Escrituración  8=Entregado  9=Pagada completamente
      const { data: propiedades } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, id_edificio_modelo, id_estatus_disponibilidad, fecha_actualizacion')
        .in('id_edificio_modelo', modeloIds)
        .in('id_estatus_disponibilidad', [...ESTATUS_ENTREGA_IDS])
        .eq('activo', true)
        .order('numero_propiedad');
      if (!propiedades?.length) return [];
      const propIds = propiedades.map((p: any) => p.id);

      // ── 4. Cuentas de cobranza — batches de 40 para evitar límite 1000 ───
      // Una propiedad puede tener varias cuentas (principal + bodega + estac).
      // Guardamos la más reciente como "cuenta principal" para datos de cliente/notario.
      // Sumamos precio_final de TODAS las cuentas para el valor real de escrituración.
      const BATCH_C = 40;
      const cuentaByPropId: Record<number, any> = {};
      const precioTotalByProp: Record<number, number> = {};

      await Promise.all(
        Array.from({ length: Math.ceil(propIds.length / BATCH_C) }, (_, i) =>
          propIds.slice(i * BATCH_C, (i + 1) * BATCH_C)
        ).map(async slice => {
          const { data: batch } = await supabase
            .from('cuentas_cobranza')
            .select('id, id_propiedad, precio_final, fecha_actualizacion')
            .in('id_propiedad', slice as any)
            .eq('activo', true);
          (batch ?? []).forEach((c: any) => {
            // suma de precio de todas las cuentas de la prop
            precioTotalByProp[c.id_propiedad] = (precioTotalByProp[c.id_propiedad] || 0) + Number(c.precio_final || 0);
            // cuenta principal = la más reciente
            const existing = cuentaByPropId[c.id_propiedad];
            if (!existing || c.fecha_actualizacion > existing.fecha_actualizacion)
              cuentaByPropId[c.id_propiedad] = c;
          });
        })
      );

      const cuentaIds = Object.values(cuentaByPropId).map((c: any) => c.id as number);
      if (!cuentaIds.length) return [];

      // ── 5. Compradores + Personas ─────────────────────────────────────────
      const { data: compradores } = await supabase
        .from('compradores')
        .select('id_cuenta_cobranza, id_persona')
        .in('id_cuenta_cobranza', cuentaIds)
        .eq('activo', true);
      const personaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))];
      let personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase
          .from('personas')
          .select('id, nombre_legal')
          .in('id', personaIds as number[]);
        personaMap = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p.nombre_legal ?? '—']));
      }
      const cuentaToPersona: Record<number, string> = {};
      (compradores ?? []).forEach((c: any) => {
        if (!cuentaToPersona[c.id_cuenta_cobranza])
          cuentaToPersona[c.id_cuenta_cobranza] = personaMap[c.id_persona] ?? '—';
      });

      // ── 6. Entregas (si la tabla existe) ──────────────────────────────────
      let entregaByPropId: Record<number, any> = {};
      if (entregasExist) {
        const { data: entregasData } = await (supabase as any)
          .from('entregas')
          .select('id, id_propiedad, estatus, fecha_programada, fecha_entrega, muebles_daiku_estatus, entregado_por')
          .in('id_propiedad', propIds)
          .eq('activo', true);
        (entregasData ?? []).forEach((e: any) => { entregaByPropId[e.id_propiedad] = e; });
      }

      // ── 7a. Checklist progress — suma items_completos/total_items por entrega ─
      // items_completos y total_items son conteos reales en BD (no porcentajes).
      // El porcentaje se calcula aquí en JS como dato derivado.
      const entregaIds = Object.values(entregaByPropId).map((e: any) => e.id as number);
      const checklistPctByEntregaId: Record<number, number> = {};
      if (entregaIds.length) {
        const { data: catAgg } = await supabase
          .from('entregas_checklist_categorias')
          .select('id_entrega, items_completos, total_items')
          .in('id_entrega', entregaIds)
          .eq('activo', true);
        const sumByEntrega: Record<number, { completos: number; total: number }> = {};
        (catAgg ?? []).forEach((c: any) => {
          if (!sumByEntrega[c.id_entrega]) sumByEntrega[c.id_entrega] = { completos: 0, total: 0 };
          sumByEntrega[c.id_entrega].completos += Number(c.items_completos ?? 0);
          sumByEntrega[c.id_entrega].total     += Number(c.total_items   ?? 0);
        });
        Object.entries(sumByEntrega).forEach(([id, s]) => {
          checklistPctByEntregaId[Number(id)] = s.total > 0 ? Math.round((s.completos / s.total) * 100) : 0;
        });
      }

      // ── 7b. Documentos — Acta de entrega (id_tipo_documento = 24) ─────────
      // Derivamos acta_estatus desde documentos: sin columna en BD.
      //   es_draft=false → FIRMADA
      //   es_draft=true  → GENERADA
      //   sin documento  → PENDIENTE
      // Keyed por id_propiedad. Si hay draft y firmada, prevalece FIRMADA.
      const { data: actaDocs } = await supabase
        .from('documentos')
        .select('id_propiedad, url, fecha_creacion, es_draft')
        .in('id_propiedad', propIds)
        .eq('id_tipo_documento', ID_TIPO_ACTA_ENTREGA)
        .eq('activo', true);
      const actaByPropId: Record<number, { fechaCreacion: string; url: string; isDraft: boolean }> = {};
      (actaDocs ?? []).forEach((d: any) => {
        const existing = actaByPropId[d.id_propiedad];
        // Prioridad: un acta firmada (es_draft=false) gana sobre draft
        if (!existing || (!d.es_draft && existing.isDraft))
          actaByPropId[d.id_propiedad] = { fechaCreacion: d.fecha_creacion, url: d.url ?? '', isDraft: !!d.es_draft };
      });

      // ── 8. Lookup de nombres de proyecto ─────────────────────────────────
      const proyectoNombreMap: Record<number, string> = Object.fromEntries(
        proyectos.map(p => [p.id, p.nombre])
      );

      // ── 9. Ensamblar filas ────────────────────────────────────────────────
      return propiedades
        .filter((p: any) => cuentaByPropId[p.id])
        .map((p: any): EntregaRow => {
          const cuenta = cuentaByPropId[p.id];
          const entrega = entregaByPropId[p.id] ?? null;
          const acta = actaByPropId[p.id] ?? null;
          const edificioId = modeloEdificioMap[p.id_edificio_modelo];
          const edificio = edificioMap[edificioId];
          const pId = edificio?.proyectoId ?? 0;

          // Prioridad: tabla entregas → id_estatus_disponibilidad=8 → acta → PENDIENTE_PRE_ENTREGA
          // Sin registro en entregas = pre-entrega no iniciada, nunca LISTO automáticamente.
          const estatus: EstatusEntrega = entrega
            ? (entrega.estatus as EstatusEntrega)
            : (p.id_estatus_disponibilidad === 8 || acta)
              ? 'ENTREGADA'
              : 'PENDIENTE_PRE_ENTREGA';

          // acta_estatus se deriva desde documentos tipo 24: FIRMADA | GENERADA | PENDIENTE
          const actaEstatus: EntregaRow['actaEstatus'] = acta
            ? (acta.isDraft ? 'GENERADA' : 'FIRMADA')
            : 'PENDIENTE';

          return {
            id: entrega ? String(entrega.id) : `prop-${p.id}`,
            unidad: p.numero_propiedad ?? '—',
            torre: edificio?.nombre ?? '—',
            proyecto: proyectoNombreMap[pId] ?? '—',
            proyectoId: pId,
            cliente: cuentaToPersona[cuenta.id] ?? '—',
            modelo: emModeloNombre[p.id_edificio_modelo] ?? '—',
            cuentaId: cuenta.id,
            precioFinal: precioTotalByProp[p.id] ?? Number(cuenta.precio_final ?? 0),
            estatus,
            fechaProgramada: entrega?.fecha_programada ?? null,
            fechaEntrega: entrega?.fecha_entrega ?? acta?.fechaCreacion ?? null,
            checklistPct: entrega ? (checklistPctByEntregaId[entrega.id] ?? 0) : 0,
            daikuEstatus: (entrega?.muebles_daiku_estatus ?? 'NO_APLICA') as EntregaRow['daikuEstatus'],
            actaEstatus,
            actaUrl: acta?.url ?? null,
            observaciones: 0,
            entregadoPor: entrega?.entregado_por ?? null,
          };
        });
    },
    enabled: proyectos.length > 0 && entregasExist !== null,
  });

  // ── Derived data ────────────────────────────────────────────────────────────
  const torres = useMemo(() => {
    const set = new Set(rows.map(r => r.torre).filter(Boolean));
    return ['Todas', ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() =>
    rows.filter(r => {
      if (filtroEstatus !== 'TODOS' && r.estatus !== filtroEstatus) return false;
      if (filtroTorre !== 'Todas' && r.torre !== filtroTorre) return false;
      if (filtroFecha) {
        const d = r.fechaProgramada ? r.fechaProgramada.slice(0, 10) : null;
        if (d !== filtroFecha) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (![r.unidad, r.cliente, r.proyecto, String(r.cuentaId)].some(v => v.toLowerCase().includes(q))) return false;
      }
      return true;
    }), [rows, filtroEstatus, filtroTorre, filtroFecha, search]);

  const stats = useMemo(() => ({
    pendientePreEntrega: rows.filter(r => r.estatus === 'PENDIENTE_PRE_ENTREGA').length,
    preEntregaEnProceso: rows.filter(r => r.estatus === 'PRE_ENTREGA_EN_PROCESO').length,
    listo:               rows.filter(r => r.estatus === 'LISTO').length,
    programadas:         rows.filter(r => r.estatus === 'PROGRAMADA').length,
    enProceso:           rows.filter(r => r.estatus === 'EN_PROCESO').length,
    entregadas:          rows.filter(r => r.estatus === 'ENTREGADA').length,
    conObservaciones:    rows.filter(r => r.estatus === 'CON_OBSERVACIONES').length,
    reprogramaciones:    rows.filter(r => r.estatus === 'REPROGRAMADA').length,
  }), [rows]);

  const donutData = [
    { name: 'Pendiente de pre-entrega', value: stats.pendientePreEntrega, color: '#94A3B8' },
    { name: 'Pre-entrega en proceso',   value: stats.preEntregaEnProceso, color: '#0EA5E9' },
    { name: 'Lista p/entrega',          value: stats.listo,               color: '#3B82F6' },
    { name: 'Programadas',              value: stats.programadas,         color: '#7C3AED' },
    { name: 'En proceso',               value: stats.enProceso,           color: '#F59E0B' },
    { name: 'Entregadas',               value: stats.entregadas,          color: '#10B981' },
    { name: 'Con observaciones',        value: stats.conObservaciones,    color: '#F97316' },
  ].filter(d => d.value > 0);
  const total = rows.length;

  // Programadas esta semana
  const semanaRows = useMemo(() => {
    const hoy = new Date();
    const fin = new Date(hoy);
    fin.setDate(fin.getDate() + 7);
    return rows
      .filter(r => r.estatus === 'PROGRAMADA' && r.fechaProgramada)
      .filter(r => {
        const d = new Date(r.fechaProgramada!);
        return d >= hoy && d <= fin;
      })
      .sort((a, b) => new Date(a.fechaProgramada!).getTime() - new Date(b.fechaProgramada!).getTime())
      .slice(0, 6);
  }, [rows]);

  // Por proyecto
  const porProyecto = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.proyecto] = (map[r.proyecto] ?? 0) + 1; });
    return Object.entries(map)
      .map(([nombre, count]) => ({ nombre, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [rows, total]);

  const PROYECTO_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

  const proyectoNombreActivo = proyectos.find(p => p.id === proyectoId)?.nombre ?? 'Todos';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/40">
      <div className="px-6 py-6 space-y-6 max-w-[1600px]">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Dashboard / Entregas</p>
            <h1 className="text-2xl font-bold text-slate-900">Entregas</h1>
            <p className="text-sm text-slate-500 mt-0.5">Dashboard general de entregas de departamentos</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={proyectoId ?? ''}
                onChange={e => { setProyectoId(Number(e.target.value) || null); setFiltroTorre('Todas'); }}
                className="pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">Proyecto: Todos</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button onClick={() => refetch()}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => toast.info('Generando reporte…')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50">
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        </div>

        {/* ── Banner: entregas table missing ── */}
        {entregasExist === false && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Tablas de entregas no encontradas</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Ejecuta el DDL en <span className="font-mono">Ejecuciones_manuales/modulo_entregas.md</span> para
                habilitar estatus, checklist y acta. Los datos base de unidades se muestran de todas formas.
              </p>
            </div>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[
            { value: stats.pendientePreEntrega, label: 'Pendiente de pre-entrega', icon: Clock,         color: '#94A3B8', bg: 'bg-slate-100',  estatus: 'PENDIENTE_PRE_ENTREGA' as EstatusEntrega },
            { value: stats.preEntregaEnProceso, label: 'Pre-entrega en proceso',   icon: Wrench,        color: '#0EA5E9', bg: 'bg-sky-50',     estatus: 'PRE_ENTREGA_EN_PROCESO' as EstatusEntrega },
            { value: stats.listo,               label: 'Lista p/entrega',           icon: Home,          color: '#3B82F6', bg: 'bg-blue-50',    estatus: 'LISTO' as EstatusEntrega },
            { value: stats.programadas,         label: 'Programadas',               icon: Calendar,      color: '#7C3AED', bg: 'bg-violet-50',  estatus: 'PROGRAMADA' as EstatusEntrega },
            { value: stats.enProceso,           label: 'En proceso hoy',            icon: Truck,         color: '#F59E0B', bg: 'bg-amber-50',   estatus: 'EN_PROCESO' as EstatusEntrega },
            { value: stats.entregadas,          label: 'Entregadas',                icon: CheckCircle2,  color: '#10B981', bg: 'bg-emerald-50', estatus: 'ENTREGADA' as EstatusEntrega },
            { value: stats.conObservaciones,    label: 'Con observaciones',         icon: AlertTriangle, color: '#F97316', bg: 'bg-orange-50',  estatus: 'CON_OBSERVACIONES' as EstatusEntrega },
            { value: stats.reprogramaciones,    label: 'Reprogramaciones',          icon: RotateCcw,     color: '#EF4444', bg: 'bg-red-50',     estatus: 'REPROGRAMADA' as EstatusEntrega },
          ].map(k => (
            <KpiCard key={k.estatus} value={k.value} label={k.label} icon={k.icon}
              color={k.color} bg={k.bg} loading={isLoading}
              active={filtroEstatus === k.estatus}
              onClick={() => setFiltroEstatus(filtroEstatus === k.estatus ? 'TODOS' : k.estatus)}
            />
          ))}
        </div>

        {/* ── Middle section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Donut chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900 mb-4">Entregas por estatus</p>
            {isLoading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <PieChart width={160} height={160}>
                    <Pie data={donutData.length ? donutData : [{ name: 'Sin datos', value: 1, color: '#e2e8f0' }]}
                      cx={80} cy={80} innerRadius={48} outerRadius={75}
                      paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                      {(donutData.length ? donutData : [{ color: '#e2e8f0' }]).map((d, i) => (
                        <Cell key={i} fill={d.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, n]} />
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-2xl font-bold text-slate-900">{total}</p>
                    <p className="text-[10px] text-slate-400">Total</p>
                  </div>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  {donutData.map(d => (
                    <div key={d.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-[11px] text-slate-600 truncate">{d.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Weekly schedule */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-slate-900">Programadas esta semana</p>
              <button className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                Ver calendario <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Shimmer key={i} className="h-12" />)}</div>
            ) : semanaRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                <Calendar className="w-8 h-8 mb-2" />
                <p className="text-xs">{entregasExist ? 'Sin programadas esta semana' : 'Disponible tras crear tablas'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {semanaRows.map((item, i) => {
                  const f = fmtFechaSemana(item.fechaProgramada!);
                  return (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                      <div className="text-center shrink-0 w-10">
                        <p className="text-[10px] text-slate-400 leading-none">{f.mes}</p>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{f.dia}</p>
                        <p className="text-[10px] text-slate-500">{f.hora}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{item.unidad} · {item.torre}</p>
                        <p className="text-[11px] text-slate-500 truncate">{item.cliente}</p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">Programada</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* By project */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900 mb-4">Entregas por proyecto</p>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Shimmer key={i} className="h-8" />)}</div>
            ) : porProyecto.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Sin datos</p>
            ) : (
              <div className="space-y-4">
                {porProyecto.slice(0, 5).map((p, i) => (
                  <div key={p.nombre}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700">{p.nombre}</span>
                      <span className="text-xs text-slate-500 tabular-nums">{p.count} ({p.pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${PROYECTO_COLORS[i % PROYECTO_COLORS.length]}`}
                        style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="mt-4 text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Ver detalle por proyecto <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-900 mb-4">Filtros</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Torre</label>
                <div className="relative">
                  <select value={filtroTorre} onChange={e => setFiltroTorre(e.target.value)}
                    className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-sm appearance-none outline-none">
                    {torres.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Estatus</label>
                <div className="relative">
                  <select value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value as EstatusEntrega | 'TODOS')}
                    className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-sm appearance-none outline-none">
                    <option value="TODOS">Todos</option>
                    {Object.entries(ESTATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Fecha programada</label>
                <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none" />
              </div>
              <button onClick={() => { setFiltroEstatus('TODOS'); setFiltroTorre('Todas'); setFiltroFecha(''); setSearch(''); }}
                className="w-full py-2 text-xs text-slate-500 hover:text-red-500 transition-colors">
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        {/* ── Metrics row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Cumplimiento checklists</p>
            {isLoading ? <Shimmer className="h-20" /> : (() => {
              const conChecklist = rows.filter(r => r.checklistPct > 0).length;
              const completos = rows.filter(r => r.checklistPct === 100).length;
              const pct = conChecklist > 0 ? Math.round((completos / conChecklist) * 100) : 0;
              return (
                <div className="flex items-center gap-4">
                  <CircleGauge value={pct} color="#10B981" size={80} />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs text-slate-600">Completos: {completos}</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-xs text-slate-600">Incompletos: {conChecklist - completos}</span></div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Actas firmadas</p>
            {isLoading ? <Shimmer className="h-20" /> : (() => {
              const firmadas = rows.filter(r => r.actaEstatus === 'FIRMADA').length;
              const pct = total > 0 ? Math.round((firmadas / total) * 100) : 0;
              return (
                <div className="flex items-center gap-4">
                  <CircleGauge value={pct} color="#3B82F6" size={80} />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-xs text-slate-600">Firmadas: {firmadas}</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-xs text-slate-600">Pendientes: {total - firmadas}</span></div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">DAIKU completado</p>
            {isLoading ? <Shimmer className="h-20" /> : (() => {
              const completado = rows.filter(r => r.daikuEstatus === 'COMPLETADO').length;
              const aplica = rows.filter(r => r.daikuEstatus !== 'NO_APLICA').length;
              return (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{completado}</p>
                    <p className="text-xs text-slate-500">de {aplica} que aplican</p>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Valor total</p>
            {isLoading ? <Shimmer className="h-20" /> : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 tabular-nums">{fmtMxn(rows.reduce((s, r) => s + r.precioFinal, 0))}</p>
                  <p className="text-xs text-slate-500">{total} unidades</p>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Con observaciones</p>
            {isLoading ? <Shimmer className="h-20" /> : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.conObservaciones + stats.reprogramaciones}</p>
                  <p className="text-xs text-slate-500">requieren atención</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Main table ── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">
              Unidades — {proyectoNombreActivo}
              {!isLoading && <span className="ml-2 text-slate-400 font-normal text-xs">({filtered.length} de {total})</span>}
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar unidad, cliente, ID…"
                className="pl-8 pr-8 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando unidades…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Home className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No hay unidades</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    {['ID Cuenta', 'Unidad / Cliente', 'Precio Final', 'Estatus', 'Fecha programada', 'Checklist', 'DAIKU', 'Acta', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-500">{row.cuentaId}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-slate-900">{row.unidad}</p>
                        <p className="text-xs text-slate-400">{row.torre} · {row.cliente}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-700 text-sm">
                        {fmtMxn(row.precioFinal)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><EstatusBadge estatus={row.estatus} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtFechaProgramada(row.fechaProgramada)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><ChecklistBar pct={row.checklistPct} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${DAIKU_META[row.daikuEstatus].cls}`}>
                          {DAIKU_META[row.daikuEstatus].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.actaUrl ? (
                          <a
                            href={row.actaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${ACTA_META[row.actaEstatus].cls} hover:opacity-80`}
                          >
                            {ACTA_META[row.actaEstatus].label}
                          </a>
                        ) : (
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${ACTA_META[row.actaEstatus].cls}`}>
                            {ACTA_META[row.actaEstatus].label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/admin/portal-escrituracion/entregas/${row.id}`)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver detalle
                          </button>
                          <button onClick={() => setOpenRow(openRow === row.id ? null : row.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!isLoading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500">
                {filtered.length} {filtered.length === 1 ? 'unidad' : 'unidades'}
                {filtered.length !== total && ` (de ${total} total)`}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
