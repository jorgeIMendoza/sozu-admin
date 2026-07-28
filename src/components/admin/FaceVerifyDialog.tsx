import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Camera } from "lucide-react";
import { ModalFormHeader, MODAL_FOOTER_CLS, FIELD_LABEL_CLS, SEG_TRACK_CLS, segBtnCls } from "@/components/ui/modal-form";
import { cn } from "@/lib/utils";
import {
  getHuman,
  verificarRostro,
  analizarDocumento,
  detectarRostroRapido,
  EMBEDDING_MODELS,
  FACE_MATCH_THRESHOLD,
  ANTISPOOF_THRESHOLD,
  DEFAULT_EMBEDDING_MODEL,
  type EmbeddingModel,
  type FaceMatchResult,
  type FaceReading,
} from "@/lib/identity/human-face";

/** Tipo de documento de la selfie en `documentos`. */
const SELFIE_DOC_TYPE = 49;

interface FaceVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Foto de la identificación contra la que se compara (INE frente o pasaporte). */
  docUrl: string;
  docLabel: string;
  /**
   * `oficial` guarda el resultado: sube la selfie y marca la identificación como
   * validada. `prueba` solo muestra números para calibrar, no toca la base.
   */
  modo?: "oficial" | "prueba";
  personaId?: number;
  /** Tipos de documento que se marcan como validados al pasar (INE 2 y 3, o pasaporte 4). */
  tiposIdentificacion?: number[];
  onVerified?: (resultado: FaceMatchResult) => void;
}

/**
 * Verificación facial 100% local con `@vladmandic/human`: compara la foto de la
 * identificación registrada contra la cámara, en el dispositivo. No depende de ningún
 * servicio externo y la selfie solo se sube cuando la verificación pasa.
 *
 * Reemplaza a la verificación por servicio de visión (`verificar-documento-identidad`),
 * que dependía de un gateway externo y quedaba fuera de servicio sin aviso.
 */
