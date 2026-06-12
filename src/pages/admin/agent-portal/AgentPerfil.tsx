import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { APP_VERSION } from "@/lib/config";
import { useAgentOnboardingStatus, type OnboardingStep } from "@/hooks/useAgentOnboardingStatus";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { AgentOnboardingStepDialog } from "@/components/admin/AgentOnboardingStepDialog";
import { Badge } from "@/components/ui/badge";
import { getTrainingAppointmentStatus, useAgentTrainingAppointments } from "@/hooks/useAgentTrainingAppointments";
import {
  FileText, Receipt, Landmark, GraduationCap,
  Check, AlertTriangle, ChevronRight, Loader2, LogOut,
  Camera, Pencil, X, Trash2, Upload
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

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

const AgentPerfil = () => {
  const { profile, signOut, user } = useAuth();
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

  // Extract storage path from public URL — works for both self-hosted and Supabase cloud
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

      await (supabase as any)
        .from('usuarios')
        .update({ foto_perfil_url: cleanUrl })
        .eq('email', agentEmail);
      queryClient.invalidateQueries({ queryKey: ['agent-perfil-extra', agentEmail] });
      closePhotoModal();
    } catch (err) {
      console.error('Error subiendo foto:', err);
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
      await (supabase as any)
        .from('usuarios')
        .update({ foto_perfil_url: null })
        .eq('email', agentEmail);
      queryClient.invalidateQueries({ queryKey: ['agent-perfil-extra', agentEmail] });
      setShowPhotoModal(false);
    } catch (err) {
      console.error('Error eliminando foto:', err);
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleFraseSave = async () => {
    if (!agentEmail) return;
    setSavingFrase(true);
    try {
      await (supabase as any)
        .from('usuarios')
        .update({ frase_perfil: fraseValue.trim() || null })
        .eq('email', agentEmail);
      queryClient.invalidateQueries({ queryKey: ['agent-perfil-extra', agentEmail] });
      setEditingFrase(false);
    } catch (err) {
      console.error('Error guardando frase:', err);
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
  const confettiFiredRef = useRef(false);
  const prevPercentageRef = useRef<number | null>(null);
  const [showTrumpets, setShowTrumpets] = useState(false);

  // Log page view
  useEffect(() => {
    registrarVista('/admin/agent/perfil');
    track({ page: 'agent_perfil', elementId: 'page_view', elementType: 'page' });
  }, []);

  // Play celebration fanfare — louder, longer, richer
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
        // Primary oscillator — sawtooth for brass timbre
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

        // Second oscillator — triangle an octave below for warmth
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
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-2xl mx-auto">
      {/* Profile Card */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <button
            type="button"
            className="relative shrink-0 rounded-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--agent-primary))] focus-visible:ring-offset-2"
            onClick={() => canEdit && setShowPhotoModal(true)}
            disabled={!canEdit}
            title={canEdit ? "Cambiar foto de perfil" : undefined}
            aria-label={canEdit ? "Cambiar foto de perfil" : "Foto de perfil"}
          >
            {perfilExtra?.foto_perfil_url ? (
              <img
                src={perfilExtra.foto_perfil_url}
                alt={displayName || "Avatar"}
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[hsl(var(--agent-primary))] flex items-center justify-center text-white font-bold text-xl">
                {(displayName || "A")[0]?.toUpperCase()}
              </div>
            )}
            {canEdit && (
              <div className="absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
                <Camera className="h-5 w-5 text-white" />
              </div>
            )}
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h1 className="text-lg sm:text-xl font-bold text-[hsl(var(--agent-text))] leading-tight">
              {displayName || "Agente"}
            </h1>
            <p className="text-sm text-[hsl(var(--agent-text-secondary))] mt-0.5">
              {(perfilExtra as any)?.roles?.nombre || profile?.rol_nombre || "Agente Inmobiliario"}
            </p>
            {agencyName && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-medium text-[hsl(var(--agent-text-secondary))]">
                  {agencyName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Frase — visible para todos, editable solo si canEdit */}
        {(canEdit || perfilExtra?.frase_perfil) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {canEdit ? (
              editingFrase ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={fraseValue}
                    onChange={e => setFraseValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleFraseSave();
                      if (e.key === 'Escape') setEditingFrase(false);
                    }}
                    maxLength={250}
                    placeholder="Escribe tu frase profesional…"
                    className="flex-1 min-w-0 text-sm text-[hsl(var(--agent-text-secondary))] bg-transparent border-b border-[hsl(var(--agent-primary))] outline-none py-0.5"
                  />
                  <button
                    onClick={handleFraseSave}
                    disabled={savingFrase}
                    aria-label="Guardar frase"
                    className="shrink-0 h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 flex items-center justify-center transition-colors"
                  >
                    {savingFrase ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </button>
                  <button
                    onClick={() => setEditingFrase(false)}
                    aria-label="Cancelar"
                    className="shrink-0 h-8 w-8 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setFraseValue(perfilExtra?.frase_perfil || ''); setEditingFrase(true); }}
                  className="group/frase flex items-start gap-2 w-full text-left min-h-[32px]"
                  aria-label="Editar frase de perfil"
                >
                  <p className={cn(
                    "flex-1 text-sm italic leading-snug",
                    perfilExtra?.frase_perfil
                      ? "text-[hsl(var(--agent-text-secondary))]"
                      : "text-gray-300"
                  )}>
                    {perfilExtra?.frase_perfil || "Agrega tu frase profesional…"}
                  </p>
                  <Pencil className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-300 group-hover/frase:text-[hsl(var(--agent-primary))] transition-colors" />
                </button>
              )
            ) : (
              <p className="text-sm italic text-[hsl(var(--agent-text-secondary))] leading-snug">
                "{perfilExtra!.frase_perfil}"
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input (outside any button) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Photo modal — phase 1: options / phase 2: preview & confirm */}
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

      {/* Progress Steps */}
      <div className="rounded-xl bg-white p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[hsl(var(--agent-text))]">
            Progreso
          </span>
        </div>
        <div className="flex items-center gap-0">
          {steps.map((step, index) => {
            const block = ACTIVATION_BLOCKS[index];
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <button
                  className="flex flex-col items-center gap-1 cursor-pointer"
                  onClick={() => {
                    if (perfilPerms.canUpdate) {
                      track({ page: 'agent_perfil', elementId: 'btn_etapa_onboarding', elementLabel: block?.label || step.label, metadata: { step_id: step.id } });
                      setActiveStep(step.id);
                    }
                  }}
                  disabled={!perfilPerms.canUpdate}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      step.isComplete
                        ? "bg-emerald-500 text-white"
                        : step.hasPartialData
                        ? "bg-amber-500/70 text-white"
                        : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {step.isComplete ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                  </div>
                  <span className={cn(
                    "text-[9px] font-medium text-center max-w-[64px] leading-tight",
                    step.isComplete
                      ? "text-emerald-600"
                      : step.hasPartialData
                      ? "text-amber-600"
                      : "text-gray-400"
                  )}>
                    {block?.label || step.label}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-[2px] mx-1 mt-[-14px] rounded-full",
                    step.isComplete ? "bg-emerald-400" : "bg-gray-200"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Warning */}
      {isAgentRole && !canReceivePayments && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">No puedes recibir pagos</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Completa tu información fiscal y cuenta bancaria para poder recibir comisiones.
            </p>
          </div>
        </div>
      )}

      {/* Etapas de activación */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-[hsl(var(--agent-text))] px-1">
          Etapas de activación
        </h2>

        <div className="space-y-2">
          {ACTIVATION_BLOCKS.map((block, index) => {
            const status = getBlockStatus(block.relatedSteps);
            const Icon = block.icon;

            return (
              <button
                key={block.stepId}
                onClick={() => {
                  if (perfilPerms.canUpdate) {
                    track({ page: 'agent_perfil', elementId: 'btn_etapa_onboarding', elementLabel: block.label, metadata: { step_id: block.stepId } });
                    setActiveStep(block.stepId);
                  }
                }}
                disabled={!perfilPerms.canUpdate}
                className={cn(
                  "w-full rounded-xl bg-white border p-4 flex items-center gap-3 transition-all active:scale-[0.98]",
                  status === 'complete' 
                    ? "border-emerald-200 shadow-sm" 
                    : "border-gray-100 shadow-sm hover:shadow-md"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                  status === 'complete'
                    ? "bg-emerald-50 text-emerald-600"
                    : status === 'partial'
                    ? "bg-amber-50 text-amber-600"
                    : "bg-gray-50 text-[hsl(var(--agent-text-secondary))]"
                )}>
                  {status === 'complete' ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    status === 'complete' 
                      ? "text-emerald-700" 
                      : "text-[hsl(var(--agent-text))]"
                  )}>
                    {index + 1}. {block.label}
                  </p>
                  <p className="text-xs text-[hsl(var(--agent-text-secondary))] truncate">
                    {block.description}
                  </p>
                  {block.stepId === 'training' && sortedTrainingAppointments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {sortedTrainingAppointments.map((cita) => {
                        const trainingStatus = getTrainingAppointmentStatus(cita);

                        return (
                          <div key={cita.id} className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{cita.display_name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {cita.hora_inicio ? ` · ${cita.hora_inicio.slice(0, 5)}` : ''}
                                </p>
                              </div>
                              <Badge
                                variant={trainingStatus.tone === 'danger' ? 'destructive' : 'outline'}
                                className={cn(
                                  "shrink-0 text-[10px] border-0",
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
                  {status !== 'complete' && (missingByStep[block.stepId] || []).length > 0 && !(block.stepId === 'training' && sortedTrainingAppointments.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(missingByStep[block.stepId] || []).slice(0, 3).map((item, i) => (
                        <span key={i} className="inline-block text-[10px] leading-tight px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          {item}
                        </span>
                      ))}
                      {(missingByStep[block.stepId] || []).length > 3 && (
                        <span className="inline-block text-[10px] leading-tight px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          +{(missingByStep[block.stepId] || []).length - 3} más
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 text-[hsl(var(--agent-muted))] shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Onboarding Step Dialog */}
      {activeStep && personaId && (
        <AgentOnboardingStepDialog
          step={activeStep}
          personaId={personaId}
          open={!!activeStep}
          onOpenChange={(open) => {
            if (!open) setActiveStep(null);
          }}
        />
      )}

      <div className="pt-2 pb-1">
        <button
          onClick={() => {
            track({ page: 'agent_perfil', elementId: 'btn_cerrar_sesion', elementLabel: 'Cerrar sesión' });
            signOut();
          }}
          className="w-full sm:max-w-xs mx-auto rounded-xl border border-destructive/20 bg-destructive/5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>

      {/* Version */}
      <p className="text-center text-[10px] text-[hsl(var(--agent-muted))] pb-4 mt-2">
        {APP_VERSION}
      </p>
      </div>
    </div>
  );
};

export default AgentPerfil;
