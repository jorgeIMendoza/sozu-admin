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
  projectStatus?: string;
  globalProgress: number;
  lastUpdated: string;
  estimatedDelivery: string;
  milestones: ConstructionMilestone[];
  featuredVideoUrl?: string;
  featuredVideoTitle?: string;
  updates: ConstructionUpdate[];
  photos: ConstructionPhoto[];
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
  fecha_lanzamiento: string | null;
  fecha_entrega: string | null;
  id_estatus_proyecto: number | null;
  estatus_proyecto: { nombre: string } | null;
  porcentaje_avance?: number | null;
  hitos_avance?: ConstructionMilestone[] | null;
}

const DEFAULT_MILESTONES: ConstructionMilestone[] = [
  { phase: "Cimentación",   pct: 5,   done: false },
  { phase: "Estructura",    pct: 28,  done: false },
  { phase: "Albañilería",   pct: 55,  done: false },
  { phase: "Instalaciones", pct: 75,  done: false },
  { phase: "Acabados",      pct: 90,  done: false },
  { phase: "Entrega",       pct: 100, done: false },
];

function calcProgressFromDates(inicio: string | null, entrega: string | null): number {
  if (!inicio || !entrega) return 0;
  const start = new Date(inicio).getTime();
  const end   = new Date(entrega).getTime();
  const now   = Date.now();
  if (end <= start) return 0;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

function applyProgressToMilestones(milestones: ConstructionMilestone[], pct: number): ConstructionMilestone[] {
  return milestones.map((m) => ({ ...m, done: pct >= m.pct }));
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
          .select("id, nombre, fecha_lanzamiento, fecha_entrega, id_estatus_proyecto, estatus_proyecto(nombre)")
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
          .limit(6),
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

      const globalProgress = p.porcentaje_avance
        ?? calcProgressFromDates(p.fecha_lanzamiento, p.fecha_entrega);

      const rawMilestones = (p.hitos_avance ?? DEFAULT_MILESTONES) as ConstructionMilestone[];
      const milestones = applyProgressToMilestones(rawMilestones, globalProgress);

      return {
        projectId: String(idProy),
        projectName: p.nombre,
        projectStatus: p.estatus_proyecto?.nombre ?? undefined,
        globalProgress,
        lastUpdated: latest ? fmtDateFromTs(latest.fecha_creacion) : "—",
        estimatedDelivery: p.fecha_entrega ?? "",
        milestones,
        featuredVideoUrl,
        featuredVideoTitle,
        updates,
        photos,
      };
    },
    enabled: !!cuentaId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
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
