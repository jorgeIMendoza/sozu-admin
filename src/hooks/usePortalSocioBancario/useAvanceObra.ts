import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapEstatusCatalog, progressFromEstatus, milestonesFromEstatus } from "@/utils/avanceObra";

/**
 * Datos de "Avance de obra" para el Portal Socio Bancario.
 *
 * Replica el esquema de la Oferta Comercial Digital
 * (src/lib/offers/use-offer-db.ts → OfferConstructionProgress):
 *   - % de avance global = etapa del proyecto (id_estatus_proyecto) vía
 *     catálogo estatus_proyecto.porcentaje_avance (fuente única de verdad).
 *   - Etapas reales del catálogo de estatus (no plantilla fija).
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
  return useQuery({
    queryKey: ["socio-bancario-avance-obra", proyectoId],
    enabled: proyectoId !== null,
    staleTime: 60_000,
    queryFn: async (): Promise<AvanceObraData> => {
      // 1) Etapa del proyecto → % de avance global (fuente única de verdad).
      const [{ data: proj, error: projErr }, { data: estatusRows }] = await Promise.all([
        (supabase as any)
          .from("proyectos")
          .select("id, fecha_lanzamiento, fecha_entrega_proyecto, fecha_entrega, fecha_actualizacion, id_estatus_proyecto")
          .eq("id", proyectoId)
          .maybeSingle(),
        (supabase as any)
          .from("estatus_proyecto")
          .select("*")
          .eq("activo", true),
      ]);
      if (projErr) throw projErr;

      const entrega: string | null =
        proj?.fecha_entrega_proyecto ?? proj?.fecha_entrega ?? null;
      const estatusCatalog = mapEstatusCatalog((estatusRows ?? []) as any[]);
      const progress = progressFromEstatus(estatusCatalog, proj?.id_estatus_proyecto ?? null);
      const milestones: AvanceObraMilestone[] = milestonesFromEstatus(estatusCatalog).map((m) => ({
        ...m,
        done: progress > m.pct, // etapa superada; la == avance es la ACTUAL
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
          .select("id, url, id_categoria")
          .eq("id_proyecto", proyectoId)
          .eq("id_categoria", avanceCatId)
          .eq("es_imagen", true)
          .eq("activo", true)
          .order("id", { ascending: false })
          .limit(50);
        if (fotoErr) throw fotoErr;
        fotos = ((fotoRows || []) as Array<any>)
          .filter((f) => f.url)
          .map((f, i) => ({
            src: f.url as string,
            alt: `Avance de obra ${i + 1}`,
          }));
      }

      const lastUpdated: string | null =
        videos[0]?.fechaCreacion ?? proj?.fecha_actualizacion ?? null;

      return { progress, milestones, estimatedDelivery: entrega, lastUpdated, videos, fotos };
    },
  });
}
