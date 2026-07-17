import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Lock, CheckCircle2, AlertCircle, DollarSign, Clock, FileText, CalendarCheck, Upload, EyeOff, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { toast } from "sonner";

type TabKey = 'todas' | 'pendiente' | 'en_revision' | 'factura_requerida' | 'programada' | 'pagada';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'factura_requerida', label: 'Factura requerida' },
  { key: 'programada', label: 'Programada' },
  { key: 'pagada', label: 'Pagada' },
];

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
  const [activeTab, setActiveTab] = useState<TabKey>('todas');
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

  // Fetch comisiones with property status and factura info
  const { data: comisiones = [], isLoading: comisionesLoading } = useQuery({
    queryKey: ['agent-comisiones', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return [];

      const { data: comisionistas } = await (supabase as any)
        .from('comisionistas')
        .select('id_cuenta_cobranza, porcentaje_comision, aprobada, pagada, fecha_creacion, url_evidencia_pago')
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
        };
      });
    },
    enabled: !!agentEmail,
    staleTime: 30_000,
  });

  const isLoading = onboardingLoading || comisionesLoading;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pendiente': return { label: 'Pendiente', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: Clock };
      case 'en_revision': return { label: 'En revisión', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: FileText };
      case 'factura_requerida': return { label: 'Factura requerida', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertCircle };
      case 'programada': return { label: 'Programada', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: CalendarCheck };
      case 'pagada': return { label: 'Pagada', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 };
      default: return { label: 'Pendiente', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: Clock };
    }
  };

  const totalCobrado = comisiones
    .filter((c: any) => c.detailed_status === 'pagada')
    .reduce((sum: number, c: any) => sum + (c.monto_comision || 0), 0);

  const totalPorCobrar = comisiones
    .filter((c: any) => c.detailed_status !== 'pagada')
    .reduce((sum: number, c: any) => sum + (c.monto_comision || 0), 0);

  const visibleTabs = isAgentRole 
    ? TABS 
    : TABS.filter(t => t.key !== 'factura_requerida');

  const filteredComisiones = activeTab === 'todas' 
    ? comisiones 
    : comisiones.filter((c: any) => c.detailed_status === activeTab);

  // Blocked state - only for Agente Inmobiliario role
  if (isAgentRole && !onboardingLoading && !canReceivePayments) {
    return (
      <div className="pb-24">
        <AgentPortalHeader />
        <div className="mx-auto max-w-[1040px] pt-1 space-y-5">
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
        <div className="rounded-md bg-primary p-[18px]">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-white/65">Total cobrado</p>
          <p className="mt-2 text-[24px] font-extrabold tabular-nums text-white">{mask(formatCurrency(totalCobrado))}</p>
          <p className="mt-1 text-[10px] font-semibold text-white/55">MXN · acumulado</p>
        </div>
        <div className="rounded-md border border-[#ECEEF0] bg-white p-[18px]">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Por cobrar</p>
          <p className="mt-2 text-[24px] font-extrabold tabular-nums text-[#171A1D]">{mask(formatCurrency(totalPorCobrar))}</p>
          <p className="mt-1 text-[10px] font-semibold text-[#9AA3AD]">MXN · en proceso</p>
        </div>
      </div>

      {/* Status tabs */}
      <div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {visibleTabs.map(tab => {
              const count = tab.key === 'todas'
                ? comisiones.length
                : comisiones.filter((c: any) => c.detailed_status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    track({ page: 'agent_comisiones', elementId: 'btn_filtro_tab', elementLabel: tab.label, metadata: { tab: tab.key } });
                    setActiveTab(tab.key);
                  }}
                  className={cn(
                    "whitespace-nowrap rounded-md border px-3.5 py-2 text-[12.5px] font-semibold transition-all tabular-nums",
                    activeTab === tab.key
                      ? "border-[hsl(158_64%_38%)] bg-[hsl(158_64%_38%)] text-white"
                      : "border-[#ECEEF0] bg-white text-[#4B5563] hover:border-[#D6DBDF]"
                  )}
                >
                  {tab.label}{count > 0 ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--agent-muted))]" />
          </div>
        ) : filteredComisiones.length === 0 ? (
          <div className="text-center py-12 text-sm text-[hsl(var(--agent-text-secondary))]">
            {activeTab === 'todas' ? 'Aún no tienes comisiones' : 'Sin comisiones en esta categoría'}
          </div>
        ) : (
          filteredComisiones.map((c: any, idx: number) => {
            const status = getStatusConfig(c.detailed_status);
            const StatusIcon = status.icon;
            return (
              <div key={`${c.id_cuenta_cobranza}-${idx}`} className="rounded-md border border-[#ECEEF0] bg-white p-4 shadow-[0_1px_3px_rgba(20,30,25,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[13.5px] font-bold text-[#171A1D]">
                      {c.proyecto || 'Sin proyecto'}
                      {c.propiedad ? ` · ${c.propiedad}` : ''}
                    </p>
                    <p className="truncate text-[11px] font-medium text-[#9AA3AD]">
                      {c.cuenta_cobranza_label}
                      {' · '}
                      {c.productoNombre
                        ? `${c.productoNombre}${c.propiedad ? ` · Depto ${c.propiedad}` : ''}`
                        : c.propiedad ? `Departamento ${c.propiedad}` : 'Sin unidad'}
                    </p>
                  </div>
                  <p className="shrink-0 text-[16px] font-extrabold tabular-nums text-[#171A1D]">
                    {mask(formatCurrency(c.monto_comision || 0))}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px] shrink-0 border gap-1", status.color)}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                    {c.detailed_status === 'pagada' && c.url_evidencia_pago && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setViewerDoc({ url: c.url_evidencia_pago, title: `Comprobante · ${c.cuenta_cobranza_label}` }); }}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E7E9EC] px-2 py-1 text-[10px] font-semibold text-primary hover:bg-[#F6F7F8]"
                      >
                        <FileText className="h-3 w-3" /> Ver comprobante
                      </button>
                    )}
                    {c.factura_url && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setViewerDoc({ url: c.factura_url, title: `Factura · ${c.cuenta_cobranza_label}` }); }}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E7E9EC] px-2 py-1 text-[10px] font-semibold text-primary hover:bg-[#F6F7F8]"
                      >
                        <FileText className="h-3 w-3" /> Ver factura
                      </button>
                    )}
                  </div>
                  {c.precio_final > 0 && (
                    <span className="text-[10px] text-[hsl(var(--agent-text-secondary))]">
                      Venta: {mask(formatCurrency(c.precio_final))}
                    </span>
                  )}
                </div>
                {c.detailed_status === 'factura_requerida' && !c.factura_url && agentEmail && personaId && (
                  <div className="mt-3">
                    <AgentFacturaUploadButton
                      cuentaId={c.id_cuenta_cobranza}
                      agentEmail={agentEmail}
                      personaId={personaId}
                      onUploaded={() => queryClient.invalidateQueries({ queryKey: ['agent-comisiones', agentEmail] })}
                      track={track}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* Visor interno de documento (factura / comprobante) */}
      <Dialog open={!!viewerDoc} onOpenChange={(v) => { if (!v) setViewerDoc(null); }}>
        <DialogContent className="max-w-4xl gap-0 p-0">
          <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-[#ECEEF0] px-5 py-3.5 space-y-0">
            <DialogTitle className="text-[15px] font-bold text-[#171A1D]">{viewerDoc?.title || 'Documento'}</DialogTitle>
            {viewerDoc?.url && (
              <a
                href={viewerDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-6 inline-flex items-center gap-1.5 rounded-md border border-[#E7E9EC] px-3 py-1.5 text-[12px] font-semibold text-[#4B5563] hover:bg-[#F6F7F8]"
              >
                Abrir en pestaña <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </DialogHeader>
          {viewerDoc?.url && (
            <iframe
              src={viewerDoc.url}
              title={viewerDoc.title}
              className="h-[78vh] w-full rounded-b-md bg-[#F6F7F8]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function AgentFacturaUploadButton({
  cuentaId,
  agentEmail,
  personaId,
  onUploaded,
  track,
}: {
  cuentaId: number;
  agentEmail: string;
  personaId: number;
  onUploaded: () => void;
  track: ReturnType<typeof useCtaTracker>['track'];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `facturas-comision/${cuentaId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);

      const { error: insertError } = await (supabase as any).from('documentos').insert({
        id_cuenta_cobranza: cuentaId,
        id_tipo_documento: 46,
        url: publicUrl,
        id_persona: personaId,
        numero: agentEmail,
        activo: true,
      });
      if (insertError) throw insertError;

      toast.success('Factura subida correctamente');
      onUploaded();
    } catch (err: any) {
      console.error('Error uploading factura:', err);
      toast.error('Error al subir la factura: ' + (err.message || 'Error desconocido'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => {
          track({ page: 'agent_comisiones', elementId: 'btn_subir_factura_agent', elementLabel: 'Subir factura', metadata: { cuentaId } });
          fileRef.current?.click();
        }}
        className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-white text-xs font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? 'Subiendo...' : 'Subir factura'}
      </button>
    </>
  );
}

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
