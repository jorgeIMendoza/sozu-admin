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
import { Badge } from "@/components/ui/badge";
import { getTrainingAppointmentStatus, useAgentTrainingAppointments } from "@/hooks/useAgentTrainingAppointments";
import {
  FileText, Receipt, Landmark, GraduationCap,
  Check, AlertTriangle, ChevronRight, Loader2,
  Camera, Trash2, Upload, ArrowLeft, Eye, Pencil, Plus, UploadCloud, RotateCcw, Lock
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { normalizeAvatarUrl } from "@/lib/avatarUrl";

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

// Documentos del expediente del agente (tipos reales en `documentos`)
const EXPEDIENTE_DOCS: { nombre: string; emisor: string; hint: string; tipos: number[]; step: OnboardingStep['id']; kind: 'camera' | 'pdf' }[] = [
  { nombre: 'Constancia de Situación Fiscal', emisor: 'SAT', hint: 'PDF del SAT, no mayor a 3 meses', tipos: [6], step: 'fiscal', kind: 'pdf' },
  { nombre: 'INE - Frente', emisor: 'INE', hint: 'Lado con foto', tipos: [2], step: 'basic', kind: 'camera' },
  { nombre: 'INE - Reverso', emisor: 'INE', hint: 'Lado con domicilio', tipos: [3], step: 'basic', kind: 'camera' },
  { nombre: 'Pasaporte', emisor: 'SRE', hint: 'Página de datos (vigente)', tipos: [4], step: 'basic', kind: 'camera' },
  { nombre: 'Carta de comercialización', emisor: 'SOZU', hint: 'Documento generado y firmado con SOZU', tipos: [48], step: 'basic', kind: 'pdf' },
];

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
    ? { label: 'Completado', color: 'text-[hsl(158_64%_38%)]', bg: 'bg-[#E8F5EE]' }
    : status === 'partial'
    ? { label: 'En proceso', color: 'text-[#B5730A]', bg: 'bg-[#FBEFD9]' }
    : { label: 'Pendiente', color: 'text-[#6B7280]', bg: 'bg-[#F2F4F5]' };
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
        drag ? "border-[hsl(158_64%_38%)] bg-[#F0FAF4]" : "border-[#D6DBDF] bg-[#FAFBFB] hover:border-[hsl(158_64%_38%)]"
      )}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(158_64%_38%)]" />
      ) : (
        <UploadCloud className="h-8 w-8 text-[hsl(158_64%_38%)]" strokeWidth={1.6} />
      )}
      <div>
        <p className="text-[14px] font-bold text-[#171A1D]">{uploading ? 'Subiendo…' : 'Arrastra el archivo aquí'}</p>
        <p className="mt-1 text-[12px] font-medium text-[#9AA3AD]">o haz clic para seleccionar · Solo PDF</p>
      </div>
    </div>
  );
}
// Captura de documento con cámara (sin IA). Recorta SOLO el recuadro de guía.
// Soporta varios pasos (INE: frente + reverso) o uno solo (pasaporte).
function SimpleCameraCaptureDialog({ open, onOpenChange, personaId, titulo, steps, onUploaded }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId: number | null | undefined;
  titulo: string;
  steps: { tipo: number; label: string }[];
  onUploaded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobsRef = useRef<Record<number, Blob>>({});
  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  const current = steps[stepIndex] || { tipo: 0, label: '' };
  const subLabel = steps.length > 1 && current.label ? `${titulo} - ${current.label}` : titulo;

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  };
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setReady(true);
    } catch {
      toast.error('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  };

  useEffect(() => {
    if (open) {
      blobsRef.current = {};
      setStepIndex(0);
      setPreview(null);
      setPendingBlob(null);
      start();
    } else {
      stop();
      blobsRef.current = {};
      setStepIndex(0);
      setPreview(null);
      setPendingBlob(null);
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Captura recortando EXACTO al recuadro de guía (inset-5 = 20px) considerando object-cover.
  const capture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const cW = v.clientWidth, cH = v.clientHeight, vW = v.videoWidth, vH = v.videoHeight;
    if (!vW || !vH || !cW || !cH) {
      c.width = vW; c.height = vH;
      ctx.drawImage(v, 0, 0);
    } else {
      const scale = Math.max(cW / vW, cH / vH);
      const offX = (vW - cW / scale) / 2;
      const offY = (vH - cH / scale) / 2;
      const inset = 20; // inset-5
      const sx = Math.max(0, offX + inset / scale);
      const sy = Math.max(0, offY + inset / scale);
      const sw = Math.min((cW - 2 * inset) / scale, vW - sx);
      const sh = Math.min((cH - 2 * inset) / scale, vH - sy);
      c.width = Math.round(sw);
      c.height = Math.round(sh);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    }
    c.toBlob((blob) => {
      if (!blob) return;
      setPendingBlob(blob);
      setPreview(URL.createObjectURL(blob));
      stop();
    }, 'image/jpeg', 0.9);
  };

  const repeat = () => { setPreview(null); setPendingBlob(null); start(); };

  const uploadOne = async (tipo: number, blob: Blob) => {
    const file = new File([blob], `doctype${tipo}_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const path = `expediente/${personaId}/${tipo}_${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
    await (supabase as any).from('documentos').update({ activo: false })
      .eq('id_persona', personaId).eq('id_tipo_documento', tipo).eq('activo', true);
    const { error: insErr } = await (supabase as any).from('documentos').insert({
      url: publicUrl, id_tipo_documento: tipo, id_persona: personaId, activo: true, id_estatus_verificacion: 1,
    });
    if (insErr) throw insErr;
  };

  const cont = async () => {
    if (!pendingBlob) return;
    blobsRef.current[current.tipo] = pendingBlob;
    // Avanzar de paso NO requiere persona (solo la subida final).
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      setPreview(null);
      setPendingBlob(null);
      start();
      return;
    }
    if (!personaId) {
      toast.error('Tu usuario no tiene un perfil de persona asociado, no se puede guardar el documento.');
      return;
    }
    setUploading(true);
    try {
      for (const st of steps) {
        const b = blobsRef.current[st.tipo];
        if (b) await uploadOne(st.tipo, b);
      }
      toast.success('Documento guardado. Queda pendiente de validación.');
      onUploaded();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el documento.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b border-[#ECEEF0] px-5 py-4 space-y-0 pr-10">
          <DialogTitle className="text-[16px] font-bold text-[#171A1D]">Captura de tu documento</DialogTitle>
          <p className="mt-0.5 text-[12.5px] font-medium text-[#9AA3AD]">
            {subLabel}{steps.length > 1 ? ` · Paso ${stepIndex + 1} de ${steps.length}` : ''}
          </p>
        </DialogHeader>
        <div className="p-4">
          <p className="mb-2 text-center text-[13px] font-medium text-[#6B7280]">
            {preview ? 'Revisa que se vea completo y legible.' : 'Encuadra el documento y captura.'}
          </p>
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-black">
            {preview ? (
              <img src={preview} alt="Captura" className="h-full w-full object-contain" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            )}
            {!preview && <div className="pointer-events-none absolute inset-5 rounded-md border-2 border-white/70" />}
            <canvas ref={canvasRef} className="hidden" />
            {!ready && !preview && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            {preview ? (
              <>
                <button onClick={repeat} disabled={uploading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[#ECEEF0] px-4 py-2.5 text-[13px] font-semibold text-[#6B7280] hover:bg-[#F6F7F8] disabled:opacity-50">
                  <RotateCcw className="h-4 w-4" /> Repetir
                </button>
                <button onClick={cont} disabled={uploading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[hsl(158_64%_38%)] px-4 py-2.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />} Continuar
                </button>
              </>
            ) : (
              <button onClick={capture} disabled={!ready}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(158_64%_38%)] px-4 py-2.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50">
                <Camera className="h-4 w-4" /> Capturar
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
// Fila compartida de "Secciones de tu perfil" (Documentos + etapas). Un solo estilo.
function ProfileSectionRow({ title, description, badge, onClick }: {
  title: string;
  description: string;
  badge?: { label: string; color: string; bg: string } | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md border border-[#ECEEF0] bg-white px-4 py-[15px] text-left hover:border-[#CBD2D9]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13.5px] font-bold text-[#171A1D]">{title}</span>
          {badge && (
            <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", badge.bg, badge.color)}>{badge.label}</span>
          )}
        </div>
        <p className="mt-1 text-[11.5px] font-medium text-[#9AA3AD]">{description}</p>
      </div>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#9AA3AD]" strokeWidth={2} />
    </button>
  );
}

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
  const { data: agencyName } = useQuery({
    queryKey: ['agent-agency', personaId],
    queryFn: async () => {
      if (!personaId) return null;
      const { data } = await supabase
        .from('entidades_relacionadas')
        .select('personas!entidades_relacionadas_id_persona_duena_lead_fkey(nombre_legal)')
        .eq('id_persona', personaId)
        .eq('id_tipo_entidad', 19)
        .eq('activo', true)
        .not('id_persona_duena_lead', 'is', null)
        .limit(1)
        .maybeSingle();
      return (data?.personas as any)?.nombre_legal || null;
    },
    enabled: !!personaId,
    staleTime: Infinity,
  });

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

  const [activeStep, setActiveStep] = useState<OnboardingStep['id'] | null>(null);
  const [profileView, setProfileView] = useState<'overview' | 'expediente' | 'identidad' | 'fiscal' | 'bank' | 'training'>('overview');
  const [docDetail, setDocDetail] = useState<typeof EXPEDIENTE_DOCS[number] | null>(null);
  const [viewer, setViewer] = useState<{ url: string; nombre: string } | null>(null);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

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

  const darDeBajaCuenta = async (id: number) => {
    await (supabase as any).from('cuentas_bancarias').update({ activo: false }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['agent-perfil-bancos', personaId] });
  };

  // Subida directa de PDF (constancia fiscal) → documentos, pendiente de validación.
  const [cameraDoc, setCameraDoc] = useState<{ titulo: string; steps: { tipo: number; label: string }[] } | null>(null);
  // INE = frente(2)+reverso(3) en un solo flujo. Pasaporte(4) independiente.
  const openCameraForDoc = (tipos: number[], nombre: string) => {
    const t = tipos[0];
    if (t === 2 || t === 3) {
      setCameraDoc({ titulo: 'INE', steps: [{ tipo: 2, label: 'Frente' }, { tipo: 3, label: 'Reverso' }] });
    } else {
      setCameraDoc({ titulo: nombre, steps: [{ tipo: t, label: '' }] });
    }
  };
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const uploadDocPdf = async (file: File, tipo: number) => {
    if (!personaId) { toast.error('Tu usuario no tiene un perfil de persona asociado.'); return; }
    setUploadingDoc(true);
    try {
      const path = `expediente/${personaId}/${tipo}_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
      await (supabase as any).from('documentos').update({ activo: false })
        .eq('id_persona', personaId).eq('id_tipo_documento', tipo).eq('activo', true);
      const { error: insErr } = await (supabase as any).from('documentos').insert({
        url: publicUrl, id_tipo_documento: tipo, id_persona: personaId, activo: true, id_estatus_verificacion: 1,
      });
      if (insErr) throw insErr;
      queryClient.invalidateQueries({ queryKey: ['agent-expediente-docs', personaId] });
      toast.success('Documento subido. Queda pendiente de validación.');
      setDocDetail(null);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo subir el documento.');
    } finally {
      setUploadingDoc(false);
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

  // Estatus agregado de Documentos (para la fila "Documentos" en Secciones)
  const docsStatus = (() => {
    const total = EXPEDIENTE_DOCS.length;
    let validated = 0, uploaded = 0;
    EXPEDIENTE_DOCS.forEach((d) => {
      const rows = expedienteDocs.filter((x: any) => d.tipos.includes(x.id_tipo_documento));
      if (rows.some((x: any) => x.id_estatus_verificacion === 2)) validated++;
      else if (rows.length > 0) uploaded++;
    });
    if (total > 0 && validated === total) return 'complete';
    if (validated + uploaded > 0) return 'partial';
    return 'pending';
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
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--agent-primary))]" />
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-[#4B5563] transition-colors hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="flex-1 truncate text-[18px] font-bold tracking-[-0.3px] text-[#171A1D]">{SUBSECTION_TITLES[profileView]}</h2>
            {profileView === 'training' && perfilPerms.canUpdate && (
              <button
                onClick={() => setActiveStep('training')}
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[hsl(158_64%_38%)] px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                <span className="hidden sm:inline">Agendar capacitación</span>
                <span className="sm:hidden">Agendar</span>
              </button>
            )}
            {profileView === 'bank' && perfilPerms.canUpdate && (
              <button
                onClick={() => setActiveStep('bank-accounts')}
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[hsl(158_64%_38%)] px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                <span className="hidden sm:inline">Agregar cuenta</span>
                <span className="sm:hidden">Agregar</span>
              </button>
            )}
          </div>
        )}
      </AgentPortalHeader>
      <div className="mx-auto max-w-[1040px] pt-1 space-y-4">
      {profileView === 'overview' && (<>
      {/* Profile Card */}
      <div className="rounded-md bg-white border border-[#ECEEF0] shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-5 sm:p-[22px] flex flex-wrap items-start gap-5">
        {/* Avatar */}
        <button
          type="button"
          className="relative shrink-0 rounded-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(158_64%_38%)] focus-visible:ring-offset-2"
          onClick={() => canEdit && setShowPhotoModal(true)}
          disabled={!canEdit}
          title={canEdit ? "Cambiar foto de perfil" : undefined}
          aria-label={canEdit ? "Cambiar foto de perfil" : "Foto de perfil"}
        >
          {perfilExtra?.foto_perfil_url ? (
            <img
              src={normalizeAvatarUrl(perfilExtra.foto_perfil_url)}
              alt={displayName || "Avatar"}
              className="h-[72px] w-[72px] rounded-full object-cover"
            />
          ) : (
            <div className="h-[72px] w-[72px] rounded-full bg-[hsl(158_64%_38%)] flex items-center justify-center text-white font-bold text-2xl">
              {(displayName || "A")[0]?.toUpperCase()}
            </div>
          )}
          {canEdit && (
            <span className="absolute -right-1 -bottom-1 h-[26px] w-[26px] rounded-full bg-white border border-[#E4E7EA] shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex items-center justify-center text-[#4B5563]">
              <Camera className="h-3.5 w-3.5" />
            </span>
          )}
          {/* Indicador de estatus activo - puntito sobre el borde del avatar */}
          <span
            title="Activo"
            aria-label="Activo"
            className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[hsl(158_64%_38%)] ring-[2.5px] ring-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
          />
        </button>

        {/* Info + presentación */}
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[19px] font-bold tracking-[-0.3px] text-[#171A1D]">
              {displayName || "Agente"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-[12px] font-semibold text-[#6B7280]">
              {(perfilExtra as any)?.roles?.nombre || profile?.rol_nombre || "Agente Inmobiliario"}
            </span>
          </div>
          {agencyName && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-block h-[7px] w-[7px] rounded-full bg-[hsl(158_64%_38%)] shrink-0" />
              <span className="text-[11px] font-semibold text-[hsl(158_64%_38%)]">{agencyName}</span>
            </div>
          )}
          {/* Desarrollos asignados - bajo la agencia (máx 3 visibles + "+N") */}
          {misDesarrollos.length > 0 && (
            <div className="mt-2.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.6px] text-[#9AA3AD]">Desarrollos asignados</div>
              <div className="flex flex-wrap gap-1.5">
                {(showAllDesarrollos ? misDesarrollos : misDesarrollos.slice(0, 3)).map((d) => (
                  <span key={d} className="rounded-full border border-[#E4E7EA] bg-white px-2.5 py-[3px] text-[10.5px] font-semibold text-[#4B5563]">
                    {d}
                  </span>
                ))}
                {misDesarrollos.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDesarrollos((v) => !v)}
                    className="rounded-full border border-[#D6ECE0] bg-[#EAF6F0] px-2.5 py-[3px] text-[10.5px] font-bold text-[hsl(158_64%_38%)] hover:bg-[#DDF0E6]"
                  >
                    {showAllDesarrollos ? 'Ver menos' : `+${misDesarrollos.length - 3}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Presentación: lectura por defecto, edición al pulsar */}
          {(canEdit || perfilExtra?.frase_perfil) && (
            <div className="mt-3.5 pt-3.5 border-t border-[#F2F4F5]">
              {editingFrase ? (
                <>
                  <p className="text-[11.5px] font-semibold text-[#4B5563] leading-relaxed">
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
                    className="mt-2 w-full max-h-[140px] resize-none overflow-y-auto rounded-md border border-[#ECEEF0] px-3 py-2.5 text-[12.5px] text-[#171A1D] leading-relaxed outline-none focus:ring-2 focus:ring-[hsl(158_64%_38%)]/30"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[10.5px] italic text-[#9AA3AD]">
                      Habla de tu experiencia. Evita promesas de rendimiento o plusvalía.
                    </span>
                    <span className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[10.5px] font-medium tabular-nums text-[#B7BEC5]">{fraseValue.length}/280</span>
                      <button
                        onClick={() => setEditingFrase(false)}
                        disabled={savingFrase}
                        className="inline-flex items-center rounded-md border border-[#ECEEF0] px-3.5 py-1.5 text-[11.5px] font-semibold text-[#6B7280] hover:bg-[#F6F7F8] disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleFraseSave}
                        disabled={savingFrase}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(158_64%_38%)] bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-[hsl(158_64%_38%)] hover:bg-[#F0FAF4] disabled:opacity-50"
                      >
                        {savingFrase && <Loader2 className="h-3 w-3 animate-spin" />}
                        Guardar
                      </button>
                    </span>
                  </div>
                </>
              ) : perfilExtra?.frase_perfil ? (
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 text-[12.5px] italic text-[#4B5563] leading-relaxed">"{perfilExtra.frase_perfil}"</p>
                  {canEdit && (
                    <button
                      onClick={() => { setFraseValue(perfilExtra.frase_perfil || ''); setEditingFrase(true); }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#ECEEF0] px-2.5 py-1.5 text-[11px] font-semibold text-[#4B5563] hover:bg-[#F6F7F8]"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  )}
                </div>
              ) : canEdit ? (
                <button
                  onClick={() => { setFraseValue(''); setEditingFrase(true); }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#D6DBDF] px-3.5 py-2 text-[12px] font-semibold text-[#4B5563] transition-colors hover:border-[hsl(158_64%_38%)] hover:text-[hsl(158_64%_38%)]"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar presentación
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* Panel activación */}
        <div className="w-full sm:w-[220px] shrink-0 sm:border-l sm:border-[#F2F4F5] sm:pl-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Activación</span>
            <span className="text-[18px] font-bold tabular-nums text-[hsl(158_64%_38%)]">{percentage}%</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[#EEF0F2] overflow-hidden">
            <div className="h-full rounded-full bg-[hsl(158_64%_38%)] transition-all duration-700" style={{ width: `${percentage}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] font-medium text-[#9AA3AD] leading-snug">
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
                <span className={cn('h-[7px] w-[7px] rounded-full', sozuInfo.activo ? 'bg-[hsl(158_64%_38%)]' : 'bg-[#C4CBD2]')} />
                {sozuInfo.activo ? 'Activo' : 'Inactivo'}
              </span>
            ),
          },
          { label: 'Equipo / Líder', render: sozuInfo.lider || 'Sin asignar' },
          { label: 'Fecha de alta', render: fmtAlta(sozuInfo.fechaAlta) },
        ];
        return (
          <div className="rounded-md border border-[#ECEEF0] bg-white p-5 sm:p-[22px]">
            <div className="mb-3 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-[#9AA3AD]" />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">
                Asignado por SOZU · solo lectura
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-0.5 sm:grid-cols-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 border-b border-[#F2F4F5] py-2.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                  <span className="text-[12px] font-medium text-[#9AA3AD]">{r.label}</span>
                  <span className="text-right text-[13px] font-semibold text-[#171A1D]">{r.render}</span>
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

      {/* Photo modal - phase 1: options / phase 2: preview & confirm */}
      <Dialog open={showPhotoModal} onOpenChange={(open) => { if (!open) closePhotoModal(); }}>
        <DialogContent
          style={{ '--agent-primary': '147 33% 29%' } as React.CSSProperties}
          className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[360px] p-0 overflow-hidden rounded-md border-0 shadow-2xl [&>button]:text-white/80 [&>button:hover]:text-white"
        >
          {!pendingFile ? (
            /* ── Phase 1: Options ── */
            <>
              {/* Colored header */}
              <div className="bg-[hsl(var(--agent-primary))] px-5 pt-5 sm:pt-7 pb-6 sm:pb-8 flex flex-col items-center gap-2">
                <DialogTitle className="text-[14px] sm:text-[15px] font-semibold text-white text-center tracking-wide uppercase opacity-80">
                  Foto de perfil
                </DialogTitle>
                <div className="mt-2 sm:mt-3 relative">
                  {perfilExtra?.foto_perfil_url ? (
                    <img
                      src={perfilExtra.foto_perfil_url}
                      alt={displayName || "Avatar"}
                      className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 rounded-full object-cover ring-[3px] ring-white/40 shadow-xl"
                    />
                  ) : (
                    <div className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-2xl sm:text-3xl ring-[3px] ring-white/40 shadow-xl">
                      {(displayName || "A")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="text-[13px] sm:text-sm font-medium text-white/90 leading-none">{displayName || "Agente"}</p>
              </div>

              {/* Actions */}
              <div className="px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 w-full rounded-md px-3 sm:px-4 min-h-[52px] text-sm font-medium text-left bg-[hsl(var(--agent-primary))]/10 hover:bg-[hsl(var(--agent-primary))]/15 active:bg-[hsl(var(--agent-primary))]/20 transition-colors cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-full bg-[hsl(var(--agent-primary))]/15 flex items-center justify-center shrink-0">
                    <Upload className="h-4 w-4 text-[hsl(var(--agent-primary))]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[hsl(var(--agent-primary))]">
                      {perfilExtra?.foto_perfil_url ? 'Cambiar foto' : 'Cargar foto'}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--agent-primary))]/60 mt-0.5">JPG, PNG o WebP</p>
                  </div>
                </button>

                {perfilExtra?.foto_perfil_url && (
                  <button
                    onClick={handlePhotoDelete}
                    disabled={deletingPhoto}
                    className="flex items-center gap-3 w-full rounded-md px-3 sm:px-4 min-h-[52px] text-sm font-medium text-left bg-red-50 hover:bg-red-100 active:bg-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      {deletingPhoto
                        ? <Loader2 className="h-4 w-4 text-red-500 animate-spin" />
                        : <Trash2 className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-red-700">Eliminar foto</p>
                      <p className="text-[11px] text-red-400 mt-0.5">Vuelves a mostrar tus iniciales</p>
                    </div>
                  </button>
                )}

                <button
                  onClick={closePhotoModal}
                  className="mt-0.5 w-full rounded-md px-4 min-h-[44px] text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors text-center cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            /* ── Phase 2: Preview & confirm ── */
            <>
              {/* Colored header with preview */}
              <div className="bg-[hsl(var(--agent-primary))] px-5 pt-5 sm:pt-7 pb-6 sm:pb-8 flex flex-col items-center gap-2">
                <DialogTitle className="text-[14px] sm:text-[15px] font-semibold text-white text-center tracking-wide uppercase opacity-80">
                  Vista previa
                </DialogTitle>
                <div className="mt-2 sm:mt-3 relative">
                  <div className="absolute -inset-2 rounded-full bg-white/10 animate-pulse" />
                  <img
                    src={previewUrl!}
                    alt="Vista previa"
                    className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover ring-[3px] ring-white/40 shadow-xl relative z-10"
                  />
                </div>
                <p className="text-[12px] sm:text-[13px] text-white/70 text-center leading-snug">
                  Así se verá tu foto de perfil
                </p>
              </div>

              <div className="px-3 sm:px-4 pb-4 sm:pb-5 pt-3 sm:pt-4 flex flex-col gap-2">
                <button
                  onClick={handlePhotoConfirm}
                  disabled={uploadingPhoto}
                  className="w-full rounded-md min-h-[52px] text-sm font-semibold bg-[hsl(var(--agent-primary))] hover:opacity-90 active:opacity-80 text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {uploadingPhoto ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                  ) : (
                    <><Check className="h-4 w-4" strokeWidth={2.5} /> Guardar foto</>
                  )}
                </button>
                <button
                  onClick={() => { setPendingFile(null); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}
                  disabled={uploadingPhoto}
                  className="w-full rounded-md min-h-[44px] text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Volver
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Aviso proactivo */}
      {isAgentRole && !canReceivePayments && (
        <div className="flex items-center gap-3 rounded-md border border-[#EBCBA6] bg-[#FBE3CE] px-3.5 py-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#B5601C] text-white">
            <AlertTriangle className="h-3 w-3" />
          </span>
          <span className="flex-1 text-[12px] font-semibold text-[#B5601C]">
            Completa tu información fiscal y cuenta bancaria para poder recibir comisiones.
          </span>
          {perfilPerms.canUpdate && (
            <span
              tabIndex={0}
              onClick={() => setProfileView('fiscal')}
              className="shrink-0 cursor-pointer text-[11.5px] font-bold text-[#B5601C] underline"
            >
              Actualizar
            </span>
          )}
        </div>
      )}

      {/* HERO MOTOR · expediente */}
      <div className="flex flex-wrap gap-[22px] rounded-md border border-[#CFE9DA] bg-gradient-to-br from-[#F0FAF4] to-[#FBFEFC] p-[22px]">
        <div className="min-w-[240px] flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[1.2px] text-[hsl(158_64%_38%)]">
            Tu expediente · el motor de tu activación
          </div>
          <div className="mt-2 text-[21px] font-bold leading-[1.25] tracking-[-0.4px] text-[#16331F]">
            Tu información se construye desde tus documentos.
          </div>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#3F5A4A]">
            Cada documento que subes alimenta tu información personal y fiscal. Solo validas lo que ya dijeron.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => setProfileView('expediente')}
              className="inline-flex items-center gap-2 rounded-md bg-[hsl(158_64%_38%)] px-[18px] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <FileText className="h-4 w-4" />
              Gestionar documentos
            </button>
            <span className="text-[12px] font-semibold tabular-nums text-[#3F5A4A]">
              {seccionesValidadas} de {totalSecciones} secciones completadas
            </span>
          </div>
        </div>
        <div className="w-[210px] shrink-0 rounded-md border border-[#DCEEE3] bg-white p-[15px]">
          <div className="mb-3 text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Estado de secciones</div>
          <div className="flex flex-col gap-[11px]">
            {[
              { n: seccionesValidadas, label: 'validadas', bg: 'bg-[#E8F5EE]', color: 'text-[hsl(158_64%_38%)]' },
              { n: seccionesEnProceso, label: 'en proceso', bg: 'bg-[#FBEFD9]', color: 'text-[#B5730A]' },
              { n: seccionesPendientes, label: 'pendientes', bg: 'bg-[#EEF0F2]', color: 'text-[#6B7280]' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2.5">
                <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums", c.bg, c.color)}>
                  {c.n}
                </span>
                <span className="text-[12px] font-semibold text-[#4B5563]">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIONES DE TU PERFIL */}
      <div>
        <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[1px] text-[#9AA3AD]">
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
      {profileView === 'expediente' && (
        <div>
          <p className="max-w-[560px] text-[13px] font-medium leading-relaxed text-[#6B7280]">
            Sube cada documento; leemos los datos por ti y solo los validas. El orden sugerido está marcado con número.
          </p>
          <div className="mt-[18px] flex flex-col gap-2.5">
            {EXPEDIENTE_DOCS.map((doc, i) => {
              const rows = expedienteDocs.filter((d: any) => doc.tipos.includes(d.id_tipo_documento));
              const approved = rows.some((d: any) => d.id_estatus_verificacion === 2);
              const exists = rows.length > 0;
              const estado = approved ? 'validado' : exists ? 'revision' : 'pendiente';
              const badge =
                estado === 'validado'
                  ? { label: 'Validado', color: 'text-[hsl(158_64%_38%)]', bg: 'bg-[#E8F5EE]' }
                  : estado === 'revision'
                  ? { label: 'En revisión', color: 'text-[#B5730A]', bg: 'bg-[#FBEFD9]' }
                  : { label: 'Pendiente', color: 'text-[#6B7280]', bg: 'bg-[#EEF0F2]' };
              const url = rows.find((d: any) => d.url)?.url || null;
              return (
                <div
                  key={doc.nombre}
                  className="flex items-center gap-3.5 rounded-md border border-[#ECEEF0] bg-white px-4 py-[15px]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F2F4F5] text-[12px] font-bold tabular-nums text-[#6B7280]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[13.5px] font-bold text-[#171A1D]">{doc.nombre}</span>
                      <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", badge.bg, badge.color)}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] font-medium text-[#9AA3AD]">
                      {doc.emisor} · {exists ? 'Cargado' : 'Sin cargar'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {perfilPerms.canUpdate && (
                      <button
                        title={doc.kind === 'camera' ? 'Tomar foto' : 'Subir documento'}
                        onClick={() => doc.kind === 'camera' ? openCameraForDoc(doc.tipos, doc.nombre) : setDocDetail(doc)}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
                      >
                        {doc.kind === 'camera' ? <Camera className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      </button>
                    )}
                    {url && (
                      <button
                        title="Ver documento"
                        onClick={() => setViewer({ url, nombre: doc.nombre })}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
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
      )}

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
            <div className="mb-3 rounded-md border border-[#ECEEF0] bg-white p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Información personal</span>
                {canEditInfo && (
                  <button
                    onClick={openIdentEdit}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#ECEEF0] px-3 py-1.5 text-[11.5px] font-semibold text-[#4B5563] hover:bg-[#F6F7F8]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
              </div>
              <div className="divide-y divide-[#F2F4F5]">
                {campos.map((c) => (
                  <div key={c.label} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[12px] font-medium text-[#9AA3AD]">{c.label}</span>
                    <span className={cn("text-right text-[12.5px] font-semibold", c.value ? "text-[#171A1D]" : "text-[#9AA3AD]")}>
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
        const fiscalDocs = EXPEDIENTE_DOCS.filter((d) => d.step === 'fiscal');
        return (
          <div>
            {/* Uso CFDI */}
            <div className="mb-3 rounded-md border border-[#ECEEF0] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5">
                <div>
                  <div className="text-[12px] font-medium text-[#9AA3AD]">Uso del CFDI</div>
                </div>
                <select
                  value={personaDatos?.uso_cfdi || ''}
                  disabled={!perfilPerms.canUpdate || savingCfdi}
                  onChange={(e) => saveUsoCfdi(e.target.value)}
                  className="min-w-[240px] cursor-pointer rounded-[9px] border border-[#ECEEF0] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#171A1D] outline-none disabled:opacity-60"
                >
                  <option value="">Selecciona…</option>
                  {usoCfdiCatalog.map((u: any) => (
                    <option key={u.codigo} value={u.codigo}>{u.codigo} · {u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="border-t border-[#F2F4F5] pt-3 text-[11.5px] font-medium leading-relaxed text-[#6B7280]">
                Como emites CFDI de comisiones a SOZU, tu RFC, régimen y CP fiscal deben coincidir con el SAT (CFDI 4.0).
              </div>
            </div>

            {/* Información fiscal (texto + editar) */}
            <div className="mb-3 rounded-md border border-[#ECEEF0] bg-white p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Información fiscal</span>
                {perfilPerms.canUpdate && (
                  <button
                    onClick={() => setActiveStep('fiscal')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#ECEEF0] px-3 py-1.5 text-[11.5px] font-semibold text-[#4B5563] hover:bg-[#F6F7F8]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                )}
              </div>
              <div className="divide-y divide-[#F2F4F5]">
                {derivados.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[12px] font-medium text-[#9AA3AD]">{f.label}</span>
                    <span className={cn("text-right text-[12.5px] font-semibold", f.valor ? "text-[#171A1D]" : "text-[#9AA3AD]")}>
                      {f.valor || 'Sin registro'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Documentos fiscales */}
            <div className="rounded-md border border-[#ECEEF0] bg-white p-5">
              <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Documentos fiscales</div>
              <div className="flex flex-col gap-2.5">
                {fiscalDocs.map((doc) => {
                  const rows = expedienteDocs.filter((d: any) => doc.tipos.includes(d.id_tipo_documento));
                  const approved = rows.some((d: any) => d.id_estatus_verificacion === 2);
                  const exists = rows.length > 0;
                  const url = rows.find((d: any) => d.url)?.url || null;
                  const badge = approved
                    ? { label: 'Validado', color: 'text-[hsl(158_64%_38%)]', bg: 'bg-[#E8F5EE]' }
                    : exists
                    ? { label: 'En revisión', color: 'text-[#B5730A]', bg: 'bg-[#FBEFD9]' }
                    : { label: 'Pendiente', color: 'text-[#6B7280]', bg: 'bg-[#EEF0F2]' };
                  return (
                    <div key={doc.nombre} className="flex items-center gap-3.5 rounded-md border border-[#ECEEF0] bg-white px-4 py-[13px]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F2F4F5] text-[#6B7280]">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-[13px] font-bold text-[#171A1D]">{doc.nombre}</span>
                          <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", badge.bg, badge.color)}>{badge.label}</span>
                        </div>
                        <p className="mt-0.5 text-[11.5px] font-medium text-[#9AA3AD]">{doc.emisor} · {exists ? 'Cargado' : 'Sin cargar'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {perfilPerms.canUpdate && (
                          <button
                            title={exists ? 'Reemplazar' : 'Subir'}
                            onClick={() => setActiveStep(doc.step)}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          title={url ? 'Ver documento' : 'Sin documento'}
                          disabled={!url}
                          onClick={() => { if (url) setViewer({ url, nombre: doc.nombre }); }}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-md border border-[#ECEEF0] transition-colors",
                            url ? "bg-white text-[#4B5563] hover:bg-[#F6F7F8]" : "bg-white text-[#C4CACF] cursor-not-allowed"
                          )}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== VISTA: CUENTA DE DISPERSIÓN ===== */}
      {profileView === 'bank' && (
        <div>
          <div className="flex items-start gap-3 rounded-md border border-[#C9DCF2] bg-[#EAF2FB] px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2A6FDB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            <div className="text-[12px] font-medium leading-relaxed text-[#2A557F]">
              Por tu seguridad, una cuenta nueva queda <strong>pendiente de activación</strong> hasta que validemos que es tuya.
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {bankAccounts.length === 0 && (
              <div className="rounded-md border border-dashed border-[#D6DBDF] bg-[#FAFBFB] px-4 py-8 text-center text-[12.5px] font-medium text-[#9AA3AD]">
                Aún no tienes cuentas registradas.
              </div>
            )}
            {bankAccounts.map((c: any) => {
              const validada = c.id_estatus_verificacion === 2;
              const last4 = (c.cuenta_clabe || '').slice(-4);
              return (
                <div key={c.id} className="rounded-md border border-[#ECEEF0] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[14px] font-bold text-[#171A1D]">{c.banco?.nombre || 'Banco'}</span>
                        <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", validada ? "bg-[#E8F5EE] text-[hsl(158_64%_38%)]" : "bg-[#EEF0F2] text-[#6B7280]")}>
                          {validada ? 'Validada' : 'Pendiente de activación'}
                        </span>
                        {c.predeterminada && (
                          <span className="rounded-full bg-[#E8F5EE] px-2.5 py-[3px] text-[9.5px] font-bold text-[hsl(158_64%_38%)]">Predeterminada</span>
                        )}
                      </div>
                      {last4 && (
                        <div className="mt-2 text-[13px] font-semibold tracking-[1px] text-[#4B5563]">•••• •••• •••• {last4}</div>
                      )}
                      {c.titular && (
                        <div className="mt-1 text-[11.5px] font-medium text-[#9AA3AD]">Titular: {c.titular}</div>
                      )}
                    </div>
                  </div>
                  {perfilPerms.canUpdate && (
                    <div className="mt-3 flex gap-2.5 border-t border-[#F2F4F5] pt-3">
                      <button
                        onClick={() => { if (window.confirm('¿Dar de baja esta cuenta?')) darDeBajaCuenta(c.id); }}
                        className="rounded-md border border-[#F0C9C4] bg-white px-3 py-2 text-[11.5px] font-bold text-[#B84A3C] transition-colors hover:bg-[#FBE6E6]"
                      >
                        Dar de baja
                      </button>
                    </div>
                  )}
                </div>
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
            <div className="rounded-md border border-[#ECEEF0] bg-white px-[18px] py-[17px]">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-semibold text-[#6B7280]">Avance de tu capacitación</span>
                <span className="text-[14px] font-bold tabular-nums text-[hsl(158_64%_38%)]">{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF0F2]">
                <div className="h-full rounded-full bg-[hsl(158_64%_38%)]" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="mt-3.5 flex flex-col gap-2.5">
              {sortedTrainingAppointments.length === 0 && (
                <div className="rounded-md border border-dashed border-[#D6DBDF] bg-[#FAFBFB] px-4 py-8 text-center text-[12.5px] font-medium text-[#9AA3AD]">
                  Aún no tienes capacitaciones agendadas.
                </div>
              )}
              {sortedTrainingAppointments.map((cita) => {
                const st = getTrainingAppointmentStatus(cita);
                return (
                  <div key={cita.id} className="flex items-center gap-3.5 rounded-md border border-[#ECEEF0] bg-white px-4 py-[15px]">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[13.5px] font-bold text-[#171A1D]">{cita.display_name || 'Capacitación'}</span>
                        <Badge
                          variant={st.tone === 'danger' ? 'destructive' : 'outline'}
                          className={cn("shrink-0 border-0 text-[10px]",
                            st.tone === 'success' && "bg-emerald-500 text-white",
                            st.tone === 'warning' && "bg-amber-500 text-white",
                            st.tone === 'info' && "bg-blue-500 text-white",
                            st.tone === 'neutral' && "bg-gray-400 text-white")}
                        >{st.label}</Badge>
                      </div>
                      <div className="mt-1 text-[11.5px] font-medium text-[#9AA3AD]">
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

      {/* Modal cambiar contraseña */}
      <Dialog open={securityOpen} onOpenChange={(o) => { if (!o) { setSecurityOpen(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); } }}>
        <DialogContent className="max-w-[400px] bg-white p-[26px]">
          <DialogTitle className="text-[17px] font-bold text-[#171A1D]">Cambiar contraseña</DialogTitle>
          <p className="-mt-1 text-[12px] font-medium leading-relaxed text-[#6B7280]">
            Tu nueva contraseña debe tener al menos 6 caracteres.
          </p>
          <div className="mt-2 space-y-3">
            {[
              { label: 'Contraseña actual', val: pwCurrent, set: setPwCurrent },
              { label: 'Nueva contraseña', val: pwNew, set: setPwNew },
              { label: 'Confirmar nueva contraseña', val: pwConfirm, set: setPwConfirm },
            ].map((f) => (
              <div key={f.label}>
                <div className="mb-1.5 text-[11.5px] font-medium text-[#9AA3AD]">{f.label}</div>
                <input
                  type="password"
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  className="w-full rounded-md border border-[#ECEEF0] px-3 py-2.5 text-[13px] font-semibold text-[#171A1D] outline-none focus:ring-2 focus:ring-[hsl(158_64%_38%)]/30"
                />
              </div>
            ))}
          </div>
          <div className="mt-[18px] flex gap-2.5">
            <button
              onClick={() => setSecurityOpen(false)}
              className="shrink-0 rounded-md border border-[#E4E7EA] bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#4B5563]"
            >
              Cancelar
            </button>
            <button
              onClick={changePassword}
              disabled={savingPw || !pwCurrent || !pwNew || !pwConfirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[hsl(158_64%_38%)] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar contraseña
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visor de documento (in-app) */}
      <Dialog open={!!viewer} onOpenChange={(o) => { if (!o) setViewer(null); }}>
        <DialogContent className="max-w-4xl w-[92vw] h-[85vh] p-0 gap-0 bg-white flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-[#ECEEF0] px-4 py-3 pr-12">
            <DialogTitle className="truncate text-[14px] font-bold text-[#171A1D]">{viewer?.nombre}</DialogTitle>
          </div>
          {viewer && (
            <iframe
              src={viewer.url}
              title={viewer.nombre}
              className="w-full flex-1 border-0 bg-[#F6F7F8]"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal editar información de Identidad */}
      <Dialog open={identEditOpen} onOpenChange={(o) => { if (!o) setIdentEditOpen(false); }}>
        <DialogContent className="max-w-[520px] w-[92vw] bg-white p-0 gap-0 overflow-hidden">
          <DialogHeader className="border-b border-[#ECEEF0] px-5 py-4">
            <DialogTitle className="text-[16px] font-bold text-[#171A1D]">Editar información</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-3.5">
            {(() => {
              const lbl = "mb-1 block text-[11px] font-semibold text-[#6B7280]";
              const inp = "w-full rounded-md border border-[#ECEEF0] px-3 py-2 text-[13px] font-semibold text-[#171A1D] outline-none focus:ring-2 focus:ring-[hsl(158_64%_38%)]/30";
              return (
                <>
                  <div>
                    <label className={lbl}>Email · solo lectura</label>
                    <input value={personaDatos?.email || agentEmail || ''} disabled className={cn(inp, "bg-[#F6F7F8] text-[#9AA3AD]")} />
                  </div>
                  <div>
                    <label className={lbl}>Nombre completo *</label>
                    <input value={identForm.nombre_legal || ''} onChange={(e) => setIdent('nombre_legal', e.target.value)} placeholder="Nombre y apellidos" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Teléfono *</label>
                    <input inputMode="numeric" value={identForm.telefono || ''} onChange={(e) => setIdent('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10 dígitos" className={cn(inp, "tabular-nums")} />
                  </div>
                  <div>
                    <label className={lbl}>CURP *</label>
                    <input value={identForm.curp || ''} maxLength={18} onChange={(e) => setIdent('curp', e.target.value.toUpperCase())} placeholder="18 caracteres" className={cn(inp, "uppercase tabular-nums")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Fecha de nacimiento</label>
                      <input type="date" value={identForm.fecha_nacimiento || ''} onChange={(e) => setIdent('fecha_nacimiento', e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Sexo</label>
                      <select value={identForm.sexo || ''} onChange={(e) => setIdent('sexo', e.target.value)} className={inp}>
                        <option value="">Sin especificar</option>
                        <option value="M">Hombre</option>
                        <option value="F">Mujer</option>
                        <option value="O">Otro</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Dirección particular</label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input value={identForm.direccion_calle || ''} onChange={(e) => setIdent('direccion_calle', e.target.value)} placeholder="Calle" className={inp} />
                      <input value={identForm.direccion_num_ext || ''} onChange={(e) => setIdent('direccion_num_ext', e.target.value)} placeholder="Número exterior" className={inp} />
                      <input value={identForm.direccion_colonia || ''} onChange={(e) => setIdent('direccion_colonia', e.target.value)} placeholder="Colonia" className={inp} />
                      <input inputMode="numeric" maxLength={5} value={identForm.direccion_codigo_postal || ''} onChange={(e) => setIdent('direccion_codigo_postal', e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="C.P." className={cn(inp, "tabular-nums")} />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#ECEEF0] px-5 py-3.5">
            <button onClick={() => setIdentEditOpen(false)} disabled={savingIdent} className="inline-flex items-center rounded-md border border-[#ECEEF0] px-4 py-2 text-[12.5px] font-semibold text-[#6B7280] hover:bg-[#F6F7F8] disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={saveIdent} disabled={savingIdent} className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(158_64%_38%)] bg-white px-4 py-2 text-[12.5px] font-bold text-[hsl(158_64%_38%)] hover:bg-[#F0FAF4] disabled:opacity-50">
              {savingIdent && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalle de documento */}
      <Dialog open={!!docDetail} onOpenChange={(o) => { if (!o) setDocDetail(null); }}>
        <DialogContent className="max-w-[520px] bg-white p-0 gap-0 overflow-hidden" style={{ '--agent-primary': '147 33% 29%' } as React.CSSProperties}>
          {docDetail && (() => {
            const rows = expedienteDocs.filter((d: any) => docDetail.tipos.includes(d.id_tipo_documento));
            const approved = rows.some((d: any) => d.id_estatus_verificacion === 2);
            const exists = rows.length > 0;
            const estado = approved ? 'validado' : exists ? 'revision' : 'pendiente';
            const badge =
              estado === 'validado'
                ? { label: 'Validado', color: 'text-[hsl(158_64%_38%)]', bg: 'bg-[#E8F5EE]' }
                : estado === 'revision'
                ? { label: 'En revisión', color: 'text-[#B5730A]', bg: 'bg-[#FBEFD9]' }
                : { label: 'Pendiente', color: 'text-[#6B7280]', bg: 'bg-[#EEF0F2]' };
            const isFiscal = docDetail.tipos.includes(6);
            const isIdentity = docDetail.tipos.some((t) => [2, 3, 4].includes(t));
            const domicilioFiscal = [personaDatos?.direccion_fiscal_calle, personaDatos?.direccion_fiscal_colonia, personaDatos?.direccion_fiscal_codigo_postal]
              .filter(Boolean).join(', ');
            const datos = (isFiscal
              ? [
                  { label: 'Nombre', valor: personaDatos?.nombre_legal },
                  { label: 'RFC', valor: personaDatos?.rfc },
                  { label: 'Régimen fiscal', valor: personaDatos?.regimen },
                  { label: 'Uso de CFDI', valor: personaDatos?.uso_cfdi },
                  { label: 'Domicilio fiscal', valor: domicilioFiscal || null },
                ]
              : isIdentity
              ? [{ label: 'Nombre', valor: personaDatos?.nombre_legal }]
              : []
            ).filter((f) => f.valor);
            return (
              <div className="p-[22px]">
                <div className="flex flex-wrap items-start justify-between gap-3 pr-7">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <DialogTitle className="text-[18px] font-bold text-[#171A1D]">{docDetail.nombre}</DialogTitle>
                      <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", badge.bg, badge.color)}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] font-medium text-[#9AA3AD]">{docDetail.emisor} · {docDetail.hint}</p>
                  </div>
                </div>

                {/* Subida por dropzone (solo docs PDF llegan a este modal) */}
                {perfilPerms.canUpdate && (
                  <div className="mt-[18px] border-t border-[#ECEEF0] pt-4">
                    <DocDropzone accept=".pdf" uploading={uploadingDoc} onFile={(f) => uploadDocPdf(f, docDetail.tipos[0])} />
                  </div>
                )}

                {datos.length > 0 && (
                  <div className="mt-[18px] border-t border-[#ECEEF0] pt-4">
                    <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">
                      Datos leídos de este documento
                    </div>
                    {datos.map((f) => (
                      <div key={f.label} className="flex items-center justify-between gap-3.5 border-b border-[#F2F4F5] py-2.5">
                        <span className="text-[12px] font-medium text-[#9AA3AD]">{f.label}</span>
                        <span className="text-right text-[12.5px] font-bold text-[#171A1D]">{f.valor}</span>
                      </div>
                    ))}
                  </div>
                )}

                {datos.length === 0 && (
                  <p className="mt-[18px] border-t border-[#ECEEF0] pt-4 text-[12px] font-medium text-[#9AA3AD]">
                    {exists ? 'Documento cargado. Sin datos leídos por ahora.' : 'Aún no has cargado este documento.'}
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Onboarding Step Dialog */}
      {activeStep && personaId && (
        <AgentOnboardingStepDialog
          step={activeStep}
          personaId={personaId}
          open={!!activeStep}
          onOpenChange={(open) => {
            if (!open) {
              setActiveStep(null);
              queryClient.invalidateQueries({ queryKey: ['agent-expediente-docs', personaId] });
            }
          }}
        />
      )}

      {/* Captura simple con cámara (sin IA) para documentos de identidad */}
      <SimpleCameraCaptureDialog
        open={!!cameraDoc}
        onOpenChange={(open) => {
          if (!open) {
            setCameraDoc(null);
            queryClient.invalidateQueries({ queryKey: ['agent-expediente-docs', personaId] });
          }
        }}
        personaId={personaId}
        titulo={cameraDoc?.titulo ?? 'Documento'}
        steps={cameraDoc?.steps ?? []}
        onUploaded={() => queryClient.invalidateQueries({ queryKey: ['agent-expediente-docs', personaId] })}
      />

      </div>
    </div>
  );
};

export default AgentPerfil;
