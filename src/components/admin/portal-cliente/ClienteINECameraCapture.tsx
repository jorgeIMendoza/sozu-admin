import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, X, Camera, Check, RotateCcw } from "lucide-react";
import {
  useStabilityDetection,
  CaptureFlash,
  DocCameraOverlay,
} from "@/components/admin/DocumentVerification";

/**
 * Captura por cámara de INE (frente → reverso) o Pasaporte (una toma), sin subir
 * archivos ni validación IA. Detecta encuadre/distancia y auto-captura cuando el
 * documento está alineado (esquinas en verde), recortando SOLO al recuadro guía.
 * Tras cada toma el cliente puede Repetir o Continuar/Guardar. Las imágenes se
 * registran en `documentos` (tipo 2 = INE frente, 3 = INE reverso, 4 = Pasaporte)
 * con estatus 1 (En revisión).
 */

type Mode = "ine" | "pasaporte";
type OverlayStep = "front" | "back" | "passport";

interface StepDef {
  key: OverlayStep;
  tipoId: number;
  label: string; // "frente" / "reverso" / "pasaporte"
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId: number;
  isDesktop: boolean;
  mode: Mode;
  onCompleted?: () => void;
}

export function ClienteINECameraCapture({ open, onOpenChange, personaId, isDesktop, mode, onCompleted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobsRef = useRef<(Blob | null)[]>([]);
  const autoCaptureLockRef = useRef(false);

  const steps: StepDef[] = useMemo(
    () =>
      mode === "pasaporte"
        ? [{ key: "passport", tipoId: 4, label: "pasaporte" }]
        : [
            { key: "front", tipoId: 2, label: "frente" },
            { key: "back", tipoId: 3, label: "reverso" },
          ],
    [mode],
  );

  const [idx, setIdx] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = steps[idx];
  const isLast = idx === steps.length - 1;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    autoCaptureLockRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      else setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 80);
      setCameraActive(true);
    } catch {
      toast.error("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }, []);

  const reset = useCallback(() => {
    setIdx(0);
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
    setPreviewBlob(null);
    blobsRef.current = [];
    autoCaptureLockRef.current = false;
    setSaving(false);
  }, []);

  useEffect(() => {
    if (open) {
      reset();
      startCamera();
    } else {
      stopCamera();
      reset();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-vincular stream cuando el <video> se re-monta (regreso de preview / cambio de paso).
  useEffect(() => {
    if (!open || preview || saving || !cameraActive) return;
    const t = setTimeout(() => {
      if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
    }, 30);
    return () => clearTimeout(t);
  }, [open, preview, saving, cameraActive, idx]);

  // Recorta el frame al recuadro guía (inset-4 = 16px) respetando object-cover.
  const drawCroppedToGuide = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const cW = video.clientWidth, cH = video.clientHeight;
    const vW = video.videoWidth, vH = video.videoHeight;
    if (!vW || !vH || !cW || !cH) {
      canvas.width = vW; canvas.height = vH; ctx.drawImage(video, 0, 0); return;
    }
    const scale = Math.max(cW / vW, cH / vH);
    const offsetX = (vW - cW / scale) / 2;
    const offsetY = (vH - cH / scale) / 2;
    const inset = 16;
    const sx = Math.max(0, offsetX + inset / scale);
    const sy = Math.max(0, offsetY + inset / scale);
    const sw = Math.min((cW - 2 * inset) / scale, vW - sx);
    const sh = Math.min((cH - 2 * inset) / scale, vH - sy);
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  };

  const capturePhoto = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !video.videoWidth) return;
    drawCroppedToGuide(video, canvas, ctx);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);
    canvas.toBlob((blob) => {
      if (!blob) { autoCaptureLockRef.current = false; return; }
      setPreviewBlob(blob);
      setPreview(URL.createObjectURL(blob));
    }, "image/jpeg", 0.9);
  }, []);

  const onStableCapture = useCallback(() => {
    if (!autoCaptureLockRef.current) { autoCaptureLockRef.current = true; capturePhoto(); }
  }, [capturePhoto]);

  const { stabilityProgress, documentDetected, initialDelayDone, alignmentProgress, alignedQuadrants } =
    useStabilityDetection(videoRef, cameraActive && !preview && !saving, onStableCapture, 1500, true);

  const retake = () => {
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
    setPreviewBlob(null);
    autoCaptureLockRef.current = false;
  };

  const uploadAndInsert = async (blob: Blob, typeId: number): Promise<boolean> => {
    const path = `personas/${personaId}/doctype${typeId}_${Date.now()}.jpg`;
    const file = new File([blob], `doc_${typeId}_${Date.now()}.jpg`, { type: "image/jpeg" });
    const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
    if (upErr) { console.error("[camCapture] upload:", upErr); return false; }
    const { data: { publicUrl } } = supabase.storage.from("documentos").getPublicUrl(path);

    const { data: activeDocs } = await (supabase as any)
      .from("documentos")
      .select("id")
      .eq("id_persona", personaId)
      .eq("id_tipo_documento", typeId)
      .eq("activo", true)
      .order("id", { ascending: true });
    if (activeDocs && activeDocs.length > 0) {
      await (supabase as any).from("documentos").update({ id_estatus_verificacion: 4 }).eq("id", activeDocs[0].id);
      const otherIds = activeDocs.slice(1).map((d: any) => d.id);
      if (otherIds.length > 0) {
        await (supabase as any).from("documentos").update({ activo: false, id_estatus_verificacion: 4 }).in("id", otherIds);
      }
    }

    const { error: insErr } = await (supabase as any).from("documentos").insert({
      id_persona: personaId,
      id_tipo_documento: typeId,
      url: publicUrl,
      activo: true,
      es_draft: false,
      id_estatus_verificacion: 1, // En revisión (manual)
    });
    if (insErr) { console.error("[camCapture] insert:", insErr); return false; }
    return true;
  };

  const confirmShot = async () => {
    if (!previewBlob) return;
    blobsRef.current[idx] = previewBlob;

    if (!isLast) {
      setPreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
      setPreviewBlob(null);
      setIdx((i) => i + 1);
      // Reinicia el retardo inicial de detección para el siguiente paso.
      setCameraActive(false);
      setTimeout(() => { autoCaptureLockRef.current = false; setCameraActive(true); }, 150);
      toast.success(`${steps[idx].label === "frente" ? "INE frente" : steps[idx].label} capturado`, { duration: 3000 });
      return;
    }

    // Último paso → subir todas las tomas + registrar.
    setSaving(true);
    stopCamera();
    try {
      let allOk = true;
      for (let i = 0; i < steps.length; i++) {
        const b = blobsRef.current[i];
        if (!b) { allOk = false; break; }
        const ok = await uploadAndInsert(b, steps[i].tipoId);
        if (!ok) { allOk = false; break; }
      }
      if (!allOk) {
        toast.error("Error al guardar las imágenes. Intenta de nuevo.", { duration: 8000 });
        return;
      }
      toast.success(mode === "pasaporte" ? "Pasaporte enviado para revisión" : "INE enviado para revisión");
      onCompleted?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const docTitle = mode === "pasaporte" ? "Captura de tu pasaporte" : "Captura de tu INE";
  const stepHint =
    mode === "pasaporte"
      ? "Página con tu foto"
      : idx === 0
      ? "Paso 1 de 2 · Frente"
      : "Paso 2 de 2 · Reverso";

  const header = (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Camera className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-foreground text-sm">{docTitle}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{stepHint}</p>
      </div>
      <button
        onClick={() => onOpenChange(false)}
        className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const body = (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-4 flex-1 flex flex-col gap-4 min-h-0">
        <canvas ref={canvasRef} className="hidden" />
        <CaptureFlash show={showFlash} />

        {saving ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Guardando imágenes...</p>
          </div>
        ) : preview ? (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Revisa que el <span className="font-semibold text-foreground">{current.label}</span> se vea completo y legible.
            </p>
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <img src={preview} alt="Documento" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" className="flex-1 h-11" onClick={retake}>
                <RotateCcw className="w-4 h-4 mr-2" /> Repetir
              </Button>
              <Button className="flex-1 h-11" onClick={confirmShot}>
                <Check className="w-4 h-4 mr-2" /> {isLast ? "Guardar" : "Continuar"}
              </Button>
            </div>
          </>
        ) : cameraActive ? (
          <DocCameraOverlay
            videoRef={videoRef}
            cameraStep={current.key}
            onCapture={onStableCapture}
            onCancel={() => onOpenChange(false)}
            uploading={false}
            stabilityProgress={stabilityProgress}
            documentDetected={documentDetected}
            initialDelayDone={initialDelayDone}
            alignmentProgress={alignmentProgress}
            alignedQuadrants={alignedQuadrants}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Iniciando cámara...</p>
          </div>
        )}
      </div>
    </div>
  );

  const fullContent = (
    <div className="flex flex-col h-full">
      {header}
      {body}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 max-w-md h-[min(90vh,760px)] flex flex-col [&>button:last-child]:hidden">
          {fullContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 rounded-t-2xl h-[92dvh] flex flex-col [&>button:last-child]:hidden">
        {fullContent}
      </SheetContent>
    </Sheet>
  );
}
