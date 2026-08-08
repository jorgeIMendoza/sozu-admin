import { Skeleton } from "@/components/ui/skeleton";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { AgentOnboardingStepDialog } from "@/components/admin/AgentOnboardingStepDialog";
import { ExpedienteDocsPanel, type ExpDocDef } from "@/components/admin/expediente/ExpedienteDocsPanel";
import { ProfileSectionRow } from "@/components/admin/perfil/ProfileSectionRow";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FIELD_LABEL_CLS, MODAL_BODY_CLS, MODAL_FOOTER_CLS, ModalForm, ModalFormHeader, Req } from "@/components/ui/modal-form";
import { OptImg } from "@/components/ui/opt-img";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useExpedienteDocs } from "@/hooks/useExpedienteDocs";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useAgentOnboardingStatus, type OnboardingStep } from "@/hooks/useAgentOnboardingStatus";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useAgentPortalFullAccess } from "@/hooks/useAgentPortalFullAccess";
import { useAgentViewRestrictions } from "@/hooks/useAgentViewRestrictions";
import { getTrainingAppointmentStatus, useAgentTrainingAppointments } from "@/hooks/useAgentTrainingAppointments";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAvatarUrl } from "@/lib/avatarUrl";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { AlertTriangle, ArrowLeft, CalendarDays, Camera, Check, Eye, EyeOff, FileText, GraduationCap, HelpCircle, Landmark, Loader2, Lock, Pencil, Plus, Receipt, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { mensajeErrorPassword } from "@/lib/erroresPassword";

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

// Etapas que el agente dependiente (ligado a una inmobiliaria) ve pero no edita: su
// inmobiliaria lleva el RFC y la dispersión, y las captura desde su propio portal.
const BLOQUES_SOLO_LECTURA_DEPENDIENTE: readonly string[] = ['fiscal', 'bank-accounts'];

/**
 * Aviso de "esto lo administra tu inmobiliaria" + botón de ayuda que abre el detalle al
 * hacer clic (no solo al pasar el cursor: en móvil el hover no existe).
 */
function AvisoSoloLectura({ mensaje }: { mensaje: string }) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-md border border-border bg-muted px-4 py-3">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 text-xs font-medium leading-relaxed text-muted-foreground">
        Esta información la administra tu inmobiliaria, por eso no se puede editar aquí.
      </div>
      <Popover>
        <PopoverTrigger
          aria-label="¿Por qué no puedo editar?"
          className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 text-xs font-medium leading-relaxed">
          {mensaje}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Documentos del expediente del agente (tipos reales en `documentos`), definidos con
// el contrato global de ExpedienteDocsPanel. La identidad es UN solo documento: INE
// (frente+reverso, tipos 2+3) O pasaporte (tipo 4) — el panel resuelve el selector y
// la captura por cámara.
const IDENTIDAD_DOC: ExpDocDef = { key: 'identidad', kind: 'identity' };
const CSF_DOC: ExpDocDef = { key: 'csf', nombre: 'Constancia de Situación Fiscal', emisor: 'SAT', hint: 'PDF del SAT, no mayor a 3 meses. El original se valida al instante; un escaneo queda pendiente', tipos: [6], kind: 'pdf', csf: true };
const CARTA_DOC: ExpDocDef = { key: 'carta', nombre: 'Carta de comercialización', emisor: 'SOZU', hint: 'Se genera y firma digitalmente con SOZU', tipos: [48], kind: 'firma' };
// Tipos que consulta el expediente del agente (fijos: la carta se oculta para los
// dependientes pero su estatus sigue alimentando "Documentos" en Secciones).
const AGENT_EXP_TIPOS = [2, 3, 4, 6, 48, 63];

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
  cuenta: 'Datos de tu cuenta',
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

/** Valor centinela de "vacío" en los selects (se traduce a "" al guardar). */
const SIN_ESPECIFICAR = "__none__";

const SEXO_OPTIONS: SearchableOption[] = [
  { value: SIN_ESPECIFICAR, label: "Sin especificar" },
  { value: "M", label: "Hombre" },
  { value: "F", label: "Mujer" },
  { value: "O", label: "Otro" },
];

const AgentPerfil = () => {
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { impersonatedAgentPersonaId, impersonatedAgentName, impersonatedAgentEmail, isImpersonating } = useAgentImpersonation();
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const fullAccess = useAgentPortalFullAccess();
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const displayName = isImpersonating ? impersonatedAgentName : profile?.nombre;
  const agentEmail = isImpersonating ? impersonatedAgentEmail : (user?.email || profile?.email);
  const loggedInEmail = user?.email || profile?.email;
  // Foto y frase: las edita el dueño de la cuenta y, en soporte, quien lo
  // impersona con "Vista completa" (para resolver en el momento cuando el
  // usuario no puede o no quiere hacerlo). En "Vista fiel" `fullAccess` es
  // false, así que el bloqueo vuelve y se ve el portal como lo ve él.
  const canEdit =
    (!!loggedInEmail && !!agentEmail && loggedInEmail === agentEmail) ||
    (isImpersonating && fullAccess);
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

  const [activeStep, setActiveStep] = useState<OnboardingStep['id'] | null>(null);
  // Cuenta bancaria: 'create' abre el alta en blanco; 'edit' carga la cuenta tocada.
  const [bankTarget, setBankTarget] = useState<{ mode: 'create' | 'edit'; id: number | null }>({ mode: 'create', id: null });
  // Pestaña inicial del modal de paso (p. ej. 'address' para ir directo a firmar la carta).
  const [activeStepTab, setActiveStepTab] = useState<string | undefined>(undefined);
  const [profileView, setProfileView] = useState<'overview' | 'expediente' | 'identidad' | 'fiscal' | 'bank' | 'training' | 'cuenta'>('overview');
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
      // Auth rechaza con 422 por causas que el formulario no puede anticipar
      // (tecleó la contraseña que ya tenía, o la política del proyecto la
      // considera débil). Tragarlas dejaba al agente reintentando lo mismo.
      if (error) { toast.error(mensajeErrorPassword(error)); return; }
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
  const usoCfdiOptions = useMemo<SearchableOption[]>(
    () => usoCfdiCatalog.map((u: any) => ({ value: u.codigo, label: `${u.codigo} · ${u.nombre}`, keywords: u.codigo })),
    [usoCfdiCatalog]
  );

  // Catálogo de régimen fiscal: la vista de lectura mostraba la clave cruda ("626").
  const { data: regimenes = [] } = useQuery({
    queryKey: ['regimen', 'pf'],
    queryFn: async (): Promise<any[]> => {
      const { data } = await (supabase as any)
        .from('regimen')
        .select('id, nombre')
        .eq('activo', true)
        .order('id');
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

  // Documentos del expediente (tipos de agente). Misma queryKey que consume el panel
  // global, para que subir/reemplazar refresque también los estatus de "Secciones".
  const expedienteDocsQueryKey = useMemo(() => ['agent-expediente-docs', personaId], [personaId]);
  const { docs: expedienteDocs } = useExpedienteDocs({
    personaId,
    tipos: AGENT_EXP_TIPOS,
    queryKey: expedienteDocsQueryKey,
  });

  // Nombre de la inmobiliaria dueña del agente, para decirle a quién contactar.
  const { data: inmobiliariaNombre } = useQuery({
    queryKey: ['agent-perfil-inmo-nombre', personaId],
    queryFn: async (): Promise<string | null> => {
      if (!personaId) return null;
      const { data: rel } = await supabase
        .from('entidades_relacionadas')
        .select('id_persona_duena_lead')
        .eq('id_persona', personaId)
        .eq('id_tipo_entidad', 19)
        .eq('activo', true)
        .not('id_persona_duena_lead', 'is', null)
        .limit(1)
        .maybeSingle();
      const duenaId = (rel as any)?.id_persona_duena_lead;
      if (!duenaId) return null;
      const { data: persona } = await supabase
        .from('personas')
        .select('nombre_legal')
        .eq('id', duenaId)
        .maybeSingle();
      return (persona as any)?.nombre_legal || null;
    },
    // La query ya filtra por `id_persona_duena_lead not null`, así que para el
    // agente independiente devuelve null sin necesidad de saberlo de antemano.
    enabled: !!personaId,
    staleTime: 60_000,
  });

  // Qué se recorta al agente dependiente lo decide la regla `agente-dependiente`
  // (ver `lib/impersonation/rules/`), no esta página. Aquí solo se consulta.
  const { hasInmobiliaria, readOnlyNote: viewNote } = useAgentViewRestrictions({ inmobiliariaNombre });
  const esIndependiente = !hasInmobiliaria;
  // La Carta de comercialización (tipo 48) solo aplica al agente independiente;
  // el Super Admin y los roles de soporte la ven igual (`fullAccess` en la regla).
  const puedeVerCarta = !viewNote('carta');
  // Información fiscal, Cuenta bancaria y CSF del dependiente las captura y corrige
  // su inmobiliaria: el agente las ve para confirmar que están bien, pero nunca las
  // edita. El backend lo valida aparte (RLS + trigger).
  const fiscalSoloLectura = !!viewNote('fiscal');

  // Aviso de solo lectura: se repite en Información fiscal y en Cuenta bancaria.
  const avisoInmobiliaria = inmobiliariaNombre
    ? `Contacta a ${inmobiliariaNombre} para corregir esta información.`
    : 'Contacta a tu inmobiliaria para corregir esta información.';

  // Estatus agregado de Documentos (para la fila "Documentos" en Secciones).
  // Identidad = INE (frente+reverso) O pasaporte — no se exigen ambos.
  const docsStatus = (() => {
    const state = (tipos: number[]) => {
      const rows = expedienteDocs.filter((x: any) => tipos.includes(x.id_tipo_documento));
      if (rows.some((x: any) => x.id_estatus_verificacion === 2)) return 'validated';
      if (rows.length > 0) return 'uploaded';
      return 'none';
    };
    // 63 = INE completo en un solo PDF (formato vigente). 2+3 = frente y reverso del
    // formato anterior; se siguen aceptando para quien ya los tenía cargados.
    const ineValidated = state([63]) === 'validated'
      || (state([2]) === 'validated' && state([3]) === 'validated');
    const pasValidated = state([4]) === 'validated';
    const identidadValidated = ineValidated || pasValidated;
    const csf = state([6]);
    const carta = state([48]);

    // La carta y la CSF solo se exigen a agentes independientes; el dependiente no
    // firma carta ni sube constancia (su inmobiliaria lo hace por él).
    const cartaOk = !esIndependiente || carta === 'validated';
    const csfOk = !esIndependiente || csf === 'validated';
    const complete = identidadValidated && csfOk && cartaOk;
    if (complete) return 'complete';
    const relevantTipos = esIndependiente ? [2, 3, 4, 6, 48, 63] : [2, 3, 4, 63];
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

  // El dependiente cobra por medio de su inmobiliaria: nunca se le pide completar
  // fiscal/banco, así que tampoco se le muestra el aviso de comisiones.
  const canReceivePayments = fiscalSoloLectura || steps
    .filter(s => BLOQUES_SOLO_LECTURA_DEPENDIENTE.includes(s.id))
    .every(s => s.isComplete);

  // Estatus de las 5 secciones del perfil (Documentos + 4 etapas) → alimenta el hero.
  const sectionStatuses = [docsStatus, ...ACTIVATION_BLOCKS.map((b) => getBlockStatus(b.relatedSteps))];
  const totalSecciones = sectionStatuses.length;
  const seccionesValidadas = sectionStatuses.filter((s) => s === 'complete').length;
  const seccionesEnProceso = sectionStatuses.filter((s) => s === 'partial').length;
  const seccionesPendientes = sectionStatuses.filter((s) => s === 'pending').length;

  // Skeleton con la forma real de la página (hero, progreso y secciones). Un spinner
  // centrado dejaba la pantalla vacía y luego todo saltaba de golpe.
  if (isLoading) {
    return (
      <div>
        <AgentPortalHeader />
        <div className="mx-auto max-w-[1040px] space-y-4 pt-1">
          {/* Hero */}
          <div className="rounded-md border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3.5 w-64" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </div>
            <Skeleton className="mt-5 h-2 w-full rounded-full" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>

          {/* Secciones */}
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-40" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3.5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
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
            {profileView === 'bank' && !fiscalSoloLectura && perfilPerms.canUpdate && (
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
          {/* Datos de tu cuenta: rol, esquema de comisión, equipo y alta. Solo consulta. */}
          {sozuInfo && (
            <ProfileSectionRow
              title="Datos de tu cuenta"
              description="Rol, esquema de comisión, equipo y fecha de alta"
              badge={{ label: 'Solo lectura', color: 'text-muted-foreground', bg: 'bg-muted' }}
              onClick={() => {
                track({ page: 'agent_perfil', elementId: 'btn_seccion_datos_cuenta' });
                setProfileView('cuenta');
              }}
            />
          )}

          {/* Documentos: todos los documentos del portal a subir */}
          <ProfileSectionRow
            title="Documentos"
            description="Sube y consulta todos tus documentos"
            badge={sectionBadge(docsStatus)}
            onClick={() => {
              track({ page: 'agent_perfil', elementId: 'btn_seccion_documentos' });
              setProfileView('expediente');
            }}
          />

          {ACTIVATION_BLOCKS.map((block) => {
            // Fiscal y banco del dependiente: no son un pendiente suyo, son consulta.
            const soloLectura = fiscalSoloLectura && BLOQUES_SOLO_LECTURA_DEPENDIENTE.includes(block.stepId);
            return (
              <ProfileSectionRow
                key={block.stepId}
                title={block.label}
                description={soloLectura ? 'La administra tu inmobiliaria · solo consulta' : block.description}
                badge={soloLectura
                  ? { label: 'Solo lectura', color: 'text-muted-foreground', bg: 'bg-muted' }
                  : sectionBadge(getBlockStatus(block.relatedSteps))}
                onClick={() => {
                  track({ page: 'agent_perfil', elementId: 'btn_etapa_onboarding', elementLabel: block.label, metadata: { step_id: block.stepId } });
                  setProfileView(STEP_TO_VIEW[block.stepId]);
                }}
              />
            );
          })}

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

      {/* ===== VISTA: DATOS DE TU CUENTA (asignado por SOZU · solo lectura) ===== */}
      {profileView === 'cuenta' && sozuInfo && (() => {
        const fmtAlta = (f?: string | null) => {
          if (!f) return null;
          const d = new Date(f);
          return isNaN(d.getTime())
            ? null
            : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
        };
        // Mismo estándar que Identidad e Información fiscal: tarjeta con título, filas
        // etiqueta/valor y divisores. Sin botón Editar: los administra SOZU.
        const campos: { label: string; value: React.ReactNode | null }[] = [
          { label: 'Rol / Puesto', value: (perfilExtra as any)?.roles?.nombre || profile?.rol_nombre || null },
          { label: 'Tipo de relación', value: sozuInfo.tipoRelacion || null },
          { label: 'Esquema de comisión', value: sozuInfo.comision != null ? `${sozuInfo.comision}% sobre precio de lista` : null },
          {
            label: 'Estatus',
            value: (
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('h-[7px] w-[7px] rounded-full', sozuInfo.activo ? 'bg-primary' : 'bg-muted-foreground/40')} />
                {sozuInfo.activo ? 'Activo' : 'Inactivo'}
              </span>
            ),
          },
          { label: 'Equipo / Líder', value: sozuInfo.lider || null },
          { label: 'Fecha de alta', value: fmtAlta(sozuInfo.fechaAlta) },
        ];
        return (
          <div>
            <div className="rounded-md border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Datos de tu cuenta</span>
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
            <p className="mt-3 px-0.5 text-xs font-medium leading-relaxed text-muted-foreground">
              Estos datos los administra SOZU. Si algo no coincide, avísale a tu contacto interno.
            </p>
          </div>
        );
      })()}

      {/* ===== VISTA: EXPEDIENTE ===== */}
      {profileView === 'expediente' && (
        <ExpedienteDocsPanel
          personaId={personaId}
          docs={[
            IDENTIDAD_DOC,
            {
              ...CSF_DOC,
              // El dependiente la ve para saber si ya está cargada, pero no la sube:
              // la administra su inmobiliaria (con nombre cuando se conoce).
              soloLectura: fiscalSoloLectura,
              soloLecturaNota: viewNote('csf') ?? undefined,
            },
            ...(puedeVerCarta ? [CARTA_DOC] : []),
          ]}
          canUpdate={perfilPerms.canUpdate}
          docsQueryKey={expedienteDocsQueryKey}
          queryTipos={AGENT_EXP_TIPOS}
          // La carta se firma dentro del modal Identidad → pestaña Dirección.
          onFirma={() => { setActiveStepTab('address'); setActiveStep('basic'); }}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['agent-onboarding-docs', personaId] });
            queryClient.refetchQueries({ queryKey: ['agent-perfil-persona-datos', personaId] });
          }}
        />
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
            <div className="rounded-md border border-border bg-card p-5">
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
        // La lectura debe reflejar TODO lo que se captura al editar: antes solo salían RFC,
        // régimen (en clave cruda) y el domicilio concatenado, y se veía incompleto.
        const regimenNombre = regimenes.find((r: any) => String(r.id) === String(personaDatos?.regimen))?.nombre;
        const usoNombre = usoCfdiOptions.find((u) => u.value === (personaDatos?.uso_cfdi || ''))?.label;
        const derivados = [
          { label: 'Razón social / Nombre', valor: personaDatos?.nombre_legal },
          { label: 'RFC', valor: personaDatos?.rfc },
          {
            label: 'Régimen fiscal',
            valor: personaDatos?.regimen
              ? (regimenNombre ? `${personaDatos.regimen} · ${regimenNombre}` : String(personaDatos.regimen))
              : null,
          },
          { label: 'Uso del CFDI', valor: usoNombre || personaDatos?.uso_cfdi || null },
          { label: 'Calle y número', valor: personaDatos?.direccion_fiscal_calle },
          { label: 'Colonia', valor: personaDatos?.direccion_fiscal_colonia },
          { label: 'Código postal', valor: personaDatos?.direccion_fiscal_codigo_postal },
        ];
        return (
          <div>
            {fiscalSoloLectura && <AvisoSoloLectura mensaje={avisoInmobiliaria} />}

            {/* Uso CFDI */}
            <div className="mb-3 rounded-md border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5">
                <div>
                  <div className="text-xs font-medium text-muted-foreground/70">Uso del CFDI</div>
                </div>
                <SearchableSelect
                  value={personaDatos?.uso_cfdi || ''}
                  disabled={!perfilPerms.canUpdate || fiscalSoloLectura || savingCfdi}
                  onValueChange={(v) => saveUsoCfdi(v)}
                  options={usoCfdiOptions}
                  placeholder="Selecciona…"
                  itemsLabel="usos"
                  searchPlaceholder="Buscar por código o nombre…"
                  className="w-auto min-w-60"
                  aria-label="Uso del CFDI"
                />
              </div>
              <div className="border-t border-border pt-3 text-xs font-medium leading-relaxed text-muted-foreground">
                {fiscalSoloLectura
                  ? 'Tu inmobiliaria emite los CFDI de comisiones a SOZU con estos datos fiscales.'
                  : 'Como emites CFDI de comisiones a SOZU, tu RFC, régimen y CP fiscal deben coincidir con el SAT (CFDI 4.0).'}
              </div>
            </div>

            {/* Información fiscal (texto + editar) */}
            <div className="mb-3 rounded-md border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Información fiscal</span>
                {perfilPerms.canUpdate && !fiscalSoloLectura && (
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
          {/* Sin aviso fijo: el estado de validación se lee en la pastilla de cada cuenta
              (Pendiente de activación / Activa), que es información real y no un letrero. */}
          {fiscalSoloLectura && <AvisoSoloLectura mensaje={avisoInmobiliaria} />}

          <div className="mt-4 flex flex-col gap-2.5">
            {bankAccounts.length === 0 && (
              <div className="rounded-md border border-dashed border-border bg-muted px-4 py-8 text-center text-xs font-medium text-muted-foreground/70">
                {fiscalSoloLectura
                  ? 'Tu inmobiliaria recibe las comisiones y define cómo te paga: aquí no se registran cuentas.'
                  : 'Aún no tienes cuentas registradas.'}
              </div>
            )}
            {bankAccounts.map((c: any) => {
              const validada = c.id_estatus_verificacion === 2;
              const last4 = (c.cuenta_clabe || c.numero_cuenta || '').slice(-4);
              // El dependiente ve la cuenta (banco, últimos 4 y titular) pero no la edita.
              const editable = perfilPerms.canUpdate && !fiscalSoloLectura;
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
                      <SearchableSelect
                        value={identForm.sexo || SIN_ESPECIFICAR}
                        onValueChange={(v) => setIdent('sexo', v === SIN_ESPECIFICAR ? '' : v)}
                        options={SEXO_OPTIONS}
                        placeholder="Sin especificar"
                        aria-label="Sexo"
                      />
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

      {/* Onboarding Step Dialog */}
      {activeStep && personaId && !(fiscalSoloLectura && BLOQUES_SOLO_LECTURA_DEPENDIENTE.includes(activeStep)) && (
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
