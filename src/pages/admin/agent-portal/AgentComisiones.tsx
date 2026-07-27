import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { ComisionesTable, comisionEstatus, COMISION_ESTATUS_LABEL, type ComisionEstatus } from "@/components/admin/comisiones/ComisionesTable";
import { FacturaUploadButton, subirFacturaComision } from "@/components/admin/comisiones/FacturaUploadButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FILTER_LABEL_CLS } from "@/components/ui/modal-filters";
import { ModalViewer } from "@/components/ui/modal-viewer";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useComisionesPorEmail } from "@/hooks/useComisionesPorEmail";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, EyeOff, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AgentComisiones = () => {
  const { profile, user } = useAuth();
  const { impersonatedAgentEmail, impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const agentEmail = isImpersonating ? impersonatedAgentEmail : (user?.email || profile?.email);
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const { steps, percentage, isLoading: onboardingLoading, canAccessComisiones, missingForComisiones } = useAgentOnboardingStatus(personaId);
  const { presentationMode, mask } = useAgentPresentation();
  const [filterProyecto, setFilterProyecto] = useState<string>('todos');
  const [searchCliente, setSearchCliente] = useState<string>('');
  const [filterEstatus, setFilterEstatus] = useState<string>('todos');
  const [viewerDoc, setViewerDoc] = useState<{ url: string; title: string } | null>(null);
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/comisiones');
    track({ page: 'agent_comisiones', elementId: 'page_view', elementType: 'page' });
  }, []);

  // Use the centralized canAccessComisiones from the hook
  const canReceivePayments = canAccessComisiones;

  // Comisiones del agente (lógica compartida con el portal de embajadores).
  const { comisiones, isLoading: comisionesLoading } = useComisionesPorEmail(agentEmail, {
    queryKey: ['agent-comisiones', agentEmail],
  });

  const isLoading = onboardingLoading || comisionesLoading;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const totalCobrado = comisiones
    .filter((c: any) => c.detailed_status === 'pagada')
    .reduce((sum: number, c: any) => sum + (c.monto_comision || 0), 0);

  const totalPorCobrar = comisiones
    .filter((c: any) => c.detailed_status !== 'pagada')
    .reduce((sum: number, c: any) => sum + (c.monto_comision || 0), 0);

  // Opciones de filtro derivadas de los datos.
  const proyectoOptions = [...new Set(comisiones.map((c: any) => c.proyecto).filter(Boolean))].sort() as string[];
  const estatusOptions = [...new Set(comisiones.map((c: any) => comisionEstatus(c.detailed_status)))] as ComisionEstatus[];

  // Filtros: "Todos" primero, luego lo que traigan las comisiones cargadas.
  const proyectoFilterOptions: SearchableOption[] = [
    { value: 'todos', label: 'Todos' },
    ...proyectoOptions.map((p) => ({ value: p, label: p })),
  ];
  const estatusFilterOptions: SearchableOption[] = [
    { value: 'todos', label: 'Todos los estatus' },
    ...estatusOptions.map((s) => ({ value: s, label: COMISION_ESTATUS_LABEL[s] })),
  ];

  const filteredComisiones = comisiones.filter((c: any) => {
    if (filterProyecto !== 'todos' && c.proyecto !== filterProyecto) return false;
    if (filterEstatus !== 'todos' && comisionEstatus(c.detailed_status) !== filterEstatus) return false;
    if (searchCliente.trim()) {
      const q = searchCliente.trim().toLowerCase();
      const hit = (c.clientes || []).some((cl: any) =>
        (cl.nombre || '').toLowerCase().includes(q) || (cl.email || '').toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  // Blocked state - only for Agente Inmobiliario role
  if (isAgentRole && !onboardingLoading && !canReceivePayments) {
    return (
      <div >
        <AgentPortalHeader />
        <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
        <div className="rounded-md border border-border bg-card p-5 space-y-4 shadow-[0_1px_3px_rgba(20,30,25,0.04)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <Lock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Perfil incompleto</p>
              <p className="text-xs text-muted-foreground">
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
          > Completar perfil
          </Button>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div >
      <AgentPortalHeader />

      <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
      {/* Banner modo presentación */}
      {presentationMode && (
        <div>
          <div className="flex items-center gap-2.5 rounded-md border border-amber-300 bg-orange-100 px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-orange-700" />
            <span className="text-xs font-semibold text-orange-700">
              Modo presentación activo · tus ingresos están ocultos. Desactívalo en la barra superior para verlos.
            </span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="rounded-md border border-primary bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary/70">Total cobrado</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-primary">{mask(formatCurrency(totalCobrado))}</p>
          <p className="mt-1 text-xs font-semibold text-primary/60">MXN · acumulado</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Por cobrar</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{mask(formatCurrency(totalPorCobrar))}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground/70">MXN · en proceso</p>
        </div>
      </div>

      {/* Filtros (estilo portal cobranza): Proyecto · Cliente · Estatus */}
      <div className="grid grid-cols-2 gap-3 items-end sm:flex sm:flex-wrap sm:gap-3">
        <div className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL_CLS}>Proyecto</span>
          <SearchableSelect
            value={filterProyecto}
            onValueChange={(v) => setFilterProyecto(v || 'todos')}
            options={proyectoFilterOptions}
            className="w-full sm:w-[160px]"
            contentClassName="min-w-[220px]"
            itemsLabel="proyectos"
            searchPlaceholder="Buscar proyecto…"
            aria-label="Filtrar por proyecto"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL_CLS}>Cliente</span>
          <Input
            value={searchCliente}
            onChange={(e) => setSearchCliente(e.target.value)}
            placeholder="Nombre o correo"
            className="w-full sm:w-[180px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={FILTER_LABEL_CLS}>Estatus</span>
          <SearchableSelect
            value={filterEstatus}
            onValueChange={(v) => setFilterEstatus(v || 'todos')}
            options={estatusFilterOptions}
            className="w-full sm:w-[170px]"
            contentClassName="min-w-[220px]"
            itemsLabel="estatus"
            aria-label="Filtrar por estatus"
          />
        </div>
      </div>

      {/* Tabla de comisiones (componente global reutilizable) */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
        </div>
      ) : (
        <ComisionesTable
          rows={filteredComisiones}
          mask={mask}
          onView={(url, title) => setViewerDoc({ url, title })}
          emptyLabel={comisiones.length === 0 ? 'Aún no tienes comisiones' : 'Sin comisiones con estos filtros'}
          renderFacturaUpload={(row) => {
            // Puede subir su factura si la comisión está APROBADA o PAGADA (y aún no hay factura).
            const est = comisionEstatus(row.detailed_status);
            return (est === 'aprobado' || est === 'pagada') && agentEmail && personaId ? (
              <FacturaUploadButton
                title="Factura de comisión"
                subtitle="Sube el PDF de tu factura"
                tooltip="Subir factura (PDF)"
                onClick={() => track({ page: 'agent_comisiones', elementId: 'btn_subir_factura_agent', elementLabel: 'Subir factura (PDF)', metadata: { cuentaId: row.id_cuenta_cobranza } })}
                onUpload={async (file) => {
                  await subirFacturaComision({ file, cuentaId: row.id_cuenta_cobranza, personaId, email: agentEmail, supabase });
                  queryClient.invalidateQueries({ queryKey: ['agent-comisiones', agentEmail] });
                }}
              />
            ) : null;
          }}
        />
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
      <span className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

export default AgentComisiones;
