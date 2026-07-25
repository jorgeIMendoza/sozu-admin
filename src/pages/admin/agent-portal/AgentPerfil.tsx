import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentOnboardingStatus, type OnboardingStep } from "@/hooks/useAgentOnboardingStatus";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { AgentOnboardingStepDialog } from "@/components/admin/AgentOnboardingStepDialog";
import { ClienteINECameraCapture } from "@/components/admin/portal-cliente/ClienteINECameraCapture";
import { ModalViewer } from "@/components/ui/modal-viewer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { getTrainingAppointmentStatus, useAgentTrainingAppointments } from "@/hooks/useAgentTrainingAppointments";
import { FileText, Receipt, Landmark, GraduationCap, Check, AlertTriangle, Loader2, Camera, Trash2, Upload, ArrowLeft, Eye, EyeOff, Pencil, Plus, UploadCloud, PenLine, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FIELD_LABEL_CLS, Req, ModalForm, ModalFormHeader, MODAL_BODY_CLS, MODAL_FOOTER_CLS } from "@/components/ui/modal-form";
import { Input } from "@/components/ui/input";
import { matchRegimenId } from "@/utils/regimenMatch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { normalizeAvatarUrl } from "@/lib/avatarUrl";
import { OptImg } from "@/components/ui/opt-img";
import { ProfileSectionRow } from "@/components/admin/perfil/ProfileSectionRow";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { validateCSFPdf } from "@/utils/pdfDocumentValidators";
import { extractCSFFields } from "@/utils/pdfDocumentExtractors";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

/** Extrae el texto de un PDF (constancia SAT) en el navegador con pdf.js. */
async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: any) => ("str" in it ? it.str : "")).join(" "));
  }
  return pages.join("\n").trim();
}

const ACTIVATION_BLOCKS = [
  { 
    stepId: 'basic' as const, 
    label: 'Identidad', 
    description: 'Datos personales, dirección e INE',
    icon: FileText,
    relatedSteps: ['basic'] as const,
  },
  { 
    stepId: 'fiscal' as const, 
    label: 'Información fiscal', 
    description: 'RFC, régimen fiscal y constancia',
    icon: Receipt,
    relatedSteps: ['fiscal'] as const,
  },
  { 
    stepId: 'bank-accounts' as const, 
    label: 'Cuenta bancaria', 
    description: 'Banco, CLABE y titular',
    icon: Landmark,
    relatedSteps: ['bank-accounts'] as const,
  },
  { 
    stepId: 'training' as const, 
    label: 'Capacitación', 
    description: 'Agenda y completa tu capacitación',
    icon: GraduationCap,
    relatedSteps: ['training'] as const,
  },
];

// Documentos del expediente del agente (tipos reales en `documentos`).
// La identidad es UN solo documento: INE (frente+reverso, tipos 2+3) O pasaporte
// (tipo 4) — nunca ambos; se elige con un selector. El INE se captura en una sola
// pasada (frente y luego reverso).
type ExpDoc = { nombre: string; emisor: string; hint: string; tipos: number[]; kind: 'camera' | 'pdf' | 'firma'; mode?: 'ine' | 'pasaporte' };
const INE_DOC: ExpDoc = { nombre: 'INE', emisor: 'INE', hint: 'Frente y reverso', tipos: [2, 3], kind: 'camera', mode: 'ine' };
const PASAPORTE_DOC: ExpDoc = { nombre: 'Pasaporte', emisor: 'SRE', hint: 'Página de datos (vigente)', tipos: [4], kind: 'camera', mode: 'pasaporte' };
const CSF_DOC: ExpDoc = { nombre: 'Constancia de Situación Fiscal', emisor: 'SAT', hint: 'PDF del SAT, no mayor a 3 meses', tipos: [6], kind: 'pdf' };
const CARTA_DOC: ExpDoc = { nombre: 'Carta de comercialización', emisor: 'SOZU', hint: 'Se genera y firma digitalmente con SOZU', tipos: [48], kind: 'firma' };

const STEP_TO_VIEW: Record<string, 'identidad' | 'fiscal' | 'bank' | 'training'> = {
  basic: 'identidad',
  fiscal: 'fiscal',
  'bank-accounts': 'bank',
  training: 'training',
};

// Umbral de porcentaje que dispara el festejo de perfil completo.
const CELEBRATION_THRESHOLD = 100;

// Nombre de cada subsección (se muestra en el header junto a la flecha de regreso).
const SUBSECTION_TITLES: Record<string, string> = {
  expediente: 'Expediente',
  identidad: 'Identidad',
  fiscal: 'Información fiscal',
  bank: 'Cuenta bancaria',
  training: 'Capacitación',
};

// Badge de estatus reutilizable para las filas de "Secciones de tu perfil".
function sectionBadge(status: string) {
  return status === 'complete'
    ? { label: 'Completado', color: 'text-primary', bg: 'bg-primary/10' }
    : status === 'partial'
    ? { label: 'En proceso', color: 'text-amber-700', bg: 'bg-amber-100' }
    : { label: 'Pendiente', color: 'text-muted-foreground', bg: 'bg-muted' };
}

// Zona profesional de subida: arrastra o selecciona (PDF).
function DocDropzone({ accept, uploading, onFile }: { accept: string; uploading: boolean; onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (accept.includes('.pdf') && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF.');
      return;
    }
    onFile(f);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors",
        drag ? "border-primary bg-primary/5" : "border-border bg-muted hover:border-primary"
      )}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      ) : (
        <UploadCloud className="h-8 w-8 text-primary" strokeWidth={1.6} />
      )}
      <div>
        <p className="text-sm font-bold text-foreground">{uploading ? 'Subiendo…' : 'Arrastra el archivo aquí'}</p>
        <p className="mt-1 text-xs font-medium text-muted-foreground/70">o haz clic para seleccionar · Solo PDF</p>
      </div>
    </div>
  );
}
/** Valores centinela de los selects (Radix no admite value=""). */
const NO_REGIMEN = "__none__";
const SIN_ESPECIFICAR = "__none__";

