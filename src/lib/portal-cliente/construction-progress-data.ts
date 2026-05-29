import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface ConstructionPhoto {
  url: string;
  alt: string;
}

export interface ConstructionMilestone {
  phase: string;
  pct: number;
  done: boolean;
}

export interface ConstructionUpdate {
  id: string;
  date: string;
  month: string;
  stage: string;
  progressPercent?: number;
  description: string;
  photos: ConstructionPhoto[];
  videoUrl?: string;
  videoTitle?: string;
}

export interface ConstructionProgressData {
  projectId: string;
  projectName: string;
  globalProgress: number;         // 0 until proyectos.porcentaje_avance column added
  lastUpdated: string;
  estimatedDelivery: string;
  milestones: ConstructionMilestone[];  // [] until proyectos.hitos_avance column added
  featuredVideoUrl?: string;
  featuredVideoTitle?: string;
  updates: ConstructionUpdate[];  // one entry per videos_youtube row
  photos: ConstructionPhoto[];    // project-level photos from multimedias_proyecto
}

// ── Helpers ──

function toEmbedUrl(url: string): string {
  if (!url) return url;
  if (url.includes("/embed/")) return url;
  const match = url.match(/[?&]v=([^&#]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}

function fmtDateFromTs(ts: string): string {
  return new Date(ts).toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtMonthFromTs(ts: string): string {
  return new Date(ts).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

// ── DB row shapes ──

interface VideoRow {
  id: number;
  nombre: string;
  link: string;
  fecha_creacion: string;
}

interface FotoRow {
  id: number;
  url: string;
}

interface ProyectoRow {
  id: number;
  nombre: string;
  fecha_entrega_proyecto: string | null;
  // porcentaje_avance and hitos_avance added via DDL — optional until migrated
  porcentaje_avance?: number | null;
  hitos_avance?: ConstructionMilestone[] | null;
}

// ── Hook ──

export function useConstructionProgress(cuentaId: string | undefined) {
  return useQuery({
    queryKey: ["construction-progress", cuentaId],
    queryFn: async (): Promise<ConstructionProgressData | null> => {
      // Step 1: resolve id_proyecto via cuenta → propiedad → edificio_modelo → edificio → proyecto
      const { data: cc, error: e0 } = await supabase
        .from("cuentas_cobranza")
        .select("id_propiedad")
        .eq("id", Number(cuentaId))
        .maybeSingle();
      if (e0) throw e0;
      if (!cc?.id_propiedad) return null;

      const { data: prop, error: e1 } = await supabase
        .from("propiedades")
        .select("id_edificio_modelo")
        .eq("id", cc.id_propiedad)
        .maybeSingle();
      if (e1) throw e1;
      if (!prop?.id_edificio_modelo) return null;

      const { data: em, error: e2 } = await supabase
        .from("edificios_modelos")
        .select("id_edificio")
        .eq("id", prop.id_edificio_modelo)
        .maybeSingle();
      if (e2) throw e2;
      if (!em?.id_edificio) return null;

      const { data: edificio, error: e3 } = await supabase
        .from("edificios")
        .select("id_proyecto")
        .eq("id", em.id_edificio)
        .maybeSingle();
      if (e3) throw e3;
      if (!edificio?.id_proyecto) return null;

      const idProy = edificio.id_proyecto as number;

      // Step 2: parallel fetch
      const [
        { data: proyecto, error: ep },
        { data: videos, error: ev },
        { data: fotos, error: ef },
      ] = await Promise.all([
        supabase
          .from("proyectos")
          .select("id, nombre, fecha_entrega_proyecto")
          .eq("id", idProy)
          .maybeSingle(),
        supabase
          .from("videos_youtube")
          .select("id, nombre, link, fecha_creacion")
          .eq("id_proyecto", idProy)
          .eq("activo", true)
          .order("id", { ascending: false }),
        supabase
          .from("multimedias_proyecto")
          .select("id, url")
          .eq("id_proyecto", idProy)
          .eq("activo", true)
          .eq("es_imagen", true)
          .order("id", { ascending: false })
          .limit(12),
      ]);
      if (ep) throw ep;
      if (ev) throw ev;
      if (ef) throw ef;

      const p = proyecto as ProyectoRow | null;
      if (!p) return null;

      const videoRows = (videos ?? []) as VideoRow[];
      const fotoRows = (fotos ?? []) as FotoRow[];

      const latest = videoRows[0];
      const featuredVideoUrl = latest ? toEmbedUrl(latest.link) : undefined;
      const featuredVideoTitle = latest?.nombre ?? "Recorrido del avance";

      const photos: ConstructionPhoto[] = fotoRows.map((f) => ({
        url: f.url,
        alt: `Foto ${p.nombre}`,
      }));

      const updates: ConstructionUpdate[] = videoRows.map((v, idx) => ({
        id: String(v.id),
        date: fmtDateFromTs(v.fecha_creacion),
        month: fmtMonthFromTs(v.fecha_creacion),
        stage: "",
        description: "",
        // attach project photos only to the latest update
        photos: idx === 0 ? photos : [],
        videoUrl: toEmbedUrl(v.link),
        videoTitle: v.nombre,
      }));

      return {
        projectId: String(idProy),
        projectName: p.nombre,
        globalProgress: p.porcentaje_avance ?? 0,
        lastUpdated: latest ? fmtDateFromTs(latest.fecha_creacion) : "—",
        estimatedDelivery: p.fecha_entrega_proyecto ?? "",
        milestones: (p.hitos_avance ?? []) as ConstructionMilestone[],
        featuredVideoUrl,
        featuredVideoTitle,
        updates,
        photos,
      };
    },
    enabled: !!cuentaId,
    staleTime: 120_000,
  });
}

// ── Lightweight photos-only hook (for card thumbnails) ──

export function useProjectPhotos(projectId: number | undefined) {
  return useQuery({
    queryKey: ["project-photos", projectId],
    queryFn: async (): Promise<ConstructionPhoto[]> => {
      const { data, error } = await supabase
        .from("multimedias_proyecto")
        .select("id, url")
        .eq("id_proyecto", projectId!)
        .eq("activo", true)
        .eq("es_imagen", true)
        .order("id", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []).map((f) => ({ url: f.url as string, alt: "" }));
    },
    enabled: !!projectId,
    staleTime: 300_000,
  });
}

// ── Pure helpers ──

export function shouldShowConstructionProgress(activeStageId: string | undefined): boolean {
  if (!activeStageId) return false;
  return ["preventa", "pago_final", "escrituracion", "entrega"].includes(activeStageId);
}
