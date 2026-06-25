import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, X, Camera, ScanLine, Sun, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStabilityDetection,
  CaptureFlash,
  SelfieCameraOverlay,
  DocCameraOverlay,
  VerificationComparator,
  type VerificationResult,
} from "@/components/admin/DocumentVerification";

type Phase = "prepare" | "countdown" | "capturing" | "result";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId: number;
  clienteEmail: string | null;
  isDesktop: boolean;
}

export function ClienteINECaptureDialog({ open, onOpenChange, personaId, clienteEmail, isDesktop }: Props) {
  const queryClient = useQueryClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureLockRef = useRef(false);
  // Captured blobs stored in memory until selfie validation passes
  const blobRefs = useRef<{ front?: Blob; back?: Blob }>({});

  const [phase, setPhase] = useState<Phase>("prepare");
  const [countdown, setCountdown] = useState(3);
  const [cameraStep, setCameraStep] = useState<"front" | "back" | "selfie">("front");
  const [cameraActive, setCameraActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [mainDocId, setMainDocId] = useState(0);
  const [relatedDocIds, setRelatedDocIds] = useState<number[]>([]);

  const { data: personaData } = useQuery({
    queryKey: ["cliente-persona-for-ine-verification", personaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("personas")
        .select("nombre_legal, curp, fecha_nacimiento, sexo")
        .eq("id", personaId)
        .single();
      return data;
    },
    enabled: phase === "result" && !!personaId,
  });

  const resetState = () => {
    setVerificationResult(null);
    setMainDocId(0);
    setRelatedDocIds([]);
    setCameraStep("front");
    blobRefs.current = {};
    autoCaptureLockRef.current = false;
    setUploading(false);
    setVerifying(false);
  };

  useEffect(() => {
    if (open) {
      resetState();
      setPhase("prepare");
    } else {
      stopCamera();
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Countdown 3-2-1-0 then start camera
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      setPhase("capturing");
      startCamera("front");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  // Re-attach stream when overlay video element remounts after upload spinner
  useEffect(() => {
    if (phase !== "capturing" || uploading || verifying || !cameraActive) return;
    if (!streamRef.current) return;
    const t = setTimeout(() => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    }, 30);
    return () => clearTimeout(t);
  }, [phase, uploading, verifying, cameraActive, cameraStep]);

  const startCamera = async (step: "front" | "back" | "selfie") => {
    setCameraStep(step);
    autoCaptureLockRef.current = false;
    try {
      const facingMode = step === "selfie" ? "user" : "environment";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      } else {
        setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        }, 80);
      }
      setCameraActive(true);
    } catch {
      toast.error("No se pudo acceder a la camara. Verifica los permisos.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  // Upload blob to storage; returns { url, path } or null on error (no DB insert)
  const uploadToStorage = async (typeId: number, file: File): Promise<{ url: string; path: string } | null> => {
    try {
      const path = `personas/${personaId}/doctype${typeId}_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("documentos").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);
      return { url: publicUrl, path };
    } catch (err: any) {
      console.error("uploadToStorage:", err);
      return null;
    }
  };

  // Deactivate old docs preserving the oldest as active+expired, insert new with estatus=2
  const insertDocRecord = async (url: string, typeId: number): Promise<number | null> => {
    try {
      const { data: activeDocs } = await (supabase as any)
        .from("documentos")
        .select("id")
        .eq("id_persona", personaId)
        .eq("id_tipo_documento", typeId)
        .eq("activo", true)
        .order("id", { ascending: true });

      if (activeDocs && activeDocs.length > 0) {
        // Oldest stays active but marked expired (audit reference)
        await (supabase as any)
          .from("documentos")
          .update({ id_estatus_verificacion: 4 })
          .eq("id", activeDocs[0].id);
        // All others → inactive + expired
        const otherIds = activeDocs.slice(1).map((d: any) => d.id);
        if (otherIds.length > 0) {
          await (supabase as any)
            .from("documentos")
            .update({ activo: false, id_estatus_verificacion: 4 })
            .in("id", otherIds);
        }
      }

      const { data: ins, error } = await (supabase as any)
        .from("documentos")
        .insert({ url, id_tipo_documento: typeId, id_persona: personaId, activo: true, id_estatus_verificacion: 2 })
        .select("id")
        .single();
      if (error) throw error;
      return ins.id as number;
    } catch (err: any) {
      console.error("insertDocRecord:", err);
      return null;
    }
  };

  const verifyDocument = async (
    imageUrl: string,
    expectedType: string,
    selfieUrl?: string,
  ): Promise<VerificationResult | null> => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verificar-documento-identidad", {
        body: { imageUrl, expectedType, selfieUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as VerificationResult;
    } catch (err: any) {
      toast.error("Error verificando documento", { duration: 8000, description: err.message });
      return null;
    } finally {
      setVerifying(false);
    }
  };

  // Crop canvas to the guide rectangle of DocCameraOverlay (inset-4 = 16px from each edge)
  const drawCroppedToGuide = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const cW = video.clientWidth;
    const cH = video.clientHeight;
    const vW = video.videoWidth;
    const vH = video.videoHeight;

    if (!vW || !vH || !cW || !cH) {
      canvas.width = vW;
      canvas.height = vH;
      ctx.drawImage(video, 0, 0);
      return;
    }

    // object-cover: scale so both dimensions fill the container
    const scale = Math.max(cW / vW, cH / vH);
    // Offset in native video px cropped from each side by object-cover
    const offsetX = (vW - cW / scale) / 2;
    const offsetY = (vH - cH / scale) / 2;

    const inset = 16; // tailwind inset-4
    const sx = Math.max(0, offsetX + inset / scale);
    const sy = Math.max(0, offsetY + inset / scale);
    const sw = Math.min((cW - 2 * inset) / scale, vW - sx);
    const sh = Math.min((cH - 2 * inset) / scale, vH - sy);

    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  };

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || autoCaptureLockRef.current) return;
    autoCaptureLockRef.current = true;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) { autoCaptureLockRef.current = false; return; }

    // For doc steps: crop to guide rectangle. For selfie: full frame.
    if (cameraStep !== "selfie") {
      drawCroppedToGuide(video, canvas, ctx);
    } else {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
    }

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    canvas.toBlob(async (blob) => {
      try {
        if (!blob) { autoCaptureLockRef.current = false; return; }

        if (cameraStep === "front") {
          // Store blob in memory — no upload yet
          blobRefs.current.front = blob;
          toast.success("INE frente capturado - ahora el reverso", { duration: 3000 });
          setCameraStep("back");
          autoCaptureLockRef.current = false;

        } else if (cameraStep === "back") {
          // Store blob in memory — no upload yet
          blobRefs.current.back = blob;
          toast.success("Reverso capturado - ahora la selfie", { duration: 3000 });
          stopCamera();
          setTimeout(() => startCamera("selfie"), 300);
          autoCaptureLockRef.current = false;

        } else if (cameraStep === "selfie") {
          stopCamera();
          setUploading(true);

          const frontBlob = blobRefs.current.front;
          const backBlob = blobRefs.current.back;

          // Upload all three blobs now that selfie is captured
          const [frontRes, backRes, selfieRes] = await Promise.all([
            frontBlob
              ? uploadToStorage(2, new File([frontBlob], `ine_frente_${Date.now()}.jpg`, { type: "image/jpeg" }))
              : Promise.resolve(null),
            backBlob
              ? uploadToStorage(3, new File([backBlob], `ine_reverso_${Date.now()}.jpg`, { type: "image/jpeg" }))
              : Promise.resolve(null),
            uploadToStorage(49, new File([blob], `selfie_${Date.now()}.jpg`, { type: "image/jpeg" })),
          ]);

          setUploading(false);

          if (!frontRes || !backRes || !selfieRes) {
            toast.error("Error al subir imagenes. Intenta de nuevo.", { duration: 6000 });
            autoCaptureLockRef.current = false;
            return;
          }

          // AI verification with front + selfie for face match
          const aiResult = await verifyDocument(frontRes.url, "ine_frente", selfieRes.url);
          const strongMatch = aiResult?.face_match === true && (aiResult?.face_match_confidence ?? 0) >= 70;

          if (!aiResult || !aiResult.is_valid_document || !strongMatch) {
            // AI failed — delete uploaded storage files, do not insert DB records
            await supabase.storage.from("documentos").remove([frontRes.path, backRes.path, selfieRes.path]);
            blobRefs.current = {};
            autoCaptureLockRef.current = false;

            if (!aiResult) {
              toast.error("No se pudo verificar. Intenta de nuevo.", { duration: 6000 });
            } else if (!aiResult.is_valid_document) {
              toast.error("Documento invalido. Intenta de nuevo.", {
                description: aiResult.rejection_reason ?? undefined,
                duration: 5000,
              });
            } else {
              toast.error("La selfie no coincide con el INE. Intenta de nuevo.", { duration: 5000 });
            }

            setPhase("prepare");
            return;
          }

          // AI passed — insert DB records with estatus=2 (verified), old ones become expired
          const [frontId, backId, selfieId] = await Promise.all([
            insertDocRecord(frontRes.url, 2),
            insertDocRecord(backRes.url, 3),
            insertDocRecord(selfieRes.url, 49),
          ]);

          setMainDocId(backId ?? frontId ?? 0);
          setRelatedDocIds([frontId, backId, selfieId].filter(Boolean) as number[]);
          setVerificationResult(aiResult);
          setPhase("result");
          toast.success("Verificacion completada", { duration: 3000 });
        }
      } catch (err: any) {
        console.error("capturePhoto unexpected error:", err);
        toast.error("Error inesperado. Intenta de nuevo.", { duration: 6000 });
        setUploading(false);
        setVerifying(false);
        autoCaptureLockRef.current = false;
      }
    }, "image/jpeg", 0.85);
  }, [cameraStep]);

  const onStableCapture = useCallback(() => {
    if (!autoCaptureLockRef.current) capturePhoto();
  }, [capturePhoto]);

  const { stabilityProgress, documentDetected, initialDelayDone, alignmentProgress, alignedQuadrants } =
    useStabilityDetection(
      videoRef,
      cameraActive && !uploading && !verifying,
      onStableCapture,
      1500,
      cameraStep !== "selfie",
    );

  const insertNotification = async () => {
    if (!clienteEmail) return;
    try {
      await (supabase as any).from("notificaciones_cliente").insert({
        email_cliente: clienteEmail,
        tipo: "exito",
        categoria: "documentos",
        titulo: "INE verificado exitosamente",
        descripcion: "Tu identificacion oficial (INE) ha sido verificada y aprobada.",
        url_accion: "/perfil",
        etiqueta_accion: "Ver perfil",
        leida: false,
        descartada: false,
        activo: true,
      });
    } catch { /* non-critical */ }
  };

  const handleAccepted = async () => {
    await insertNotification();
    queryClient.refetchQueries({ queryKey: ["cliente-perfil-docs", personaId] });
    queryClient.refetchQueries({ queryKey: ["cliente-perfil-persona", personaId] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    onOpenChange(false);
  };

  const handleRejected = () => {
    resetState();
    setPhase("prepare");
  };

  const handleReady = () => {
    setCountdown(3);
    setPhase("countdown");
  };

  // ── Header ───────────────────────────────────────────────────────────────
  const stepIndex = phase === "result" ? 3 : cameraStep === "front" ? 0 : cameraStep === "back" ? 1 : 2;
  const steps = ["INE Frente", "INE Reverso", "Selfie"];

  const header = (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Camera className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-foreground text-sm">Verificacion de identidad</h3>
        {phase !== "prepare" && (
          <div className="flex items-center gap-1.5 mt-1">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors",
                    i < stepIndex
                      ? "bg-emerald text-white"
                      : i === stepIndex
                      ? "bg-emerald-pale text-emerald"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {s}
                </span>
                {i < steps.length - 1 && <span className="w-2 h-px bg-border" />}
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onOpenChange(false)}
        className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  // ── Preparation screen ───────────────────────────────────────────────────
  const prepareBody = (
    <ScrollArea className="flex-1">
      <div className="px-6 py-8 flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
          <ScanLine className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-bold text-foreground">Prepara tu INE</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Vamos a capturar el frente, reverso y una selfie para verificar tu identidad.
          </p>
        </div>
        <div className="w-full space-y-3">
          {[
            { icon: ScanLine, text: "Ten tu INE a la mano" },
            { icon: Sun,      text: "Busca buena iluminacion, sin reflejos" },
            { icon: User,     text: "La selfie debe mostrar tu rostro claramente" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-muted/60">
              <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-foreground font-medium">{text}</p>
            </div>
          ))}
        </div>
        <Button onClick={handleReady} className="w-full h-12 text-base font-semibold">
          Listo, empezar
        </Button>
      </div>
    </ScrollArea>
  );

  // ── Countdown screen ─────────────────────────────────────────────────────
  const countdownBody = (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-background">
      <p className="text-sm font-medium text-muted-foreground">Preparate...</p>
      <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
        <span className="text-6xl font-black text-foreground tabular-nums">{countdown}</span>
      </div>
      <p className="text-xs text-muted-foreground/60">La camara iniciara automaticamente</p>
    </div>
  );

  // ── Camera capture screen ────────────────────────────────────────────────
  const captureBody = (
    <ScrollArea className="flex-1">
      <div className="px-4 py-4">
        <canvas ref={canvasRef} className="hidden" />
        <CaptureFlash show={showFlash} />
        {uploading || verifying ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground text-center">
              {verifying ? "Verificando con IA..." : "Subiendo imagenes..."}
            </p>
          </div>
        ) : cameraActive ? (
          cameraStep === "selfie" ? (
            <SelfieCameraOverlay
              videoRef={videoRef}
              onCapture={capturePhoto}
              onCancel={() => onOpenChange(false)}
              uploading={false}
              stabilityProgress={stabilityProgress}
              documentDetected={documentDetected}
              initialDelayDone={initialDelayDone}
            />
          ) : (
            <DocCameraOverlay
              videoRef={videoRef}
              cameraStep={cameraStep as "front" | "back"}
              onCapture={capturePhoto}
              onCancel={() => onOpenChange(false)}
              uploading={false}
              stabilityProgress={stabilityProgress}
              documentDetected={documentDetected}
              initialDelayDone={initialDelayDone}
              alignmentProgress={alignmentProgress}
              alignedQuadrants={alignedQuadrants}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Iniciando camara...</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );

  // ── Result screen ────────────────────────────────────────────────────────
  const resultBody = verificationResult ? (
    personaData ? (
      <ScrollArea className="flex-1">
        <div className="px-4 py-4">
          <VerificationComparator
            result={verificationResult}
            persona={personaData}
            personaId={personaId}
            documentId={mainDocId}
            allRelatedDocIds={relatedDocIds}
            onAccepted={handleAccepted}
            onRejected={handleRejected}
          />
        </div>
      </ScrollArea>
    ) : (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  ) : null;

  const body =
    phase === "prepare"   ? prepareBody   :
    phase === "countdown" ? countdownBody :
    phase === "capturing" ? captureBody   :
    resultBody;

  const fullContent = (
    <div className="flex flex-col h-full">
      {header}
      {body}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 max-w-md h-[90vh] flex flex-col [&>button:last-child]:hidden">
          {fullContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-2xl h-[92dvh] flex flex-col [&>button:last-child]:hidden"
      >
        {fullContent}
      </SheetContent>
    </Sheet>
  );
}
