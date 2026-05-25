import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import {
  HeartHandshake, Bell, Package2, AlertCircle, Clock, TimerOff,
  ShieldOff, ShieldCheck, Star, CalendarDays, Users, AlertTriangle,
  Eye, Search, ChevronRight, CheckCircle2, Upload, X, Plus,
  FileText, Settings, BarChart2, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EstatusTicket =
  | 'NUEVO' | 'ASIGNADO' | 'EN_DIAGNOSTICO' | 'EN_REPARACION'
  | 'PENDIENTE_CLIENTE' | 'PENDIENTE_PROVEEDOR' | 'RESUELTO' | 'CERRADO' | 'REABIERTO';
type PrioridadTicket = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
type GarantiaEstatus = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | 'FUERA_GARANTIA';

interface TicketRow {
  id: string;          // folio PV-XXXX
  unidad: string;
  torre: string;
  proyecto: string;
  cliente: string;
  categoria: string;
  subcategoria: string;
  prioridad: PrioridadTicket;
  estatus: EstatusTicket;
  garantiaEstatus: GarantiaEstatus;
  fechaEntrega: string;
  fechaCreacion: string;
  slaLabel: string;
  slaVencido: boolean;
  responsable: string;
  proveedor: string;
  evidenciaInicial: number;
  evidenciaReparacion: number;
  cuentaId: number;      // NUEVO
  precioFinal: number;   // NUEVO
}

interface Proyecto {
  id: number;
  nombre: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ID_TIPO_ACTA_ENTREGA = 24; // tipos_documento.id = 24 → "Acta de entrega"

const ESTATUS_META: Record<EstatusTicket, { label: string; cls: string }> = {
  NUEVO:               { label: 'Nuevo',               cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ASIGNADO:            { label: 'Asignado',             cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  EN_DIAGNOSTICO:      { label: 'En diagnóstico',       cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  EN_REPARACION:       { label: 'En proceso',           cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  PENDIENTE_CLIENTE:   { label: 'Pendiente cliente',    cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  PENDIENTE_PROVEEDOR: { label: 'Pendiente proveedor',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  RESUELTO:            { label: 'Resuelto',             cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  CERRADO:             { label: 'Cerrado',              cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  REABIERTO:           { label: 'Reabierto',            cls: 'bg-red-50 text-red-700 border-red-200' },
};

const PRIORIDAD_META: Record<PrioridadTicket, { label: string; cls: string; color: string }> = {
  CRITICA: { label: 'Crítica', cls: 'bg-red-50 text-red-700 border-red-200',     color: '#EF4444' },
  ALTA:    { label: 'Alta',    cls: 'bg-orange-50 text-orange-700 border-orange-200', color: '#F97316' },
  MEDIA:   { label: 'Media',   cls: 'bg-amber-50 text-amber-700 border-amber-200',  color: '#F59E0B' },
  BAJA:    { label: 'Baja',    cls: 'bg-slate-100 text-slate-600 border-slate-200', color: '#94A3B8' },
};

const SUBCATEGORIAS: Record<string, string[]> = {
  'Eléctrica':           ['Contacto no funciona', 'Apagador no funciona', 'Luminaria no funciona', 'Corto eléctrico', 'Tablero eléctrico'],
  'Sanitaria':           ['WC no descarga', 'Coladera tapada', 'Mal olor', 'Fuga sanitaria', 'Drenaje lento'],
  'Hidráulica':          ['Fuga en lavabo', 'Fuga en tarja', 'Baja presión', 'Llave no funciona', 'Mezcladora defectuosa', 'Humedad'],
  'HVAC':                ['No enfría', 'No enciende', 'Ruido', 'Fuga de condensado', 'Control no funciona'],
  'Calentador/Boiler':   ['No enciende', 'No calienta', 'Fuga', 'Baja presión', 'Error eléctrico', 'Olor a gas', 'Falla intermitente'],
  'Acabados':            ['Pintura', 'Grieta', 'Yeso', 'Plafón', 'Piso', 'Sellador'],
  'Carpintería':         ['Puerta no cierra', 'Closet no cierra', 'Bisagra dañada', 'Cajón no corre', 'Cubierta dañada', 'Mueble desalineado'],
  'DAIKU':               ['Instalación incompleta', 'Defecto de fábrica', 'Daño en transporte'],
  'Electrodomésticos':   ['No enciende', 'No funciona correctamente', 'Daño visible'],
};

const DEMO_RESPONSABLES = ['Isabel Hernández', 'Miguel Torres', 'Luis García', 'Ana Pérez'];
const DEMO_PROVEEDORES  = ['Juan López (Plomería Express)', 'Miguel Torres (HVAC Solutions)', 'Carlos Méndez (Eléctrica Pro)', 'Acabados del Valle', 'Carpintería Integral', 'Sin proveedor'];
const CANALES           = ['Portal cliente', 'WhatsApp', 'Teléfono', 'Interno', 'Observación de entrega'];

const TIEMPO_RESOLUCION = [
  { cat: 'Eléctrica',       dias: 1.2, color: '#3B82F6' },
  { cat: 'Sanitaria',       dias: 1.6, color: '#10B981' },
  { cat: 'Hidráulica',      dias: 1.8, color: '#06B6D4' },
  { cat: 'HVAC',            dias: 2.1, color: '#8B5CF6' },
  { cat: 'Cal./Boiler',     dias: 1.4, color: '#F59E0B' },
  { cat: 'Acabados',        dias: 2.5, color: '#EC4899' },
  { cat: 'Carpintería',     dias: 2.2, color: '#F97316' },
];

const PROVEEDORES_TOP = [
  { nombre: 'Juan López',     empresa: 'Plomería Express',   tickets: 8 },
  { nombre: 'Miguel Torres',  empresa: 'HVAC Solutions',     tickets: 6 },
  { nombre: 'Carlos Méndez',  empresa: 'Eléctrica Pro',      tickets: 5 },
  { nombre: 'Acabados del Valle', empresa: '',               tickets: 4 },
  { nombre: 'Carpintería Integral', empresa: '',             tickets: 3 },
];

// ─── Wizard form state ────────────────────────────────────────────────────────

interface WizardForm {
  unidadId: string;
  categoria: string;
  subcategoria: string;
  descripcion: string;
  canal: string;
  files: File[];
  prioridad: PrioridadTicket | '';
  responsable: string;
  proveedor: string;
  fechaCompromiso: string;
  comentarios: string;
}

const EMPTY_FORM: WizardForm = {
  unidadId: '', categoria: '', subcategoria: '', descripcion: '', canal: '',
  files: [], prioridad: '', responsable: '', proveedor: '', fechaCompromiso: '', comentarios: '',
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function DonutCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center leading-tight">{children}</div>
    </div>
  );
}

function SectionCard({ title, children, action }: { title?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title && <span className="text-sm font-semibold text-slate-800">{title}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function LinkBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
    >
      {children} <ChevronRight className="w-3 h-3" />
    </button>
  );
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {children}
    </span>
  );
}

// Custom tooltip for recharts
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { pct: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-800">{d.name}</p>
      <p className="text-slate-600">{d.value} tickets · {d.payload.pct}%</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PostventaDashboard() {
  const navigate = useNavigate();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [proyectoId, setProyectoId]   = useState<number | null>(null);
  const [selectedTorre, setSelectedTorre] = useState('Todas');
  const [pvTablesExist, setPvTablesExist] = useState<boolean | null>(null);
  const [search, setSearch]                     = useState('');

  // ── Wizard ───────────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [form, setForm]             = useState<WizardForm>(EMPTY_FORM);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // ── Check if pv_tickets exists ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { error } = await (supabase as any).from('postventa_tickets').select('id').limit(1);
      setPvTablesExist(!error);
    })();
  }, []);

  // ── Supabase: proyectos (real — filtro SOZU) ──────────────────────────────
  const { data: proyectos = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['proyectos-pv'],
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

  // Auto-select first project
  useEffect(() => {
    if (proyectos.length > 0 && proyectoId === null) setProyectoId(proyectos[0].id);
  }, [proyectos, proyectoId]);

  // ── Query de unidades entregadas (para el wizard) ─────────────────────────
  const proyectoIds = proyectoId ? [proyectoId] : proyectos.map(p => p.id);

  const { data: unidadesEntregadas = [] } = useQuery({
    queryKey: ['pv-unidades', proyectoIds.join(',')],
    queryFn: async (): Promise<{ id: string; label: string; cliente: string; proyecto: string; fechaEntrega: string; cuentaId: number; precioFinal: number }[]> => {
      if (!proyectoIds.length) return [];
      const { data: edificios } = await supabase.from('edificios').select('id, nombre, id_proyecto').in('id_proyecto', proyectoIds).eq('activo', true);
      const edificioIds = (edificios ?? []).map((e: any) => e.id);
      if (!edificioIds.length) return [];
      const edificioMap: Record<number, { nombre: string; proyectoId: number }> = Object.fromEntries((edificios ?? []).map((e: any) => [e.id, { nombre: e.nombre, proyectoId: e.id_proyecto }]));
      const { data: modelos } = await supabase.from('edificios_modelos').select('id, id_edificio').in('id_edificio', edificioIds);
      const modeloIds = (modelos ?? []).map((m: any) => m.id);
      if (!modeloIds.length) return [];
      const modeloEdificioMap: Record<number, number> = Object.fromEntries((modelos ?? []).map((m: any) => [m.id, m.id_edificio]));
      const { data: propiedades } = await supabase.from('propiedades').select('id, numero_propiedad, id_edificio_modelo').in('id_edificio_modelo', modeloIds).eq('activo', true);
      if (!propiedades?.length) return [];
      const propIds = propiedades.map((p: any) => p.id);
      const { data: cuentas } = await supabase.from('cuentas_cobranza').select('id, id_propiedad, precio_final').in('id_propiedad', propIds).eq('activo', true);
      if (!cuentas?.length) return [];
      const cuentaIds = cuentas.map((c: any) => c.id);
      const cuentaByPropId: Record<number, any> = Object.fromEntries(cuentas.map((c: any) => [c.id_propiedad, c]));
      const { data: compradores } = await supabase.from('compradores').select('id_cuenta_cobranza, id_persona').in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const personaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))];
      let personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase.from('personas').select('id, nombre_legal').in('id', personaIds as number[]);
        personaMap = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p.nombre_legal ?? '—']));
      }
      const cuentaToPersona: Record<number, string> = {};
      (compradores ?? []).forEach((c: any) => { if (!cuentaToPersona[c.id_cuenta_cobranza]) cuentaToPersona[c.id_cuenta_cobranza] = personaMap[c.id_persona] ?? '—'; });
      const { data: actaDocs } = await supabase.from('documentos').select('id_propiedad, fecha_creacion').in('id_propiedad', propIds).eq('id_tipo_documento', ID_TIPO_ACTA_ENTREGA).eq('activo', true);
      const actaSet = new Set((actaDocs ?? []).map((d: any) => d.id_propiedad));
      const actaFechaMap: Record<number, string> = Object.fromEntries((actaDocs ?? []).map((d: any) => [d.id_propiedad, d.fecha_creacion]));
      const proyectoNombreMap: Record<number, string> = Object.fromEntries(proyectos.map(p => [p.id, p.nombre]));
      return propiedades
        .filter((p: any) => cuentaByPropId[p.id] && actaSet.has(p.id))
        .map((p: any) => {
          const cuenta = cuentaByPropId[p.id];
          const edificioId = modeloEdificioMap[p.id_edificio_modelo];
          const edificio = edificioMap[edificioId];
          const pId = edificio?.proyectoId ?? 0;
          const fechaRaw = actaFechaMap[p.id];
          return {
            id: `prop-${p.id}`,
            label: `${p.numero_propiedad ?? '—'} · ${edificio?.nombre ?? '—'}`,
            cliente: cuentaToPersona[cuenta.id] ?? '—',
            proyecto: `${proyectoNombreMap[pId] ?? '—'} · ${edificio?.nombre ?? '—'}`,
            fechaEntrega: fechaRaw ? new Date(fechaRaw).toLocaleDateString('es-MX') : '—',
            cuentaId: cuenta.id,
            precioFinal: Number(cuenta.precio_final ?? 0),
          };
        });
    },
    enabled: proyectoIds.length > 0,
  });

  // ── Query de tickets reales ────────────────────────────────────────────────
  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery<TicketRow[]>({
    queryKey: ['pv-tickets-rows', proyectoIds.join(','), pvTablesExist],
    queryFn: async (): Promise<TicketRow[]> => {
      if (!pvTablesExist || !proyectoIds.length) return [];
      const { data: edificios } = await supabase.from('edificios').select('id').in('id_proyecto', proyectoIds).eq('activo', true);
      const edificioIds = (edificios ?? []).map((e: any) => e.id);
      if (!edificioIds.length) return [];
      const { data: modelos } = await supabase.from('edificios_modelos').select('id').in('id_edificio', edificioIds);
      const modeloIds = (modelos ?? []).map((m: any) => m.id);
      if (!modeloIds.length) return [];
      const { data: propiedades } = await supabase.from('propiedades').select('id, numero_propiedad, id_edificio_modelo').in('id_edificio_modelo', modeloIds).eq('activo', true);
      if (!propiedades?.length) return [];
      const propIds = propiedades.map((p: any) => p.id);
      const propMap: Record<number, any> = Object.fromEntries(propiedades.map((p: any) => [p.id, p]));
      const { data: cuentas } = await supabase.from('cuentas_cobranza').select('id, id_propiedad, precio_final').in('id_propiedad', propIds).eq('activo', true);
      const cuentaByPropId: Record<number, any> = Object.fromEntries((cuentas ?? []).map((c: any) => [c.id_propiedad, c]));
      // Tickets — el join de proveedor va directo a personas (no existe pv_proveedores)
      const { data: rawTickets } = await (supabase as any)
        .from('postventa_tickets')
        .select('id, folio, id_propiedad, id_cuenta_cobranza, id_proveedor, subcategoria, prioridad, estatus, garantia_estatus, fecha_limite_sla, sla_cumplido, responsable, fecha_creacion, postventa_categorias_garantia(nombre)')
        .in('id_propiedad', propIds)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });
      if (!rawTickets?.length) return [];

      // Clientes (compradores de cada cuenta)
      const cuentaIds = [...new Set((rawTickets as any[]).map((t: any) => t.id_cuenta_cobranza).filter(Boolean))];
      const { data: compradores } = await supabase.from('compradores').select('id_cuenta_cobranza, id_persona').in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const clientePersonaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))];

      // Proveedores asignados (personas con id_tipo_entidad IN (8,13))
      const proveedorIds = [...new Set((rawTickets as any[]).map((t: any) => t.id_proveedor).filter(Boolean))];

      // Una sola query a personas para clientes + proveedores
      const allPersonaIds = [...new Set([...clientePersonaIds, ...proveedorIds])] as number[];
      let personaMap: Record<number, { nombre: string; comercial: string | null }> = {};
      if (allPersonaIds.length) {
        const { data: personas } = await supabase
          .from('personas')
          .select('id, nombre_legal, nombre_comercial')
          .in('id', allPersonaIds);
        personaMap = Object.fromEntries(
          (personas ?? []).map((p: any) => [p.id, { nombre: p.nombre_legal ?? '—', comercial: p.nombre_comercial }])
        );
      }
      const cuentaToPersona: Record<number, string> = {};
      (compradores ?? []).forEach((c: any) => {
        if (!cuentaToPersona[c.id_cuenta_cobranza])
          cuentaToPersona[c.id_cuenta_cobranza] = personaMap[c.id_persona]?.nombre ?? '—';
      });

      return (rawTickets as any[]).map((t: any): TicketRow => {
        const prop = propMap[t.id_propiedad];
        const cuenta = cuentaByPropId[t.id_propiedad] ?? null;
        const ahora = new Date();
        const limiteSla = t.fecha_limite_sla ? new Date(t.fecha_limite_sla) : null;
        const slaVencido = limiteSla ? limiteSla < ahora && t.sla_cumplido !== true : false;
        const slaLabel = limiteSla
          ? (slaVencido ? `⚠ Vencido` : `✓ ${limiteSla.toLocaleDateString('es-MX')}`)
          : '—';
        const pvPersona = t.id_proveedor ? personaMap[t.id_proveedor] : null;
        const proveedorLabel = pvPersona
          ? (pvPersona.comercial ?? pvPersona.nombre)
          : 'Sin proveedor';
        return {
          id: t.folio ?? `PV-${t.id}`,
          unidad: prop?.numero_propiedad ?? '—',
          torre: '—',
          proyecto: '—',
          cliente: cuentaToPersona[t.id_cuenta_cobranza] ?? '—',
          categoria: t.postventa_categorias_garantia?.nombre ?? '—',
          subcategoria: t.subcategoria ?? '—',
          prioridad: t.prioridad as PrioridadTicket,
          estatus: t.estatus as EstatusTicket,
          garantiaEstatus: t.garantia_estatus as GarantiaEstatus,
          fechaEntrega: '—',
          fechaCreacion: t.fecha_creacion ? new Date(t.fecha_creacion).toLocaleDateString('es-MX') : '—',
          slaLabel,
          slaVencido,
          responsable: t.responsable ?? 'Sin asignar',
          proveedor: proveedorLabel,
          evidenciaInicial: 0,
          evidenciaReparacion: 0,
          cuentaId: cuenta?.id ?? 0,
          precioFinal: Number(cuenta?.precio_final ?? 0),
        };
      });
    },
    enabled: pvTablesExist !== null && proyectoIds.length > 0,
  });

  // ── KPIs calculados desde tickets reales ──────────────────────────────────
  const kpis = useMemo(() => {
    const abiertos = tickets.filter(t => !['CERRADO','RESUELTO'].includes(t.estatus)).length;
    const criticos = tickets.filter(t => t.prioridad === 'CRITICA' && !['CERRADO','RESUELTO'].includes(t.estatus)).length;
    const enProceso = tickets.filter(t => ['EN_REPARACION','EN_DIAGNOSTICO','ASIGNADO'].includes(t.estatus)).length;
    const slaVencidos = tickets.filter(t => t.slaVencido).length;
    const fueraGarantia = tickets.filter(t => t.garantiaEstatus === 'FUERA_GARANTIA').length;
    const resueltos = tickets.filter(t => t.estatus === 'CERRADO' || t.estatus === 'RESUELTO').length;
    const cumplimientoSla = tickets.length > 0 ? Math.round(((tickets.length - slaVencidos) / tickets.length) * 100) : 100;
    // satisfaccion promedio se deja en 0 si no hay datos
    return { abiertos, criticos, enProceso, slaVencidos, fueraGarantia, resueltos, cumplimientoSla };
  }, [tickets]);

  // ── Datos de donuts calculados desde tickets reales ───────────────────────
  const catData = useMemo(() => {
    const CAT_COLORS: Record<string, string> = { 'Eléctrica':'#3B82F6','Sanitaria':'#10B981','Hidráulica':'#06B6D4','HVAC':'#8B5CF6','Calentador / Boiler':'#F59E0B','Acabados':'#EC4899','Carpintería':'#F97316','DAIKU':'#6366F1','Electrodomésticos':'#94A3B8' };
    const map: Record<string, number> = {};
    tickets.forEach(t => { map[t.categoria] = (map[t.categoria] ?? 0) + 1; });
    const total = tickets.length || 1;
    return Object.entries(map).map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100), color: CAT_COLORS[name] ?? '#94A3B8' }));
  }, [tickets]);

  const prioridadData = useMemo(() => {
    const total = tickets.length || 1;
    return (['CRITICA','ALTA','MEDIA','BAJA'] as PrioridadTicket[]).map(p => ({
      name: PRIORIDAD_META[p].label,
      value: tickets.filter(t => t.prioridad === p).length,
      pct: Math.round((tickets.filter(t => t.prioridad === p).length / total) * 100),
      color: PRIORIDAD_META[p].color,
    })).filter(d => d.value > 0);
  }, [tickets]);

  const estatusData = useMemo(() => {
    const ESTATUS_COLORS: Record<EstatusTicket, string> = { NUEVO:'#3B82F6',ASIGNADO:'#6366F1',EN_DIAGNOSTICO:'#A855F7',EN_REPARACION:'#F59E0B',PENDIENTE_CLIENTE:'#F97316',PENDIENTE_PROVEEDOR:'#EAB308',RESUELTO:'#10B981',CERRADO:'#94A3B8',REABIERTO:'#EF4444' };
    const total = tickets.length || 1;
    return (Object.keys(ESTATUS_META) as EstatusTicket[]).map(s => ({
      name: ESTATUS_META[s].label,
      value: tickets.filter(t => t.estatus === s).length,
      pct: Math.round((tickets.filter(t => t.estatus === s).length / total) * 100),
      color: ESTATUS_COLORS[s],
    })).filter(d => d.value > 0);
  }, [tickets]);

  const garantiaData = useMemo(() => {
    if (!tickets.length) return [{ name: 'Vigentes', value: 100, color: '#10B981' }];
    const total = tickets.length;
    return [
      { name: 'Vigentes',   value: Math.round((tickets.filter(t => t.garantiaEstatus === 'VIGENTE').length / total) * 100),   color: '#10B981' },
      { name: 'Por vencer', value: Math.round((tickets.filter(t => t.garantiaEstatus === 'POR_VENCER').length / total) * 100), color: '#F59E0B' },
      { name: 'Vencidas',   value: Math.round((tickets.filter(t => t.garantiaEstatus === 'VENCIDA').length / total) * 100),    color: '#EF4444' },
    ].filter(d => d.value > 0);
  }, [tickets]);

  // ── Filtered tickets ──────────────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch = !search || t.id.toLowerCase().includes(search.toLowerCase()) || t.cliente.toLowerCase().includes(search.toLowerCase()) || t.unidad.toLowerCase().includes(search.toLowerCase());
      const matchesTorre = selectedTorre === 'Todas' || t.torre === selectedTorre;
      return matchesSearch && matchesTorre;
    });
  }, [tickets, search, selectedTorre]);

  // ── Wizard helpers ────────────────────────────────────────────────────────
  const selectedUnidad = unidadesEntregadas.find((u) => u.id === form.unidadId);
  const subcats        = form.categoria ? (SUBCATEGORIAS[form.categoria] ?? []) : [];

  const step1Valid = Boolean(form.unidadId && form.categoria && form.subcategoria && form.descripcion && form.canal);
  const step2Valid = form.files.length > 0;
  const step3Valid = Boolean(form.prioridad && form.responsable && form.fechaCompromiso);

  function handleNextStep() {
    if (wizardStep === 0 && !step1Valid) { toast.error('Completa todos los campos requeridos'); return; }
    if (wizardStep === 1 && !step2Valid) { toast.error('Sube al menos una evidencia'); return; }
    setCompletedSteps((prev) => new Set([...prev, wizardStep]));
    setWizardStep((s) => Math.min(s + 1, 3));
  }

  function handleCreateTicket() {
    toast.success('Ticket creado exitosamente', { description: `Se generó el ticket para la unidad ${selectedUnidad?.label ?? ''}` });
    setWizardOpen(false);
    setWizardStep(0);
    setForm(EMPTY_FORM);
    setCompletedSteps(new Set());
    refetchTickets();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    setForm((f) => ({ ...f, files: [...f.files, ...chosen] }));
  }

  function removeFile(idx: number) {
    setForm((f) => ({ ...f, files: f.files.filter((_, i) => i !== idx) }));
  }

  function openWizard() {
    setWizardOpen(true);
    setWizardStep(0);
    setForm(EMPTY_FORM);
    setCompletedSteps(new Set());
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
            <HeartHandshake className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 leading-none">Postventa</p>
            <p className="text-xs text-slate-500 mt-0.5">Dashboard general</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Middle — selectors */}
        <div className="flex items-center gap-2">
          <select
            value={proyectoId ?? ''}
            onChange={(e) => setProyectoId(Number(e.target.value) || null)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <select
            value={selectedTorre}
            onChange={(e) => setSelectedTorre(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {['Todas', 'Torre A', 'Torre B', 'Torre C'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        {/* Right */}
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Bell className="w-5 h-5 text-slate-500" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">4</span>
          </button>
          <button
            onClick={openWizard}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo ticket
          </button>
        </div>
      </header>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <main className="p-6 flex flex-col gap-6">

        {/* ── Banner: pv_tickets no existe ─────────────────────────────────── */}
        {pvTablesExist === false && (
          <div className="mx-0 mt-0 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Tablas de Postventa no encontradas</p>
              <p className="text-xs text-amber-700 mt-0.5">Ejecuta el DDL en <span className="font-mono">Ejecuciones_manuales/modulo_postventa.md</span>. Los KPIs y gráficas se actualizarán automáticamente.</p>
            </div>
          </div>
        )}

        {/* ── KPI Row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* 1 Tickets abiertos */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Tickets abiertos</span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package2 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{kpis.abiertos}</p>
            <LinkBtn>Ver detalle</LinkBtn>
          </div>

          {/* 2 Críticos */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Críticos</span>
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-600">{kpis.criticos}</p>
            <LinkBtn>Ver detalle</LinkBtn>
          </div>

          {/* 3 En proceso */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">En proceso</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-600">{kpis.enProceso}</p>
            <LinkBtn>Ver detalle</LinkBtn>
          </div>

          {/* 4 SLA vencidos */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">SLA vencidos</span>
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <TimerOff className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-600">{kpis.slaVencidos}</p>
            <LinkBtn>Ver detalle</LinkBtn>
          </div>

          {/* 5 Fuera de garantía */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Fuera de garantía</span>
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <ShieldOff className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-600">{kpis.fueraGarantia}</p>
            <LinkBtn>Ver detalle</LinkBtn>
          </div>

          {/* 6 Cumplimiento SLA */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Cumplimiento SLA</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{kpis.cumplimientoSla}%</p>
            <LinkBtn>Ver detalle</LinkBtn>
          </div>

          {/* 7 Satisfacción */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Satisfacción prom.</span>
              <div className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-600">—</p>
            <LinkBtn>Ver detalle</LinkBtn>
          </div>
        </div>

        {/* ── Charts Row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Col 1 — Categoría */}
          <SectionCard title="Tickets por categoría">
            <div className="relative h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={catData.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {catData.filter((d) => d.value > 0).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              {catData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600 truncate">{d.name}</span>
                  </div>
                  <span className="text-slate-500 flex-shrink-0 ml-2">{d.value} · {d.pct}%</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Col 2 — Prioridad */}
          <SectionCard title="Tickets por prioridad">
            <div className="relative h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prioridadData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {prioridadData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <DonutCenter>
                <p className="text-xl font-bold text-slate-900">{tickets.length}</p>
                <p className="text-[10px] text-slate-500">Total</p>
              </DonutCenter>
            </div>
            <div className="flex flex-col gap-1">
              {prioridadData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="text-slate-500">{d.value} · {d.pct}%</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Col 3 — Estatus */}
          <SectionCard title="Tickets por estatus">
            <div className="relative h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={estatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {estatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <DonutCenter>
                <p className="text-xl font-bold text-slate-900">{tickets.length}</p>
                <p className="text-[10px] text-slate-500">Total</p>
              </DonutCenter>
            </div>
            <div className="flex flex-col gap-1">
              {estatusData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="text-slate-500">{d.value} · {d.pct}%</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Col 4 — Tiempo resolución */}
          <SectionCard
            title="Tiempo promedio de resolución (días)"
            action={<LinkBtn>Ver métricas completas</LinkBtn>}
          >
            <div className="flex flex-col gap-2.5">
              {TIEMPO_RESOLUCION.map((r) => (
                <div key={r.cat} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-24 flex-shrink-0">{r.cat}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(r.dias / 3) * 100}%`, background: r.color }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-6 text-right flex-shrink-0">{r.dias}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Info Widgets Row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">

          {/* 1 — Garantías por vencer */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-amber-500" />
                <span>Garantías por vencer</span>
              </div>
            }
            action={<LinkBtn>Ver todas</LinkBtn>}
          >
            <div>
              <p className="text-3xl font-bold text-amber-600">8</p>
              <p className="text-xs text-slate-500">Próximos 15 días</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-slate-600">4 categorías / 15 días o menos</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-slate-600">6 categorías / 30 días o menos</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-300 flex-shrink-0" />
                <span className="text-slate-600">12 categorías / 60 días o menos</span>
              </div>
            </div>
          </SectionCard>

          {/* 2 — Garantías vencidas */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <ShieldOff className="w-4 h-4 text-red-500" />
                <span>Garantías vencidas</span>
              </div>
            }
            action={<LinkBtn>Ver detalle</LinkBtn>}
          >
            <div>
              <p className="text-3xl font-bold text-red-600">3</p>
              <p className="text-xs text-slate-500">Categorías vencidas</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-bold flex items-center justify-center">2</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Críticos</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center">3</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Medios</span>
              </div>
            </div>
          </SectionCard>

          {/* 3 — SLA vencidos */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <TimerOff className="w-4 h-4 text-red-500" />
                <span>SLA vencidos</span>
              </div>
            }
            action={<LinkBtn>Ver todos</LinkBtn>}
          >
            <div>
              <p className="text-3xl font-bold text-red-600">{kpis.slaVencidos}</p>
              <p className="text-xs text-slate-500">Tickets fuera de SLA</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-bold flex items-center justify-center">2</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Críticos</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center">3</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Medios</span>
              </div>
            </div>
          </SectionCard>

          {/* 4 — Proveedores */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Proveedores con más tickets</span>
              </div>
            }
            action={<LinkBtn>Ver todos</LinkBtn>}
          >
            <div className="flex flex-col gap-1.5">
              {PROVEEDORES_TOP.map((p) => (
                <div key={p.nombre} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="text-slate-700 font-medium truncate">{p.nombre}</p>
                    {p.empresa && <p className="text-slate-400 truncate">{p.empresa}</p>}
                  </div>
                  <span className="ml-2 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {p.tickets}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 5 — Alertas críticas */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>Alertas críticas</span>
              </div>
            }
            action={<LinkBtn>Ver todas las alertas</LinkBtn>}
          >
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'SLA vencidos',                  count: kpis.slaVencidos, dot: 'bg-red-500' },
                { label: 'Tickets críticos sin asignar',  count: kpis.criticos, dot: 'bg-red-500' },
                { label: 'Garantías próx. a vencer',      count: 8, dot: 'bg-amber-400' },
                { label: 'Garantías vencidas',            count: 3, dot: 'bg-orange-500' },
                { label: 'Tickets reabiertos',            count: tickets.filter(t => t.estatus === 'REABIERTO').length, dot: 'bg-purple-500' },
              ].map((a) => (
                <div key={a.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.dot}`} />
                    <span className="text-slate-600 truncate">{a.label}</span>
                  </div>
                  <span className="ml-2 font-semibold text-slate-700 flex-shrink-0">{a.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Bottom Row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Left — Recent tickets table (xl:col-span-2) */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col">
            {/* Table header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">Tickets recientes</span>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 w-44"
                  />
                </div>
                <LinkBtn>Ver todos</LinkBtn>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              {ticketsLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Cargando tickets…</span>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Package2 className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">{pvTablesExist ? 'Sin tickets para este proyecto' : 'Ejecuta el DDL para habilitar tickets'}</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Ticket','ID Cuenta','Unidad / Cliente','Precio Final','Categoría','Prioridad','Estatus','Garantía','SLA','Responsable','Creado',''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((t) => {
                      const em = ESTATUS_META[t.estatus];
                      const pm = PRIORIDAD_META[t.prioridad];
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/admin/portal-escrituracion/postventa/${t.id}`)}
                        >
                          <td className="px-3 py-2.5 font-mono font-semibold text-blue-700 whitespace-nowrap">{t.id}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-slate-500">{t.cuentaId || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <p className="font-medium text-slate-800">{t.unidad}</p>
                            <p className="text-[11px] text-slate-400">{t.cliente}</p>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-slate-700 text-xs">
                            {t.precioFinal > 0 ? new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(t.precioFinal) : '—'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{t.categoria}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Badge cls={pm.cls}>{pm.label}</Badge>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Badge cls={em.cls}>{em.label}</Badge>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" /> Vigente
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={t.slaVencido ? 'text-red-600 font-medium' : 'text-emerald-600'}>
                              {t.slaLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{t.responsable}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">{t.fechaCreacion}</td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/portal-escrituracion/postventa/${t.id}`); }}
                              className="p-1 rounded hover:bg-slate-200 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">Mostrando {Math.min(filteredTickets.length, 50)} de {filteredTickets.length} registros</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, '...', 9].map((p, i) => (
                  <button
                    key={i}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      p === 1
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right — stacked panels */}
          <div className="flex flex-col gap-4">

            {/* Cobertura de garantías */}
            <SectionCard
              title="Cobertura de garantías"
              action={<LinkBtn>Ver reporte completo</LinkBtn>}
            >
              <div className="relative h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={garantiaData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={64}
                      paddingAngle={2}
                    >
                      {garantiaData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <DonutCenter>
                  <p className="text-lg font-bold text-emerald-600">
                    {garantiaData.find(d => d.name === 'Vigentes')?.value ?? 100}%
                  </p>
                  <p className="text-[10px] text-slate-500">Vigentes</p>
                </DonutCenter>
              </div>
              <div className="flex flex-col gap-1">
                {garantiaData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-slate-600">{d.name}</span>
                    </div>
                    <span className="text-slate-500">{d.value}%</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Acciones rápidas */}
            <SectionCard title="Acciones rápidas">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={openWizard}
                  className="flex items-center gap-2 justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium px-3 py-2.5 rounded-lg border border-emerald-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuevo ticket
                </button>
                <button className="flex items-center gap-2 justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2.5 rounded-lg border border-slate-200 transition-colors">
                  <Search className="w-3.5 h-3.5" />
                  Buscar unidad
                </button>
                <button className="flex items-center gap-2 justify-center bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium px-3 py-2.5 rounded-lg border border-red-200 transition-colors">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Tickets críticos
                </button>
                <button className="flex items-center gap-2 justify-center bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium px-3 py-2.5 rounded-lg border border-purple-200 transition-colors">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Garantías
                </button>
                <button className="flex items-center gap-2 justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium px-3 py-2.5 rounded-lg border border-blue-200 transition-colors">
                  <BarChart2 className="w-3.5 h-3.5" />
                  Reportes
                </button>
                <button className="flex items-center gap-2 justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2.5 rounded-lg border border-slate-200 transition-colors">
                  <Settings className="w-3.5 h-3.5" />
                  Configurar SLA
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </main>

      {/* ── Nuevo Ticket Wizard ───────────────────────────────────────────── */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setWizardOpen(false)}
          />

          {/* Drawer */}
          <div className="w-full max-w-xl bg-white flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <HeartHandshake className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Nuevo ticket de Postventa</p>
                  <p className="text-xs text-slate-500">Complete todos los pasos</p>
                </div>
              </div>
              <button onClick={() => setWizardOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Step tabs */}
            <div className="flex border-b border-slate-200 bg-white">
              {['Información', 'Evidencia', 'Asignación', 'Confirmar'].map((label, idx) => {
                const isDone    = completedSteps.has(idx);
                const isCurrent = wizardStep === idx;
                const isClickable = idx === 0 || completedSteps.has(idx - 1) || completedSteps.has(idx);
                return (
                  <button
                    key={label}
                    disabled={!isClickable}
                    onClick={() => isClickable && setWizardStep(idx)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 ${
                      isCurrent
                        ? 'border-emerald-500 text-emerald-700'
                        : isDone
                        ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                        : 'border-transparent text-slate-400'
                    } disabled:cursor-not-allowed`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCurrent ? 'bg-emerald-600 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Step body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* Step 1 — Información */}
              {wizardStep === 0 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Unidad *</label>
                    <select
                      value={form.unidadId}
                      onChange={(e) => setForm((f) => ({ ...f, unidadId: e.target.value, subcategoria: '' }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Seleccionar unidad…</option>
                      {unidadesEntregadas.map((u) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </select>
                  </div>

                  {selectedUnidad && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex flex-col gap-1">
                      <p className="text-xs font-semibold text-blue-800">Información de la unidad</p>
                      <p className="text-xs text-blue-700"><span className="font-medium">Cliente:</span> {selectedUnidad.cliente}</p>
                      <p className="text-xs text-blue-700"><span className="font-medium">Proyecto · Torre:</span> {selectedUnidad.proyecto}</p>
                      <p className="text-xs text-blue-700"><span className="font-medium">Fecha entrega:</span> {selectedUnidad.fechaEntrega}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Categoría *</label>
                    <select
                      value={form.categoria}
                      onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value, subcategoria: '' }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Seleccionar categoría…</option>
                      {Object.keys(SUBCATEGORIAS).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subcategoría *</label>
                    <select
                      value={form.subcategoria}
                      onChange={(e) => setForm((f) => ({ ...f, subcategoria: e.target.value }))}
                      disabled={!form.categoria}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">Seleccionar subcategoría…</option>
                      {subcats.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Descripción *</label>
                    <textarea
                      rows={3}
                      placeholder="Describe el problema con detalle…"
                      value={form.descripcion}
                      onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Canal de recepción *</label>
                    <select
                      value={form.canal}
                      onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Seleccionar canal…</option>
                      {CANALES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Step 2 — Evidencia */}
              {wizardStep === 1 && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-slate-500">Sube al menos una imagen o video como evidencia inicial del problema.</p>

                  <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-xl p-8 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700">Haz clic para subir archivos</p>
                      <p className="text-xs text-slate-400 mt-1">Imágenes y videos (JPG, PNG, MP4…)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>

                  {form.files.length === 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700">Debes subir al menos una evidencia para continuar.</p>
                    </div>
                  )}

                  {form.files.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {form.files.map((file, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-square flex items-center justify-center">
                          {file.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <FileText className="w-6 h-6 text-slate-400" />
                              <span className="text-[10px] text-slate-500 truncate px-1 w-full text-center">{file.name}</span>
                            </div>
                          )}
                          <button
                            onClick={() => removeFile(idx)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 — Asignación */}
              {wizardStep === 2 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Prioridad *</label>
                    <div className="flex gap-2">
                      {(['CRITICA', 'MEDIA', 'BAJA'] as PrioridadTicket[]).map((p) => {
                        const pm = PRIORIDAD_META[p];
                        const sel = form.prioridad === p;
                        return (
                          <button
                            key={p}
                            onClick={() => setForm((f) => ({ ...f, prioridad: p }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                              sel ? `${pm.cls} ring-2 ring-offset-1` : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {pm.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Responsable *</label>
                    <select
                      value={form.responsable}
                      onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Seleccionar responsable…</option>
                      {DEMO_RESPONSABLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Proveedor</label>
                    <select
                      value={form.proveedor}
                      onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Sin proveedor asignado</option>
                      {DEMO_PROVEEDORES.map((pv) => (
                        <option key={pv} value={pv}>{pv}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fecha compromiso *</label>
                    <input
                      type="date"
                      value={form.fechaCompromiso}
                      onChange={(e) => setForm((f) => ({ ...f, fechaCompromiso: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Comentarios internos</label>
                    <textarea
                      rows={3}
                      placeholder="Notas internas para el equipo…"
                      value={form.comentarios}
                      onChange={(e) => setForm((f) => ({ ...f, comentarios: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 4 — Confirmar */}
              {wizardStep === 3 && (
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Resumen del ticket</p>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <p className="text-slate-400">Unidad</p>
                        <p className="text-slate-800 font-medium">{selectedUnidad?.label ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Cliente</p>
                        <p className="text-slate-800 font-medium">{selectedUnidad?.cliente ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Categoría</p>
                        <p className="text-slate-800 font-medium">{form.categoria || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Subcategoría</p>
                        <p className="text-slate-800 font-medium">{form.subcategoria || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-400">Descripción</p>
                        <p className="text-slate-800">{form.descripcion || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Canal</p>
                        <p className="text-slate-800 font-medium">{form.canal || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Evidencias</p>
                        <p className="text-slate-800 font-medium">{form.files.length} archivo(s)</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Prioridad</p>
                        {form.prioridad ? (
                          <Badge cls={PRIORIDAD_META[form.prioridad].cls}>{PRIORIDAD_META[form.prioridad].label}</Badge>
                        ) : <p className="text-slate-800">—</p>}
                      </div>
                      <div>
                        <p className="text-slate-400">Responsable</p>
                        <p className="text-slate-800 font-medium">{form.responsable || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Proveedor</p>
                        <p className="text-slate-800 font-medium">{form.proveedor || 'Sin asignar'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Fecha compromiso</p>
                        <p className="text-slate-800 font-medium">{form.fechaCompromiso || '—'}</p>
                      </div>
                    </div>

                    {/* Garantía vigente indicator */}
                    <div className="flex items-center gap-2 mt-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs text-emerald-700 font-medium">Garantía vigente — unidad dentro del periodo de cobertura</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  if (wizardStep === 0) { setWizardOpen(false); }
                  else { setWizardStep((s) => s - 1); }
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                {wizardStep === 0 ? 'Cancelar' : 'Anterior'}
              </button>

              {wizardStep < 3 ? (
                <button
                  onClick={handleNextStep}
                  disabled={
                    (wizardStep === 0 && !step1Valid) ||
                    (wizardStep === 1 && !step2Valid) ||
                    (wizardStep === 2 && !step3Valid)
                  }
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  onClick={handleCreateTicket}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Crear ticket
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
