import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MifielSigningDialog } from "@/components/admin/MifielSigningDialog";
import { FaceVerifyDialog } from "@/components/admin/FaceVerifyDialog";
import { ModalViewer } from "@/components/ui/modal-viewer";
import { SignaturePadDialog } from "@/components/admin/SignaturePadDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Upload, CheckCircle2, Clock, RefreshCw, FileText, CalendarDays, Camera, Shield, PenTool, ChevronRight, Eye } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { validateRFC } from "@/utils/fiscalDataValidation";
import { Badge } from "@/components/ui/badge";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { OnboardingStep } from "@/hooks/useAgentOnboardingStatus";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useAgentPortalFullAccess } from "@/hooks/useAgentPortalFullAccess";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { esCitaResuelta, getCitaAsistencia, getTrainingAppointmentStatus, useAgentTrainingAppointments } from "@/hooks/useAgentTrainingAppointments";
import { cn } from "@/lib/utils";
import { ENVIRONMENT } from "@/lib/config";
import { fetchProyectosConCitasHabilitadas } from "@/utils/citasProyectosHabilitados";
import {
  FIELD_LABEL_CLS,
  SEG_TRACK_CLS,
  segBtnCls,
  Req,
  SECTION_HEADER_CLS,
  ModalFormHeader,
  MODAL_FOOTER_CLS,
} from "@/components/ui/modal-form";
import {
  useStabilityDetection,
  CaptureFlash,
  SelfieCameraOverlay,
  DocCameraOverlay,
} from "@/components/admin/DocumentVerification";

interface AgentOnboardingStepDialogProps {
  step: OnboardingStep['id'];
  personaId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pestaña inicial dentro del paso (p. ej. 'address' para ir directo a firmar la carta). */
  initialTab?: string;
  /** Paso bancario: 'create' abre el formulario vacío; 'edit' carga `bankAccountId`. */
  bankMode?: 'create' | 'edit';
  bankAccountId?: number | null;
}

const STEP_TITLES: Record<string, string> = {
  basic: 'Identidad',
  address: 'Dirección',
  fiscal: 'Información Fiscal',
  documents: 'Carta de comercialización',
  'bank-accounts': 'Cuenta Bancaria',
  training: 'Capacitación',
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  basic: 'Datos personales y dirección',
  address: 'Tu dirección física completa',
  fiscal: 'RFC, régimen fiscal, constancia y dirección fiscal',
  documents: 'Firma digital de tu Carta de comercialización',
  'bank-accounts': 'Agrega tu cuenta bancaria',
  training: 'Agenda tu cita de capacitación presencial',
};

/**
 * Extrae el error real de una Edge Function. `supabase.functions.invoke` solo
 * expone "Edge Function returned a non-2xx status code"; el motivo viaja en el
 * body de la respuesta, accesible por `err.context` (un Response).
 */
async function readEdgeFunctionError(err: any): Promise<string> {
  const ctx = err?.context;
  if (!ctx || typeof ctx !== 'object') return '';
  try {
    const res = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
    if (typeof res.json === 'function') {
      const body = await res.json();
      const msg = body?.error || body?.message;
      if (msg) return String(msg);
    }
  } catch {
    // Body no-JSON o ya consumido: se intenta como texto abajo.
  }
  try {
    if (typeof ctx.text === 'function') {
      const txt = await ctx.text();
      if (txt) return txt.slice(0, 500);
    }
  } catch {
    // Sin body legible: el llamador cae al mensaje genérico.
  }
  return '';
}

// Constancia de situación fiscal (type 6) for fiscal step
const FISCAL_DOC_TYPES = [6];
// Lista corta: el SearchableSelect la pinta sin buscador (mismo componente que los catálogos).
const SEXO_OPTIONS: SearchableOption[] = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];
// All required doc types for onboarding queries
const REQUIRED_DOC_TYPES = [2, 3, 4, 6, 48];
// Document types that support camera capture
const CAMERA_DOC_TYPES = [2, 3, 4]; // INE frente, INE reverso, Pasaporte
// INE document types (need both front and back)
const INE_DOC_TYPES = [2, 3];
// Pasaporte document type
const PASAPORTE_DOC_TYPE = 4;
// Selfie document type
const SELFIE_DOC_TYPE = 49;

export function AgentOnboardingStepDialog({ step, personaId, open, onOpenChange, initialTab, bankMode = 'edit', bankAccountId = null }: AgentOnboardingStepDialogProps) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { track } = useCtaTracker();
  const { hasBasicIdentityComplete } = useAgentOnboardingStatus(personaId);
  const hasTrackedFieldChange = useRef(false);

  // Track opening the step
  useEffect(() => {
    if (open) {
      track({ page: "modal_perfil", elementId: "perfil_fase_abrir", metadata: { fase: step } });
      hasTrackedFieldChange.current = false;
    }
  }, [open, step, track]);

  // Full fetch persona data
  const { data: persona, isLoading } = useQuery({
    queryKey: ['agent-onboarding-step-persona', personaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!personaId,
  });

  // El paso bancario distingue alta de edición (misma UI, distinto encabezado).
  const isBankCreate = step === 'bank-accounts' && bankMode === 'create';
  const title =
    step === 'bank-accounts'
      ? (isBankCreate ? 'Nueva cuenta bancaria' : 'Editar cuenta bancaria')
      : STEP_TITLES[step];
  const description =
    step === 'bank-accounts'
      ? (isBankCreate
          ? 'Queda pendiente de activación hasta que la validemos'
          : 'Corrige los datos de tu cuenta registrada')
      : STEP_DESCRIPTIONS[step];

  const handleSaved = async () => {
    // Await refetch while dialog is still open (query enabled) to avoid stale cache
    await queryClient.refetchQueries({ queryKey: ['agent-onboarding-step-persona', personaId] });
    await queryClient.refetchQueries({ queryKey: ['agent-onboarding-persona', personaId] });
    queryClient.invalidateQueries({ queryKey: ['agent-onboarding-persona'] });
    queryClient.invalidateQueries({ queryKey: ['agent-onboarding-docs'] });
    queryClient.invalidateQueries({ queryKey: ['agent-onboarding-bank'] });
    onOpenChange(false);
  };

  const content = isLoading ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  ) : step === 'documents' ? (
    // El paso "documents" es la Carta de comercialización (tipo 48) precedida de la
    // verificación de identidad: sin INE (frente y reverso) o pasaporte, la firma no
    // se habilita. La CSF se sube desde el paso fiscal.
    <div>
      <AgentDocumentsStep personaId={personaId} filterDocTypes={[2, 3, 4, 48]} requireIdentityDocs onTrackFieldChange={() => {
        if (!hasTrackedFieldChange.current) {
          hasTrackedFieldChange.current = true;
          track({ page: "modal_perfil", elementId: "perfil_fase_campo_modificado", metadata: { fase: step } });
        }
      }} onTrackDocView={(docName: string) => track({ page: "modal_perfil", elementId: "perfil_documentos_ver", metadata: { documento: docName } })} />
    </div>
  ) : step === 'bank-accounts' ? (
    <div>
      <AgentBankAccountStep personaId={personaId} mode={bankMode} accountId={bankAccountId} onTrackFieldChange={() => {
        if (!hasTrackedFieldChange.current) {
          hasTrackedFieldChange.current = true;
          track({ page: "modal_perfil", elementId: "perfil_fase_campo_modificado", metadata: { fase: step } });
        }
      }} onTrackSave={() => track({ page: "modal_perfil", elementId: "perfil_fase_guardar", metadata: { fase: "bank-accounts" } })} />
    </div>
  ) : step === 'training' ? (
    <div>
      <AgentTrainingStep personaId={personaId} onSaved={handleSaved} onTrackSave={() => track({ page: "modal_perfil", elementId: "perfil_fase_guardar", metadata: { fase: step } })} onTrackFieldChange={() => {
        if (!hasTrackedFieldChange.current) {
          hasTrackedFieldChange.current = true;
          track({ page: "modal_perfil", elementId: "perfil_fase_campo_modificado", metadata: { fase: step } });
        }
      }} />
    </div>
  ) : (
    <StepForm step={step} persona={persona} personaId={personaId} initialTab={initialTab} onSaved={handleSaved} onClose={() => onOpenChange(false)} onTrackSave={() => track({ page: "modal_perfil", elementId: "perfil_fase_guardar", metadata: { fase: step } })} onTrackFieldChange={() => {
      if (!hasTrackedFieldChange.current) {
        hasTrackedFieldChange.current = true;
        track({ page: "modal_perfil", elementId: "perfil_fase_campo_modificado", metadata: { fase: step } });
      }
    }} />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh] rounded-t-2xl overflow-hidden max-w-[100vw]">
          <DrawerHeader className="text-left pb-2 px-4">
            <DrawerTitle className="text-lg">{title}</DrawerTitle>
            <DrawerDescription className="text-xs">{description}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto overflow-x-hidden w-full" style={{ maxHeight: 'calc(95vh - 100px)' }}>
            <div className="w-full max-w-full overflow-hidden">
              {content}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px] w-[calc(100vw-2rem)] max-h-[90vh] gap-0 overflow-hidden rounded-md border border-border bg-card p-0 shadow-lg">
        <ModalFormHeader title={title} subtitle={description} />
        <div className="max-h-[calc(90vh-5.5rem)] w-full min-w-0 overflow-y-auto overflow-x-hidden px-6 py-5">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Agent Documents Step ----------

