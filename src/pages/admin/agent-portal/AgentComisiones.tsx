import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { ComisionesTable, comisionEstatus, COMISION_ESTATUS_LABEL, type ComisionEstatus } from "@/components/admin/comisiones/ComisionesTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MODAL_BODY_CLS, ModalFormHeader } from "@/components/ui/modal-form";
import { Input } from "@/components/ui/input";
import { FILTER_LABEL_CLS } from "@/components/ui/modal-filters";
import { ModalViewer } from "@/components/ui/modal-viewer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconButton } from "@/components/ui/icon-button";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPresentation } from "@/contexts/AgentPresentationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCuentaCobranzaId } from "@/utils/cuentaCobranzaUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, EyeOff, Upload, UploadCloud, Loader2, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

  const totalCobrado = comisiones
    .filter((c: any) => c.detailed_status === 'pagada')
    .reduce((sum: number, c: any) => sum + (c.monto_comision || 0), 0);

  const totalPorCobrar = comisiones
    .filter((c: any) => c.detailed_status !== 'pagada')
    .reduce((sum: number, c: any) => sum + (c.monto_comision || 0), 0);

  // Opciones de filtro derivadas de los datos.
  const proyectoOptions = [...new Set(comisiones.map((c: any) => c.proyecto).filter(Boolean))].sort() as string[];
  const estatusOptions = [...new Set(comisiones.map((c: any) => comisionEstatus(c.detailed_status)))] as ComisionEstatus[];

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
          <Select value={filterProyecto} onValueChange={setFilterProyecto}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {proyectoOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
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
          <Select value={filterEstatus} onValueChange={setFilterEstatus}>
            <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estatus</SelectItem>
              {estatusOptions.map((s) => <SelectItem key={s} value={s}>{COMISION_ESTATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
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
              <AgentDocUploadButton
                title="Factura de comisión"
                subtitle="Sube el PDF de tu factura"
                tooltip="Subir factura (PDF)"
                elementId="btn_subir_factura_agent"
                pdfOnly
                track={track}
                cuentaId={row.id_cuenta_cobranza}
                onUpload={async (file) => {
                  const path = `facturas-comision/${row.id_cuenta_cobranza}/${crypto.randomUUID()}-${file.name}`;
                  const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
                  if (upErr) throw upErr;
                  const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
                  const { error: insErr } = await (supabase as any).from('documentos').insert({
                    id_cuenta_cobranza: row.id_cuenta_cobranza, id_tipo_documento: 46, url: publicUrl, id_persona: personaId, numero: agentEmail, activo: true,
                  });
                  if (insErr) throw insErr;
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

// Botón compacto que abre un modal con dropzone para subir un documento (factura o
// evidencia de pago). El guardado se inyecta con `onUpload`; acepta PDF (y opcional imagen).
function AgentDocUploadButton({ title, subtitle, tooltip, elementId, cuentaId, pdfOnly, onUpload, track }: {
  title: string; subtitle: string; tooltip: string; elementId: string; cuentaId: number;
  pdfOnly?: boolean; onUpload: (file: File) => Promise<void>; track: ReturnType<typeof useCtaTracker>['track'];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(false);

  const accept = pdfOnly ? '.pdf' : '.pdf,image/*';
  const hint = pdfOnly ? 'Solo PDF' : 'PDF o imagen';

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    const isImg = f.type.startsWith('image/');
    if (pdfOnly ? !isPdf : !(isPdf || isImg)) {
      toast.error(pdfOnly ? 'Solo se permiten archivos PDF.' : 'Solo se permiten PDF o imágenes.');
      return;
    }
    doUpload(f);
  };

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
      toast.success('Documento subido correctamente');
      setOpen(false);
    } catch (err: any) {
      console.error('Error al subir documento:', err);
      toast.error('Error al subir: ' + (err?.message || 'Error desconocido'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <IconButton
        icon={Upload}
        tooltip={tooltip}
        onClick={() => { track({ page: 'agent_comisiones', elementId, elementLabel: tooltip, metadata: { cuentaId } }); setOpen(true); }}
      />

      {/* Modal de subida con dropzone (mismo estilo que CSF del perfil) */}
      <Dialog open={open} onOpenChange={(o) => { if (!uploading) setOpen(o); }}>
        <DialogContent className="flex max-h-[90vh] max-w-[520px] flex-col gap-0 overflow-hidden rounded-md bg-card p-0">
          <ModalFormHeader title={title} subtitle={subtitle} />
          <div className={MODAL_BODY_CLS}>
            <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
              onClick={() => !uploading && fileRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors",
                drag ? "border-primary bg-primary/5" : "border-border bg-muted hover:border-primary"
              )}
            >
              {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-primary" strokeWidth={1.6} />}
              <div>
                <p className="text-sm font-bold text-foreground">{uploading ? 'Subiendo…' : 'Arrastra el archivo aquí'}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground/70">o haz clic para seleccionar · {hint}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
      <span className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

export default AgentComisiones;
