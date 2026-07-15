// =============================================================
// Portal Condominio · Titularidad — helpers de presentación
// Semáforo, chips de estado y etiquetas. Colores SOZU (verde #57ae75 = primary).
// =============================================================
import { cn } from "@/lib/utils";
import type {
  AreaAsignada,
  EstadoSolicitud,
  EstadoValidacion,
  Semaforo,
  TipoPersona,
} from "./types";

export const SEMAFORO_LABEL: Record<Semaforo, string> = {
  verde: "Sin observaciones",
  ambar: "Requiere revisión",
  rojo: "Bandera roja",
};

const SEMAFORO_DOT: Record<Semaforo, string> = {
  verde: "bg-success",
  ambar: "bg-warning",
  rojo: "bg-destructive",
};

export function SemaforoIndicator({ s, withLabel = true }: { s: Semaforo; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", SEMAFORO_DOT[s])} />
      {withLabel && (
        <span
          className={cn(
            "text-[11px] font-medium whitespace-nowrap",
            s === "verde" ? "text-success" : s === "ambar" ? "text-warning" : "text-destructive",
          )}
        >
          {SEMAFORO_LABEL[s]}
        </span>
      )}
    </span>
  );
}

export const ESTADO_SOLICITUD_LABEL: Record<EstadoSolicitud, string> = {
  nueva: "Nueva",
  en_revision: "En revisión",
  info_solicitada: "Info solicitada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export const ESTADO_SOLICITUD_TONE: Record<
  EstadoSolicitud,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  nueva: "info",
  en_revision: "default",
  info_solicitada: "warning",
  aprobada: "success",
  rechazada: "danger",
};

export const ESTADO_VALIDACION_LABEL: Record<EstadoValidacion, string> = {
  validado: "Validado",
  rechazado: "Rechazado",
  por_confirmar: "Por confirmar",
  en_revision: "En revisión",
  expirado: "Expirado",
};

const ESTADO_VALIDACION_CLS: Record<EstadoValidacion, string> = {
  validado: "bg-success/15 text-success",
  rechazado: "bg-destructive/15 text-destructive",
  por_confirmar: "bg-warning/15 text-warning",
  en_revision: "bg-muted text-muted-foreground",
  expirado: "bg-destructive/15 text-destructive",
};

export function ChipEstadoValidacion({ estado }: { estado: EstadoValidacion }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap",
        ESTADO_VALIDACION_CLS[estado],
      )}
    >
      {ESTADO_VALIDACION_LABEL[estado]}
    </span>
  );
}

export const AREA_LABEL: Record<AreaAsignada, string> = {
  legal: "Legal",
  escrituracion: "Escrituración",
  administracion: "Administración",
  cobranza: "Cobranza",
};

export const TIPO_PERSONA_LABEL: Record<TipoPersona, string> = {
  fisica: "Persona física",
  moral: "Persona moral",
};

export function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function fmtFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
