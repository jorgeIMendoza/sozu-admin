import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Camera } from "lucide-react";
import { ModalFormHeader, MODAL_FOOTER_CLS, FIELD_LABEL_CLS, SEG_TRACK_CLS, segBtnCls } from "@/components/ui/modal-form";
import { cn } from "@/lib/utils";
import {
  getHuman,
  verificarRostro,
  EMBEDDING_MODELS,
  FACE_MATCH_THRESHOLD,
  ANTISPOOF_THRESHOLD,
  type EmbeddingModel,
  type FaceMatchResult,
} from "@/lib/identity/human-face";

interface FaceMatchTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Foto de la identificación registrada (INE frente o pasaporte). */
  docUrl: string;
  docLabel: string;
  /** Se llama cuando la comparación pasa el umbral, por si el flujo quiere continuar. */
  onMatch?: (resultado: FaceMatchResult) => void;
}

/**
 * PRUEBA de verificación facial 100% local (`@vladmandic/human`): compara la foto de la
 * identificación registrada contra la cámara, en el dispositivo. No sube la selfie a
 * ningún servicio. Muestra los números crudos (similitud, distancia, anti-spoof,
 * liveness, tamaño del rostro) y permite cambiar de modelo para calibrar cuál sirve.
 */
export function FaceMatchTestDialog({ open, onOpenChange, docUrl, docLabel, onMatch }: FaceMatchTestDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modelo, setModelo] = useState<EmbeddingModel>("faceres");
  const [cargandoModelos, setCargandoModelos] = useState(false);
  const [modelosListos, setModelosListos] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [historial, setHistorial] = useState<FaceMatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  // Carga (y recarga) de modelos al abrir o al cambiar de modelo de embedding.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    (async () => {
      setModelosListos(false);
      setCargandoModelos(true);
      try {
        await getHuman(modelo);
        if (!cancelado) setModelosListos(true);
      } catch (err: any) {
        console.error("[face-match] carga de modelos", err);
        if (!cancelado) setError("No se pudieron cargar los modelos de reconocimiento facial.");
      } finally {
        if (!cancelado) setCargandoModelos(false);
      }
    })();

    return () => { cancelado = true; };
  }, [open, modelo]);

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
      if (res.data.coincide) onMatch?.(res.data);
    } catch (err: any) {
      console.error("[face-match] comparación", err);
      setError("No se pudo completar la comparación. Intenta de nuevo.");
    } finally {
      setComparando(false);
    }
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <ModalFormHeader
          title="Verificación facial (prueba)"
          subtitle="Comparación local en tu dispositivo: la selfie no se envía a ningún servicio"
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
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
                {(cargandoModelos || comparando) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                    <p className="text-xs font-medium text-white">
                      {cargandoModelos ? "Cargando modelos..." : "Comparando..."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

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
                  disabled={cargandoModelos || comparando}
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

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          {resultado && (
            <div
              className={cn(
                "space-y-3 rounded-md border p-4",
                resultado.coincide
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

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Similitud</dt>
                <dd className="font-mono font-semibold text-foreground">
                  {pct(resultado.similitud)} (umbral {pct(FACE_MATCH_THRESHOLD)})
                </dd>

                <dt className="text-muted-foreground">Distancia cruda</dt>
                <dd className="font-mono font-semibold text-foreground">{resultado.distancia.toFixed(3)}</dd>

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
                  {resultado.documento.facesDetected > 1 && ` · ${resultado.documento.facesDetected} rostros`}
                </dd>

                <dt className="text-muted-foreground">Modelo / tiempo</dt>
                <dd className="font-mono font-semibold text-foreground">
                  {EMBEDDING_MODELS[resultado.modelo].label} · {resultado.duracionMs} ms
                </dd>
              </dl>

              {resultado.documento.boxSize[0] < 120 && (
                <p className="text-xs font-medium text-amber-700">
                  El rostro del documento es muy pequeño ({resultado.documento.boxSize[0]} px de ancho).
                  Con esa resolución la comparación es poco confiable: conviene volver a capturar
                  la identificación más de cerca y enfocada.
                </p>
              )}
              {resultado.selfie.real < ANTISPOOF_THRESHOLD && (
                <p className="text-xs font-medium text-amber-700">
                  El anti-spoof marca posible foto de una foto o pantalla.
                </p>
              )}
            </div>
          )}

          {historial.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Intentos anteriores</p>
              <ul className="space-y-1">
                {historial.slice(1).map((h, i) => (
                  <li key={i} className="font-mono text-xs text-muted-foreground">
                    {EMBEDDING_MODELS[h.modelo].label}: similitud {pct(h.similitud)} · distancia {h.distancia.toFixed(3)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground/70">
            Los umbrales son iniciales y se ajustan con casos reales. Esta pantalla es de prueba:
            no cambia el estatus de verificación del expediente.
          </p>
        </div>

        <div className={MODAL_FOOTER_CLS}>
          <Button variant="cancel" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button
            variant="primary-outline"
            onClick={comparar}
            disabled={!modelosListos || comparando || cargandoModelos}
          >
            {comparando ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Comparando...</>
            ) : (
              <><Camera className="h-4 w-4" /> Comparar ahora</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