function AgentDocumentsStep({ personaId, filterDocTypes, onTrackFieldChange, onTrackDocView, signGateReady, onBeforeSign, requireIdentityDocs }: {
  personaId: number;
  filterDocTypes?: number[];
  onTrackFieldChange?: () => void;
  onTrackDocView?: (docName: string) => void;
  /** El formulario contenedor ya tiene sus obligatorios llenos (aunque no estén guardados). */
  signGateReady?: boolean;
  /** Persiste el formulario contenedor antes de firmar. Devuelve false si no se pudo guardar. */
  onBeforeSign?: () => Promise<boolean>;
  /** Exige identificación (INE frente+reverso o pasaporte) capturada antes de habilitar la firma. */
  requireIdentityDocs?: boolean;
}) {
  const queryClient = useQueryClient();
  const { hasBasicIdentityComplete } = useAgentOnboardingStatus(personaId);

  const activeDocTypes = filterDocTypes || REQUIRED_DOC_TYPES;
  
  // Determine if this is the basic step (has INE/Pasaporte docs)
  const hasIdentityDocs = activeDocTypes.some(t => INE_DOC_TYPES.includes(t) || t === PASAPORTE_DOC_TYPE);
  
  // Fetch doc type names from DB
  const { data: docTypes = [] } = useQuery({
    queryKey: ['agent-doc-types', activeDocTypes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_documento')
        .select('id, nombre')
        .in('id', activeDocTypes)
        .eq('activo', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing documents for this persona
  const { data: existingDocs = [], refetch: refetchDocs } = useQuery({
    queryKey: ['agent-onboarding-docs-detail', personaId, activeDocTypes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('id, id_tipo_documento, url, id_estatus_verificacion, fecha_creacion')
        .eq('id_persona', personaId)
        .eq('activo', true)
        .in('id_tipo_documento', activeDocTypes);
      if (error) throw error;
      return data || [];
    },
  });

  // Determine identity mode based on existing docs
  const hasINEDocs = existingDocs.some((d: any) => INE_DOC_TYPES.includes(d.id_tipo_documento));
  const hasPasaporteDocs = existingDocs.some((d: any) => d.id_tipo_documento === PASAPORTE_DOC_TYPE);

  // Check if basic info + address + identity docs (INE/Passport) are ready — excludes carta (48) to avoid circular dependency
  const hasIdentityDocUploaded = hasINEDocs || hasPasaporteDocs;
  // Identificación COMPLETA: INE con sus dos caras, o pasaporte.
  const ineCompleto = INE_DOC_TYPES.every((t) => existingDocs.some((d: any) => d.id_tipo_documento === t));
  const identityDocsComplete = hasPasaporteDocs || ineCompleto;
  // `signGateReady` cubre el caso de datos recién capturados y aún sin guardar:
  // el botón de firma se habilita con el formulario completo y guarda al firmar.
  const datosBasicosListos = hasBasicIdentityComplete || !!signGateReady;
  const basicInfoAndDocsReady = datosBasicosListos || hasIdentityDocUploaded;

  // Identidad VERIFICADA = la identificación pasó la validación biométrica del portal
  // (documento + selfie con coincidencia facial → `id_estatus_verificacion = 2`).
  const tipoVerificado = (t: number) =>
    existingDocs.some((d: any) => d.id_tipo_documento === t && d.id_estatus_verificacion === 2);
  const identidadVerificada = tipoVerificado(PASAPORTE_DOC_TYPE) || INE_DOC_TYPES.every(tipoVerificado);
  // Con `requireIdentityDocs` la carta solo se desbloquea con identidad verificada.
  const cartaHabilitada = requireIdentityDocs
    ? identidadVerificada && datosBasicosListos
    : basicInfoAndDocsReady;
  const [identityMode, setIdentityMode] = useState<'ine' | 'pasaporte'>('ine');
  
  // Sync identity mode from existing docs on first load
  useEffect(() => {
    if (hasPasaporteDocs && !hasINEDocs) {
      setIdentityMode('pasaporte');
    } else {
      setIdentityMode('ine');
    }
  }, [hasPasaporteDocs, hasINEDocs]);

  const [uploading, setUploading] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStep, setCameraStep] = useState<'front' | 'back' | 'passport' | 'selfie'>('front');
  const [capturedFront, setCapturedFront] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [capturedDocUrls, setCapturedDocUrls] = useState<{ front?: string; back?: string; passport?: string }>({});
  const capturedDocUrlsRef = useRef<{ front?: string; back?: string; passport?: string }>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureLockRef = useRef(false);
  const activeVerifyCallsRef = useRef(0);
  // Preview de documento capturado (revisar antes de subir/verificar). Solo documentos.
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const pendingBlobRef = useRef<Blob | null>(null);

  // --- Mifiel digital signature state for doc type 48 ---
  const [mifielDialogOpen, setMifielDialogOpen] = useState(false);
  const [mifielWidgetId, setMifielWidgetId] = useState<string | null>(null);
  const [sendingToMifiel, setSendingToMifiel] = useState(false);
  const [syncingFirma, setSyncingFirma] = useState(false);
  const [cartaPdfViewerUrl, setCartaPdfViewerUrl] = useState<string | null>(null);
  // Visor interno de documentos del expediente (PDF o imagen).
  const [docView, setDocView] = useState<{ url: string; nombre: string } | null>(null);
  // Visor de la identificación: una sola vista con todas sus caras (frente y reverso).
  const [identityView, setIdentityView] = useState<{ titulo: string; imagenes: { url: string; etiqueta: string }[] } | null>(null);
  // Verificación facial local (Human). `modo: 'oficial'` guarda el resultado en el
  // expediente; `modo: 'prueba'` solo muestra métricas para calibrar.
  const [faceVerify, setFaceVerify] = useState<
    { url: string; label: string; tipos: number[]; modo: 'oficial' | 'prueba' } | null
  >(null);
  const [agentSignaturePadOpen, setAgentSignaturePadOpen] = useState(false);
  const [agentSignatureDataUrl, setAgentSignatureDataUrl] = useState<string | null>(null);
  const [pendingSignAction, setPendingSignAction] = useState<"firmar" | "continuar" | null>(null);

  // Fetch persona data for Mifiel (name + email)
  const { data: personaForMifiel, refetch: refetchPersonaForMifiel } = useQuery({
    queryKey: ['agent-persona-mifiel', personaId],
    queryFn: async () => {
      const { data } = await supabase
        .from('personas')
        .select('nombre_legal, email')
        .eq('id', personaId)
        .single();
      return data;
    },
    enabled: activeDocTypes.includes(48),
  });

  /**
   * Firmante que corresponde al AGENTE dentro de un registro de `firmas_digitales`.
   * La EF `mifiel-crear-documento` arma `signatories` con los firmantes de la carta
   * primero y el agente SIEMPRE al final, y guarda ahí su `email` + `widget_id`.
   *
   * No se depende de `personaForMifiel`: esa query es asíncrona (el primer clic la
   * agarraba sin resolver) y además puede venir vacía por RLS cuando un usuario de
   * soporte abre el expediente de otro agente. El dato guardado es la fuente estable.
   */
  const firmanteAgenteDe = (firma: any): { email?: string; widget_id?: string | null } | null => {
    const lista = Array.isArray(firma?.firmantes) ? firma.firmantes : [];
    if (!lista.length) return null;
    const porEmail = personaForMifiel?.email
      ? lista.find((f: any) => f?.email === personaForMifiel.email)
      : null;
    return porEmail || lista[lista.length - 1] || null;
  };

  // Fetch carta acuerdo config to check if autograph is required
  const CARTA_ACUERDO_ID = "ce94b2d7-dcc8-4f91-a8d8-882264556c3e";
  const { data: cartaConfig } = useQuery({
    queryKey: ['carta-acuerdo-config', CARTA_ACUERDO_ID],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('cartas_acuerdo')
        .select('requiere_firma_autografa')
        .eq('id', CARTA_ACUERDO_ID)
        .single();
      return data;
    },
    enabled: activeDocTypes.includes(48),
  });
  const requiereFirmaAutografa = cartaConfig?.requiere_firma_autografa !== false;

  // Fetch existing firma digital for this agent and sync against Mifiel state
  const { data: firmaExistente, refetch: refetchFirma } = useQuery({
    queryKey: ['agent-firma-digital', personaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('firmas_digitales')
        .select('*')
        .eq('tipo_documento', 'carta_acuerdos')
        .eq('referencia_id', personaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const firmaEnProgreso = data.estado === 'enviado' || data.estado === 'firmado_parcial';
      if (!firmaEnProgreso || !data.mifiel_document_id) return data;

      const { data: mifielData, error: mifielError } = await supabase.functions.invoke('mifiel-consultar-documento', {
        body: { document_id: data.mifiel_document_id, environment: ENVIRONMENT },
      });

      const upstreamStatus = Number(mifielData?.upstream_status || 0);
      const errorMessage = [
        mifielError ? await readEdgeFunctionError(mifielError) : '',
        mifielError?.message,
        mifielData?.error,
        JSON.stringify(mifielData?.details ?? ''),
      ]
        .filter(Boolean)
        .join(' | ');
      const mifielNotFound = upstreamStatus === 404 || /404|not found|no existe|deleted/i.test(errorMessage);

      if (mifielError || !mifielData?.success) {
        if (mifielNotFound) {
          await (supabase as any)
            .from('firmas_digitales')
            .update({ estado: 'cancelado' })
            .eq('id', data.id);
          return { ...data, estado: 'cancelado' };
        }
        return data;
      }

      const remoteState = String(mifielData?.document?.state || '').toLowerCase().trim();
      const remoteCancelledStates = new Set(['deleted', 'canceled', 'cancelled', 'void', 'voided', 'expired', 'rejected']);
      const remoteCompletedStates = new Set(['completed', 'signed']);

      // Check if the agent has already signed
      const mifielSigners = mifielData.document?.signers || mifielData.document?.signatories || [];
      const emailAgente = firmanteAgenteDe(data)?.email;
      const agentSigner = emailAgente
        ? mifielSigners.find((s: any) => s.email === emailAgente)
        : undefined;
      const agentAlreadySigned = agentSigner?.signed === true || agentSigner?.current === false;

      if (remoteCancelledStates.has(remoteState) && data.estado !== 'cancelado') {
        await (supabase as any)
          .from('firmas_digitales')
          .update({ estado: 'cancelado' })
          .eq('id', data.id);
        return { ...data, estado: 'cancelado', agentAlreadySigned };
      }

      if (remoteCompletedStates.has(remoteState) && data.estado !== 'completado') {
        await (supabase as any)
          .from('firmas_digitales')
          .update({ estado: 'completado' })
          .eq('id', data.id);
        return { ...data, estado: 'completado', agentAlreadySigned };
      }

      return { ...data, agentAlreadySigned };
    },
    enabled: activeDocTypes.includes(48),
    refetchInterval: 30000,
  });

  // Persona usada para firmar: la recién guardada gana a la del cache (que puede
  // estar desfasada si el usuario acaba de editar el formulario).
  const signPersonaRef = useRef<{ nombre_legal: string | null; email: string | null } | null>(null);

  // Step 1: Ask for autograph before creating/continuing Mifiel doc (or skip if not required)
  const handleRequestAgentSignature = async (action: "firmar" | "continuar") => {
    // Guardar lo capturado en el formulario contenedor antes de firmar: el agente
    // no debería tener que darle "Guardar", cerrar y volver a abrir el modal.
    let persona = personaForMifiel;
    if (onBeforeSign) {
      setSendingToMifiel(true);
      let guardado = false;
      try {
        guardado = await onBeforeSign();
      } finally {
        setSendingToMifiel(false);
      }
      if (!guardado) return;
      persona = (await refetchPersonaForMifiel()).data ?? persona;
    }

    if (!persona?.email || !persona?.nombre_legal) {
      toast.error("Faltan datos del agente (nombre o email) para enviar a firma.");
      return;
    }
    signPersonaRef.current = persona;

    if (!requiereFirmaAutografa) {
      // Skip autograph, proceed directly
      if (action === "firmar") {
        doFirmarCarta(null);
      } else {
        handleContinuarFirmaInternal();
      }
      return;
    }
    setPendingSignAction(action);
    setAgentSignaturePadOpen(true);
  };

  // Step 2: After autograph is captured, proceed with the action
  const handleAgentSignatureSaved = async (dataUrl: string) => {
    setAgentSignatureDataUrl(dataUrl);
    if (pendingSignAction === "firmar") {
      await doFirmarCarta(dataUrl);
    } else if (pendingSignAction === "continuar") {
      await handleContinuarFirmaInternal();
    }
    setPendingSignAction(null);
  };

  const doFirmarCarta = async (firmaAutografa: string | null) => {
    const persona = signPersonaRef.current ?? personaForMifiel;
    setSendingToMifiel(true);
    try {
      // Guarda anti-duplicado: crear el documento es lo que reserva el crédito de
      // verificación biométrica en Mifiel. Si ya hay uno vivo para esta persona
      // (doble clic, o `firmaExistente` aún sin refrescar), se reusa en vez de
      // quemar otro crédito.
      const { data: firmaViva } = await (supabase as any)
        .from('firmas_digitales')
        .select('*')
        .eq('tipo_documento', 'carta_acuerdos')
        .eq('referencia_id', personaId)
        .in('estado', ['enviado', 'firmado_parcial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const envFirmaViva = firmaViva?.metadata?.environment;
      if (firmaViva?.mifiel_document_id && (!envFirmaViva || envFirmaViva === ENVIRONMENT)) {
        const widGuardado = firmanteAgenteDe(firmaViva)?.widget_id || null;
        await refetchFirma();
        if (widGuardado) {
          setMifielWidgetId(widGuardado);
          setMifielDialogOpen(true);
        } else {
          toast.info("Ya tienes una carta en proceso de firma. Usa 'Continuar firma'.");
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke("mifiel-crear-documento", {
        body: {
          agente_email: persona!.email,
          agente_nombre: persona!.nombre_legal,
          agente_persona_id: personaId,
          carta_acuerdo_id: CARTA_ACUERDO_ID,
          firma_autografa_agente: firmaAutografa,
          environment: ENVIRONMENT,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Error desconocido");

      if (data.widget_id) {
        setMifielWidgetId(data.widget_id);
        setMifielDialogOpen(true);
      } else {
        toast.success("Documento enviado a firma. Revisa tu correo.");
      }
      await refetchFirma();
    } catch (err: any) {
      // supabase-js solo expone "Edge Function returned a non-2xx status code";
      // el motivo real viene en el body de la respuesta (err.context). Ese detalle
      // (proveedor, créditos, credenciales) queda SOLO en consola: al agente se le
      // da un mensaje neutro, sin información interna.
      const detalle = (await readEdgeFunctionError(err)) || err.message || "Error";
      console.error("[mifiel-crear-documento]", detalle);
      toast.error("No se pudo firmar la carta en este momento. Inténtalo más tarde o contacta a tu administrador.");
    } finally {
      setSendingToMifiel(false);
    }
  };

  const handleContinuarFirmaInternal = async () => {
    setSyncingFirma(true);
    // Trabajar con el registro más reciente, no con el del último render: la query
    // se refresca cada 30 s y el clic puede caer entre dos ciclos (por eso el primer
    // intento fallaba y el segundo abría).
    const firma = (await refetchFirma()).data ?? firmaExistente;

    if (!firma?.mifiel_document_id) {
      setSyncingFirma(false);
      toast.error("No se encontró un documento activo para continuar firma.");
      return;
    }

    // Guardia de entorno: verificar que el documento fue creado en el mismo entorno
    const docEnv = (firma as any).metadata?.environment;
    if (docEnv && docEnv !== ENVIRONMENT) {
      setSyncingFirma(false);
      const label = docEnv === 'production' ? 'Producción' : 'Sandbox/Desarrollo';
      toast.error(`Este documento fue creado en ${label}. Se cancelará para generar uno nuevo en el entorno actual.`);
      await (supabase as any)
        .from('firmas_digitales')
        .update({ estado: 'cancelado' })
        .eq('id', firma.id);
      await refetchFirma();
      return;
    }

    try {
      const { data: mifielData, error: mifielError } = await supabase.functions.invoke('mifiel-consultar-documento', {
        body: { document_id: firma.mifiel_document_id, environment: ENVIRONMENT },
      });

      const upstreamStatus = Number(mifielData?.upstream_status || 0);
      const errorMessage = [
        mifielError ? await readEdgeFunctionError(mifielError) : '',
        mifielError?.message,
        mifielData?.error,
        JSON.stringify(mifielData?.details ?? ''),
      ]
        .filter(Boolean)
        .join(' | ');
      const mifielNotFound = upstreamStatus === 404 || /404|not found|no existe|deleted/i.test(errorMessage);

      if (mifielError || !mifielData?.success) {
        if (mifielNotFound) {
          await (supabase as any)
            .from('firmas_digitales')
            .update({ estado: 'cancelado' })
            .eq('id', firma.id);
          await refetchFirma();
          toast.error("Este documento ya no existe en Mifiel. Se sincronizó el estado en la BD.");
          return;
        }
        throw new Error(errorMessage || 'No se pudo sincronizar el estado de firma');
      }

      const remoteState = String(mifielData?.document?.state || '').toLowerCase().trim();
      const remoteCancelledStates = new Set(['deleted', 'canceled', 'cancelled', 'void', 'voided', 'expired', 'rejected', 'archived']);
      const remoteCompletedStates = new Set(['completed', 'signed']);

      if (remoteCancelledStates.has(remoteState)) {
        await (supabase as any)
          .from('firmas_digitales')
          .update({ estado: 'cancelado' })
          .eq('id', firma.id);
        await refetchFirma();
        toast.error("Este documento ya no está disponible para firma en Mifiel. Se sincronizó como cancelado.");
        return;
      }

      if (remoteCompletedStates.has(remoteState)) {
        await (supabase as any)
          .from('firmas_digitales')
          .update({ estado: 'completado' })
          .eq('id', firma.id);
        await refetchFirma();
        refetchDocs();
        toast.success("Este documento ya aparece como firmado en Mifiel. Se sincronizó el estado.");
        return;
      }

      const mifielSigners = mifielData.document?.signers || mifielData.document?.signatories || [];
      const firmanteAgente = firmanteAgenteDe(firma);
      const agentSigner = firmanteAgente?.email
        ? mifielSigners.find((s: any) => s.email === firmanteAgente.email)
        : undefined;
      // Respaldo: el `widget_id` que la EF ya guardó al crear el documento. Evita
      // depender de que Mifiel lo devuelva otra vez en la consulta.
      const wid = agentSigner?.widget_id || firmanteAgente?.widget_id || null;

      if (wid) {
        setMifielWidgetId(wid);
        setMifielDialogOpen(true);
      } else {
        toast.error("No se pudo abrir la firma de tu carta. Contacta a tu administrador.");
      }
    } catch (err: any) {
      // Detalle del proveedor solo en consola; al agente, mensaje neutro.
      console.error("[mifiel-continuar-firma]", err?.message || err);
      toast.error("No se pudo continuar con la firma en este momento. Inténtalo más tarde.");
    } finally {
      setSyncingFirma(false);
    }
  };

  const handleMifielSuccess = () => {
    setMifielDialogOpen(false);
    toast.success("¡Firma completada exitosamente!");
    refetchFirma();
    refetchDocs();
    queryClient.invalidateQueries({ queryKey: ['agent-onboarding-docs'] });
  };

  const getDocForType = (typeId: number) => {
    return existingDocs
      .filter((d: any) => d.id_tipo_documento === typeId)
      .sort((a: any, b: any) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime())[0];
  };

  const getStatusInfo = (doc: any) => {
    if (!doc) return { label: 'Sin subir', color: 'text-muted-foreground', bg: 'bg-muted', icon: Upload };
    switch (doc.id_estatus_verificacion) {
      case 2: return { label: 'Validado', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 };
      case 3: return { label: 'Rechazado', color: 'text-destructive', bg: 'bg-destructive/10', icon: RefreshCw };
      default: return { label: 'Pendiente', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock };
    }
  };

  const handleUpload = async (typeId: number, file: File) => {
    setUploading(typeId);
    onTrackFieldChange?.();
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `persona_${personaId}_doctype${typeId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(fileName);

      // Deactivate previous documents of same type
      await supabase
        .from('documentos')
        .update({ activo: false })
        .eq('id_persona', personaId)
        .eq('id_tipo_documento', typeId)
        .eq('activo', true);

      // Insert new
      const { error: insertError } = await supabase
        .from('documentos')
        .insert({
          url: urlData.publicUrl,
          id_tipo_documento: typeId,
          id_persona: personaId,
          activo: true,
          id_estatus_verificacion: 1,
        });
      if (insertError) throw insertError;

      toast.success("Documento subido correctamente");
      refetchDocs();
      queryClient.invalidateQueries({ queryKey: ['agent-onboarding-docs'] });
    } catch (err: any) {
      toast.error("Error al subir documento: " + (err.message || "Error"));
    } finally {
      setUploading(null);
    }
  };

  const handleFileSelect = (typeId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.webp';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(typeId, file);
    };
    input.click();
  };

  const startDocumentCamera = async (typeId: number) => {
    setCapturedDocUrls({});
    capturedDocUrlsRef.current = {};

    if (typeId === 2) {
      await startCamera('front');
      return;
    }

    if (typeId === 3) {
      await startCamera('back');
      return;
    }

    if (typeId === 4) {
      await startCamera('passport');
    }
  };

  /**
   * Verificación de identidad sobre la identificación YA cargada: no vuelve a pedir el
   * documento, solo compara tu rostro con la foto del expediente. La comparación corre
   * localmente en el navegador (`@vladmandic/human`); al pasar, los documentos quedan
   * con `id_estatus_verificacion = 2` y se habilita la firma de la carta.
   */
  const iniciarVerificacionBiometrica = () => {
    const pasaporte = getDocForType(PASAPORTE_DOC_TYPE);
    const frente = getDocForType(2);
    const usaPasaporte = identityMode === 'pasaporte' ? !!pasaporte : !frente && !!pasaporte;
    const docPrincipal = usaPasaporte ? pasaporte : frente;

    if (!docPrincipal?.url) {
      toast.error("Primero agrega tu INE o pasaporte para verificar tu identidad.");
      return;
    }

    setFaceVerify({
      url: docPrincipal.url,
      label: usaPasaporte ? 'Pasaporte' : 'INE frente',
      tipos: usaPasaporte ? [PASAPORTE_DOC_TYPE] : [...INE_DOC_TYPES],
      modo: 'oficial',
    });
  };

  // Camera functions
  const startCamera = async (step: 'front' | 'back' | 'passport' | 'selfie') => {
    setCameraStep(step);
    setCameraActive(true);
    setCapturedFront(null);
    activeVerifyCallsRef.current = 0;
    setVerifying(false);
    autoCaptureLockRef.current = false;
    try {
      const facingMode = step === 'selfie' ? 'user' : 'environment';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("No se pudo acceder a la cámara. Verifica los permisos.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCapturedFront(null);
    autoCaptureLockRef.current = false;
    if (pendingBlobRef.current) pendingBlobRef.current = null;
    setDocPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  // Detiene solo el stream (mantiene el overlay para mostrar el preview del documento).
  const freezeStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Upload and return the public URL + document ID
  const uploadAndGetUrl = async (typeId: number, file: File): Promise<{ url: string; docId: number } | null> => {
    setUploading(typeId);
    onTrackFieldChange?.();
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `persona_${personaId}_doctype${typeId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(fileName);

      // Deactivate previous documents of same type
      await supabase
        .from('documentos')
        .update({ activo: false })
        .eq('id_persona', personaId)
        .eq('id_tipo_documento', typeId)
        .eq('activo', true);

      // Insert new
      const { data: insertData, error: insertError } = await supabase
        .from('documentos')
        .insert({
          url: urlData.publicUrl,
          id_tipo_documento: typeId,
          id_persona: personaId,
          activo: true,
          id_estatus_verificacion: 1,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      refetchDocs();
      queryClient.invalidateQueries({ queryKey: ['agent-onboarding-docs'] });
      return { url: urlData.publicUrl, docId: insertData.id };
    } catch (err: any) {
      toast.error("Error al subir documento: " + (err.message || "Error"));
      return null;
    } finally {
      setUploading(null);
    }
  };

  // Procesa un blob ya capturado: sube + avanza de paso / verifica el documento.
  const processShot = async (blob: Blob, step: 'front' | 'back' | 'passport' | 'selfie') => {
    if (step === 'front') {
      const file = new File([blob], `ine_frente_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const result = await uploadAndGetUrl(2, file);
      if (result) {
        setCapturedDocUrls(prev => {
          const next = { ...prev, front: result.url };
          capturedDocUrlsRef.current = next;
          return next;
        });
        toast.success("INE frente capturado. Ahora captura el reverso.", { duration: 4000 });
        startCamera('back');
      } else {
        autoCaptureLockRef.current = false;
      }
    } else if (step === 'back') {
      const file = new File([blob], `ine_reverso_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const result = await uploadAndGetUrl(3, file);
      if (result) {
        setCapturedDocUrls(prev => {
          const next = { ...prev, back: result.url };
          capturedDocUrlsRef.current = next;
          return next;
        });
        stopCamera();
        const frenteUrl = capturedDocUrlsRef.current.front;
        toast.success("INE capturada. Ahora verifica tu identidad.", { duration: 4000 });
        autoCaptureLockRef.current = false;
        if (frenteUrl) {
          setFaceVerify({ url: frenteUrl, label: 'INE frente', tipos: [...INE_DOC_TYPES], modo: 'oficial' });
        }
      } else {
        autoCaptureLockRef.current = false;
      }
    } else if (step === 'passport') {
      const file = new File([blob], `pasaporte_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const result = await uploadAndGetUrl(4, file);
      if (result) {
        setCapturedDocUrls(prev => {
          const next = { ...prev, passport: result.url };
          capturedDocUrlsRef.current = next;
          return next;
        });
        stopCamera();
        toast.success("Pasaporte capturado. Ahora verifica tu identidad.", { duration: 4000 });
        autoCaptureLockRef.current = false;
        setFaceVerify({ url: result.url, label: 'Pasaporte', tipos: [PASAPORTE_DOC_TYPE], modo: 'oficial' });
      } else {
        autoCaptureLockRef.current = false;
      }
    }
  };

  // Captura el frame. Documentos: recorta al recuadro guía + muestra preview.
  // Selfie: frame completo y procesa directo (sin preview).
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || autoCaptureLockRef.current) return;
    autoCaptureLockRef.current = true;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) { autoCaptureLockRef.current = false; return; }

    if (cameraStep === 'selfie') {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
    } else {
      // Recorta EXACTO al recuadro de guía (inset-4 = 16px) considerando object-cover.
      const cW = video.clientWidth, cH = video.clientHeight, vW = video.videoWidth, vH = video.videoHeight;
      if (!vW || !vH || !cW || !cH) {
        canvas.width = vW; canvas.height = vH;
        ctx.drawImage(video, 0, 0);
      } else {
        const scale = Math.max(cW / vW, cH / vH);
        const offX = (vW - cW / scale) / 2;
        const offY = (vH - cH / scale) / 2;
        const inset = 16; // inset-4
        const sx = Math.max(0, offX + inset / scale);
        const sy = Math.max(0, offY + inset / scale);
        const sw = Math.min((cW - 2 * inset) / scale, vW - sx);
        const sh = Math.min((cH - 2 * inset) / scale, vH - sy);
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      }
    }

    // Show flash
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    canvas.toBlob((blob) => {
      if (!blob) { autoCaptureLockRef.current = false; return; }
      if (cameraStep === 'selfie') {
        processShot(blob, 'selfie');
        return;
      }
      // Documento → congelar y mostrar preview antes de subir/verificar.
      freezeStream();
      pendingBlobRef.current = blob;
      setDocPreviewUrl(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.85);
  }, [cameraStep]);

  // Preview: repetir captura (reinicia cámara del mismo paso).
  const retakeDocPreview = () => {
    if (docPreviewUrl) URL.revokeObjectURL(docPreviewUrl);
    setDocPreviewUrl(null);
    pendingBlobRef.current = null;
    if (cameraStep !== 'selfie') startCamera(cameraStep);
  };

  // Preview: confirmar captura → sube + avanza/verifica.
  const confirmDocPreview = () => {
    const blob = pendingBlobRef.current;
    if (!blob) return;
    if (docPreviewUrl) URL.revokeObjectURL(docPreviewUrl);
    setDocPreviewUrl(null);
    pendingBlobRef.current = null;
    processShot(blob, cameraStep);
  };

  // Stability detection for auto-capture
  const onStableCapture = useCallback(() => {
    if (!autoCaptureLockRef.current) {
      capturePhoto();
    }
  }, [capturePhoto]);

  const { stabilityProgress, documentDetected, initialDelayDone, alignmentProgress, alignedQuadrants } = useStabilityDetection(
    videoRef,
    cameraActive && !uploading && !verifying && !docPreviewUrl,
    onStableCapture,
    1500,
    cameraStep !== 'selfie'
  );

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle identity mode change - deactivate opposing docs
  const handleIdentityModeChange = async (mode: 'ine' | 'pasaporte') => {
    setIdentityMode(mode);
    onTrackFieldChange?.();
    if (mode === 'ine') {
      await supabase
        .from('documentos')
        .update({ activo: false })
        .eq('id_persona', personaId)
        .eq('id_tipo_documento', PASAPORTE_DOC_TYPE)
        .eq('activo', true);
    } else {
      for (const typeId of INE_DOC_TYPES) {
        await supabase
          .from('documentos')
          .update({ activo: false })
          .eq('id_persona', personaId)
          .eq('id_tipo_documento', typeId)
          .eq('activo', true);
      }
    }
    refetchDocs();
    queryClient.invalidateQueries({ queryKey: ['agent-onboarding-docs'] });
  };

  // Filter doc types based on identity mode
  const visibleDocTypes = activeDocTypes.filter(typeId => {
    if (!hasIdentityDocs) return true;
    if (identityMode === 'ine') {
      return typeId !== PASAPORTE_DOC_TYPE;
    } else {
      return !INE_DOC_TYPES.includes(typeId);
    }
  });

  // Con `requireIdentityDocs` la identificación no se lista documento por documento:
  // se resume en una tarjeta (lo que ya está cargado + acciones). Solo la carta (48)
  // y cualquier otro tipo siguen listándose abajo.
  const listedDocTypes = requireIdentityDocs
    ? visibleDocTypes.filter((t) => !CAMERA_DOC_TYPES.includes(t))
    : visibleDocTypes;

  // Show verifying spinner
  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <CaptureFlash show={showFlash} />
        
        {/* Animated verification spinner */}
        <div className="relative flex items-center justify-center">
          {/* Outer pulsing ring */}
          <div className="absolute h-28 w-28 rounded-full border-2 border-emerald-400/30 animate-ping" style={{ animationDuration: '2s' }} />
          {/* Middle rotating gradient ring */}
          <svg className="absolute h-24 w-24 animate-spin" style={{ animationDuration: '3s' }}>
            <defs>
              <linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity="1" />
                <stop offset="50%" stopColor="hsl(142, 76%, 36%)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle cx="48" cy="48" r="44" fill="none" stroke="url(#spinGrad)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {/* Inner circle with shield icon */}
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-400/30 flex items-center justify-center backdrop-blur-sm">
            <Shield className="h-7 w-7 text-emerald-600 animate-pulse" />
          </div>
        </div>

        <div className="text-center space-y-2 max-w-[260px]">
          <p className="text-base font-bold text-foreground">Verificando identidad...</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Analizando autenticidad del documento, extrayendo datos y comparando rostro con selfie
          </p>
        </div>

        {/* Animated steps */}
        <div className="flex flex-col gap-2 w-full max-w-[240px]">
          {['Analizando documento', 'Extrayendo datos', 'Comparando rostro'].map((label, i) => (
            <div key={label} className="flex items-center gap-2.5 animate-fade-in" style={{ animationDelay: `${i * 0.6}s`, animationFillMode: 'both' }}>
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-600" style={{ animationDelay: `${i * 0.3}s` }} />
              </div>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Camera overlay
  if (cameraActive) {
    // Preview del documento capturado — revisar antes de subir/verificar (solo documentos).
    if (docPreviewUrl && cameraStep !== 'selfie') {
      const previewLabel = cameraStep === 'front' ? 'INE - Frente' : cameraStep === 'back' ? 'INE - Reverso' : 'Pasaporte';
      const busy = uploading !== null || verifying;
      return (
        <div className="flex flex-col gap-3 pb-2">
          <CaptureFlash show={showFlash} />
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-foreground">Revisa tu captura</h3>
            <p className="text-xs font-medium text-muted-foreground">{previewLabel} · Verifica que se vea completo y legible</p>
          </div>
          <div className="relative rounded-2xl overflow-hidden border-4 border-primary/40 bg-black aspect-[8/5]">
            <img src={docPreviewUrl} alt="Captura" className="w-full h-full object-contain" />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={retakeDocPreview}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" /> Repetir
            </button>
            <button
              onClick={confirmDocPreview}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-primary bg-card px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/[0.06] disabled:opacity-50"
            >
              {uploading !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Continuar
            </button>
          </div>
        </div>
      );
    }

    if (cameraStep === 'selfie') {
      return (
        <div>
          <CaptureFlash show={showFlash} />
          <SelfieCameraOverlay
            videoRef={videoRef}
            onCapture={capturePhoto}
            onCancel={stopCamera}
            uploading={uploading !== null}
            stabilityProgress={stabilityProgress}
            documentDetected={documentDetected}
            initialDelayDone={initialDelayDone}
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      );
    }

    return (
      <div>
        <CaptureFlash show={showFlash} />
        <DocCameraOverlay
          videoRef={videoRef}
          cameraStep={cameraStep}
          onCapture={capturePhoto}
          onCancel={stopCamera}
          uploading={uploading !== null}
          stabilityProgress={stabilityProgress}
          documentDetected={documentDetected}
          initialDelayDone={initialDelayDone}
          alignmentProgress={alignmentProgress}
          alignedQuadrants={alignedQuadrants}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {/* Selector del tipo de identificación: solo cuando NO hay ninguna cargada.
          Si ya existe INE o pasaporte, no tiene sentido ofrecer el cambio aquí:
          se reemplaza con "Subir una nueva". */}
      {hasIdentityDocs && !hasIdentityDocUploaded && (
        <div className="space-y-1.5">
          <Label className={FIELD_LABEL_CLS}>Tipo de identificación</Label>
          <div className={cn(SEG_TRACK_CLS, "w-full")} role="tablist">
            {([['ine', 'INE'], ['pasaporte', 'Pasaporte']] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={identityMode === mode}
                onClick={() => handleIdentityModeChange(mode)}
                className={segBtnCls(identityMode === mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground/70">
            Solo necesitas uno. Elige el documento que vas a usar; la validación se hace sola al tomar las fotos.
          </p>
        </div>
      )}

      {/* Resumen de la identificación ya cargada (no se recaptura salvo que se pida). */}
      {requireIdentityDocs && (() => {
        const usaPasaporte = identityMode === 'pasaporte';
        const docPrincipal = usaPasaporte ? getDocForType(PASAPORTE_DOC_TYPE) : getDocForType(2);
        const docReverso = usaPasaporte ? null : getDocForType(3);
        const completo = usaPasaporte ? hasPasaporteDocs : ineCompleto;
        const estado = identidadVerificada
          ? { label: 'Verificada', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 }
          : completo
          ? { label: 'Falta verificar', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock }
          : { label: 'Sin cargar', color: 'text-muted-foreground', bg: 'bg-muted', icon: Camera };
        const EstadoIcon = estado.icon;

        return (
          <div className="rounded-md border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {usaPasaporte ? 'Pasaporte' : 'INE (frente y reverso)'}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {completo
                    ? identidadVerificada
                      ? 'Tu identidad ya fue verificada. Puedes firmar tu carta.'
                      : 'Ya tienes tu identificación cargada. Falta la verificación biométrica.'
                    : 'Aún no tienes esta identificación cargada.'}
                </p>
              </div>
              <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${estado.color} ${estado.bg} border-0`}>
                <EstadoIcon className="h-3 w-3 mr-1" />
                {estado.label}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {docPrincipal?.url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const titulo = usaPasaporte ? 'Pasaporte' : 'INE';
                    setIdentityView({
                      titulo,
                      imagenes: [
                        { url: docPrincipal.url, etiqueta: usaPasaporte ? 'Pasaporte' : 'Frente' },
                        ...(docReverso?.url ? [{ url: docReverso.url as string, etiqueta: 'Reverso' }] : []),
                      ],
                    });
                    onTrackDocView?.(titulo);
                  }}
                  className="h-9 px-3 rounded-md font-bold text-xs gap-1.5 border-primary text-primary hover:bg-primary/[0.06]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver {usaPasaporte ? 'pasaporte' : 'INE'}
                </Button>
              )}
              <Button
                variant={completo ? 'ghost' : 'outline'}
                size="sm"
                onClick={() => startDocumentCamera(usaPasaporte ? PASAPORTE_DOC_TYPE : 2)}
                className={cn(
                  "h-9 px-3 rounded-md font-bold text-xs",
                  completo && "text-muted-foreground hover:text-foreground",
                )}
              >
                {completo ? 'Subir una nueva' : `Capturar ${usaPasaporte ? 'pasaporte' : 'INE'}`}
              </Button>
              {completo && !identidadVerificada && (
                <Button
                  size="sm"
                  onClick={iniciarVerificacionBiometrica}
                  disabled={verifying}
                  className="h-9 px-3 rounded-md font-bold text-xs gap-1.5"
                >
                  {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  Verificar identidad
                </Button>
              )}
              {/* Prueba de cámara: solo tiene sentido ANTES de verificar. Una vez
                  verificada la identidad, deja de mostrarse para no sumar ruido. */}
              {completo && !identidadVerificada && docPrincipal?.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFaceVerify({
                    url: docPrincipal.url,
                    label: usaPasaporte ? 'Pasaporte' : 'INE frente',
                    tipos: usaPasaporte ? [PASAPORTE_DOC_TYPE] : [...INE_DOC_TYPES],
                    modo: 'prueba',
                  })}
                  className="h-9 px-3 rounded-md font-bold text-xs text-muted-foreground hover:text-foreground"
                  title="Compara tu rostro contra tu identificación sin salir del dispositivo"
                >
                  Probar cámara
                </Button>
              )}
            </div>
          </div>
        );
      })()}

      {listedDocTypes.map((typeId) => {
        const docType = docTypes.find((d: any) => d.id === typeId);
        const doc = getDocForType(typeId);
        const isCameraDoc = CAMERA_DOC_TYPES.includes(typeId);
        // Identidad se captura por foto: sin documento aún → "Sin capturar" (no "Sin subir").
        const status = !doc && isCameraDoc
          ? { label: 'Sin capturar', color: 'text-muted-foreground', bg: 'bg-muted', icon: Camera }
          : getStatusInfo(doc);
        const StatusIcon = status.icon;
        const isValidated = doc?.id_estatus_verificacion === 2;
        const isUploading = uploading === typeId;

        // Special rendering for doc type 48 (Carta de cumplimiento - firma digital)
        if (typeId === 48) {
          const firmaEstado = firmaExistente?.estado;
          const firmaCompletada = firmaEstado === 'completado';
          const firmaEnProgreso = firmaEstado === 'enviado' || firmaEstado === 'firmado_parcial';
          const agentAlreadySigned = !!firmaExistente?.agentAlreadySigned;
          const pendienteContraparte = firmaEnProgreso && agentAlreadySigned;
          const pdfUrl = firmaExistente?.pdf_firmado_url;

          // Determine status display for firma
          const firmaStatus = firmaCompletada
            ? { label: 'Firmado', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 }
            : pendienteContraparte
            ? { label: 'Pendiente contraparte', color: 'text-blue-600', bg: 'bg-blue-500/10', icon: Clock }
            : firmaEnProgreso
            ? { label: firmaEstado === 'firmado_parcial' ? 'Firma parcial' : 'Enviado', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock }
            : isValidated
            ? { label: 'Validado', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 }
            : doc
            ? status
            : { label: 'Sin firmar', color: 'text-muted-foreground', bg: 'bg-muted', icon: PenTool };

          const FirmaIcon = firmaStatus.icon;

          // Una línea que explique en qué punto va la carta: el badge solo da el
          // estado, no qué sigue.
          const firmaAyuda = firmaCompletada
            ? 'Carta firmada por todas las partes. Puedes consultarla cuando quieras.'
            : pendienteContraparte
            ? 'Ya firmaste. Falta la firma de SOZU para cerrar el documento.'
            : firmaEnProgreso
            ? 'Tu carta ya está lista en Mifiel. Continúa para firmarla.'
            : cartaHabilitada
            ? 'Al firmar se abre tu carta para revisarla y firmarla en línea.'
            : requireIdentityDocs && !identityDocsComplete
            ? 'Agrega tu INE (frente y reverso) o tu pasaporte para habilitar la firma.'
            : requireIdentityDocs && !identidadVerificada
            ? 'Verifica tu identidad con una selfie para habilitar la firma.'
            : 'Completa tu información básica para habilitar la firma.';

          return (
            <div
              key={typeId}
              className="rounded-md border border-border bg-card transition-colors"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <PenTool className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {docType?.nombre || 'Carta de Acuerdos'}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{firmaAyuda}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-0.5 shrink-0 ${firmaStatus.color} ${firmaStatus.bg} border-0`}
                  >
                    <FirmaIcon className="h-3 w-3 mr-1" />
                    {firmaStatus.label}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  {/* Ver PDF: firmado completo (bucket privado) o carta subida a mano.
                      En 'enviado'/'firmado_parcial' no se ofrece el PDF. */}
                  {((firmaCompletada && pdfUrl) || doc?.url) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCartaPdfViewerUrl((firmaCompletada && pdfUrl) ? pdfUrl : (doc?.url || null))}
                      className="h-10 px-3 rounded-md transition-colors font-bold text-xs gap-1.5 border-primary text-primary hover:bg-primary/[0.06]"
                    > Ver PDF
                    </Button>
                  )}

                  {!firmaCompletada && !firmaEnProgreso && !isValidated && (
                    !cartaHabilitada ? (
                      // El motivo del bloqueo va en la línea de ayuda de arriba:
                      // el botón se queda corto y legible.
                      <Button
                        size="sm"
                        disabled
                        variant="outline"
                        className="flex-1 h-10 rounded-md font-bold text-xs gap-1.5"
                      >
                        Firmar carta
                      </Button>
                    ) : (
                    <Button
                      size="sm"
                      disabled={sendingToMifiel}
                      onClick={() => handleRequestAgentSignature("firmar")}
                      variant="outline"
                      className="flex-1 h-10 rounded-md transition-colors font-bold text-xs gap-1.5 border-primary text-primary hover:bg-primary/[0.06]"
                    > {sendingToMifiel ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> ) : (
                        <> Firmar Carta
                        </> )}
                    </Button>
                    )
                  )}

                  {/* Continuar firma button - skip autograph since doc already exists */}
                  {firmaEnProgreso && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={pendienteContraparte ? undefined : () => handleContinuarFirmaInternal()}
                      disabled={syncingFirma || pendienteContraparte}
                      className={cn(
                        "flex-1 h-10 rounded-md transition-colors font-bold text-xs gap-1.5 border-primary text-primary hover:bg-primary/[0.06]",
                        pendienteContraparte
                          ? "opacity-70 cursor-not-allowed"
                          : ""
                      )}
                    >
                      {syncingFirma && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {syncingFirma
                        ? 'Sincronizando...'
                        : pendienteContraparte
                        ? 'Pendiente firma SOZU'
                        : 'Continuar firma'}
                    </Button>
                  )}

                </div>
              </div>
            </div>
          );
        }

        // Todos los documentos (identidad por foto y constancia por archivo):
        // tarjeta compacta en una fila con acciones solo-ícono; ver = visor interno.
        return (
          <div
            key={typeId}
            className="rounded-md border border-border bg-card transition-colors"
          >
            <div className="flex items-center gap-3 p-4">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">
                  {docType?.nombre || `Documento ${typeId}`}
                </div>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-0.5 ${status.color} ${status.bg} border-0`}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc?.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDocView({ url: doc.url, nombre: docType?.nombre || 'Documento' })}
                    title="Ver documento"
                    aria-label="Ver documento"
                    className="h-[34px] w-[34px] p-0 rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => isCameraDoc ? startDocumentCamera(typeId) : handleFileSelect(typeId)}
                  title={isCameraDoc ? (doc ? 'Volver a tomar foto' : 'Tomar foto') : (doc ? 'Reemplazar documento' : 'Subir documento')}
                  aria-label={isCameraDoc ? (doc ? 'Volver a tomar foto' : 'Tomar foto') : (doc ? 'Reemplazar documento' : 'Subir documento')}
                  className="h-[34px] w-[34px] p-0 rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : isCameraDoc ? <Camera className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Mifiel Signing Dialog */}
      {mifielWidgetId && (
        <MifielSigningDialog
          open={mifielDialogOpen}
          onOpenChange={setMifielDialogOpen}
          widgetId={mifielWidgetId}
          onSuccess={handleMifielSuccess}
          onError={(err) => {
            // Detalle del proveedor solo en consola; al agente, mensaje neutro.
            console.error("[mifiel-widget-firma]", err);
            toast.error("No se pudo completar la firma. Inténtalo de nuevo.");
          }}
        />
      )}

      <ModalViewer
        open={!!cartaPdfViewerUrl}
        onOpenChange={(open) => { if (!open) setCartaPdfViewerUrl(null); }}
        url={cartaPdfViewerUrl || ""}
        title="Carta de Cumplimiento"
      />

      {/* Verificación facial local (Human): en modo oficial marca la identificación
          como validada; en modo prueba solo muestra métricas. */}
      {faceVerify && (
        <FaceVerifyDialog
          open
          onOpenChange={(open) => { if (!open) setFaceVerify(null); }}
          docUrl={faceVerify.url}
          docLabel={faceVerify.label}
          modo={faceVerify.modo}
          personaId={personaId}
          tiposIdentificacion={faceVerify.tipos}
          onVerified={() => { refetchDocs(); setFaceVerify(null); }}
        />
      )}

      {/* Visor de la identificación: frente y reverso en una sola vista. */}
      {identityView && (
        <Dialog open onOpenChange={(open) => { if (!open) setIdentityView(null); }}>
          <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
            <ModalFormHeader title={identityView.titulo} subtitle="Identificación registrada" />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted p-4">
              {identityView.imagenes.map((img) => (
                <div key={img.url} className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">{img.etiqueta}</p>
                  <img
                    src={img.url}
                    alt={`${identityView.titulo} ${img.etiqueta}`}
                    className="w-full rounded-md border border-border bg-card object-contain"
                  />
                </div>
              ))}
            </div>
            <div className={MODAL_FOOTER_CLS}>
              <Button variant="cancel" onClick={() => setIdentityView(null)}>Cerrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Visor interno del expediente (PDF o imagen): estándar ui/modal-viewer */}
      {docView && (
        <ModalViewer
          open
          onOpenChange={(open) => { if (!open) setDocView(null); }}
          url={docView.url}
          title={docView.nombre}
        />
      )}

      <SignaturePadDialog
        open={agentSignaturePadOpen}
        onOpenChange={(open) => {
          setAgentSignaturePadOpen(open);
          if (!open) setPendingSignAction(null);
        }}
        initialImage={agentSignatureDataUrl || undefined}
        onSave={handleAgentSignatureSaved}
      />
    </div>
  );
}

// ---------- Step Form ----------

interface StepFormProps {
  step: 'basic' | 'address' | 'fiscal';
  persona: any;
  personaId: number;
  onSaved: () => void | Promise<void>;
}

// ---------- Agent Training Step ----------

function AgentTrainingStep({ personaId, onSaved, onTrackSave, onTrackFieldChange }: { personaId: number; onSaved: () => void; onTrackSave?: () => void; onTrackFieldChange?: () => void }) {
  const queryClient = useQueryClient();
  const { hasBasicIdentityComplete, hasTrainingComplete } = useAgentOnboardingStatus(personaId);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [mode, setMode] = useState<'schedule' | 'already-attended'>('schedule');
  const [attendedDate, setAttendedDate] = useState<Date | undefined>(undefined);
  const initializedFromCita = useRef(false);
  const [citaCancelledExternally, setCitaCancelledExternally] = useState(false);
  const verifiedEventRef = useRef(false);

  // Fetch agent's project access via proyectos_acceso (no RLS restrictions)
  const { data: agentProjectIds = [] } = useQuery({
    queryKey: ['agent-project-ids', personaId],
    queryFn: async () => {
      // First get the agent's email from usuarios
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('email')
        .eq('id_persona', personaId)
        .single();
      if (!usuario?.email) return [];

      // Then get their project access
      const { data, error } = await supabase
        .from('proyectos_acceso')
        .select('proyecto_id')
        .eq('usuario_id', usuario.email)
        .eq('activo', true);
      if (error) throw error;
      return (data || []).map((d: any) => d.proyecto_id as number);
    },
    staleTime: 0,
  });

  // Fetch ALL existing appointments for this agent (not just one)
  const { appointments: allCitas = [] } = useAgentTrainingAppointments(personaId);

  // For backward compat, derive existingCita as the one matching selectedConfigId, or first non-completed
  const existingCitaForConfig = selectedConfigId
    ? allCitas.find((c: any) => c.id_configuracion_cita === selectedConfigId)
    : null;
  const existingCita = existingCitaForConfig || allCitas.find((c: any) =>
    c.estatus === 'programada' || c.estatus === 'no_asistio'
  ) || allCitas[0] || null;

  // Fetch training configs matching agent's projects (DB-only)
  const { data: trainingConfigs = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['training-configs-for-agent', agentProjectIds],
    queryFn: async () => {
      // Get all active training configs (tipo_cita=1)
      const { data: allConfigs } = await supabase
        .from('configuracion_citas_usuarios')
        .select('id, nombre, id_usuario_email, duracion_minutos, max_invitados, correos_enterado, fecha_fin_recurrencia')
        .eq('id_tipo_cita', 1)
        .eq('activo', true);
      if (!allConfigs || allConfigs.length === 0) return [];

      const configIds = allConfigs.map((c: any) => c.id);
      const { data: configProjects } = await supabase
        .from('configuracion_citas_proyectos')
        .select('id_configuracion_cita, id_proyecto')
        .in('id_configuracion_cita', configIds);

      // Solo desarrollos activos y publicados ofrecen citas (los dados de baja no)
      const proyectosHabilitados = await fetchProyectosConCitasHabilitadas(
        (configProjects || []).map((cp: any) => cp.id_proyecto as number),
      );

      // Filter to configs that match agent's projects; store proyecto_ids for later use
      const filtered = allConfigs.filter((c: any) => {
        const projIds = (configProjects || [])
          .filter((cp: any) => cp.id_configuracion_cita === c.id && proyectosHabilitados.has(cp.id_proyecto))
          .map((cp: any) => cp.id_proyecto);
        c.proyecto_ids = projIds;
        return projIds.some((pid: number) => agentProjectIds.includes(pid));
      });

      // Fetch trainer names from personas by email
      const emails = [...new Set(filtered.map((c: any) => c.id_usuario_email).filter(Boolean))];
      if (emails.length > 0) {
        const { data: personas } = await supabase
          .from('personas')
          .select('email, nombre_legal')
          .in('email', emails);
        const emailToName = new Map((personas || []).map((p: any) => [p.email, p.nombre_legal]));
        filtered.forEach((c: any) => {
          c.owner_display_name = emailToName.get(c.id_usuario_email) || null;
        });
      }

      return filtered;
    },
    enabled: agentProjectIds.length > 0,
    staleTime: 0,
  });

  // Fetch horarios for matching configs → generate available dates
  const matchingConfigIds = trainingConfigs.map((c: any) => c.id);
  const { data: availableDates = [], isLoading: loadingDates } = useQuery({
    queryKey: ['training-available-dates-db', matchingConfigIds],
    queryFn: async () => {
      if (matchingConfigIds.length === 0) return [];
      const { data: horarios } = await supabase
        .from('configuracion_citas_horarios')
        .select('id_configuracion_cita, dia_semana')
        .in('id_configuracion_cita', matchingConfigIds)
        .eq('activo', true);
      if (!horarios || horarios.length === 0) return [];

      // Build a map of day_of_week → max fecha_fin_recurrencia across configs
      const dayToMaxEnd = new Map<number, Date>();
      for (const h of horarios) {
        const day = h.dia_semana as number;
        const configId = h.id_configuracion_cita;
        const config = trainingConfigs.find((c: any) => c.id === configId);
        const endStr = config?.fecha_fin_recurrencia;
        const endDate = endStr ? new Date(endStr + 'T23:59:59') : null;
        if (endDate) {
          const current = dayToMaxEnd.get(day);
          if (!current || endDate > current) dayToMaxEnd.set(day, endDate);
        }
        // If any config for this day has no end date, treat as unlimited
        if (!endDate) dayToMaxEnd.set(day, new Date(9999, 11, 31));
      }

      const dates: Date[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 28);

      for (let d = new Date(today); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay();
        const endLimit = dayToMaxEnd.get(jsDay);
        if (endLimit && d >= today && d <= endLimit) {
          dates.push(new Date(d));
        }
      }
      return dates;
    },
    enabled: matchingConfigIds.length > 0,
    staleTime: 0,
  });

  // When a date is selected, fetch available slots from DB
  const fechaStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const dayOfWeek = selectedDate ? selectedDate.getDay() : -1;

  const { data: dbSlots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['training-slots-db', fechaStr, matchingConfigIds, personaId],
    queryFn: async () => {
      if (matchingConfigIds.length === 0 || dayOfWeek < 0) return [];

      // Get configured hours for this weekday
      const { data: horarios } = await supabase
        .from('configuracion_citas_horarios')
        .select('id_configuracion_cita, hora')
        .in('id_configuracion_cita', matchingConfigIds)
        .eq('dia_semana', dayOfWeek)
        .eq('activo', true);
      if (!horarios || horarios.length === 0) return [];

      // Get existing bookings for this date
      const { data: bookings } = await supabase
        .from('reservas_citas')
        .select('id_configuracion_cita, hora_inicio, id_persona')
        .in('id_configuracion_cita', matchingConfigIds)
        .eq('fecha', fechaStr)
        .eq('activo', true)
        .in('estatus', ['programada']);

      // Get externally cancelled slots for this date
      const { data: cancelledSlots } = await supabase
        .from('citas_calendar_events')
        .select('id_configuracion_cita, hora')
        .in('id_configuracion_cita', matchingConfigIds)
        .eq('fecha', fechaStr)
        .eq('cancelado_externamente', true)
        .eq('activo', true);
      const cancelledSet = new Set(
        (cancelledSlots || []).map((cs: any) => `${cs.id_configuracion_cita}_${cs.hora}`)
      );

      // Build slots grouped by config
      type SlotInfo = {
        config_id: number;
        config_name: string;
        owner_name: string;
        hora: string;
        attendees: number;
        max_invitados: number;
        is_full: boolean;
        is_cancelled_externally: boolean;
      };

      const result: SlotInfo[] = [];
      for (const h of horarios) {
        const config = trainingConfigs.find((c: any) => c.id === h.id_configuracion_cita);
        if (!config) continue;

        const horaLabel = `${String(h.hora).padStart(2, '0')}:00`;
        const maxInvitados = (config.max_invitados || 1);
        const isCancelledExternally = cancelledSet.has(`${config.id}_${h.hora}`);

        // Count bookings for this slot (excluding the current persona so they can reschedule)
        const slotBookings = (bookings || []).filter((b: any) =>
          b.id_configuracion_cita === config.id &&
          b.hora_inicio?.slice(0, 5) === horaLabel &&
          b.id_persona !== personaId
        );
        const attendeeCount = slotBookings.length;

        result.push({
          config_id: config.id,
          config_name: config.nombre,
          owner_name: config.id_usuario_email?.split('@')[0] || '',
          hora: horaLabel,
          attendees: attendeeCount,
          max_invitados: maxInvitados,
          is_full: attendeeCount >= maxInvitados,
          is_cancelled_externally: isCancelledExternally,
        });
      }
      return result;
    },
    enabled: !!fechaStr && matchingConfigIds.length > 0,
  });

  // Reset slot when date changes
  useEffect(() => {
    if (initializedFromCita.current) {
      setSelectedSlot('');
      setSelectedConfigId(null);
    }
  }, [fechaStr]);

  // Pre-select date and time from existing appointment
  useEffect(() => {
    if (existingCita && !initializedFromCita.current) {
      initializedFromCita.current = true;
      // If the cita is cancelled or inactive, mark as externally cancelled
      if (existingCita.estatus === 'cancelada' || !existingCita.activo) {
        setCitaCancelledExternally(true);
        return;
      }
      // If admin marked "no asistió", allow rescheduling without pre-selecting old slot
      if (existingCita.estatus === 'no_asistio') {
        return;
      }
      if (existingCita.fecha) {
        setSelectedDate(new Date(existingCita.fecha + 'T12:00:00'));
      }
      if (existingCita.hora_inicio) {
        setSelectedSlot(existingCita.hora_inicio.slice(0, 5));
      }
    }
  }, [existingCita]);

  // Verify if the Google Calendar event still exists for programada/agendada citas only
  useEffect(() => {
    if (existingCita?.estatus === 'programada' && existingCita?.activo && existingCita?.google_calendar_event_id && !verifiedEventRef.current) {
      verifiedEventRef.current = true;
      const config = trainingConfigs.find((c: any) => c.id === existingCita.id_configuracion_cita);
      supabase.functions.invoke('agendar-capacitacion', {
        body: {
          action: 'verify-event',
          google_calendar_event_id: existingCita.google_calendar_event_id,
          reserva_id: existingCita.id,
          calendar_owner_email: config?.id_usuario_email || undefined,
        },
      }).then(({ data }) => {
        if (data && data.exists === false && data.cancelled) {
          setCitaCancelledExternally(true);
          setSelectedDate(undefined);
          setSelectedSlot('');
          setSelectedConfigId(null);
          initializedFromCita.current = true;
          queryClient.invalidateQueries({ queryKey: ['agent-training-appointments', personaId] });
          queryClient.invalidateQueries({ queryKey: ['training-slots-db'] });
        }
      }).catch((err) => {
        console.error('Error verifying calendar event:', err);
      });
    }
  }, [existingCita, trainingConfigs, personaId, queryClient]);

  const getStatusBadge = () => {
    if (citaCancelledExternally) {
      return <Badge variant="destructive"><RefreshCw className="h-3 w-3 mr-1" />Cancelada externamente</Badge>;
    }
    if (!existingCita) return null;
    // El resultado de la cita manda; la etapa de confirmación solo aplica si aún no hay resultado.
    switch (getCitaAsistencia(existingCita)) {
      case 'asistio': return <Badge className="bg-emerald-500 text-white border-0"><CheckCircle2 className="h-3 w-3 mr-1" />Asistió</Badge>;
      case 'no_asistio': return <Badge variant="destructive"><RefreshCw className="h-3 w-3 mr-1" />No asistió</Badge>;
      case 'cancelada': return <Badge variant="outline" className="text-muted-foreground">Cancelada</Badge>;
      default: break;
    }
    const estatusCita = (existingCita as any).id_estatus_cita;
    if (estatusCita === 3) return <Badge className="bg-teal-600 text-white border-0"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmada</Badge>;
    if (estatusCita === 2) return <Badge className="bg-amber-500 text-white border-0"><Clock className="h-3 w-3 mr-1" />Pendiente de confirmación</Badge>;
    return <Badge className="bg-blue-500 text-white border-0"><CalendarDays className="h-3 w-3 mr-1" />Agendada</Badge>;
  };

  // Get the config name to display as title
  const formatConfigLabel = (c: any) => c.owner_display_name ? `${c.nombre} (capacitador: ${c.owner_display_name})` : c.nombre;
  const configName = trainingConfigs.length === 1 ? formatConfigLabel(trainingConfigs[0]) : trainingConfigs.length > 0 ? trainingConfigs.map((c: any) => formatConfigLabel(c)).join(' / ') : 'Capacitación';

  const handleSchedule = async () => {
    onTrackSave?.();
    if (!selectedDate || !selectedSlot || !selectedConfigId) {
      toast.error("Selecciona fecha y hora.");
      return;
    }

    setSaving(true);

    // No longer deactivate existing citas — allow multiple simultaneous citas per config
    try {
      const { data: persona } = await supabase
        .from('personas')
        .select('email')
        .eq('id', personaId)
        .single();

      const selectedConfig: any = trainingConfigs.find((c: any) => c.id === selectedConfigId);
      // Resolve the project for this config that belongs to the agent
      const selectedProyectoId = (selectedConfig?.proyecto_ids as number[] | undefined)
        ?.find((pid) => agentProjectIds.includes(pid)) ?? null;

      const { data, error } = await supabase.functions.invoke('agendar-capacitacion', {
        body: {
          fecha: fechaStr,
          hora_inicio: selectedSlot,
          id_persona: personaId,
          agent_email: persona?.email || '',
          calendar_owner_email: selectedConfig?.id_usuario_email || undefined,
          config_id: selectedConfigId,
          id_proyecto: selectedProyectoId,
        },
      });

      if (error) throw error;
      if (data?.error === 'no_disponible') {
        toast.error(data.message || "El horario no está disponible.");
        queryClient.invalidateQueries({ queryKey: ['training-slots-db'] });
        return;
      }
      if (data?.error) throw new Error(data.error);

      toast.success("Cita de capacitación agendada correctamente.");
      initializedFromCita.current = false;
      queryClient.invalidateQueries({ queryKey: ['agent-training-appointments', personaId] });
      queryClient.invalidateQueries({ queryKey: ['training-slots-db'] });
      onSaved();
    } catch (err: any) {
      console.error("Error scheduling:", err);
      toast.error("Error al agendar: " + (err.message || "Error"));
    } finally {
      setSaving(false);
    }
  };

  // Completed = al menos una cita con asistencia registrada. Una cita solo "Confirmada"
  // (id_estatus_cita = 3) todavía no cuenta como capacitación cumplida.
  const anyCompleted = allCitas.some((c: any) => getCitaAsistencia(c) === 'asistio');
  const allCompleted = hasTrainingComplete || anyCompleted;
  // For the current selected config, check if there's already a programmed cita
  const currentConfigCita = selectedConfigId ? allCitas.find((c: any) => c.id_configuracion_cita === selectedConfigId) : existingCita;
  const isProgrammedForConfig = currentConfigCita && !esCitaResuelta(currentConfigCita) && (currentConfigCita as any).id_estatus_cita !== 2 && !citaCancelledExternally;
  const isPendingConfirmation = (currentConfigCita as any)?.id_estatus_cita === 2;
  const isNoShow = currentConfigCita?.estatus === 'no_asistio';

  const availableSlots = dbSlots.filter(s => !s.is_full);

  const handleAlreadyAttended = async () => {
    onTrackSave?.();
    if (!attendedDate) {
      toast.error("Selecciona la fecha en que acudiste.");
      return;
    }
    setSaving(true);
    try {
      // No longer deactivate existing citas — allow multiple simultaneous citas

      // Insert a new record with status "Pendiente de confirmación"
      const { error } = await supabase
        .from('reservas_citas')
        .insert({
          id_tipo_cita: 1,
          id_persona: personaId,
          fecha: format(attendedDate, 'yyyy-MM-dd'),
          hora_inicio: '00:00',
          hora_fin: '00:00',
          ubicacion: 'Presencial',
          estatus: 'programada',
          id_estatus_cita: 2,
          fecha_asistencia: format(attendedDate, 'yyyy-MM-dd'),
        });
      if (error) throw error;

      toast.success("Asistencia reportada. Pendiente de confirmación del administrador.");
      initializedFromCita.current = false;
      queryClient.invalidateQueries({ queryKey: ['agent-training-appointments', personaId] });
      onSaved();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      {/* Existing citas list */}
      {allCitas.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Tus capacitaciones</span>
          <div className="space-y-2">
            {allCitas.map((cita: any) => {
              const status = getTrainingAppointmentStatus(cita);
              const badge = status.tone === 'success'
                ? <Badge className="bg-emerald-500 text-white border-0 text-xs"><CheckCircle2 className="h-3 w-3 mr-0.5" />{status.label}</Badge>
                : status.tone === 'warning'
                  ? <Badge className="bg-amber-500 text-white border-0 text-xs"><Clock className="h-3 w-3 mr-0.5" />{status.label}</Badge>
                  : status.tone === 'info'
                    ? <Badge className="bg-blue-500 text-white border-0 text-xs"><CalendarDays className="h-3 w-3 mr-0.5" />Agendada</Badge>
                    : status.tone === 'danger'
                      ? <Badge variant="destructive" className="text-xs">{status.label}</Badge>
                      : <Badge variant="outline" className="text-xs">{status.label}</Badge>;
              return (
                <div key={cita.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5 bg-card">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{cita.fecha}</span>
                      {cita.hora_inicio?.slice(0, 5) !== '00:00' && (
                        <span className="text-xs text-muted-foreground">{cita.hora_inicio?.slice(0, 5)}</span>
                      )}
                      {badge}
                    </div>
                    {cita.display_name && <p className="text-xs text-muted-foreground">{cita.display_name}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancelled externally warning */}
      {citaCancelledExternally && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-xs text-destructive font-medium">
            Tu cita fue cancelada por el organizador. Selecciona una nueva fecha y horario para reprogramar.
          </p>
        </div>
      )}

      {/* No show warning */}
      {isNoShow && !citaCancelledExternally && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-700 font-medium">
            Tu asistencia no fue confirmada en la cita anterior. Selecciona una nueva fecha y horario para reagendar.
          </p>
        </div>
      )}

      {isPendingConfirmation && !allCompleted ? (
        <div className="text-center py-6 space-y-2">
          <Clock className="h-12 w-12 text-amber-500 mx-auto" />
          <p className="text-sm font-semibold text-amber-600">Pendiente de confirmación</p>
          <p className="text-xs text-muted-foreground">Reportaste tu asistencia. Un administrador confirmará próximamente.</p>
        </div>
      ) : (
        <>
          {/* Mode toggle (segmentado tipo pestañas) */}
          <div className={SEG_TRACK_CLS} role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'schedule'} onClick={() => setMode('schedule')} className={segBtnCls(mode === 'schedule')}>
              Agendar cita
            </button>
            <button type="button" role="tab" aria-selected={mode === 'already-attended'} onClick={() => setMode('already-attended')} className={segBtnCls(mode === 'already-attended')}>
              Ya acudí
            </button>
          </div>

          {mode === 'already-attended' ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  ¿En qué fecha acudiste?
                </Label>
                <div className="border rounded-lg flex justify-center">
                  <Calendar
                    mode="single"
                    selected={attendedDate}
                    onSelect={(d) => { setAttendedDate(d); onTrackFieldChange?.(); }}
                    disabled={(date) => date > new Date()}
                  />
                </div>
                {attendedDate && (
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    {format(attendedDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                )}
              </div>
              <button
                onClick={handleAlreadyAttended}
                disabled={saving || !attendedDate}
                className="w-full py-4 rounded-md border border-primary bg-card text-primary font-bold text-sm tracking-wide transition-colors hover:bg-primary/[0.06] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : "Reportar asistencia"}
              </button>
            </div>
          ) : (
            <>
              {/* Available Dates as chips */}
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Fechas disponibles
                </Label>
                {configName && (
                  <p className="text-xs text-muted-foreground font-medium -mt-1 mb-1">{configName}</p>
                )}
                {loadingDates || loadingConfigs ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Cargando fechas...</span>
                  </div>
                ) : availableDates.length > 0 ? (
                  (() => {
                    const availableDateSet = new Set(availableDates.map(d => format(d, 'yyyy-MM-dd')));
                    const minDate = availableDates.reduce((a, b) => a < b ? a : b);
                    const maxDate = availableDates.reduce((a, b) => a > b ? a : b);
                    return (
                      <div className="flex justify-center">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => { if (date) { setSelectedDate(date); onTrackFieldChange?.(); } }}
                          disabled={(date) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            return !availableDateSet.has(dateStr);
                          }}
                          fromDate={minDate}
                          toDate={maxDate}
                          modifiers={{
                            existing: existingCita?.fecha ? [new Date(existingCita.fecha + 'T12:00:00')] : [],
                            cancelled: citaCancelledExternally && existingCita?.fecha ? [new Date(existingCita.fecha + 'T12:00:00')] : [],
                          }}
                          modifiersClassNames={{
                            existing: 'ring-2 ring-amber-500/50',
                            cancelled: 'ring-2 ring-destructive/50',
                          }}
                          className="rounded-md border"
                        />
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-6 rounded-md border border-border/60 bg-muted/30">
                    <p className="text-sm text-muted-foreground">No hay fechas disponibles.</p>
                  </div>
                )}
              </div>

              {/* Time Slots from DB */}
              {selectedDate && (
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Horarios disponibles — <span className="capitalize font-normal">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</span>
                  </Label>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Consultando disponibilidad...</span>
                    </div>
                  ) : dbSlots.length > 0 ? (
                    <div className="space-y-4">
                      {trainingConfigs.filter((cfg: any) => dbSlots.some(s => s.config_id === cfg.id)).map((cfg: any) => {
                        const cfgSlots = dbSlots.filter(s => s.config_id === cfg.id);
                        return (
                          <div key={cfg.id} className="space-y-2">
                            <p className={cn(SECTION_HEADER_CLS, "mb-0")}>
                              {cfg.owner_display_name ? `${cfg.nombre} (capacitador: ${cfg.owner_display_name})` : cfg.nombre}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {cfgSlots.map((slot) => {
                                const isExisting = existingCita?.hora_inicio?.slice(0, 5) === slot.hora && existingCita?.fecha === fechaStr;
                                const isCancelledSlot = (citaCancelledExternally && isExisting) || slot.is_cancelled_externally;
                                const isSelected = selectedSlot === slot.hora && selectedConfigId === slot.config_id;
                                // Disable past time slots for today
                                const now = new Date();
                                const isToday = fechaStr === format(now, "yyyy-MM-dd");
                                const [slotH] = slot.hora.split(":").map(Number);
                                const isPastSlot = isToday && slotH <= now.getHours();
                                const isDisabled = slot.is_full || isCancelledSlot || isPastSlot;
                                return (
                                  <button
                                    key={`${slot.config_id}-${slot.hora}`}
                                    onClick={() => {
                                      if (!isDisabled) {
                                        setSelectedSlot(slot.hora);
                                        setSelectedConfigId(slot.config_id);
                                        onTrackFieldChange?.();
                                      }
                                    }}
                                    disabled={isDisabled}
                                    className={`py-2.5 px-3 rounded-md text-sm font-medium transition-all duration-200 border relative ${
                                      isCancelledSlot
                                        ? 'bg-destructive/10 border-destructive/40 text-destructive/60 cursor-not-allowed line-through'
                                        : isPastSlot
                                          ? 'bg-muted/40 border-border/20 text-muted-foreground/40 cursor-not-allowed'
                                          : slot.is_full
                                            ? 'bg-muted/50 border-border/30 text-muted-foreground/50 cursor-not-allowed'
                                            : isSelected
                                              ? 'bg-card text-primary border-primary scale-[1.02]'
                                              : isExisting
                                                ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30'
                                                : 'bg-card border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5'
                                    }`}
                                  >
                                    <span>{slot.hora}</span>
                                    {isCancelledSlot && (
                                      <span className="ml-2 text-xs text-destructive/70">cancelado</span>
                                    )}
                                    {!isCancelledSlot && (
                                      <span className={`ml-2 text-xs ${slot.is_full ? 'text-destructive/60' : 'text-muted-foreground'}`}>
                                        {slot.attendees}/{slot.max_invitados}
                                      </span>
                                    )}
                                    {isExisting && !isSelected && !isCancelledSlot && (
                                      <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-amber-500 border-2 border-card" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 rounded-md border border-border/60 bg-muted/30">
                      <p className="text-sm text-muted-foreground">No hay horarios disponibles para esta fecha.</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Selecciona otra fecha.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  variant="primary-outline"
                  onClick={handleSchedule}
                  disabled={saving || !selectedDate || !selectedSlot}
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Agendando...</> : citaCancelledExternally ? "Reprogramar Cita" : "Agendar Cita"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
// ---------- Step Form ----------

interface StepFormProps {
  step: 'basic' | 'address' | 'fiscal';
  persona: any;
  personaId: number;
  onSaved: () => void | Promise<void>;
  onClose?: () => void;
  onTrackSave?: () => void;
  onTrackFieldChange?: () => void;
  initialTab?: string;
}

function StepForm({ step, persona, personaId, onSaved, onClose, onTrackSave, onTrackFieldChange, initialTab }: StepFormProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(
    initialTab || (step === 'basic' ? 'personal' : step === 'fiscal' ? 'datos' : '')
  );

  // ¿Agente independiente? (sin inmobiliaria). Solo a ellos se les pide la Carta
  // de comercialización, que se firma al final del paso Identidad (tab Dirección).
  const { data: hasInmobiliaria = false } = useQuery({
    queryKey: ['stepform-inmo', personaId],
    queryFn: async () => {
      if (!personaId) return false;
      const { data } = await supabase
        .from('entidades_relacionadas')
        .select('id')
        .eq('id_persona', personaId)
        .eq('id_tipo_entidad', 19)
        .eq('activo', true)
        .not('id_persona_duena_lead', 'is', null)
        .limit(1);
      return (data && data.length > 0) || false;
    },
    enabled: !!personaId,
    staleTime: 60_000,
  });
  const esIndependiente = !hasInmobiliaria;
  // Super Admin / roles con `puede_impersonar` siempre ven la sección de la carta
  // (soporte: necesitan revisarla o reenviarla), aunque la persona sea dependiente.
  const fullAccess = useAgentPortalFullAccess();
  const mostrarCarta = esIndependiente || fullAccess;

  // Basic fields
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [curp, setCurp] = useState('');
  const [sexo, setSexo] = useState('');

  // Address fields
  const [calle, setCalle] = useState('');
  const [numExt, setNumExt] = useState('');
  const [numInt, setNumInt] = useState('');
  const [colonia, setColonia] = useState('');
  const [cp, setCp] = useState('');
  const [idPais, setIdPais] = useState('');
  const [idEstado, setIdEstado] = useState('');
  const [idMunicipio, setIdMunicipio] = useState('');

  // Fiscal fields
  const [rfc, setRfc] = useState('');
  const [regimen, setRegimen] = useState('');
  const [usoCfdi, setUsoCfdi] = useState('');
  const [fCalle, setFCalle] = useState('');
  const [fNumExt, setFNumExt] = useState('');
  const [fNumInt, setFNumInt] = useState('');
  const [fColonia, setFColonia] = useState('');
  const [fCp, setFCp] = useState('');
  const [fIdPais, setFIdPais] = useState('');
  const [fIdEstado, setFIdEstado] = useState('');
  const [fIdMunicipio, setFIdMunicipio] = useState('');
  const [copiarDireccion, setCopiarDireccion] = useState(false);
  const initializedRef = useRef(false);

  // Initialize from persona
  useEffect(() => {
    if (!persona) return;
    setNombre(persona.nombre_legal || '');
    setEmail(persona.email || '');
    setTelefono(persona.telefono || '');
    setCurp(persona.curp || '');
    setSexo(persona.sexo || '');
    setCalle(persona.direccion_calle || '');
    setNumExt(persona.direccion_num_ext || '');
    setNumInt(persona.direccion_num_int || '');
    setColonia(persona.direccion_colonia || '');
    setCp(persona.direccion_codigo_postal || '');
    setIdPais(persona.direccion_id_pais || '');
    setIdEstado(persona.direccion_id_estado?.toString() || '');
    setIdMunicipio(persona.direccion_id_municipio?.toString() || '');
    setRfc(persona.rfc || '');
    setRegimen(persona.regimen?.toString() || '');
    setUsoCfdi(persona.uso_cfdi || '');
    setFCalle(persona.direccion_fiscal_calle || '');
    setFNumExt(persona.direccion_fiscal_num_ext || '');
    setFNumInt(persona.direccion_fiscal_num_int || '');
    setFColonia(persona.direccion_fiscal_colonia || '');
    setFCp(persona.direccion_fiscal_codigo_postal || '');
    setFIdPais(persona.direccion_fiscal_id_pais || '');
    setFIdEstado(persona.direccion_fiscal_id_estado?.toString() || '');
    setFIdMunicipio(persona.direccion_fiscal_id_municipio?.toString() || '');
    initializedRef.current = true;
  }, [persona]);

  // Lookups
  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: async () => {
      const { data } = await supabase.from('paises').select('id, nombre').eq('activo', true).order('nombre');
      return data || [];
    },
  });

  const { data: estados = [] } = useQuery({
    queryKey: ['estados'],
    queryFn: async () => {
      const { data } = await supabase.from('estados_mx').select('id, nombre, id_pais').eq('activo', true).order('nombre');
      return data || [];
    },
  });

  const { data: municipios = [] } = useQuery({
    queryKey: ['municipios-all'],
    queryFn: async () => {
      const { data } = await supabase.from('municipios_mx').select('id, nombre, id_estado').eq('activo', true).order('nombre');
      return data || [];
    },
    enabled: step === 'basic' || step === 'address' || step === 'fiscal',
  });

  const { data: regimenes = [] } = useQuery({
    queryKey: ['regimen', 'pf'],
    queryFn: async () => {
      const { data } = await supabase.from('regimen').select('id, nombre').eq('activo', true).in('tipo', ['pf']).order('nombre');
      return data || [];
    },
    enabled: step === 'fiscal',
  });

  const { data: usosCfdi = [] } = useQuery({
    queryKey: ['uso_cfdi', 'pf'],
    queryFn: async () => {
      const { data } = await supabase.from('uso_cfdi').select('codigo, nombre').eq('activo', true).in('tipo', ['pf', 'a']).order('codigo');
      return data || [];
    },
    enabled: step === 'fiscal',
  });

  // Copy address for fiscal only when the checkbox changes after initialization
  useEffect(() => {
    if (!initializedRef.current || !persona) return;

    if (copiarDireccion) {
      setFCalle(calle || persona.direccion_calle || '');
      setFNumExt(numExt || persona.direccion_num_ext || '');
      setFNumInt(numInt || persona.direccion_num_int || '');
      setFColonia(colonia || persona.direccion_colonia || '');
      setFCp(cp || persona.direccion_codigo_postal || '');
      setFIdPais(idPais || persona.direccion_id_pais || '');
      setFIdEstado(idEstado || persona.direccion_id_estado?.toString() || '');
      setFIdMunicipio(idMunicipio || persona.direccion_id_municipio?.toString() || '');
      return;
    }

    const hasFiscalData = Boolean(
      persona.direccion_fiscal_calle ||
      persona.direccion_fiscal_num_ext ||
      persona.direccion_fiscal_num_int ||
      persona.direccion_fiscal_colonia ||
      persona.direccion_fiscal_codigo_postal ||
      persona.direccion_fiscal_id_pais ||
      persona.direccion_fiscal_id_estado ||
      persona.direccion_fiscal_id_municipio
    );

    if (!hasFiscalData) {
      setFCalle('');
      setFNumExt('');
      setFNumInt('');
      setFColonia('');
      setFCp('');
      setFIdPais('');
      setFIdEstado('');
      setFIdMunicipio('');
    }
  }, [copiarDireccion, persona, calle, numExt, numInt, colonia, cp, idPais, idEstado, idMunicipio]);

  // Filtered lookups
  const filteredEstados = (paisId: string) => estados.filter((e: any) => e.id_pais === paisId);
  const filteredMunicipios = (estadoId: string) => municipios.filter((m: any) => m.id_estado === parseInt(estadoId));

  /** Catálogo `{ id, nombre }` → opciones del `SearchableSelect`. */
  const toOptions = (rows: any[]): SearchableOption[] =>
    rows.map((r: any) => ({ value: r.id.toString(), label: r.nombre }));

  const paisOptions = useMemo(() => toOptions(paises), [paises]);
  const regimenOptions = useMemo(() => toOptions(regimenes), [regimenes]);
  // El código (G03, D01…) también busca, aunque el label ya lo muestre.
  const usoCfdiOptions = useMemo<SearchableOption[]>(
    () => usosCfdi.map((u: any) => ({ value: u.codigo, label: `${u.codigo} - ${u.nombre}`, keywords: u.codigo })),
    [usosCfdi]
  );

  /**
   * Persiste el paso actual. Devuelve true solo si se guardó: lo usan tanto el
   * botón "Guardar y finalizar" como la firma de la carta (que guarda sola, sin
   * obligar al agente a cerrar y reabrir el modal).
   */
  const savePersona = async (): Promise<boolean> => {
    setSaving(true);
    try {
      let updateData: any = {};
      let isIncomplete = false;

      if (step === 'basic') {
        // Validate format only if provided
        if (telefono.trim() && telefono.trim().length !== 10) {
          toast.error("El teléfono debe tener 10 dígitos.");
          setSaving(false);
          return false;
        }
        if (curp.trim()) {
          const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
          if (!curpRegex.test(curp.trim().toUpperCase())) {
            toast.error("El formato del CURP no es válido (18 caracteres alfanuméricos).");
            setSaving(false);
            return false;
          }
        }
        isIncomplete = !nombre.trim() || !email.trim() || !telefono.trim() || !calle.trim() || !numExt.trim() || !colonia.trim() || !cp.trim() || !idPais || !idEstado || !idMunicipio;
        updateData = {
          nombre_legal: nombre.trim() || null,
          email: email.trim() || null,
          telefono: telefono.trim() || null,
          curp: curp.trim().toUpperCase() || null,
          sexo: sexo || null,
          direccion_calle: calle.trim() || null,
          direccion_num_ext: numExt.trim() || null,
          direccion_num_int: numInt.trim() || null,
          direccion_colonia: colonia.trim() || null,
          direccion_codigo_postal: cp.trim() || null,
          direccion_id_pais: idPais || null,
          direccion_id_estado: idEstado ? parseInt(idEstado) : null,
          direccion_id_municipio: idMunicipio ? parseInt(idMunicipio) : null,
        };
      } else if (step === 'address') {
        isIncomplete = !calle.trim() || !numExt.trim() || !colonia.trim() || !cp.trim() || !idPais || !idEstado || !idMunicipio;
        updateData = {
          direccion_calle: calle.trim() || null,
          direccion_num_ext: numExt.trim() || null,
          direccion_num_int: numInt.trim() || null,
          direccion_colonia: colonia.trim() || null,
          direccion_codigo_postal: cp.trim() || null,
          direccion_id_pais: idPais || null,
          direccion_id_estado: idEstado ? parseInt(idEstado) : null,
          direccion_id_municipio: idMunicipio ? parseInt(idMunicipio) : null,
        };
      } else if (step === 'fiscal') {
        if (rfc.trim()) {
          const rfcValidation = validateRFC(rfc);
          if (!rfcValidation.isValid) {
            toast.error(rfcValidation.error || "RFC inválido.");
            setSaving(false);
            return false;
          }
        }
        const regimenValido = !!regimen && (regimenes.length === 0 || regimenes.some((r: any) => r.id.toString() === regimen));
        isIncomplete = !rfc.trim() || !regimenValido || !usoCfdi || !fCalle.trim() || !fNumExt.trim() || !fColonia.trim() || !fCp.trim() || !fIdPais || !fIdEstado || !fIdMunicipio;
        updateData = {
          rfc: rfc.trim().toUpperCase() || null,
          regimen: regimen || null,
          uso_cfdi: usoCfdi || null,
          direccion_fiscal_calle: fCalle.trim() || null,
          direccion_fiscal_num_ext: fNumExt.trim() || null,
          direccion_fiscal_num_int: fNumInt.trim() || null,
          direccion_fiscal_colonia: fColonia.trim() || null,
          direccion_fiscal_codigo_postal: fCp.trim() || null,
          direccion_fiscal_id_pais: fIdPais || null,
          direccion_fiscal_id_estado: fIdEstado ? parseInt(fIdEstado) : null,
          direccion_fiscal_id_municipio: fIdMunicipio ? parseInt(fIdMunicipio) : null,
        };
      }

      // La DB exige los obligatorios: si faltan, no se guarda (ni se sobrescribe con vacío).
      if (isIncomplete) {
        toast.error("Completa todos los campos obligatorios (*). No pueden quedar vacíos.");
        setSaving(false);
        return false;
      }

      const { data: updatedRow, error } = await supabase
        .from('personas')
        .update(updateData)
        .eq('id', personaId)
        .select()
        .single();

      if (error) throw error;

      // Update query cache immediately with the returned data
      if (updatedRow) {
        queryClient.setQueryData(['agent-onboarding-step-persona', personaId], updatedRow);
      }

      // Sync phone to usuarios if basic step
      if (step === 'basic' && telefono.trim()) {
        await supabase
          .from('usuarios')
          .update({ telefono: telefono.trim() })
          .eq('id_persona', personaId);
      }

      return true;
    } catch (err: any) {
      const msg = err.message || "Error desconocido";
      if (msg.includes("personas_rfc_key") || (msg.includes("duplicate") && msg.includes("rfc"))) {
        toast.error("El RFC ingresado ya está dado de alta en el sistema. Verifica e ingresa un RFC diferente.");
      } else if (msg.includes("personas_curp_key") || (msg.includes("duplicate") && msg.includes("curp"))) {
        toast.error("El CURP ingresado ya está dado de alta en el sistema.");
      } else {
        toast.error("Error al guardar: " + msg);
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    onTrackSave?.();
    const guardado = await savePersona();
    if (!guardado) return;
    toast.success("Información guardada correctamente.");
    await onSaved();
  };

  // Guardado silencioso previo a firmar la carta: mismo validador que "Guardar y
  // finalizar", pero sin cerrar el modal (la firma continúa en el mismo flujo).
  const handleSaveBeforeSign = async () => {
    onTrackSave?.();
    const guardado = await savePersona();
    if (guardado) {
      await queryClient.refetchQueries({ queryKey: ['agent-onboarding-persona', personaId] });
      queryClient.invalidateQueries({ queryKey: ['agent-onboarding-persona'] });
    }
    return guardado;
  };

  // Obligatorios del paso Identidad ya capturados (aunque aún sin guardar):
  // con esto el botón "Firmar Carta" se habilita sin cerrar y reabrir el modal.
  const identidadCompleta = Boolean(
    nombre.trim() && email.trim() && telefono.trim().length === 10 &&
    calle.trim() && numExt.trim() && colonia.trim() && cp.trim() &&
    idPais && idEstado && idMunicipio
  );

  // Render address fields helper
  const renderAddressFields = (
    prefix: string,
    calleVal: string, setCalleVal: (v: string) => void,
    numExtVal: string, setNumExtVal: (v: string) => void,
    numIntVal: string, setNumIntVal: (v: string) => void,
    coloniaVal: string, setColoniaVal: (v: string) => void,
    cpVal: string, setCpVal: (v: string) => void,
    paisVal: string, setPaisVal: (v: string) => void,
    estadoVal: string, setEstadoVal: (v: string) => void,
    municipioVal: string, setMunicipioVal: (v: string) => void,
  ) => (
    <div className="space-y-4">
      <div>
        <Label className={FIELD_LABEL_CLS}>Calle <Req /></Label>
        <Input value={calleVal} onChange={(e) => setCalleVal(e.target.value)} placeholder="Av. Insurgentes Sur" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className={FIELD_LABEL_CLS}>Num. Ext. <Req /></Label>
          <Input value={numExtVal} onChange={(e) => setNumExtVal(e.target.value)} placeholder="1234" />
        </div>
        <div>
          <Label className={FIELD_LABEL_CLS}>Num. Int.</Label>
          <Input value={numIntVal} onChange={(e) => setNumIntVal(e.target.value)} placeholder="4B" />
        </div>
      </div>
      <div>
        <Label className={FIELD_LABEL_CLS}>Colonia <Req /></Label>
        <Input value={coloniaVal} onChange={(e) => setColoniaVal(e.target.value)} placeholder="Del Valle" />
      </div>
      {/* Desktop: CP + País en una fila, Estado + Municipio en la siguiente. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className={FIELD_LABEL_CLS}>Código Postal <Req /></Label>
          <Input value={cpVal} onChange={(e) => setCpVal(e.target.value)} placeholder="03100" maxLength={5} />
        </div>
        <div>
          <Label className={FIELD_LABEL_CLS}>País <Req /></Label>
          <SearchableSelect
            value={paisVal}
            onValueChange={(v) => { setPaisVal(v); setEstadoVal(''); setMunicipioVal(''); }}
            options={paisOptions}
            itemsLabel="países"
            searchPlaceholder="Buscar país…"
            aria-label="País"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className={FIELD_LABEL_CLS}>Estado <Req /></Label>
          <SearchableSelect
            value={estadoVal}
            onValueChange={(v) => { setEstadoVal(v); setMunicipioVal(''); }}
            options={toOptions(filteredEstados(paisVal))}
            itemsLabel="estados"
            searchPlaceholder="Buscar estado…"
            disabled={!paisVal}
            placeholder={paisVal ? 'Selecciona' : 'Elige país primero'}
            aria-label="Estado"
          />
        </div>
        <div>
          <Label className={FIELD_LABEL_CLS}>Municipio <Req /></Label>
          <SearchableSelect
            value={municipioVal}
            onValueChange={setMunicipioVal}
            options={toOptions(filteredMunicipios(estadoVal))}
            itemsLabel="municipios"
            searchPlaceholder="Buscar municipio…"
            disabled={!estadoVal}
            placeholder={estadoVal ? 'Selecciona' : 'Elige estado primero'}
            aria-label="Municipio"
          />
        </div>
      </div>
    </div>
  );

  // Paso "Identidad": datos personales + dirección. Los agentes independientes suman
  // una tercera pestaña donde verifican su identidad (INE o pasaporte) y firman la
  // Carta de comercialización: sin identificación capturada, la firma no se habilita.
  const basicTabs = (mostrarCarta
    ? ['personal', 'address', 'carta']
    : ['personal', 'address']) as readonly string[];
  const basicTabLabels = mostrarCarta
    ? ['Datos personales', 'Dirección', 'Carta']
    : ['Datos personales', 'Dirección'];
  const fiscalTabs = ['datos', 'direccion', 'constancia'] as const;
  const fiscalTabLabels = ['Datos', 'Dirección', 'Constancia'];

  const currentTabs: readonly string[] = step === 'basic' ? basicTabs : step === 'fiscal' ? fiscalTabs : [];
  const currentTabLabels = step === 'basic' ? basicTabLabels : step === 'fiscal' ? fiscalTabLabels : [];
  const currentTabIndex = currentTabs.indexOf(activeTab);
  const isLastTab = currentTabIndex === currentTabs.length - 1;
  const isDocTab = activeTab === 'documents' || activeTab === 'constancia' || activeTab === 'carta';

  // Obligatorios (los marcados con *). La DB los exige: sin ellos no se guarda ni se avanza.
  const requiredMissing = (): string[] => {
    const miss: string[] = [];
    if (step === 'basic' && activeTab === 'personal') {
      if (!nombre.trim()) miss.push('Nombre completo');
      if (!telefono.trim()) miss.push('Teléfono');
    } else if (step === 'basic' && activeTab === 'address') {
      if (!calle.trim()) miss.push('Calle');
      if (!numExt.trim()) miss.push('Número exterior');
      if (!colonia.trim()) miss.push('Colonia');
      if (!cp.trim()) miss.push('Código Postal');
      if (!idPais) miss.push('País');
      if (!idEstado) miss.push('Estado');
      if (!idMunicipio) miss.push('Municipio');
    } else if (step === 'fiscal' && activeTab === 'datos') {
      if (!rfc.trim()) miss.push('RFC');
      // El régimen debe ser una opción válida de la lista (no un id "fantasma"
      // que deja el Select en blanco pero con valor en estado).
      const regimenValido = !!regimen && (regimenes.length === 0 || regimenes.some((r: any) => r.id.toString() === regimen));
      if (!regimenValido) miss.push('Régimen Fiscal');
      if (!usoCfdi) miss.push('Uso CFDI');
    } else if (step === 'fiscal' && activeTab === 'direccion') {
      if (!fCalle.trim()) miss.push('Calle');
      if (!fNumExt.trim()) miss.push('Número exterior');
      if (!fColonia.trim()) miss.push('Colonia');
      if (!fCp.trim()) miss.push('Código Postal');
      if (!fIdPais) miss.push('País');
      if (!fIdEstado) miss.push('Estado');
      if (!fIdMunicipio) miss.push('Municipio');
    }
    return miss;
  };

  const warnRequired = (miss: string[]) => {
    toast.error(
      miss.length === 1
        ? `El campo "${miss[0]}" es obligatorio, no puede estar vacío.`
        : `Faltan campos obligatorios: ${miss.join(', ')}.`
    );
  };

  // Solo valida (obligatorios + formato) y avanza. NO guarda en BD:
  // la información se persiste una sola vez al finalizar el último paso.
  const handleNextTab = () => {
    const miss = requiredMissing();
    if (miss.length) { warnRequired(miss); return; }

    // Validación de formato del tab actual
    if (step === 'basic' && activeTab === 'personal') {
      if (telefono.trim().length !== 10) {
        toast.error("El teléfono debe tener 10 dígitos.");
        return;
      }
      if (curp.trim()) {
        const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
        if (!curpRegex.test(curp.trim().toUpperCase())) {
          toast.error("El formato del CURP no es válido (18 caracteres alfanuméricos).");
          return;
        }
      }
    } else if (step === 'fiscal' && activeTab === 'datos') {
      const rfcValidation = validateRFC(rfc);
      if (!rfcValidation.isValid) {
        toast.error(rfcValidation.error || "RFC inválido.");
        return;
      }
    }

    onTrackFieldChange?.();
    const nextIndex = currentTabIndex + 1;
    if (nextIndex < currentTabs.length) {
      setActiveTab(currentTabs[nextIndex]);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      {step === 'basic' && (
        <Tabs value={activeTab} className="w-full">
          <TabsList className={cn("grid w-full mb-4", mostrarCarta ? "grid-cols-3" : "grid-cols-2")}>
            {basicTabs.map((tab, i) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="text-xs pointer-events-none data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-semibold"
              >
                {basicTabLabels[i]}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Indicador de progreso (solo visual, no navega) */}
          <div className="flex items-center justify-center gap-1.5 mb-3">
            {basicTabs.map((tab, i) => (
              <div key={tab} className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === currentTabIndex ? "w-6 bg-primary" : i < currentTabIndex ? "w-4 bg-primary/60" : "w-4 bg-muted"
              )} />
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {currentTabIndex + 1} de {basicTabs.length}
            </span>
          </div>

          <TabsContent value="personal" className="space-y-4">
            <div>
              <Label className={FIELD_LABEL_CLS}>Nombre completo <Req /></Label>
              <Input value={nombre} onChange={(e) => { setNombre(e.target.value); onTrackFieldChange?.(); }} placeholder="Juan Pérez García" />
            </div>
            <div>
              <Label className={FIELD_LABEL_CLS}>Correo electrónico <Req /></Label>
              <Input type="email" value={email} disabled />
            </div>
            <div>
              <Label className={FIELD_LABEL_CLS}>Teléfono (10 dígitos) <Req /></Label>
              <Input value={telefono} onChange={(e) => { setTelefono(e.target.value.replace(/\D/g, '')); onTrackFieldChange?.(); }} maxLength={10} placeholder="5512345678" />
            </div>
            <div>
              <Label className={FIELD_LABEL_CLS}>CURP <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <Input value={curp} onChange={(e) => setCurp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={18} placeholder="GARC850101HDFRRL09" />
            </div>
            <div>
              <Label className={FIELD_LABEL_CLS}>Tipo de Persona</Label>
              <Input value="Persona Física" disabled />
            </div>
            <div>
              <Label className={FIELD_LABEL_CLS}>Sexo <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <SearchableSelect
                value={sexo}
                onValueChange={setSexo}
                options={SEXO_OPTIONS}
                placeholder="Selecciona sexo"
                aria-label="Sexo"
              />
            </div>
          </TabsContent>
          <TabsContent value="address" className="space-y-4">
            {renderAddressFields(
              'dir', calle, setCalle, numExt, setNumExt, numInt, setNumInt,
              colonia, setColonia, cp, setCp, idPais, setIdPais, idEstado, setIdEstado, idMunicipio, setIdMunicipio
            )}
          </TabsContent>
          {/* Pestaña 3 (agentes independientes + soporte con acceso completo):
              verificación de identidad y firma de la Carta de comercialización.
              La firma se desbloquea hasta tener INE (frente y reverso) o pasaporte. */}
          <TabsContent value="carta" className="space-y-4">
            <div>
              <div className="text-sm font-bold text-foreground">Verificación de identidad</div>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground/70">
                Esta es la identificación que tenemos registrada. Verifica tu identidad con una selfie
                (o sube una nueva identificación) para habilitar la firma de tu carta.
              </p>
            </div>
            <AgentDocumentsStep
              personaId={personaId}
              filterDocTypes={[...INE_DOC_TYPES, PASAPORTE_DOC_TYPE, 48]}
              onTrackFieldChange={onTrackFieldChange}
              signGateReady={identidadCompleta}
              onBeforeSign={handleSaveBeforeSign}
              requireIdentityDocs
            />
          </TabsContent>
        </Tabs>
      )}

      {step === 'address' && renderAddressFields(
        'dir', calle, setCalle, numExt, setNumExt, numInt, setNumInt,
        colonia, setColonia, cp, setCp, idPais, setIdPais, idEstado, setIdEstado, idMunicipio, setIdMunicipio
      )}

      {step === 'fiscal' && (
        <Tabs value={activeTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="datos" className="text-xs pointer-events-none data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-semibold">Datos</TabsTrigger>
            <TabsTrigger value="direccion" className="text-xs pointer-events-none data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-semibold">Dirección</TabsTrigger>
            <TabsTrigger value="constancia" className="text-xs pointer-events-none data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-semibold">Constancia</TabsTrigger>
          </TabsList>

          {/* Indicador de progreso (solo visual, no navega) */}
          <div className="flex items-center justify-center gap-1.5 mb-3">
            {fiscalTabs.map((tab, i) => (
              <div key={tab} className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === currentTabIndex ? "w-6 bg-primary" : i < currentTabIndex ? "w-4 bg-primary/60" : "w-4 bg-muted"
              )} />
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {currentTabIndex + 1} de {fiscalTabs.length}
            </span>
          </div>

          <TabsContent value="datos" className="space-y-4">
            <div>
              <Label className={FIELD_LABEL_CLS}>RFC <Req /></Label>
              <Input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} maxLength={13} placeholder="PEGJ850101H2A" />
            </div>
            <div>
              <Label className={FIELD_LABEL_CLS}>Régimen Fiscal <Req /></Label>
              <SearchableSelect
                value={regimen}
                onValueChange={setRegimen}
                options={regimenOptions}
                itemsLabel="regímenes"
                searchPlaceholder="Buscar régimen…"
                aria-label="Régimen fiscal"
              />
            </div>
            <div>
              <Label className={FIELD_LABEL_CLS}>Uso CFDI <Req /></Label>
              <SearchableSelect
                value={usoCfdi}
                onValueChange={setUsoCfdi}
                options={usoCfdiOptions}
                itemsLabel="usos"
                searchPlaceholder="Buscar por código o nombre…"
                aria-label="Uso CFDI"
              />
            </div>
          </TabsContent>
          <TabsContent value="direccion" className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="copiar" checked={copiarDireccion} onCheckedChange={(c) => setCopiarDireccion(!!c)} />
              <Label htmlFor="copiar" className="text-sm cursor-pointer">Copiar dirección física</Label>
            </div>
            {renderAddressFields(
              'fiscal', fCalle, setFCalle, fNumExt, setFNumExt, fNumInt, setFNumInt,
              fColonia, setFColonia, fCp, setFCp, fIdPais, setFIdPais, fIdEstado, setFIdEstado, fIdMunicipio, setFIdMunicipio
            )}
          </TabsContent>
          <TabsContent value="constancia" className="space-y-4">
            <AgentDocumentsStep personaId={personaId} filterDocTypes={FISCAL_DOC_TYPES} onTrackFieldChange={onTrackFieldChange} />
          </TabsContent>
        </Tabs>
      )}

      {/* Navigation buttons (estándar: derecha, outline verde) */}
      <div className="flex justify-end gap-2.5 border-t border-border pt-4 mt-2">
        {currentTabIndex > 0 && (
          <Button variant="outline" onClick={() => setActiveTab(currentTabs[currentTabIndex - 1])}> Atrás
          </Button>
        )}
        {isDocTab && isLastTab ? (
          <Button variant="primary-outline" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : "Finalizar"}
          </Button>
        ) : !isDocTab && (
          <Button
            variant="primary-outline"
            onClick={isLastTab ? handleSave : handleNextTab}
            disabled={saving}
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : isLastTab ? "Guardar y finalizar" : (
              <>Siguiente <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------- Agent Bank Account Step (single account, evidence required) ----------

function AgentBankAccountStep({
  personaId,
  mode = 'edit',
  accountId = null,
  onTrackFieldChange,
  onTrackSave,
}: {
  personaId: number;
  /** 'create' → formulario vacío para una cuenta nueva; 'edit' → carga la cuenta. */
  mode?: 'create' | 'edit';
  /** Cuenta a editar. Si no se pasa en modo 'edit', toma la más reciente. */
  accountId?: number | null;
  onTrackFieldChange?: () => void;
  onTrackSave?: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [bankId, setBankId] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [clabe, setClabe] = useState('');
  const [evidencia, setEvidencia] = useState('');
  const [titular, setTitular] = useState('');
  const [titularIsSamePerson, setTitularIsSamePerson] = useState(false);
  const [existingId, setExistingId] = useState<number | null>(null);

  const isCreate = mode === 'create';

  // Fetch persona name for "same person" checkbox
  const { data: personaName } = useQuery({
    queryKey: ['agent-persona-name', personaId],
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('nombre_legal').eq('id', personaId).single();
      return data?.nombre_legal || '';
    },
    enabled: !!personaId,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data } = await supabase.from('bancos').select('id, nombre').eq('activo', true).order('nombre');
      return data || [];
    },
  });

  const bankOptions = useMemo<SearchableOption[]>(
    () => banks.map((b: any) => ({ value: b.id.toString(), label: b.nombre })),
    [banks]
  );

  // En modo 'create' no se carga ninguna cuenta: el formulario arranca vacío.
  const { data: existingAccount, isLoading } = useQuery({
    queryKey: ['agent-bank-account', personaId, accountId],
    queryFn: async () => {
      let q = (supabase as any)
        .from('cuentas_bancarias')
        .select('*, banco:bancos(nombre)')
        .eq('id_persona', personaId)
        .eq('activo', true);
      if (accountId) q = q.eq('id', accountId);
      const { data } = await q.order('fecha_creacion', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!personaId && !isCreate,
  });

  useEffect(() => {
    if (isCreate || !existingAccount) return;
    setBankId(existingAccount.id_banco?.toString() || '');
    setNumeroCuenta(existingAccount.numero_cuenta || '');
    setClabe(existingAccount.cuenta_clabe || '');
    setEvidencia(existingAccount.url_evidencia || '');
    setTitular((existingAccount as any).titular || '');
    setExistingId(existingAccount.id);
    if ((existingAccount as any).titular && personaName && (existingAccount as any).titular === personaName) {
      setTitularIsSamePerson(true);
    }
  }, [existingAccount, personaName, isCreate]);

  const handleSave = async () => {
    onTrackSave?.();
    if (!bankId || !numeroCuenta) {
      toast.error("Completa banco y número de cuenta.");
      return;
    }
    if (!titular.trim()) {
      toast.error("El nombre del titular es obligatorio.");
      return;
    }
    if (!evidencia) {
      toast.error("La evidencia es obligatoria.");
      return;
    }
    if (!/^\d+$/.test(numeroCuenta)) {
      toast.error("El número de cuenta solo debe contener dígitos.");
      return;
    }
    if (numeroCuenta.length < 8 || numeroCuenta.length > 34) {
      toast.error("El número de cuenta debe tener entre 8 y 34 dígitos.");
      return;
    }
    // La CLABE es de 18 dígitos y NO es el número de cuenta: confundirlas manda
    // la dispersión al vacío, así que se valida antes de guardar.
    if (clabe && clabe.length !== 18) {
      toast.error("La CLABE debe tener exactamente 18 dígitos.");
      return;
    }
    if (clabe && clabe === numeroCuenta) {
      toast.error("El número de cuenta y la CLABE no pueden ser iguales.");
      return;
    }

    setSaving(true);
    try {
      const accountData: Record<string, any> = {
        id_banco: parseInt(bankId),
        numero_cuenta: numeroCuenta,
        cuenta_clabe: clabe || null,
        url_evidencia: evidencia,
        titular: titular.trim(),
        id_persona: personaId,
      };

      if (existingId && !isCreate) {
        // Si cambian los datos de dispersión, la cuenta vuelve a validación.
        const cambioSensible =
          String(existingAccount?.id_banco ?? '') !== String(accountData.id_banco) ||
          (existingAccount?.numero_cuenta || '') !== numeroCuenta ||
          (existingAccount?.cuenta_clabe || '') !== (clabe || '');
        if (cambioSensible) accountData.id_estatus_verificacion = 1;
        const { error } = await (supabase as any).from('cuentas_bancarias').update(accountData).eq('id', existingId);
        if (error) throw error;
      } else {
        // Cuenta nueva → siempre pendiente de validación.
        accountData.id_estatus_verificacion = 1;
        const { error } = await (supabase as any).from('cuentas_bancarias').insert([accountData]);
        if (error) throw error;
      }

      toast.success(
        existingId && !isCreate
          ? "Cuenta bancaria actualizada."
          : "Cuenta registrada. Queda pendiente de activación hasta que la validemos.",
      );
      queryClient.invalidateQueries({ queryKey: ['agent-bank-account'] });
      queryClient.invalidateQueries({ queryKey: ['agent-onboarding-bank'] });
      queryClient.invalidateQueries({ queryKey: ['agent-perfil-bancos'] });
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error"));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !isCreate) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  // Formulario único: alta y edición. El agente no puede eliminar cuentas
  // (una cuenta de dispersión solo la desactiva el equipo de SOZU).
  return (
    <div className="space-y-4">
      {!isCreate && existingId && (existingAccount as any)?.id_estatus_verificacion !== 2 && (
        <p className="rounded-md bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground">
          Esta cuenta está pendiente de activación. Si corriges algo, la validamos de nuevo.
        </p>
      )}
      <div>
        <Label className={FIELD_LABEL_CLS}>Banco <Req /></Label>
        <SearchableSelect
          value={bankId}
          onValueChange={(v) => { setBankId(v); onTrackFieldChange?.(); }}
          options={bankOptions}
          placeholder="Selecciona un banco"
          itemsLabel="bancos"
          searchPlaceholder="Buscar banco…"
          aria-label="Banco"
        />
      </div>
      <div>
        <Label className={FIELD_LABEL_CLS}>Número de Cuenta <Req /></Label>
        <Input
          value={numeroCuenta}
          onChange={(e) => { setNumeroCuenta(e.target.value.replace(/\D/g, '')); onTrackFieldChange?.(); }}
          placeholder="0123456789"
          maxLength={34}
          inputMode="numeric"
          className="tabular-nums"
        />
      </div>
      <div>
        <Label className={FIELD_LABEL_CLS}>Titular de la cuenta <Req /></Label>
        <div className="mt-1 flex items-center gap-2">
          <Checkbox
            id="titular-same-person"
            checked={titularIsSamePerson}
            onCheckedChange={(checked) => {
              setTitularIsSamePerson(checked as boolean);
              setTitular(checked && personaName ? personaName : '');
              onTrackFieldChange?.();
            }}
          />
          <Label htmlFor="titular-same-person" className="cursor-pointer text-xs font-normal text-muted-foreground">
            El titular es {personaName || 'la misma persona'}
          </Label>
        </div>
        <Input
          value={titular}
          onChange={(e) => { setTitular(e.target.value); setTitularIsSamePerson(false); onTrackFieldChange?.(); }}
          placeholder="Juan Pérez García"
          disabled={titularIsSamePerson}
        />
      </div>
      <div>
        <Label className={FIELD_LABEL_CLS}>
          CLABE <span className="text-xs font-normal text-muted-foreground">(18 dígitos, opcional)</span>
        </Label>
        <Input
          value={clabe}
          onChange={(e) => { setClabe(e.target.value.replace(/\D/g, '')); onTrackFieldChange?.(); }}
          placeholder="012345678901234567"
          maxLength={18}
          inputMode="numeric"
          className="tabular-nums"
        />
      </div>
      <div>
        <ImageUploadField
          label="Evidencia *"
          value={evidencia}
          onChange={(url) => { setEvidencia(url); onTrackFieldChange?.(); }}
          accept=".pdf,.jpg,.jpeg,.png,.webp"
        />
      </div>
      <div className="flex justify-end gap-2.5 border-t border-border pt-4">
        <Button variant="primary-outline" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {existingId && !isCreate ? "Guardar cambios" : "Registrar cuenta"}
        </Button>
      </div>
    </div>
  );
}
