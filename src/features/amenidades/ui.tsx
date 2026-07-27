// =============================================================
// Portal Condominio · Amenidades — helpers de presentación
// Paleta SOZU: verde=disponible, ámbar=apartado/por pagar, rojo=reservada,
// azul-gris=mantenimiento.
// =============================================================
import {
  Users, Tv, Flame, Utensils, User, Clock, Check, Wrench,
  Dumbbell, Sofa, Leaf, Wine, Gamepad2, Briefcase, Store, Trees, Building2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoSlot, ModalidadUso, ModeloCobro, TipoAmenidad } from "./types";

export const ESTADO_LABEL: Record<EstadoSlot, string> = {
  disponible: "Disponible",
  apartado: "Apartado",
  por_pagar: "Por pagar",
  reservada: "Reservada",
  mantenimiento: "Mantenimiento",
};

// Ícono por estado (identidad no-solo-por-color, accesible para daltonismo).
// Disponible no lleva ícono (celda limpia = libre).
export const ESTADO_ICON: Record<EstadoSlot, LucideIcon | null> = {
  disponible: null,
  apartado: User, // requiere acción del admin
  por_pagar: Clock, // en tránsito, esperando pago/STP
  reservada: Check, // éxito, confirmada
  mantenimiento: Wrench, // bloqueado
};

// Rayas diagonales para mantenimiento (bloqueado, no operable).
const RAYAS_MANTENIMIENTO =
  "[background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(100,116,139,0.14)_5px,rgba(100,116,139,0.14)_10px)]";

// Clases para celdas de calendario (fondo + borde + texto). Paleta semántica:
// disponible=verde, apartado=ámbar, por_pagar=azul, reservada=verde sólido,
// mantenimiento=gris azulado. El rojo se reserva para urgencia real.
export const ESTADO_CELDA: Record<EstadoSlot, string> = {
  disponible: "bg-success/10 border-success/40 text-success hover:bg-success/20",
  apartado: "bg-amber-100/70 border-amber-400 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300",
  por_pagar: "bg-blue-100/70 border-blue-400 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300",
  reservada: "bg-success/25 border-success text-success hover:bg-success/30",
  mantenimiento: cn(
    "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300",
    RAYAS_MANTENIMIENTO,
  ),
};

// Punto de color para leyendas/indicadores (mes). Reservada en verde oscuro
// para distinguirla de "disponible" en los puntos del mes.
export const ESTADO_DOT: Record<EstadoSlot, string> = {
  disponible: "bg-success",
  apartado: "bg-amber-500",
  por_pagar: "bg-blue-500",
  reservada: "bg-emerald-600",
  mantenimiento: "bg-slate-400",
};

export function EstadoBadge({ estado }: { estado: EstadoSlot }) {
  const cls: Record<EstadoSlot, string> = {
    disponible: "bg-success/15 text-success",
    apartado: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    por_pagar: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    reservada: "bg-success/20 text-success",
    mantenimiento: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  };
  const Icon = ESTADO_ICON[estado];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap", cls[estado])}>
      {Icon && <Icon className="h-3 w-3" />}
      {ESTADO_LABEL[estado]}
    </span>
  );
}

export const TIPO_ICON: Record<TipoAmenidad, LucideIcon> = {
  sala_juntas: Users,
  sala_tv: Tv,
  asador: Flame,
  cocina_equipada: Utensils,
  gimnasio: Dumbbell,
  lobby: Sofa,
  roof_garden: Leaf,
  sky_bar: Wine,
  sala_juegos: Gamepad2,
  coworking: Briefcase,
  area_comercial: Store,
  parque: Trees,
  otro: Building2,
};

export const TIPO_LABEL: Record<TipoAmenidad, string> = {
  sala_juntas: "Sala de juntas",
  sala_tv: "Sala de TV",
  asador: "Asador",
  cocina_equipada: "Cocina equipada",
  gimnasio: "Gimnasio",
  lobby: "Lobby",
  roof_garden: "Roof garden",
  sky_bar: "Sky bar",
  sala_juegos: "Sala de juegos",
  coworking: "Coworking",
  area_comercial: "Área comercial",
  parque: "Parque",
  otro: "Otro",
};

// ── Modalidad de uso ───────────────────────────────────────
export const MODALIDAD_LABEL: Record<ModalidadUso, string> = {
  libre: "Uso libre",
  reservable: "Reservable",
};

// ── Modelo de cobro (para el editor de ficha) ──────────────
export const MODELO_COBRO_LABEL: Record<ModeloCobro, string> = {
  gratuito: "Gratuito",
  por_franja: "Por franja",
  por_uso: "Por uso",
  por_hora: "Por hora",
};

export const MODELO_COBRO_AYUDA: Record<ModeloCobro, string> = {
  gratuito: "Sin costo. Se confirma al validar, sin paso de pago.",
  por_franja: "Tarifa fija por franja reservada.",
  por_uso: "Tarifa única por reservación, sin importar la duración.",
  por_hora: "El cobro se calcula sobre las horas de la franja; el calendario sigue siendo por bloques.",
};

export function Leyenda() {
  const estados: EstadoSlot[] = ["disponible", "apartado", "por_pagar", "reservada", "mantenimiento"];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {estados.map((e) => {
        const Icon = ESTADO_ICON[e];
        return (
          <span key={e} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "inline-flex h-4 w-4 items-center justify-center rounded border",
                ESTADO_CELDA[e],
              )}
            >
              {Icon && <Icon className="h-2.5 w-2.5" />}
            </span>
            {ESTADO_LABEL[e]}
          </span>
        );
      })}
    </div>
  );
}

// ── Formato ────────────────────────────────────────────────
export function fmtFecha(iso: string): string {
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function fmtFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Contador de caducidad: ms restantes → "46h 12m", "02h 05m" o "Vencido". */
export function fmtContador(restanteMs: number | null): { texto: string; urgente: boolean; vencido: boolean } {
  if (restanteMs == null) return { texto: "—", urgente: false, vencido: false };
  if (restanteMs <= 0) return { texto: "Vencido", urgente: true, vencido: true };
  const totalMin = Math.floor(restanteMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const texto = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  return { texto, urgente: restanteMs <= 3 * 3600_000, vencido: false };
}

// ── Fechas de calendario ───────────────────────────────────
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function inicioDeSemana(base: Date): Date {
  const d = new Date(base);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export function etiquetaDia(d: Date): { dow: string; num: string } {
  return { dow: DOW[(d.getDay() + 6) % 7], num: String(d.getDate()).padStart(2, "0") };
}