const AgentPerfil = () => {
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { impersonatedAgentPersonaId, impersonatedAgentName, impersonatedAgentEmail, isImpersonating } = useAgentImpersonation();
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const displayName = isImpersonating ? impersonatedAgentName : profile?.nombre;
  const agentEmail = isImpersonating ? impersonatedAgentEmail : (user?.email || profile?.email);
  const loggedInEmail = user?.email || profile?.email;
  const canEdit = !!loggedInEmail && !!agentEmail && loggedInEmail === agentEmail;
  const { steps, percentage, isLoading, missingByStep } = useAgentOnboardingStatus(personaId);
  const { appointments: trainingAppointments = [] } = useAgentTrainingAppointments(personaId);
  const { permissions } = useAgentPortalPermissions();
  const perfilPerms = permissions['/admin/agent/perfil'];
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();

  // Photo & phrase state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingFrase, setEditingFrase] = useState(false);
  const [fraseValue, setFraseValue] = useState('');
  const [savingFrase, setSavingFrase] = useState(false);

  // Fetch foto_perfil_url + frase_perfil from usuarios
  const { data: perfilExtra } = useQuery({
    queryKey: ['agent-perfil-extra', agentEmail],
    queryFn: async () => {
      if (!agentEmail) return null;
      const { data } = await (supabase as any)
        .from('usuarios')
        .select('foto_perfil_url, frase_perfil, roles:rol_id(nombre)')
        .eq('email', agentEmail)
        .maybeSingle();
      return data as { foto_perfil_url: string | null; frase_perfil: string | null; roles?: { nombre: string } | null } | null;
    },
    enabled: !!agentEmail,
    staleTime: 60_000,
  });

  // Sync fraseValue when data loads (only when not editing)
  useEffect(() => {
    if (!editingFrase) setFraseValue(perfilExtra?.frase_perfil || '');
  }, [perfilExtra, editingFrase]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Extract storage path from public URL - works for both self-hosted and Supabase cloud
  const getAvatarStoragePath = (publicUrl: string): string | null => {
    const marker = '/storage/v1/object/public/avatar/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.substring(idx + marker.length).split('?')[0];
  };

  const handlePhotoConfirm = async () => {
    if (!pendingFile || !agentEmail) return;
    setUploadingPhoto(true);
    try {
      const ext = (pendingFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${agentEmail}/avatar.${ext}`;

      // Delete old file if extension changed (avoid orphans)
      if (perfilExtra?.foto_perfil_url) {
        const oldPath = getAvatarStoragePath(perfilExtra.foto_perfil_url);
        if (oldPath && oldPath !== path) {
          await supabase.storage.from('avatar').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(path, pendingFile, { upsert: true, cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatar').getPublicUrl(path);
      // Strip ?t=timestamp that Supabase JS adds for cache-busting on upsert
      const cleanUrl = urlData.publicUrl.split('?')[0];

      // .select() para detectar 0 filas (RLS/filtro) y capturar error real.
      const { data: updated, error: updErr } = await (supabase as any)
        .from('usuarios')
        .update({ foto_perfil_url: cleanUrl })
        .eq('email', agentEmail)
        .select('email');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        throw new Error('No se pudo guardar la foto: no tienes permiso para editar este perfil.');
      }

      queryClient.invalidateQueries({ queryKey: ['agent-perfil-extra', agentEmail] });
      await refreshProfile(); // refresca el perfil global → header/avatar se actualiza
      toast.success('Foto de perfil actualizada');
      closePhotoModal();
    } catch (err: any) {
      console.error('Error subiendo foto:', err);
      toast.error(err?.message || 'No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setPendingFile(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  const handlePhotoDelete = async () => {
    if (!agentEmail) return;
    setDeletingPhoto(true);
    try {
      // Delete from bucket: parse path from stored URL to avoid RLS/encoding issues with list()
      if (perfilExtra?.foto_perfil_url) {
        const storagePath = getAvatarStoragePath(perfilExtra.foto_perfil_url);
        if (storagePath) {
          await supabase.storage.from('avatar').remove([storagePath]);
        } else {
          // Fallback: list folder and remove all
          const { data: files } = await supabase.storage
            .from('avatar')
            .list(`avatars/${agentEmail}`);
          if (files?.length) {
            await supabase.storage
              .from('avatar')
              .remove(files.map(f => `avatars/${agentEmail}/${f.name}`));
          }
        }
      }
      const { error: updErr } = await (supabase as any)
        .from('usuarios')
        .update({ foto_perfil_url: null })
        .eq('email', agentEmail)
        .select('email');
      if (updErr) throw updErr;
      queryClient.invalidateQueries({ queryKey: ['agent-perfil-extra', agentEmail] });
      await refreshProfile();
      toast.success('Foto de perfil eliminada');
      setShowPhotoModal(false);
    } catch (err: any) {
      console.error('Error eliminando foto:', err);
      toast.error(err?.message || 'No se pudo eliminar la foto.');
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleFraseSave = async () => {
    if (!agentEmail) return;
    setSavingFrase(true);
    try {
      const { data: updated, error: updErr } = await (supabase as any)
        .from('usuarios')
        .update({ frase_perfil: fraseValue.trim() || null })
        .eq('email', agentEmail)
        .select('email');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        throw new Error('No se pudo guardar la presentación: no tienes permiso para editar este perfil.');
      }
      queryClient.invalidateQueries({ queryKey: ['agent-perfil-extra', agentEmail] });
      await refreshProfile();
      toast.success('Presentación guardada');
      setEditingFrase(false);
    } catch (err: any) {
      console.error('Error guardando frase:', err);
      toast.error(err?.message || 'No se pudo guardar la presentación.');
    } finally {
      setSavingFrase(false);
    }
  };
  const sortedTrainingAppointments = [...trainingAppointments].sort((a, b) => {
    const aTime = new Date(`${a.fecha}T${a.hora_inicio || '00:00:00'}`).getTime();
    const bTime = new Date(`${b.fecha}T${b.hora_inicio || '00:00:00'}`).getTime();
    return aTime - bTime;
  });

  // Fetch agency name for this agent
  // Datos asignados por SOZU (solo lectura): comisión, tipo de relación, líder, alta.
  const { data: sozuInfo } = useQuery({
    queryKey: ['agent-sozu-info', personaId],
    queryFn: async () => {
      if (!personaId) return null;
      const { data } = await (supabase as any)
        .from('entidades_relacionadas')
        .select('porcentaje_comision, activo, fecha_creacion, tipos_entidad:id_tipo_entidad(nombre), lider:personas!entidades_relacionadas_id_persona_duena_lead_fkey(nombre_legal)')
        .eq('id_persona', personaId)
        .eq('id_tipo_entidad', 19)
        .order('activo', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      return {
        comision: data.porcentaje_comision != null ? Number(data.porcentaje_comision) : null,
        activo: data.activo as boolean,
        fechaAlta: data.fecha_creacion as string | null,
        tipoRelacion: (data.tipos_entidad as any)?.nombre || null,
        lider: (data.lider as any)?.nombre_legal || null,
      };
    },
    enabled: !!personaId,
    staleTime: 60_000,
  });

  const isMobile = useIsMobile();
  const [activeStep, setActiveStep] = useState<OnboardingStep['id'] | null>(null);
  // Cuenta bancaria: 'create' abre el alta en blanco; 'edit' carga la cuenta tocada.
  const [bankTarget, setBankTarget] = useState<{ mode: 'create' | 'edit'; id: number | null }>({ mode: 'create', id: null });
  // Pestaña inicial del modal de paso (p. ej. 'address' para ir directo a firmar la carta).
  const [activeStepTab, setActiveStepTab] = useState<string | undefined>(undefined);
  // Captura por cámara de identidad (INE frente+reverso o pasaporte) directo desde
  // el expediente. Reutiliza el componente del portal cliente.
  const [ineCaptureOpen, setIneCaptureOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ine' | 'pasaporte'>('ine');
  const [profileView, setProfileView] = useState<'overview' | 'expediente' | 'identidad' | 'fiscal' | 'bank' | 'training'>('overview');
  const [docDetail, setDocDetail] = useState<ExpDoc | null>(null);
  // Selector de identidad (INE | Pasaporte). Solo se muestra hasta que se sube uno válido.
  const [identitySel, setIdentitySel] = useState<'ine' | 'pasaporte'>('ine');
  // Visor del INE (dos caras apiladas).
  const [ineViewer, setIneViewer] = useState<{ frente: string | null; reverso: string | null } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; nombre: string } | null>(null);
  // CSF: datos extraídos para confirmar/editar antes de guardar
  const [csfConfirm, setCsfConfirm] = useState<{
    file: File;
    fields: { key: string; label: string; value: string; personaCol: string | null; kind?: "text" | "regimen" }[];
  } | null>(null);
  const [csfEdit, setCsfEdit] = useState<Record<string, string>>({});
  const [savingCsf, setSavingCsf] = useState(false);
  useEffect(() => {
    if (csfConfirm) {
      const init: Record<string, string> = {};
      csfConfirm.fields.forEach((f) => { init[f.key] = f.value; });
      setCsfEdit(init);
    }
  }, [csfConfirm]);
  // Catálogo de régimen fiscal (para mapear el texto de la CSF → id que guarda personas.regimen)
  const { data: regimenCatalog = [] } = useQuery({
    queryKey: ["agent-regimen-catalog"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("regimen").select("id, nombre, tipo").eq("activo", true).order("id");
      return (data || []) as { id: string; nombre: string; tipo: string }[];
    },
  });
  const [securityOpen, setSecurityOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwShow, setPwShow] = useState<{ current: boolean; nueva: boolean; confirm: boolean }>({ current: false, nueva: false, confirm: false });

  const changePassword = async () => {
    if (pwNew.length < 6) { toast.error('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (pwNew !== pwConfirm) { toast.error('Las contraseñas no coinciden.'); return; }
    if (!loggedInEmail) return;
    setSavingPw(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: loggedInEmail, password: pwCurrent });
      if (signInErr) { toast.error('Contraseña actual incorrecta.'); return; }
      const { error } = await supabase.auth.updateUser({ password: pwNew });
      if (error) throw error;
      toast.success('Contraseña actualizada.');
      setSecurityOpen(false);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch {
      toast.error('No se pudo actualizar la contraseña.');
    } finally {
      setSavingPw(false);
    }
  };

  // Datos personales/fiscales leídos de los documentos
  const { data: personaDatos } = useQuery({
    queryKey: ['agent-perfil-persona-datos', personaId],
    queryFn: async () => {
      if (!personaId) return null;
      const { data } = await (supabase as any)
        .from('personas')
        .select('nombre_legal, email, telefono, curp, fecha_nacimiento, sexo, rfc, regimen, uso_cfdi, direccion_calle, direccion_num_ext, direccion_colonia, direccion_codigo_postal, direccion_fiscal_calle, direccion_fiscal_colonia, direccion_fiscal_codigo_postal')
        .eq('id', personaId)
        .maybeSingle();
      return data;
    },
    enabled: !!personaId,
    staleTime: 60_000,
  });

  // Cuentas de dispersión
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['agent-perfil-bancos', personaId],
    queryFn: async (): Promise<any[]> => {
      if (!personaId) return [];
      const { data } = await (supabase as any)
        .from('cuentas_bancarias')
        .select('*, banco:bancos(nombre)')
        .eq('id_persona', personaId)
        .eq('activo', true);
      return data || [];
    },
    enabled: !!personaId,
    staleTime: 30_000,
  });

  // Catálogo Uso de CFDI (persona física)
  const { data: usoCfdiCatalog = [] } = useQuery({
    queryKey: ['uso_cfdi', 'pf'],
    queryFn: async (): Promise<any[]> => {
      const { data } = await (supabase as any)
        .from('uso_cfdi')
        .select('codigo, nombre')
        .eq('activo', true)
        .in('tipo', ['pf', 'a'])
        .order('codigo');
      return data || [];
    },
    staleTime: Infinity,
  });

  const [savingCfdi, setSavingCfdi] = useState(false);

  const saveUsoCfdi = async (codigo: string) => {
    if (!personaId) return;
    setSavingCfdi(true);
    try {
      await (supabase as any).from('personas').update({ uso_cfdi: codigo || null }).eq('id', personaId);
      queryClient.invalidateQueries({ queryKey: ['agent-perfil-persona-datos', personaId] });
    } finally {
      setSavingCfdi(false);
    }
  };

  // Subida directa de PDF (constancia fiscal) → documentos, pendiente de validación.
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const uploadDocPdf = async (file: File, tipo: number, opts?: { estatus?: number; personaUpdates?: Record<string, string | null> }) => {
    if (!personaId) { toast.error('Tu usuario no tiene un perfil de persona asociado.'); return; }
    const estatus = opts?.estatus ?? 1;
    setUploadingDoc(true);
    try {
      const path = `expediente/${personaId}/${tipo}_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
      await (supabase as any).from('documentos').update({ activo: false })
        .eq('id_persona', personaId).eq('id_tipo_documento', tipo).eq('activo', true);
      const { error: insErr } = await (supabase as any).from('documentos').insert({
        url: publicUrl, id_tipo_documento: tipo, id_persona: personaId, activo: true, id_estatus_verificacion: estatus,
      });
      if (insErr) throw insErr;
      // Captura de datos confirmados (CSF) en el perfil.
      if (opts?.personaUpdates && Object.keys(opts.personaUpdates).length > 0) {
        const { error: pErr } = await (supabase as any).from('personas').update(opts.personaUpdates).eq('id', personaId);
        if (pErr) console.error('[uploadDocPdf] persona update:', pErr);
      }
      queryClient.invalidateQueries({ queryKey: ['agent-expediente-docs', personaId] });
      toast.success(estatus === 2 ? 'Documento validado y datos guardados en tu perfil.' : 'Documento subido. Queda pendiente de validación.');
      setDocDetail(null);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo subir el documento.');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Manejo de archivo del expediente. La CSF (tipo 6) se procesa: extrae datos → modal de
  // confirmación editable → guarda documento (validado) + datos fiscales en el perfil.
  const handleDocFile = async (file: File, doc: ExpDoc) => {
    const tipo = doc.tipos[0];
    if (!doc.tipos.includes(6)) { uploadDocPdf(file, tipo); return; }
    setUploadingDoc(true);
    try {
      let text = "";
      try { text = await extractPdfText(file); } catch { toast.error("No se pudo leer el PDF. Intenta de nuevo."); return; }
      if (!text || text.trim().length < 20) {
        toast.error("Debe ser el PDF original de la Constancia (no escaneo ni imagen).", { duration: 7000 });
        return;
      }
      const v = validateCSFPdf(text);
      if (!v.ok) { toast.error(v.reason, { duration: 8000 }); return; }
      const f = extractCSFFields(text);
      setDocDetail(null);
      setCsfConfirm({
        file,
        fields: [
          { key: "rfc",          label: "RFC",                  value: f.rfc ?? "",          personaCol: "rfc" },
          { key: "curp",         label: "CURP",                 value: f.curp ?? "",         personaCol: "curp" },
          { key: "nombre",       label: "Nombre / Razón social", value: f.nombre ?? "",      personaCol: "nombre_legal" },
          { key: "regimen",      label: "Régimen fiscal",       value: matchRegimenId(f.regimen ?? "", regimenCatalog), personaCol: "regimen", kind: "regimen" },
          { key: "codigoPostal", label: "Código postal",        value: f.codigoPostal ?? "", personaCol: "direccion_fiscal_codigo_postal" },
          { key: "calle",        label: "Calle",                value: f.calle ?? "",        personaCol: "direccion_fiscal_calle" },
          { key: "numExt",       label: "Núm. exterior",        value: f.numExt ?? "",       personaCol: "direccion_fiscal_num_ext" },
          { key: "numInt",       label: "Núm. interior",        value: f.numInt ?? "",       personaCol: "direccion_fiscal_num_int" },
          { key: "colonia",      label: "Colonia",              value: f.colonia ?? "",      personaCol: "direccion_fiscal_colonia" },
        ],
      });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleConfirmCsf = async () => {
    if (!csfConfirm) return;
    setSavingCsf(true);
    try {
      const personaUpdates: Record<string, string | null> = {};
      for (const fld of csfConfirm.fields) {
        const val = (csfEdit[fld.key] ?? fld.value).trim();
        // El régimen se elige del catálogo: si el agente lo deja vacío se guarda null.
        if (fld.kind === "regimen") { personaUpdates["regimen"] = val || null; continue; }
        if (fld.personaCol && val) personaUpdates[fld.personaCol] = val;
      }
      await uploadDocPdf(csfConfirm.file, 6, { estatus: 2, personaUpdates });
      await queryClient.refetchQueries({ queryKey: ['agent-perfil-persona-datos', personaId] });
      setCsfConfirm(null);
    } finally {
      setSavingCsf(false);
    }
  };

  // Edición de información de Identidad vía modal. Correo NO se edita (solo lectura).
  const [identEditOpen, setIdentEditOpen] = useState(false);
  const [savingIdent, setSavingIdent] = useState(false);
  const [identForm, setIdentForm] = useState<Record<string, string>>({});
  const openIdentEdit = () => {
    setIdentForm({
      nombre_legal: personaDatos?.nombre_legal || '',
      telefono: personaDatos?.telefono || '',
      curp: personaDatos?.curp || '',
      fecha_nacimiento: (personaDatos?.fecha_nacimiento || '').slice(0, 10),
      sexo: personaDatos?.sexo || '',
      direccion_calle: personaDatos?.direccion_calle || '',
      direccion_num_ext: personaDatos?.direccion_num_ext || '',
      direccion_colonia: personaDatos?.direccion_colonia || '',
      direccion_codigo_postal: personaDatos?.direccion_codigo_postal || '',
    });
    setIdentEditOpen(true);
  };
  const setIdent = (k: string, v: string) => setIdentForm((p) => ({ ...p, [k]: v }));
  const saveIdent = async () => {
    // Sin persona asociada (p. ej. Super Admin sin id_persona) → no hay fila que editar.
    if (!personaId) {
      toast.error('Tu usuario no tiene un perfil de persona asociado, no hay datos que editar.');
      return;
    }
    // Campos obligatorios
    const faltantes: string[] = [];
    if (!identForm.nombre_legal?.trim()) faltantes.push('Nombre completo');
    if (!identForm.telefono?.trim()) faltantes.push('Teléfono');
    else if (identForm.telefono.trim().length !== 10) faltantes.push('Teléfono (10 dígitos)');
    if (!identForm.curp?.trim()) faltantes.push('CURP');
    if (faltantes.length > 0) {
      toast.error(`Faltan campos obligatorios: ${faltantes.join(', ')}.`);
      return;
    }
    setSavingIdent(true);
    try {
      const payload = {
        nombre_legal: identForm.nombre_legal?.trim() || null,
        telefono: identForm.telefono?.trim() || null,
        curp: identForm.curp?.trim().toUpperCase() || null,
        fecha_nacimiento: identForm.fecha_nacimiento || null,
        sexo: identForm.sexo || null,
        direccion_calle: identForm.direccion_calle?.trim() || null,
        direccion_num_ext: identForm.direccion_num_ext?.trim() || null,
        direccion_colonia: identForm.direccion_colonia?.trim() || null,
        direccion_codigo_postal: identForm.direccion_codigo_postal?.trim() || null,
      };
      const { data: updated, error } = await (supabase as any)
        .from('personas')
        .update(payload)
        .eq('id', personaId)
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('No se pudo guardar: no tienes permiso para editar este perfil (RLS).');
      }
      await queryClient.refetchQueries({ queryKey: ['agent-perfil-persona-datos', personaId] });
      toast.success('Información actualizada');
      setIdentEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la información.');
    } finally {
      setSavingIdent(false);
    }
  };

  // Documentos del expediente (tipos de agente)
  const { data: expedienteDocs = [] } = useQuery({
    queryKey: ['agent-expediente-docs', personaId],
    queryFn: async (): Promise<any[]> => {
      if (!personaId) return [];
      const { data } = await (supabase as any)
        .from('documentos')
        .select('id, id_tipo_documento, id_estatus_verificacion, url')
        .eq('id_persona', personaId)
        .eq('activo', true)
        .in('id_tipo_documento', [2, 3, 4, 6, 48]);
      return data || [];
    },
    enabled: !!personaId,
    staleTime: 30_000,
  });

  // ¿El agente pertenece a una inmobiliaria (dependiente)? Discriminador:
  // entidades_relacionadas tipo 19 con id_persona_duena_lead NO nulo. La Carta de
  // comercialización (tipo 48) SOLO aplica a agentes independientes (sin inmobiliaria).
  const { data: hasInmobiliaria = false } = useQuery({
    queryKey: ['agent-perfil-inmo', personaId],
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

  // Estatus agregado de Documentos (para la fila "Documentos" en Secciones).
  // Identidad = INE (frente+reverso) O pasaporte — no se exigen ambos.
  const docsStatus = (() => {
    const state = (tipos: number[]) => {
      const rows = expedienteDocs.filter((x: any) => tipos.includes(x.id_tipo_documento));
      if (rows.some((x: any) => x.id_estatus_verificacion === 2)) return 'validated';
      if (rows.length > 0) return 'uploaded';
      return 'none';
    };
    const ineValidated = state([2]) === 'validated' && state([3]) === 'validated';
    const pasValidated = state([4]) === 'validated';
    const identidadValidated = ineValidated || pasValidated;
    const csf = state([6]);
    const carta = state([48]);

    // La carta solo se exige a agentes independientes; los dependientes no la firman.
    const cartaOk = !esIndependiente || carta === 'validated';
    const complete = identidadValidated && csf === 'validated' && cartaOk;
    if (complete) return 'complete';
    const relevantTipos = esIndependiente ? [2, 3, 4, 6, 48] : [2, 3, 4, 6];
    const anyProgress = relevantTipos.some((t) => state([t]) !== 'none');
    return anyProgress ? 'partial' : 'pending';
  })();

  // Desarrollos ASIGNADOS al agente (solo los suyos, nunca el catálogo completo).
  const { accessibleProjectIds } = useProjectAccess();
  const { data: misDesarrollos = [] } = useQuery({
    queryKey: ['agent-perfil-desarrollos', accessibleProjectIds],
    queryFn: async (): Promise<string[]> => {
      if (accessibleProjectIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from('proyectos')
        .select('nombre')
        .eq('activo', true)
        .eq('publicar', true)
        .in('id', accessibleProjectIds)
        .order('nombre');
      return (data || []).map((p: any) => p.nombre).filter(Boolean);
    },
    staleTime: 60_000,
  });
  const [showAllDesarrollos, setShowAllDesarrollos] = useState(false);
  const confettiFiredRef = useRef(false);

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/perfil');
    track({ page: 'agent_perfil', elementId: 'page_view', elementType: 'page' });
  }, []);

  // Festejo sobrio al alcanzar el umbral por primera vez (sin sonido, sin overlay,
  // sin bucle rAF prolongado → evita lag). 2 ráfagas cortas laterales + burst central.
  const celebrationStorageKey = `agent_celebration_fired_${CELEBRATION_THRESHOLD}_${personaId}`;
  useEffect(() => {
    if (isLoading || percentage < CELEBRATION_THRESHOLD || confettiFiredRef.current) return;
    if (localStorage.getItem(celebrationStorageKey)) return;

    confettiFiredRef.current = true;
    localStorage.setItem(celebrationStorageKey, 'true');

    const colors = ['#10b981', '#059669', '#34d399', '#6ee7b7', '#fbbf24'];
    // Burst central
    confetti({ particleCount: 60, spread: 80, startVelocity: 40, origin: { x: 0.5, y: 0.45 }, colors });
    // Dos ráfagas laterales una sola vez (sin requestAnimationFrame continuo)
    confetti({ particleCount: 30, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 30, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
  }, [percentage, isLoading, celebrationStorageKey]);

  const getBlockStatus = (relatedSteps: readonly string[]) => {
    const related = steps.filter(s => relatedSteps.includes(s.id));
    if (related.length === 0) return 'pending';
    if (related.every(s => s.isComplete)) return 'complete';
    if (related.some(s => s.hasPartialData || s.isComplete)) return 'partial';
    return 'pending';
  };

  const canReceivePayments = steps
    .filter(s => ['fiscal', 'bank-accounts'].includes(s.id))
    .every(s => s.isComplete);

  // Estatus de las 5 secciones del perfil (Documentos + 4 etapas) → alimenta el hero.
  const sectionStatuses = [docsStatus, ...ACTIVATION_BLOCKS.map((b) => getBlockStatus(b.relatedSteps))];
  const totalSecciones = sectionStatuses.length;
  const seccionesValidadas = sectionStatuses.filter((s) => s === 'complete').length;
  const seccionesEnProceso = sectionStatuses.filter((s) => s === 'partial').length;
  const seccionesPendientes = sectionStatuses.filter((s) => s === 'pending').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-24 relative">
      <AgentPortalHeader>
        {profileView !== 'overview' && (
          <div className="flex items-center gap-3 pt-0.5">
            <button
              onClick={() => setProfileView('overview')}
              aria-label="Volver a Perfil"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-card text-muted-foreground transition-colors hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="flex-1 truncate text-lg font-bold tracking-[-0.3px] text-foreground">{SUBSECTION_TITLES[profileView]}</h2>
            {profileView === 'training' && perfilPerms.canUpdate && (
              <ActionButton icon={CalendarDays} shortLabel="Agendar" size="sm" className="shrink-0" onClick={() => setActiveStep('training')}>
                Agendar capacitación
              </ActionButton>
            )}
            {profileView === 'bank' && perfilPerms.canUpdate && (
              <ActionButton
                icon={Plus}
                shortLabel="Agregar"
                size="sm"
                className="shrink-0"
                onClick={() => { setBankTarget({ mode: 'create', id: null }); setActiveStep('bank-accounts'); }}
              >
                Agregar cuenta
              </ActionButton>
            )}
          </div>
        )}
      </AgentPortalHeader>
      <div className={cn("mx-auto max-w-[1040px] space-y-4", profileView === 'overview' ? "pt-1" : "pt-5")}>
      {profileView === 'overview' && (<>
      {/* Profile Card */}
      <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-card p-5 text-center shadow-[0_1px_3px_rgba(20,30,25,0.04)] sm:flex-row sm:flex-wrap sm:gap-5 sm:p-6 sm:text-left">
        {/* Avatar */}
        <button
          type="button"
          className="relative shrink-0 rounded-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={() => canEdit && setShowPhotoModal(true)}
          disabled={!canEdit}
          title={canEdit ? "Cambiar foto de perfil" : undefined}
          aria-label={canEdit ? "Cambiar foto de perfil" : "Foto de perfil"}
        >
          {perfilExtra?.foto_perfil_url ? (
            <OptImg
              src={normalizeAvatarUrl(perfilExtra.foto_perfil_url)}
              w={208}
              h={208}
              resize="cover"
              alt={displayName || "Avatar"}
              className="h-20 w-20 rounded-full object-cover sm:h-[104px] sm:w-[104px]"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground sm:h-[104px] sm:w-[104px] sm:text-4xl">
              {(displayName || "A")[0]?.toUpperCase()}
            </div>
          )}
          {canEdit && (
            <span className="absolute -right-1 -bottom-1 h-[26px] w-[26px] rounded-full bg-card border border-border shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex items-center justify-center text-muted-foreground">
              <Camera className="h-3.5 w-3.5" />
            </span>
          )}
        </button>

        {/* Info + presentación */}
        <div className="w-full min-w-0 flex-1 sm:w-auto sm:min-w-[240px]">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="text-xl font-bold tracking-[-0.3px] text-foreground">
              {displayName || "Agente"}
            </span>
          </div>
          {/* Desarrollos asignados (rol/equipo viven en "Datos de tu cuenta SOZU") */}
          {misDesarrollos.length > 0 && (
            <div className="mt-2.5">
              <div className="mb-1.5 text-xs font-bold tracking-wide text-muted-foreground/70">Desarrollos asignados</div>
              <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {(showAllDesarrollos ? misDesarrollos : misDesarrollos.slice(0, 3)).map((d) => (
                  <span key={d} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {d}
                  </span>
                ))}
                {misDesarrollos.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDesarrollos((v) => !v)}
                    className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                  >
                    {showAllDesarrollos ? 'Ver menos' : `+${misDesarrollos.length - 3}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Presentación: lectura por defecto, edición al pulsar */}
          {(canEdit || perfilExtra?.frase_perfil) && (
            <div className="mt-3.5 pt-3.5 border-t border-border">
              {editingFrase ? (
                <>
                  <p className="text-xs font-semibold text-muted-foreground leading-relaxed">
                    Así te presentas ante tus clientes. Aparece cuando compartes una propiedad con un prospecto.
                  </p>
                  <textarea
                    autoFocus
                    value={fraseValue}
                    rows={3}
                    onChange={e => setFraseValue(e.target.value)}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                    }}
                    maxLength={280}
                    placeholder="Escribe tu presentación…"
                    className="mt-2 w-full max-h-[140px] resize-none overflow-y-auto rounded-md border border-border px-3 py-2.5 text-xs text-foreground leading-relaxed outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="mt-1.5 space-y-2.5">
                    <p className="text-xs italic text-muted-foreground/70">
                      Habla de tu experiencia. Evita promesas de rendimiento o plusvalía.
                    </p>
                    {/* Acciones alineadas a la derecha, como en las modales. */}
                    <div className="flex items-center justify-end gap-2.5">
                      <span className="text-xs font-medium tabular-nums text-muted-foreground/70">{fraseValue.length}/280</span>
                      <Button variant="cancel" size="sm" onClick={() => setEditingFrase(false)} disabled={savingFrase}>
                        Cancelar
                      </Button>
                      <Button variant="primary-outline" size="sm" onClick={handleFraseSave} disabled={savingFrase}>
                        {savingFrase && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Guardar
                      </Button>
                    </div>
                  </div>
                </>
              ) : perfilExtra?.frase_perfil ? (
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 text-xs italic text-muted-foreground leading-relaxed">"{perfilExtra.frase_perfil}"</p>
                  {canEdit && (
                    <button
                      onClick={() => { setFraseValue(perfilExtra.frase_perfil || ''); setEditingFrase(true); }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  )}
                </div>
              ) : canEdit ? (
                <button
                  onClick={() => { setFraseValue(''); setEditingFrase(true); }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar presentación
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* Panel activación */}
        <div className="w-full sm:w-[220px] shrink-0 sm:border-l sm:border-border sm:pl-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Activación</span>
            <span className="text-lg font-bold tabular-nums text-primary">{percentage}%</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${percentage}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground/70 leading-snug">
            Se calcula sobre documentos validados y etapas completadas.
          </p>
        </div>
      </div>

      {/* Asignado por SOZU · solo lectura */}
      {sozuInfo && (() => {
        const fmtAlta = (f?: string | null) => {
          if (!f) return '—';
          const d = new Date(f);
          return isNaN(d.getTime())
            ? '—'
            : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
        };
        const rows: { label: string; render: React.ReactNode }[] = [
          { label: 'Rol / Puesto', render: (perfilExtra as any)?.roles?.nombre || profile?.rol_nombre || 'Agente Inmobiliario' },
          { label: 'Tipo de relación', render: sozuInfo.tipoRelacion || '—' },
          { label: 'Esquema de comisión', render: sozuInfo.comision != null ? `${sozuInfo.comision}% sobre precio de lista` : '—' },
          {
            label: 'Estatus',
            render: (
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('h-[7px] w-[7px] rounded-full', sozuInfo.activo ? 'bg-primary' : 'bg-muted')} />
                {sozuInfo.activo ? 'Activo' : 'Inactivo'}
              </span>
            ),
          },
          { label: 'Equipo / Líder', render: sozuInfo.lider || 'Sin asignar' },
          { label: 'Fecha de alta', render: fmtAlta(sozuInfo.fechaAlta) },
        ];
        return (
          <div>
            <div className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground/70">
              Datos de tu cuenta
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-0.5 rounded-md border border-border bg-card p-5 sm:grid-cols-2 sm:p-6">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                  <span className="text-xs font-medium text-muted-foreground/70">{r.label}</span>
                  <span className="text-right text-sm font-semibold text-foreground">{r.render}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}


      {/* Hidden file input (outside any button) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Foto de perfil - estándar de formulario (ui/modal-form) */}
      <ModalForm
        open={showPhotoModal}
        onOpenChange={(open) => { if (!open) closePhotoModal(); }}
        className="sm:max-w-[360px]"
        title={pendingFile ? "Vista previa" : "Foto de perfil"}
        subtitle={pendingFile ? "Así se verá tu foto de perfil" : (displayName || "Agente")}
        footer={pendingFile ? (
          <>
            <Button
              variant="outline"
              disabled={uploadingPhoto}
              onClick={() => { setPendingFile(null); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}
            > Volver
            </Button>
            <Button variant="primary-outline" onClick={handlePhotoConfirm} disabled={uploadingPhoto}>
              {uploadingPhoto
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                : <><Check className="h-4 w-4" /> Guardar foto</>}
            </Button>
          </>
        ) : (
          <Button variant="cancel" onClick={closePhotoModal}>Cancelar</Button>
        )}
      >
        {pendingFile ? (
          <div className="flex justify-center py-2">
            <img
              src={previewUrl!}
              alt="Vista previa"
              className="h-24 w-24 rounded-full object-cover ring-2 ring-primary/20"
            />
          </div>
        ) : (
          <>
            <div className="flex justify-center py-2">
              {perfilExtra?.foto_perfil_url ? (
                <OptImg
                  src={perfilExtra.foto_perfil_url}
                  w={160}
                  h={160}
                  resize="cover"
                  alt={displayName || "Avatar"}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary ring-2 ring-primary/20">
                  {(displayName || "A")[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {perfilExtra?.foto_perfil_url ? "Cambiar foto" : "Cargar foto"}
                </span>
                <span className="block text-xs text-muted-foreground">JPG, PNG o WebP</span>
              </span>
            </button>

            {perfilExtra?.foto_perfil_url && (
              <button
                type="button"
                onClick={handlePhotoDelete}
                disabled={deletingPhoto}
                className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-left transition-colors hover:border-destructive/40 hover:bg-destructive/5 disabled:opacity-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  {deletingPhoto
                    ? <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                    : <Trash2 className="h-4 w-4 text-destructive" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-destructive">Eliminar foto</span>
                  <span className="block text-xs text-muted-foreground">Vuelves a mostrar tus iniciales</span>
                </span>
              </button>
            )}
          </>
        )}
      </ModalForm>

      {/* Aviso proactivo */}
      {isAgentRole && !canReceivePayments && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-orange-100 px-3.5 py-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-700 text-white">
            <AlertTriangle className="h-3 w-3" />
          </span>
          <span className="flex-1 text-xs font-semibold text-orange-700">
            Completa tu información fiscal y cuenta bancaria para poder recibir comisiones.
          </span>
          {perfilPerms.canUpdate && (
            <span
              tabIndex={0}
              onClick={() => setProfileView('fiscal')}
              className="shrink-0 cursor-pointer text-xs font-bold text-orange-700 underline"
            >
              Actualizar
            </span>
          )}
        </div>
      )}

      {/* HERO MOTOR · expediente */}
      <div className="flex flex-wrap gap-4 rounded-md border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/5 p-5 sm:gap-6 sm:p-6">
        <div className="w-full min-w-0 flex-1 sm:w-auto sm:min-w-[240px]">
          <div className="text-xs font-bold uppercase tracking-wide text-primary">
            Tu expediente · el motor de tu activación
          </div>
          <div className="mt-2 text-base font-bold leading-snug tracking-[-0.4px] text-primary sm:text-xl sm:leading-[1.25]">
            Tu información se construye desde tus documentos.
          </div>
          <p className="mt-2 text-xs font-medium leading-relaxed text-primary sm:text-sm">
            Cada documento que subes alimenta tu información personal y fiscal. Solo validas lo que ya dijeron.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:gap-3.5">
            <ActionButton icon={FileText} className="w-full sm:w-auto" onClick={() => setProfileView('expediente')}>
              Gestionar documentos
            </ActionButton>
            <span className="text-xs font-semibold tabular-nums text-primary">
              {seccionesValidadas} de {totalSecciones} secciones completadas
            </span>
          </div>
        </div>
        <div className="w-full shrink-0 rounded-md border border-primary/20 bg-card p-4 sm:w-[210px]">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Estado de secciones</div>
          <div className="flex flex-col gap-3">
            {[
              { n: seccionesValidadas, label: 'validadas', bg: 'bg-primary/10', color: 'text-primary' },
              { n: seccionesEnProceso, label: 'en proceso', bg: 'bg-amber-100', color: 'text-amber-700' },
              { n: seccionesPendientes, label: 'pendientes', bg: 'bg-muted', color: 'text-muted-foreground' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2.5">
                <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums", c.bg, c.color)}>
                  {c.n}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIONES DE TU PERFIL */}
      <div>
        <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground/70">
          Secciones de tu perfil
        </div>
        <div className="flex flex-col gap-2.5">
          {/* Documentos - primero: todos los documentos del portal a subir */}
          <ProfileSectionRow
            title="Documentos"
            description="Sube y consulta todos tus documentos"
            badge={sectionBadge(docsStatus)}
            onClick={() => {
              track({ page: 'agent_perfil', elementId: 'btn_seccion_documentos' });
              setProfileView('expediente');
            }}
          />

          {ACTIVATION_BLOCKS.map((block) => (
            <ProfileSectionRow
              key={block.stepId}
              title={block.label}
              description={block.description}
              badge={sectionBadge(getBlockStatus(block.relatedSteps))}
              onClick={() => {
                track({ page: 'agent_perfil', elementId: 'btn_etapa_onboarding', elementLabel: block.label, metadata: { step_id: block.stepId } });
                setProfileView(STEP_TO_VIEW[block.stepId]);
              }}
            />
          ))}

          {/* Seguridad */}
          {canEdit && (
            <ProfileSectionRow
              title="Seguridad"
              description="Acceso y contraseña"
              onClick={() => setSecurityOpen(true)}
            />
          )}
        </div>
      </div>

      </>)}

      {/* ===== VISTA: EXPEDIENTE ===== */}
      {profileView === 'expediente' && (() => {
        // La identidad es UN documento: INE (frente+reverso) O pasaporte. Se elige
        // con un selector que se oculta al subir una identidad vigente. La carta
        // (solo independientes) se firma con Mifiel; la CSF es PDF.
        // Prioridad de estatus por tipo: validado > en revisión > rechazado > expirado
        // (una recaptura marca el registro anterior como expirado, hay que ignorarlo).
        const rank = (ev: number | null | undefined) => ev === 2 ? 4 : (ev == null || ev === 1) ? 3 : ev === 3 ? 2 : 1;
        const tipoRow = (t: number) => {
          const rws = expedienteDocs.filter((d: any) => d.id_tipo_documento === t);
          if (!rws.length) return null;
          return rws.slice().sort((a: any, b: any) => rank(b.id_estatus_verificacion) - rank(a.id_estatus_verificacion))[0];
        };
        const tipoEstado = (t: number): 'none' | 'validado' | 'revision' | 'rechazado' | 'expirado' => {
          const r = tipoRow(t);
          if (!r) return 'none';
          const ev = r.id_estatus_verificacion;
          return ev === 2 ? 'validado' : ev === 3 ? 'rechazado' : ev === 4 ? 'expirado' : 'revision';
        };

        const ineEstados = [tipoEstado(2), tipoEstado(3)];
        const hasINE = ineEstados.every((e) => e !== 'none');           // ambas caras
        const pasEstado = tipoEstado(4);
        const hasPasaporte = pasEstado !== 'none';
        const ineVigente = hasINE && !ineEstados.includes('expirado');
        const pasVigente = hasPasaporte && pasEstado !== 'expirado';
        const identityVigente = ineVigente || pasVigente;

        // Doc de identidad a mostrar: el que ya se subió; si no, el del selector.
        const identityDoc = hasPasaporte ? PASAPORTE_DOC : hasINE ? INE_DOC : (identitySel === 'pasaporte' ? PASAPORTE_DOC : INE_DOC);
        const showSelector = !identityVigente; // se oculta una vez subida una identidad vigente

        const visibleDocs: ExpDoc[] = [identityDoc, CSF_DOC, ...(esIndependiente ? [CARTA_DOC] : [])];

        // Estado combinado del doc (el INE combina sus dos caras).
        const docEstado = (doc: ExpDoc): 'pendiente' | 'validado' | 'revision' | 'rechazado' | 'expirado' => {
          const estados = doc.tipos.map(tipoEstado);
          if (estados.some((e) => e === 'none')) return 'pendiente';
          if (estados.every((e) => e === 'validado')) return 'validado';
          if (estados.some((e) => e === 'expirado')) return 'expirado';
          if (estados.some((e) => e === 'rechazado')) return 'rechazado';
          return 'revision';
        };

        return (
        <div>
          {/* Leyenda: solo mientras no haya una identidad vigente */}
          {!identityVigente && (
            <div className="mb-2.5 rounded-md border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs font-medium leading-relaxed text-amber-700">
                Aún no has registrado tu identificación oficial. Elige y captura tu <span className="font-bold">INE</span> (frente y reverso) o tu <span className="font-bold">pasaporte</span> para completar tu expediente.
              </p>
            </div>
          )}

          {/* Selector INE | Pasaporte (solo hasta subir una identidad vigente) */}
          {showSelector && perfilPerms.canUpdate && (
            <div className="mb-2.5 inline-flex rounded-md border border-border bg-muted p-1">
              {([['ine', 'INE'], ['pasaporte', 'Pasaporte']] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setIdentitySel(m)}
                  className={cn(
                    "rounded px-4 py-1.5 text-xs font-bold transition-colors",
                    identitySel === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {visibleDocs.map((doc, i) => {
              const isFirma = doc.kind === 'firma';
              const isCamera = doc.kind === 'camera';
              const isINE = doc.tipos.length === 2; // INE = frente + reverso
              const estado = docEstado(doc);
              const exists = estado !== 'pendiente';
              const badge =
                estado === 'validado'  ? { label: 'Validado',    color: 'text-primary', bg: 'bg-primary/10' }
                : estado === 'revision' ? { label: 'En revisión', color: 'text-amber-700', bg: 'bg-amber-100' }
                : estado === 'rechazado'? { label: 'Rechazado',   color: 'text-destructive', bg: 'bg-destructive/10' }
                : estado === 'expirado' ? { label: 'Expirado',    color: 'text-muted-foreground', bg: 'bg-muted' }
                : { label: 'Pendiente', color: 'text-muted-foreground', bg: 'bg-muted' };
              // ¿Requiere capturar/subir uno nuevo? (falta, expiró o fue rechazado).
              // Si ya está cargado y válido/en revisión → lápiz (reemplazar por si se equivocaron).
              const needsUpload = !exists || estado === 'expirado' || estado === 'rechazado';
              const showAction = perfilPerms.canUpdate && (isFirma ? !exists : true);
              const ineFrente = tipoRow(2)?.url || null;
              const ineReverso = tipoRow(3)?.url || null;
              const singleUrl = doc.tipos.map(tipoRow).find((r: any) => r?.url)?.url || null;
              const canView = isINE ? !!(ineFrente || ineReverso) : !!singleUrl;
              const handleAction = () => {
                // Carta: abre el modal Identidad directo en Dirección (ahí está la firma + datos por completar).
                if (isFirma) { setActiveStepTab('address'); setActiveStep('basic'); return; }
                if (isCamera) { setCameraMode(doc.mode || 'ine'); setIneCaptureOpen(true); return; } // INE/pasaporte
                setDocDetail(doc);                                          // CSF (PDF)
              };
              const handleView = () => {
                if (isINE) { setIneViewer({ frente: ineFrente, reverso: ineReverso }); return; }
                if (singleUrl) setViewer({ url: singleUrl, nombre: doc.nombre });
              };
              const ActionIcon = isFirma ? PenLine : needsUpload ? (isCamera ? Camera : Upload) : Pencil;
              const actionTitle = isFirma ? 'Firmar carta'
                : needsUpload ? (isCamera ? 'Capturar documento' : 'Subir documento')
                : 'Reemplazar documento';
              return (
                <div
                  key={doc.nombre}
                  className="flex items-center gap-3.5 rounded-md border border-border bg-card px-4 py-4"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm font-bold text-foreground">{doc.nombre}</span>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", badge.bg, badge.color)}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-muted-foreground/70">
                      {doc.emisor} · {exists ? 'Cargado' : 'Sin cargar'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {showAction && (
                      <button
                        title={actionTitle}
                        onClick={handleAction}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <ActionIcon className="h-4 w-4" />
                      </button>
                    )}
                    {canView && (
                      <button
                        title="Ver documento"
                        onClick={handleView}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* ===== VISTA: IDENTIDAD ===== */}
      {profileView === 'identidad' && (() => {
        const canEditInfo = perfilPerms.canUpdate;
        const fmtFecha = (f?: string | null) => {
          if (!f) return null;
          const [y, m, d] = f.slice(0, 10).split('-');
          return d && m && y ? `${d}/${m}/${y}` : f;
        };
        const sexoLabel = personaDatos?.sexo === 'M' ? 'Hombre' : personaDatos?.sexo === 'F' ? 'Mujer' : personaDatos?.sexo === 'O' ? 'Otro' : (personaDatos?.sexo || null);
        const domParticular = [personaDatos?.direccion_calle, personaDatos?.direccion_num_ext, personaDatos?.direccion_colonia, personaDatos?.direccion_codigo_postal].filter(Boolean).join(', ');
        const campos = [
          { label: 'Email · solo lectura', value: personaDatos?.email || agentEmail },
          { label: 'Teléfono', value: personaDatos?.telefono },
          { label: 'Nombre completo', value: personaDatos?.nombre_legal },
          { label: 'CURP', value: personaDatos?.curp },
          { label: 'Fecha de nacimiento', value: fmtFecha(personaDatos?.fecha_nacimiento) },
          { label: 'Sexo', value: sexoLabel },
          { label: 'Dirección particular', value: domParticular || null },
        ];
        return (
          <div>
            {/* Información personal (texto + editar) */}
            <div className="mb-3 rounded-md border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Información personal</span>
                {canEditInfo && (
                  <button
                    onClick={openIdentEdit}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
              </div>
              <div className="divide-y divide-border">
                {campos.map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground/70">{c.label}</span>
                    <span className={cn("text-right text-xs font-semibold", c.value ? "text-foreground" : "text-muted-foreground/70")}>
                      {c.value || 'Sin registro'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        );
      })()}

      {/* ===== VISTA: INFORMACIÓN FISCAL ===== */}
      {profileView === 'fiscal' && (() => {
        const domFiscal = [personaDatos?.direccion_fiscal_calle, personaDatos?.direccion_fiscal_colonia, personaDatos?.direccion_fiscal_codigo_postal]
          .filter(Boolean).join(', ');
        const derivados = [
          { label: 'RFC', valor: personaDatos?.rfc },
          { label: 'Régimen fiscal', valor: personaDatos?.regimen },
          { label: 'Domicilio fiscal', valor: domFiscal || null },
        ];
        return (
          <div>
            {/* Uso CFDI */}
            <div className="mb-3 rounded-md border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5">
                <div>
                  <div className="text-xs font-medium text-muted-foreground/70">Uso del CFDI</div>
                </div>
                <Select
                  value={personaDatos?.uso_cfdi || ''}
                  disabled={!perfilPerms.canUpdate || savingCfdi}
                  onValueChange={(v) => saveUsoCfdi(v)}
                >
                  <SelectTrigger className="w-auto min-w-60">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {usoCfdiCatalog.map((u: any) => (
                      <SelectItem key={u.codigo} value={u.codigo}>{u.codigo} · {u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t border-border pt-3 text-xs font-medium leading-relaxed text-muted-foreground">
                Como emites CFDI de comisiones a SOZU, tu RFC, régimen y CP fiscal deben coincidir con el SAT (CFDI 4.0).
              </div>
            </div>

            {/* Información fiscal (texto + editar) */}
            <div className="mb-3 rounded-md border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Información fiscal</span>
                {perfilPerms.canUpdate && (
                  <button
                    onClick={() => setActiveStep('fiscal')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
              </div>
              <div className="divide-y divide-border">
                {derivados.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground/70">{f.label}</span>
                    <span className={cn("text-right text-xs font-semibold", f.valor ? "text-foreground" : "text-muted-foreground/70")}>
                      {f.valor || 'Sin registro'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== VISTA: CUENTA DE DISPERSIÓN ===== */}
      {profileView === 'bank' && (
        <div>
          <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2A6FDB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            <div className="text-xs font-medium leading-relaxed text-blue-800">
              Por tu seguridad, una cuenta nueva queda <strong>pendiente de activación</strong> hasta que validemos que es tuya.
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {bankAccounts.length === 0 && (
              <div className="rounded-md border border-dashed border-border bg-muted px-4 py-8 text-center text-xs font-medium text-muted-foreground/70">
                Aún no tienes cuentas registradas.
              </div>
            )}
            {bankAccounts.map((c: any) => {
              const validada = c.id_estatus_verificacion === 2;
              const last4 = (c.cuenta_clabe || c.numero_cuenta || '').slice(-4);
              const editable = perfilPerms.canUpdate;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!editable}
                  onClick={() => { if (!editable) return; setBankTarget({ mode: 'edit', id: c.id }); setActiveStep('bank-accounts'); }}
                  className={cn(
                    "w-full rounded-md border border-border bg-card p-4 text-left transition-colors",
                    editable ? "hover:border-primary/40 hover:bg-primary/[0.03]" : "cursor-default",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-bold text-foreground">{c.banco?.nombre || 'Banco'}</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", validada ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                          {validada ? 'Validada' : 'Pendiente de activación'}
                        </span>
                        {c.predeterminada && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Predeterminada</span>
                        )}
                      </div>
                      {last4 && (
                        <div className="mt-2 text-sm font-semibold tracking-wide text-muted-foreground">•••• •••• •••• {last4}</div>
                      )}
                      {c.titular && (
                        <div className="mt-1 text-xs font-medium text-muted-foreground/70">Titular: {c.titular}</div>
                      )}
                    </div>
                    {editable && <span className="text-xs font-semibold text-primary">Editar</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== VISTA: CAPACITACIÓN ===== */}
      {profileView === 'training' && (() => {
        const tStatus = getBlockStatus(['training']);
        const pct = tStatus === 'complete' ? 100 : tStatus === 'partial' ? 50 : 0;
        return (
          <div>
            <div className="rounded-md border border-border bg-card px-4 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Avance de tu capacitación</span>
                <span className="text-sm font-bold tabular-nums text-primary">{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="mt-3.5 flex flex-col gap-2.5">
              {sortedTrainingAppointments.length === 0 && (
                <div className="rounded-md border border-dashed border-border bg-muted px-4 py-8 text-center text-xs font-medium text-muted-foreground/70">
                  Aún no tienes capacitaciones agendadas.
                </div>
              )}
              {sortedTrainingAppointments.map((cita) => {
                const st = getTrainingAppointmentStatus(cita);
                return (
                  <div key={cita.id} className="flex items-center gap-3.5 rounded-md border border-border bg-card px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-bold text-foreground">{cita.display_name || 'Capacitación'}</span>
                        <Badge
                          variant={st.tone === 'danger' ? 'destructive' : 'outline'}
                          className={cn("shrink-0 border-0 text-xs",
                            st.tone === 'success' && "bg-emerald-500 text-white",
                            st.tone === 'warning' && "bg-amber-500 text-white",
                            st.tone === 'info' && "bg-blue-500 text-white",
                            st.tone === 'neutral' && "bg-gray-400 text-white")}
                        >{st.label}</Badge>
                      </div>
                      <div className="mt-1 text-xs font-medium text-muted-foreground/70">
                        {new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {cita.hora_inicio ? ` · ${cita.hora_inicio.slice(0, 5)}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        );
      })()}

      {/* Modal confirmar datos de la Constancia (CSF) */}
      <Dialog open={!!csfConfirm} onOpenChange={(o) => { if (!o && !savingCsf) setCsfConfirm(null); }}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-md p-0">
          <ModalFormHeader
            title="Confirma tus datos fiscales"
            subtitle="Extrajimos estos datos de tu Constancia. Verifica o corrige lo que esté mal; se guardarán en tu perfil y el documento quedará validado."
          />
          <div className={cn(MODAL_BODY_CLS, "max-h-[52vh] gap-3")}>
            {csfConfirm?.fields.map((f) => (
              <div key={f.key}>
                <div className={FIELD_LABEL_CLS}>{f.label}</div>
                {f.kind === "regimen" ? (
                  /* Régimen: solo valores del catálogo SAT en BD. Si la Constancia
                     trae uno que no existe, queda vacío y el agente lo elige. */
                  <Select
                    value={csfEdit[f.key] ?? f.value ?? ""}
                    onValueChange={(v) => setCsfEdit((prev) => ({ ...prev, [f.key]: v === NO_REGIMEN ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tu régimen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_REGIMEN}>Sin especificar</SelectItem>
                      {regimenCatalog.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.id} · {r.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={csfEdit[f.key] ?? f.value}
                    onChange={(e) => setCsfEdit((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <div className={MODAL_FOOTER_CLS}>
            <Button variant="cancel" onClick={() => setCsfConfirm(null)} disabled={savingCsf}> Cancelar
            </Button>
            <Button variant="primary-outline" onClick={handleConfirmCsf} disabled={savingCsf}>
              {savingCsf ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sí, es correcta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal cambiar contraseña */}
      <Dialog open={securityOpen} onOpenChange={(o) => { if (!o) { setSecurityOpen(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwShow({ current: false, nueva: false, confirm: false }); } }}>
        <DialogContent className="max-w-[400px] gap-0 overflow-hidden rounded-md bg-card p-0">
          <ModalFormHeader
            title="Cambiar contraseña"
            subtitle="Tu nueva contraseña debe tener al menos 6 caracteres."
          />
          <div className={cn(MODAL_BODY_CLS, "gap-3")}>
            {([
              { key: 'current', label: 'Contraseña actual', val: pwCurrent, set: setPwCurrent },
              { key: 'nueva', label: 'Nueva contraseña', val: pwNew, set: setPwNew },
              { key: 'confirm', label: 'Confirmar nueva contraseña', val: pwConfirm, set: setPwConfirm },
            ] as const).map((f) => (
              <div key={f.label}>
                <div className={FIELD_LABEL_CLS}>{f.label}</div>
                <div className="relative">
                  <Input
                    type={pwShow[f.key] ? 'text' : 'password'}
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPwShow((s) => ({ ...s, [f.key]: !s[f.key] }))}
                    title={pwShow[f.key] ? 'Ocultar' : 'Mostrar'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-muted hover:text-muted-foreground"
                  >
                    {pwShow[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
            <Link
              to="/auth/forgot-password"
              onClick={() => setSecurityOpen(false)}
              className="inline-block text-xs font-semibold text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className={MODAL_FOOTER_CLS}>
            <Button variant="cancel" onClick={() => setSecurityOpen(false)}> Cancelar
            </Button>
            <Button
              variant="primary-outline"
              onClick={changePassword}
              disabled={savingPw || !pwCurrent || !pwNew || !pwConfirm}
            >
              {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar contraseña
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visor de documento (in-app). ModalViewer resuelve rutas del bucket privado
          `firmas-digitales` (carta firmada) a signed URL y documentos Mifiel vía
          Edge Function; los demás docs traen URL pública completa. */}
      <ModalViewer
        open={!!viewer}
        onOpenChange={(o) => { if (!o) setViewer(null); }}
        url={viewer?.url || ""}
        title={viewer?.nombre || "Documento"}
      />

      {/* Captura por cámara de identidad (INE frente+reverso o pasaporte) directo
          desde el expediente. Sube a `documentos` (tipo 2/3/4) en estatus En revisión. */}
      {personaId && (
        <ClienteINECameraCapture
          open={ineCaptureOpen}
          onOpenChange={setIneCaptureOpen}
          personaId={personaId}
          isDesktop={!isMobile}
          mode={cameraMode}
          onCompleted={() => {
            setIneCaptureOpen(false);
            queryClient.invalidateQueries({ queryKey: ['agent-expediente-docs', personaId] });
            queryClient.invalidateQueries({ queryKey: ['agent-onboarding-docs', personaId] });
          }}
        />
      )}

      {/* Visor del INE: frente y reverso apilados vertical (como dos hojas). */}
      <Dialog open={!!ineViewer} onOpenChange={(o) => { if (!o) setIneViewer(null); }}>
        <DialogContent className="w-full gap-0 overflow-hidden rounded-md bg-card p-0 sm:w-[92vw] sm:max-w-[560px]">
          <ModalFormHeader title="INE" subtitle="Frente y reverso" />
          <div className="max-h-[75vh] overflow-y-auto px-6 py-6 space-y-4">
            {[ineViewer?.frente, ineViewer?.reverso].filter(Boolean).map((url, i) => (
              <OptImg key={i} src={url as string} w={1000} alt="INE" className="w-full rounded-md border border-border" />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal editar información de Identidad */}
      <Dialog open={identEditOpen} onOpenChange={(o) => { if (!o) setIdentEditOpen(false); }}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden rounded-md bg-card p-0 sm:w-[92vw] sm:max-w-[540px]">
          <ModalFormHeader title="Editar información" />
          <div className={cn(MODAL_BODY_CLS, "max-h-[70vh] gap-3.5")}>
            {(() => {
              const lbl = FIELD_LABEL_CLS;
              return (
                <>
                  <div>
                    <label className={lbl}>Email · solo lectura</label>
                    <Input value={personaDatos?.email || agentEmail || ''} disabled />
                  </div>
                  <div>
                    <label className={lbl}>Nombre completo <Req /></label>
                    <Input value={identForm.nombre_legal || ''} onChange={(e) => setIdent('nombre_legal', e.target.value)} placeholder="Juan Pérez García" />
                  </div>
                  <div>
                    <label className={lbl}>Teléfono <Req /></label>
                    <Input inputMode="numeric" value={identForm.telefono || ''} onChange={(e) => setIdent('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="5512345678" className="tabular-nums" />
                  </div>
                  <div>
                    <label className={lbl}>CURP <Req /></label>
                    <Input value={identForm.curp || ''} maxLength={18} onChange={(e) => setIdent('curp', e.target.value.toUpperCase())} placeholder="GARC850101HDFRRL09" className="uppercase tabular-nums" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Fecha de nacimiento</label>
                      <Input type="date" value={identForm.fecha_nacimiento || ''} onChange={(e) => setIdent('fecha_nacimiento', e.target.value)} />
                    </div>
                    <div>
                      <label className={lbl}>Sexo</label>
                      <Select
                        value={identForm.sexo || SIN_ESPECIFICAR}
                        onValueChange={(v) => setIdent('sexo', v === SIN_ESPECIFICAR ? '' : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SIN_ESPECIFICAR}>Sin especificar</SelectItem>
                          <SelectItem value="M">Hombre</SelectItem>
                          <SelectItem value="F">Mujer</SelectItem>
                          <SelectItem value="O">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Dirección particular</label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input value={identForm.direccion_calle || ''} onChange={(e) => setIdent('direccion_calle', e.target.value)} placeholder="Av. Insurgentes Sur" />
                      <Input value={identForm.direccion_num_ext || ''} onChange={(e) => setIdent('direccion_num_ext', e.target.value)} placeholder="1234" />
                      <Input value={identForm.direccion_colonia || ''} onChange={(e) => setIdent('direccion_colonia', e.target.value)} placeholder="Del Valle" />
                      <Input inputMode="numeric" maxLength={5} value={identForm.direccion_codigo_postal || ''} onChange={(e) => setIdent('direccion_codigo_postal', e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="03100" className="tabular-nums" />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <div className={MODAL_FOOTER_CLS}>
            <Button variant="cancel" onClick={() => setIdentEditOpen(false)} disabled={savingIdent}> Cancelar
            </Button>
            <Button variant="primary-outline" onClick={saveIdent} disabled={savingIdent}>
              {savingIdent && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle de documento */}
      <Dialog open={!!docDetail} onOpenChange={(o) => { if (!o) setDocDetail(null); }}>
        <DialogContent className="flex max-h-[90vh] max-w-[520px] flex-col gap-0 overflow-hidden rounded-md bg-card p-0">
          {docDetail && (
            <>
              <ModalFormHeader
                title={docDetail.nombre}
                subtitle={`${docDetail.emisor} · ${docDetail.hint}`}
              />

              {/* Solo carga del archivo. Los datos leídos se confirman en la
                  modal "Confirma tus datos fiscales" al subir el documento. */}
              <div className={MODAL_BODY_CLS}>
                {perfilPerms.canUpdate ? (
                  <DocDropzone accept=".pdf" uploading={uploadingDoc} onFile={(f) => handleDocFile(f, docDetail)} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {expedienteDocs.some((d: any) => docDetail.tipos.includes(d.id_tipo_documento))
                      ? 'Documento cargado.'
                      : 'Aún no has cargado este documento.'}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Onboarding Step Dialog */}
      {activeStep && personaId && (
        <AgentOnboardingStepDialog
          step={activeStep}
          bankMode={bankTarget.mode}
          bankAccountId={bankTarget.id}
          personaId={personaId}
          initialTab={activeStepTab}
          open={!!activeStep}
          onOpenChange={(open) => {
            if (!open) {
              setActiveStep(null);
              setActiveStepTab(undefined);
              queryClient.invalidateQueries({ queryKey: ['agent-expediente-docs', personaId] });
              queryClient.invalidateQueries({ queryKey: ['agent-perfil-bancos', personaId] });
            }
          }}
        />
      )}

      </div>
    </div>
  );
};

export default AgentPerfil;
