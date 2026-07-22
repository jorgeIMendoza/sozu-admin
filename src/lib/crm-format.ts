// Utilidades puras de formato/presentación del CRM, extraídas de crm.tsx.
// Sin React ni estado: formato de moneda/fecha, iniciales, tonos de etapa,
// recurrencia y catálogos fijos del negocio.

import { isToday, parseISO, format as fmtDateFns, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { fmtMXN } from "@/lib/crm-lib";

// Moneda con fallback a fmtMXN si el código de moneda es inválido.
export function fmtMoneda(v: number, moneda?: string): string {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "MXN", maximumFractionDigits: 0 }).format(v);
  } catch {
    return fmtMXN(v);
  }
}

// Quita tags HTML y colapsa espacios (para previews de notas).
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Iniciales (máx. 2) a partir de un nombre.
export function dealInitials(name?: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

export const BOARD_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
];

// Clases de color del pill de etapa (ganado/perdido/rotativo por índice).
export function etapaColorClasses(et: any, i: number): string {
  if (et?.es_ganado) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
  if (et?.es_perdido) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  return BOARD_COLORS[i % BOARD_COLORS.length];
}

// Avanza una fecha según la recurrencia de una tarea.
export function advanceByRecurrence(d: Date, rec: string): Date {
  switch (rec) {
    case "diaria": return addDays(d, 1);
    case "semanal": return addWeeks(d, 1);
    case "quincenal": return addWeeks(d, 2);
    case "mensual": return addMonths(d, 1);
    case "anual": return addYears(d, 1);
    default: return d;
  }
}

// Formato de vencimiento con hora cuando no es medianoche.
export function fmtDueDateTime(iso: string): string {
  const d = parseISO(iso);
  const base = isToday(d) ? "Hoy" : fmtDateFns(d, "dd MMM yyyy");
  return d.getHours() === 0 && d.getMinutes() === 0 ? base : `${base} · ${fmtDateFns(d, "HH:mm")}`;
}

// Rango de la cita (inicio–fin) legible.
export function fmtCitaWhen(inicio?: string | null, fin?: string | null): string {
  if (!inicio) return "Sin fecha";
  const di = parseISO(inicio);
  if (isNaN(di.getTime())) return "Sin fecha";
  const base = isToday(di) ? "Hoy" : fmtDateFns(di, "dd MMM yyyy");
  const hi = fmtDateFns(di, "HH:mm");
  if (fin) {
    const df = parseISO(fin);
    if (!isNaN(df.getTime())) return `${base} · ${hi}–${fmtDateFns(df, "HH:mm")}`;
  }
  return `${base} · ${hi}`;
}

// Catálogos fijos del negocio (según el form de HubSpot).
export const TIPO_NEGOCIO_OPTS: { value: string; label: string }[] = [
  { value: "cliente_nuevo", label: "Cliente nuevo" },
  { value: "cliente_existente", label: "Cliente existente" },
];
export const PRIORIDAD_META: Record<string, { label: string; dot: string }> = {
  baja: { label: "Baja", dot: "bg-emerald-500" },
  media: { label: "Media", dot: "bg-amber-500" },
  alta: { label: "Alta", dot: "bg-red-500" },
};
