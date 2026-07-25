import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalViewer } from "@/components/ui/ModalViewer";
import { Loader2, Lock, CheckCircle2, AlertCircle, FileText, EyeOff, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";

type ClienteInfo = { nombre: string; email: string; porcentaje: number };

// Celda de cliente estilo portal cobranza: nombre + correo debajo; si hay
// copropiedad, se indica cuántos más.
function ClienteCell({ clientes }: { clientes: ClienteInfo[] }) {
  if (!clientes || clientes.length === 0) return <span className="text-[12px] text-muted-foreground/60">Sin cliente</span>;
  const first = clientes[0];
  const extra = clientes.length - 1;
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium truncate" title={first.nombre}>
        {first.nombre || 'Sin nombre'}{extra > 0 && <span className="text-muted-foreground font-normal"> +{extra}</span>}
      </p>
      {first.email && <p className="text-[10px] text-muted-foreground truncate" title={first.email}>{first.email}</p>}
    </div>
  );
}

// Estatus → badge (mismos rótulos que portal inmobiliarias).
const ESTATUS_LABEL: Record<string, string> = {
  pagada: 'Pagada',
  programada: 'Programada a pago',
  factura_requerida: 'Pendiente factura',
  en_revision: 'En revisión',
  pendiente: 'Pendiente',
};
function EstatusBadgeTabla({ status }: { status: string }) {
  const label = ESTATUS_LABEL[status] || 'Pendiente';
  const cls =
    status === 'pagada' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : status === 'factura_requerida' ? 'bg-red-100 text-red-700 border-red-200'
    : 'border-border text-muted-foreground';
  return <Badge variant="outline" className={cn('font-medium whitespace-nowrap', cls)}>{label}</Badge>;
}

// Orden de columnas (client-side), estilo portal cobranza.
type SortKey = 'account' | 'project' | 'client' | 'price' | 'commission' | 'date';
function SortHeader({ label, sortKey, sort, onSort, align = 'left', thClass }: {
  label: string; sortKey: SortKey; sort: { key: SortKey | null; dir: 'asc' | 'desc' }; onSort: (k: SortKey) => void; align?: 'left' | 'right' | 'center'; thClass?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead className={cn('h-9 whitespace-nowrap', align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left', thClass)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn('inline-flex items-center gap-1 uppercase tracking-wide whitespace-nowrap text-[11px] font-semibold select-none transition-colors',
          align === 'right' && 'flex-row-reverse',
          active ? 'text-[hsl(158_64%_38%)]' : 'text-muted-foreground hover:text-foreground')}
      >
        {label}
        <ArrowUpDown strokeWidth={2.25} className={cn('size-3 shrink-0', active ? 'text-[hsl(158_64%_38%)]' : 'text-muted-foreground/50')} />
      </button>
    </TableHead>
  );
}

