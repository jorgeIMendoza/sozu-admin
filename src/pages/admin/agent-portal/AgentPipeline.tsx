import { useState, useMemo, useEffect } from "react";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Plus, Lock, Mail, Search, ExternalLink, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { PipelineOfferDetailDialog } from "@/components/admin/agent-portal/PipelineOfferDetailDialog";

const STAGES = [
  { key: 'all', label: 'Todas', color: 'bg-gray-100 text-gray-800', borderColor: 'border-gray-400' },
  { key: 'nuevas', label: 'Nuevas', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-400' },
  { key: 'pendientes', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-400' },
  { key: 'aprobadas', label: 'Aprobadas', color: 'bg-green-100 text-green-800', borderColor: 'border-green-400' },
  { key: 'rechazadas', label: 'Rechazadas', color: 'bg-red-100 text-red-800', borderColor: 'border-red-400' },
  { key: 'revision', label: 'Revisión', color: 'bg-purple-100 text-purple-800', borderColor: 'border-purple-400' },
  { key: 'apartado', label: 'Apartado', color: 'bg-orange-100 text-orange-800', borderColor: 'border-orange-400' },
  { key: 'gen_contrato', label: 'Contrato', color: 'bg-indigo-100 text-indigo-800', borderColor: 'border-indigo-400' },
  { key: 'firma_contrato', label: 'Firma', color: 'bg-teal-100 text-teal-800', borderColor: 'border-teal-400' },
  { key: 'cierre', label: 'Cierre', color: 'bg-emerald-100 text-emerald-800', borderColor: 'border-emerald-500' },
  { key: 'expiradas', label: 'Expiradas', color: 'bg-gray-100 text-gray-500', borderColor: 'border-gray-300' },
] as const;

// Same MIN_DATE as WorkflowOffers: 1 month
const MIN_DATE = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
})();

function isVigente(fechaGeneracion: string): boolean {
  const expira = new Date(fechaGeneracion);
  expira.setDate(expira.getDate() + 5);
  return expira >= new Date();
}

function classifyOffer(o: any): string {
  if (o.estatus_disponibilidad === 5) return 'cierre';
  if (o.tiene_contrato_firmado) return 'firma_contrato';
  if (o.contrato_draft) return 'gen_contrato';
  if (o.cuenta_cobranza_id && o.estatus_disponibilidad === 4) return 'apartado';

  const vigente = isVigente(o.fecha_generacion);
  if (!vigente && !o.cuenta_cobranza_id) return 'expiradas';

  if (!o.id_esquema_pago_seleccionado) return vigente ? 'nuevas' : 'expiradas';

  if (o.id_estatus_aprobacion === 1) return vigente ? 'pendientes' : 'expiradas';
  if (o.id_estatus_aprobacion === 2) return 'aprobadas';
  if (o.id_estatus_aprobacion === 3) return vigente ? 'rechazadas' : 'expiradas';
  if (o.id_estatus_aprobacion === 4) return vigente ? 'revision' : 'expiradas';

  return 'nuevas';
}

