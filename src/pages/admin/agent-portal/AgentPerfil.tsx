import { useState, useEffect, useRef, useCallback } from "react";
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
  Camera, Trash2, Upload, ArrowLeft, Eye
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
const EXPEDIENTE_DOCS: { nombre: string; emisor: string; hint: string; tipos: number[]; step: OnboardingStep['id'] }[] = [
  { nombre: 'Constancia de Situación Fiscal', emisor: 'SAT', hint: 'PDF del SAT, no mayor a 3 meses', tipos: [6], step: 'fiscal' },
  { nombre: 'Identificación oficial', emisor: 'INE / Pasaporte', hint: 'Vigente, por ambos lados', tipos: [2, 3, 4], step: 'basic' },
  { nombre: 'Carta de comercialización', emisor: 'SOZU', hint: 'Documento generado y firmado con SOZU', tipos: [48], step: 'basic' },
];

const STEP_TO_VIEW: Record<string, 'identidad' | 'fiscal' | 'bank' | 'training'> = {
  basic: 'identidad',
  fiscal: 'fiscal',
  'bank-accounts': 'bank',
  training: 'training',
};

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
  const { steps, completedCount, totalSteps, percentage, isLoading, missingByStep } = useAgentOnboardingStatus(personaId);
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

  // Edición inline (teléfono, uso CFDI)
  const [phoneVal, setPhoneVal] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingCfdi, setSavingCfdi] = useState(false);
  useEffect(() => { setPhoneVal(personaDatos?.telefono || ''); }, [personaDatos?.telefono]);

  const savePhone = async () => {
    if (!personaId) return;
    setSavingPhone(true);
    try {
      await (supabase as any).from('personas').update({ telefono: phoneVal.trim() || null }).eq('id', personaId);
      queryClient.invalidateQueries({ queryKey: ['agent-perfil-persona-datos', personaId] });
    } finally {
      setSavingPhone(false);
    }
  };

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

  // Desarrollos asignados (para bloque "Asignado por SOZU")
  const { accessibleProjectIds, hasUnrestrictedAccess } = useProjectAccess();
  const { data: misDesarrollos = [] } = useQuery({
    queryKey: ['agent-perfil-desarrollos', hasUnrestrictedAccess ? 'all' : accessibleProjectIds],
    queryFn: async (): Promise<string[]> => {
      let q = (supabase as any)
        .from('proyectos')
        .select('nombre')
        .eq('activo', true)
        .eq('publicar', true)
        .order('nombre');
      if (!hasUnrestrictedAccess) {
        if (accessibleProjectIds.length === 0) return [];
        q = q.in('id', accessibleProjectIds);
      }
      const { data } = await q;
      return (data || []).map((p: any) => p.nombre).filter(Boolean);
    },
    staleTime: 60_000,
  });
  const confettiFiredRef = useRef(false);
  const prevPercentageRef = useRef<number | null>(null);
  const [showTrumpets, setShowTrumpets] = useState(false);

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/perfil');
    track({ page: 'agent_perfil', elementId: 'page_view', elementType: 'page' });
  }, []);

  // Play celebration fanfare - louder, longer, richer
  const playCelebrationSound = useCallback(async () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const master = audioCtx.createGain();
      master.gain.value = 0.55; // Much louder
      master.connect(audioCtx.destination);

      // Brass-like fanfare: two oscillators per note for richness
      const notes = [
        { freq: 523.25, start: 0, dur: 0.20 },
        { freq: 659.25, start: 0.18, dur: 0.20 },
        { freq: 783.99, start: 0.36, dur: 0.22 },
        { freq: 1046.5, start: 0.56, dur: 0.50 },
        { freq: 783.99, start: 1.10, dur: 0.14 },
        { freq: 880.0,  start: 1.24, dur: 0.14 },
        { freq: 1046.5, start: 1.38, dur: 0.18 },
        { freq: 1174.66, start: 1.56, dur: 0.60 },
        { freq: 1318.51, start: 2.20, dur: 0.70 },
      ];

      notes.forEach(({ freq, start, dur }) => {
        // Primary oscillator - sawtooth for brass timbre
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        gain1.gain.setValueAtTime(0, audioCtx.currentTime + start);
        gain1.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + start + 0.025);
        gain1.gain.setValueAtTime(0.15, audioCtx.currentTime + start + 0.06);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + dur);
        osc1.connect(gain1);
        gain1.connect(master);
        osc1.start(audioCtx.currentTime + start);
        osc1.stop(audioCtx.currentTime + start + dur + 0.05);

        // Second oscillator - triangle an octave below for warmth
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 0.5, audioCtx.currentTime + start);
        gain2.gain.setValueAtTime(0, audioCtx.currentTime + start);
        gain2.gain.linearRampToValueAtTime(0.10, audioCtx.currentTime + start + 0.03);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + dur);
        osc2.connect(gain2);
        gain2.connect(master);
        osc2.start(audioCtx.currentTime + start);
        osc2.stop(audioCtx.currentTime + start + dur + 0.05);
      });
    } catch (e) {
      // Audio no soportado/bloqueado
    }
  }, []);

  // Fire confetti + streamers + trumpets when profile reaches 100% FOR THE FIRST TIME EVER
  const celebrationStorageKey = `agent_celebration_fired_${personaId}`;
  useEffect(() => {
    if (!isLoading && percentage === 100 && !confettiFiredRef.current) {
      const alreadyCelebrated = localStorage.getItem(celebrationStorageKey);
      if (!alreadyCelebrated) {
        confettiFiredRef.current = true;
        localStorage.setItem(celebrationStorageKey, 'true');

        // Show trumpet overlay
        setShowTrumpets(true);
        setTimeout(() => setShowTrumpets(false), 3500);

        // Play fanfare
        playCelebrationSound();

        // Confetti burst
        const duration = 3500;
        const end = Date.now() + duration;
        const colors = ['#10b981', '#059669', '#34d399', '#6ee7b7', '#fbbf24', '#f97316', '#ec4899', '#8b5cf6'];

        // Initial big burst
        confetti({ particleCount: 80, spread: 100, origin: { x: 0.5, y: 0.4 }, colors, startVelocity: 45 });

        // Streamers (long thin ribbons) from sides
        const launchStreamers = () => {
          // Left side streamers
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 30,
            origin: { x: 0, y: 0.5 },
            colors,
            shapes: ['square'],
            scalar: 2.2,
            drift: 0.8,
            gravity: 0.6,
            ticks: 300,
          });
          // Right side streamers
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 30,
            origin: { x: 1, y: 0.5 },
            colors,
            shapes: ['square'],
            scalar: 2.2,
            drift: -0.8,
            gravity: 0.6,
            ticks: 300,
          });
        };

        // Continuous confetti + streamers
        const frame = () => {
          confetti({
            particleCount: 4,
            angle: 60,
            spread: 65,
            origin: { x: 0, y: 0.7 },
            colors,
            shapes: ['circle', 'square'],
          });
          confetti({
            particleCount: 4,
            angle: 120,
            spread: 65,
            origin: { x: 1, y: 0.7 },
            colors,
            shapes: ['circle', 'square'],
          });
          launchStreamers();
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      }
    }
  }, [percentage, isLoading, playCelebrationSound, celebrationStorageKey]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--agent-primary))]" />
      </div>
    );
  }

  return (
    <div className="pb-24 relative">
      {/* Trumpet celebration overlay */}
      {showTrumpets && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          {/* Left trumpet */}
          <div className="absolute left-4 top-1/3 animate-fade-in" style={{ animationDuration: '0.4s' }}>
            <div className="text-6xl animate-bounce" style={{ animationDuration: '0.6s' }}>🎺</div>
          </div>
          {/* Right trumpet (mirrored) */}
          <div className="absolute right-4 top-1/3 animate-fade-in" style={{ animationDuration: '0.4s', animationDelay: '0.15s', animationFillMode: 'both' }}>
            <div className="text-6xl animate-bounce scale-x-[-1]" style={{ animationDuration: '0.6s' }}>🎺</div>
          </div>
          {/* Center celebration text */}
          <div className="animate-scale-in flex flex-col items-center gap-2" style={{ animationDuration: '0.5s', animationDelay: '0.3s', animationFillMode: 'both' }}>
            <span className="text-5xl">🎉</span>
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl">
              <p className="text-lg font-bold text-center">¡Perfil completo!</p>
              <p className="text-xs text-emerald-100 text-center">Ya puedes recibir comisiones</p>
            </div>
          </div>
          {/* Bottom trumpets */}
          <div className="absolute left-1/4 bottom-1/3 animate-fade-in" style={{ animationDuration: '0.4s', animationDelay: '0.25s', animationFillMode: 'both' }}>
            <div className="text-4xl animate-bounce" style={{ animationDuration: '0.7s' }}>🎺</div>
          </div>
          <div className="absolute right-1/4 bottom-1/3 animate-fade-in" style={{ animationDuration: '0.4s', animationDelay: '0.35s', animationFillMode: 'both' }}>
            <div className="text-4xl animate-bounce scale-x-[-1]" style={{ animationDuration: '0.7s' }}>🎺</div>
          </div>
        </div>
      )}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-[880px] mx-auto">
      {profileView === 'overview' && (<>
      {/* Profile Card */}
      <div className="rounded-2xl bg-white border border-[#ECEEF0] shadow-[0_1px_3px_rgba(20,30,25,0.04)] p-5 sm:p-[22px] flex flex-wrap items-start gap-5">
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
            <div className="h-[72px] w-[72px] rounded-full bg-[hsl(158_64%_38%)] flex items-center justify-center text-white font-extrabold text-2xl">
              {(displayName || "A")[0]?.toUpperCase()}
            </div>
          )}
          {canEdit && (
            <span className="absolute -right-1 -bottom-1 h-[26px] w-[26px] rounded-full bg-white border border-[#E4E7EA] shadow-[0_1px_4px_rgba(0,0,0,0.12)] flex items-center justify-center text-[#4B5563]">
              <Camera className="h-3.5 w-3.5" />
            </span>
          )}
        </button>

        {/* Info + presentación */}
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[19px] font-extrabold tracking-[-0.3px] text-[#171A1D]">
              {displayName || "Agente"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-[12px] font-semibold text-[#6B7280]">
              {(perfilExtra as any)?.roles?.nombre || profile?.rol_nombre || "Agente Inmobiliario"}
            </span>
            <span
              title="Tu nombre y rol los asigna SOZU; no se editan aquí. Tu foto y presentación sí son editables."
              className="rounded-full bg-[#F2F4F5] px-2 py-[3px] text-[9px] font-semibold tracking-[0.5px] text-[#9AA3AD]"
            >
              NOMBRE Y ROL · SOLO LECTURA
            </span>
          </div>
          {agencyName && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-block h-[7px] w-[7px] rounded-full bg-[hsl(158_64%_38%)] shrink-0" />
              <span className="text-[11px] font-semibold text-[hsl(158_64%_38%)]">{agencyName}</span>
            </div>
          )}

          {/* Presentación editable */}
          {(canEdit || perfilExtra?.frase_perfil) && (
            <div className="mt-3.5 pt-3.5 border-t border-[#F2F4F5]">
              {canEdit ? (
                <>
                  <p className="text-[11.5px] font-semibold text-[#4B5563] leading-relaxed">
                    Así te presentas ante tus clientes. Aparece cuando compartes una propiedad con un prospecto.
                  </p>
                  <textarea
                    value={fraseValue}
                    rows={3}
                    onChange={e => setFraseValue(e.target.value)}
                    onFocus={() => setEditingFrase(true)}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                    }}
                    maxLength={280}
                    placeholder="Escribe tu presentación…"
                    className="mt-2 w-full max-h-[140px] resize-none overflow-y-auto rounded-xl border border-[#ECEEF0] px-3 py-2.5 text-[12.5px] text-[#171A1D] leading-relaxed outline-none focus:ring-2 focus:ring-[hsl(158_64%_38%)]/30"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[10.5px] italic text-[#9AA3AD]">
                      Habla de tu experiencia. Evita promesas de rendimiento o plusvalía.
                    </span>
                    <span className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[10.5px] font-medium tabular-nums text-[#B7BEC5]">{fraseValue.length}/280</span>
                      <button
                        onClick={handleFraseSave}
                        disabled={savingFrase}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(158_64%_38%)] px-3.5 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                      >
                        {savingFrase ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={2.5} />}
                        Guardar
                      </button>
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[12.5px] italic text-[#6B7280] leading-relaxed">"{perfilExtra!.frase_perfil}"</p>
              )}
            </div>
          )}
        </div>

        {/* Panel activación */}
        <div className="w-full sm:w-[220px] shrink-0 sm:border-l sm:border-[#F2F4F5] sm:pl-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Activación</span>
            <span className="text-[18px] font-extrabold tabular-nums text-[hsl(158_64%_38%)]">{percentage}%</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[#EEF0F2] overflow-hidden">
            <div className="h-full rounded-full bg-[hsl(158_64%_38%)] transition-all duration-700" style={{ width: `${percentage}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] font-medium text-[#9AA3AD] leading-snug">
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

      {/* Photo modal - phase 1: options / phase 2: preview & confirm */}
      <Dialog open={showPhotoModal} onOpenChange={(open) => { if (!open) closePhotoModal(); }}>
        <DialogContent
          style={{ '--agent-primary': '147 33% 29%' } as React.CSSProperties}
          className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[360px] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl [&>button]:text-white/80 [&>button:hover]:text-white"
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
                  className="flex items-center gap-3 w-full rounded-xl px-3 sm:px-4 min-h-[52px] text-sm font-medium text-left bg-[hsl(var(--agent-primary))]/10 hover:bg-[hsl(var(--agent-primary))]/15 active:bg-[hsl(var(--agent-primary))]/20 transition-colors cursor-pointer"
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
                    className="flex items-center gap-3 w-full rounded-xl px-3 sm:px-4 min-h-[52px] text-sm font-medium text-left bg-red-50 hover:bg-red-100 active:bg-red-200 transition-colors disabled:opacity-50 cursor-pointer"
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
                  className="mt-0.5 w-full rounded-xl px-4 min-h-[44px] text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors text-center cursor-pointer"
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
                  className="w-full rounded-xl min-h-[52px] text-sm font-semibold bg-[hsl(var(--agent-primary))] hover:opacity-90 active:opacity-80 text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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
                  className="w-full rounded-xl min-h-[44px] text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
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
        <div className="flex items-center gap-3 rounded-xl border border-[#EBCBA6] bg-[#FBE3CE] px-3.5 py-3">
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

      {/* PROGRESO */}
      <div className="rounded-2xl border border-[#ECEEF0] bg-white p-5 shadow-[0_1px_3px_rgba(20,30,25,0.04)]">
        <div className="mb-4 text-[10.5px] font-bold uppercase tracking-[1px] text-[#9AA3AD]">Progreso</div>
        <div className="flex items-start justify-between gap-1">
          {ACTIVATION_BLOCKS.map((block) => {
            const status = getBlockStatus(block.relatedSteps);
            return (
              <button
                key={block.stepId}
                onClick={() => setProfileView(STEP_TO_VIEW[block.stepId])}
                className="flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-[10px] px-0.5 py-1.5 text-center hover:bg-[#F7F9F8]"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[12px] font-bold tabular-nums",
                    status === 'complete'
                      ? "border-[hsl(158_64%_38%)] bg-[hsl(158_64%_38%)] text-white"
                      : status === 'partial'
                      ? "border-[hsl(158_64%_38%)] bg-[#E8F5EE] text-[hsl(158_64%_38%)] shadow-[0_0_0_4px_rgba(22,164,94,0.14)]"
                      : "border-[#E4E7EA] bg-white text-[#9AA3AD]"
                  )}
                >
                  {status === 'complete' ? <Check className="h-4 w-4" strokeWidth={3} /> : ACTIVATION_BLOCKS.indexOf(block) + 1}
                </span>
                <span
                  className={cn(
                    "text-[10.5px] leading-tight",
                    status === 'complete' ? "font-semibold text-[#171A1D]"
                      : status === 'partial' ? "font-extrabold text-[hsl(158_64%_38%)]"
                      : "font-semibold text-[#9AA3AD]"
                  )}
                >
                  {block.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Lo que te falta */}
        {(() => {
          const faltantes = ACTIVATION_BLOCKS
            .filter((b) => getBlockStatus(b.relatedSteps) !== 'complete')
            .map((b) => ({ block: b, item: (missingByStep[b.stepId] || [])[0] }))
            .filter((f) => f.item);
          if (faltantes.length === 0) return null;
          return (
            <div className="mt-[18px] border-t border-[#F2F4F5] pt-4">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">
                Lo que te falta para activarte
              </div>
              <div className="flex flex-col gap-2">
                {faltantes.map((f, i) => (
                  <div
                    key={f.block.stepId}
                    tabIndex={0}
                    onClick={() => setProfileView(STEP_TO_VIEW[f.block.stepId])}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#DCEEE3] bg-[#F0FAF4] px-3.5 py-3"
                  >
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border border-[#CFE9DA] bg-white text-[11px] font-extrabold tabular-nums text-[hsl(158_64%_38%)]">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-[12.5px] font-semibold text-[#16331F]">
                      <strong className="font-extrabold">{f.block.label}</strong> - {f.item}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(158_64%_38%)]" strokeWidth={2} />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* HERO MOTOR · expediente */}
      <div className="flex flex-wrap gap-[22px] rounded-2xl border border-[#CFE9DA] bg-gradient-to-br from-[#F0FAF4] to-[#FBFEFC] p-[22px]">
        <div className="min-w-[240px] flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[1.2px] text-[hsl(158_64%_38%)]">
            Tu expediente · el motor de tu activación
          </div>
          <div className="mt-2 text-[21px] font-extrabold leading-[1.25] tracking-[-0.4px] text-[#16331F]">
            Tu información se construye desde tus documentos.
          </div>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#3F5A4A]">
            Cada documento que subes alimenta tu información personal y fiscal. Solo validas lo que ya dijeron.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => setProfileView('expediente')}
              className="inline-flex items-center gap-2 rounded-[11px] bg-[hsl(158_64%_38%)] px-[18px] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <FileText className="h-4 w-4" />
              Gestionar documentos
            </button>
            <span className="text-[12px] font-semibold tabular-nums text-[#3F5A4A]">
              {completedCount} de {totalSteps} etapas completadas
            </span>
          </div>
        </div>
        <div className="w-[210px] shrink-0 rounded-[13px] border border-[#DCEEE3] bg-white p-[15px]">
          <div className="mb-3 text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Estado de etapas</div>
          <div className="flex flex-col gap-[11px]">
            {[
              { n: ACTIVATION_BLOCKS.filter((b) => getBlockStatus(b.relatedSteps) === 'complete').length, label: 'validadas', bg: 'bg-[#E8F5EE]', color: 'text-[hsl(158_64%_38%)]' },
              { n: ACTIVATION_BLOCKS.filter((b) => getBlockStatus(b.relatedSteps) === 'partial').length, label: 'en proceso', bg: 'bg-[#FBEFD9]', color: 'text-[#B5730A]' },
              { n: ACTIVATION_BLOCKS.filter((b) => getBlockStatus(b.relatedSteps) === 'pending').length, label: 'pendientes', bg: 'bg-[#EEF0F2]', color: 'text-[#6B7280]' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2.5">
                <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] text-[11px] font-extrabold tabular-nums", c.bg, c.color)}>
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
          {ACTIVATION_BLOCKS.map((block) => {
            const status = getBlockStatus(block.relatedSteps);
            const badge =
              status === 'complete'
                ? { label: 'Completado', color: 'text-[hsl(158_64%_38%)]', bg: 'bg-[#E8F5EE]' }
                : status === 'partial'
                ? { label: 'En proceso', color: 'text-[#B5730A]', bg: 'bg-[#FBEFD9]' }
                : { label: 'Pendiente', color: 'text-[#6B7280]', bg: 'bg-[#F2F4F5]' };
            return (
              <button
                key={block.stepId}
                onClick={() => {
                  track({ page: 'agent_perfil', elementId: 'btn_etapa_onboarding', elementLabel: block.label, metadata: { step_id: block.stepId } });
                  setProfileView(STEP_TO_VIEW[block.stepId]);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-[#ECEEF0] bg-white px-4 py-[15px] text-left transition-shadow hover:shadow-[0_4px_14px_rgba(20,30,25,0.06)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[13.5px] font-bold text-[#171A1D]">{block.label}</span>
                    <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", badge.bg, badge.color)}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] font-medium text-[#9AA3AD]">{block.description}</p>
                  {block.stepId === 'training' && sortedTrainingAppointments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {sortedTrainingAppointments.map((cita) => {
                        const trainingStatus = getTrainingAppointmentStatus(cita);
                        return (
                          <div key={cita.id} className="rounded-lg border border-[#ECEEF0] bg-[#FAFBFB] px-2.5 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[#171A1D]">{cita.display_name}</p>
                                <p className="text-[11px] text-[#9AA3AD]">
                                  {new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {cita.hora_inicio ? ` · ${cita.hora_inicio.slice(0, 5)}` : ''}
                                </p>
                              </div>
                              <Badge
                                variant={trainingStatus.tone === 'danger' ? 'destructive' : 'outline'}
                                className={cn(
                                  "shrink-0 border-0 text-[10px]",
                                  trainingStatus.tone === 'success' && "bg-emerald-500 text-white",
                                  trainingStatus.tone === 'warning' && "bg-amber-500 text-white",
                                  trainingStatus.tone === 'info' && "bg-blue-500 text-white",
                                  trainingStatus.tone === 'neutral' && "bg-gray-400 text-white",
                                )}
                              >
                                {trainingStatus.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#9AA3AD]" strokeWidth={2} />
              </button>
            );
          })}

          {/* Seguridad */}
          {canEdit && (
            <button
              onClick={() => setSecurityOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-[#ECEEF0] bg-white px-4 py-[15px] text-left transition-shadow hover:shadow-[0_4px_14px_rgba(20,30,25,0.06)]"
            >
              <div className="min-w-0 flex-1">
                <span className="text-[13.5px] font-bold text-[#171A1D]">Seguridad</span>
                <p className="mt-1 text-[11.5px] font-medium text-[#9AA3AD]">Acceso y contraseña</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#9AA3AD]" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* ASIGNADO POR SOZU · SOLO LECTURA */}
      <div className="rounded-2xl border border-dashed border-[#D6DBDF] bg-[#FAFBFB] p-5">
        <div className="mb-3.5 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9AA3AD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <span className="text-[10.5px] font-bold uppercase tracking-[1px] text-[#9AA3AD]">Asignado por SOZU · Solo lectura</span>
        </div>
        <div className="grid grid-cols-1 gap-x-7 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 border-b border-[#ECEEF0] py-[11px]">
            <span className="text-[12px] font-medium text-[#9AA3AD]">Rol / Puesto</span>
            <span className="text-right text-[12.5px] font-bold text-[#171A1D]">
              {(perfilExtra as any)?.roles?.nombre || profile?.rol_nombre || 'Agente Inmobiliario'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-[#ECEEF0] py-[11px]">
            <span className="text-[12px] font-medium text-[#9AA3AD]">Estatus</span>
            <span className="inline-flex items-center gap-1.5 text-right text-[12.5px] font-bold text-[#171A1D]">
              <span className="h-[7px] w-[7px] rounded-full bg-[hsl(158_64%_38%)]" />
              Activo
            </span>
          </div>
        </div>
        {misDesarrollos.length > 0 && (
          <div className="pt-3.5">
            <div className="mb-2 text-[12px] font-medium text-[#9AA3AD]">Desarrollos asignados</div>
            <div className="flex flex-wrap gap-1.5">
              {misDesarrollos.map((d) => (
                <span key={d} className="rounded-full border border-[#E4E7EA] bg-white px-3 py-[5px] text-[11.5px] font-bold text-[#4B5563]">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      </>)}

      {/* ===== VISTA: EXPEDIENTE ===== */}
      {profileView === 'expediente' && (
        <div>
          <div
            tabIndex={0}
            onClick={() => setProfileView('overview')}
            className="mb-3.5 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#6B7280]"
          >
            <ArrowLeft className="h-4 w-4" />
            Perfil
          </div>
          <h2 className="text-[23px] font-extrabold tracking-[-0.4px] text-[#171A1D]">Expediente</h2>
          <p className="mt-1.5 max-w-[560px] text-[13px] font-medium leading-relaxed text-[#6B7280]">
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
                  tabIndex={0}
                  onClick={() => setDocDetail(doc)}
                  className="flex cursor-pointer items-center gap-3.5 rounded-[13px] border border-[#ECEEF0] bg-white px-4 py-[15px] transition-shadow hover:shadow-[0_4px_14px_rgba(20,30,25,0.06)]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F2F4F5] text-[12px] font-extrabold tabular-nums text-[#6B7280]">
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
                        title="Subir"
                        onClick={(e) => { e.stopPropagation(); setActiveStep(doc.step); }}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#ECEEF0] bg-white text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      title={url ? "Ver documento" : "Sin documento"}
                      disabled={!url}
                      onClick={(e) => { e.stopPropagation(); if (url) setViewer({ url, nombre: doc.nombre }); }}
                      className={cn(
                        "flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#ECEEF0] transition-colors",
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
      )}

      {/* ===== VISTA: IDENTIDAD ===== */}
      {profileView === 'identidad' && (() => {
        const fmtFecha = (f?: string | null) => {
          if (!f) return null;
          const [y, m, d] = f.slice(0, 10).split('-');
          return d && m && y ? `${d}/${m}/${y}` : f;
        };
        const sexoLabel = personaDatos?.sexo === 'H' || personaDatos?.sexo === 'M'
          ? (personaDatos.sexo === 'H' ? 'Hombre' : 'Mujer')
          : personaDatos?.sexo || null;
        const domParticular = [personaDatos?.direccion_calle, personaDatos?.direccion_num_ext, personaDatos?.direccion_colonia, personaDatos?.direccion_codigo_postal]
          .filter(Boolean).join(', ');
        const derivados = [
          { label: 'Nombre completo', valor: personaDatos?.nombre_legal, fuente: 'Constancia fiscal' },
          { label: 'CURP', valor: personaDatos?.curp, fuente: 'CURP / Acta de nacimiento' },
          { label: 'Fecha de nacimiento', valor: fmtFecha(personaDatos?.fecha_nacimiento), fuente: 'Acta de nacimiento' },
          { label: 'Sexo', valor: sexoLabel, fuente: 'Acta de nacimiento' },
          { label: 'Dirección particular', valor: domParticular || null, fuente: 'Comprobante de domicilio' },
        ];
        return (
          <div>
            <div tabIndex={0} onClick={() => setProfileView('overview')} className="mb-3.5 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#6B7280]">
              <ArrowLeft className="h-4 w-4" />Perfil
            </div>
            <h2 className="text-[23px] font-extrabold tracking-[-0.4px] text-[#171A1D]">Identidad</h2>
            <p className="mt-1 text-[12.5px] font-medium text-[#9AA3AD]">Tu información personal</p>
            <div className="mt-2.5 mb-4 flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(158_64%_38%)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Sesión segura activa
            </div>

            {/* Contacto */}
            <div className="mb-3 rounded-2xl border border-[#ECEEF0] bg-white p-5">
              <div className="mb-3.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Contacto</div>
              <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F5] py-2.5">
                <span className="text-[12px] font-medium text-[#9AA3AD]">Email (tu acceso)</span>
                <span className="text-right text-[12.5px] font-bold text-[#171A1D]">{personaDatos?.email || agentEmail}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-3">
                <span className="text-[12px] font-medium text-[#9AA3AD]">Teléfono <span className="text-[#B5601C]">· captura manual</span></span>
                <input
                  inputMode="numeric"
                  placeholder="10 dígitos"
                  value={phoneVal}
                  disabled={!perfilPerms.canUpdate || savingPhone}
                  onChange={(e) => setPhoneVal(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onBlur={() => { if (phoneVal !== (personaDatos?.telefono || '')) savePhone(); }}
                  className="w-[170px] rounded-[9px] border border-[#ECEEF0] px-3 py-2 text-right text-[13px] font-semibold tabular-nums text-[#171A1D] outline-none focus:ring-2 focus:ring-[hsl(158_64%_38%)]/30 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Datos derivados */}
            <div className="rounded-2xl border border-[#ECEEF0] bg-white p-5">
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Datos derivados de tus documentos</div>
              {derivados.map((f) => (
                <div key={f.label} className="flex items-start justify-between gap-3.5 border-b border-[#F2F4F5] py-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-[#9AA3AD]">{f.label}</div>
                    <div className="mt-0.5 text-[10.5px] text-[#B7BEC5]">Tomado de: {f.fuente}</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2.5 text-right">
                    {f.valor
                      ? <span className="text-[12.5px] font-bold text-[#171A1D]">{f.valor}</span>
                      : <span className="text-[12.5px] font-medium italic text-[#9AA3AD]">Sin registro</span>}
                    <span className={cn("rounded-full px-2 py-[3px] text-[9px] font-bold", f.valor ? "bg-[#E8F5EE] text-[hsl(158_64%_38%)]" : "bg-[#EEF0F2] text-[#6B7280]")}>
                      {f.valor ? 'Validado' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ))}
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
            <div tabIndex={0} onClick={() => setProfileView('overview')} className="mb-3.5 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#6B7280]">
              <ArrowLeft className="h-4 w-4" />Perfil
            </div>
            <h2 className="mb-4 text-[23px] font-extrabold tracking-[-0.4px] text-[#171A1D]">Información fiscal</h2>

            {/* Uso CFDI */}
            <div className="mb-3 rounded-2xl border border-[#ECEEF0] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5">
                <div>
                  <div className="text-[12px] font-medium text-[#9AA3AD]">Uso del CFDI <span className="text-[#B5601C]">· tu selección (catálogo SAT)</span></div>
                  {!personaDatos?.uso_cfdi && <div className="mt-0.5 text-[11px] font-bold text-[#B5730A]">Elige tu Uso de CFDI</div>}
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

            {/* Datos derivados */}
            <div className="rounded-2xl border border-[#ECEEF0] bg-white p-5">
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#9AA3AD]">Datos derivados de tus documentos</div>
              {derivados.map((f) => (
                <div key={f.label} className="flex items-start justify-between gap-3.5 border-b border-[#F2F4F5] py-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-[#9AA3AD]">{f.label}</div>
                    <div className="mt-0.5 text-[10.5px] text-[#B7BEC5]">Tomado de: Constancia fiscal</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2.5 text-right">
                    {f.valor
                      ? <span className="text-[12.5px] font-bold text-[#171A1D]">{f.valor}</span>
                      : <span className="text-[12.5px] font-medium italic text-[#9AA3AD]">Sin registro</span>}
                    <span className={cn("rounded-full px-2 py-[3px] text-[9px] font-bold", f.valor ? "bg-[#E8F5EE] text-[hsl(158_64%_38%)]" : "bg-[#EEF0F2] text-[#6B7280]")}>
                      {f.valor ? 'Validado' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ===== VISTA: CUENTA DE DISPERSIÓN ===== */}
      {profileView === 'bank' && (
        <div>
          <div tabIndex={0} onClick={() => setProfileView('overview')} className="mb-3.5 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#6B7280]">
            <ArrowLeft className="h-4 w-4" />Perfil
          </div>
          <h2 className="text-[23px] font-extrabold tracking-[-0.4px] text-[#171A1D]">Cuenta de dispersión de comisiones</h2>
          <p className="mt-1.5 max-w-[560px] text-[13px] font-medium leading-relaxed text-[#6B7280]">
            Es a donde SOZU te paga tus comisiones. Por seguridad, validamos que cada cuenta sea tuya antes de activarla.
          </p>
          <div className="mt-3.5 flex items-start gap-3 rounded-xl border border-[#C9DCF2] bg-[#EAF2FB] px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2A6FDB" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            <div className="text-[12px] font-medium leading-relaxed text-[#2A557F]">
              Por tu seguridad, una cuenta nueva queda <strong>pendiente de activación</strong> hasta que validemos que es tuya.
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {bankAccounts.length === 0 && (
              <div className="rounded-[13px] border border-dashed border-[#D6DBDF] bg-[#FAFBFB] px-4 py-8 text-center text-[12.5px] font-medium text-[#9AA3AD]">
                Aún no tienes cuentas registradas.
              </div>
            )}
            {bankAccounts.map((c: any) => {
              const validada = c.id_estatus_verificacion === 2;
              const last4 = (c.cuenta_clabe || '').slice(-4);
              return (
                <div key={c.id} className="rounded-[13px] border border-[#ECEEF0] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[14px] font-extrabold text-[#171A1D]">{c.banco?.nombre || 'Banco'}</span>
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
                        className="rounded-lg border border-[#F0C9C4] bg-white px-3 py-2 text-[11.5px] font-bold text-[#B84A3C] transition-colors hover:bg-[#FBE6E6]"
                      >
                        Dar de baja
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {perfilPerms.canUpdate && (
            <button
              onClick={() => setActiveStep('bank-accounts')}
              className="mt-3.5 inline-flex items-center gap-2 rounded-[11px] bg-[hsl(158_64%_38%)] px-[17px] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
              Agregar cuenta
            </button>
          )}
        </div>
      )}

      {/* ===== VISTA: CAPACITACIÓN ===== */}
      {profileView === 'training' && (() => {
        const tStatus = getBlockStatus(['training']);
        const pct = tStatus === 'complete' ? 100 : tStatus === 'partial' ? 50 : 0;
        return (
          <div>
            <div tabIndex={0} onClick={() => setProfileView('overview')} className="mb-3.5 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#6B7280]">
              <ArrowLeft className="h-4 w-4" />Perfil
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[23px] font-extrabold tracking-[-0.4px] text-[#171A1D]">Capacitación</h2>
              <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", tStatus === 'complete' ? "bg-[#E8F5EE] text-[hsl(158_64%_38%)]" : "bg-[#FBEFD9] text-[#B5730A]")}>
                {tStatus === 'complete' ? 'Completada' : 'En curso'}
              </span>
            </div>
            <div className="mt-3.5 rounded-2xl border border-[#ECEEF0] bg-white px-[18px] py-[17px]">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-semibold text-[#6B7280]">Avance de tu capacitación</span>
                <span className="text-[14px] font-extrabold tabular-nums text-[hsl(158_64%_38%)]">{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF0F2]">
                <div className="h-full rounded-full bg-[hsl(158_64%_38%)]" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="mt-3.5 flex flex-col gap-2.5">
              {sortedTrainingAppointments.length === 0 && (
                <div className="rounded-[13px] border border-dashed border-[#D6DBDF] bg-[#FAFBFB] px-4 py-8 text-center text-[12.5px] font-medium text-[#9AA3AD]">
                  Aún no tienes capacitaciones agendadas.
                </div>
              )}
              {sortedTrainingAppointments.map((cita) => {
                const st = getTrainingAppointmentStatus(cita);
                return (
                  <div key={cita.id} className="flex items-center gap-3.5 rounded-[13px] border border-[#ECEEF0] bg-white px-4 py-[15px]">
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

            {perfilPerms.canUpdate && (
              <button
                onClick={() => setActiveStep('training')}
                className="mt-3.5 inline-flex items-center gap-2 rounded-[11px] bg-[hsl(158_64%_38%)] px-[17px] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                Agendar capacitación
              </button>
            )}
          </div>
        );
      })()}

      {/* Modal cambiar contraseña */}
      <Dialog open={securityOpen} onOpenChange={(o) => { if (!o) { setSecurityOpen(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); } }}>
        <DialogContent className="max-w-[400px] bg-white p-[26px]">
          <DialogTitle className="text-[17px] font-extrabold text-[#171A1D]">Cambiar contraseña</DialogTitle>
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
                  className="w-full rounded-[10px] border border-[#ECEEF0] px-3 py-2.5 text-[13px] font-semibold text-[#171A1D] outline-none focus:ring-2 focus:ring-[hsl(158_64%_38%)]/30"
                />
              </div>
            ))}
          </div>
          <div className="mt-[18px] flex gap-2.5">
            <button
              onClick={() => setSecurityOpen(false)}
              className="shrink-0 rounded-[10px] border border-[#E4E7EA] bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#4B5563]"
            >
              Cancelar
            </button>
            <button
              onClick={changePassword}
              disabled={savingPw || !pwCurrent || !pwNew || !pwConfirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[hsl(158_64%_38%)] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
                      <DialogTitle className="text-[18px] font-extrabold text-[#171A1D]">{docDetail.nombre}</DialogTitle>
                      <span className={cn("rounded-full px-2.5 py-[3px] text-[9.5px] font-bold", badge.bg, badge.color)}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] font-medium text-[#9AA3AD]">{docDetail.emisor} · {docDetail.hint}</p>
                  </div>
                  {perfilPerms.canUpdate && (
                    <button
                      onClick={() => { setDocDetail(null); setActiveStep(docDetail.step); }}
                      className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-[hsl(158_64%_38%)] px-[15px] py-2.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
                    >
                      <Upload className="h-[15px] w-[15px]" />
                      Subir documento
                    </button>
                  )}
                </div>

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

      </div>
    </div>
  );
};

export default AgentPerfil;
