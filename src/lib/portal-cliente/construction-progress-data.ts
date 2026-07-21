import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapEstatusCatalog, progressFromEstatus, milestonesFromEstatus } from "@/utils/avanceObra";

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
  id_categoria: number | null;
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

function applyProgressToMilestones(milestones: ConstructionMilestone[], pct: number): ConstructionMilestone[] {
  // done = etapa YA superada (pct estrictamente menor al avance). La etapa cuyo
  // pct == avance es la ACTUAL (no done) → coincide con el estatus seleccionado.
  return milestones.map((m) => ({ ...m, done: pct > m.pct }));
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
        { data: categoriasData, error: ec },
        { data: estatusCatalogRows },
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
          .select("id, url, id_categoria")
          .eq("id_proyecto", idProy)
          .eq("activo", true)
          .eq("es_imagen", true)
          .order("id", { ascending: false })
          .limit(50),
        supabase
          .from("categorias_multimedia_proyecto")
          .select("id, nombre")
          .eq("activo", true),
        (supabase as any)
          .from("estatus_proyecto")
          .select("*")
          .eq("activo", true),
      ]);
      if (ep) throw ep;
      if (ev) throw ev;
      if (ef) throw ef;
      if (ec) throw ec;

      const p = proyecto as ProyectoRow | null;
      if (!p) return null;

      // "Avances de obra" photos only (resolve id by name - ids differ dev/prod)
      const cats = (categoriasData ?? []) as { id: number; nombre: string }[];
      const avancesId = cats.find((c) => c.nombre === "Avances de obra")?.id ?? null;

      const videoRows = (videos ?? []) as VideoRow[];
      const fotoRows = ((fotos ?? []) as FotoRow[])
        .filter((f) => avancesId == null || f.id_categoria === avancesId)
        .slice(0, 6);

      const latest = videoRows[0];
      const featuredVideoUrl = latest ? toEmbedUrl(latest.link) : undefined;
      const featuredVideoTitle = latest?.nombre ?? "Recorrido del avance";

      const photos: ConstructionPhoto[] = fotoRows.map((f) => {
        const raw = f.url;
        if (!raw.includes(".supabase.co/storage/v1/object/public/")) return { url: raw, alt: `Foto ${p.nombre}` };
        const base = raw.split("?")[0];
        const optimized = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?quality=90&format=webp";
        return { url: optimized, alt: `Foto ${p.nombre}` };
      });

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

      // Avance de obra — fuente única: etapa (id_estatus_proyecto) del proyecto
      // vía catálogo estatus_proyecto.porcentaje_avance (mismo criterio que la
      // oferta digital / portal agente / Editar Proyecto).
      const estatusCatalog = mapEstatusCatalog((estatusCatalogRows ?? []) as any[]);
      const globalProgress = progressFromEstatus(estatusCatalog, p.id_estatus_proyecto);
      const rawMilestones = milestonesFromEstatus(estatusCatalog) as ConstructionMilestone[];
      const milestones = applyProgressToMilestones(rawMilestones, globalProgress);

      return {
        projectId: String(idProy),
        projectName: p.nombre,
        projectStatus: p.estatus_proyecto?.nombre ?? undefined,
        globalProgress,
        lastUpdated: latest ? fmtDateFromTs(latest.fecha_creacion) : "-",
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
      // "General" photos only (resolve id by name - ids differ dev/prod)
      const { data: categoriasData, error: ec } = await supabase
        .from("categorias_multimedia_proyecto")
        .select("id, nombre")
        .eq("activo", true);
      if (ec) throw ec;
      const cats = (categoriasData ?? []) as { id: number; nombre: string }[];
      const generalId = cats.find((c) => c.nombre === "General")?.id ?? null;

      let query = supabase
        .from("multimedias_proyecto")
        .select("id, url, id_categoria")
        .eq("id_proyecto", projectId!)
        .eq("activo", true)
        .eq("es_imagen", true);
      if (generalId != null) query = query.eq("id_categoria", generalId);
      const { data, error } = await query
        .order("id", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []).map((f) => {
        const raw = f.url as string;
        if (!raw.includes(".supabase.co/storage/v1/object/public/")) return { url: raw, alt: "" };
        const base = raw.split("?")[0];
        const optimized = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?quality=90&format=webp";
        return { url: optimized, alt: "" };
      });
    },
    enabled: !!projectId,
    staleTime: 300_000,
  });
}

// ── Fotos del modelo (galería interior del depto) ──

export function useModelPhotos(idModelo: number | null | undefined) {
  return useQuery({
    queryKey: ["model-photos", idModelo],
    queryFn: async (): Promise<ConstructionPhoto[]> => {
      const { data, error } = await supabase
        .from("multimedias_modelo")
        .select("id, url")
        .eq("id_modelo", idModelo!)
        .eq("activo", true)
        .eq("es_imagen", true)
        .order("id", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((f) => {
        const raw = f.url as string;
        if (!raw || !raw.includes(".supabase.co/storage/v1/object/public/")) return { url: raw, alt: "" };
        const base = raw.split("?")[0];
        const optimized = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?quality=90&format=webp";
        return { url: optimized, alt: "" };
      });
    },
    enabled: !!idModelo,
    staleTime: 300_000,
  });
}

// ── Pure helpers ──

export function shouldShowConstructionProgress(activeStageId: string | undefined): boolean {
  if (!activeStageId) return false;
  return ["preventa", "pago_final", "escrituracion", "entrega"].includes(activeStageId);
}
