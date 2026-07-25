import { AddProspectoFloatingDialog } from "@/components/admin/AddProspectoFloatingDialog";
import { AgendarCitaShowroomDialog } from "@/components/admin/AgendarCitaShowroomDialog";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { AgentOnboardingStepDialog } from "@/components/admin/AgentOnboardingStepDialog";
import { Button } from "@/components/ui/button";
import { ActionCard } from "@/components/ui/ActionCard";
import { StatCard } from "@/components/ui/StatCard";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ModalForm } from "@/components/ui/ModalForm";
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
import {
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
    if (cita.estatus === 'no_asistio') return 'bg-gray-100 text-gray-400';
    return 'bg-amber-100 text-amber-700';
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

  return (
    <div className="pb-24">
      <AgentPortalHeader>
        <div className="mx-auto w-full max-w-[1040px]">
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
            <span className="font-semibold text-primary">{rolLabel}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">{mask(String(metrics?.ventasActivas ?? 0))} propiedades activas</span>
            {lastAccessLabel && <><span className="text-muted-foreground/40">·</span><span className="text-muted-foreground">Último acceso: {lastAccessLabel}</span></>}
          </div>
        </div>
      </AgentPortalHeader>

      <div className="mx-auto max-w-[1040px] py-4 space-y-4">

      {/* Onboarding Progress Banner - only for Agente Inmobiliario */}
      {isAgentRole && percentage < 100 && (
        <Card className="w-full space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              Activa tu perfil profesional
            </span>
            <span className="text-sm font-bold text-amber-600">{percentage}%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {!hasTrainingComplete
              ? 'Completa tu capacitación para generar ofertas.'
              : !hasBasicIdentityComplete
              ? 'Completa tu identidad para incluir datos bancarios en ofertas.'
              : 'Completa tu perfil para recibir comisiones.'}
          </p>
          <Progress value={percentage} className="h-2 bg-amber-100 [&>*]:bg-amber-500" />
          <Button
            variant="link"
            className="h-auto gap-1 p-0 text-sm font-semibold"
            onClick={() => {
              track({ page: 'agent_inicio', elementId: 'btn_completar_perfil', elementLabel: 'Completar ahora' });
              navigate('/admin/agent/perfil');
            }}
          >
            Completar ahora <ChevronRight className="h-4 w-4" />
          </Button>
        </Card>
      )}

      {/* Quick Actions - solo si tiene permiso de crear */}
      {inicioPerms.canCreate && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            dataCta="agentes.inicio.nuevo-prospecto"
            icon={UserPlus}
            title="Nuevo prospecto"
            subtitle="Captura un comprador potencial"
            onClick={() => {
              track({ page: 'agent_inicio', elementId: 'btn_nuevo_prospecto', elementLabel: 'Nuevo prospecto' });
              setAddProspectoOpen(true);
            }}
          />
          <ActionCard
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tus números
          </h2>
          {presentationMode && (
            <Badge variant="outline" className="gap-1.5 border-amber-300 bg-amber-100 text-amber-700">
              <EyeOff className="h-3 w-3" />
              Ocultos · desactiva Modo presentación
            </Badge>
          )}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Comisión pagada"
              tone="success"
              value={mask(formatCurrency(metrics?.comisionPagada || 0))}
              sublabel="cobrado"
              onClick={() => navigate('/admin/agent/comisiones')}
            />
            <StatCard
              label="Comisión pendiente"
              tone="warning"
              value={mask(formatCurrency(metrics?.comisionPendiente || 0))}
              sublabel="por cobrar"
              onClick={() => navigate('/admin/agent/comisiones')}
            />
            <StatCard
              label="Ventas activas"
              tone="success"
              size="count"
              value={mask(String(metrics?.ventasActivas || 0))}
              sublabel="en proceso"
              onClick={() => navigate('/admin/agent/comisiones')}
            />
            <StatCard
              label="Ventas cerradas"
              size="count"
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Citas</h2>
          <div className="space-y-2">
            {citasToShow.map((cita: any) => {
              const time = formatTime(cita);
              const badge = getCitaStatusBadge(cita);
              return (
                <Card
                  key={cita.id}
                  onClick={() => setSelectedCita(cita)}
                  className="flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-accent"
                >
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", citaIconClasses(cita))}>
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {cita.configuracion_citas_usuarios?.nombre || [cita.tipos_cita?.nombre, cita.proyectos?.nombre].filter(Boolean).join(' ') || 'Cita'}
                      </p>
                      <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary hover:bg-primary/10">
                        {cita.tipos_cita?.nombre || 'Cita'}
                      </Badge>
                    </div>
                    {cita.personas?.nombre_legal && (
                      <p className="truncate text-sm text-muted-foreground">{cita.personas.nombre_legal}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}{time ? ` · ${time}` : ''}
                      {cita.ubicacion && <span className="truncate">· {cita.ubicacion}</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 self-start whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </Card>
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
      <ModalForm
        open={!!selectedCita}
        onOpenChange={(open) => { if (!open) { setSelectedCita(null); setCancelConfirmOpen(false); } }}
        title={selectedCita?.configuracion_citas_usuarios?.nombre || [selectedCita?.tipos_cita?.nombre, selectedCita?.proyectos?.nombre].filter(Boolean).join(' · ') || 'Cita'}
        subtitle="Detalle de la cita"
        className="sm:max-w-md"
        footer={selectedCita && !(selectedCita.fecha < today) && !(selectedCita.estatus === 'cancelada' || selectedCita.estatus === 'no_asistio') ? (
          cancelConfirmOpen ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setCancelConfirmOpen(false)}>No, volver</Button>
              <Button variant="destructive" size="sm" onClick={() => cancelCitaMutation.mutate(selectedCita.id)} disabled={cancelCitaMutation.isPending}>
                {cancelCitaMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                Sí, cancelar
              </Button>
            </>
          ) : (
            <>
              <Button variant="cancel" onClick={() => setCancelConfirmOpen(true)}>
                <Ban className="h-4 w-4" /> Cancelar cita
              </Button>
              <Button
                variant="primary-outline"
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
                <CalendarClock className="h-4 w-4" /> Reagendar
              </Button>
            </>
          )
        ) : undefined}
      >
        {selectedCita && (() => {
          const time = formatTime(selectedCita);
          const rows = [
            selectedCita.personas?.nombre_legal && { icon: UserPlus, label: "Prospecto", value: selectedCita.personas.nombre_legal },
            { icon: Calendar, label: "Fecha", value: new Date(selectedCita.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
            time && { icon: Clock, label: "Horario", value: time },
            selectedCita.ubicacion && { icon: MapPin, label: "Ubicación", value: selectedCita.ubicacion },
          ].filter(Boolean) as { icon: typeof Calendar; label: string; value: string }[];
          return (
            <>
              {/* Detalles — lista aireada, sin divisores */}
              <div className="space-y-4">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <row.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedCita.notas && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Notas</p>
                  <p className="text-sm text-foreground">{selectedCita.notas}</p>
                </div>
              )}

              {/* Confirmación de cancelación */}
              {cancelConfirmOpen && (
                <div className="space-y-1 rounded-md bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-800">¿Estás seguro de cancelar esta cita?</p>
                  <p className="text-xs text-red-600">Esta acción no se puede deshacer.</p>
                </div>
              )}
            </>
          );
        })()}
      </ModalForm>

      </div>
    </div>
  );
};

export default AgentInicio;