const AgentComisiones = () => {
  const { profile, user } = useAuth();
  const { impersonatedAgentEmail, impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const navigate = useNavigate();
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const agentEmail = isImpersonating ? impersonatedAgentEmail : (user?.email || profile?.email);
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const { steps, percentage, isLoading: onboardingLoading, canAccessComisiones, missingForComisiones } = useAgentOnboardingStatus(personaId);
  const { presentationMode, mask } = useAgentPresentation();
  const [filterProyecto, setFilterProyecto] = useState<string>('todos');
  const [searchCliente, setSearchCliente] = useState<string>('');
  const [filterEstatus, setFilterEstatus] = useState<string>('todos');
  const [viewerDoc, setViewerDoc] = useState<{ url: string; title: string } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/comisiones');
    track({ page: 'agent_comisiones', elementId: 'page_view', elementType: 'page' });
  }, []);

  // Use the centralized canAccessComisiones from the hook
  const canReceivePayments = canAccessComisiones;

  // Fetch comisiones with property status and factura info
  const { data: comisiones = [], isLoading: comisionesLoading } = useQuery({
    queryKey: ['agent-comisiones', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return [];

      const { data: comisionistas } = await (supabase as any)
        .from('comisionistas')
        .select('id_cuenta_cobranza, porcentaje_comision, aprobada, pagada, fecha_creacion, fecha_actualizacion, fecha_pago_comision, url_evidencia_pago')
        .eq('email_usuario', agentEmail)
        .eq('activo', true)
        .order('fecha_creacion', { ascending: false });

      if (!comisionistas || comisionistas.length === 0) return [];

      const cuentaIds = [...new Set(comisionistas.map((c: any) => c.id_cuenta_cobranza).filter(Boolean))] as number[];
      const cuentaMap = new Map<number, any>();

      if (cuentaIds.length > 0) {
        const { data: cuentas } = await (supabase as any)
          .from('cuentas_cobranza')
          .select('id, id_oferta, precio_final')
          .in('id', cuentaIds);

        if (cuentas) {
          const ofertaIds = cuentas.map((c: any) => c.id_oferta).filter(Boolean);
          let ofertaMap = new Map<number, any>();
          
          if (ofertaIds.length > 0) {
            const { data: ofertas } = await (supabase as any)
              .from('ofertas')
              .select('id, id_propiedad, id_producto')
              .in('id', ofertaIds);
            
            const propIds = (ofertas || []).map((o: any) => o.id_propiedad).filter(Boolean);
            const prodIds = [...new Set((ofertas || []).map((o: any) => o.id_producto).filter(Boolean))] as number[];
            let propMap = new Map<number, any>();
            let prodMap = new Map<number, string>();

            if (prodIds.length > 0) {
              const { data: prods } = await (supabase as any)
                .from('productos_servicios')
                .select('id, nombre')
                .in('id', prodIds);
              (prods || []).forEach((p: any) => prodMap.set(p.id, p.nombre));
            }
            
            if (propIds.length > 0) {
              const { data: props } = await (supabase as any)
                .from('propiedades')
                .select('id, numero_propiedad, id_edificio_modelo, id_estatus_disponibilidad')
                .in('id', propIds);
              
              const emIds = [...new Set((props || []).map((p: any) => p.id_edificio_modelo).filter(Boolean))];
              let propToProject = new Map<number, string>();
              
              if (emIds.length > 0) {
                const { data: ems } = await (supabase as any).from('edificios_modelos').select('id, id_edificio').in('id', emIds);
                const edIds = [...new Set((ems || []).map((em: any) => em.id_edificio).filter(Boolean))];
                if (edIds.length > 0) {
                  const { data: eds } = await (supabase as any).from('edificios').select('id, id_proyecto').in('id', edIds);
                  const pjIds = [...new Set((eds || []).map((e: any) => e.id_proyecto).filter(Boolean))];
                  if (pjIds.length > 0) {
                    const { data: pjs } = await (supabase as any).from('proyectos').select('id, nombre').in('id', pjIds);
                    const pjMap = new Map((pjs || []).map((p: any) => [p.id, p.nombre]));
                    const edToP = new Map((eds || []).map((e: any) => [e.id, e.id_proyecto]));
                    const emToE = new Map((ems || []).map((em: any) => [em.id, em.id_edificio]));
                    (props || []).forEach((p: any) => {
                      const eId = emToE.get(p.id_edificio_modelo);
                      const pjId = eId ? edToP.get(eId) : null;
                      if (pjId) propToProject.set(p.id, (pjMap.get(pjId) as string) || '');
                    });
                  }
                }
              }
              
              (props || []).forEach((p: any) => propMap.set(p.id, { ...p, proyecto: propToProject.get(p.id) || '' }));
            }
            
            (ofertas || []).forEach((o: any) => {
              const prop = propMap.get(o.id_propiedad);
              const productoNombre = o.id_producto ? prodMap.get(o.id_producto) || '' : '';
              const tipoDerivado = o.id_producto ? 'Producto' : 'Propiedad';
              ofertaMap.set(o.id, { ...prop, productoNombre, tipoDerivado });
            });
          }
          
          cuentas.forEach((c: any) => {
            const info = ofertaMap.get(c.id_oferta);
            cuentaMap.set(c.id, { 
              ...c, 
              propiedad: info?.numero_propiedad, 
              proyecto: info?.proyecto, 
              precio_final: c.precio_final, 
              tipo: info?.tipoDerivado || 'Propiedad',
              productoNombre: info?.productoNombre || '',
              id_estatus_disponibilidad: info?.id_estatus_disponibilidad,
            });
          });
        }
      }

      const cuentaIdsForFactura = comisionistas.map((c: any) => c.id_cuenta_cobranza).filter(Boolean);
      const { data: facturas } = cuentaIdsForFactura.length > 0
        ? await (supabase as any)
            .from('documentos')
            .select('id, id_cuenta_cobranza, url')
            .in('id_cuenta_cobranza', cuentaIdsForFactura)
            .eq('id_tipo_documento', 46)
            .eq('activo', true)
        : { data: [] };
      const facturaUrlMap = new Map<number, string>();
      (facturas || []).forEach((f: any) => {
        if (f.id_cuenta_cobranza) facturaUrlMap.set(f.id_cuenta_cobranza, f.url || '');
      });

      // Cliente(s) de cada cuenta (compradores → personas).
      const clientesMap = new Map<number, ClienteInfo[]>();
      if (cuentaIds.length > 0) {
        const { data: compradores } = await (supabase as any)
          .from('compradores')
          .select('id_cuenta_cobranza, porcentaje_copropiedad, id_persona')
          .in('id_cuenta_cobranza', cuentaIds)
          .eq('activo', true);
        const persIds = [...new Set((compradores || []).map((d: any) => d.id_persona).filter(Boolean))] as number[];
        const { data: persC } = persIds.length > 0
          ? await supabase.from('personas').select('id, nombre_legal, email').in('id', persIds)
          : { data: [] };
        const persMap = new Map<number, { nombre: string; email: string }>((persC || []).map((p: any) => [p.id, { nombre: p.nombre_legal || '', email: p.email || '' }]));
        (compradores || []).forEach((d: any) => {
          const arr = clientesMap.get(d.id_cuenta_cobranza) || [];
          const p = persMap.get(d.id_persona);
          arr.push({ nombre: p?.nombre || '', email: p?.email || '', porcentaje: Number(d.porcentaje_copropiedad) || 0 });
          clientesMap.set(d.id_cuenta_cobranza, arr);
        });
      }

      return comisionistas.map((c: any) => {
        const cuenta = cuentaMap.get(c.id_cuenta_cobranza);
        const precioFinal = cuenta?.precio_final || 0;
        const montoComision = precioFinal * (c.porcentaje_comision || 0) / 100;
        const propSold = cuenta?.id_estatus_disponibilidad === 5;
        const facturaUrl = facturaUrlMap.get(c.id_cuenta_cobranza) || null;
        const hasFactura = facturaUrlMap.has(c.id_cuenta_cobranza);

        let detailedStatus: string;
        if (c.pagada) {
          detailedStatus = 'pagada';
        } else if (c.aprobada && hasFactura) {
          detailedStatus = 'programada';
        } else if (c.aprobada && !hasFactura) {
          detailedStatus = 'factura_requerida';
        } else if (propSold) {
          detailedStatus = 'en_revision';
        } else {
          detailedStatus = 'pendiente';
        }

        // Fecha de pago: solo cuando la comisión ya se pagó.
        const fechaPago = c.pagada ? (c.fecha_pago_comision || c.fecha_actualizacion || null) : null;

        return {
          ...c,
          proyecto: cuenta?.proyecto || '',
          propiedad: cuenta?.propiedad || '',
          productoNombre: cuenta?.productoNombre || '',
          precio_final: precioFinal,
          monto_comision: montoComision,
          detailed_status: detailedStatus,
          cuenta_cobranza_label: formatCuentaCobranzaId(c.id_cuenta_cobranza, cuenta?.tipo),
          factura_url: facturaUrl,
          clientes: clientesMap.get(c.id_cuenta_cobranza) || [],
          fecha_pago: fechaPago,
        };
      });
    },
    enabled: !!agentEmail,
    staleTime: 30_000,
  });

  const isLoading = onboardingLoading || comisionesLoading;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const formatFechaPago = (fecha: string | null) => {
    if (!fecha) return '';
    // Fecha solo-día (YYYY-MM-DD): usar componentes directos para no correrse por zona horaria.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
    if (m) return `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}`; // "24 jul 2026"
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const totalCobrado = comisiones
    .filter((c: any) => c.detailed_status === 'pagada')
    .reduce((sum: number, c: any) => sum + (c.monto_comision || 0), 0);

  const totalPorCobrar = comisiones
    .filter((c: any) => c.detailed_status !== 'pagada')
    .reduce((sum: number, c: any) => sum + (c.monto_comision || 0), 0);

  // Opciones de filtro derivadas de los datos.
  const proyectoOptions = [...new Set(comisiones.map((c: any) => c.proyecto).filter(Boolean))].sort() as string[];
  const estatusOptions = [...new Set(comisiones.map((c: any) => c.detailed_status).filter(Boolean))] as string[];

  const filteredComisiones = comisiones.filter((c: any) => {
    if (filterProyecto !== 'todos' && c.proyecto !== filterProyecto) return false;
    if (filterEstatus !== 'todos' && c.detailed_status !== filterEstatus) return false;
    if (searchCliente.trim()) {
      const q = searchCliente.trim().toLowerCase();
      const hit = (c.clientes || []).some((cl: any) =>
        (cl.nombre || '').toLowerCase().includes(q) || (cl.email || '').toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  // Orden (client-side, estilo portal cobranza)
  const sortedComisiones = (() => {
    if (!sort.key) return filteredComisiones;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (c: any) => {
      switch (sort.key) {
        case 'account': return c.id_cuenta_cobranza || 0;
        case 'project': return (c.proyecto || '').toLowerCase();
        case 'client': return (c.clientes?.[0]?.nombre || '').toLowerCase();
        case 'price': return c.precio_final || 0;
        case 'commission': return c.monto_comision || 0;
        case 'date': return c.fecha_pago ? new Date(c.fecha_pago).getTime() : 0;
        default: return 0;
      }
    };
    return [...filteredComisiones].sort((a: any, b: any) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  })();

  // Paginación (estilo portal cobranza)
  const total = sortedComisiones.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedComisiones = sortedComisiones.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | '...')[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  const toggleSort = (key: SortKey) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(1);
  };

  // Blocked state - only for Agente Inmobiliario role
  if (isAgentRole && !onboardingLoading && !canReceivePayments) {
    return (
      <div className="pb-24">
        <AgentPortalHeader />
        <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
        <div className="rounded-md border border-[#E7E9EC] bg-white p-5 space-y-4 shadow-[0_1px_3px_rgba(20,30,25,0.04)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <Lock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[hsl(var(--agent-text))]">Perfil incompleto</p>
              <p className="text-xs text-[hsl(var(--agent-text-secondary))]">
                Completa tu perfil para ver y recibir comisiones
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {missingForComisiones.map(item => (
              <CheckItem key={item} label={item} done={false} />
            ))}
            {missingForComisiones.length === 0 && <CheckItem label="Perfil completo" done={true} />}
          </div>

          <Button
            onClick={() => {
              track({ page: 'agent_comisiones', elementId: 'btn_completar_perfil_comisiones', elementLabel: 'Completar perfil' });
              navigate('/admin/agent/perfil');
            }}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Completar perfil
          </Button>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="pb-24">
      <AgentPortalHeader />

      <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
      {/* Banner modo presentación */}
      {presentationMode && (
        <div>
          <div className="flex items-center gap-2.5 rounded-md border border-[#EBC089] bg-[#FBE3CE] px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-[#B5601C]" />
            <span className="text-[12px] font-semibold text-[#B5601C]">
              Modo presentación activo · tus ingresos están ocultos. Desactívalo en la barra superior para verlos.
            </span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="rounded-md border border-[hsl(158_64%_38%)] bg-white p-[18px]">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-[hsl(158_64%_38%)]/70">Total cobrado</p>
          <p className="mt-2 text-[24px] font-bold tabular-nums text-[hsl(158_64%_38%)]">{mask(formatCurrency(totalCobrado))}</p>
          <p className="mt-1 text-[10px] font-semibold text-[hsl(158_64%_38%)]/60">MXN · acumulado</p>
        </div>
        <div className="rounded-md border border-[#ECEEF0] bg-white p-[18px]">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Por cobrar</p>
          <p className="mt-2 text-[24px] font-bold tabular-nums text-[#171A1D]">{mask(formatCurrency(totalPorCobrar))}</p>
          <p className="mt-1 text-[10px] font-semibold text-[#9AA3AD]">MXN · en proceso</p>
        </div>
      </div>

      {/* Filtros (estilo portal cobranza): Proyecto · Cliente · Estatus */}
      <div className="grid grid-cols-2 gap-3 items-end sm:flex sm:flex-wrap sm:gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Proyecto</span>
          <Select value={filterProyecto} onValueChange={(v) => { setFilterProyecto(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-full sm:w-[160px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {proyectoOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Cliente</span>
          <Input
            value={searchCliente}
            onChange={(e) => { setSearchCliente(e.target.value); setPage(1); }}
            placeholder="Nombre o correo"
            className="h-9 w-full sm:w-[180px] text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground px-0.5">Estatus</span>
          <Select value={filterEstatus} onValueChange={(v) => { setFilterEstatus(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-full sm:w-[170px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estatus</SelectItem>
              {estatusOptions.map((s) => <SelectItem key={s} value={s}>{ESTATUS_LABEL[s] || s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabla (estilo portal cobranza) */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--agent-muted))]" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-12 text-sm text-[hsl(var(--agent-text-secondary))]">
          {comisiones.length === 0 ? 'Aún no tienes comisiones' : 'Sin comisiones con estos filtros'}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-[#ECEEF0] bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[1180px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Cuenta" sortKey="account" sort={sort} onSort={toggleSort} thClass="w-[150px]" />
                    <SortHeader label="Proyecto" sortKey="project" sort={sort} onSort={toggleSort} thClass="w-[170px]" />
                    <SortHeader label="Cliente" sortKey="client" sort={sort} onSort={toggleSort} thClass="w-[190px]" />
                    <SortHeader label="Venta" sortKey="price" sort={sort} onSort={toggleSort} align="center" thClass="w-[130px]" />
                    <SortHeader label="Comisión +IVA" sortKey="commission" sort={sort} onSort={toggleSort} align="center" thClass="w-[150px]" />
                    <TableHead className="w-[130px] h-9 text-center uppercase tracking-wide whitespace-nowrap text-[11px] font-semibold text-muted-foreground">Estatus</TableHead>
                    <SortHeader label="F. Pago" sortKey="date" sort={sort} onSort={toggleSort} align="center" thClass="w-[140px]" />
                    <TableHead className="w-[120px] h-9 text-center uppercase tracking-wide whitespace-nowrap text-[11px] font-semibold text-muted-foreground">Comprobante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedComisiones.map((c: any, idx: number) => {
                    const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    const unidad = c.propiedad || c.productoNombre || '';
                    const tieneComprobante = c.detailed_status === 'pagada' && !!c.url_evidencia_pago;
                    return (
                      <TableRow key={`${c.id_cuenta_cobranza}-${idx}`} className="h-[52px]">
                        <TableCell className="pl-3 pr-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full text-[10px] font-bold tabular-nums leading-none select-none bg-muted text-muted-foreground/70 ring-1 ring-border/60 shrink-0">{rowNum}</span>
                            <span className="text-[12px] font-mono font-semibold tabular-nums truncate" title={c.cuenta_cobranza_label}>{c.cuenta_cobranza_label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-[12px] font-medium truncate" title={c.proyecto}>{c.proyecto || 'Sin proyecto'}</p>
                          {unidad && <p className="text-[10px] text-muted-foreground truncate" title={unidad}>{unidad}</p>}
                        </TableCell>
                        <TableCell><ClienteCell clientes={c.clientes} /></TableCell>
                        <TableCell className="text-center tabular-nums text-[12px]">{mask(formatCurrency(c.precio_final || 0))}</TableCell>
                        <TableCell className="text-center tabular-nums text-[12px] font-semibold">{mask(formatCurrency(c.monto_comision || 0))}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center"><EstatusBadgeTabla status={c.detailed_status} /></div>
                        </TableCell>
                        <TableCell className="text-center text-[12px] whitespace-nowrap truncate">{c.fecha_pago ? formatFechaPago(c.fecha_pago) : ''}</TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            title={tieneComprobante ? 'Ver comprobante' : 'Sin comprobante'}
                            disabled={!tieneComprobante}
                            onClick={() => tieneComprobante && setViewerDoc({ url: c.url_evidencia_pago, title: `Comprobante · ${c.cuenta_cobranza_label}` })}
                            className={cn(
                              'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                              tieneComprobante ? 'text-emerald-600 hover:bg-emerald-50 cursor-pointer' : 'text-muted-foreground/40 cursor-default'
                            )}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Footer: conteo + paginación */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12px] text-muted-foreground">
              {`${((currentPage - 1) * PAGE_SIZE + 1).toLocaleString('es-MX')} a ${Math.min(currentPage * PAGE_SIZE, total).toLocaleString('es-MX')} de ${total.toLocaleString('es-MX')} comisiones`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {pageNumbers.map((p, i) => p === '...' ? (
                  <span key={`e-${i}`} className="px-1.5 text-[12px] text-muted-foreground">…</span>
                ) : (
                  <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-[11px]" onClick={() => setPage(p as number)}>
                    {p}
                  </Button>
                ))}
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Visor interno de documento (factura / comprobante) */}
      <ModalViewer
        open={!!viewerDoc}
        onOpenChange={(v) => { if (!v) setViewerDoc(null); }}
        url={viewerDoc?.url || ""}
        title={viewerDoc?.title || "Documento"}
      />
    </div>
  );
};

function CheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
      )}
      <span className={cn("text-sm", done ? "text-[hsl(var(--agent-text))]" : "text-[hsl(var(--agent-text-secondary))]")}>
        {label}
      </span>
    </div>
  );
}

export default AgentComisiones;
