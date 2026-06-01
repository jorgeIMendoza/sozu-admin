import { useState, useMemo, useRef, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Search, Download, RefreshCw, X, CheckCircle2, Clock,
  FileText, CalendarDays, Loader2, Upload, Scale,
  ChevronRight, MoreHorizontal, Send, MessageSquare,
  AlertTriangle, HeartHandshake, ArrowRight, Plus, AlertCircle,
  Bell, Shield, Gavel, Building2, FileBadge, ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type LegalCaseStatus =
  | 'EN_REVISION' | 'DEMANDA_PRESENTADA' | 'EN_NEGOCIACION'
  | 'ACUERDO' | 'RESUELTA' | 'CERRADA' | 'RIESGO_ALTO';

interface LegalRow {
  demandaId:        number;
  accountId:        number;
  accountCode:      string;
  proyectoId:       number | null;
  proyectoNombre:   string;
  unitCode:         string;
  clienteName:      string;
  clienteEmail:     string;
  clienteRfc:       string;
  contractDate:     string | null;
  deliveryDate:     string | null;
  finalSalePrice:   number;
  paidAmount:       number;
  pendingAmount:    number;
  lawsuitStatus:    LegalCaseStatus;
  penaltyPct:       number;
  penaltyAmount:    number;
  montoReclamado:   number | null;
  montoNegociado:   number | null;
  observations:     string | null;
  responsable:      string | null;
  nextHearingDate:  string | null;
  responseDeadline: string | null;
  docsCount:        number;
  lastUpdatedAt:    string | null;
  // Proceso de demanda (requiere DDL AJ-P1)
  tipoNotificacion:          string | null;
  fechaNotificacion:         string | null;
  diasRegularizacion:        number;
  fechaLimiteRegularizacion: string | null;
  estatusRegularizacion:     string;
  fechaPresentacionDemanda:  string | null;
  estatusAdmisionJuzgado:    string;
  fechaAdmision:             string | null;
  fechaEmplazamiento:        string | null;
  estatusEmplazamiento:      string;
  fechaContestacionDemanda:  string | null;
  fechaAudienciaProceso:     string | null;
  fechaSentencia:            string | null;
  resultadoProceso:          string;
  observacionesJuridicas:    string | null;
}

interface AbogadoItem {
  id: number;
  nombre_completo: string;
  email: string;
  tipo_abogado: string;
}

type ActionType =
  | 'status' | 'observation' | 'penalty' | 'audiencia' | 'acuerdo'
  | 'notificacion' | 'regularizacion' | 'proc_demanda' | 'admision'
  | 'emplazamiento' | 'contestacion' | 'audiencia_proc' | 'sentencia' | 'acuerdo_proc';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<LegalCaseStatus, { label: string; cls: string }> = {
  EN_REVISION:        { label: 'En revisión',        cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  DEMANDA_PRESENTADA: { label: 'Demanda presentada', cls: 'bg-red-50 text-red-700 border-red-200' },
  EN_NEGOCIACION:     { label: 'En negociación',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACUERDO:            { label: 'Acuerdo',            cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  RESUELTA:           { label: 'Resuelta',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CERRADA:            { label: 'Cerrada',            cls: 'bg-green-100 text-green-800 border-green-300' },
  RIESGO_ALTO:        { label: 'Riesgo alto',        cls: 'bg-red-100 text-red-800 border-red-300' },
};

const TIPO_ACUERDO_OPTIONS = ['CONVENIO', 'SENTENCIA', 'DESISTIMIENTO', 'OTRO'] as const;

const TIPO_NOTIFICACION_OPTIONS  = ['NOTARIO', 'CORREO_ELECTRONICO', 'OTRO']                                         as const;
const ESTATUS_REG_OPTIONS        = ['EN_ESPERA', 'REGULARIZADO', 'NO_REGULARIZADO', 'VENCIDO']                       as const;
const ESTATUS_ADMISION_OPTIONS   = ['PENDIENTE', 'PRESENTADA', 'ADMITIDA', 'PREVENIDA', 'RECHAZADA']                 as const;
const ESTATUS_EMPL_OPTIONS       = ['PENDIENTE', 'REALIZADO', 'NO_LOCALIZADO', 'REPROGRAMADO']                       as const;
const RESULTADO_PROCESO_OPTIONS  = ['EN_PROCESO', 'ACUERDO', 'SENTENCIA_FAVORABLE', 'SENTENCIA_DESFAVORABLE', 'CERRADO'] as const;
const TIPO_DOC_PROCESO_OPTIONS   = ['NOTIFICACION','ACUSE_CORREO','ACTA_NOTARIAL','DEMANDA','ACUSE_JUZGADO','AUTO_ADMISION','EMPLAZAMIENTO','CONTESTACION','AUDIENCIA','SENTENCIA','CONVENIO_ACUERDO','OTRO'] as const;

const PROCESO_STEPS = [
  { key: 'notificacion',   label: 'Notificación',          Icon: Bell      },
  { key: 'regularizacion', label: 'Regularización',        Icon: Shield    },
  { key: 'presentacion',   label: 'Presentación juzgado',  Icon: FileBadge },
  { key: 'admision',       label: 'Admisión',              Icon: Building2 },
  { key: 'emplazamiento',  label: 'Emplazamiento',         Icon: Send      },
  { key: 'contestacion',   label: 'Contestación',          Icon: MessageSquare },
  { key: 'audiencia',      label: 'Audiencia',             Icon: CalendarDays  },
  { key: 'sentencia',      label: 'Sentencia / Acuerdo',   Icon: Gavel     },
] as const;

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LegalCaseStatus }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap', m.cls)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  );
}

function KpiCard({ icon, label, count, value, colorCls, active, onClick }: {
  icon: React.ReactNode; label: string; count?: number; value?: string;
  colorCls: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        'flex-1 min-w-[120px] bg-white border rounded-xl p-4 text-left transition-all hover:shadow-sm',
        active ? 'border-primary ring-1 ring-primary/20 shadow-sm' : 'border-border',
      )}
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg mb-3', colorCls)}>{icon}</div>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      {value
        ? <p className="text-base font-bold text-foreground mt-0.5 tabular-nums leading-tight">{value}</p>
        : <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{count ?? 0}</p>}
      <p className="text-[11px] text-primary mt-1.5 flex items-center gap-0.5">Ver detalle <ArrowRight className="h-3 w-3" /></p>
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: 13 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-muted/60 rounded animate-pulse" style={{ width: `${60 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

class AppJuridicoErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppJuridico] render crash:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-700">Portal Jurídico — Error de renderizado</p>
          <p className="mt-1 text-xs text-red-600">{this.state.error.message}</p>
          <button
            className="mt-3 text-xs text-primary underline"
            onClick={() => this.setState({ error: null })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main Component (inner) ───────────────────────────────────────────────────

function AppJuridicoDashboardInner() {
  console.debug('[AppJuridico] component mounted/rendered');

  const { profile, isLoading: authLoading } = useAuth();
  const navigate    = useNavigate();
  const qc          = useQueryClient();

  const isAdmin = (profile?.rol_id ?? 99) <= 2;

  console.debug('[AppJuridico] profile:', { rol_id: profile?.rol_id, id_perfil_juridico: profile?.id_perfil_juridico, authLoading });

  // ── State ──────────────────────────────────────────────────────────────────
  const [proyectoId,     setProyectoId]     = useState('');
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [kpiFilter,      setKpiFilter]      = useState('');
  const [etapaFilter,    setEtapaFilter]    = useState(''); // filtro por etapa del pipeline
  const [soloVencidos,   setSoloVencidos]   = useState(false); // mostrar solo regularizaciones vencidas
  const [selectedRow,    setSelectedRow]    = useState<LegalRow | null>(null);
  const [detailTab,      setDetailTab]      = useState<'resumen' | 'documentos' | 'bitacora' | 'audiencias' | 'acuerdos' | 'proceso'>('resumen');
  const [adminAbogadoId, setAdminAbogadoId] = useState<number | null>(null);

  // Action dialog state
  const [action, setAction] = useState<{ type: ActionType; row: LegalRow } | null>(null);
  const [actionInput, setActionInput] = useState('');
  const [actionInput2, setActionInput2] = useState('');
  const [actionInput3, setActionInput3] = useState('');
  const actionRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const openAction = (type: ActionType, row: LegalRow, defaultVal = '') => {
    setAction({ type, row });
    setActionInput(defaultVal);
    setActionInput2('');
    setActionInput3('');
  };
  const closeAction = () => { setAction(null); setActionInput(''); };

  // ── Proceso de demanda form state ──────────────────────────────────────────
  const [procesoForm, setProcesoForm] = useState({
    tipoNotificacion:         'NOTARIO',
    fechaNotificacion:        '',
    diasRegularizacion:       '15',
    estatusRegularizacion:    'EN_ESPERA',
    fechaPresentacionDemanda: '',
    estatusAdmisionJuzgado:   'PENDIENTE',
    fechaAdmision:            '',
    fechaEmplazamiento:       '',
    estatusEmplazamiento:     'PENDIENTE',
    fechaContestacionDemanda: '',
    fechaAudienciaProceso:    '',
    fechaSentencia:           '',
    resultadoProceso:         'EN_PROCESO',
    observacionesJuridicas:   '',
  });

  const setPF = (k: keyof typeof procesoForm, v: string) =>
    setProcesoForm(p => ({ ...p, [k]: v }));

  const loadProcesoFromRow = (row: LegalRow) => {
    setProcesoForm({
      tipoNotificacion:         row.tipoNotificacion         ?? 'NOTARIO',
      fechaNotificacion:        row.fechaNotificacion        ?? '',
      diasRegularizacion:       String(row.diasRegularizacion ?? 15),
      estatusRegularizacion:    row.estatusRegularizacion    ?? 'EN_ESPERA',
      fechaPresentacionDemanda: row.fechaPresentacionDemanda ?? '',
      estatusAdmisionJuzgado:   row.estatusAdmisionJuzgado   ?? 'PENDIENTE',
      fechaAdmision:            row.fechaAdmision            ?? '',
      fechaEmplazamiento:       row.fechaEmplazamiento       ?? '',
      estatusEmplazamiento:     row.estatusEmplazamiento     ?? 'PENDIENTE',
      fechaContestacionDemanda: row.fechaContestacionDemanda ?? '',
      fechaAudienciaProceso:    row.fechaAudienciaProceso    ?? '',
      fechaSentencia:           row.fechaSentencia           ?? '',
      resultadoProceso:         row.resultadoProceso         ?? 'EN_PROCESO',
      observacionesJuridicas:   row.observacionesJuridicas   ?? '',
    });
  };

  // ── Abogados list (admin only) ─────────────────────────────────────────────
  const { data: abogadosList = [] } = useQuery({
    queryKey: ['app-juridico-abogados-list'],
    enabled: isAdmin,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('perfiles_juridicos')
          .select('id, nombre_completo, email, tipo_abogado')
          .eq('estatus', 'ACTIVO')
          .order('nombre_completo');
        return (data ?? []) as AbogadoItem[];
      } catch { return [] as AbogadoItem[]; }
    },
  });

  // Lawyer identity: from profile or admin selector
  const perfilId = isAdmin ? adminAbogadoId : (profile?.id_perfil_juridico ?? null);
  const canView  = isAdmin || !!(profile?.id_perfil_juridico);

  // ── Projects ───────────────────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['app-juridico-proyectos'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('proyectos').select('id, nombre')
        .eq('publicar', true).eq('activo', true).order('nombre');
      return data ?? [];
    },
  });

  // ── Assignment IDs for current lawyer ─────────────────────────────────────
  const { data: assignedIds, isLoading: loadingAssigned } = useQuery({
    queryKey: ['app-juridico-asignaciones', perfilId],
    enabled: !isAdmin && !!perfilId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('asignaciones_juridico')
          .select('id_demanda')
          .eq('id_perfil_juridico', perfilId)
          .eq('estatus', 'ACTIVA');
        return (data ?? []).map((a: any) => a.id_demanda as number);
      } catch {
        return null as number[] | null;
      }
    },
  });

  // ── Main demandas query + DDL probes ───────────────────────────────────────
  const {
    data: demandasResult,
    isLoading: loadingDemandas,
    error: demandasQueryError,
    refetch: refetchAll,
  } = useQuery({
    queryKey: ['app-juridico-demandas', perfilId, isAdmin, adminAbogadoId],
    enabled: !authLoading && canView && (!isAdmin ? !loadingAssigned : true),
    staleTime: 0,           // siempre refetch al montar — garantiza datos frescos al navegar
    refetchInterval: 30_000, // polling cada 30s para actualizaciones automáticas
    queryFn: async () => {
      // DDL probes (parallel) — determines available columns and tables
      const [aj1Probe, perfilesProbe, procesoProbe] = await Promise.allSettled([
        (supabase as any).from('demandas').select('porcentaje_penalizacion').limit(0),
        (supabase as any).from('perfiles_juridicos').select('id').limit(0),
        (supabase as any).from('demandas').select('tipo_notificacion').limit(0),
      ]);

      const hasAj1     = aj1Probe.status      === 'fulfilled' && !(aj1Probe.value     as any)?.error;
      const hasAppJu   = perfilesProbe.status === 'fulfilled' && !(perfilesProbe.value as any)?.error;
      const hasProceso = procesoProbe.status  === 'fulfilled' && !(procesoProbe.value  as any)?.error;
      console.debug('[AppJuridico] DDL probes — hasAj1:', hasAj1, 'hasAppJu:', hasAppJu, 'hasProceso:', hasProceso);

      // Flat select — NO PostgREST joins (demandas has no FK to proyectos)
      const aj1Cols = hasAj1
        ? ', porcentaje_penalizacion, monto_reclamado, monto_negociado, fecha_proxima_audiencia, fecha_limite_respuesta'
        : '';
      const procesoCols = hasProceso
        ? ', tipo_notificacion, fecha_notificacion, dias_regularizacion, fecha_limite_regularizacion, estatus_regularizacion, fecha_presentacion_demanda, estatus_admision_juzgado, fecha_admision, fecha_emplazamiento, estatus_emplazamiento, fecha_contestacion_demanda, fecha_audiencia_proceso, fecha_sentencia, resultado_proceso, observaciones_juridicas'
        : '';

      let q = (supabase as any)
        .from('demandas')
        .select(`id, id_cuenta_cobranza, id_propiedad, estatus_demanda, fecha_compromiso_entrega, responsable, observaciones, fecha_creacion, fecha_actualizacion${aj1Cols}${procesoCols}`)
        .eq('activo', true)
        .order('fecha_actualizacion', { ascending: false });

      if (!isAdmin) {
        // Abogado: filtrar por asignaciones O por id_perfil_juridico directo en demandas
        if (assignedIds && assignedIds.length > 0) {
          q = q.in('id', assignedIds);
        } else if (perfilId) {
          // Fallback: demandas asignadas directamente (sin tabla asignaciones)
          q = q.eq('id_perfil_juridico', perfilId);
        } else {
          return { rows: [], hasAj1, hasAppJu, hasProceso, assignedEmpty: true, entityMaps: null };
        }
      } else if (adminAbogadoId) {
        // Admin filtrando por abogado: intentar asignaciones, caer back a id_perfil_juridico
        let filteredByAsignaciones = false;
        try {
          const { data: aIds } = await (supabase as any)
            .from('asignaciones_juridico')
            .select('id_demanda')
            .eq('id_perfil_juridico', adminAbogadoId)
            .eq('estatus', 'ACTIVA');
          const ids = (aIds ?? []).map((a: any) => a.id_demanda as number);
          if (ids.length > 0) {
            q = q.in('id', ids);
            filteredByAsignaciones = true;
          }
        } catch { /* no asignaciones table yet — usar fallback */ }

        if (!filteredByAsignaciones) {
          // Fallback: filtrar directamente por id_perfil_juridico en demandas
          q = q.eq('id_perfil_juridico', adminAbogadoId);
        }
      }

      const { data: rawDem, error: demError } = await q;
      if (demError) {
        console.error('[AppJuridicoDashboard] demandas query:', demError);
        return { rows: [], hasAj1, hasAppJu, hasProceso, queryError: demError.message as string, entityMaps: null };
      }

      const demandas = (rawDem ?? []) as any[];
      console.debug('[AppJuridico] demandas loaded:', demandas.length, 'rows');

      if (!demandas.length) return { rows: demandas, hasAj1, hasAppJu, hasProceso, entityMaps: null };

      const cuentaIds = [...new Set(demandas.map((d: any) => d.id_cuenta_cobranza).filter(Boolean))] as number[];
      const propIds   = [...new Set(demandas.map((d: any) => d.id_propiedad).filter(Boolean))]   as number[];

      // Parallel batch 1: cuentas + compradores + propiedades
      const [cuentasRes, compradoresRes, propiedadesRes] = await Promise.allSettled([
        cuentaIds.length
          ? supabase.from('cuentas_cobranza').select('id, precio_final, fecha_compra').in('id', cuentaIds as any)
          : Promise.resolve({ data: [] as any[] }),
        cuentaIds.length
          ? supabase.from('compradores').select('id_cuenta_cobranza, id_persona').in('id_cuenta_cobranza', cuentaIds as any).eq('activo', true)
          : Promise.resolve({ data: [] as any[] }),
        propIds.length
          ? supabase.from('propiedades').select('id, numero_propiedad, id_edificio_modelo').in('id', propIds as any)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const cuentas: any[]     = cuentasRes.status     === 'fulfilled' ? (cuentasRes.value     as any).data ?? [] : [];
      const compradores: any[] = compradoresRes.status === 'fulfilled' ? (compradoresRes.value as any).data ?? [] : [];
      const propiedades: any[] = propiedadesRes.status === 'fulfilled' ? (propiedadesRes.value as any).data ?? [] : [];

      // Parallel batch 2: personas + edificios_modelos
      const personaIds = [...new Set(compradores.map((c: any) => c.id_persona).filter(Boolean))] as number[];
      const modeloIds  = [...new Set(propiedades.map((p: any) => p.id_edificio_modelo).filter(Boolean))] as number[];

      const [personasRes, modelosRes] = await Promise.allSettled([
        personaIds.length
          ? supabase.from('personas').select('id, nombre_legal, nombre_comercial, email, rfc').in('id', personaIds as any)
          : Promise.resolve({ data: [] as any[] }),
        modeloIds.length
          ? supabase.from('edificios_modelos').select('id, id_edificio').in('id', modeloIds as any)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const personas: any[] = personasRes.status === 'fulfilled' ? (personasRes.value as any).data ?? [] : [];
      const modelos: any[]  = modelosRes.status  === 'fulfilled' ? (modelosRes.value  as any).data ?? [] : [];

      // Waterfall: edificios → proyectos
      const edificioIds = [...new Set(modelos.map((m: any) => m.id_edificio).filter(Boolean))] as number[];
      const edificios: any[] = edificioIds.length
        ? ((await supabase.from('edificios').select('id, id_proyecto').in('id', edificioIds as any)).data ?? [])
        : [];

      const proyectoIds = [...new Set(edificios.map((e: any) => e.id_proyecto).filter(Boolean))] as number[];
      const proyectos: any[] = proyectoIds.length
        ? ((await supabase.from('proyectos').select('id, nombre').in('id', proyectoIds as any)).data ?? [])
        : [];

      // Build lookup map for compradores (cuenta_id → persona_id, first active buyer)
      const cuentaPersonaMap = new Map<number, number | undefined>();
      for (const c of compradores) {
        if (!cuentaPersonaMap.has(c.id_cuenta_cobranza)) cuentaPersonaMap.set(c.id_cuenta_cobranza, c.id_persona);
      }

      const entityMaps = {
        cuentaMap:       new Map<number, any>(cuentas.map((c: any)    => [c.id, c])),
        propMap:         new Map<number, any>(propiedades.map((p: any) => [p.id, p])),
        personaMap:      new Map<number, any>(personas.map((p: any)   => [p.id, p])),
        modeloMap:       new Map<number, any>(modelos.map((m: any)    => [m.id, m])),
        edificioMap:     new Map<number, any>(edificios.map((e: any)  => [e.id, e])),
        proyectoMap:     new Map<number, any>(proyectos.map((p: any)  => [p.id, p])),
        cuentaPersonaMap,
      };

      console.debug('[AppJuridico] entityMaps — cuentas:', cuentas.length, 'personas:', personas.length, 'proyectos:', proyectos.length);
      return { rows: demandas, hasAj1, hasAppJu, hasProceso, entityMaps };
    },
  });

  const rawDemandas    = demandasResult?.rows        ?? [];
  const hasAj1Cols     = demandasResult?.hasAj1      ?? false;
  const hasAppJuridico = demandasResult?.hasAppJu    ?? false;
  const hasProcesoCol  = demandasResult?.hasProceso  ?? false;
  const inlineError    = demandasResult?.queryError  ?? null;

  const accountIds = useMemo(
    () => rawDemandas.map((d: any) => d.id_cuenta_cobranza).filter(Boolean) as number[],
    [rawDemandas],
  );
  const demandaIds = useMemo(() => rawDemandas.map((d: any) => d.id as number), [rawDemandas]);

  // ── Payments ───────────────────────────────────────────────────────────────
  const { data: pagosData = [] } = useQuery({
    queryKey: ['app-juridico-pagos', accountIds],
    enabled: accountIds.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('pagos').select('id_cuenta_cobranza, monto')
        .in('id_cuenta_cobranza', accountIds as any).eq('activo', true);
      return (data ?? []) as any[];
    },
  });

  const pagosSum = useMemo(() => {
    const map: Record<number, number> = {};
    for (const p of pagosData)
      map[p.id_cuenta_cobranza] = (map[p.id_cuenta_cobranza] || 0) + Number(p.monto);
    return map;
  }, [pagosData]);

  // ── Timeline ───────────────────────────────────────────────────────────────
  const { data: timelineData = [], refetch: refetchTimeline } = useQuery({
    queryKey: ['app-juridico-timeline', demandaIds],
    enabled: demandaIds.length > 0,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('demandas_timeline').select('*')
        .in('id_demanda', demandaIds)
        .order('fecha_creacion', { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // ── Audiencias (graceful fallback) ─────────────────────────────────────────
  const { data: audienciasData = [], refetch: refetchAudiencias } = useQuery({
    queryKey: ['app-juridico-audiencias', demandaIds],
    enabled: demandaIds.length > 0,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('app_juridico_audiencias').select('*')
          .in('id_demanda', demandaIds).eq('activo', true)
          .order('fecha', { ascending: true });
        return (data ?? []) as any[];
      } catch { return []; }
    },
  });

  // ── Documentos count (graceful fallback) ───────────────────────────────────
  const { data: docsData = [] } = useQuery({
    queryKey: ['app-juridico-docs', demandaIds],
    enabled: demandaIds.length > 0,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('app_juridico_documentos').select('id_demanda')
          .in('id_demanda', demandaIds).eq('activo', true);
        return (data ?? []) as any[];
      } catch { return []; }
    },
  });

  // ── Acuerdos (graceful fallback) ───────────────────────────────────────────
  const { data: acuerdosData = [], refetch: refetchAcuerdos } = useQuery({
    queryKey: ['app-juridico-acuerdos', demandaIds],
    enabled: demandaIds.length > 0,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('app_juridico_acuerdos').select('*')
          .in('id_demanda', demandaIds).eq('activo', true)
          .order('fecha_acuerdo', { ascending: false });
        return (data ?? []) as any[];
      } catch { return []; }
    },
  });

  // ── Maps ───────────────────────────────────────────────────────────────────
  const docsCountMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const d of docsData) map[d.id_demanda] = (map[d.id_demanda] || 0) + 1;
    return map;
  }, [docsData]);

  const timelineMap = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const e of timelineData) {
      if (!map[e.id_demanda]) map[e.id_demanda] = [];
      map[e.id_demanda].push(e);
    }
    return map;
  }, [timelineData]);

  const audienciasMap = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const a of audienciasData) {
      if (!map[a.id_demanda]) map[a.id_demanda] = [];
      map[a.id_demanda].push(a);
    }
    return map;
  }, [audienciasData]);

  const acuerdosMap = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const a of acuerdosData) {
      if (!map[a.id_demanda]) map[a.id_demanda] = [];
      map[a.id_demanda].push(a);
    }
    return map;
  }, [acuerdosData]);

  // ── Build rows ─────────────────────────────────────────────────────────────
  const allRows: LegalRow[] = useMemo(() => {
    const em = demandasResult?.entityMaps;
    return rawDemandas.map((d: any): LegalRow => {
      const cuenta    = em?.cuentaMap?.get(d.id_cuenta_cobranza);
      const prop      = em?.propMap?.get(d.id_propiedad);
      const personaId = em?.cuentaPersonaMap?.get(d.id_cuenta_cobranza);
      const persona   = personaId != null ? em?.personaMap?.get(personaId) : null;

      // Resolve project through property → modelo → edificio → proyecto chain
      let proyectoId: number | null = null;
      let proyectoNombre = '—';
      if (prop?.id_edificio_modelo) {
        const modelo = em?.modeloMap?.get(prop.id_edificio_modelo);
        if (modelo?.id_edificio) {
          const edificio = em?.edificioMap?.get(modelo.id_edificio);
          if (edificio?.id_proyecto) {
            proyectoId = edificio.id_proyecto as number;
            proyectoNombre = em?.proyectoMap?.get(edificio.id_proyecto)?.nombre ?? '—';
          }
        }
      }

      const finalSalePrice = Number(cuenta?.precio_final || 0);
      const paidAmount     = pagosSum[d.id_cuenta_cobranza] || 0;
      const pendingAmount  = Math.max(0, finalSalePrice - paidAmount);
      const penaltyPct     = Number(d.porcentaje_penalizacion || 0);

      const rawStatus     = (d.estatus_demanda || 'EN_REVISION') as string;
      const lawsuitStatus: LegalCaseStatus = (Object.keys(STATUS_META) as LegalCaseStatus[]).includes(rawStatus as LegalCaseStatus)
        ? rawStatus as LegalCaseStatus : 'EN_REVISION';

      return {
        demandaId:        d.id,
        accountId:        d.id_cuenta_cobranza ?? 0,
        accountCode:      d.id_cuenta_cobranza ? `CC-${String(d.id_cuenta_cobranza).padStart(6, '0')}` : '—',
        proyectoId,
        proyectoNombre,
        unitCode:         prop?.numero_propiedad ?? '—',
        clienteName:      persona?.nombre_legal ?? persona?.nombre_comercial ?? '—',
        clienteEmail:     persona?.email ?? '',
        clienteRfc:       persona?.rfc ?? '',
        contractDate:     cuenta?.fecha_compra ?? null,
        deliveryDate:     d.fecha_compromiso_entrega ?? null,
        finalSalePrice,
        paidAmount,
        pendingAmount,
        lawsuitStatus,
        penaltyPct,
        penaltyAmount:    finalSalePrice * (penaltyPct / 100),
        montoReclamado:   d.monto_reclamado  ? Number(d.monto_reclamado)  : null,
        montoNegociado:   d.monto_negociado  ? Number(d.monto_negociado)  : null,
        observations:     d.observaciones    ?? null,
        responsable:      d.responsable      ?? null,
        nextHearingDate:  d.fecha_proxima_audiencia ?? null,
        responseDeadline: d.fecha_limite_respuesta  ?? null,
        docsCount:        docsCountMap[d.id] ?? 0,
        lastUpdatedAt:    d.fecha_actualizacion ?? null,
        // Proceso de demanda
        tipoNotificacion:          d.tipo_notificacion          ?? null,
        fechaNotificacion:         d.fecha_notificacion         ?? null,
        diasRegularizacion:        Number(d.dias_regularizacion ?? 15),
        fechaLimiteRegularizacion: d.fecha_limite_regularizacion ?? null,
        estatusRegularizacion:     d.estatus_regularizacion     ?? 'EN_ESPERA',
        fechaPresentacionDemanda:  d.fecha_presentacion_demanda ?? null,
        estatusAdmisionJuzgado:    d.estatus_admision_juzgado   ?? 'PENDIENTE',
        fechaAdmision:             d.fecha_admision             ?? null,
        fechaEmplazamiento:        d.fecha_emplazamiento        ?? null,
        estatusEmplazamiento:      d.estatus_emplazamiento      ?? 'PENDIENTE',
        fechaContestacionDemanda:  d.fecha_contestacion_demanda ?? null,
        fechaAudienciaProceso:     d.fecha_audiencia_proceso    ?? null,
        fechaSentencia:            d.fecha_sentencia            ?? null,
        resultadoProceso:          d.resultado_proceso          ?? 'EN_PROCESO',
        observacionesJuridicas:    d.observaciones_juridicas    ?? null,
      } satisfies LegalRow;
    });
  }, [rawDemandas, demandasResult, pagosSum, docsCountMap]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activos = ['EN_REVISION','DEMANDA_PRESENTADA','EN_NEGOCIACION','RIESGO_ALTO'] as LegalCaseStatus[];
    const in30    = new Date(); in30.setDate(in30.getDate() + 30);
    return {
      total:          allRows.length,
      activos:        allRows.filter(r => activos.includes(r.lawsuitStatus)).length,
      riesgoAlto:     allRows.filter(r => r.lawsuitStatus === 'RIESGO_ALTO').length,
      negociacion:    allRows.filter(r => r.lawsuitStatus === 'EN_NEGOCIACION').length,
      resueltas:      allRows.filter(r => ['RESUELTA','CERRADA'].includes(r.lawsuitStatus)).length,
      totalPenalty:   allRows.reduce((s, r) => s + r.penaltyAmount, 0),
      audiencias:     allRows.filter(r => r.nextHearingDate && new Date(r.nextHearingDate) <= in30).length,
      docsPendientes: allRows.filter(r => r.docsCount === 0 && !['CERRADA','RESUELTA'].includes(r.lawsuitStatus)).length,
    };
  }, [allRows]);

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (kpiFilter === 'activos')     rows = rows.filter(r => ['EN_REVISION','DEMANDA_PRESENTADA','EN_NEGOCIACION','RIESGO_ALTO'].includes(r.lawsuitStatus));
    else if (kpiFilter === 'riesgo') rows = rows.filter(r => r.lawsuitStatus === 'RIESGO_ALTO');
    else if (kpiFilter === 'negociacion') rows = rows.filter(r => r.lawsuitStatus === 'EN_NEGOCIACION');
    else if (kpiFilter === 'resueltas')   rows = rows.filter(r => ['RESUELTA','CERRADA'].includes(r.lawsuitStatus));
    else if (kpiFilter === 'audiencias')  rows = rows.filter(r => !!r.nextHearingDate);
    else if (kpiFilter === 'docs')        rows = rows.filter(r => r.docsCount === 0 && !['CERRADA','RESUELTA'].includes(r.lawsuitStatus));

    if (proyectoId && proyectoId !== 'todos') rows = rows.filter(r => String(r.proyectoId) === proyectoId);
    if (statusFilter && statusFilter !== 'todos') rows = rows.filter(r => r.lawsuitStatus === statusFilter);

    // Filtro por etapa del pipeline (derivada de campos hasProcesoCol)
    if (etapaFilter && etapaFilter !== 'todas') {
      rows = rows.filter(r => {
        if (etapaFilter === 'notificacion')   return !!r.fechaNotificacion;
        if (etapaFilter === 'regularizacion') return !!r.fechaNotificacion && !r.fechaPresentacionDemanda;
        if (etapaFilter === 'presentacion')   return !!r.fechaPresentacionDemanda;
        if (etapaFilter === 'admision')       return !!r.fechaAdmision;
        if (etapaFilter === 'emplazamiento')  return !!r.fechaEmplazamiento;
        if (etapaFilter === 'audiencia')      return !!r.fechaAudienciaProceso;
        if (etapaFilter === 'sentencia')      return !!r.fechaSentencia;
        return true;
      });
    }

    // Filtro "solo vencidos": regularización vencida y no resuelta
    if (soloVencidos) {
      const today = new Date();
      rows = rows.filter(r =>
        r.fechaLimiteRegularizacion &&
        r.estatusRegularizacion !== 'REGULARIZADO' &&
        new Date(r.fechaLimiteRegularizacion) < today
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.accountCode.toLowerCase().includes(q) ||
        r.unitCode.toLowerCase().includes(q) ||
        r.clienteName.toLowerCase().includes(q) ||
        r.clienteRfc.toLowerCase().includes(q) ||
        r.proyectoNombre.toLowerCase().includes(q) ||
        (r.responsable ?? '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allRows, kpiFilter, proyectoId, statusFilter, search]);

  const hasFilters = !!(proyectoId && proyectoId !== 'todos') || !!statusFilter || !!search || !!etapaFilter || soloVencidos;
  const clearFilters = () => { setProyectoId(''); setStatusFilter(''); setSearch(''); setKpiFilter(''); setEtapaFilter(''); setSoloVencidos(false); };

  const isLoading       = loadingDemandas;
  const lastUpdated     = new Date().toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const selectedTimeline   = selectedRow ? (timelineMap[selectedRow.demandaId] ?? []) : [];
  const selectedAudiencias = selectedRow ? (audienciasMap[selectedRow.demandaId] ?? []) : [];
  const selectedAcuerdos   = selectedRow ? (acuerdosMap[selectedRow.demandaId] ?? []) : [];

  // ── Mutations ──────────────────────────────────────────────────────────────

  const insertTimeline = async (demandaId: number, tipoEvento: string, descripcion: string) => {
    try {
      await (supabase as any).from('demandas_timeline').insert({
        id_demanda:   demandaId,
        tipo_evento:  tipoEvento,
        descripcion,
        creado_por:   profile?.email ?? 'sistema',
      });
    } catch (e) {
      console.error('[AppJuridicoDashboard] timeline insert:', e);
    }
  };

  const { mutateAsync: changeStatus, isPending: changingStatus } = useMutation({
    mutationFn: async ({ demandaId, newStatus }: { demandaId: number; newStatus: LegalCaseStatus }) => {
      const { error } = await (supabase as any)
        .from('demandas').update({ estatus_demanda: newStatus }).eq('id', demandaId);
      if (error) throw new Error(error.message);
      await insertTimeline(demandaId, 'CAMBIO_ESTATUS', `Estatus cambiado a ${STATUS_META[newStatus]?.label ?? newStatus}`);
    },
    onSuccess: (_, { newStatus }) => {
      toast.success('Estatus actualizado');
      if (selectedRow) setSelectedRow(prev => prev ? { ...prev, lawsuitStatus: newStatus } : null);
      qc.invalidateQueries({ queryKey: ['app-juridico-demandas'] });
      qc.invalidateQueries({ queryKey: ['app-juridico-timeline'] });
      closeAction();
    },
    onError: (err: any) => toast.error('Error al cambiar estatus', { description: err.message }),
  });

  const { mutateAsync: saveObservation, isPending: savingObs } = useMutation({
    mutationFn: async ({ demandaId, text }: { demandaId: number; text: string }) => {
      const { error } = await (supabase as any)
        .from('demandas').update({ observaciones: text }).eq('id', demandaId);
      if (error) throw new Error(error.message);
      await insertTimeline(demandaId, 'OBSERVACION', text.length > 120 ? text.slice(0, 120) + '…' : text);
    },
    onSuccess: (_, { text }) => {
      toast.success('Observación guardada');
      if (selectedRow) setSelectedRow(prev => prev ? { ...prev, observations: text } : null);
      qc.invalidateQueries({ queryKey: ['app-juridico-demandas'] });
      qc.invalidateQueries({ queryKey: ['app-juridico-timeline'] });
      closeAction();
    },
    onError: (err: any) => toast.error('Error al guardar observación', { description: err.message }),
  });

  const { mutateAsync: savePenalty, isPending: savingPenalty } = useMutation({
    mutationFn: async ({ demandaId, pct, finalSalePrice }: { demandaId: number; pct: number; finalSalePrice: number }) => {
      if (!hasAj1Cols) throw new Error('Columna porcentaje_penalizacion no existe. Ejecuta DDL AJ-1.');
      const monto = finalSalePrice * (pct / 100);
      const { error } = await (supabase as any)
        .from('demandas').update({ porcentaje_penalizacion: pct, monto_penalizacion: monto }).eq('id', demandaId);
      if (error) throw new Error(error.message);
      await insertTimeline(demandaId, 'ACTUALIZACION_PENALIZACION', `Penalización actualizada a ${pct}% (${fmtMxn(monto)})`);
    },
    onSuccess: (_, { pct, finalSalePrice }) => {
      toast.success('Penalización actualizada');
      const monto = finalSalePrice * (pct / 100);
      if (selectedRow) setSelectedRow(prev => prev ? { ...prev, penaltyPct: pct, penaltyAmount: monto } : null);
      qc.invalidateQueries({ queryKey: ['app-juridico-demandas'] });
      qc.invalidateQueries({ queryKey: ['app-juridico-timeline'] });
      closeAction();
    },
    onError: (err: any) => toast.error('Error al actualizar penalización', { description: err.message }),
  });

  const { mutateAsync: addAudiencia, isPending: addingAudiencia } = useMutation({
    mutationFn: async ({ demandaId, fecha, descripcion }: { demandaId: number; fecha: string; descripcion: string }) => {
      if (!hasAppJuridico) throw new Error('Tabla app_juridico_audiencias no existe. Ejecuta DDL AJ-5.');
      const { error } = await (supabase as any)
        .from('app_juridico_audiencias').insert({
          id_demanda:    demandaId,
          fecha,
          descripcion:   descripcion || null,
          registrado_por: profile?.email ?? 'sistema',
        });
      if (error) throw new Error(error.message);
      await insertTimeline(demandaId, 'AUDIENCIA_REGISTRADA', `Audiencia registrada para ${fmtDate(fecha)}`);
    },
    onSuccess: () => {
      toast.success('Audiencia registrada');
      qc.invalidateQueries({ queryKey: ['app-juridico-audiencias'] });
      qc.invalidateQueries({ queryKey: ['app-juridico-timeline'] });
      refetchAudiencias();
      closeAction();
    },
    onError: (err: any) => toast.error('Error al registrar audiencia', { description: err.message }),
  });

  const { mutateAsync: addAcuerdo, isPending: addingAcuerdo } = useMutation({
    mutationFn: async ({ demandaId, tipo, descripcion, fecha }: { demandaId: number; tipo: string; descripcion: string; fecha: string }) => {
      if (!hasAppJuridico) throw new Error('Tabla app_juridico_acuerdos no existe. Ejecuta DDL AJ-6.');
      const { error } = await (supabase as any)
        .from('app_juridico_acuerdos').insert({
          id_demanda:    demandaId,
          tipo_acuerdo:  tipo,
          descripcion,
          fecha_acuerdo: fecha,
          registrado_por: profile?.email ?? 'sistema',
        });
      if (error) throw new Error(error.message);
      await insertTimeline(demandaId, 'ACUERDO_REGISTRADO', `Acuerdo ${tipo} registrado`);
    },
    onSuccess: () => {
      toast.success('Acuerdo registrado');
      qc.invalidateQueries({ queryKey: ['app-juridico-acuerdos'] });
      qc.invalidateQueries({ queryKey: ['app-juridico-timeline'] });
      refetchAcuerdos();
      closeAction();
    },
    onError: (err: any) => toast.error('Error al registrar acuerdo', { description: err.message }),
  });

  const { mutateAsync: markResolved, isPending: markingResolved } = useMutation({
    mutationFn: async ({ demandaId }: { demandaId: number }) => {
      const { error } = await (supabase as any)
        .from('demandas').update({ estatus_demanda: 'RESUELTA' }).eq('id', demandaId);
      if (error) throw new Error(error.message);
      await insertTimeline(demandaId, 'CASO_RESUELTO', 'Caso marcado como resuelto');
    },
    onSuccess: () => {
      toast.success('Caso marcado como resuelto');
      if (selectedRow) setSelectedRow(prev => prev ? { ...prev, lawsuitStatus: 'RESUELTA' } : null);
      qc.invalidateQueries({ queryKey: ['app-juridico-demandas'] });
      qc.invalidateQueries({ queryKey: ['app-juridico-timeline'] });
    },
    onError: (err: any) => toast.error('Error', { description: err.message }),
  });

  const { mutateAsync: saveProcesoField, isPending: savingProceso } = useMutation({
    mutationFn: async ({ demandaId, fields, eventoLabel }: { demandaId: number; fields: Record<string, any>; eventoLabel: string }) => {
      if (!hasProcesoCol) throw new Error('Columnas proceso_demanda no existen. Ejecuta DDL AJ-P1 en app_juridico_proceso_demanda_ddl.md.');
      const { error } = await (supabase as any)
        .from('demandas').update(fields).eq('id', demandaId);
      if (error) throw new Error(error.message);
      await insertTimeline(demandaId, 'PROCESO_DEMANDA', eventoLabel);
    },
    onSuccess: () => {
      toast.success('Proceso actualizado');
      qc.invalidateQueries({ queryKey: ['app-juridico-demandas'] });
      qc.invalidateQueries({ queryKey: ['app-juridico-timeline'] });
      closeAction();
    },
    onError: (err: any) => toast.error('Error al actualizar proceso', { description: err.message }),
  });

  // ── Action helpers ─────────────────────────────────────────────────────────
  const handleAction = (type: ActionType, row: LegalRow) => {
    if (type === 'penalty' && !hasAj1Cols) {
      toast.info('DDL pendiente', { description: 'Ejecuta AJ-1 en resultado_ejecucion_app_notaria_app_juridico.md para habilitar esta acción.' });
      return;
    }
    if ((type === 'audiencia' || type === 'acuerdo') && !hasAppJuridico) {
      toast.info('DDL pendiente', { description: 'Ejecuta AJ-5/AJ-6 en resultado_ejecucion_app_notaria_app_juridico.md para habilitar esta acción.' });
      return;
    }
    const defaults: Partial<Record<ActionType, string>> = {
      status:     row.lawsuitStatus,
      observation: row.observations ?? '',
      penalty:    String(row.penaltyPct),
      audiencia:  '',
      acuerdo:    '',
    };
    openAction(type, row, defaults[type] ?? '');
  };

  // ── Auth loading guard ─────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando Portal Jurídico...</span>
      </div>
    );
  }

  // ── No access ──────────────────────────────────────────────────────────────
  if (profile && !canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Scale className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm font-medium">Sin perfil jurídico</p>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Tu usuario no está vinculado a un perfil jurídico. Solicita al administrador SOZU que complete tu registro como abogado.
        </p>
      </div>
    );
  }

  // ── Fatal error state ──────────────────────────────────────────────────────
  if (demandasQueryError && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-semibold text-red-600">Error al cargar Portal Jurídico</p>
        <p className="text-xs text-muted-foreground max-w-sm text-center">
          {(demandasQueryError as any)?.message ?? 'Error desconocido'}
        </p>
        <button onClick={() => refetchAll()} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <RefreshCw className="h-3 w-3" /> Reintentar
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  console.debug('[AppJuridico] render state', {
    authLoading,
    isAdmin,
    canView,
    isLoading,
    rowsCount: rawDemandas?.length,
    hasAj1Cols,
    hasAppJuridico,
    error: demandasQueryError,
    inlineError,
  });

  return (
    <div className="space-y-5">


      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Portal Jurídico
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visualiza y gestiona los casos de demandas asignados a tu perfil.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">Última actualización: {lastUpdated}</span>
          <button
            onClick={() => {
              refetchAll();
              qc.invalidateQueries({ queryKey: ['app-juridico-pagos'] });
              qc.invalidateQueries({ queryKey: ['app-juridico-timeline'] });
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info('Exportación en desarrollo')}>
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* DDL Pending Banner */}
      {!isLoading && !hasAppJuridico && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Portal Jurídico requiere ejecutar el DDL pendiente</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Las tablas <span className="font-mono">perfiles_juridicos</span>, <span className="font-mono">asignaciones_juridico</span> y relacionadas no existen aún.
              Ejecuta los pasos AJ-2 a AJ-11 en{' '}
              <span className="font-mono">Ejecuciones_manuales/resultado_ejecucion_app_notaria_app_juridico.md</span>.
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Las demandas existentes se muestran{hasAj1Cols ? ' con todos los datos' : ' con datos base (sin penalización ni fechas jurídicas — ejecuta AJ-1 para habilitarlos)'}.
            </p>
          </div>
        </div>
      )}

      {/* Inline error (non-fatal) */}
      {inlineError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">Error en consulta: {inlineError}</p>
        </div>
      )}

      {/* Admin abogado selector */}
      {isAdmin && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex-wrap">
          <span className="text-xs font-medium text-amber-800 shrink-0">Vista administrador — Selecciona un abogado:</span>
          <Select value={adminAbogadoId ? String(adminAbogadoId) : 'all'} onValueChange={v => setAdminAbogadoId(v === 'all' ? null : Number(v))}>
            <SelectTrigger className="h-8 text-xs w-[280px] bg-white border-amber-300">
              <SelectValue placeholder="Todos los casos (sin filtro)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los casos</SelectItem>
              {abogadosList.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.nombre_completo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Proyecto */}
        <Select value={proyectoId || 'todos'} onValueChange={v => setProyectoId(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proyectos</SelectItem>
            {proyectos.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Estatus */}
        <Select value={statusFilter || 'todos'} onValueChange={v => setStatusFilter(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Estatus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estatus</SelectItem>
            <SelectItem value="EN_REVISION">En revisión</SelectItem>
            <SelectItem value="DEMANDA_PRESENTADA">Demanda presentada</SelectItem>
            <SelectItem value="EN_NEGOCIACION">En negociación</SelectItem>
            <SelectItem value="ACUERDO">Acuerdo</SelectItem>
            <SelectItem value="RESUELTA">Resuelta</SelectItem>
            <SelectItem value="CERRADA">Cerrada</SelectItem>
            <SelectItem value="RIESGO_ALTO">Riesgo alto</SelectItem>
          </SelectContent>
        </Select>

        {/* Etapa pipeline */}
        {hasProcesoCol && (
          <Select value={etapaFilter || 'todas'} onValueChange={v => setEtapaFilter(v === 'todas' ? '' : v)}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las etapas</SelectItem>
              <SelectItem value="notificacion">Notificación</SelectItem>
              <SelectItem value="regularizacion">Regularización</SelectItem>
              <SelectItem value="presentacion">Presentación juzgado</SelectItem>
              <SelectItem value="admision">Admisión</SelectItem>
              <SelectItem value="emplazamiento">Emplazamiento</SelectItem>
              <SelectItem value="audiencia">Audiencia</SelectItem>
              <SelectItem value="sentencia">Sentencia/Acuerdo</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Solo vencidos toggle */}
        {hasProcesoCol && (
          <button
            onClick={() => setSoloVencidos(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
              soloVencidos
                ? 'bg-red-50 text-red-700 border-red-300'
                : 'bg-background text-muted-foreground border-border hover:bg-muted/30',
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {soloVencidos ? 'Mostrando vencidos' : 'Solo vencidos'}
          </button>
        )}

        {/* Buscador */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por unidad, cliente, ID cuenta o expediente..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-8 px-2 rounded-md hover:bg-muted/30">
            <X className="h-3 w-3" /> Limpiar
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="flex gap-3 flex-wrap">
        {[
          { key: 'total',       label: 'Casos asignados',          count: kpis.total,          color: 'bg-emerald-500', icon: <Scale          className="h-4 w-4 text-white" /> },
          { key: 'activos',     label: 'Demandas activas',          count: kpis.activos,        color: 'bg-blue-500',    icon: <FileText       className="h-4 w-4 text-white" /> },
          { key: 'riesgo',      label: 'Riesgo alto',               count: kpis.riesgoAlto,     color: 'bg-red-500',     icon: <AlertTriangle  className="h-4 w-4 text-white" /> },
          { key: 'negociacion', label: 'En negociación',            count: kpis.negociacion,    color: 'bg-amber-500',   icon: <HeartHandshake className="h-4 w-4 text-white" /> },
          { key: 'resueltas',   label: 'Resueltas',                 count: kpis.resueltas,      color: 'bg-green-500',   icon: <CheckCircle2   className="h-4 w-4 text-white" /> },
          { key: 'penalty',     label: 'Monto total penalización',  value: fmtMxn(kpis.totalPenalty), color: 'bg-orange-500', icon: <FileText className="h-4 w-4 text-white" /> },
          { key: 'audiencias',  label: 'Audiencias próximas',       count: kpis.audiencias,     color: 'bg-cyan-500',    icon: <CalendarDays   className="h-4 w-4 text-white" /> },
          { key: 'docs',        label: 'Documentos pendientes',     count: kpis.docsPendientes, color: 'bg-purple-500',  icon: <Upload         className="h-4 w-4 text-white" /> },
        ].map(kpi => (
          <KpiCard key={kpi.key} icon={kpi.icon} label={kpi.label} count={kpi.count} value={kpi.value}
            colorCls={kpi.color} active={kpiFilter === kpi.key}
            onClick={() => setKpiFilter(prev => prev === kpi.key ? '' : kpi.key)} />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter || 'todos'} onValueChange={v => setStatusFilter(v === 'todos' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[160px]"><SelectValue placeholder="Estatus: Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Estatus: Todos</SelectItem>
            {(Object.keys(STATUS_META) as LegalCaseStatus[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(hasFilters || kpiFilter) && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-8 px-2 rounded-md hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Table + Panel */}
      <div className="flex gap-4 items-start">

        {/* Table */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-sm font-semibold">Casos asignados a mi perfil jurídico</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLoading ? 'Cargando...' : `${filteredRows.length} registros${allRows.length !== filteredRows.length ? ` de ${allRows.length}` : ''}`}
              </p>
            </div>

            {isLoading ? (
              <table className="w-full text-sm">
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                </tbody>
              </table>
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Scale className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground text-center max-w-sm px-4">
                  {allRows.length === 0 && !hasAppJuridico
                    ? 'Sin tablas jurídicas. Ejecuta el DDL pendiente para empezar a asignar demandas.'
                    : allRows.length === 0
                      ? 'No tienes demandas asignadas. Cuando SOZU te asigne un caso, aparecerá aquí.'
                      : 'Sin resultados con los filtros aplicados'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Proyecto', 'Unidad — Cliente', 'Estatus', 'Precio de Venta', 'Pagado', 'Por Pagar', '% Pen.', 'Penalización $', 'Observaciones', 'Etapa', 'Días rest.', 'Acciones'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <tr key={row.demandaId}
                      onClick={() => { setSelectedRow(row); setDetailTab('resumen'); }}
                      className={cn(
                        'border-b border-border cursor-pointer transition-colors',
                        idx % 2 === 0 ? 'bg-white' : 'bg-muted/10',
                        selectedRow?.demandaId === row.demandaId
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : 'hover:bg-muted/20',
                      )}
                    >
                      {/* Proyecto */}
                      <td className="px-3 py-3">
                        <p className="font-medium text-sm leading-tight text-primary">{row.proyectoNombre}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{row.accountCode}</p>
                      </td>
                      {/* Unidad — Cliente */}
                      <td className="px-3 py-3">
                        <p className="font-semibold text-sm">{row.unitCode}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[140px]">{row.clienteName}</p>
                        {/* Alerta regularización vencida */}
                        {hasProcesoCol && row.fechaLimiteRegularizacion &&
                          row.estatusRegularizacion !== 'REGULARIZADO' &&
                          new Date(row.fechaLimiteRegularizacion) < new Date() && (
                          <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded-full border border-red-200">
                            <AlertTriangle className="h-2.5 w-2.5" /> Reg. vencida
                          </span>
                        )}
                      </td>
                      {/* Estatus */}
                      <td className="px-3 py-3"><StatusBadge status={row.lawsuitStatus} /></td>
                      {/* Precio de Venta */}
                      <td className="px-3 py-3 text-right tabular-nums font-medium">{fmtMxn(row.finalSalePrice)}</td>
                      {/* Pagado */}
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-600 font-medium">{fmtMxn(row.paidAmount)}</td>
                      {/* Por Pagar */}
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.pendingAmount > 0
                          ? <span className="text-red-600 font-medium">{fmtMxn(row.pendingAmount)}</span>
                          : <span className="text-emerald-600 font-medium">$0</span>}
                      </td>
                      {/* % Penalización */}
                      <td className="px-3 py-3 text-center">
                        <span className={cn('text-xs font-semibold tabular-nums', row.penaltyPct > 10 ? 'text-red-600' : 'text-slate-700')}>
                          {row.penaltyPct > 0 ? `${row.penaltyPct}%` : '—'}
                        </span>
                      </td>
                      {/* Penalización $ = precioVenta × pct / 100 */}
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.penaltyPct > 0
                          ? <span className="text-orange-600 font-semibold text-xs">{fmtMxn(row.penaltyAmount)}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      {/* Observaciones */}
                      <td className="px-3 py-3 max-w-[160px]">
                        <p className="text-xs text-muted-foreground line-clamp-2">{row.observations || '—'}</p>
                      </td>
                      {/* Etapa */}
                      <td className="px-3 py-3 text-center">
                        {hasProcesoCol ? (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {row.fechaSentencia ? 'Sentencia'
                              : row.fechaAudienciaProceso ? 'Audiencia'
                              : row.fechaEmplazamiento ? 'Emplazamiento'
                              : row.fechaAdmision ? 'Admisión'
                              : row.fechaPresentacionDemanda ? 'Presentación'
                              : row.fechaNotificacion ? 'Regularización'
                              : '—'}
                          </span>
                        ) : <span className="text-[11px] text-muted-foreground/40">—</span>}
                      </td>
                      {/* Días restantes regularización */}
                      <td className="px-3 py-3 text-center tabular-nums">
                        {hasProcesoCol && row.fechaLimiteRegularizacion && row.estatusRegularizacion === 'EN_ESPERA' ? (() => {
                          const d = Math.ceil((new Date(row.fechaLimiteRegularizacion).getTime() - Date.now()) / 86400000);
                          return <span className={cn('text-xs font-semibold', d < 0 ? 'text-red-600' : d <= 5 ? 'text-amber-600' : 'text-slate-600')}>{d < 0 ? `${d}d` : `${d}d`}</span>;
                        })() : <span className="text-[11px] text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={e => { e.stopPropagation(); setSelectedRow(row); setDetailTab('resumen'); }}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedRow && (
          <div className="w-[360px] shrink-0 bg-white border border-border rounded-xl flex flex-col sticky top-[72px] max-h-[calc(100vh-100px)] overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold leading-tight">{selectedRow.unitCode}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedRow.proyectoNombre}</p>
                  <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">{selectedRow.accountCode}</p>
                </div>
                <button onClick={() => setSelectedRow(null)} className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2"><StatusBadge status={selectedRow.lawsuitStatus} /></div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0 overflow-x-auto">
              {(['resumen', 'documentos', 'bitacora', 'audiencias', 'acuerdos', 'proceso'] as const).map(tab => (
                <button key={tab} onClick={() => {
                  setDetailTab(tab);
                  if (tab === 'proceso') loadProcesoFromRow(selectedRow);
                }}
                  className={cn(
                    'flex-1 min-w-[52px] py-2 text-[11px] font-medium transition-colors whitespace-nowrap px-1',
                    detailTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
                  )}>
                  {tab === 'resumen' ? 'Resumen'
                    : tab === 'documentos' ? `Docs (${selectedRow.docsCount})`
                    : tab === 'bitacora'   ? 'Bitácora'
                    : tab === 'audiencias' ? `Aud. (${selectedAudiencias.length})`
                    : tab === 'acuerdos'   ? `Acuerdos (${selectedAcuerdos.length})`
                    : <span className="flex items-center gap-1">Proceso {selectedRow.fechaNotificacion && <span className="size-1.5 rounded-full bg-primary inline-block" />}</span>}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {detailTab === 'resumen' && (
                <>
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Información general</h3>
                    <dl className="space-y-1.5">
                      {[
                        ['Cliente',             selectedRow.clienteName],
                        ['ID Cuenta',           selectedRow.accountCode],
                        ['Abogado responsable', selectedRow.responsable ?? '—'],
                        ['Fecha contrato',      fmtDate(selectedRow.contractDate)],
                        ['Fecha entrega',       fmtDate(selectedRow.deliveryDate)],
                        ['Fecha límite resp.',  fmtDate(selectedRow.responseDeadline)],
                        ['Próxima audiencia',   fmtDate(selectedRow.nextHearingDate)],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between gap-3">
                          <dt className="text-xs text-muted-foreground shrink-0">{l}</dt>
                          <dd className="text-xs font-medium text-right">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Información financiera</h3>
                    <dl className="space-y-1.5">
                      {[
                        ['Precio final venta',  fmtMxn(selectedRow.finalSalePrice)],
                        ['Pagado',              fmtMxn(selectedRow.paidAmount)],
                        ['Por cobrar',          fmtMxn(selectedRow.pendingAmount)],
                        ['% penalidad',         selectedRow.penaltyPct > 0 ? `${selectedRow.penaltyPct}%` : '—'],
                        ['Monto penalización',  selectedRow.penaltyAmount > 0 ? fmtMxn(selectedRow.penaltyAmount) : '—'],
                        ['Monto reclamado',     selectedRow.montoReclamado ? fmtMxn(selectedRow.montoReclamado) : '—'],
                        ['Monto negociado',     selectedRow.montoNegociado ? fmtMxn(selectedRow.montoNegociado) : '—'],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between gap-3">
                          <dt className="text-xs text-muted-foreground shrink-0">{l}</dt>
                          <dd className="text-xs font-medium text-right tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  {selectedRow.observations && (
                    <section className="space-y-1">
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Observaciones</h3>
                      <p className="text-xs text-foreground leading-relaxed">{selectedRow.observations}</p>
                    </section>
                  )}

                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acciones rápidas</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Cambiar estatus',      icon: Send,          action: () => handleAction('status', selectedRow) },
                        { label: 'Agregar observación',  icon: MessageSquare, action: () => handleAction('observation', selectedRow) },
                        { label: 'Actualizar % penalidad', icon: FileText,    action: () => handleAction('penalty', selectedRow) },
                        { label: 'Registrar audiencia',  icon: CalendarDays,  action: () => handleAction('audiencia', selectedRow) },
                        { label: 'Registrar acuerdo',    icon: HeartHandshake,action: () => handleAction('acuerdo', selectedRow) },
                        { label: 'Subir documento',      icon: Upload,        action: () => toast.info('Requiere DDL app_juridico_documentos + Storage configurado', { duration: 4000 }) },
                        { label: 'Descargar expediente', icon: Download,      action: () => navigate(`/admin/portal-escrituracion/expedientes?cuenta=${selectedRow.accountId}`) },
                        {
                          label: 'Marcar como resuelto',
                          icon: CheckCircle2,
                          action: () => {
                            if (['RESUELTA','CERRADA'].includes(selectedRow.lawsuitStatus)) {
                              toast.info('El caso ya está resuelto');
                              return;
                            }
                            markResolved({ demandaId: selectedRow.demandaId });
                          },
                        },
                      ].map(({ label, icon: Icon, action }) => (
                        <button key={label} onClick={action}
                          disabled={markingResolved}
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-border text-xs text-foreground hover:bg-muted transition-colors text-left disabled:opacity-50">
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="leading-tight">{label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {detailTab === 'documentos' && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Documentos del caso</h3>
                  {selectedRow.docsCount === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Sin documentos cargados</p>
                      {!hasAppJuridico && <p className="text-[11px] text-muted-foreground/60 mt-1">Ejecuta AJ-4 para habilitar subida de documentos</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{selectedRow.docsCount} documentos</p>
                  )}
                  <button
                    onClick={() => toast.info('Requiere DDL app_juridico_documentos + Storage configurado', { duration: 4000 })}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-primary/40 text-sm text-primary hover:bg-primary/5 transition-colors">
                    <Upload className="h-4 w-4" /> Subir documento
                  </button>
                </section>
              )}

              {detailTab === 'bitacora' && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Bitácora del caso</h3>
                  {selectedTimeline.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Sin eventos en la bitácora</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedTimeline.map((ev: any) => (
                        <div key={ev.id} className="flex gap-3">
                          <div className="shrink-0 mt-1.5"><div className="h-2 w-2 rounded-full bg-primary" /></div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{ev.tipo_evento?.replace(/_/g, ' ')}</p>
                            {ev.descripcion && <p className="text-xs text-muted-foreground mt-0.5">{ev.descripcion}</p>}
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{ev.creado_por} · {fmtDate(ev.fecha_creacion)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => handleAction('observation', selectedRow)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Agregar observación
                  </button>
                </section>
              )}

              {detailTab === 'audiencias' && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Audiencias</h3>
                  {selectedAudiencias.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Sin audiencias registradas</p>
                      {!hasAppJuridico && <p className="text-[11px] text-muted-foreground/60 mt-1">Ejecuta DDL AJ-5 para habilitar</p>}
                    </div>
                  ) : selectedAudiencias.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">{fmtDate(a.fecha)}</p>
                        {a.hora_inicio && <span className="text-[11px] text-primary">{a.hora_inicio}</span>}
                      </div>
                      {a.descripcion && <p className="text-xs text-muted-foreground mt-1">{a.descripcion}</p>}
                      <span className={cn('mt-1.5 inline-flex text-[10px] px-1.5 py-0.5 rounded-full', a.estatus === 'PROGRAMADA' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600')}>
                        {a.estatus}
                      </span>
                    </div>
                  ))}
                  <button onClick={() => handleAction('audiencia', selectedRow)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Registrar audiencia
                  </button>
                </section>
              )}

              {detailTab === 'acuerdos' && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acuerdos</h3>
                  {selectedAcuerdos.length === 0 ? (
                    <div className="text-center py-8">
                      <HeartHandshake className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Sin acuerdos registrados</p>
                      {!hasAppJuridico && <p className="text-[11px] text-muted-foreground/60 mt-1">Ejecuta DDL AJ-6 para habilitar</p>}
                    </div>
                  ) : selectedAcuerdos.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{a.tipo_acuerdo}</span>
                        <span className="text-[11px] text-muted-foreground">{fmtDate(a.fecha_acuerdo)}</span>
                      </div>
                      {a.descripcion && <p className="text-xs text-muted-foreground mt-1">{a.descripcion}</p>}
                      {a.monto_acordado && <p className="text-xs font-medium text-primary mt-1">{fmtMxn(Number(a.monto_acordado))}</p>}
                    </div>
                  ))}
                  <button onClick={() => handleAction('acuerdo', selectedRow)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Registrar acuerdo
                  </button>
                </section>
              )}

              {/* ── Proceso de demanda ── */}
              {detailTab === 'proceso' && (() => {
                const today = new Date();
                const regVencida = !!selectedRow.fechaNotificacion
                  && selectedRow.estatusRegularizacion !== 'REGULARIZADO'
                  && !!selectedRow.fechaLimiteRegularizacion
                  && today > new Date(selectedRow.fechaLimiteRegularizacion);

                const diasRestantes = selectedRow.fechaLimiteRegularizacion && selectedRow.estatusRegularizacion === 'EN_ESPERA'
                  ? Math.ceil((new Date(selectedRow.fechaLimiteRegularizacion).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <section className="space-y-4">
                    {!hasProcesoCol && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800">
                          DDL pendiente. Ejecuta <span className="font-mono">AJ-P1</span> en{' '}
                          <span className="font-mono">app_juridico_proceso_demanda_ddl.md</span> para habilitar este módulo.
                        </p>
                      </div>
                    )}

                    {regVencida && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-700">Regularización vencida</p>
                          <p className="text-[11px] text-red-600 mt-0.5">Plazo expirado el {fmtDate(selectedRow.fechaLimiteRegularizacion)}. Proceder con demanda.</p>
                        </div>
                      </div>
                    )}

                    {diasRestantes !== null && !regVencida && diasRestantes <= 5 && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 font-medium">Quedan {diasRestantes} días para regularizar</p>
                      </div>
                    )}

                    {/* Timeline visual */}
                    <div className="space-y-2">
                      {[
                        {
                          step: 1, key: 'notificacion', label: 'Notificación', Icon: Bell,
                          fecha: selectedRow.fechaNotificacion,
                          badge: selectedRow.tipoNotificacion,
                          done: !!selectedRow.fechaNotificacion,
                          actionType: 'notificacion' as ActionType,
                          actionLabel: 'Registrar notificación',
                        },
                        {
                          step: 2, key: 'regularizacion', label: 'Regularización', Icon: Shield,
                          fecha: selectedRow.fechaLimiteRegularizacion,
                          badge: selectedRow.estatusRegularizacion,
                          done: selectedRow.estatusRegularizacion === 'REGULARIZADO',
                          actionType: 'regularizacion' as ActionType,
                          actionLabel: selectedRow.estatusRegularizacion === 'REGULARIZADO' ? 'Regularizado ✓' : 'Marcar regularizado',
                        },
                        {
                          step: 3, key: 'presentacion', label: 'Presentación juzgado', Icon: FileBadge,
                          fecha: selectedRow.fechaPresentacionDemanda,
                          badge: selectedRow.estatusAdmisionJuzgado,
                          done: ['PRESENTADA','ADMITIDA'].includes(selectedRow.estatusAdmisionJuzgado),
                          actionType: 'proc_demanda' as ActionType,
                          actionLabel: 'Registrar presentación',
                        },
                        {
                          step: 4, key: 'admision', label: 'Admisión', Icon: Building2,
                          fecha: selectedRow.fechaAdmision,
                          badge: selectedRow.estatusAdmisionJuzgado === 'ADMITIDA' ? 'ADMITIDA' : undefined,
                          done: selectedRow.estatusAdmisionJuzgado === 'ADMITIDA',
                          actionType: 'admision' as ActionType,
                          actionLabel: 'Registrar admisión',
                        },
                        {
                          step: 5, key: 'emplazamiento', label: 'Emplazamiento', Icon: Send,
                          fecha: selectedRow.fechaEmplazamiento,
                          badge: selectedRow.estatusEmplazamiento,
                          done: selectedRow.estatusEmplazamiento === 'REALIZADO',
                          actionType: 'emplazamiento' as ActionType,
                          actionLabel: 'Registrar emplazamiento',
                        },
                        {
                          step: 6, key: 'contestacion', label: 'Contestación', Icon: MessageSquare,
                          fecha: selectedRow.fechaContestacionDemanda,
                          badge: selectedRow.fechaContestacionDemanda ? 'RECIBIDA' : undefined,
                          done: !!selectedRow.fechaContestacionDemanda,
                          actionType: 'contestacion' as ActionType,
                          actionLabel: 'Registrar contestación',
                        },
                        {
                          step: 7, key: 'audiencia', label: 'Audiencia', Icon: CalendarDays,
                          fecha: selectedRow.fechaAudienciaProceso,
                          badge: selectedRow.fechaAudienciaProceso ? 'PROGRAMADA' : undefined,
                          done: !!selectedRow.fechaAudienciaProceso,
                          actionType: 'audiencia_proc' as ActionType,
                          actionLabel: 'Registrar audiencia',
                        },
                        {
                          step: 8, key: 'sentencia', label: 'Sentencia / Acuerdo', Icon: Gavel,
                          fecha: selectedRow.fechaSentencia,
                          badge: selectedRow.resultadoProceso !== 'EN_PROCESO' ? selectedRow.resultadoProceso : undefined,
                          done: ['ACUERDO','SENTENCIA_FAVORABLE','SENTENCIA_DESFAVORABLE','CERRADO'].includes(selectedRow.resultadoProceso),
                          actionType: 'sentencia' as ActionType,
                          actionLabel: 'Registrar sentencia/acuerdo',
                        },
                      ].map(({ step, label, Icon, fecha, badge, done, actionType, actionLabel }, idx, arr) => (
                        <div key={label} className="relative pl-8">
                          {idx < arr.length - 1 && (
                            <div className={cn('absolute left-[15px] top-7 w-px h-full', done ? 'bg-primary/40' : 'bg-border')} />
                          )}
                          <div className={cn(
                            'absolute left-0 top-1 flex items-center justify-center h-7 w-7 rounded-full border-2 text-[10px] font-bold',
                            done ? 'bg-primary border-primary text-white' : 'bg-white border-border text-muted-foreground',
                          )}>
                            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
                          </div>
                          <div className="bg-white border border-border rounded-lg p-2.5 mb-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className={cn('text-xs font-semibold', done ? 'text-foreground' : 'text-muted-foreground')}>{step}. {label}</p>
                                {fecha && <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(fecha)}</p>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {badge && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                    {badge.replace(/_/g, ' ')}
                                  </span>
                                )}
                                <button
                                  disabled={!hasProcesoCol || savingProceso}
                                  onClick={() => { openAction(actionType, selectedRow); }}
                                  className={cn(
                                    'text-[10px] px-2 py-1 rounded-md transition-colors',
                                    done ? 'bg-muted text-muted-foreground hover:bg-muted/80' : 'bg-primary text-white hover:bg-primary/90',
                                    'disabled:opacity-40 disabled:cursor-not-allowed',
                                  )}
                                >
                                  {done ? 'Editar' : 'Registrar'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Observaciones jurídicas */}
                    {selectedRow.observacionesJuridicas && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Observaciones jurídicas</p>
                        <p className="text-xs text-foreground leading-relaxed">{selectedRow.observacionesJuridicas}</p>
                      </div>
                    )}

                    {/* Resultado final */}
                    {selectedRow.resultadoProceso && selectedRow.resultadoProceso !== 'EN_PROCESO' && (
                      <div className={cn(
                        'flex items-center gap-2 rounded-xl px-3 py-2.5 border',
                        selectedRow.resultadoProceso === 'SENTENCIA_FAVORABLE' ? 'bg-emerald-50 border-emerald-200' :
                        selectedRow.resultadoProceso === 'ACUERDO' ? 'bg-purple-50 border-purple-200' :
                        'bg-slate-50 border-slate-200',
                      )}>
                        <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-semibold">Resultado: {selectedRow.resultadoProceso.replace(/_/g, ' ')}</p>
                          {selectedRow.fechaSentencia && <p className="text-[11px] text-muted-foreground">{fmtDate(selectedRow.fechaSentencia)}</p>}
                        </div>
                      </div>
                    )}

                    {/* Acciones rápidas proceso */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acciones proceso</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { label: 'Subir documento',        icon: Upload,      action: () => toast.info('Ejecuta DDL AJ-P2 para habilitar documentos del proceso', { duration: 4000 }) },
                          { label: 'Obs. jurídicas',         icon: ScrollText,  action: () => { openAction('notificacion', selectedRow); } },
                        ].map(({ label, icon: Icon, action }) => (
                          <button key={label} onClick={action}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted transition-colors text-left">
                            <Icon className="h-3 w-3 text-primary shrink-0" />
                            <span className="leading-tight">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })()}
            </div>

            <div className="p-4 border-t border-border shrink-0">
              <Button className="w-full gap-2" onClick={() => navigate('/admin/portal-escrituracion/demandas')}>
                Ir a Demandas <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Action Dialog ────────────────────────────────────────────────────── */}
      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeAction}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>

            {/* Status change */}
            {action.type === 'status' && (
              <>
                <h2 className="text-sm font-bold mb-1">Cambiar estatus de la demanda</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <Select value={actionInput} onValueChange={setActionInput}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar estatus" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_META) as LegalCaseStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!actionInput || changingStatus}
                    onClick={() => changeStatus({ demandaId: action.row.demandaId, newStatus: actionInput as LegalCaseStatus })}>
                    {changingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                  </Button>
                </div>
              </>
            )}

            {/* Observation */}
            {action.type === 'observation' && (
              <>
                <h2 className="text-sm font-bold mb-1">Agregar observación</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <textarea
                  ref={actionRef as any}
                  value={actionInput} onChange={e => setActionInput(e.target.value)}
                  rows={4} autoFocus
                  placeholder="Escribe la observación..."
                  className="w-full text-sm border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!actionInput.trim() || savingObs}
                    onClick={() => saveObservation({ demandaId: action.row.demandaId, text: actionInput.trim() })}>
                    {savingObs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                  </Button>
                </div>
              </>
            )}

            {/* Penalty */}
            {action.type === 'penalty' && (
              <>
                <h2 className="text-sm font-bold mb-1">Actualizar % penalidad</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — Precio final: {fmtMxn(action.row.finalSalePrice)}</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min={0} max={20} step={0.5}
                    value={actionInput} onChange={e => setActionInput(e.target.value)}
                    className="flex-1 text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-sm font-medium text-muted-foreground">%</span>
                </div>
                {actionInput && Number(actionInput) >= 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Monto penalización: <span className="font-semibold text-foreground">{fmtMxn(action.row.finalSalePrice * (Number(actionInput) / 100))}</span>
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={actionInput === '' || savingPenalty}
                    onClick={() => savePenalty({ demandaId: action.row.demandaId, pct: Number(actionInput), finalSalePrice: action.row.finalSalePrice })}>
                    {savingPenalty ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                  </Button>
                </div>
              </>
            )}

            {/* Audiencia */}
            {action.type === 'audiencia' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar audiencia</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha *</label>
                    <input type="date" value={actionInput} onChange={e => setActionInput(e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Descripción</label>
                    <textarea value={actionInput2} onChange={e => setActionInput2(e.target.value)} rows={3}
                      placeholder="Detalles de la audiencia..."
                      className="w-full text-sm border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!actionInput || addingAudiencia}
                    onClick={() => addAudiencia({ demandaId: action.row.demandaId, fecha: actionInput, descripcion: actionInput2 })}>
                    {addingAudiencia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* Acuerdo */}
            {action.type === 'acuerdo' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar acuerdo</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo *</label>
                    <Select value={actionInput} onValueChange={setActionInput}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                      <SelectContent>
                        {TIPO_ACUERDO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Descripción *</label>
                    <textarea value={actionInput2} onChange={e => setActionInput2(e.target.value)} rows={3}
                      placeholder="Describe el acuerdo..."
                      className="w-full text-sm border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha del acuerdo *</label>
                    <input type="date" value={actionInput3} onChange={e => setActionInput3(e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!actionInput || !actionInput2.trim() || !actionInput3 || addingAcuerdo}
                    onClick={() => addAcuerdo({ demandaId: action.row.demandaId, tipo: actionInput, descripcion: actionInput2.trim(), fecha: actionInput3 })}>
                    {addingAcuerdo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Notificación ── */}
            {action.type === 'notificacion' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar notificación</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo de notificación *</label>
                    <Select value={procesoForm.tipoNotificacion} onValueChange={v => setPF('tipoNotificacion', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPO_NOTIFICACION_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha de notificación *</label>
                    <input type="date" value={procesoForm.fechaNotificacion} onChange={e => setPF('fechaNotificacion', e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Días para regularizar *</label>
                    <input type="number" min={1} max={90} value={procesoForm.diasRegularizacion} onChange={e => setPF('diasRegularizacion', e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                    {procesoForm.fechaNotificacion && Number(procesoForm.diasRegularizacion) > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Límite: {fmtDate(new Date(new Date(procesoForm.fechaNotificacion).getTime() + Number(procesoForm.diasRegularizacion) * 86400000).toISOString().slice(0,10))}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Observaciones jurídicas</label>
                    <textarea value={procesoForm.observacionesJuridicas} onChange={e => setPF('observacionesJuridicas', e.target.value)} rows={3}
                      placeholder="Notas adicionales..."
                      className="w-full text-sm border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!procesoForm.fechaNotificacion || savingProceso}
                    onClick={() => {
                      const limite = procesoForm.fechaNotificacion && Number(procesoForm.diasRegularizacion) > 0
                        ? new Date(new Date(procesoForm.fechaNotificacion).getTime() + Number(procesoForm.diasRegularizacion) * 86400000).toISOString().slice(0,10)
                        : null;
                      saveProcesoField({
                        demandaId: action.row.demandaId,
                        fields: {
                          tipo_notificacion: procesoForm.tipoNotificacion,
                          fecha_notificacion: procesoForm.fechaNotificacion,
                          dias_regularizacion: Number(procesoForm.diasRegularizacion),
                          ...(limite ? { fecha_limite_regularizacion: limite } : {}),
                          estatus_regularizacion: 'EN_ESPERA',
                          ...(procesoForm.observacionesJuridicas ? { observaciones_juridicas: procesoForm.observacionesJuridicas } : {}),
                        },
                        eventoLabel: `Notificación registrada vía ${procesoForm.tipoNotificacion} el ${fmtDate(procesoForm.fechaNotificacion)}`,
                      });
                    }}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Regularización ── */}
            {action.type === 'regularizacion' && (
              <>
                <h2 className="text-sm font-bold mb-1">Marcar regularizado</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Estatus regularización *</label>
                    <Select value={procesoForm.estatusRegularizacion} onValueChange={v => setPF('estatusRegularizacion', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ESTATUS_REG_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Observaciones</label>
                    <textarea value={procesoForm.observacionesJuridicas} onChange={e => setPF('observacionesJuridicas', e.target.value)} rows={2}
                      className="w-full text-sm border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={savingProceso}
                    onClick={() => saveProcesoField({
                      demandaId: action.row.demandaId,
                      fields: { estatus_regularizacion: procesoForm.estatusRegularizacion, ...(procesoForm.observacionesJuridicas ? { observaciones_juridicas: procesoForm.observacionesJuridicas } : {}) },
                      eventoLabel: `Regularización: ${procesoForm.estatusRegularizacion}`,
                    })}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Presentación juzgado ── */}
            {action.type === 'proc_demanda' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar presentación en juzgado</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha de presentación *</label>
                    <input type="date" value={procesoForm.fechaPresentacionDemanda} onChange={e => setPF('fechaPresentacionDemanda', e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Estatus admisión</label>
                    <Select value={procesoForm.estatusAdmisionJuzgado} onValueChange={v => setPF('estatusAdmisionJuzgado', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ESTATUS_ADMISION_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!procesoForm.fechaPresentacionDemanda || savingProceso}
                    onClick={() => saveProcesoField({
                      demandaId: action.row.demandaId,
                      fields: { fecha_presentacion_demanda: procesoForm.fechaPresentacionDemanda, estatus_admision_juzgado: procesoForm.estatusAdmisionJuzgado },
                      eventoLabel: `Demanda presentada en juzgado el ${fmtDate(procesoForm.fechaPresentacionDemanda)}`,
                    })}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Admisión ── */}
            {action.type === 'admision' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar admisión del juzgado</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha de admisión *</label>
                    <input type="date" value={procesoForm.fechaAdmision} onChange={e => setPF('fechaAdmision', e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Estatus admisión *</label>
                    <Select value={procesoForm.estatusAdmisionJuzgado} onValueChange={v => setPF('estatusAdmisionJuzgado', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ESTATUS_ADMISION_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!procesoForm.fechaAdmision || savingProceso}
                    onClick={() => saveProcesoField({
                      demandaId: action.row.demandaId,
                      fields: { fecha_admision: procesoForm.fechaAdmision, estatus_admision_juzgado: procesoForm.estatusAdmisionJuzgado },
                      eventoLabel: `Admisión ${procesoForm.estatusAdmisionJuzgado} el ${fmtDate(procesoForm.fechaAdmision)}`,
                    })}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Emplazamiento ── */}
            {action.type === 'emplazamiento' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar emplazamiento</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha de emplazamiento *</label>
                    <input type="date" value={procesoForm.fechaEmplazamiento} onChange={e => setPF('fechaEmplazamiento', e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Estatus emplazamiento *</label>
                    <Select value={procesoForm.estatusEmplazamiento} onValueChange={v => setPF('estatusEmplazamiento', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ESTATUS_EMPL_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!procesoForm.fechaEmplazamiento || savingProceso}
                    onClick={() => saveProcesoField({
                      demandaId: action.row.demandaId,
                      fields: { fecha_emplazamiento: procesoForm.fechaEmplazamiento, estatus_emplazamiento: procesoForm.estatusEmplazamiento },
                      eventoLabel: `Emplazamiento ${procesoForm.estatusEmplazamiento} el ${fmtDate(procesoForm.fechaEmplazamiento)}`,
                    })}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Contestación ── */}
            {action.type === 'contestacion' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar contestación de demanda</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha de contestación *</label>
                  <input type="date" value={procesoForm.fechaContestacionDemanda} onChange={e => setPF('fechaContestacionDemanda', e.target.value)}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!procesoForm.fechaContestacionDemanda || savingProceso}
                    onClick={() => saveProcesoField({
                      demandaId: action.row.demandaId,
                      fields: { fecha_contestacion_demanda: procesoForm.fechaContestacionDemanda },
                      eventoLabel: `Contestación recibida el ${fmtDate(procesoForm.fechaContestacionDemanda)}`,
                    })}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Audiencia ── */}
            {action.type === 'audiencia_proc' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar audiencia del proceso</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha de audiencia *</label>
                  <input type="date" value={procesoForm.fechaAudienciaProceso} onChange={e => setPF('fechaAudienciaProceso', e.target.value)}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!procesoForm.fechaAudienciaProceso || savingProceso}
                    onClick={() => saveProcesoField({
                      demandaId: action.row.demandaId,
                      fields: { fecha_audiencia_proceso: procesoForm.fechaAudienciaProceso },
                      eventoLabel: `Audiencia programada para ${fmtDate(procesoForm.fechaAudienciaProceso)}`,
                    })}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Sentencia ── */}
            {action.type === 'sentencia' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar sentencia / resultado</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha de sentencia *</label>
                    <input type="date" value={procesoForm.fechaSentencia} onChange={e => setPF('fechaSentencia', e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Resultado del proceso *</label>
                    <Select value={procesoForm.resultadoProceso} onValueChange={v => setPF('resultadoProceso', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RESULTADO_PROCESO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Observaciones jurídicas</label>
                    <textarea value={procesoForm.observacionesJuridicas} onChange={e => setPF('observacionesJuridicas', e.target.value)} rows={3}
                      className="w-full text-sm border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!procesoForm.fechaSentencia || savingProceso}
                    onClick={() => saveProcesoField({
                      demandaId: action.row.demandaId,
                      fields: {
                        fecha_sentencia: procesoForm.fechaSentencia,
                        resultado_proceso: procesoForm.resultadoProceso,
                        ...(procesoForm.observacionesJuridicas ? { observaciones_juridicas: procesoForm.observacionesJuridicas } : {}),
                      },
                      eventoLabel: `Sentencia: ${procesoForm.resultadoProceso.replace(/_/g, ' ')} el ${fmtDate(procesoForm.fechaSentencia)}`,
                    })}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Proceso: Acuerdo proceso (alias proc) ── */}
            {action.type === 'acuerdo_proc' && (
              <>
                <h2 className="text-sm font-bold mb-1">Registrar acuerdo del proceso</h2>
                <p className="text-xs text-muted-foreground mb-4">{action.row.unitCode} — {action.row.clienteName}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha del acuerdo *</label>
                    <input type="date" value={procesoForm.fechaSentencia} onChange={e => setPF('fechaSentencia', e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Observaciones</label>
                    <textarea value={procesoForm.observacionesJuridicas} onChange={e => setPF('observacionesJuridicas', e.target.value)} rows={3}
                      className="w-full text-sm border border-border rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={closeAction}>Cancelar</Button>
                  <Button className="flex-1" disabled={!procesoForm.fechaSentencia || savingProceso}
                    onClick={() => saveProcesoField({
                      demandaId: action.row.demandaId,
                      fields: {
                        resultado_proceso: 'ACUERDO',
                        ...(procesoForm.fechaSentencia ? { fecha_sentencia: procesoForm.fechaSentencia } : {}),
                        ...(procesoForm.observacionesJuridicas ? { observaciones_juridicas: procesoForm.observacionesJuridicas } : {}),
                      },
                      eventoLabel: `Acuerdo registrado el ${fmtDate(procesoForm.fechaSentencia)}`,
                    })}>
                    {savingProceso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export (wrapped with error boundary) ─────────────────────────────────────

export function AppJuridicoDashboard() {
  return (
    <AppJuridicoErrorBoundary>
      <AppJuridicoDashboardInner />
    </AppJuridicoErrorBoundary>
  );
}
