import { AddProspectoFloatingDialog } from "@/components/admin/AddProspectoFloatingDialog";
import { AgendarCitaShowroomDialog } from "@/components/admin/AgendarCitaShowroomDialog";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { AgentOnboardingStepDialog } from "@/components/admin/AgentOnboardingStepDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Ban,
  Calendar,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Clock,
  EyeOff,
  Loader2,
  MapPin,
  UserPlus
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AgentInicio = () => {
  const { profile, user } = useAuth();
  const { impersonatedAgentEmail, impersonatedAgentPersonaId, impersonatedAgentName, isImpersonating } = useAgentImpersonation();
  const navigate = useNavigate();
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const agentEmail = isImpersonating ? impersonatedAgentEmail : (user?.email || profile?.email);
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const { percentage, isLoading: onboardingLoading, hasTrainingComplete, hasBasicIdentityComplete } = useAgentOnboardingStatus(personaId);
  const { permissions } = useAgentPortalPermissions();
  const inicioPerms = permissions['/admin/agent/inicio'];
  const { presentationMode, mask } = useAgentPresentation();
  const [addProspectoOpen, setAddProspectoOpen] = useState(false);
  const [agendarCitaOpen, setAgendarCitaOpen] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<{ prospectoId: string; proyectoId: number; prospectoName: string; proyectoName: string } | null>(null);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();
  const queryClient = useQueryClient();
  const [selectedCita, setSelectedCita] = useState<any>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const fullName = isImpersonating ? (impersonatedAgentName || "Agente") : (profile?.nombre || "Agente");
  const rolLabel = profile?.rol_nombre || "Agente";

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/inicio');
    track({ page: 'agent_inicio', elementId: 'page_view', elementType: 'page' });
  }, []);

  // Último acceso (sesión actual de Supabase auth)
  const lastAccessLabel = (() => {
    const raw = (user as any)?.last_sign_in_at;
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const time = d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
    return d.toDateString() === now.toDateString()
      ? `Hoy ${time}`
      : `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} ${time}`;
  })();

  // Fetch agent metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['agent-metrics', agentEmail, personaId],
    queryFn: async () => {
      if (!agentEmail) return null;

      // Fetch comisionistas
      const { data: comisionistas } = await (supabase as any)
        .from('comisionistas')
        .select('id_cuenta_cobranza, porcentaje_comision, aprobada, pagada')
        .eq('email_usuario', agentEmail)
        .eq('activo', true);

      if (!comisionistas || comisionistas.length === 0) {
        return { comisionPendiente: 0, comisionPagada: 0, ventasActivas: 0, ventasCerradas: 0 };
      }

      // Get cuentas for precio_final and oferta link
      const cuentaIds = [...new Set(comisionistas.map((c: any) => c.id_cuenta_cobranza).filter(Boolean))] as number[];
      let cuentaMap = new Map<number, any>();

      if (cuentaIds.length > 0) {
        const { data: cuentas } = await (supabase as any)
          .from('cuentas_cobranza')
          .select('id, id_oferta, precio_final')
          .in('id', cuentaIds);

        if (cuentas) {
          const ofertaIds = cuentas.map((c: any) => c.id_oferta).filter(Boolean);
          let propStatusMap = new Map<number, number>();

          if (ofertaIds.length > 0) {
            const { data: ofertas } = await (supabase as any)
              .from('ofertas')
              .select('id, id_propiedad')
              .in('id', ofertaIds);

            const propIds = (ofertas || []).map((o: any) => o.id_propiedad).filter(Boolean);
            let ofertaToProp = new Map<number, number>();
            (ofertas || []).forEach((o: any) => { if (o.id_propiedad) ofertaToProp.set(o.id, o.id_propiedad); });

            if (propIds.length > 0) {
              const { data: props } = await (supabase as any)
                .from('propiedades')
                .select('id, id_estatus_disponibilidad')
                .in('id', propIds);
              (props || []).forEach((p: any) => propStatusMap.set(p.id, p.id_estatus_disponibilidad));
            }

            cuentas.forEach((c: any) => {
              const propId = ofertaToProp.get(c.id_oferta);
              cuentaMap.set(c.id, {
                precio_final: c.precio_final || 0,
                propSold: propId ? propStatusMap.get(propId) === 5 : false,
              });
            });
          } else {
            cuentas.forEach((c: any) => cuentaMap.set(c.id, { precio_final: c.precio_final || 0, propSold: false }));
          }
        }
      }

      // Check if agent has factura (doc tipo 46)
      const { data: facturas } = await (supabase as any)
        .from('documentos')
        .select('id')
        .eq('id_persona', personaId)
        .eq('id_tipo_documento', 46)
        .eq('activo', true)
        .limit(1);
      const hasFactura = (facturas || []).length > 0;

      // Calculate detailed status and sums
      let comisionPendiente = 0;
      let comisionPagada = 0;
      let ventasActivas = 0;   // pendiente + en_revision
      let ventasCerradas = 0;  // programada + pagada

      comisionistas.forEach((c: any) => {
        const cuenta = cuentaMap.get(c.id_cuenta_cobranza);
        const precio = cuenta?.precio_final || 0;
        const monto = precio * (c.porcentaje_comision || 0) / 100;

        let status: string;
        if (c.pagada) {
          status = 'pagada';
        } else if (c.aprobada && hasFactura) {
          status = 'programada';
        } else if (c.aprobada && !hasFactura) {
          status = 'factura_requerida';
        } else if (cuenta?.propSold) {
          status = 'en_revision';
        } else {
          status = 'pendiente';
        }

        if (c.pagada) {
          comisionPagada += monto;
        } else {
          comisionPendiente += monto;
        }

        if (status === 'pendiente' || status === 'en_revision' || status === 'factura_requerida') {
          ventasActivas++;
        } else if (status === 'programada' || status === 'pagada') {
          ventasCerradas++;
        }
      });

      return { comisionPendiente, comisionPagada, ventasActivas, ventasCerradas };
    },
    enabled: !!agentEmail,
  });

  // Fetch attention items (ofertas that need action)
  const { data: attentionItems = [], isLoading: attentionLoading } = useQuery({
    queryKey: ['agent-attention', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return [];

      const { data } = await (supabase as any)
        .from('ofertas')
        .select('id, id_estatus_aprobacion, fecha_generacion, id_propiedad, id_persona_lead')
        .eq('email_creador', agentEmail)
        .eq('activo', true)
        .in('id_estatus_aprobacion', [3, 4, 5])
        .order('fecha_generacion', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!agentEmail,
  });

  // Fetch citas agendadas
  const { data: citas = [], isLoading: citasLoading } = useQuery({
    queryKey: ['agent-citas', personaId],
    queryFn: async () => {
      if (!personaId) return [];
      const { data } = await (supabase as any)
        .from('reservas_citas')
        .select('id, fecha, hora_inicio, hora_fin, ubicacion, estatus, id_estatus_cita, id_proyecto, id_persona_prospecto, id_tipo_cita, id_configuracion_cita, notas, proyectos(nombre), tipos_cita(nombre), estatus_cita(nombre), personas!reservas_citas_id_persona_prospecto_fkey(nombre_legal), configuracion_citas_usuarios(nombre)')
        .eq('activo', true)
        .or(`id_agente.eq.${personaId},id_persona.eq.${personaId}`)
        .order('fecha', { ascending: true });
      return data || [];
    },
    enabled: !!personaId,
    staleTime: 0,
  });

  // Real-time subscription for citas updates
  useEffect(() => {
    if (!personaId) return;
    const channel = supabase
      .channel('agent-citas-realtime')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'reservas_citas' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['agent-citas', personaId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [personaId, queryClient]);

  const today = new Date().toISOString().split('T')[0];
  const citasProximas = citas.filter((c: any) => c.fecha >= today);                  // asc (más próxima primero)
  const citasPasadas = citas.filter((c: any) => c.fecha < today).reverse();          // más reciente primero
  const citasToShow = [...citasProximas, ...citasPasadas].slice(0, 3);               // solo 3

  // Color del ícono por estatus: asistió=verde marca, no asistió=gris, pendiente=naranja tenue
  const citaIconClasses = (cita: any) => {
    if (cita.estatus === 'asistio') return 'bg-primary/10 text-primary';
    if (cita.estatus === 'no_asistio') return 'bg-[#F3F4F6] text-[#9AA3AD]';
    return 'bg-[#FEF3C7] text-[#B5601C]';
  };

  const getCitaStatusBadge = (cita: any) => {
    const isPast = cita.fecha < today;
    if (!isPast) {
      return { label: 'Agendada', className: 'bg-blue-100 text-blue-700' };
    }
    if (cita.estatus === 'asistio') {
      return { label: 'Asistió', className: 'bg-green-100 text-green-700' };
    }
    if (cita.estatus === 'no_asistio') {
      return { label: 'No asistió', className: 'bg-red-100 text-red-700' };
    }
    return { label: 'Sin confirmar', className: 'bg-gray-100 text-gray-500' };
  };

  const isLoading = onboardingLoading || metricsLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const hasValidTime = (time: string | null | undefined) => {
    if (!time) return false;
    const t = time.slice(0, 5);
    return t !== '00:00';
  };

  const formatTime = (cita: any) => {
    if (!hasValidTime(cita.hora_inicio)) return null;
    const start = cita.hora_inicio?.slice(0, 5);
    const end = hasValidTime(cita.hora_fin) ? cita.hora_fin.slice(0, 5) : null;
    return end ? `${start} - ${end}` : start;
  };

  const cancelCitaMutation = useMutation({
    mutationFn: async (citaId: number) => {
      const { error } = await (supabase as any)
        .from('reservas_citas')
        .update({ estatus: 'cancelada', id_estatus_cita: null, activo: false })
        .eq('id', citaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-citas'] });
      setSelectedCita(null);
      setCancelConfirmOpen(false);
      toast.success('Cita cancelada exitosamente');
    },
    onError: () => {
      toast.error('Error al cancelar la cita');
    },
  });

  const getStatusLabel = (statusId: number) => {
    switch (statusId) {
      case 3: return "Oferta aprobada";
      case 4: return "Pendiente de firma";
      case 5: return "Pendiente de enganche";
      default: return "Requiere atención";
    }
  };

  return (
    <div className="pb-24">
      <AgentPortalHeader>
        <div className="mx-auto w-full max-w-[1040px]">
          <h1 className="text-[20px] font-bold tracking-[-0.3px] text-[#1A1D21] lg:text-[22px]">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px]">
            <span className="font-semibold text-[hsl(var(--agent-primary))]">{rolLabel}</span>
            <span className="text-[#D6DADE]">·</span>
            <span className="text-[#8A929B]">{mask(String(metrics?.ventasActivas ?? 0))} propiedades activas</span>
            {lastAccessLabel && <><span className="text-[#D6DADE]">·</span><span className="text-[#8A929B]">Último acceso: {lastAccessLabel}</span></>}
          </div>
          {attentionItems.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#B5601C]">
              <AlertCircle className="h-3.5 w-3.5" />
              {attentionItems.length} {attentionItems.length === 1 ? 'acción pendiente' : 'acciones pendientes'}
            </p>
          )}
        </div>
      </AgentPortalHeader>

      <div className="mx-auto max-w-[1040px] py-4 space-y-4">

      {/* Onboarding Progress Banner - only for Agente Inmobiliario */}
      {isAgentRole && percentage < 100 && (
        <div className="w-full rounded-md bg-white border border-[#ECEEF0] shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[hsl(var(--agent-text))]">
              Activa tu perfil profesional
            </span>
            <span className="text-sm font-bold text-[hsl(var(--agent-amber))]">{percentage}%</span>
          </div>
          <p className="text-xs text-[hsl(var(--agent-text-secondary))]">
            {!hasTrainingComplete
              ? 'Completa tu capacitación para generar ofertas.'
              : !hasBasicIdentityComplete
              ? 'Completa tu identidad para incluir datos bancarios en ofertas.'
              : 'Completa tu perfil para recibir comisiones.'}
          </p>
          <div className="h-2 bg-amber-100 rounded-md overflow-hidden">
            <div
              className="h-full bg-[hsl(var(--agent-amber))] rounded-md transition-all duration-700"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <button
            onClick={() => {
              track({ page: 'agent_inicio', elementId: 'btn_completar_perfil', elementLabel: 'Completar ahora' });
              navigate('/admin/agent/perfil');
            }}
            className="text-sm font-semibold text-[hsl(var(--agent-primary))] flex items-center gap-1 active:opacity-70"
          >
            Completar ahora <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Attention Items */}
      {attentionItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[hsl(var(--agent-text))] px-1 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-[hsl(var(--agent-amber))]" />
            Requieren tu atención
          </h2>
          <div className="space-y-2">
            {attentionItems.map((item: any) => (
              <div
                key={item.id}
                onClick={() => {
                  track({ page: 'agent_inicio', elementId: 'btn_atencion_item', elementLabel: 'Item atención', metadata: { oferta_id: item.id } });
                }}
                className="rounded-md bg-white border border-[#ECEEF0] shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-3 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-md bg-amber-50 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--agent-text))] truncate">
                    {(item.personas as any)?.nombre_legal || "Cliente"}
                  </p>
                  <p className="text-xs text-[hsl(var(--agent-text-secondary))] truncate">
                    {getStatusLabel(item.id_estatus_aprobacion)} · {(item.propiedades as any)?.proyectos?.nombre}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-[hsl(var(--agent-muted))] shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions - solo si tiene permiso de crear */}
      {inicioPerms.canCreate && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickAction
            dataCta="agentes.inicio.nuevo-prospecto"
            icon={UserPlus}
            title="Nuevo prospecto"
            subtitle="Captura un comprador potencial"
            onClick={() => {
              track({ page: 'agent_inicio', elementId: 'btn_nuevo_prospecto', elementLabel: 'Nuevo prospecto' });
              setAddProspectoOpen(true);
            }}
          />
          <QuickAction
            dataCta="agentes.inicio.agendar-cita"
            icon={CalendarPlus}
            title="Agendar cita"
            subtitle="Coordina una visita al desarrollo"
            onClick={() => {
              track({ page: 'agent_inicio', elementId: 'btn_agendar_cita', elementLabel: 'Agendar cita' });
              setAgendarCitaOpen(true);
            }}
          />
        </div>
      )}

      {/* Metrics */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A929B]">
            Tus números
          </h2>
          {presentationMode && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#EBC089] bg-[#FBE3CE] px-2.5 py-1 text-[10.5px] font-bold text-[#B5601C]">
              <EyeOff className="h-3 w-3" />
              Ocultos · desactiva Modo presentación
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[#9AA3AD]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Comisión pagada"
              labelClass="text-[hsl(158_64%_38%)]"
              valueClass="text-[hsl(158_64%_38%)]"
              value={mask(formatCurrency(metrics?.comisionPagada || 0))}
              sublabel="cobrado"
              onClick={() => navigate('/admin/agent/comisiones')}
            />
            <MetricCard
              label="Comisión pendiente"
              labelClass="text-[#B5601C]"
              value={mask(formatCurrency(metrics?.comisionPendiente || 0))}
              sublabel="por cobrar"
              onClick={() => navigate('/admin/agent/comisiones')}
            />
            <MetricCard
              label="Ventas activas"
              labelClass="text-[hsl(158_64%_38%)]"
              valueClass="text-[hsl(158_64%_38%)]"
              variant="count"
              value={mask(String(metrics?.ventasActivas || 0))}
              sublabel="en proceso"
              onClick={() => navigate('/admin/agent/comisiones')}
            />
            <MetricCard
              label="Ventas cerradas"
              variant="count"
              value={mask(String(metrics?.ventasCerradas || 0))}
              sublabel="completadas"
              onClick={() => navigate('/admin/agent/comisiones')}
            />
          </div>
        )}
      </div>

      {/* Citas agendadas */}
      {citasToShow.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A929B]">Citas</h2>
          <div className="space-y-2">
            {citasToShow.map((cita: any) => {
              const time = formatTime(cita);
              const badge = getCitaStatusBadge(cita);
              return (
                <div
                  key={cita.id}
                  onClick={() => setSelectedCita(cita)}
                  className="group flex items-center gap-3 rounded-md border border-[#E7E9EC] bg-white p-3 cursor-pointer transition-colors hover:border-[#CBD2D9]"
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", citaIconClasses(cita))}>
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-[#1A1D21]">
                        {cita.configuracion_citas_usuarios?.nombre || [cita.tipos_cita?.nombre, cita.proyectos?.nombre].filter(Boolean).join(' ') || 'Cita'}
                      </p>
                      <span className="shrink-0 whitespace-nowrap rounded-md bg-[hsl(var(--agent-primary))]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[hsl(var(--agent-primary))]">
                        {cita.tipos_cita?.nombre || 'Cita'}
                      </span>
                    </div>
                    {cita.personas?.nombre_legal && (
                      <p className="truncate text-xs font-medium text-[#4B5563]">{cita.personas.nombre_legal}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[#8A929B]">
                      <Clock className="h-3 w-3" />
                      {new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}{time ? ` · ${time}` : ''}
                      {cita.ubicacion && <span className="truncate">· {cita.ubicacion}</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {inicioPerms.canCreate && (
        <>
          <AddProspectoFloatingDialog open={addProspectoOpen} onOpenChange={setAddProspectoOpen} />
          <AgendarCitaShowroomDialog
            open={agendarCitaOpen}
            onOpenChange={(v) => { setAgendarCitaOpen(v); if (!v) setRescheduleData(null); }}
            rescheduleData={rescheduleData}
          />
          {personaId && (
            <AgentOnboardingStepDialog
              step="training"
              personaId={personaId}
              open={trainingDialogOpen}
              onOpenChange={setTrainingDialogOpen}
            />
          )}
        </>
      )}

      {/* Cita Detail Modal */}
      <Dialog open={!!selectedCita} onOpenChange={(open) => { if (!open) { setSelectedCita(null); setCancelConfirmOpen(false); } }}>
        <DialogContent className="sm:max-w-md bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {selectedCita?.configuracion_citas_usuarios?.nombre || [selectedCita?.tipos_cita?.nombre, selectedCita?.proyectos?.nombre].filter(Boolean).join(' · ') || 'Cita'}
            </DialogTitle>
            <DialogDescription className="sr-only">Detalle de la cita</DialogDescription>
          </DialogHeader>
          {selectedCita && (() => {
            const time = formatTime(selectedCita);
            const badge = getCitaStatusBadge(selectedCita);
            const isPast = selectedCita.fecha < today;
            const isCancelled = selectedCita.estatus === 'cancelada' || selectedCita.estatus === 'no_asistio';
            const canModify = !isPast && !isCancelled;

            return (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${badge.className}`}>
                    {badge.label}
                  </span>
                  {selectedCita.estatus_cita?.nombre && (
                    <span className="text-xs text-gray-500">{selectedCita.estatus_cita.nombre}</span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-3 bg-gray-50 rounded-md p-3">
                  {selectedCita.personas?.nombre_legal && (
                    <div className="flex items-start gap-2.5">
                      <UserPlus className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Prospecto</p>
                        <p className="text-sm font-medium">{selectedCita.personas.nombre_legal}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Fecha</p>
                      <p className="text-sm font-medium">
                        {new Date(selectedCita.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  {time && (
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Horario</p>
                        <p className="text-sm font-medium">{time}</p>
                      </div>
                    </div>
                  )}
                  {selectedCita.ubicacion && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Ubicación</p>
                        <p className="text-sm font-medium">{selectedCita.ubicacion}</p>
                      </div>
                    </div>
                  )}
                  {selectedCita.notas && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Notas</p>
                      <p className="text-sm text-gray-700">{selectedCita.notas}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canModify && (
                  cancelConfirmOpen ? (
                    <div className="space-y-2 bg-red-50 rounded-md p-3">
                      <p className="text-sm font-medium text-red-800">¿Estás seguro de cancelar esta cita?</p>
                      <p className="text-xs text-red-600">Esta acción no se puede deshacer.</p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => cancelCitaMutation.mutate(selectedCita.id)}
                          disabled={cancelCitaMutation.isPending}
                        >
                          {cancelCitaMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                          Sí, cancelar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelConfirmOpen(false)}
                        >
                          No, volver
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setCancelConfirmOpen(true)}
                      >
                        <Ban className="h-4 w-4 mr-1.5" />
                        Cancelar cita
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          const isTraining = selectedCita.id_tipo_cita === 1;
                          if (isTraining) {
                            setSelectedCita(null);
                            setTrainingDialogOpen(true);
                          } else {
                            setRescheduleData({
                              prospectoId: String(selectedCita.id_persona_prospecto),
                              proyectoId: selectedCita.id_proyecto,
                              prospectoName: selectedCita.personas?.nombre_legal || '',
                              proyectoName: selectedCita.proyectos?.nombre || '',
                            });
                            setSelectedCita(null);
                            setAgendarCitaOpen(true);
                          }
                        }}
                      >
                        <CalendarClock className="h-4 w-4 mr-1.5" />
                        Reagendar
                      </Button>
                    </div>
                  )
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
};

function QuickAction({ icon: Icon, title, subtitle, onClick, dataCta }: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  dataCta: string;
}) {
  return (
    <button
      data-cta={dataCta}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-md border border-[#E7E9EC] bg-white p-3.5 text-left transition-colors duration-150 hover:border-[#CBD2D9] hover:bg-[#FAFBFC]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-[#1A1D21]">{title}</span>
        <span className="block text-[11.5px] text-[#8A929B]">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#C4CBD3] transition-colors duration-150 group-hover:text-[#8A929B]" />
    </button>
  );
}

function MetricCard({ label, value, sublabel, variant = 'money', labelClass, valueClass, onClick }: {
  label: string;
  value: string;
  sublabel?: string;
  variant?: 'money' | 'count';
  labelClass?: string;
  valueClass?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-md border border-[#E7E9EC] bg-white p-4 text-left transition-shadow duration-150 hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.08em]", labelClass || "text-[#8A929B]")}>{label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#C7CDD4] transition-colors group-hover:text-[hsl(158_64%_38%)]" strokeWidth={1.75} />
      </div>
      <p className={cn(
        "font-bold leading-none tabular-nums",
        variant === 'count' ? "text-[28px]" : "text-[19px] whitespace-nowrap tracking-[-0.3px]",
        valueClass || "text-[#1A1D21]"
      )}>{value}</p>
      {sublabel && <p className="mt-1.5 text-[11px] leading-snug text-[#9AA3AD]">{sublabel}</p>}
    </button>
  );
}

export default AgentInicio;
