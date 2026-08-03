// Capa de tipos y utilidades del Portal Tickets de Seguimiento.
// Los datos reales viven en Supabase (tablas tickets_*, ver migración
// 20260803120000_tickets_modelo.sql); la lógica de acceso está en tickets-store.tsx.
// Los ids se manejan como string en el front (los <select>/dataTransfer de HTML son
// strings); el store convierte a integer al escribir en BD.

export type Priority = "alta" | "media" | "baja" | "sin";

export type Ticket = {
  id: string;
  numero: number;
  nombre: string;
  pipelineId: string;
  etapaId: string;
  prioridad: Priority;
  categoriaId: string;
  propietarioId: string | null; // auth_user_id del usuario asignado; null = sin asignar
  solicitante: string;
  inmueble: string;
  descripcion: string;
  fechaCreacion: string;
  fechaCierre: string | null;
  fuente: string;
  // Enlace opcional al CRM / inventario (se llena con los selectores reales, ver Fase 2b)
  entidadRelacionadaId: string | null;
  propiedadId: string | null;
  actividad: { id: string; fecha: string; autor: string; texto: string }[];
};

export type Pipeline = { id: string; nombre: string; descripcion: string };
export type Etapa = {
  id: string;
  pipelineId: string;
  nombre: string;
  orden: number;
  cerrada: boolean;
};
export type Categoria = { id: string; nombre: string };
// Un "agente" del módulo = usuario real de la plataforma con acceso al portal de tickets.
export type Agente = { id: string; nombre: string; rol: string; email: string };

export const PRIORIDADES: { id: Priority; nombre: string }[] = [
  { id: "alta", nombre: "Alta" },
  { id: "media", nombre: "Media" },
  { id: "baja", nombre: "Baja" },
  { id: "sin", nombre: "Sin prioridad" },
];

export const FUENTES = ["Portal", "Correo", "Teléfono", "WhatsApp", "Visita en sitio"];

export function antiguedad(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias < 1) return "Abierto hoy";
  if (dias < 30) return `Abierto por ${dias} día${dias === 1 ? "" : "s"}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `Abierto por ${meses} mes${meses === 1 ? "" : "es"}`;
  const anios = Math.floor(meses / 12);
  return `Abierto por ${anios === 1 ? "un año" : `${anios} años`}`;
}

const TZ = "America/Mexico_City";

export function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
}

export function fechaLarga(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
