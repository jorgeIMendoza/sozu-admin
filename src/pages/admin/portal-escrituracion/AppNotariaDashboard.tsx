import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersonForm } from '@/components/admin/PersonForm';
import { NotariaExpedienteModal } from '@/components/admin/portal-notaria/NotariaExpedienteModal';
import { NotariaPagosModal } from '@/components/admin/portal-notaria/NotariaPagosModal';
import { NotariaCuentaDetalleSheet } from '@/components/admin/portal-notaria/NotariaCuentaDetalleSheet';
import { toast } from 'sonner';
import {
  Search, Download, RefreshCw, X, CheckCircle2, Clock,
  FileText, Stamp, CalendarDays, Loader2, Receipt, Upload,
  ChevronRight, MoreHorizontal, Send, MessageSquare,
  Landmark, ExternalLink, ArrowRight, LogIn, AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotaryAppStatus =
  | 'ASIGNADO' | 'EXPEDIENTE_DESCARGADO' | 'PROYECTO_EN_ELABORACION'
  | 'ENVIADO_A_VOBO_DESARROLLADOR' | 'VOBO_DESARROLLADOR_APROBADO' | 'VOBO_DESARROLLADOR_RECHAZADO'
  | 'ENVIADO_A_VOBO_BANCO' | 'VOBO_BANCO_APROBADO' | 'VOBO_BANCO_RECHAZADO'
  | 'COTIZACION_ENVIADA' | 'LISTO_PARA_FIRMA' | 'CITA_PROGRAMADA'
  | 'FIRMADO' | 'EN_REGISTRO_RPP' | 'CONCLUIDO';

type VoboStatus   = 'NO_ENVIADO' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
type VoboBancoSt  = 'NO_APLICA' | 'NO_ENVIADO' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
type CotizStatus  = 'SIN_COTIZACION' | 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'VENCIDA';
type PaymentMethod = 'RECURSOS_PROPIOS' | 'CREDITO_HIPOTECARIO' | null;

interface NotaryRow {
  cuentaId:          number;
  cuentaCode:        string;
  proyectoId:        number | null;
  proyectoNombre:    string;
  edificioNombre:    string;
  unitCode:          string;
  clienteName:       string;
  clienteEmail:      string;
  clienteRfc:        string;
  personaId:         number | null;
  paymentMethod:     PaymentMethod;
  bankName:          string | null;
  precioFinal:       number;
  montoPagado:       number;
  montoAdeudo:       number;
  fechaAsignacion:   string | null;
  estatus:           NotaryAppStatus;
  voboDev:           VoboStatus;
  voboBank:          VoboBancoSt;
  cotizacionEstatus: CotizStatus;
  cotizacionTotal:   number | null;
  urlProyectoEscrit: string | null;
  signingDate:       string | null;
  signingTime:       string | null;
  procesoId:         number | null;
  creditoId:         number | null;
  lastUpdatedAt:     string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<NotaryAppStatus, { label: string; cls: string }> = {
  ASIGNADO:                     { label: 'Asignado',             cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  EXPEDIENTE_DESCARGADO:        { label: 'Exp. descargado',      cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  PROYECTO_EN_ELABORACION:      { label: 'En elaboración',       cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ENVIADO_A_VOBO_DESARROLLADOR: { label: 'Pend. VoBo dev.',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  VOBO_DESARROLLADOR_APROBADO:  { label: 'VoBo dev. aprobado',   cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  VOBO_DESARROLLADOR_RECHAZADO: { label: 'VoBo dev. rechazado',  cls: 'bg-red-50 text-red-700 border-red-200' },
  ENVIADO_A_VOBO_BANCO:         { label: 'Pend. VoBo banco',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  VOBO_BANCO_APROBADO:          { label: 'VoBo banco aprobado',  cls: 'bg-green-50 text-green-700 border-green-200' },
  VOBO_BANCO_RECHAZADO:         { label: 'VoBo banco rechazado', cls: 'bg-red-50 text-red-700 border-red-200' },
  COTIZACION_ENVIADA:           { label: 'Cotización enviada',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  LISTO_PARA_FIRMA:             { label: 'Listo para firma',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CITA_PROGRAMADA:              { label: 'Cita programada',      cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  FIRMADO:                      { label: 'Firmado',              cls: 'bg-green-100 text-green-800 border-green-300' },
  EN_REGISTRO_RPP:              { label: 'En RPP',               cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  CONCLUIDO:                    { label: 'Concluido',            cls: 'bg-slate-100 text-slate-700 border-slate-300' },
};

const VOBO_META: Record<VoboStatus, { label: string; cls: string }> = {
  NO_ENVIADO: { label: '—',         cls: 'text-slate-400' },
  PENDIENTE:  { label: 'Pendiente', cls: 'text-amber-600' },
  APROBADO:   { label: 'Aprobado',  cls: 'text-emerald-600' },
  RECHAZADO:  { label: 'Rechazado', cls: 'text-red-600' },
};

const VOBO_BANCO_META: Record<VoboBancoSt, { label: string; cls: string }> = {
  NO_APLICA:  { label: 'N/A',       cls: 'text-slate-400' },
  NO_ENVIADO: { label: '—',         cls: 'text-slate-400' },
  PENDIENTE:  { label: 'Pendiente', cls: 'text-amber-600' },
  APROBADO:   { label: 'Aprobado',  cls: 'text-emerald-600' },
  RECHAZADO:  { label: 'Rechazado', cls: 'text-red-600' },
};

const BANK_COLORS: Record<string, string> = {
  'BBVA':        'bg-blue-600 text-white',
  'Santander':   'bg-red-600 text-white',
  'Banorte':     'bg-red-800 text-white',
  'HSBC':        'bg-red-500 text-white',
  'Citibanamex': 'bg-blue-500 text-white',
  'Scotiabank':  'bg-red-900 text-white',
  'Infonavit':   'bg-green-700 text-white',
};

const fmtMxn = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtTime = (s: string | null | undefined) =>
  s ? String(s).slice(0, 5) : '';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NotaryAppStatus }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap', m.cls)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  );
}

function BankBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-muted-foreground text-sm">—</span>;
  const cls = BANK_COLORS[name] ?? 'bg-slate-600 text-white';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold', cls)}>
      {name}
    </span>
  );
}

function PaymentBadge({ method }: { method: PaymentMethod }) {
  if (!method) return <span className="text-muted-foreground">—</span>;
  return method === 'RECURSOS_PROPIOS'
    ? <span className="text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Recursos propios</span>
    : <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Crédito hipotecario</span>;
}

function KpiCard({ icon, label, count, colorCls, active, onClick }: {
  icon: React.ReactNode; label: string; count: number;
  colorCls: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 min-w-[130px] bg-white border rounded-xl p-4 text-left transition-all hover:shadow-sm',
        active ? 'border-primary ring-1 ring-primary/20 shadow-sm' : 'border-border',
      )}
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg mb-3', colorCls)}>
        {icon}
      </div>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{count}</p>
      <p className="text-[11px] text-primary mt-1.5 flex items-center gap-0.5">
        Ver detalle <ArrowRight className="h-3 w-3" />
      </p>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AppNotariaDashboard() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isAdmin = (profile?.rol_id ?? 99) <= 2;

  // ── Modal Expediente ────────────────────────────────────────────────────────
  const [expedienteModal, setExpedienteModal] = useState<{
    open: boolean;
    cuentaId: number;
    proyecto: string;
    unidad: string;
    cuentaCode: string;
  } | null>(null);

  const handleOpenExpediente = (row: NotaryRow) => {
    setExpedienteModal({
      open: true,
      cuentaId: row.cuentaId,
      proyecto: row.proyectoNombre,
      unidad: row.unitCode,
      cuentaCode: row.cuentaCode,
    });
  };

  // ── Sheet Detalle Cuenta ────────────────────────────────────────────────────
  const [detailSheetRow, setDetailSheetRow] = useState<NotaryRow | null>(null);
  const handleOpenDetailSheet = (row: NotaryRow) => setDetailSheetRow(row);

  // ── Modal Pagos ─────────────────────────────────────────────────────────────
  const [pagosModal, setPagosModal] = useState<{
    open: boolean;
    cuentaId: number;
    proyecto: string;
    unidad: string;
    cuentaCode: string;
  } | null>(null);

  const handleOpenPagos = (row: NotaryRow) => {
    setPagosModal({
      open: true,
      cuentaId: row.cuentaId,
      proyecto: row.proyectoNombre,
      unidad: row.unitCode,
      cuentaCode: row.cuentaCode,
    });
  };

  // ── Dialog "Editar Comprador" ──────────────────────────────────────────────
  const [editPersonaId, setEditPersonaId]     = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen]   = useState(false);

  const { data: editPersonaData } = useQuery({
    queryKey: ['notaria-persona-edit', editPersonaId],
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('*').eq('id', editPersonaId).single();
      return data;
    },
    enabled: !!editPersonaId,
  });

  const updatePersonaMutation = useMutation({
    mutationFn: async (personData: any) => {
      const { entityType, representativeId, commercialRepresentativeId, inmobiliariaId,
              tempBankAccounts, tempBeneficiaries, pendingDocuments, porcentaje_comision,
              ...cleanData } = personData;
      const { error } = await supabase.from('personas').update(cleanData).eq('id', editPersonaId);
      if (error) throw error;
      if (representativeId !== undefined) {
        await supabase.from('personas')
          .update({ id_entidad_relacionada_rep_leg: representativeId || null })
          .eq('id', editPersonaId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-notaria-cuentas'] });
      setEditDialogOpen(false);
      setEditPersonaId(null);
      toast.success('Comprador actualizado correctamente.');
    },
    onError: () => toast.error('Error al actualizar el comprador.'),
  });

  // ── Filters ────────────────────────────────────────────────────────────────
  const [proyectoId,      setProyectoId]      = useState('');
  const [search,          setSearch]          = useState('');
  const [statusFilter,    setStatusFilter]    = useState('');
  const [payFilter,       setPayFilter]       = useState('');
  const [bankFilter,      setBankFilter]      = useState('');
  const [voboDevF,        setVoboDevF]        = useState('');
  const [voboBankF,       setVoboBankF]       = useState('');
  const [kpiFilter,       setKpiFilter]       = useState('');
  const [selectedRow,     setSelectedRow]     = useState<NotaryRow | null>(null);
  const [detailTab,       setDetailTab]       = useState<'resumen' | 'pipeline' | 'vobos' | 'documentos'>('resumen');
  const [adminNotarioId,  setAdminNotarioId]  = useState<number | null>(null);
  const [showRegInfo,     setShowRegInfo]     = useState(false);

  // ── Projects ───────────────────────────────────────────────────────────────
  const { data: proyectos = [] } = useQuery({
    queryKey: ['app-notaria-proyectos'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: ent } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
      if (!ent?.length) return [];
      const ids = [...new Set(ent.map(e => e.id_proyecto).filter(Boolean))] as number[];
      const { data } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .in('id', ids)
        .eq('publicar', true)
        .eq('activo', true)
        .order('nombre');
      return data ?? [];
    },
  });

  // ── Notarios list (admin only, for selector) ───────────────────────────────
  const { data: notariosList = [] } = useQuery({
    queryKey: ['app-notaria-notarios-list'],
    enabled: isAdmin,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('notarios')
        .select('id, nombre, notaria')
        .eq('activo', true)
        .eq('trabaja_con_sozu', true)
        .order('notaria');
      return (data ?? []) as { id: number; nombre: string; notaria: string }[];
    },
  });

  // Para usuarios notario: id_notario viene directo del perfil (post-DDL PASO 8/9)
  const notarioId   = isAdmin ? adminNotarioId : (profile?.id_notario ?? null);
  const notariaNombre = isAdmin
    ? (notariosList.find(n => n.id === adminNotarioId)?.notaria ?? null)
    : (profile?.notaria_nombre ?? null);
  const canView     = isAdmin || !!profile?.id_notario;

  // ── Accounts — waterfall flat queries (avoids PostgREST embedded-join issues) ──
  const { data: rawCuentas = [], isLoading: loadingCuentas, refetch: refetchAll, isError: cuentasIsError, error: cuentasError } = useQuery({
    queryKey: ['app-notaria-cuentas', notarioId, isAdmin],
    enabled: canView && (isAdmin ? adminNotarioId !== null : true),
    queryFn: async () => {
      if (!notarioId) return [];

      // 1. Flat cuentas — filter only by id_notario, no embedded joins
      // Note: 'saldo' is not a column in cuentas_cobranza (it's only in a view)
      console.debug('[AppNotaria] querying id_notario =', notarioId);
      const { data: cuentasRaw, error: cuentasErr } = await (supabase as any)
        .from('cuentas_cobranza')
        .select('id, id_propiedad, id_notario, precio_final, fecha_compra, fecha_actualizacion, numero_escritura, fecha_escritura, activo')
        .eq('activo', true)
        .eq('id_notario', notarioId)
        .order('fecha_actualizacion', { ascending: false });

      if (cuentasErr) {
        console.error('[AppNotaria] cuentas error:', cuentasErr.message);
        throw new Error(cuentasErr.message);
      }
      console.debug('[AppNotaria] cuentas encontradas:', cuentasRaw?.length ?? 0);
      if (!cuentasRaw?.length) return [];

      const propIds    = [...new Set(cuentasRaw.map((c: any) => c.id_propiedad).filter(Boolean))] as number[];
      const cuentaIds_ = cuentasRaw.map((c: any) => c.id) as number[];

      // 2. Propiedades
      const { data: props } = await supabase
        .from('propiedades')
        .select('id, numero_propiedad, id_edificio_modelo')
        .in('id', propIds);
      const propMap: Record<number, any> = {};
      for (const p of props ?? []) propMap[p.id] = p;

      // 3. Edificios_modelos
      const modeloIds = [...new Set((props ?? []).map((p: any) => p.id_edificio_modelo).filter(Boolean))] as number[];
      const { data: modelos } = await supabase
        .from('edificios_modelos')
        .select('id, id_edificio')
        .in('id', modeloIds);
      const modeloMap: Record<number, any> = {};
      for (const m of modelos ?? []) modeloMap[m.id] = m;

      // 4. Edificios
      const edificioIds = [...new Set((modelos ?? []).map((m: any) => m.id_edificio).filter(Boolean))] as number[];
      const { data: edificios } = await supabase
        .from('edificios')
        .select('id, nombre, id_proyecto')
        .in('id', edificioIds);
      const edificioMap: Record<number, any> = {};
      for (const e of edificios ?? []) edificioMap[e.id] = e;

      // 5. Proyectos
      const proyectoIds = [...new Set((edificios ?? []).map((e: any) => e.id_proyecto).filter(Boolean))] as number[];
      const { data: proyectos_ } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .in('id', proyectoIds);
      const proyectoMap: Record<number, any> = {};
      for (const p of proyectos_ ?? []) proyectoMap[p.id] = p;

      // 6. Compradores
      const { data: compradores } = await supabase
        .from('compradores')
        .select('id_cuenta_cobranza, id_persona, activo')
        .in('id_cuenta_cobranza', cuentaIds_)
        .eq('activo', true);

      // 7. Personas
      const personaIds = [...new Set((compradores ?? []).map((c: any) => c.id_persona).filter(Boolean))] as number[];
      const { data: personas } = await supabase
        .from('personas')
        .select('id, nombre_legal, nombre_comercial, email, rfc')
        .in('id', personaIds);
      const personaMap: Record<number, any> = {};
      for (const p of personas ?? []) personaMap[p.id] = p;

      // Primary comprador per cuenta
      const compByCuenta: Record<number, any> = {};
      for (const c of compradores ?? []) {
        if (!compByCuenta[c.id_cuenta_cobranza]) {
          compByCuenta[c.id_cuenta_cobranza] = {
            id_persona: c.id_persona,
            activo:     c.activo,
            personas:   personaMap[c.id_persona] ?? null,
          };
        }
      }

      // Merge into shape expected by allRows useMemo
      return cuentasRaw.map((c: any) => {
        const prop    = propMap[c.id_propiedad] ?? null;
        const modelo  = prop ? modeloMap[prop.id_edificio_modelo] ?? null : null;
        const edificio = modelo ? edificioMap[modelo.id_edificio] ?? null : null;
        const proyecto = edificio ? proyectoMap[edificio.id_proyecto] ?? null : null;
        const comp    = compByCuenta[c.id] ?? null;
        return {
          ...c,
          propiedades: prop ? {
            ...prop,
            edificios_modelos: modelo ? {
              ...modelo,
              edificios: edificio ? { ...edificio, proyectos: proyecto } : null,
            } : null,
          } : null,
          compradores: comp ? [comp] : [],
        };
      });
    },
  });

  const cuentaIds = useMemo(() => rawCuentas.map((c: any) => c.id as number), [rawCuentas]);

  // propIds extraídos de las cuentas del notario
  const propIds = useMemo(
    () => [...new Set(rawCuentas.map((c: any) => c.id_propiedad).filter(Boolean))] as number[],
    [rawCuentas],
  );

  // ── Todas las cuentas de esas propiedades (incluye bodegas, estac., etc.) ──
  // Necesario para sumar el monto pagado total por propiedad, no solo el
  // de la cuenta asignada al notario.
  const { data: allPropCuentasData = [] } = useQuery({
    queryKey: ['app-notaria-all-prop-cuentas', propIds],
    enabled: propIds.length > 0,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('cuentas_cobranza')
        .select('id, id_propiedad, precio_final')
        .in('id_propiedad', propIds as any)
        .eq('activo', true);
      return (data ?? []) as any[];
    },
  });

  // IDs de TODAS las cuentas de esas propiedades
  const allCuentaIds = useMemo(
    () => allPropCuentasData.map((c: any) => c.id as number),
    [allPropCuentasData],
  );

  // cuentaId → propId (para agrupar pagos por propiedad)
  const cuentaPropMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const c of allPropCuentasData) map[c.id] = c.id_propiedad;
    return map;
  }, [allPropCuentasData]);

  // precioFinal por propiedad = suma de precio_final de todas sus cuentas
  const precioFinalByProp = useMemo(() => {
    const map: Record<number, number> = {};
    for (const c of allPropCuentasData) {
      map[c.id_propiedad] = (map[c.id_propiedad] || 0) + Number(c.precio_final || 0);
    }
    return map;
  }, [allPropCuentasData]);

  // ── Pagos por propiedad en LOTES (evita límite 1000 filas de PostgREST) ──────
  // Con 297 allCuentaIds → 3,619 pagos → una sola query devuelve solo 1,000.
  // Con lotes de 30 cuentas (30 × ~12 pagos = ~360/lote) todos los pagos se obtienen.
  const { data: pagosDirectos = [] } = useQuery({
    queryKey: ['app-notaria-pagos-direct', allCuentaIds],
    enabled: allCuentaIds.length > 0,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const BATCH = 30;
      const results: any[] = [];
      const batches: PromiseLike<any>[] = [];
      for (let i = 0; i < allCuentaIds.length; i += BATCH) {
        const slice = (allCuentaIds as number[]).slice(i, i + BATCH);
        batches.push(
          supabase.from('pagos')
            .select('id_cuenta_cobranza, monto')
            .in('id_cuenta_cobranza', slice as any)
            .eq('activo', true)
        );
      }
      const settled = await Promise.allSettled(batches);
      settled.forEach(r => {
        if (r.status === 'fulfilled') results.push(...((r.value as any).data ?? []));
      });
      return results as any[];
    },
  });

  // Suma de pagos por propiedad (agrupa principal + bodegas + estacionamientos)
  const pagosSumByProp = useMemo(() => {
    const map: Record<number, number> = {};
    for (const p of pagosDirectos) {
      const propId = cuentaPropMap[p.id_cuenta_cobranza];
      if (propId !== undefined) {
        map[propId] = (map[propId] || 0) + Number(p.monto);
      }
    }
    return map;
  }, [pagosDirectos, cuentaPropMap]);

  // Mantener acuerdos/aplicaciones solo para otras funcionalidades (no para montoPagado)
  const { data: acuerdosData = [] } = useQuery({
    queryKey: ['app-notaria-acuerdos', cuentaIds],
    enabled: cuentaIds.length > 0,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('acuerdos_pago')
        .select('id, id_cuenta_cobranza')
        .in('id_cuenta_cobranza', cuentaIds as any)
        .eq('activo', true);
      return (data ?? []) as any[];
    },
  });

  const acuerdoIds = useMemo(
    () => acuerdosData.map((a: any) => a.id as number),
    [acuerdosData],
  );

  const acuerdoCuentaMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const a of acuerdosData) map[a.id] = a.id_cuenta_cobranza;
    return map;
  }, [acuerdosData]);

  // ── Creditos hipotecarios ──────────────────────────────────────────────────
  const { data: creditosData = [] } = useQuery({
    queryKey: ['app-notaria-creditos', cuentaIds],
    enabled: cuentaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('creditos_hipotecarios')
        .select('id, id_cuenta_cobranza, id_banco, monto_credito, vobo_banco, bancos(nombre)')
        .in('id_cuenta_cobranza', cuentaIds as any)
        .eq('activo', true);
      return (data ?? []) as any[];
    },
  });

  const creditosMap = useMemo(() => {
    const map: Record<number, any> = {};
    for (const c of creditosData) map[c.id_cuenta_cobranza] = c;
    return map;
  }, [creditosData]);

  // ── app_notaria_proceso (new table, graceful fallback) ─────────────────────
  const { data: procesosData = [] } = useQuery({
    queryKey: ['app-notaria-procesos', cuentaIds],
    enabled: cuentaIds.length > 0,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('app_notaria_proceso')
          .select('*')
          .in('id_cuenta_cobranza', cuentaIds)
          .eq('activo', true);
        return (data ?? []) as any[];
      } catch (_) {
        return [];
      }
    },
  });

  const procesosMap = useMemo(() => {
    const map: Record<number, any> = {};
    for (const p of procesosData) map[p.id_cuenta_cobranza] = p;
    return map;
  }, [procesosData]);

  // ── Signing appointments ───────────────────────────────────────────────────
  const personaIds = useMemo(() =>
    rawCuentas.flatMap((c: any) =>
      (c.compradores ?? [])
        .filter((x: any) => x.activo !== false)
        .map((x: any) => x.id_persona)
        .filter(Boolean)
    ),
    [rawCuentas],
  );

  const { data: citasData = [] } = useQuery({
    queryKey: ['app-notaria-citas', personaIds],
    enabled: personaIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('reservas_citas')
        .select('id, id_persona, fecha, hora_inicio, estatus, tipos_cita(nombre)')
        .in('id_persona', personaIds as any)
        .eq('activo', true)
        .order('fecha', { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const citasMap = useMemo(() => {
    const map: Record<number, any> = {};
    for (const c of citasData) {
      if (map[c.id_persona]) continue;
      const nombre = (c.tipos_cita as any)?.nombre?.toLowerCase() ?? '';
      if (nombre.includes('firma') || nombre.includes('escritur')) {
        map[c.id_persona] = c;
      }
    }
    return map;
  }, [citasData]);

  // ── Build rows ─────────────────────────────────────────────────────────────
  const allRows: NotaryRow[] = useMemo(() => rawCuentas.map((c: any) => {
    const prop    = c.propiedades as any;
    const edif    = prop?.edificios_modelos?.edificios;
    const proy    = edif?.proyectos;
    const comps   = (c.compradores as any[]) ?? [];
    const comp    = comps.find(x => x.activo !== false) ?? comps[0];
    const persona = comp?.personas;

    const credito = creditosMap[c.id];
    const proceso = procesosMap[c.id];
    const cita    = citasMap[comp?.id_persona ?? -1];

    // Usa totales por propiedad: suma de TODAS las cuentas (bodega, estac., etc.)
    const montoPagado  = pagosSumByProp[c.id_propiedad] || 0;
    const precioFinal  = precioFinalByProp[c.id_propiedad] || Number(c.precio_final || 0);
    const montoAdeudo  = Math.max(0, precioFinal - montoPagado);
    const paymentMethod: PaymentMethod = credito ? 'CREDITO_HIPOTECARIO' : 'RECURSOS_PROPIOS';

    // Derive status: proceso table wins; fallback from available fields
    let estatus: NotaryAppStatus = 'ASIGNADO';
    if (proceso)                              estatus = proceso.estatus as NotaryAppStatus;
    else if (c.numero_escritura)              estatus = 'FIRMADO';
    else if (credito?.vobo_banco === 'APROBADO')  estatus = 'VOBO_BANCO_APROBADO';
    else if (credito?.vobo_banco === 'PENDIENTE') estatus = 'ENVIADO_A_VOBO_BANCO';

    let voboBank: VoboBancoSt = 'NO_APLICA';
    if (paymentMethod === 'CREDITO_HIPOTECARIO') {
      if (proceso?.vobo_banco)       voboBank = proceso.vobo_banco as VoboBancoSt;
      else if (credito?.vobo_banco)  voboBank = credito.vobo_banco as VoboBancoSt;
      else                           voboBank = 'NO_ENVIADO';
    }

    return {
      cuentaId:          c.id,
      cuentaCode:        `CC-${String(c.id).padStart(6, '0')}`,
      proyectoId:        proy?.id ?? null,
      proyectoNombre:    proy?.nombre ?? '—',
      edificioNombre:    edif?.nombre ?? '',
      unitCode:          prop?.numero_propiedad ?? '—',
      clienteName:       persona?.nombre_legal ?? persona?.nombre_comercial ?? '—',
      clienteEmail:      persona?.email ?? '',
      clienteRfc:        persona?.rfc ?? '',
      personaId:         comp?.id_persona ?? null,
      paymentMethod,
      bankName:          (credito?.bancos as any)?.nombre ?? null,
      precioFinal,
      montoPagado,
      montoAdeudo,
      fechaAsignacion:   proceso?.fecha_creacion ?? c.fecha_compra ?? null,
      estatus,
      voboDev:           (proceso?.vobo_desarrollador ?? 'NO_ENVIADO') as VoboStatus,
      voboBank,
      cotizacionEstatus: (proceso?.cotizacion_estatus ?? 'SIN_COTIZACION') as CotizStatus,
      cotizacionTotal:   proceso?.cotizacion_total ?? null,
      urlProyectoEscrit: proceso?.url_proyecto_escritura ?? null,
      signingDate:       cita?.fecha ?? null,
      signingTime:       cita?.hora_inicio ?? null,
      procesoId:         proceso?.id ?? null,
      creditoId:         credito?.id ?? null,
      lastUpdatedAt:     proceso?.fecha_actualizacion ?? c.fecha_actualizacion ?? null,
    } satisfies NotaryRow;
  }), [rawCuentas, pagosSumByProp, precioFinalByProp, creditosMap, procesosMap, citasMap]);

  // DEV debug
  if (import.meta.env.DEV) {
    console.debug('[AppNotaria] effectiveNotarioId', notarioId, '| rows construidas:', allRows.length);
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    asignadas:    allRows.length,
    enElab:       allRows.filter(r => ['ASIGNADO','EXPEDIENTE_DESCARGADO','PROYECTO_EN_ELABORACION'].includes(r.estatus)).length,
    pendVoboDev:  allRows.filter(r => r.voboDev === 'PENDIENTE').length,
    pendVoboBank: allRows.filter(r => r.voboBank === 'PENDIENTE').length,
    pendCotiz:    allRows.filter(r => ['SIN_COTIZACION','BORRADOR'].includes(r.cotizacionEstatus) && !['FIRMADO','CONCLUIDO'].includes(r.estatus)).length,
    citas:        allRows.filter(r => r.signingDate !== null).length,
  }), [allRows]);

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = allRows;

    if (kpiFilter === 'enElab')       rows = rows.filter(r => ['ASIGNADO','EXPEDIENTE_DESCARGADO','PROYECTO_EN_ELABORACION'].includes(r.estatus));
    else if (kpiFilter === 'pendVoboDev')  rows = rows.filter(r => r.voboDev === 'PENDIENTE');
    else if (kpiFilter === 'pendVoboBank') rows = rows.filter(r => r.voboBank === 'PENDIENTE');
    else if (kpiFilter === 'pendCotiz')    rows = rows.filter(r => ['SIN_COTIZACION','BORRADOR'].includes(r.cotizacionEstatus));
    else if (kpiFilter === 'citas')        rows = rows.filter(r => r.signingDate !== null);

    if (proyectoId && proyectoId !== 'todos') rows = rows.filter(r => String(r.proyectoId) === proyectoId);
    if (statusFilter && statusFilter !== 'todos') rows = rows.filter(r => r.estatus === statusFilter);
    if (payFilter    && payFilter    !== 'todos') rows = rows.filter(r => r.paymentMethod === payFilter);
    if (bankFilter   && bankFilter   !== 'todos') rows = rows.filter(r => r.bankName === bankFilter);
    if (voboDevF     && voboDevF     !== 'todos') rows = rows.filter(r => r.voboDev === voboDevF);
    if (voboBankF    && voboBankF    !== 'todos') rows = rows.filter(r => r.voboBank === voboBankF);

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.cuentaCode.toLowerCase().includes(q) ||
        r.unitCode.toLowerCase().includes(q) ||
        r.clienteName.toLowerCase().includes(q) ||
        r.clienteEmail.toLowerCase().includes(q) ||
        r.clienteRfc.toLowerCase().includes(q) ||
        r.proyectoNombre.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [allRows, kpiFilter, proyectoId, statusFilter, payFilter, bankFilter, voboDevF, voboBankF, search]);

  const banks = useMemo(() => [...new Set(allRows.map(r => r.bankName).filter(Boolean) as string[])].sort(), [allRows]);
  const hasFilters = !!(proyectoId && proyectoId !== 'todos') || !!statusFilter || !!payFilter || !!bankFilter || !!voboDevF || !!voboBankF || !!search;

  const clearFilters = () => {
    setProyectoId(''); setStatusFilter(''); setPayFilter(''); setBankFilter('');
    setVoboDevF(''); setVoboBankF(''); setSearch(''); setKpiFilter('');
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const procesoTableExists = async () => {
    try {
      await (supabase as any).from('app_notaria_proceso').select('id').limit(1);
      return true;
    } catch (_) {
      toast.error('Tabla app_notaria_proceso no encontrada. Ejecuta el DDL en Ejecuciones_manuales/modulo_app_notaria.md');
      return false;
    }
  };

  const handleDownloadExp = (row: NotaryRow) => handleOpenExpediente(row);

  const handleSendVoboDev = async (row: NotaryRow) => {
    if (!row.urlProyectoEscrit) { toast.error('Primero sube el proyecto de escritura'); return; }
    if (!(await procesoTableExists())) return;
    const upd = { vobo_desarrollador: 'PENDIENTE', estatus: 'ENVIADO_A_VOBO_DESARROLLADOR' };
    if (row.procesoId) {
      await (supabase as any).from('app_notaria_proceso').update(upd).eq('id', row.procesoId);
    } else {
      await (supabase as any).from('app_notaria_proceso').insert({ id_cuenta_cobranza: row.cuentaId, id_notario: notarioId, ...upd });
    }
    toast.success('Enviado a VoBo desarrollador');
    qc.invalidateQueries({ queryKey: ['app-notaria-procesos'] });
  };

  const handleSendVoboBank = async (row: NotaryRow) => {
    if (row.paymentMethod !== 'CREDITO_HIPOTECARIO') { toast.error('Solo aplica para crédito hipotecario'); return; }
    if (row.voboDev !== 'APROBADO') { toast.error('VoBo del desarrollador debe estar aprobado primero'); return; }
    if (!(await procesoTableExists())) return;
    const upd = { vobo_banco: 'PENDIENTE', estatus: 'ENVIADO_A_VOBO_BANCO' };
    if (row.procesoId) {
      await (supabase as any).from('app_notaria_proceso').update(upd).eq('id', row.procesoId);
    } else {
      await (supabase as any).from('app_notaria_proceso').insert({ id_cuenta_cobranza: row.cuentaId, id_notario: notarioId, ...upd });
    }
    if (row.creditoId) {
      await supabase.from('creditos_hipotecarios').update({ vobo_banco: 'PENDIENTE' } as any).eq('id', row.creditoId);
    }
    toast.success('Enviado a VoBo banco');
    qc.invalidateQueries({ queryKey: ['app-notaria-procesos', 'app-notaria-creditos'] });
  };

  const isLoading = loadingCuentas;
  const lastUpdated = new Date().toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ── Auth guards ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cargando Portal Notaría...</span>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Stamp className="h-5 w-5 text-primary" />
            Portal Notaría
            {notariaNombre && <span className="text-sm font-normal text-muted-foreground">· {notariaNombre}</span>}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de unidades asignadas a la notaría</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">Última actualización: {lastUpdated}</span>
          <button
            onClick={() => {
              refetchAll();
              qc.invalidateQueries({ queryKey: ['app-notaria-acuerdos'] });
              qc.invalidateQueries({ queryKey: ['app-notaria-aplicaciones'] });
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

      {/* ── Admin notaría selector ── */}
      {isAdmin && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex-wrap">
          <span className="text-xs font-medium text-amber-800 shrink-0">Vista administrador — Selecciona una notaría:</span>
          <Select
            value={adminNotarioId ? String(adminNotarioId) : 'all'}
            onValueChange={v => setAdminNotarioId(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="h-8 text-xs w-[280px] bg-white border-amber-300">
              <SelectValue placeholder="Seleccionar notaría..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">— Seleccionar notaría —</SelectItem>
              {notariosList.map(n => (
                <SelectItem key={n.id} value={String(n.id)}>
                  {n.notaria} · {n.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Access banner — not authenticated ── */}
      {!user && (
        <div className="rounded-2xl border border-border bg-card p-10 flex flex-col items-center text-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Stamp className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Acceso para notarías</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Para consultar tus unidades asignadas, inicia sesión con tu usuario y contraseña.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button onClick={() => navigate('/app-notaria/login')}>
              <LogIn className="mr-1.5 h-4 w-4" /> Iniciar sesión
            </Button>
            <Button variant="outline" onClick={() => setShowRegInfo(v => !v)}>
              Solicitar registro
            </Button>
          </div>
          {showRegInfo && (
            <p className="text-sm text-muted-foreground bg-muted/50 border border-border rounded-xl px-4 py-3 max-w-sm">
              Solicita a SOZU que registre tu usuario y lo vincule a tu notaría.
            </p>
          )}
        </div>
      )}

      {/* ── No notaría banner — authenticated but not linked ── */}
      {user && !canView && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 flex flex-col items-center text-center gap-4">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <div>
            <h2 className="text-base font-bold text-amber-900">Usuario sin notaría vinculada</h2>
            <p className="text-sm text-amber-700 mt-1.5 max-w-sm mx-auto">
              Tu usuario está activo, pero aún no está vinculado a una notaría.
              Solicita a SOZU la vinculación.
            </p>
          </div>
        </div>
      )}

      {/* ── Data content — only shown when canView ── */}
      {canView && (
        <>

      {/* ── Admin sin notaría seleccionada ── */}
      {isAdmin && !adminNotarioId && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-border rounded-xl">
          <Stamp className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Selecciona una notaría para ver sus unidades</p>
          <p className="text-xs text-muted-foreground">Usa el selector de arriba para elegir una notaría activa.</p>
        </div>
      )}

      {/* ── DEV: diagnóstico cuando notaría seleccionada pero sin cuentas ── */}
      {import.meta.env.DEV && notarioId && !loadingCuentas && allRows.length === 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 font-mono space-y-0.5">
          {cuentasIsError ? (
            <p>[DEV ERROR] Query falló: {String(cuentasError)}</p>
          ) : (
            <p>[DEV] id_notario={notarioId} — 0 cuentas en cuentas_cobranza.</p>
          )}
          <p>SQL: SELECT id, id_notario FROM cuentas_cobranza WHERE id_notario = {notarioId};</p>
        </div>
      )}

      {/* ── Search + Project ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={proyectoId || 'todos'} onValueChange={v => setProyectoId(v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proyectos</SelectItem>
            {proyectos.map((p: any) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar unidad, ID cuenta o cliente..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="flex gap-3 flex-wrap">
        {[
          { key: 'asignadas',    label: 'Escrituras asignadas',   count: kpis.asignadas,    color: 'bg-emerald-500', icon: <Stamp       className="h-4 w-4 text-white" /> },
          { key: 'enElab',       label: 'En elaboración',          count: kpis.enElab,       color: 'bg-blue-500',    icon: <FileText    className="h-4 w-4 text-white" /> },
          { key: 'pendVoboDev',  label: 'Pend. VoBo desarrollador',count: kpis.pendVoboDev,  color: 'bg-amber-500',   icon: <Send        className="h-4 w-4 text-white" /> },
          { key: 'pendVoboBank', label: 'Pend. VoBo banco',        count: kpis.pendVoboBank, color: 'bg-orange-500',  icon: <Landmark    className="h-4 w-4 text-white" /> },
          { key: 'pendCotiz',    label: 'Cotizaciones pendientes', count: kpis.pendCotiz,    color: 'bg-purple-500',  icon: <Receipt     className="h-4 w-4 text-white" /> },
          { key: 'citas',        label: 'Citas programadas',       count: kpis.citas,        color: 'bg-cyan-500',    icon: <CalendarDays className="h-4 w-4 text-white" /> },
        ].map(kpi => (
          <KpiCard
            key={kpi.key}
            icon={kpi.icon}
            label={kpi.label}
            count={kpi.count}
            colorCls={kpi.color}
            active={kpiFilter === kpi.key}
            onClick={() => setKpiFilter(prev => prev === kpi.key ? '' : kpi.key)}
          />
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter || 'todos'} onValueChange={v => setStatusFilter(v === 'todos' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[130px]"><SelectValue placeholder="Estatus: Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Estatus: Todos</SelectItem>
            {(Object.keys(STATUS_META) as NotaryAppStatus[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={payFilter || 'todos'} onValueChange={v => setPayFilter(v === 'todos' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]"><SelectValue placeholder="Forma de pago" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Forma de pago: Todos</SelectItem>
            <SelectItem value="RECURSOS_PROPIOS">Recursos propios</SelectItem>
            <SelectItem value="CREDITO_HIPOTECARIO">Crédito hipotecario</SelectItem>
          </SelectContent>
        </Select>

        <Select value={bankFilter || 'todos'} onValueChange={v => setBankFilter(v === 'todos' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[110px]"><SelectValue placeholder="Banco: Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Banco: Todos</SelectItem>
            {banks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={voboDevF || 'todos'} onValueChange={v => setVoboDevF(v === 'todos' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[160px]"><SelectValue placeholder="VoBo desarrollador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">VoBo desarrollador: Todos</SelectItem>
            <SelectItem value="NO_ENVIADO">No enviado</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
            <SelectItem value="APROBADO">Aprobado</SelectItem>
            <SelectItem value="RECHAZADO">Rechazado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={voboBankF || 'todos'} onValueChange={v => setVoboBankF(v === 'todos' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[130px]"><SelectValue placeholder="VoBo banco" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">VoBo banco: Todos</SelectItem>
            <SelectItem value="NO_APLICA">N/A</SelectItem>
            <SelectItem value="NO_ENVIADO">No enviado</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
            <SelectItem value="APROBADO">Aprobado</SelectItem>
            <SelectItem value="RECHAZADO">Rechazado</SelectItem>
          </SelectContent>
        </Select>

        {(hasFilters || kpiFilter) && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-8 px-2 rounded-md hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Table + Panel ── */}
      <div className="flex gap-4 items-start">

        {/* Table */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Unidades asignadas a mi notaría</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filteredRows.length} registros{allRows.length !== filteredRows.length ? ` de ${allRows.length}` : ''}
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Cargando...</span>
              </div>
            ) : isAdmin && !adminNotarioId ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Stamp className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Selecciona una notaría en el selector de arriba para ver sus unidades</p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Stamp className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {allRows.length === 0 ? 'No hay unidades asignadas a esta notaría' : 'Sin resultados con los filtros aplicados'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Proyecto', 'Unidad — Cliente', 'Estatus', 'Fecha Asignación', 'Forma de Liquidación', 'Banco', 'Valor Escrituración', 'Total Pagado', 'Saldo Pendiente', 'Cita de Firma', 'Acciones'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <tr
                      key={row.cuentaId}
                      onClick={() => { setSelectedRow(row); setDetailTab('resumen'); }}
                      className={cn(
                        'border-b border-border cursor-pointer transition-colors',
                        idx % 2 === 0 ? 'bg-white' : 'bg-muted/10',
                        selectedRow?.cuentaId === row.cuentaId
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : 'hover:bg-muted/20',
                      )}
                    >
                      {/* Proyecto */}
                      <td className="px-3 py-3">
                        <p className="font-medium text-sm leading-tight">{row.proyectoNombre}</p>
                        {row.edificioNombre && <p className="text-xs text-muted-foreground">{row.edificioNombre}</p>}
                      </td>
                      {/* Unidad — Cliente (abre sheet de detalle) */}
                      <td
                        className="px-3 py-3 cursor-pointer group"
                        onClick={e => { e.stopPropagation(); handleOpenDetailSheet(row); }}
                      >
                        <p className="font-semibold text-sm group-hover:underline decoration-dotted underline-offset-2">{row.unitCode}</p>
                        <p className="text-xs text-muted-foreground">{row.clienteName}</p>
                        <p className="text-[11px] text-muted-foreground/60 font-mono">{row.cuentaCode}</p>
                      </td>
                      {/* Estatus */}
                      <td className="px-3 py-3"><StatusBadge status={row.estatus} /></td>
                      {/* Fecha Asignación */}
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(row.fechaAsignacion)}</td>
                      {/* Forma de Liquidación */}
                      <td className="px-3 py-3"><PaymentBadge method={row.paymentMethod} /></td>
                      {/* Banco */}
                      <td className="px-3 py-3"><BankBadge name={row.bankName} /></td>
                      {/* Valor Escrituración = suma de todas las cuentas de la propiedad */}
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-purple-700">
                        {row.precioFinal > 0 ? fmtMxn(row.precioFinal) : '—'}
                      </td>
                      {/* Total Pagado */}
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-600">
                        {fmtMxn(row.montoPagado)}
                      </td>
                      {/* Saldo Pendiente */}
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.montoAdeudo > 0
                          ? <span className="text-red-600 font-medium">{fmtMxn(row.montoAdeudo)}</span>
                          : <span className="text-emerald-600 font-medium">$0</span>}
                      </td>
                      <td className="px-3 py-3">
                        {row.signingDate ? (
                          <div>
                            <p className="text-xs font-medium">{fmtDate(row.signingDate)}</p>
                            {row.signingTime && <p className="text-[11px] text-muted-foreground">{fmtTime(row.signingTime)}</p>}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      {/* Acciones */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={e => { e.stopPropagation(); handleDownloadExp(row); }}
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-primary transition-colors"
                            title="Descargar expediente"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleOpenPagos(row); }}
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-primary transition-colors"
                            title="Descargar comprobantes de pago"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedRow(row); setDetailTab('pipeline'); }}
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
                            title="Ver pipeline"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Detail Panel ── */}
        {selectedRow && (
          <div className="w-[340px] shrink-0 bg-white border border-border rounded-xl flex flex-col sticky top-[72px] max-h-[calc(100vh-100px)] overflow-hidden">
            {/* Panel header */}
            <div className="px-4 pt-4 pb-3 border-b border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold leading-tight">{selectedRow.unitCode}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedRow.proyectoNombre}{selectedRow.edificioNombre ? ` · ${selectedRow.edificioNombre}` : ''}</p>
                </div>
                <button onClick={() => setSelectedRow(null)} className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2"><StatusBadge status={selectedRow.estatus} /></div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              {(['resumen', 'pipeline', 'vobos', 'documentos'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium transition-colors',
                    detailTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab === 'resumen' ? 'Resumen' : tab === 'pipeline' ? 'Pipeline' : tab === 'vobos' ? 'VoBos' : 'Documentos'}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detailTab === 'resumen' && (
                <>
                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Información general</h3>
                    <dl className="space-y-1.5">
                      {[
                        ['Cliente',           selectedRow.clienteName],
                        ['ID Cuenta',         selectedRow.cuentaCode],
                        ['Forma de pago',     selectedRow.paymentMethod === 'CREDITO_HIPOTECARIO' ? 'Crédito hipotecario' : 'Recursos propios'],
                        ['Banco',             selectedRow.bankName ?? '—'],
                        ['Notaría asignada',  notariaNombre ?? '—'],
                        ['Fecha asignación',  fmtDate(selectedRow.fechaAsignacion)],
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
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Precio final de venta</dt>
                        <dd className="text-xs font-medium tabular-nums">{fmtMxn(selectedRow.precioFinal)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Monto pagado a la fecha</dt>
                        <dd className="text-xs font-medium tabular-nums">{fmtMxn(selectedRow.montoPagado)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Monto adeudo</dt>
                        <dd className={cn('text-xs font-medium tabular-nums', selectedRow.montoAdeudo > 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {fmtMxn(selectedRow.montoAdeudo)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Fechas importantes</h3>
                    <dl className="space-y-1.5">
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Cita de firma</dt>
                        <dd className="text-xs font-medium">
                          {selectedRow.signingDate
                            ? `${fmtDate(selectedRow.signingDate)}${selectedRow.signingTime ? ' ' + fmtTime(selectedRow.signingTime) : ''}`
                            : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Cotización notarial</dt>
                        <dd className="text-xs font-medium">{selectedRow.cotizacionTotal ? fmtMxn(selectedRow.cotizacionTotal) : 'Pendiente'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">Última actualización</dt>
                        <dd className="text-xs text-muted-foreground">{fmtDate(selectedRow.lastUpdatedAt)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Acciones rápidas</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Descargar expediente',   icon: Download,     action: () => handleDownloadExp(selectedRow) },
                        { label: 'Descargar rel. pagos',   icon: Receipt,      action: () => handleOpenPagos(selectedRow) },
                        { label: 'Subir proy. escritura',  icon: Upload,       action: () => toast.info('Ejecuta el DDL en modulo_app_notaria.md') },
                        { label: 'Enviar VoBo dev.',        icon: Send,         action: () => handleSendVoboDev(selectedRow) },
                        { label: 'Enviar VoBo banco',       icon: Landmark,     action: () => handleSendVoboBank(selectedRow) },
                        { label: 'Subir cotización',        icon: FileText,     action: () => toast.info('Ejecuta el DDL en modulo_app_notaria.md') },
                        { label: 'Ver en Workflow',         icon: ChevronRight, action: () => navigate('/admin/portal-escrituracion/workflow') },
                        { label: 'Agregar comentario',      icon: MessageSquare,action: () => toast.info('Requiere DDL app_notaria_actividad') },
                      ].map(({ label, icon: Icon, action }) => (
                        <button
                          key={label}
                          onClick={action}
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-border text-xs text-foreground hover:bg-muted transition-colors text-left"
                        >
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="leading-tight">{label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {/* ── PIPELINE ── */}
              {detailTab === 'pipeline' && (() => {
                const row = selectedRow!;
                const esCreditoHipotecario = row.paymentMethod === 'CREDITO_HIPOTECARIO';
                const steps = [
                  { id: 'asignacion',   label: 'Asignación',                             done: true,                                                          always: true },
                  { id: 'elaboracion',  label: 'Desarrollo del proyecto de escritura',    done: !!row.urlProyectoEscrit,                                       always: true },
                  { id: 'avaluo',       label: 'Avalúo',                                  done: row.estatus === 'VOBO_DESARROLLADOR_APROBADO' || row.voboDev !== 'NO_ENVIADO', always: true },
                  { id: 'vobo_dev',     label: 'VoBo del proyecto — Desarrollador',       done: row.voboDev === 'APROBADO',                                    always: true },
                  { id: 'vobo_banco',   label: 'VoBo del proyecto — Banco',               done: row.voboBank === 'APROBADO',                                   always: esCreditoHipotecario, skip: !esCreditoHipotecario },
                  { id: 'clg',          label: 'CLG listo',                               done: row.cotizacionEstatus === 'ACEPTADA',                          always: true },
                  { id: 'programacion', label: 'Programación de cita para firma',         done: !!row.signingDate,                                             always: true },
                  { id: 'confirmacion', label: 'Confirmación de cita de firma',           done: row.estatus === 'CITA_PROGRAMADA' || row.estatus === 'FIRMADO' || row.estatus === 'EN_REGISTRO_RPP' || row.estatus === 'CONCLUIDO', always: true },
                  { id: 'firmado',      label: 'Escritura firmada',                       done: row.estatus === 'FIRMADO' || row.estatus === 'EN_REGISTRO_RPP' || row.estatus === 'CONCLUIDO', always: true },
                  { id: 'pago_banco',   label: 'Pago del banco confirmado',               done: row.estatus === 'EN_REGISTRO_RPP' || row.estatus === 'CONCLUIDO', always: esCreditoHipotecario, skip: !esCreditoHipotecario },
                  { id: 'rpp',          label: 'Registro de escritura al RPP',            done: row.estatus === 'CONCLUIDO',                                   always: true },
                ];
                const visible = steps.filter(s => !s.skip);
                const completed = visible.filter(s => s.done).length;
                const pct = Math.round((completed / visible.length) * 100);

                return (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Proceso de escrituración</h3>
                      <span className="text-xs font-bold text-primary">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="relative pl-4">
                      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-3">
                        {visible.map((step, idx) => {
                          const prev = visible[idx - 1];
                          const isActive = !step.done && (idx === 0 || (prev?.done ?? false));
                          return (
                            <div key={step.id} className="relative flex items-start gap-2.5">
                              <div className={cn(
                                'absolute -left-4 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 bg-white z-10',
                                step.done   ? 'border-emerald-500 bg-emerald-500'  :
                                isActive    ? 'border-primary bg-white' :
                                              'border-muted-foreground/30 bg-white',
                              )}>
                                {step.done
                                  ? <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                                  : isActive
                                    ? <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    : null}
                              </div>
                              <div className="pl-1 pb-1">
                                <p className={cn(
                                  'text-xs font-medium leading-tight',
                                  step.done ? 'text-slate-700' : isActive ? 'text-primary' : 'text-muted-foreground',
                                )}>
                                  {step.label}
                                </p>
                                {step.skip && <p className="text-[10px] text-muted-foreground/60 mt-0.5">No aplica (recursos propios)</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                );
              })()}

              {detailTab === 'vobos' && (
                <section className="space-y-3">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Estado de VoBos</h3>

                  {/* Proyecto escritura */}
                  <div className="p-3 rounded-lg border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Proyecto de escritura</span>
                      {selectedRow.urlProyectoEscrit
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : <Clock className="h-4 w-4 text-amber-400" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedRow.urlProyectoEscrit ? 'Documento cargado' : 'Pendiente de cargar'}
                    </p>
                    {selectedRow.urlProyectoEscrit && (
                      <a href={selectedRow.urlProyectoEscrit} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1">
                        <ExternalLink className="h-3 w-3" /> Ver documento
                      </a>
                    )}
                  </div>

                  {/* VoBo desarrollador */}
                  <div className="p-3 rounded-lg border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">VoBo Desarrollador</span>
                      <span className={cn('text-xs font-semibold', VOBO_META[selectedRow.voboDev].cls)}>
                        {VOBO_META[selectedRow.voboDev].label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Revisión del proyecto de escritura por el desarrollador</p>
                    {selectedRow.voboDev === 'NO_ENVIADO' && selectedRow.urlProyectoEscrit && (
                      <button onClick={() => handleSendVoboDev(selectedRow)} className="text-xs text-primary flex items-center gap-1 mt-1">
                        <Send className="h-3 w-3" /> Enviar a VoBo
                      </button>
                    )}
                  </div>

                  {/* VoBo banco */}
                  <div className={cn('p-3 rounded-lg border space-y-1', selectedRow.paymentMethod !== 'CREDITO_HIPOTECARIO' ? 'border-dashed bg-muted/20' : 'border-border')}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">VoBo Banco</span>
                      <span className={cn('text-xs font-semibold', VOBO_BANCO_META[selectedRow.voboBank].cls)}>
                        {VOBO_BANCO_META[selectedRow.voboBank].label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedRow.paymentMethod !== 'CREDITO_HIPOTECARIO'
                        ? 'No aplica (recursos propios)'
                        : 'Revisión del proyecto por el banco hipotecario'}
                    </p>
                    {selectedRow.paymentMethod === 'CREDITO_HIPOTECARIO' && selectedRow.voboBank === 'NO_ENVIADO' && selectedRow.voboDev === 'APROBADO' && (
                      <button onClick={() => handleSendVoboBank(selectedRow)} className="text-xs text-primary flex items-center gap-1 mt-1">
                        <Send className="h-3 w-3" /> Enviar a banco
                      </button>
                    )}
                  </div>

                  {/* Cotización */}
                  <div className="p-3 rounded-lg border border-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Cotización notarial</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedRow.cotizacionEstatus === 'SIN_COTIZACION' ? 'Sin cotización'
                          : selectedRow.cotizacionEstatus === 'ENVIADA' ? 'Enviada al cliente'
                          : selectedRow.cotizacionEstatus === 'ACEPTADA' ? 'Aceptada'
                          : selectedRow.cotizacionEstatus}
                      </span>
                    </div>
                    {selectedRow.cotizacionTotal != null && (
                      <p className="text-sm font-semibold tabular-nums">{fmtMxn(selectedRow.cotizacionTotal)}</p>
                    )}
                    {selectedRow.cotizacionEstatus === 'SIN_COTIZACION' && (
                      <button onClick={() => toast.info('Ejecuta el DDL en modulo_app_notaria.md')} className="text-xs text-primary flex items-center gap-1 mt-1">
                        <Upload className="h-3 w-3" /> Subir cotización
                      </button>
                    )}
                  </div>
                </section>
              )}

              {detailTab === 'documentos' && (
                <section className="space-y-4">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Documentos de la notaría</h3>

                  {/* Proyecto de escritura */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-700">Proyecto de escritura</p>
                    <p className="text-[11px] text-muted-foreground">Requerido para solicitar VoBo del Desarrollador{selectedRow.paymentMethod === 'CREDITO_HIPOTECARIO' ? ' y del Banco' : ''}.</p>
                    {selectedRow.urlProyectoEscrit ? (
                      <div className="flex items-center gap-2">
                        <a href={selectedRow.urlProyectoEscrit} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> Ver documento cargado
                        </a>
                      </div>
                    ) : null}
                    <label className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-primary/40 text-xs text-primary hover:bg-primary/5 transition-colors cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      {selectedRow.urlProyectoEscrit ? 'Reemplazar proyecto de escritura' : 'Subir proyecto de escritura'}
                      <input type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const path = `proyectos_escritura/${selectedRow.cuentaId}/${file.name}`;
                        const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
                        if (error) { toast.error('Error al subir el archivo: ' + error.message); return; }
                        const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);
                        if (selectedRow.procesoId) {
                          await (supabase as any).from('app_notaria_proceso')
                            .update({ url_proyecto_escritura: urlData.publicUrl, vobo_desarrollador: 'NO_ENVIADO', fecha_actualizacion: new Date().toISOString() })
                            .eq('id', selectedRow.procesoId);
                        }
                        toast.success('Proyecto de escritura subido correctamente');
                        qc.invalidateQueries({ queryKey: ['app-notaria-cuentas'] });
                      }} />
                    </label>
                  </div>

                  {/* Cotización */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-700">Cotización notarial</p>
                    <p className="text-[11px] text-muted-foreground">
                      Estatus: <span className="font-medium">{selectedRow.cotizacionEstatus === 'SIN_COTIZACION' ? 'Sin cotización' : selectedRow.cotizacionEstatus}</span>
                      {selectedRow.cotizacionTotal ? ` · ${fmtMxn(selectedRow.cotizacionTotal)}` : ''}
                    </p>
                    <label className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-amber-400/60 text-xs text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      Subir cotización (PDF)
                      <input type="file" accept=".pdf" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const path = `cotizaciones_notaria/${selectedRow.cuentaId}/${file.name}`;
                        const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
                        if (error) { toast.error('Error al subir cotización: ' + error.message); return; }
                        toast.success('Cotización subida correctamente');
                        if (selectedRow.procesoId) {
                          await (supabase as any).from('app_notaria_proceso')
                            .update({ cotizacion_estatus: 'ENVIADA', fecha_actualizacion: new Date().toISOString() })
                            .eq('id', selectedRow.procesoId);
                          qc.invalidateQueries({ queryKey: ['app-notaria-cuentas'] });
                        }
                      }} />
                    </label>
                  </div>

                  {/* Expediente */}
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-slate-700">Expediente completo</p>
                    <button
                      onClick={() => handleOpenExpediente(selectedRow)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Ver y descargar expediente de {selectedRow.cuentaCode}
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* ── Dialog Editar Comprador ─────────────────────────────────────────── */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={open => { setEditDialogOpen(open); if (!open) setEditPersonaId(null); }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Comprador</DialogTitle>
          </DialogHeader>
          {editPersonaData && (
            <PersonForm
              initialData={{
                ...editPersonaData,
                representativeId: editPersonaData.id_entidad_relacionada_rep_leg,
              }}
              onSubmit={data => updatePersonaMutation.mutate(data)}
              isLoading={updatePersonaMutation.isPending}
              onCancel={() => { setEditDialogOpen(false); setEditPersonaId(null); }}
              entityType="comprador"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal Expediente ────────────────────────────────────────────────── */}
      <NotariaExpedienteModal
        open={!!expedienteModal?.open}
        onOpenChange={(open) => {
          if (!open) setExpedienteModal(null);
        }}
        idCuentaCobranza={expedienteModal?.cuentaId ?? null}
        notarioId={notarioId}
        proyecto={expedienteModal?.proyecto ?? ''}
        unidad={expedienteModal?.unidad ?? ''}
        cuentaCode={expedienteModal?.cuentaCode ?? ''}
        usuarioEmail={profile?.email ?? null}
      />

      {/* ── Sheet Detalle Cuenta ────────────────────────────────────────────── */}
      {detailSheetRow && (
        <NotariaCuentaDetalleSheet
          open={!!detailSheetRow}
          onOpenChange={open => { if (!open) setDetailSheetRow(null); }}
          row={detailSheetRow}
          notarioId={notarioId}
          usuarioEmail={profile?.email ?? null}
        />
      )}

      {/* ── Modal Pagos ─────────────────────────────────────────────────────── */}
      <NotariaPagosModal
        open={!!pagosModal?.open}
        onOpenChange={(open) => {
          if (!open) setPagosModal(null);
        }}
        idCuentaCobranza={pagosModal?.cuentaId ?? null}
        notarioId={notarioId}
        proyecto={pagosModal?.proyecto ?? ''}
        unidad={pagosModal?.unidad ?? ''}
        cuentaCode={pagosModal?.cuentaCode ?? ''}
        notariaNombre={notariaNombre}
        usuarioEmail={profile?.email ?? null}
      />
    </div>
  );
}