const AgentPipeline = () => {
  const { profile, user } = useAuth();
  const { impersonatedAgentEmail, isImpersonating } = useAgentImpersonation();
  const navigate = useNavigate();
  const agentEmail = isImpersonating ? impersonatedAgentEmail : (user?.email || profile?.email);
  const personaId = profile?.id_persona;
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const { hasTrainingComplete, isLoading: onboardingLoading } = useAgentOnboardingStatus(personaId);
  const [activeStage, setActiveStage] = useState<string>('all');
  const [searchProspecto, setSearchProspecto] = useState<string>('');
  const [selectedOferta, setSelectedOferta] = useState<any>(null);
  const { permissions } = useAgentPortalPermissions();
  const pipelinePerms = permissions['/admin/agent/pipeline'];
  const { presentationMode, mask } = useAgentPresentation();
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/pipeline');
    track({ page: 'agent_pipeline', elementId: 'page_view', elementType: 'page' });
  }, []);

  const { data: ofertas = [], isLoading } = useQuery({
    queryKey: ['agent-pipeline', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return [];

      const { data: ofertasData } = await (supabase as any)
        .from('ofertas')
        .select('id, email_creador, fecha_generacion, fecha_creacion, id_esquema_pago_seleccionado, id_estatus_aprobacion, activo, id_propiedad, id_persona_lead, id_producto, url')
        .eq('email_creador', agentEmail)
        .eq('activo', true)
        .gte('fecha_generacion', MIN_DATE)
        .order('fecha_generacion', { ascending: false });

      if (!ofertasData || ofertasData.length === 0) return [];

      const propIds = [...new Set(ofertasData.map((o: any) => o.id_propiedad).filter(Boolean))] as number[];
      const leadIds = [...new Set(ofertasData.map((o: any) => o.id_persona_lead).filter(Boolean))] as number[];
      const productoIds = [...new Set(ofertasData.map((o: any) => o.id_producto).filter(Boolean))] as number[];
      const ofertaIds = ofertasData.map((o: any) => o.id);

      const [propRes, leadRes, cuentaRes, productosRes] = await Promise.all([
        propIds.length > 0
          ? (supabase as any).from('propiedades').select('id, numero_propiedad, precio_lista, id_estatus_disponibilidad, id_edificio_modelo').in('id', propIds)
          : { data: [] as any[] },
        leadIds.length > 0
          ? (supabase as any).from('personas').select('id, nombre_legal, nombre_comercial').in('id', leadIds)
          : { data: [] as any[] },
        ofertaIds.length > 0
          ? (supabase as any).from('cuentas_cobranza').select('id, id_oferta, contrato_draft').in('id_oferta', ofertaIds).eq('activo', true)
          : { data: [] as any[] },
        productoIds.length > 0
          ? (supabase as any).from('productos_servicios').select('id, nombre, precio_lista, id_proyecto').in('id', productoIds)
          : { data: [] as any[] },
      ]) as [{ data: any[] }, { data: any[] }, { data: any[] }, { data: any[] }];

      // Build proyecto map from propiedades (edificios_modelos -> edificios -> proyectos)
      const edModeloIds = [...new Set((propRes.data || []).map((p: any) => p.id_edificio_modelo).filter(Boolean))];
      let propToProject = new Map<number, string>();

      if (edModeloIds.length > 0) {
        const { data: edModelos } = await (supabase as any)
          .from('edificios_modelos').select('id, id_edificio').in('id', edModeloIds);
        const edificioIds = [...new Set((edModelos || []).map((em: any) => em.id_edificio).filter(Boolean))];
        if (edificioIds.length > 0) {
          const { data: edificios } = await (supabase as any)
            .from('edificios').select('id, id_proyecto').in('id', edificioIds);
          const projIds = [...new Set((edificios || []).map((e: any) => e.id_proyecto).filter(Boolean))];
          if (projIds.length > 0) {
            const { data: projs } = await (supabase as any)
              .from('proyectos').select('id, nombre').in('id', projIds);
            const projMap = new Map((projs || []).map((p: any) => [p.id, p.nombre]));
            const edToProjId = new Map((edificios || []).map((e: any) => [e.id, e.id_proyecto]));
            const emToEdId = new Map((edModelos || []).map((em: any) => [em.id, em.id_edificio]));
            (propRes.data || []).forEach((p: any) => {
              const edId = emToEdId.get(p.id_edificio_modelo);
              const projId = edId ? edToProjId.get(edId) : null;
              const projName = projId ? (projMap.get(projId) as string) : null;
              if (projName) propToProject.set(p.id, projName);
            });
          }
        }
      }

      // Also get project names for productos
      const productoProjIds = [...new Set((productosRes.data || []).map((p: any) => p.id_proyecto).filter(Boolean))] as number[];
      let productoToProject = new Map<number, string>();
      if (productoProjIds.length > 0) {
        const { data: projs } = await (supabase as any)
          .from('proyectos').select('id, nombre').in('id', productoProjIds);
        (projs || []).forEach((p: any) => productoToProject.set(p.id, p.nombre));
      }

      // Check for signed contracts
      const cuentaIds = (cuentaRes.data || []).map((c: any) => c.id);
      let signedSet = new Set<number>();
      if (cuentaIds.length > 0) {
        const { data: docs } = await (supabase as any)
          .from('documentos')
          .select('id_cuenta_cobranza')
          .in('id_cuenta_cobranza', cuentaIds)
          .eq('id_tipo_documento', 42)
          .eq('activo', true);
        (docs || []).forEach((d: any) => signedSet.add(d.id_cuenta_cobranza));
      }

      // Get inmobiliaria for the agent
      let inmobiliariaNombre = '';
      const { data: usrData } = await (supabase as any)
        .from('usuarios').select('id_persona').eq('email', agentEmail).eq('activo', true).limit(1);
      if (usrData && usrData[0]?.id_persona) {
        const agentPersonaId = usrData[0].id_persona;
        const { data: erData } = await (supabase as any)
          .from('entidades_relacionadas')
          .select('id_persona_duena_lead')
          .eq('id_persona', agentPersonaId)
          .eq('id_tipo_entidad', 19)
          .eq('activo', true)
          .limit(1);
        if (erData && erData[0]?.id_persona_duena_lead) {
          const { data: inmobPersona } = await (supabase as any)
            .from('personas').select('nombre_comercial, nombre_legal').eq('id', erData[0].id_persona_duena_lead).limit(1);
          inmobiliariaNombre = inmobPersona?.[0]?.nombre_comercial || inmobPersona?.[0]?.nombre_legal || '';
        }
      }

      const propMap = new Map<number, any>((propRes.data || []).map((p: any) => [p.id, p]));
      const leadMap = new Map<number, string>((leadRes.data || []).map((l: any) => [l.id, l.nombre_legal || l.nombre_comercial || 'Sin nombre']));
      const productoMap = new Map<number, any>((productosRes.data || []).map((p: any) => [p.id, p]));
      const cuentaByOferta = new Map<number, any>();
      (cuentaRes.data || []).forEach((c: any) => { if (c.id_oferta) cuentaByOferta.set(c.id_oferta, c); });

      return ofertasData.map((o: any) => {
        const prop = propMap.get(o.id_propiedad);
        const producto = o.id_producto ? productoMap.get(o.id_producto) : null;
        const cuenta = cuentaByOferta.get(o.id);
        const isProducto = !!o.id_producto;
        const proyectoNombre = isProducto
          ? (producto?.id_proyecto ? productoToProject.get(producto.id_proyecto) || '' : '')
          : (propToProject.get(o.id_propiedad) || '');

        const enriched = {
          ...o,
          lead_nombre: leadMap.get(o.id_persona_lead) || 'Sin prospecto',
          propiedad_nombre: prop?.numero_propiedad || '',
          producto_nombre: producto?.nombre || '',
          precio: isProducto ? (producto?.precio_lista || null) : (prop?.precio_lista || null),
          proyecto_nombre: proyectoNombre,
          inmobiliaria_nombre: inmobiliariaNombre || 'Interno',
          estatus_disponibilidad: prop?.id_estatus_disponibilidad,
          cuenta_cobranza_id: cuenta?.id,
          contrato_draft: cuenta?.contrato_draft,
          tiene_contrato_firmado: cuenta ? signedSet.has(cuenta.id) : false,
          is_producto: isProducto,
        };
        enriched.stage = classifyOffer(enriched);
        return enriched;
      });
    },
    enabled: !!agentEmail,
    staleTime: 30_000,
  });

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    ofertas.forEach((o: any) => {
      if (!map[o.stage]) map[o.stage] = [];
      map[o.stage].push(o);
    });
    return map;
  }, [ofertas]);

  const nonExpiredOfertas = useMemo(() => ofertas.filter((o: any) => o.stage !== 'expiradas'), [ofertas]);

  const displayOfertas = useMemo(() => {
    let result = activeStage === 'all' ? nonExpiredOfertas : (grouped[activeStage] || []);
    if (searchProspecto.trim()) {
      const q = searchProspecto.trim().toLowerCase();
      result = result.filter((o: any) => (o.lead_nombre || "").toLowerCase().includes(q));
    }
    return result;
  }, [nonExpiredOfertas, grouped, activeStage, searchProspecto]);

  const totalMonto = useMemo(() => {
    return nonExpiredOfertas.reduce((sum: number, o: any) => sum + (o.precio || 0), 0);
  }, [nonExpiredOfertas]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(v);

  const getStageInfo = (stage: string) => {
    return STAGES.find(s => s.key === stage) || STAGES[0];
  };

  return (
    <div className="pb-24">
      <AgentPortalHeader />

      {/* Toolbar */}
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3 pt-1 pb-3">
        {!isLoading ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A929B]">
            {nonExpiredOfertas.length} ofertas · {mask(formatCurrency(totalMonto))} · últimos 30 días
          </p>
        ) : <span />}
        {pipelinePerms.canCreate && (
          isAgentRole && !onboardingLoading && !hasTrainingComplete ? (
            <span className="flex items-center gap-1 text-xs font-medium text-[#9AA3AD]">
              <Lock className="h-3.5 w-3.5" /> Completa tu capacitación
            </span>
          ) : (
            <Button
              onClick={() => {
                track({ page: 'agent_pipeline', elementId: 'btn_nueva_oferta', elementLabel: 'Nueva oferta' });
                navigate('/admin/agent/inventario/unidades?openFilters=true');
              }}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Nueva oferta
            </Button>
          )
        )}
      </div>

      {/* Stage Filters */}
      <ScrollArea className="mx-auto w-full max-w-[1040px] pb-3">
        <div className="flex gap-2 py-1">
          {STAGES.map(stage => {
            const count = stage.key === 'all' ? nonExpiredOfertas.length : (grouped[stage.key]?.length || 0);
            const isActive = activeStage === stage.key;
            if (stage.key !== 'all' && count === 0) return null;
            return (
              <button
                key={stage.key}
                onClick={() => {
                  track({ page: 'agent_pipeline', elementId: 'btn_filtro_etapa', elementLabel: stage.label, metadata: { etapa: stage.key } });
                  setActiveStage(stage.key);
                }}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md border px-3.5 py-2 text-[12.5px] font-semibold transition-colors tabular-nums",
                  isActive
                    ? "border-[hsl(158_64%_38%)] bg-[hsl(158_64%_38%)] text-white"
                    : "border-[#ECEEF0] bg-white text-[#4B5563] hover:border-[#D6DBDF]"
                )}
              >
                {stage.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Prospect search */}
      <div className="mx-auto max-w-[1040px] pb-2">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[#9AA3AD]" />
          <Input
            placeholder="Buscar prospecto…"
            value={searchProspecto}
            onChange={(e) => setSearchProspecto(e.target.value)}
            className="h-11 rounded-md border-[#ECEEF0] bg-white pl-9 text-[13px] shadow-none focus-visible:ring-[hsl(158_64%_38%)]/30"
          />
        </div>
      </div>

      {/* Banner modo presentación */}
      {presentationMode && (
        <div className="mx-auto mb-2 max-w-[1040px]">
          <div className="flex items-center gap-2.5 rounded-md border border-[#EBC089] bg-[#FBE3CE] px-4 py-2.5">
            <EyeOff className="h-4 w-4 shrink-0 text-[#B5601C]" />
            <span className="text-[12px] font-semibold text-[#B5601C]">
              Modo presentación · nombres de prospecto y montos ocultos. Desactívalo arriba para verlos.
            </span>
          </div>
        </div>
      )}

      {/* Offer Cards */}
      <div className="mx-auto max-w-[1040px] space-y-2.5 px-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--agent-muted))]" />
          </div>
        ) : displayOfertas.length === 0 ? (
          <div className="text-center py-12 text-sm text-[hsl(var(--agent-text-secondary))]">
            No hay ofertas en esta etapa
          </div>
        ) : (
          displayOfertas.map((oferta: any) => (
            <OfertaCard
              key={oferta.id}
              oferta={oferta}
              formatCurrency={formatCurrency}
              getStageInfo={getStageInfo}
              onClick={() => setSelectedOferta(oferta)}
            />
          ))
        )}
      </div>

      {selectedOferta && (
        <PipelineOfferDetailDialog
          open={!!selectedOferta}
          onOpenChange={(v) => { if (!v) setSelectedOferta(null); }}
          oferta={selectedOferta}
          formatCurrency={formatCurrency}
          stageInfo={getStageInfo(selectedOferta.stage)}
        />
      )}
    </div>
  );
};

