import { useState, useMemo, useEffect } from 'react';
import PostventaConfiguracion from './PostventaConfiguracion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import {
  HeartHandshake, Bell, Package2, AlertCircle, Clock, TimerOff,
  ShieldOff, ShieldCheck, Star, CalendarDays, Users, AlertTriangle,
  Eye, Search, ChevronRight, CheckCircle2, X, Plus,
  Settings, BarChart2, Loader2,
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


const CANALES = ['Portal cliente', 'WhatsApp', 'Teléfono', 'Interno', 'Observación de entrega'];

// ─── Wizard form state ────────────────────────────────────────────────────────

interface WizardForm {
  unidadId: string;
  categoria: string;
  categoriaId: number | null;
  subcategoria: string;
  descripcion: string;
  canal: string;
  prioridad: PrioridadTicket | '';
  responsable: string;
  personalId: number | null;
  proveedor: string;
  fechaCompromiso: string;
  comentarios: string;
}

const EMPTY_FORM: WizardForm = {
  unidadId: '', categoria: '', categoriaId: null, subcategoria: '', descripcion: '', canal: '',
  prioridad: '', responsable: '', personalId: null, proveedor: '', fechaCompromiso: '', comentarios: '',
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
    <div style={{
      background: 'var(--sz-surface)',
      border: '1px solid var(--sz-border)',
      borderRadius: 'var(--sz-radius-xl)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      boxShadow: 'var(--sz-shadow-sm)',
    }}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title && <span style={{ fontSize: 'var(--sz-text-base)', fontWeight: 600, color: 'var(--sz-text-primary)' }}>{title}</span>}
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
      className="flex items-center gap-0.5"
      style={{ fontSize: 'var(--sz-text-xs)', fontWeight: 500, color: 'var(--sz-primary)', transition: 'var(--sz-transition)' }}
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
    <div style={{ background: 'var(--sz-surface)', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius-md)', padding: '8px 12px', fontSize: 13, boxShadow: 'var(--sz-shadow-md)' }}>
      <p style={{ fontWeight: 600, color: 'var(--sz-text-primary)' }}>{d.name}</p>
      <p style={{ color: 'var(--sz-text-secondary)', marginTop: 2 }}>{d.value} tickets · {d.payload.pct}%</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PostventaDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [proyectoId, setProyectoId]   = useState<number | null>(null);
  const [selectedTorre, setSelectedTorre] = useState('Todas');
  const [pvTablesExist, setPvTablesExist] = useState<boolean | null>(null);
  const [search, setSearch]                     = useState('');

  // ── Wizard ───────────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen]         = useState(false);
  const [configOpen, setConfigOpen]         = useState(false);
  const [wizardStep, setWizardStep]         = useState(0);
  const [form, setForm]                     = useState<WizardForm>(EMPTY_FORM);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  // Búsqueda de unidad y proyecto (estado local, no en form)
  const [wizardProyectoId, setWizardProyectoId] = useState<number | null>(null);
  const [unidadSearch, setUnidadSearch]         = useState('');
  const [unidadDropOpen, setUnidadDropOpen]     = useState(false);
  // Combobox personal de mantenimiento
  const [personalSearch, setPersonalSearch]     = useState('');
  const [personalDropOpen, setPersonalDropOpen] = useState(false);
  // Intentó avanzar (para mostrar errores inline)
  const [step1Tried, setStep1Tried]             = useState(false);

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
  // Usa los mismos criterios que EntregasDashboard:
  //   id_estatus_disponibilidad IN (5,7,8,9) = Vendido/Escrituración/Entregado/Pagado
  // NO requiere acta en tabla documentos (el acta puede estar en entregas.acta_estatus)
  // IMPORTANTE: usa wizardProyectoId (selección del wizard), NO proyectoId (filtro del dashboard)
  const proyectoIds = proyectoId ? [proyectoId] : proyectos.map(p => p.id);
  const ESTATUS_ENTREGADA = [5, 7, 8, 9]; // mismo que EntregasDashboard

  const { data: unidadesEntregadas = [] } = useQuery({
    queryKey: ['pv-unidades-wizard', wizardProyectoId],
    queryFn: async (): Promise<{ id: string; label: string; cliente: string; proyecto: string; fechaEntrega: string; cuentaId: number; precioFinal: number; proyectoId: number }[]> => {
      if (!wizardProyectoId) return [];

      // 1. Edificios del proyecto seleccionado en el wizard
      const { data: edificios } = await supabase
        .from('edificios').select('id, nombre, id_proyecto')
        .eq('id_proyecto', wizardProyectoId).eq('activo', true);
      const edificioIds = (edificios ?? []).map((e: any) => e.id);
      if (!edificioIds.length) return [];
      const edificioMap: Record<number, { nombre: string; proyectoId: number }> =
        Object.fromEntries((edificios ?? []).map((e: any) => [e.id, { nombre: e.nombre, proyectoId: e.id_proyecto }]));

      // 2. Modelos de esos edificios
      const { data: modelos } = await supabase
        .from('edificios_modelos').select('id, id_edificio')
        .in('id_edificio', edificioIds);
      const modeloIds = (modelos ?? []).map((m: any) => m.id);
      if (!modeloIds.length) return [];
      const modeloEdificioMap: Record<number, number> =
        Object.fromEntries((modelos ?? []).map((m: any) => [m.id, m.id_edificio]));

      // 3. Propiedades con estatus de entrega (igual que EntregasDashboard)
      //    id_estatus_disponibilidad IN (5,7,8,9) — NO requiere acta en documentos
      const { data: propiedades } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, id_edificio_modelo, id_estatus_disponibilidad')
        .in('id_edificio_modelo', modeloIds)
        .in('id_estatus_disponibilidad', ESTATUS_ENTREGADA)
        .eq('activo', true)
        .order('numero_propiedad');
      if (!propiedades?.length) return [];
      const propIds = propiedades.map((p: any) => p.id);

      // 4. Cuentas de cobranza
      const { data: cuentas } = await supabase
        .from('cuentas_cobranza').select('id, id_propiedad, precio_final')
        .in('id_propiedad', propIds).eq('activo', true);
      const cuentaByPropId: Record<number, any> =
        Object.fromEntries((cuentas ?? []).map((c: any) => [c.id_propiedad, c]));
      const cuentaIds = (cuentas ?? []).map((c: any) => c.id);

      // 5. Compradores → nombre del cliente
      const { data: compradores } = await supabase
        .from('compradores').select('id_cuenta_cobranza, id_persona')
        .in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const personaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))];
      let personaMap: Record<number, string> = {};
      if (personaIds.length) {
        const { data: personas } = await supabase
          .from('personas').select('id, nombre_legal').in('id', personaIds as number[]);
        personaMap = Object.fromEntries((personas ?? []).map((p: any) => [p.id, p.nombre_legal ?? '—']));
      }
      const cuentaToPersona: Record<number, string> = {};
      (compradores ?? []).forEach((c: any) => {
        if (!cuentaToPersona[c.id_cuenta_cobranza]) cuentaToPersona[c.id_cuenta_cobranza] = personaMap[c.id_persona] ?? '—';
      });

      // 6. Fecha de entrega (opcional — desde acta en documentos o entregas)
      const actaFechaMap: Record<number, string> = {};
      const { data: actaDocs } = await supabase
        .from('documentos').select('id_propiedad, fecha_creacion')
        .in('id_propiedad', propIds)
        .eq('id_tipo_documento', ID_TIPO_ACTA_ENTREGA)
        .eq('activo', true).eq('es_draft', false);
      (actaDocs ?? []).forEach((d: any) => { actaFechaMap[d.id_propiedad] = d.fecha_creacion; });

      // También intentar fecha desde tabla entregas (si existe)
      const entregasProbe = await (supabase as any)
        .from('entregas').select('id_propiedad, fecha_entrega')
        .in('id_propiedad', propIds).eq('activo', true);
      if (!entregasProbe.error) {
        (entregasProbe.data ?? []).forEach((e: any) => {
          if (e.fecha_entrega && !actaFechaMap[e.id_propiedad]) actaFechaMap[e.id_propiedad] = e.fecha_entrega;
        });
      }

      const proyectoNombreMap: Record<number, string> = Object.fromEntries(proyectos.map(p => [p.id, p.nombre]));

      // Solo incluir propiedades que tengan cuenta (vendidas) — sin requerir acta
      return propiedades
        .filter((p: any) => cuentaByPropId[p.id])
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
            proyectoId: pId,
          };
        });
    },
    enabled: wizardOpen && wizardProyectoId !== null,
  });

  // ── Query de categorías de garantía (para wizard) ─────────────────────────
  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['pv-categorias'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('postventa_categorias_garantia')
        .select('id, nombre, sla_critico_horas, sla_media_horas, sla_baja_dias')
        .eq('activo', true)
        .order('nombre');
      return (data ?? []) as { id: number; nombre: string; sla_critico_horas: number; sla_media_horas: number; sla_baja_dias: number }[];
    },
    enabled: pvTablesExist === true,
  });

  // ── Query de subcategorías de la categoría seleccionada (para wizard) ─────
  const { data: subcats = [], isLoading: subcatsLoading } = useQuery({
    queryKey: ['pv-subcats', form.categoriaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('postventa_subcategorias')
        .select('id, nombre')
        .eq('id_categoria', form.categoriaId!)
        .eq('activo', true)
        .order('nombre');
      return (data ?? []) as { id: number; nombre: string }[];
    },
    enabled: !!form.categoriaId && wizardOpen,
  });

  // ── tipos_entidad (para detectar id de "Personal de mantenimiento") ─────────
  const { data: tiposEntidadWiz = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['tipos-entidad-wiz'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('tipos_entidad').select('id, nombre').order('id');
      return (data ?? []) as { id: number; nombre: string }[];
    },
  });
  const idMantenimientoWiz = tiposEntidadWiz.find(t => t.nombre.toLowerCase().includes('mantenimiento'))?.id ?? null;

  // ── Personal de mantenimiento asignado a la categoría elegida en el wizard ──
  const { data: catPersonalWiz = [] } = useQuery<{ id_persona: number; id_tipo_entidad: number; personas: { id: number; nombre: string | null; apellido_paterno: string | null; apellido_materno: string | null; email: string | null } }[]>({
    queryKey: ['pv-cat-personal-wiz', form.categoriaId],
    queryFn: async () => {
      if (!form.categoriaId) return [];
      const probe = await (supabase as any).from('postventa_categorias_personal').select('id').limit(0);
      if (probe.error) return [];
      const { data } = await (supabase as any)
        .from('postventa_categorias_personal')
        .select('id_persona, id_tipo_entidad, personas(id, nombre, apellido_paterno, apellido_materno, email)')
        .eq('id_postventa_categoria_garantia', form.categoriaId)
        .eq('activo', true);
      return (data ?? []) as any[];
    },
    enabled: !!form.categoriaId && wizardOpen,
  });

  // Solo mantenimiento (excluye proveedores tipo 8)
  const mantWiz = catPersonalWiz.filter(p => p.id_tipo_entidad !== 8);

  // ── Query de tickets reales ────────────────────────────────────────────────
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<TicketRow[]>({
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
        .select('id, id_propiedad, id_cuenta_cobranza, id_postventa_categoria_garantia, subcategoria, prioridad, estatus, fecha_limite_sla, sla_cumplido, fecha_creacion, postventa_categorias_garantia(id, nombre)')
        .in('id_propiedad', propIds)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });
      if (!rawTickets?.length) return [];

      // Clientes (compradores de cada cuenta)
      const cuentaIds = [...new Set((rawTickets as any[]).map((t: any) => t.id_cuenta_cobranza).filter(Boolean))];
      const { data: compradores } = await supabase.from('compradores').select('id_cuenta_cobranza, id_persona').in('id_cuenta_cobranza', cuentaIds).eq('activo', true);
      const clientePersonaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))] as number[];

      let personaMap: Record<number, string> = {};
      if (clientePersonaIds.length) {
        const { data: personas } = await supabase
          .from('personas')
          .select('id, nombre_legal')
          .in('id', clientePersonaIds);
        personaMap = Object.fromEntries(
          (personas ?? []).map((p: any) => [p.id, p.nombre_legal ?? '—'])
        );
      }
      const cuentaToPersona: Record<number, string> = {};
      (compradores ?? []).forEach((c: any) => {
        if (!cuentaToPersona[c.id_cuenta_cobranza])
          cuentaToPersona[c.id_cuenta_cobranza] = personaMap[c.id_persona] ?? '—';
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
        return {
          id: `PV-${t.id}`,
          unidad: prop?.numero_propiedad ?? '—',
          torre: '—',
          proyecto: '—',
          cliente: cuentaToPersona[t.id_cuenta_cobranza] ?? '—',
          categoria: t.postventa_categorias_garantia?.nombre ?? '—',
          subcategoria: t.subcategoria ?? '—',
          prioridad: t.prioridad as PrioridadTicket,
          estatus: t.estatus as EstatusTicket,
          garantiaEstatus: 'VIGENTE' as GarantiaEstatus,
          fechaEntrega: '—',
          fechaCreacion: t.fecha_creacion ? new Date(t.fecha_creacion).toLocaleDateString('es-MX') : '—',
          slaLabel,
          slaVencido,
          responsable: 'Sin asignar',
          proveedor: 'Sin proveedor',
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

  // Filtrado de unidades por búsqueda de texto
  // (La query ya está scoped al wizardProyectoId — no necesitamos re-filtrar por proyecto)
  const unidadesFiltradas = useMemo(() => {
    const q = unidadSearch.toLowerCase().trim();
    if (!q) return unidadesEntregadas.slice(0, 15);
    return unidadesEntregadas
      .filter(u => u.label.toLowerCase().includes(q) || u.cliente.toLowerCase().includes(q))
      .slice(0, 15);
  }, [unidadSearch, unidadesEntregadas]);

  // Filtrado de personal para el combobox
  const personalFiltrado = useMemo(() => {
    const q = personalSearch.toLowerCase().trim();
    return mantWiz.filter(rel => {
      const p = rel.personas;
      const nombre = [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ');
      return !q || nombre.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q);
    });
  }, [personalSearch, mantWiz]);


  function handleNextStep() {
    if (wizardStep === 0) {
      setStep1Tried(true);

      // Resolver unidad: auto-seleccionar si hay exactamente 1 resultado
      let resolvedUnidadId = form.unidadId;
      if (!resolvedUnidadId && unidadesFiltradas.length === 1) {
        const u = unidadesFiltradas[0];
        resolvedUnidadId = u.id;
        setForm(f => ({ ...f, unidadId: u.id }));
        setUnidadSearch(u.label);
        setUnidadDropOpen(false);
      }

      if (!resolvedUnidadId) { toast.error('Busca y selecciona una unidad de la lista'); return; }
      if (!form.categoria)    { toast.error('Selecciona una categoría'); return; }
      if (!form.subcategoria) { toast.error('Selecciona una subcategoría'); return; }
      if (!form.descripcion.trim()) { toast.error('Escribe la descripción del problema'); return; }
      if (!form.canal)        { toast.error('Selecciona el canal de recepción'); return; }
    }
    setCompletedSteps((prev) => new Set([...prev, wizardStep]));
    setStep1Tried(false);
    setWizardStep((s) => Math.min(s + 1, 3));
  }

  async function handleCreateTicket() {
    const propIdRaw = parseInt(form.unidadId.replace('prop-', ''));
    const cat = categoriasDB.find(c => c.nombre === form.categoria);
    const canalMap: Record<string, string> = {
      'Portal cliente': 'PORTAL_CLIENTE',
      'WhatsApp': 'WHATSAPP',
      'Teléfono': 'TELEFONO',
      'Interno': 'INTERNO',
      'Observación de entrega': 'OBSERVACION_ENTREGA',
    };
    let slaHoras = cat?.sla_media_horas ?? 24;
    if (form.prioridad === 'CRITICA') slaHoras = cat?.sla_critico_horas ?? 4;
    else if (form.prioridad === 'BAJA') slaHoras = (cat?.sla_baja_dias ?? 5) * 24;
    const fechaLimiteSla = new Date(Date.now() + slaHoras * 3600000).toISOString();

    const ticketProyectoId = selectedUnidad?.proyectoId ?? null;

    const { data: ticket, error } = await (supabase as any)
      .from('postventa_tickets')
      .insert({
        id_propiedad: propIdRaw,
        id_proyecto: ticketProyectoId,
        id_cuenta_cobranza: selectedUnidad?.cuentaId,
        id_postventa_categoria_garantia: cat?.id ?? null,
        subcategoria: form.subcategoria,
        descripcion: form.descripcion,
        canal_recepcion: canalMap[form.canal] ?? 'INTERNO',
        prioridad: form.prioridad,
        estatus: 'NUEVO',
        sla_horas: slaHoras,
        fecha_limite_sla: fechaLimiteSla,
        activo: true,
      })
      .select('id')
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    await (supabase as any).from('postventa_log_actividades').insert({
      id_postventa_ticket: ticket.id,
      tipo_evento: 'CREACION',
      descripcion: `Ticket creado. Canal: ${form.canal}`,
      creado_por: profile?.email ?? 'admin',
    });

    toast.success(`Ticket PV-${ticket.id} creado`, { description: `Unidad: ${selectedUnidad?.label ?? ''}` });
    setWizardOpen(false);
    setWizardStep(0);
    setForm(EMPTY_FORM);
    setCompletedSteps(new Set());
    setWizardProyectoId(null);
    setUnidadSearch('');
    setUnidadDropOpen(false);
    setPersonalSearch('');
    setPersonalDropOpen(false);
    // Sincronizar filtro del dashboard al proyecto del ticket recién creado (BUG #1 fix)
    if (ticketProyectoId) setProyectoId(ticketProyectoId);
    qc.invalidateQueries({ queryKey: ['pv-tickets-rows'] });
  }

  function openWizard() {
    setWizardOpen(true);
    setWizardStep(0);
    setForm(EMPTY_FORM);
    setCompletedSteps(new Set());
    setWizardProyectoId(null);
    setUnidadSearch('');
    setUnidadDropOpen(false);
    setPersonalSearch('');
    setPersonalDropOpen(false);
    setStep1Tried(false);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--sz-bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'var(--sz-surface)',
        borderBottom: '1px solid var(--sz-border)',
        boxShadow: 'var(--sz-shadow-sm)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        height: 'var(--sz-topbar-h)',
      }}>
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 'var(--sz-radius-md)', background: 'var(--sz-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeartHandshake size={18} strokeWidth={1.75} style={{ color: 'var(--sz-primary)' }} />
          </div>
          <div>
            <p style={{ fontSize: 'var(--sz-text-md)', fontWeight: 700, color: 'var(--sz-text-primary)', lineHeight: 1 }}>Postventa</p>
            <p style={{ fontSize: 'var(--sz-text-xs)', color: 'var(--sz-text-muted)', marginTop: 2 }}>Dashboard general</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Middle — selectors */}
        <div className="flex items-center gap-2">
          <select
            value={proyectoId ?? ''}
            onChange={(e) => setProyectoId(Number(e.target.value) || null)}
            style={{ height: 'var(--sz-input-h)', padding: '0 12px', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius-md)', fontSize: 'var(--sz-text-base)', color: 'var(--sz-text-primary)', background: 'var(--sz-surface)', outline: 'none', cursor: 'pointer', transition: 'var(--sz-transition)' }}
          >
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <select
            value={selectedTorre}
            onChange={(e) => setSelectedTorre(e.target.value)}
            style={{ height: 'var(--sz-input-h)', padding: '0 12px', border: '1px solid var(--sz-border)', borderRadius: 'var(--sz-radius-md)', fontSize: 'var(--sz-text-base)', color: 'var(--sz-text-primary)', background: 'var(--sz-surface)', outline: 'none', cursor: 'pointer', transition: 'var(--sz-transition)' }}
          >
            {['Todas', 'Torre A', 'Torre B', 'Torre C'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        {/* Right */}
        <div className="flex items-center gap-3">
          <button style={{ position: 'relative', padding: '8px', borderRadius: 'var(--sz-radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'var(--sz-transition)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--sz-border-light)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Bell size={18} strokeWidth={1.75} style={{ color: 'var(--sz-text-secondary)' }} />
            {(kpis.slaVencidos + kpis.criticos) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {kpis.slaVencidos + kpis.criticos}
              </span>
            )}
          </button>
          <button
            onClick={openWizard}
            className="sz-btn-primary"
          >
            <Plus size={16} strokeWidth={2} />
            Nuevo ticket
          </button>
        </div>
      </header>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <main className="flex flex-col gap-6" style={{ padding: '32px 40px', background: 'var(--sz-bg)', minHeight: 'calc(100vh - var(--sz-topbar-h))' }}>

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
          <div className="sz-kpi-card">
            <div className="sz-kpi-card__icon" style={{ background: '#DBEAFE' }}>
              <Package2 size={18} strokeWidth={1.75} style={{ color: '#3B82F6' }} />
            </div>
            <div className="mt-auto">
              <div className="sz-kpi-card__value">{kpis.abiertos}</div>
              <div className="sz-kpi-card__label">Tickets abiertos</div>
            </div>
          </div>

          {/* 2 Críticos */}
          <div className="sz-kpi-card">
            <div className="sz-kpi-card__icon" style={{ background: '#FEE2E2' }}>
              <AlertCircle size={18} strokeWidth={1.75} style={{ color: '#EF4444' }} />
            </div>
            <div className="mt-auto">
              <div className="sz-kpi-card__value" style={{ color: '#EF4444' }}>{kpis.criticos}</div>
              <div className="sz-kpi-card__label">Críticos</div>
            </div>
          </div>

          {/* 3 En proceso */}
          <div className="sz-kpi-card">
            <div className="sz-kpi-card__icon" style={{ background: '#FEF3C7' }}>
              <Clock size={18} strokeWidth={1.75} style={{ color: '#F59E0B' }} />
            </div>
            <div className="mt-auto">
              <div className="sz-kpi-card__value" style={{ color: '#F59E0B' }}>{kpis.enProceso}</div>
              <div className="sz-kpi-card__label">En proceso</div>
            </div>
          </div>

          {/* 4 SLA vencidos */}
          <div className="sz-kpi-card">
            <div className="sz-kpi-card__icon" style={{ background: '#FEE2E2' }}>
              <TimerOff size={18} strokeWidth={1.75} style={{ color: '#EF4444' }} />
            </div>
            <div className="mt-auto">
              <div className="sz-kpi-card__value" style={{ color: '#EF4444' }}>{kpis.slaVencidos}</div>
              <div className="sz-kpi-card__label">SLA vencidos</div>
            </div>
          </div>

          {/* 5 Fuera de garantía */}
          <div className="sz-kpi-card">
            <div className="sz-kpi-card__icon" style={{ background: '#F3E8FF' }}>
              <ShieldOff size={18} strokeWidth={1.75} style={{ color: '#A855F7' }} />
            </div>
            <div className="mt-auto">
              <div className="sz-kpi-card__value" style={{ color: '#A855F7' }}>{kpis.fueraGarantia}</div>
              <div className="sz-kpi-card__label">Fuera garantía</div>
            </div>
          </div>

          {/* 6 Cumplimiento SLA */}
          <div className="sz-kpi-card">
            <div className="sz-kpi-card__icon" style={{ background: '#DCFCE7' }}>
              <ShieldCheck size={18} strokeWidth={1.75} style={{ color: '#22C55E' }} />
            </div>
            <div className="mt-auto">
              <div className="sz-kpi-card__value" style={{ color: '#22C55E' }}>{kpis.cumplimientoSla}%</div>
              <div className="sz-kpi-card__label">Cumplimiento SLA</div>
            </div>
          </div>

          {/* 7 Satisfacción */}
          <div className="sz-kpi-card">
            <div className="sz-kpi-card__icon" style={{ background: '#FEF9C3' }}>
              <Star size={18} strokeWidth={1.75} style={{ color: '#EAB308' }} />
            </div>
            <div className="mt-auto">
              <div className="sz-kpi-card__value" style={{ color: '#EAB308' }}>—</div>
              <div className="sz-kpi-card__label">Satisfacción prom.</div>
            </div>
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
          <SectionCard title="Tiempo promedio de resolución (días)">
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-slate-400">
              <Clock className="w-8 h-8 opacity-30" />
              <p className="text-xs text-center text-slate-400">
                Sin datos suficientes.<br />
                Disponible cuando haya tickets resueltos.
              </p>
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
          >
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-slate-400">
              <CalendarDays className="w-6 h-6 opacity-30" />
              <p className="text-xs text-center text-slate-400">
                Sin datos suficientes.<br />
                Requiere configurar garantías por unidad.
              </p>
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
          >
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-slate-400">
              <ShieldOff className="w-6 h-6 opacity-30" />
              <p className="text-xs text-center text-slate-400">
                Sin datos suficientes.<br />
                Requiere configurar garantías por unidad.
              </p>
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
            <p className="text-xs text-slate-400">Desglose por prioridad próximamente.</p>
          </SectionCard>

          {/* 4 — Proveedores */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Proveedores con más tickets</span>
              </div>
            }
          >
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-slate-400">
              <Users className="w-6 h-6 opacity-30" />
              <p className="text-xs text-center text-slate-400">
                Sin datos suficientes.<br />
                Disponible con módulo de proveedores activo.
              </p>
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
                { label: 'SLA vencidos',                 value: String(kpis.slaVencidos),                                          dot: 'bg-red-500' },
                { label: 'Tickets críticos sin asignar', value: String(kpis.criticos),                                             dot: 'bg-red-500' },
                { label: 'Garantías próx. a vencer',     value: '—',                                                              dot: 'bg-amber-400' },
                { label: 'Garantías vencidas',           value: '—',                                                              dot: 'bg-orange-500' },
                { label: 'Tickets reabiertos',           value: String(tickets.filter(t => t.estatus === 'REABIERTO').length),    dot: 'bg-purple-500' },
              ].map((a) => (
                <div key={a.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.dot}`} />
                    <span className="text-slate-600 truncate">{a.label}</span>
                  </div>
                  <span className="ml-2 font-semibold text-slate-700 flex-shrink-0">{a.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Bottom Row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Left — Recent tickets table (xl:col-span-2) */}
          <div className="xl:col-span-2 sz-table-wrapper flex flex-col" style={{ borderRadius: 'var(--sz-radius-xl)' }}>
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
                <table className="sz-table w-full">
                  <thead>
                    <tr>
                      {['Ticket','ID Cuenta','Unidad / Cliente','Precio Final','Categoría','Prioridad','Estatus','Garantía','SLA','Responsable','Creado',''].map((h) => (
                        <th key={h}>{h}</th>
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
              <span className="text-xs text-slate-500">
                {filteredTickets.length === 0
                  ? 'Sin registros'
                  : `${filteredTickets.length} registro${filteredTickets.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* Right — stacked panels */}
          <div className="flex flex-col gap-4">

            {/* Cobertura de garantías */}
            <SectionCard title="Cobertura de garantías">
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-400">
                <ShieldCheck className="w-8 h-8 opacity-30" />
                <p className="text-xs text-center text-slate-400">
                  Sin datos suficientes.<br />
                  Requiere tabla <span className="font-mono text-[11px]">postventa_garantias_unidad</span> poblada.
                </p>
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
                <button
                  onClick={() => setConfigOpen(true)}
                  className="flex items-center gap-2 justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2.5 rounded-lg border border-slate-200 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configurar SLA
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </main>

      {/* ── Configuración SLA ────────────────────────────────────────────── */}
      <PostventaConfiguracion open={configOpen} onClose={() => setConfigOpen(false)} />

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
                  {/* ── Proyecto ─────────────────────────────────── */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Proyecto</label>
                    <select
                      value={wizardProyectoId ?? ''}
                      onChange={(e) => {
                        const pid = e.target.value ? Number(e.target.value) : null;
                        setWizardProyectoId(pid);
                        // Limpiar unidad seleccionada si cambia el proyecto
                        setForm(f => ({ ...f, unidadId: '', subcategoria: '' }));
                        setUnidadSearch('');
                        setUnidadDropOpen(false);
                      }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Todos los proyectos</option>
                      {proyectos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* ── Unidad ───────────────────────────────────── */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Unidad *</label>
                    {/* Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder={wizardProyectoId ? "Escribe el número de unidad o nombre del cliente…" : "Selecciona un proyecto primero…"}
                        disabled={!wizardProyectoId}
                        value={form.unidadId ? (selectedUnidad?.label ?? '') : unidadSearch}
                        onChange={(e) => {
                          setUnidadSearch(e.target.value);
                          setUnidadDropOpen(true);
                          if (!e.target.value) setForm(f => ({ ...f, unidadId: '', subcategoria: '' }));
                        }}
                        onFocus={() => { if (!form.unidadId) setUnidadDropOpen(true); }}
                        onBlur={() => setTimeout(() => {
                          // Auto-seleccionar si hay exactamente 1 resultado
                          if (!form.unidadId && unidadesFiltradas.length === 1) {
                            const u = unidadesFiltradas[0];
                            setForm(f => ({ ...f, unidadId: u.id, subcategoria: '' }));
                            setUnidadSearch(u.label);
                          }
                          setUnidadDropOpen(false);
                        }, 150)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && unidadesFiltradas.length > 0) {
                            const u = unidadesFiltradas[0];
                            setForm(f => ({ ...f, unidadId: u.id, subcategoria: '' }));
                            setUnidadSearch(u.label);
                            setUnidadDropOpen(false);
                            e.preventDefault();
                          }
                          if (e.key === 'Escape') setUnidadDropOpen(false);
                        }}
                        readOnly={!!form.unidadId}
                        className={`w-full pl-8 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                          !wizardProyectoId
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : form.unidadId
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 cursor-default'
                            : step1Tried && !form.unidadId
                            ? 'border-red-400 bg-red-50'
                            : 'border-slate-200'
                        }`}
                      />
                      {form.unidadId && (
                        <button
                          type="button"
                          onClick={() => { setForm(f => ({ ...f, unidadId: '', subcategoria: '' })); setUnidadSearch(''); setUnidadDropOpen(false); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {/* Error de validación */}
                    {step1Tried && !form.unidadId && !unidadSearch && (
                      <p className="text-xs text-red-500 mt-1">Escribe el número de unidad y selecciona de la lista</p>
                    )}
                    {step1Tried && !form.unidadId && unidadSearch && unidadesFiltradas.length !== 1 && (
                      <p className="text-xs text-red-500 mt-1">
                        {unidadesFiltradas.length === 0 ? 'No se encontró esa unidad' : 'Selecciona una unidad de los resultados'}
                      </p>
                    )}

                    {/* Resultados inline (no absolute — evita clipping por overflow-y-auto) */}
                    {unidadDropOpen && !form.unidadId && (
                      <div className="mt-1 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                        {unidadesFiltradas.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-slate-400 text-center">
                            {unidadSearch ? 'Sin resultados para esa búsqueda' : 'Escribe para buscar…'}
                          </p>
                        ) : (
                          <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
                            {unidadesFiltradas.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setForm(f => ({ ...f, unidadId: u.id, subcategoria: '' }));
                                  setUnidadSearch(u.label);
                                  setUnidadDropOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex flex-col gap-0.5 transition-colors"
                              >
                                <span className="text-xs font-semibold text-slate-800">{u.label}</span>
                                <span className="text-xs text-slate-400">{u.cliente} · {u.proyecto.split(' · ')[0]}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedUnidad && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex flex-col gap-1">
                      <p className="text-xs font-semibold text-emerald-800">✓ Unidad identificada</p>
                      <p className="text-xs text-emerald-700"><span className="font-medium">Cliente:</span> {selectedUnidad.cliente}</p>
                      <p className="text-xs text-emerald-700"><span className="font-medium">Proyecto · Torre:</span> {selectedUnidad.proyecto}</p>
                      <p className="text-xs text-emerald-700"><span className="font-medium">Fecha entrega:</span> {selectedUnidad.fechaEntrega}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Categoría *</label>
                    <select
                      value={form.categoria}
                      onChange={(e) => {
                        const cat = categoriasDB.find(c => c.nombre === e.target.value);
                        setForm((f) => ({ ...f, categoria: e.target.value, categoriaId: cat?.id ?? null, subcategoria: '' }));
                      }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Seleccionar categoría…</option>
                      {categoriasDB.map((c) => (
                        <option key={c.id} value={c.nombre}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subcategoría *</label>
                    <select
                      value={form.subcategoria}
                      onChange={(e) => setForm((f) => ({ ...f, subcategoria: e.target.value }))}
                      disabled={!form.categoria || subcatsLoading}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">{subcatsLoading ? 'Cargando…' : 'Seleccionar subcategoría…'}</option>
                      {subcats.map((s) => (
                        <option key={s.id} value={s.nombre}>{s.nombre}</option>
                      ))}
                    </select>
                    {form.categoria && !subcatsLoading && subcats.length === 0 && (
                      <p className="text-[11px] text-amber-600 mt-1">No hay subcategorías configuradas para esta categoría.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Descripción *</label>
                    <textarea
                      rows={3}
                      placeholder="Describe el problema con detalle…"
                      value={form.descripcion}
                      onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none ${
                        step1Tried && !form.descripcion.trim()
                          ? 'border-red-400 bg-red-50'
                          : 'border-slate-200'
                      }`}
                    />
                    {step1Tried && !form.descripcion.trim() && (
                      <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>
                    )}
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
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Carga de evidencias pendiente de habilitar</p>
                      <p className="text-xs text-amber-700 mt-1">
                        La subida de archivos desde este wizard estará disponible próximamente.
                        El ticket se creará sin evidencias iniciales. Podrás subirlas desde el detalle del ticket una vez creado.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Haz clic en <strong>Siguiente</strong> para continuar con la asignación.</p>
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

                  {/* ── Personal de mantenimiento ─────────────────── */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Personal de mantenimiento
                      <span className="ml-1 text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder={
                          !form.categoriaId
                            ? 'Selecciona primero una categoría…'
                            : mantWiz.length === 0
                            ? 'Sin personal asignado a esta categoría'
                            : 'Buscar personal de mantenimiento…'
                        }
                        value={form.personalId ? form.responsable : personalSearch}
                        onChange={(e) => {
                          setPersonalSearch(e.target.value);
                          setPersonalDropOpen(true);
                          if (!e.target.value) setForm(f => ({ ...f, responsable: '', personalId: null }));
                        }}
                        onFocus={() => { if (!form.personalId && mantWiz.length > 0) setPersonalDropOpen(true); }}
                        onBlur={() => setTimeout(() => setPersonalDropOpen(false), 150)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && personalFiltrado.length > 0) {
                            const rel = personalFiltrado[0];
                            const p = rel.personas;
                            const nombre = [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ') || p.email || 'Sin nombre';
                            setForm(f => ({ ...f, responsable: nombre, personalId: p.id }));
                            setPersonalSearch(nombre);
                            setPersonalDropOpen(false);
                            e.preventDefault();
                          }
                          if (e.key === 'Escape') setPersonalDropOpen(false);
                        }}
                        readOnly={!!form.personalId}
                        disabled={!form.categoriaId || mantWiz.length === 0}
                        className={`w-full pl-8 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                          form.personalId
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 cursor-default'
                            : 'border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'
                        }`}
                      />
                      {form.personalId && (
                        <button
                          type="button"
                          onClick={() => { setForm(f => ({ ...f, responsable: '', personalId: null })); setPersonalSearch(''); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {personalDropOpen && !form.personalId && mantWiz.length > 0 && (
                      <div className="mt-1 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                        {personalFiltrado.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-slate-400 text-center">Sin resultados</p>
                        ) : (
                          <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                            {personalFiltrado.map(rel => {
                              const p = rel.personas;
                              const nombre = [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ') || p.email || 'Sin nombre';
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setForm(f => ({ ...f, responsable: nombre, personalId: p.id }));
                                    setPersonalSearch(nombre);
                                    setPersonalDropOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                                >
                                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                    <Users className="w-3.5 h-3.5 text-slate-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-800 truncate">{nombre}</p>
                                    {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {form.categoriaId && mantWiz.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Asigna personal desde <strong>Configurar SLA</strong> para poder elegir aquí.
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      <span className="font-semibold">Responsable y proveedor</span> no se guardarán en BD todavía — columnas pendientes de añadir. El ticket se crea en estatus <strong>Nuevo</strong>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Proveedor <span className="font-normal italic">(no disponible aún)</span></label>
                    <select
                      disabled
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                    >
                      <option value="">Sin proveedor asignado</option>
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
                        <p className="text-slate-500 italic">Pendiente de habilitar</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Prioridad</p>
                        {form.prioridad ? (
                          <Badge cls={PRIORIDAD_META[form.prioridad].cls}>{PRIORIDAD_META[form.prioridad].label}</Badge>
                        ) : <p className="text-slate-800">—</p>}
                      </div>
                      <div>
                        <p className="text-slate-400">Personal asignado</p>
                        <p className="text-slate-800 font-medium">{form.responsable || 'Sin asignar'}</p>
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

                    {/* Nota de garantía — estado real disponible en Fase 2 */}
                    <div className="flex items-center gap-2 mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-500">Estado de garantía disponible próximamente.</span>
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
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