export function FaceVerifyDialog({
  open,
  onOpenChange,
  docUrl,
  docLabel,
  modo = "oficial",
  personaId,
  tiposIdentificacion = [],
  onVerified,
}: FaceVerifyDialogProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modelo, setModelo] = useState<EmbeddingModel>(DEFAULT_EMBEDDING_MODEL);
  const [cargandoModelos, setCargandoModelos] = useState(false);
  const [modelosListos, setModelosListos] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<FaceMatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Lectura previa de la identificación: si ahí no hay rostro legible, no tiene caso
  // pedirle al usuario que se ponga frente a la cámara.
  const [docReading, setDocReading] = useState<FaceReading | null | undefined>(undefined);
  // Retroalimentación en vivo: ¿te estoy viendo?
  const [enVivo, setEnVivo] = useState<{ score: number; anchoRostro: number } | null>(null);
  // Traza de la búsqueda del rostro en el documento (qué estrategias corrió y qué halló).
  const [diagnostico, setDiagnostico] = useState<string[]>([]);

  const esPrueba = modo === "prueba";
  const resultado = historial[0] ?? null;

  // Cámara al abrir.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    (async () => {
      setError(null);
      setHistorial([]);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelado) setError("No se pudo acceder a la cámara. Revisa los permisos del navegador.");
      }
    })();

    return () => { cancelado = true; };
  }, [open]);

  // Carga de modelos + lectura previa de la identificación, al abrir o al cambiar
  // el modelo de comparación.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    (async () => {
      setModelosListos(false);
      setCargandoModelos(true);
      setDocReading(undefined);
      setDiagnostico([]);
      try {
        await getHuman(modelo);
        if (cancelado) return;
        setModelosListos(true);
        const { lectura, pasos } = await analizarDocumento(docUrl, modelo);
        if (!cancelado) {
          setDocReading(lectura);
          setDiagnostico(pasos);
        }
      } catch (err: any) {
        console.error("[face-verify] preparación", err);
        if (!cancelado) {
          setError("No se pudieron cargar los modelos de reconocimiento facial.");
          setDocReading(null);
        }
      } finally {
        if (!cancelado) setCargandoModelos(false);
      }
    })();

    return () => { cancelado = true; };
  }, [open, modelo, docUrl]);

  // Retroalimentación en vivo mientras el diálogo está abierto y no se está comparando.
  useEffect(() => {
    if (!open || !modelosListos || comparando || guardando) return;
    let cancelado = false;
    let timer: number | undefined;

    const tick = async () => {
      if (cancelado || !videoRef.current || videoRef.current.readyState < 2) {
        timer = window.setTimeout(tick, 600);
        return;
      }
      try {
        const r = await detectarRostroRapido(videoRef.current, modelo);
        if (!cancelado) setEnVivo(r);
      } catch {
        // Silencioso: es solo la guía visual.
      }
      if (!cancelado) timer = window.setTimeout(tick, 600);
    };

    tick();
    return () => { cancelado = true; if (timer) clearTimeout(timer); };
  }, [open, modelosListos, comparando, guardando, modelo]);

  // Apagar cámara al cerrar / desmontar.
  useEffect(() => {
    if (open) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [open]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** Captura el frame actual como JPEG. */
  const capturarFrame = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return resolve(null);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });

  /** Sube la selfie y marca la identificación como validada. */
  const guardarVerificacion = async (resultado: FaceMatchResult) => {
    if (!personaId) return;
    setGuardando(true);
    try {
      const blob = await capturarFrame();
      if (blob) {
        const fileName = `persona_${personaId}_doctype${SELFIE_DOC_TYPE}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(fileName, new File([blob], fileName, { type: "image/jpeg" }));
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(fileName);

        await supabase
          .from("documentos")
          .update({ activo: false })
          .eq("id_persona", personaId)
          .eq("id_tipo_documento", SELFIE_DOC_TYPE)
          .eq("activo", true);

        await supabase.from("documentos").insert({
          url: urlData.publicUrl,
          id_tipo_documento: SELFIE_DOC_TYPE,
          id_persona: personaId,
          activo: true,
          id_estatus_verificacion: 2,
        });
      }

      if (tiposIdentificacion.length > 0) {
        const { error: updateError } = await supabase
          .from("documentos")
          .update({ id_estatus_verificacion: 2 })
          .eq("id_persona", personaId)
          .in("id_tipo_documento", tiposIdentificacion)
          .eq("activo", true);
        if (updateError) throw updateError;
      }

      queryClient.invalidateQueries({ queryKey: ["agent-onboarding-docs"] });
      queryClient.invalidateQueries({ queryKey: ["agent-onboarding-docs-detail"] });
      queryClient.invalidateQueries({ queryKey: ["agent-onboarding-persona"] });

      toast.success("Identidad verificada correctamente.");
      onVerified?.(resultado);
      onOpenChange(false);
    } catch (err: any) {
      console.error("[face-verify] guardar", err);
      toast.error("Se verificó tu rostro, pero no se pudo guardar el resultado. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const comparar = async () => {
    if (!videoRef.current) return;
    setComparando(true);
    setError(null);
    try {
      const res = await verificarRostro(docUrl, videoRef.current, { modelo });
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      setHistorial((prev) => [res.data, ...prev].slice(0, 5));

      const spoof = res.data.selfie.real < ANTISPOOF_THRESHOLD;
      if (!esPrueba && res.data.coincide && !spoof) {
        await guardarVerificacion(res.data);
      }
    } catch (err: any) {
      console.error("[face-verify] comparación", err);
      setError("No se pudo completar la comparación. Intenta de nuevo.");
    } finally {
      setComparando(false);
    }
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const ocupado = comparando || guardando || cargandoModelos;
  const rostroEnCuadro = !!enVivo && enVivo.anchoRostro >= 90;
  const guiaEnVivo = !enVivo
    ? "Colócate frente a la cámara"
    : enVivo.anchoRostro < 90
    ? "Acércate un poco más"
    : "Rostro detectado";
  // Sin rostro legible en la identificación no hay nada que comparar.
  const docSinRostro = docReading === null;
  const puedeComparar = modelosListos && !ocupado && !docSinRostro;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <ModalFormHeader
          title={esPrueba ? "Verificación facial (prueba)" : "Verificación de identidad"}
          subtitle="La comparación se hace en tu dispositivo: tu selfie no se envía a ningún servicio externo"
        />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">{docLabel}</p>
              <img
                src={docUrl}
                alt={docLabel}
                crossOrigin="anonymous"
                className="aspect-[4/3] w-full rounded-md border border-border bg-muted object-contain"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Cámara</p>
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
                {!ocupado && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/55 px-2 py-1.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        rostroEnCuadro ? "bg-emerald-400" : "bg-amber-400"
                      )}
                    />
                    <p className="text-[11px] font-medium text-white">{guiaEnVivo}</p>
                  </div>
                )}
                {ocupado && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                    <p className="text-xs font-medium text-white">
                      {cargandoModelos ? "Preparando..." : guardando ? "Guardando..." : "Comparando..."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {esPrueba && (
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL_CLS}>Modelo de comparación</Label>
              <div className={cn(SEG_TRACK_CLS, "w-full")} role="tablist">
                {(Object.keys(EMBEDDING_MODELS) as EmbeddingModel[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={modelo === key}
                    onClick={() => setModelo(key)}
                    disabled={ocupado}
                    className={segBtnCls(modelo === key)}
                  >
                    {EMBEDDING_MODELS[key].label}
                  </button>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground/70">
                Cada modelo tiene su propia escala: compara varios y quédate con el que separe
                mejor "soy yo" de "no soy yo".
              </p>
            </div>
          )}

          {!esPrueba && !resultado && !error && (
            <p className="text-xs font-medium text-muted-foreground/70">
              Colócate de frente, con buena luz y sin lentes oscuros ni gorra. Al pasar la
              comparación, tu identificación queda verificada automáticamente.
            </p>
          )}

          {docSinRostro && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-800">
                No se detecta un rostro en tu identificación registrada.
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Ciérrala y usa "Subir una nueva": toma la foto de cerca, con la credencial
                completa dentro del recuadro, enfocada y sin reflejos sobre el retrato.
              </p>
            </div>
          )}

          {diagnostico.length > 0 && (docSinRostro || esPrueba) && (
            <details className="rounded-md border border-border bg-muted/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                Detalle técnico de la detección
              </summary>
              <ul className="mt-2 space-y-0.5">
                {diagnostico.map((linea, i) => (
                  <li key={i} className="font-mono text-[11px] text-muted-foreground">{linea}</li>
                ))}
              </ul>
            </details>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          {resultado && (
            <div
              className={cn(
                "space-y-3 rounded-md border p-4",
                resultado.coincide && resultado.selfie.real >= ANTISPOOF_THRESHOLD
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
              )}
            >
              <div className="flex items-center gap-2">
                {resultado.coincide ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-600" />
                )}
                <p className="text-sm font-bold text-foreground">
                  {resultado.coincide ? "Coincidencia facial confirmada" : "No hay coincidencia suficiente"}
                </p>
              </div>

              {(esPrueba || !resultado.coincide) && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Similitud (coseno)</dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {resultado.similitud.toFixed(3)} (umbral {EMBEDDING_MODELS[resultado.modelo].umbral})
                  </dd>

                  <dt className="text-muted-foreground">Referencia Human</dt>
                  <dd className="font-mono font-semibold text-foreground">{resultado.distancia.toFixed(3)}</dd>

                  <dt className="text-muted-foreground">Muestras de cámara</dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {resultado.muestras.map((m) => m.toFixed(3)).join(" · ") || "—"}
                  </dd>

                  <dt className="text-muted-foreground">Rostro real (anti-spoof)</dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {pct(resultado.selfie.real)} (umbral {pct(ANTISPOOF_THRESHOLD)})
                  </dd>

                  <dt className="text-muted-foreground">Liveness</dt>
                  <dd className="font-mono font-semibold text-foreground">{pct(resultado.selfie.live)}</dd>

                  <dt className="text-muted-foreground">Confianza detección doc / selfie</dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {pct(resultado.documento.score)} / {pct(resultado.selfie.score)}
                  </dd>

                  <dt className="text-muted-foreground">Rostro en documento</dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {resultado.documento.boxSize[0]}×{resultado.documento.boxSize[1]} px
                    {resultado.documento.recortado && " · reescalado"}
                    {resultado.documento.facesDetected > 1 && ` · ${resultado.documento.facesDetected} rostros`}
                  </dd>

                  <dt className="text-muted-foreground">Modelo / tiempo</dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {EMBEDDING_MODELS[resultado.modelo].label} · {resultado.duracionMs} ms
                  </dd>
                </dl>
              )}

              {resultado.documento.boxSize[0] < 120 && (
                <p className="text-xs font-medium text-amber-700">
                  El rostro del documento mide {resultado.documento.boxSize[0]} px de ancho: con esa
                  resolución la comparación es poco confiable. Vuelve a capturar la identificación
                  más de cerca y enfocada.
                </p>
              )}
              {resultado.selfie.real < ANTISPOOF_THRESHOLD && (
                <p className="text-xs font-medium text-amber-700">
                  Se detectó posible foto de una foto o pantalla. Colócate frente a la cámara.
                </p>
              )}
            </div>
          )}

          {esPrueba && historial.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Intentos anteriores</p>
              <ul className="space-y-1">
                {historial.slice(1).map((h, i) => (
                  <li key={i} className="font-mono text-xs text-muted-foreground">
                    {EMBEDDING_MODELS[h.modelo].label}: coseno {h.similitud.toFixed(3)} · Human {h.distancia.toFixed(3)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {esPrueba && (
            <p className="text-xs text-muted-foreground/70">
              Pantalla de prueba: no cambia el estatus de verificación del expediente.
            </p>
          )}
        </div>

        <div className={MODAL_FOOTER_CLS}>
          <Button variant="cancel" onClick={() => onOpenChange(false)} disabled={guardando}>Cerrar</Button>
          <Button variant="primary-outline" onClick={comparar} disabled={!puedeComparar}>
            {comparando || guardando ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {guardando ? "Guardando..." : "Comparando..."}</>
            ) : (
              <><Camera className="h-4 w-4" /> {resultado ? "Intentar de nuevo" : "Verificar ahora"}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
