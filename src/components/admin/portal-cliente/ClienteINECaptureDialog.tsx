import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, X, Camera, ScanLine, Sun, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStabilityDetection,
  CaptureFlash,
  SelfieCameraOverlay,
  DocCameraOverlay,
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
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const resetState = () => {
    setVerificationResult(null);
    setMainDocId(0);
    setRelatedDocIds([]);
    setCameraStep("front");
    blobRefs.current = {};
    autoCaptureLockRef.current = false;
    setUploading(false);
    setVerifying(false);
    setAutoSaveState("idle");
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

  const verifyDocumentDirect = async (
    imageUrl: string,
    expectedType: string,
    selfieUrl?: string,
  ): Promise<VerificationResult | null> => {
    const apiKey = (import.meta.env.VITE_ANTHROPIC_API_KEY || __LOCAL_DEVELOPMENT_ENV__?.VITE_ANTHROPIC_API_KEY) as string;

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
      ine_frente: "la parte FRONTAL de una credencial INE/IFE mexicana. Extrae: nombre completo, CURP, clave de elector, fecha de nacimiento, sexo (H o M), domicilio, vigencia (año inicio - año fin).",
      ine_reverso: "el REVERSO de una credencial INE/IFE mexicana. Extrae el número CIC del MRZ (dígitos después de 'IDMEX', antes de <<).",
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
- La foto del INE es pequeña (≈2cm×2cm) y puede tener años de antigüedad — calidad inferior es normal.
- IGNORAR completamente: bigote, barba, gorra, sombrero, lentes, maquillaje, cabello diferente (largo, corto, teñido), ropa, accesorios, expresión facial, iluminación distinta, ángulo diferente.
- COMPARAR SOLO: estructura ósea del rostro — forma de la mandíbula, pómulos, distancia entre ojos, forma de la nariz, proporciones generales del cráneo.
- Si la estructura ósea es compatible aunque la persona se vea diferente por cualquiera de los factores anteriores → face_match=true.
- Rechaza (face_match=false) SOLO si hay diferencia anatómica INEQUÍVOCA: diferente sexo biológico, diferente etnia evidente, diferencia de edad de décadas, o son claramente dos personas distintas.
- Ante cualquier duda razonable: face_match=true.`;
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
        system: "Eres experto verificador de documentos de identidad mexicanos (INE/Pasaporte). Extrae datos con precisión. Para verificación facial: compara estructura ósea facial, NO apariencia superficial (cabello, ropa, maquillaje). Aprueba si la estructura facial es compatible — la persona puede verse diferente por iluminación, peinado o expresión. Usa siempre la herramienta verify_identity_document.",
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

    if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    const toolUse = data.content?.find((b: any) => b.type === "tool_use" && b.name === "verify_identity_document");
    if (!toolUse) throw new Error("No tool_use en respuesta Claude");

    const result = toolUse.input as VerificationResult;

    // Same post-processing as edge function
    const accepted = new Set(["ine_frente", "ine_reverso", "pasaporte"]);
    if (!accepted.has(result.document_type)) {
      result.is_valid_document = false;
      result.rejection_reason = result.rejection_reason ?? "Solo se acepta INE o Pasaporte.";
    }
    if (result.document_type !== expectedType) {
      result.is_valid_document = false;
      result.rejection_reason = result.rejection_reason ?? `Tipo detectado (${result.document_type}) no coincide con esperado (${expectedType}).`;
    }
    if (selfieUrl && typeof result.face_match !== "boolean") {
      result.face_match = null;
      result.face_match_reason = result.face_match_reason ?? "No fue posible evaluar coincidencia facial.";
    }
    // face_match is informational — does NOT affect is_valid_document
    return result;
  };

  const verifyDocument = async (
    imageUrl: string,
    expectedType: string,
    selfieUrl?: string,
  ): Promise<VerificationResult | null> => {
    setVerifying(true);
    const directKey = import.meta.env.VITE_ANTHROPIC_API_KEY || __LOCAL_DEVELOPMENT_ENV__?.VITE_ANTHROPIC_API_KEY;
    console.log("[DEBUG] verifyDocument called. directKey present:", !!directKey, "| env:", import.meta.env.VITE_ANTHROPIC_API_KEY ? "import.meta" : __LOCAL_DEVELOPMENT_ENV__?.VITE_ANTHROPIC_API_KEY ? "__LOCAL" : "NONE");
    try {
      // TEST MODE: use direct Anthropic API call when VITE_ANTHROPIC_API_KEY is set
      if (directKey) {
        console.log("[TEST MODE] Calling Anthropic directly (bypassing edge function)");
        return await verifyDocumentDirect(imageUrl, expectedType, selfieUrl);
      }

      const { data, error } = await supabase.functions.invoke("verificar-documento-identidad", {
        body: { imageUrl, expectedType, selfieUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as VerificationResult;
    } catch (err: any) {
      console.error("verifyDocument error:", err);
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
          // Briefly disable then re-enable camera so stability detection restarts with
          // a fresh initial delay for step 2 (the loop stops after firing for step 1).
          setCameraActive(false);
          setCameraStep("back");
          setTimeout(() => {
            autoCaptureLockRef.current = false;
            setCameraActive(true);
          }, 150);

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
            toast.error("Error al subir imagenes. Intenta de nuevo.", { duration: 10000 });
            autoCaptureLockRef.current = false;
            return;
          }

          // AI verification — validates document authenticity only (face match is informational)
          const aiResult = await verifyDocument(frontRes.url, "ine_frente", selfieRes.url);

          if (!aiResult || !aiResult.is_valid_document) {
            // Always delete storage files — no DB record was inserted
            await supabase.storage.from("documentos").remove([frontRes.path, backRes.path, selfieRes.path]);
            autoCaptureLockRef.current = false;

            if (!aiResult) {
              // Edge function internal error — retry selfie
              toast.error("Servicio no disponible. Intenta de nuevo en unos minutos.", { duration: 12000 });
              setTimeout(() => startCamera("selfie"), 500);
              return;
            }

            blobRefs.current = {};
            toast.error("Documento no valido.", {
              description: aiResult.rejection_reason ?? "Asegurate de mostrar tu INE claramente y sin reflejos.",
              duration: 12000,
            });
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
        toast.error("Error inesperado. Intenta de nuevo.", { duration: 10000 });
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

  // Auto-save INE data to personas table when result is reached
  useEffect(() => {
    if (phase !== "result" || !verificationResult || autoSaveState !== "idle") return;

    const doSave = async () => {
      setAutoSaveState("saving");
      try {
        const result = verificationResult;
        const personaUpdate: Record<string, any> = {};

        if (result.full_name) {
          const isIne = result.document_type === "ine_frente" || result.document_type === "ine_reverso" || !!result.clave_elector;
          if (isIne) {
            const parts = result.full_name.trim().split(/\s+/);
            if (parts.length >= 3) {
              const [apPaterno, apMaterno, ...nombres] = parts;
              personaUpdate.nombre_legal = [...nombres, apPaterno, apMaterno].join(" ");
            } else {
              personaUpdate.nombre_legal = result.full_name;
            }
          } else {
            personaUpdate.nombre_legal = result.full_name;
          }
        }

        if (result.curp) personaUpdate.curp = result.curp;

        if (result.fecha_nacimiento) {
          const parts = result.fecha_nacimiento.split("/");
          if (parts.length === 3) {
            personaUpdate.fecha_nacimiento = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        if (result.sexo) {
          personaUpdate.sexo = result.sexo === "H" ? "M" : result.sexo === "M" ? "F" : result.sexo;
        }

        if (Object.keys(personaUpdate).length > 0) {
          await supabase.from("personas").update(personaUpdate as any).eq("id", personaId);
        }

        if (result.numero_identificacion && mainDocId) {
          const isIne = result.document_type === "ine_reverso" || result.document_type === "ine_frente" || !!result.clave_elector;
          const normalizedNumber =
            isIne && /^\d{8,}$/.test(result.numero_identificacion)
              ? `IDMEX${result.numero_identificacion}`
              : result.numero_identificacion;
          await (supabase as any).from("documentos").update({ numero: normalizedNumber }).eq("id", mainDocId);
        }

        queryClient.invalidateQueries({ queryKey: ["agent-onboarding-persona"] });
        queryClient.invalidateQueries({ queryKey: ["agent-onboarding-docs"] });
        setAutoSaveState("done");
      } catch (err) {
        console.error("autoSave error:", err);
        setAutoSaveState("error");
      }
    };

    doSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, verificationResult]);

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
      <Button onClick={handleReady} className="w-full h-12 text-base font-semibold shrink-0">
        Listo, empezar
      </Button>
    </div>
  );
  const prepareBody = isDesktop
    ? <div className="flex-1 flex flex-col overflow-hidden">{prepareInner}</div>
    : <ScrollArea className="flex-1">{prepareInner}</ScrollArea>;

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
    <div className="flex-1 overflow-hidden">
      <div className="px-4 py-4 h-full flex flex-col">
        <canvas ref={canvasRef} className="hidden" />
        <CaptureFlash show={showFlash} />
        {uploading || verifying ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground text-center">
              {verifying ? "Validando datos biometricos..." : "Subiendo imagenes..."}
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
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Iniciando camara...</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Result screen ────────────────────────────────────────────────────────
  const extractedName = (() => {
    if (!verificationResult?.full_name) return null;
    const isIne = verificationResult.document_type === "ine_frente" || verificationResult.document_type === "ine_reverso" || !!verificationResult.clave_elector;
    if (isIne) {
      const parts = verificationResult.full_name.trim().split(/\s+/);
      if (parts.length >= 3) {
        const [apPaterno, apMaterno, ...nombres] = parts;
        return [...nombres, apPaterno, apMaterno].join(" ");
      }
    }
    return verificationResult.full_name;
  })();

  const resultBody = (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
      {(autoSaveState === "idle" || autoSaveState === "saving") && (
        <>
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Guardando tu informacion...</p>
        </>
      )}
      {(autoSaveState === "done" || autoSaveState === "error") && (
        <>
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">Identidad verificada</h3>
            {extractedName && (
              <p className="text-sm text-muted-foreground">{extractedName}</p>
            )}
          </div>
          <Button className="w-full" onClick={handleAccepted}>
            Continuar
          </Button>
        </>
      )}
    </div>
  );

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
        <DialogContent className="p-0 max-w-md h-[min(90vh,780px)] flex flex-col [&>button:last-child]:hidden">
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
