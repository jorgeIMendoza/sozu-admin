import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Datos de "Avance de obra" para el Portal Socio Bancario.
 *
 * Replica el esquema de la Oferta Comercial Digital
 * (src/lib/offers/use-offer-db.ts → OfferConstructionProgress):
 *   - % de avance global derivado de fechas del proyecto
 *     (fecha_lanzamiento → fecha_entrega_proyecto/fecha_entrega).
 *   - Etapas fijas con umbral global acumulado (DEFAULT_MILESTONES).
 *   - Videos de avance: videos_youtube filtrado por id_proyecto.
 *   - Fotos de avance: multimedias_proyecto con categoría "Avances de obra".
 */

export interface AvanceObraMilestone {
  phase: string;
  pct: number;
  done: boolean;
}

export interface AvanceObraVideo {
  id: number;
  nombre: string | null;
  embedUrl: string;
  fechaCreacion: string | null;
}

export interface AvanceObraFoto {
  src: string;
  alt: string;
  /** Fecha real de la foto (multimedias_proyecto.fecha_creacion), o null. */
  fecha: string | null;
  // SWAP POINT: descripción por foto — `multimedias_proyecto` no tiene columna
  // de descripción hoy. Cuando exista, exponerla aquí (no fabricar texto).
}

export interface AvanceObraData {
  progress: number;
  milestones: AvanceObraMilestone[];
  estimatedDelivery: string | null;
  lastUpdated: string | null;
  videos: AvanceObraVideo[];
  fotos: AvanceObraFoto[];
}

export interface ProyectoAvanceObra {
  id: number;
  nombre: string;
}

export const AVANCE_OBRA_MILESTONES: AvanceObraMilestone[] = [
  { phase: "Cimentación", pct: 5, done: false },
  { phase: "Estructura", pct: 28, done: false },
  { phase: "Albañilería", pct: 55, done: false },
  { phase: "Instalaciones", pct: 75, done: false },
  { phase: "Acabados", pct: 90, done: false },
  { phase: "Entrega", pct: 100, done: false },
];

function calcProgressFromDates(inicio: string | null, entrega: string | null): number {
  if (!inicio || !entrega) return 0;
  const start = new Date(inicio).getTime();
  const end = new Date(entrega).getTime();
  const now = Date.now();
  if (end <= start) return 0;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

function toEmbedUrl(url: string): string {
  if (!url) return url;
  if (url.includes("/embed/")) return url;
  const watchMatch = url.match(/[?&]v=([^&#]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const shortMatch = url.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  return url;
}

/** Proyectos activos y publicados para el selector. */
export function useProyectosAvanceObra() {
  return useQuery({
    queryKey: ["socio-bancario-avance-obra-proyectos"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ProyectoAvanceObra[]> => {
      const { data, error } = await (supabase as any)
        .from("proyectos")
        .select("id, nombre")
        .eq("activo", true)
        .eq("publicar", true)
        .order("nombre");
      if (error) throw error;
      return ((data || []) as Array<any>).map((p) => ({
        id: p.id as number,
        nombre: p.nombre as string,
      }));
    },
  });
}

export function useAvanceObraProyecto(proyectoId: number | null) {
  // TODO RLS: acotar server-side por desarrollo asignado al socio (Jorge).
  return useQuery({
    queryKey: ["socio-bancario-avance-obra", proyectoId],
    enabled: proyectoId !== null,
    staleTime: 60_000,
    queryFn: async (): Promise<AvanceObraData> => {
      // 1) Fechas del proyecto → % de avance global.
      // NOTA: este "% real" es una ESTIMACIÓN por tiempo transcurrido (no un
      // avance físico medido). No existe tabla de programa/baseline de obra en
      // la base → el "programado" y la curva programada se dejan como estado
      // vacío honesto en la UI. // SWAP POINT: tabla de programa de obra.
      const { data: proj, error: projErr } = await (supabase as any)
        .from("proyectos")
        .select(
          "id, fecha_inicio_construccion, fecha_lanzamiento, fecha_entrega_proyecto, fecha_entrega, fecha_actualizacion",
        )
        .eq("id", proyectoId)
        .maybeSingle();
      if (projErr) throw projErr;

      const inicio: string | null =
        proj?.fecha_inicio_construccion ?? proj?.fecha_lanzamiento ?? null;
      const entrega: string | null =
        proj?.fecha_entrega_proyecto ?? proj?.fecha_entrega ?? null;
      const progress = calcProgressFromDates(inicio, entrega);
      const milestones = AVANCE_OBRA_MILESTONES.map((m) => ({
        ...m,
        done: progress >= m.pct,
      }));

      // 2) Historial de videos de avance (más reciente primero).
      const { data: videoRows, error: vidErr } = await (supabase as any)
        .from("videos_youtube")
        .select("id, nombre, link, fecha_creacion")
        .eq("id_proyecto", proyectoId)
        .eq("activo", true)
        .order("id", { ascending: false })
        .limit(50);
      if (vidErr) throw vidErr;
      const videos: AvanceObraVideo[] = ((videoRows || []) as Array<any>)
        .filter((v) => v.link)
        .map((v) => ({
          id: v.id as number,
          nombre: (v.nombre ?? null) as string | null,
          embedUrl: toEmbedUrl(v.link as string),
          fechaCreacion: (v.fecha_creacion ?? null) as string | null,
        }));

      // 3) Fotos de avance de obra (categoría "Avances de obra").
      const { data: catRows, error: catErr } = await (supabase as any)
        .from("categorias_multimedia_proyecto")
        .select("id, nombre")
        .eq("activo", true);
      if (catErr) throw catErr;
      const avanceCatId = ((catRows || []) as Array<any>).find(
        (c) => (c.nombre as string)?.trim().toLowerCase() === "avances de obra",
      )?.id as number | undefined;

      let fotos: AvanceObraFoto[] = [];
      if (avanceCatId != null) {
        const { data: fotoRows, error: fotoErr } = await (supabase as any)
          .from("multimedias_proyecto")
          .select("id, url, id_categoria, fecha_creacion")
          .eq("id_proyecto", proyectoId)
          .eq("id_categoria", avanceCatId)
          .eq("es_imagen", true)
          .eq("activo", true)
          .order("fecha_creacion", { ascending: false, nullsFirst: false })
          .limit(50);
        if (fotoErr) throw fotoErr;
        fotos = ((fotoRows || []) as Array<any>)
          .filter((f) => f.url)
          .map((f) => ({
            src: f.url as string,
            // alt genérico para accesibilidad (no es una descripción real).
            alt: "Foto de avance de obra",
            fecha: (f.fecha_creacion ?? null) as string | null,
          }));
      }

      const lastUpdated: string | null =
        videos[0]?.fechaCreacion ?? proj?.fecha_actualizacion ?? null;

      return { progress, milestones, estimatedDelivery: entrega, lastUpdated, videos, fotos };
    },
  });
}