function OfertaCard({ oferta, formatCurrency, getStageInfo, onClick }: {
  oferta: any;
  formatCurrency: (v: number) => string;
  getStageInfo: (s: string) => { key: string; label: string; color: string; borderColor: string };
  onClick?: () => void;
}) {
  const { mask } = useAgentPresentation();
  const stageInfo = getStageInfo(oferta.stage);
  const ofertaLabel = oferta.is_producto
    ? `OP-${String(oferta.id).padStart(6, '0')}`
    : `O-${String(oferta.id).padStart(6, '0')}`;

  const unitLabel = oferta.is_producto
    ? `${oferta.producto_nombre || 'Producto'} · ${oferta.propiedad_nombre}`
    : (oferta.proyecto_nombre
      ? `${oferta.proyecto_nombre} · ${oferta.propiedad_nombre}`
      : oferta.propiedad_nombre);

  const cuentaTipo = oferta.is_producto ? 'Producto' : 'Propiedad';
  const hasUrl = !!oferta.url;
  const ccLabel = oferta.cuenta_cobranza_id
    ? formatCuentaCobranzaId(oferta.cuenta_cobranza_id, cuentaTipo as any)
    : '';

  const subParts = [mask(oferta.lead_nombre), oferta.proyecto_nombre, ccLabel].filter(Boolean);

  const genDate = oferta.fecha_generacion ? new Date(oferta.fecha_generacion) : null;
  const venceDate = genDate ? new Date(genDate) : null;
  if (venceDate) venceDate.setDate(venceDate.getDate() + 5);

  // Reenviar - envía PDF al email del lead ya registrado
  const handleReenviar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasUrl) {
      toast({
        title: "PDF no disponible",
        description: "Descarga la oferta primero para generar el PDF.",
        duration: 5000,
      });
      return;
    }
    const { sendOfferEmailDirect } = await import('@/services/offerEmailService');
    sendOfferEmailDirect({
      offerId: oferta.id,
      propertyNumber: oferta.propiedad_nombre || '',
      tipo: oferta.is_producto ? 'producto' : 'propiedad',
    });
  };

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-md border border-[#E7E9EC] bg-white p-4 shadow-[0_1px_3px_rgba(20,30,25,0.04)] hover:border-[#CBD2D9]"
    >
      {/* Row 1: label + chip / estado */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-[hsl(158_64%_38%)]">Oferta: {ofertaLabel}</span>
          {oferta.inmobiliaria_nombre && (
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                oferta.inmobiliaria_nombre === 'Interno'
                  ? "bg-[#F2F4F5] text-[#6B7280]"
                  : "bg-[#EAF6F0] text-[hsl(158_64%_38%)]"
              )}
            >
              {oferta.inmobiliaria_nombre}
            </span>
          )}
        </div>
        <Badge className={cn("shrink-0 border-0 text-[10px]", stageInfo.color)}>
          {stageInfo.label}
        </Badge>
      </div>

      {/* Row 2: title + price */}
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <p className="truncate text-[15px] font-bold text-[#171A1D]">{unitLabel}</p>
        {oferta.precio != null && oferta.precio > 0 && (
          <span className="shrink-0 text-[16px] font-extrabold tabular-nums text-[#171A1D]">
            {mask(formatCurrency(oferta.precio))}
          </span>
        )}
      </div>

      {/* Row 3: subtitle */}
      {subParts.length > 0 && (
        <p className="mt-1 truncate text-[12px] font-medium text-[#9AA3AD]">
          {subParts.join(' · ')}
        </p>
      )}

      {/* Row 4: dates */}
      {genDate && (
        <p className="mt-1 text-[11.5px] font-medium tabular-nums text-[#9AA3AD]">
          Generada: {format(genDate, 'dd MMM yyyy', { locale: es })}
          {venceDate && `  ·  Vence: ${format(venceDate, 'dd MMM yyyy', { locale: es })}`}
        </p>
      )}

      {/* Footer: acciones */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F2F4F5] pt-3">
        <button
          onClick={(e) => { e.stopPropagation(); window.open(`/oferta/${oferta.id}`, '_blank'); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#E7E9EC] px-3 py-1.5 text-[12px] font-semibold text-[#4B5563] hover:bg-[#F6F7F8]"
        >
          Oferta digital <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleReenviar}
          title={hasUrl ? 'Reenviar oferta por correo' : 'Descarga la oferta primero'}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold",
            hasUrl
              ? "border-[#E7E9EC] text-[#4B5563] hover:bg-[#F6F7F8]"
              : "border-[#E7E9EC] text-[#9AA3AD] cursor-not-allowed"
          )}
        >
          <Mail className="h-3.5 w-3.5" /> Reenviar
        </button>
      </div>
    </div>
  );
}

export default AgentPipeline;
