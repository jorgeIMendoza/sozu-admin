import { useState, useRef, useCallback, useEffect } from "react";
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
  type VerificationResult,
} from "@/components/admin/DocumentVerification";

// Captura de INE/Pasaporte con cámara para el onboarding PÚBLICO de propietarios.
// Reutiliza las primitivas de cámara (estabilidad/overlays) y la verificación IA,
// pero SIN persistir: las imágenes viven en memoria (object URLs) y el resultado
// se devuelve por `onResult`. La persistencia real (Storage/BD) es Fase D.
//
// La IA corre con la key directa (dev / TEST MODE). En producción, la verificación
// pre-login requiere ajustar la edge function `verificar-documento-identidad` para
// recibir la imagen sin sesión (Fase D); mientras tanto, sin key la captura se
// acepta sin extracción y el usuario completa los datos a mano.

type Phase = "prepare" | "countdown" | "capturing" | "result";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDesktop: boolean;
  /** Devuelve el resultado de la IA (o null si no hubo extracción disponible). */
  onResult: (result: VerificationResult | null) => void;
}

export function OnboardingINECapture({ open, onOpenChange, isDesktop, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureLockRef = useRef(false);
  const blobRefs = useRef<{ front?: Blob; back?: Blob }>({});

  const [phase, setPhase] = useState<Phase>("prepare");
  const [countdown, setCountdown] = useState(3);
  const [cameraStep, setCameraStep] = useState<"front" | "back" | "selfie">("front");
  const [cameraActive, setCameraActive] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  const resetState = () => {
    setCameraStep("front");
    blobRefs.current = {};
    autoCaptureLockRef.current = false;
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
     
  }, [open]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      setPhase("capturing");
      startCamera("front");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
     
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "capturing" || verifying || !cameraActive) return;
    if (!streamRef.current) return;
    const t = setTimeout(() => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    }, 30);
    return () => clearTimeout(t);
  }, [phase, verifying, cameraActive, cameraStep]);

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
      toast.error("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  // Verificación IA directa (dev / TEST MODE). Usa object URLs en memoria; no sube nada.
  const verifyDocumentDirect = async (
    imageUrl: string,
    expectedType: string,
    selfieUrl?: string,
  ): Promise<VerificationResult | null> => {
    // __LOCAL_DEVELOPMENT_ENV__ es un `define` de Vite con el contenido de .env.development.
    const apiKey = (import.meta.env.VITE_ANTHROPIC_API_KEY ||
      __LOCAL_DEVELOPMENT_ENV__?.VITE_ANTHROPIC_API_KEY) as string | undefined;
    if (!apiKey) return null; // Sin key directa: prod pre-login → Fase D (edge function).

    const toBase64 = async (url: string) => {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      return { data: btoa(binary), mediaType: res.headers.get("content-type") || "image/jpeg" };
    };

    const typeDescriptions: Record<string, string> = {
      ine_frente:
        "la parte FRONTAL de una credencial INE/IFE mexicana. Extrae: nombre completo, CURP, clave de elector, fecha de nacimiento, sexo (H o M), domicilio, vigencia (año inicio - año fin).",
      ine_reverso: "el REVERSO de una credencial INE/IFE mexicana.",
      pasaporte: "un PASAPORTE mexicano. Extrae: nombre completo, CURP, fecha de nacimiento, sexo, número de pasaporte, vigencia.",
    };

    const doc = await toBase64(imageUrl);
    const userContent: object[] = [
      { type: "image", source: { type: "base64", media_type: doc.mediaType, data: doc.data } },
    ];
    if (selfieUrl) {
      const selfie = await toBase64(selfieUrl);
      userContent.push({ type: "image", source: { type: "base64", media_type: selfie.mediaType, data: selfie.data } });
    }

    let prompt = `Analiza esta imagen. Se espera que sea ${typeDescriptions[expectedType] ?? expectedType}.
Verifica autenticidad: formato oficial, tipografía, colores, hologramas, QR/barcode.
Si está vencido indícalo. Si NO es un documento válido o es fotocopia/pantalla, recházalo.`;
    if (selfieUrl) {
      prompt += `\n\nSegunda imagen: selfie en tiempo real del titular del documento.
REGLAS PARA COMPARACIÓN FACIAL:
- La foto del INE es pequeña y puede tener años - calidad inferior es normal.
- IGNORAR: bigote, barba, gorra, lentes, maquillaje, cabello, ropa, expresión, iluminación, ángulo.
- COMPARAR SOLO estructura ósea (mandíbula, pómulos, distancia entre ojos, nariz, proporciones).
- Ante duda razonable: face_match=true. Rechaza solo ante diferencia anatómica inequívoca.`;
    }
    userContent.push({ type: "text", text: prompt });

    const resp = await fetch("/api/anthropic/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system:
          "Eres experto verificador de documentos de identidad mexicanos (INE/Pasaporte). Extrae datos con precisión. Usa siempre la herramienta verify_identity_document.",
        tools: [{
          name: "verify_identity_document",
          description: "Retorna resultados de verificación del documento",
          input_schema: {
            type: "object",
            properties: {
              is_valid_document: { type: "boolean" },
              document_type: { type: "string", enum: ["ine_frente", "ine_reverso", "pasaporte", "otro", "no_documento"] },
              confidence: { type: "number" },
              full_name: { type: ["string", "null"] },
              curp: { type: ["string", "null"] },
              clave_elector: { type: ["string", "null"] },
              fecha_nacimiento: { type: ["string", "null"] },
              sexo: { type: ["string", "null"], enum: ["H", "M", null] },
              domicilio: { type: ["string", "null"] },
              vigencia: { type: ["string", "null"] },
              numero_identificacion: { type: ["string", "null"] },
              is_expired: { type: ["boolean", "null"] },
              authenticity_signals: { type: "array", items: { type: "string" } },
              rejection_reason: { type: ["string", "null"] },
              face_match: { type: ["boolean", "null"] },
              face_match_confidence: { type: ["number", "null"] },
              face_match_reason: { type: ["string", "null"] },
            },
            required: ["is_valid_document", "document_type", "confidence", "authenticity_signals", "face_match", "face_match_confidence", "face_match_reason"],
          },
        }],
        tool_choice: { type: "any" },
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) throw new Error(`Anthropic ${resp.status}`);
    const data = await resp.json();
    const toolUse = data.content?.find((b: any) => b.type === "tool_use" && b.name === "verify_identity_document");
    if (!toolUse) throw new Error("No tool_use en respuesta Claude");

    const result = toolUse.input as VerificationResult;
    const accepted = new Set(["ine_frente", "ine_reverso", "pasaporte"]);
    if (!accepted.has(result.document_type)) {
      result.is_valid_document = false;
      result.rejection_reason = result.rejection_reason ?? "Solo se acepta INE o Pasaporte.";
    }
    return result;
  };

  const drawCroppedToGuide = (video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const cW = video.clientWidth, cH = video.clientHeight, vW = video.videoWidth, vH = video.videoHeight;
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
    canvas.width = Math.round(sw); canvas.height = Math.round(sh);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  };

  const finishWithVerification = async (selfieBlob: Blob) => {
    setVerifying(true);
    const front = blobRefs.current.front;
    const urls: string[] = [];
    const mk = (b: Blob) => { const u = URL.createObjectURL(b); urls.push(u); return u; };
    try {
      let result: VerificationResult | null = null;
      if (front) {
        const frontUrl = mk(front);
        const selfieUrl = mk(selfieBlob);
        result = await verifyDocumentDirect(frontUrl, "ine_frente", selfieUrl);
      }

      if (result && !result.is_valid_document) {
        blobRefs.current = {};
        toast.error("Documento no válido.", {
          description: result.rejection_reason ?? "Muestra tu INE claramente y sin reflejos.",
          duration: 10000,
        });
        setVerifying(false);
        setPhase("prepare");
        return;
      }

      // result válido, o null (sin key → captura aceptada sin extracción, Fase D)
      onResult(result);
      onOpenChange(false);
    } catch (err) {
      console.error("verify onboarding INE:", err);
      // La verificación falló (servicio/red). Aceptamos la captura sin extracción.
      toast.message("Captura tomada; la verificación automática no está disponible.", {
        description: "Podrás confirmar los datos manualmente.",
        duration: 8000,
      });
      onResult(null);
      onOpenChange(false);
    } finally {
      urls.forEach((u) => URL.revokeObjectURL(u));
      setVerifying(false);
    }
  };

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || autoCaptureLockRef.current) return;
    autoCaptureLockRef.current = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) { autoCaptureLockRef.current = false; return; }

    if (cameraStep !== "selfie") drawCroppedToGuide(video, canvas, ctx);
    else { canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0); }

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    canvas.toBlob(async (blob) => {
      if (!blob) { autoCaptureLockRef.current = false; return; }
      if (cameraStep === "front") {
        blobRefs.current.front = blob;
        toast.success("INE frente capturado — ahora el reverso", { duration: 3000 });
        setCameraActive(false);
        setCameraStep("back");
        setTimeout(() => { autoCaptureLockRef.current = false; setCameraActive(true); }, 150);
      } else if (cameraStep === "back") {
        blobRefs.current.back = blob;
        toast.success("Reverso capturado — ahora la selfie", { duration: 3000 });
        stopCamera();
        setTimeout(() => startCamera("selfie"), 300);
        autoCaptureLockRef.current = false;
      } else {
        stopCamera();
        await finishWithVerification(blob);
      }
    }, "image/jpeg", 0.85);
  }, [cameraStep]);

  const onStableCapture = useCallback(() => {
    if (autoCaptureLockRef.current) return;
    // En laptop/desktop la cámara suele ser frontal: el auto-captura por estabilidad
    // dispara con la cara en los pasos de documento. Ahí exigimos captura manual (botón).
    if (cameraStep === "selfie" || !isDesktop) capturePhoto();
  }, [capturePhoto, cameraStep, isDesktop]);

  const { stabilityProgress, documentDetected, initialDelayDone, alignmentProgress, alignedQuadrants } =
    useStabilityDetection(videoRef, cameraActive && !verifying, onStableCapture, 1500, cameraStep !== "selfie");

  const handleReady = () => { setCountdown(3); setPhase("countdown"); };

  const stepIndex = cameraStep === "front" ? 0 : cameraStep === "back" ? 1 : 2;
  const steps = ["INE Frente", "INE Reverso", "Selfie"];

  const header = (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Camera className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-foreground text-sm">Verificación de identidad</h3>
        {phase !== "prepare" && (
          <div className="flex items-center gap-1.5 mt-1">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors",
                    i < stepIndex ? "bg-primary text-primary-foreground"
                      : i === stepIndex ? "bg-primary/10 text-primary"
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

  const prepareInner = (
    <div className={cn("px-6 flex flex-col items-center gap-5", isDesktop ? "py-6 justify-center h-full" : "py-8")}>
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center shrink-0">
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
          { icon: Sun, text: "Busca buena iluminación, sin reflejos" },
          { icon: User, text: "La selfie debe mostrar tu rostro claramente" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-muted/60">
            <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-foreground font-medium">{text}</p>
          </div>
        ))}
      </div>
      <Button onClick={handleReady} className="w-full h-12 text-base font-semibold shrink-0">
        Listo, empezar
      </Button>
    </div>
  );
  const prepareBody = isDesktop
    ? <div className="flex-1 flex flex-col overflow-hidden">{prepareInner}</div>
    : <ScrollArea className="flex-1">{prepareInner}</ScrollArea>;

  const countdownBody = (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-background">
      <p className="text-sm font-medium text-muted-foreground">Prepárate...</p>
      <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
        <span className="text-6xl font-black text-foreground tabular-nums">{countdown}</span>
      </div>
      <p className="text-xs text-muted-foreground/60">La cámara iniciará automáticamente</p>
    </div>
  );

  const captureBody = (
    <div className="flex-1 overflow-hidden">
      <div className="px-4 py-4 h-full flex flex-col">
        <canvas ref={canvasRef} className="hidden" />
        <CaptureFlash show={showFlash} />
        {isDesktop && cameraStep !== "selfie" && cameraActive && !verifying && (
          <p className="mb-2 shrink-0 text-center text-xs text-muted-foreground">
            Encuadra tu INE en el marco y toca el botón para capturar.
          </p>
        )}
        {verifying ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground text-center">Validando datos biométricos...</p>
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
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Iniciando cámara...</p>
          </div>
        )}
      </div>
    </div>
  );

  const body =
    phase === "prepare" ? prepareBody :
    phase === "countdown" ? countdownBody :
    captureBody;

  const fullContent = (
    <div className="flex flex-col h-full">
      {header}
      {body}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 max-w-md h-[min(90vh,780px)] flex flex-col [&>button:last-child]:hidden">
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
