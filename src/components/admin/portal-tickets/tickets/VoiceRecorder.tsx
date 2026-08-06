// Botón reusable para grabar una nota de voz con el micrófono (web o móvil).
// Devuelve un File de audio vía onRecorded. Hace feature-detection del formato
// porque iOS/Safari no soporta audio/webm (usa audio/mp4).
import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function pickAudioMime(): string {
  const MR: any = typeof MediaRecorder !== "undefined" ? MediaRecorder : null;
  if (MR?.isTypeSupported) {
    for (const m of ["audio/webm", "audio/mp4", "audio/ogg"]) {
      if (MR.isTypeSupported(m)) return m;
    }
  }
  return "";
}

export function VoiceRecorderButton({
  onRecorded,
  disabled,
}: {
  onRecorded: (file: File) => void;
  disabled?: boolean;
}) {
  const [grabando, setGrabando] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const soportado =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const iniciar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size) {
          onRecorded(new File([blob], `nota-voz-${crypto.randomUUID().slice(0, 8)}.${ext}`, { type }));
        }
      };
      recRef.current = rec;
      rec.start();
      setGrabando(true);
    } catch {
      toast.error("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  };

  const detener = () => {
    recRef.current?.stop();
    recRef.current = null;
    setGrabando(false);
  };

  if (!soportado) return null;

  return (
    <button
      type="button"
      onClick={grabando ? detener : iniciar}
      disabled={disabled && !grabando}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
        grabando
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary",
        disabled && !grabando && "cursor-not-allowed opacity-50",
      )}
    >
      {grabando ? <Square className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
      {grabando ? "Detener" : "Grabar voz"}
    </button>
  );
}
