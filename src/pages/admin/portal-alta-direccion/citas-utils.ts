/**
 * Tipos y helpers compartidos de "Citas Comerciales" (Portal Alta Dirección).
 *
 * Extraídos de `index.tsx` para poder reutilizarlos tanto en la vista de lista
 * como en la vista de calendario (`CitasCalendarView`) sin duplicar lógica ni
 * introducir dependencias circulares.
 */

export type CitaAgente = {
  nombre_legal: string;
  usuarios: { rol_id: number | null; roles: { nombre: string } | null }[] | null;
};

export type CitaRow = {
  id: number;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  fecha_creacion: string | null;
  id_estatus_cita: number | null;
  id_tipo_cita: number | null;
  estatus: string | null;
  activo: boolean;
  proyectos: { nombre: string } | null;
  estatus_cita: { nombre: string } | null;
  tipos_cita: { nombre: string } | null;
  /** Cliente / prospecto de la cita (FK id_persona_prospecto). */
  prospecto: { nombre_legal: string } | null;
  /** Quien reserva / asiste (FK id_persona). En Capacitación es el único que se llena. */
  persona: { nombre_legal: string } | null;
  agente: CitaAgente | null;
  /** Ubicación de la cita (p. ej. "Presencial", dirección del showroom). */
  ubicacion: string | null;
};

/**
 * Tipos de cita que NO tienen un agente acompañante distinto (p. ej.
 * Capacitación: es un agente tomando capacitación, no una visita comercial —
 * el asistente ES el agente). Mantener como constante nombrada — mañana pueden
 * ser más.
 */
export const TIPOS_CITA_SIN_CLIENTE_NI_AGENTE = new Set<number>([
  1, // Capacitación
]);

export function esCitaSinAgentePorDiseno(c: CitaRow): boolean {
  return c.id_tipo_cita != null && TIPOS_CITA_SIN_CLIENTE_NI_AGENTE.has(c.id_tipo_cita);
}

/**
 * Nombre a mostrar en la columna "Cliente / Asistente": el prospecto si existe,
 * si no el asistente (id_persona), si no "—". Cubre las citas de Capacitación,
 * que solo llenan id_persona.
 */
export function nombreAsistente(c: CitaRow): string {
  return c.prospecto?.nombre_legal ?? c.persona?.nombre_legal ?? "—";
}

/**
 * Nombre del agente a mostrar. Prioriza el agente acompañante (id_agente); en
 * citas de Capacitación no hay agente acompañante pero el asistente ES el agente
 * que se capacita, así que se muestra su nombre (antes salía "No aplica"). Si no
 * hay dato, "—".
 */
export function nombreAgente(c: CitaRow): string {
  if (c.agente?.nombre_legal) return c.agente.nombre_legal;
  if (esCitaSinAgentePorDiseno(c) && c.persona?.nombre_legal) return c.persona.nombre_legal;
  return "—";
}

/** Tono (clases Tailwind) por id de estatus de cita. */
export const ESTATUS_TONE: Record<number, string> = {
  1: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  2: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  3: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export const fmtFolio = (id: number) => `CITA-${String(id).padStart(4, "0")}`;
export const fmtHora = (t: string | null) => (t ? t.slice(0, 5) : "—");

export function fmtCreacion(ts: string | null): { fecha: string; hora: string } {
  if (!ts) return { fecha: "—", hora: "" };
  const d = new Date(ts);
  if (isNaN(d.getTime())) return { fecha: "—", hora: "" };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { fecha: `${yyyy}-${mm}-${dd}`, hora: `${hh}:${mi}` };
}

export function getAgenteRol(c: CitaRow): string | null {
  const u = c.agente?.usuarios?.[0];
  return u?.roles?.nombre || null;
}

export type EstadoKey =
  | "agendada"
  | "pendiente"
  | "confirmada"
  | "asistio"
  | "cancelada"
  | "otro";

export function getEstadoKey(c: CitaRow): EstadoKey {
  if (!c.activo || c.estatus === "cancelada") return "cancelada";
  if (c.estatus === "asistio") return "asistio";
  if (c.id_estatus_cita === 1) return "agendada";
  if (c.id_estatus_cita === 2) return "pendiente";
  if (c.id_estatus_cita === 3) return "confirmada";
  return "otro";
}

/** Etiqueta + tono del estado de una cita (unifica el mapeo usado en lista y calendario). */
export function getEstadoDisplay(c: CitaRow): { key: EstadoKey; label: string; tone: string } {
  const key = getEstadoKey(c);
  const tone =
    key === "cancelada"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : key === "asistio"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : c.id_estatus_cita
          ? ESTATUS_TONE[c.id_estatus_cita]
          : "bg-muted text-muted-foreground";
  const label =
    key === "cancelada"
      ? "Cancelada"
      : key === "asistio"
        ? "Asistió"
        : c.estatus_cita?.nombre || c.estatus || "—";
  return { key, label, tone: tone || "bg-muted text-muted-foreground" };
}
