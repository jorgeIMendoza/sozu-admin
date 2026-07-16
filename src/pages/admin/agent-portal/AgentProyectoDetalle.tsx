import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useAgentOnboardingStatus } from "@/hooks/useAgentOnboardingStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { Building2, MapPin, Calendar, CalendarPlus, Loader2, Download, Share2, ChevronRight, ChevronDown, HardHat, Maximize2, BedDouble, Bath, Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { GoogleMapComponent } from "@/components/admin/GoogleMapComponent";
import { VistasCarousel } from "@/components/admin/VistasCarousel";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import useEmblaCarousel from "embla-carousel-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgendarCitaShowroomDialog } from "@/components/admin/AgendarCitaShowroomDialog";
import { Globe, Play, X, ChevronLeft, CheckCircle2, Circle } from "lucide-react";
import { desarrolloUrl } from "@/utils/desarrolloUrl";
import { optimizedImage } from "@/utils/optimizedImage";
import { OptImg } from "@/components/ui/OptImg";

/** Monta children solo al entrar (o acercarse) al viewport — para diferir mapas/iframes pesados. */
const LazyVisible = ({ children, minHeight = 200, rootMargin = "250px" }: { children: ReactNode; minHeight?: number; rootMargin?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);
  return <div ref={ref} style={visible ? undefined : { minHeight }}>{visible ? children : null}</div>;
};

/** Facade de YouTube: muestra miniatura + botón; carga el iframe solo al hacer click. */
const YouTubeFacade = ({ embedUrl, title }: { embedUrl: string; title?: string }) => {
  const [play, setPlay] = useState(false);
  const id = embedUrl.split("/embed/")[1]?.split(/[?&]/)[0] || "";
  const thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
  if (play) {
    return (
      <iframe
        src={`${embedUrl}?autoplay=1`}
        className="w-full aspect-video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <button type="button" onClick={() => setPlay(true)} className="group relative block w-full aspect-video overflow-hidden bg-black" aria-label={`Reproducir ${title || "video"}`}>
      {thumb && <img src={thumb} alt={title || "Video"} className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" loading="lazy" decoding="async" />}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-105">
          <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
        </span>
      </span>
    </button>
  );
};

const ModelCardCarousel = ({ images, alt }: { images: string[]; alt: string }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, dragFree: false });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  if (images.length === 1) {
    return <img src={optimizedImage(images[0], { width: 560, resize: "cover" })} alt={alt} className="w-full h-40 object-cover" loading="lazy" decoding="async" />;
  }

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {images.map((url, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0">
              <img src={optimizedImage(url, { width: 560, resize: "cover" })} alt={`${alt} ${i + 1}`} className="w-full h-40 object-cover" loading="lazy" decoding="async" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); emblaApi?.scrollTo(i); }}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === selectedIndex ? 'bg-white' : 'bg-white/50'}`}
          />
        ))}
      </div>
      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-medium text-white">
        {selectedIndex + 1}/{images.length}
      </div>
    </div>
  );
};

/** Visor a pantalla completa con flechas + puntos. Portal a <body> + bloqueo de scroll. */
const Lightbox = ({ images, index, onClose, onIndex }: { images: string[]; index: number; onClose: () => void; onIndex: (i: number) => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onIndex]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"><X className="h-5 w-5" /></button>
      <div className="flex-1 flex items-center justify-center px-4 py-14" onClick={(e) => e.stopPropagation()}>
        <img src={optimizedImage(images[index], { width: 1600 })} alt="" className="max-h-[82vh] max-w-full object-contain rounded-md" decoding="async" />
      </div>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length); }} className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
          <button onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length); }} className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
          <div className="pb-6 flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {images.map((_, i) => (
              <button key={i} onClick={() => onIndex(i)} className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
};

/** Portada = carrusel de galería, click → pantalla completa. */
const HeroGallery = ({ images, projectName, direccion, avanceObra, badgeText, onOpenFull }: {
  images: string[]; projectName: string; direccion?: string; avanceObra: number; badgeText: string; onOpenFull: (i: number) => void;
}) => {
  const [ref, api] = useEmblaCarousel({ loop: images.length > 1 });
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!api) return;
    const on = () => setIdx(api.selectedScrollSnap());
    api.on("select", on); on();
    return () => { api.off("select", on); };
  }, [api]);
  return (
    <div className="relative h-56 lg:h-80 w-full overflow-hidden">
      <div className="h-full overflow-hidden" ref={ref}>
        <div className="flex h-full">
          {images.map((url, i) => (
            <div key={i} onClick={() => onOpenFull(i)} className="relative flex-[0_0_100%] min-w-0 h-full cursor-zoom-in">
              <OptImg src={url} w={1400} resize="cover" loading={i === 0 ? "eager" : "lazy"} alt={projectName} className="h-full w-full object-cover object-center" />
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      {images.length > 1 && (
        <>
          <button onClick={() => api?.scrollPrev()} className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => api?.scrollNext()} className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"><ChevronRight className="h-5 w-5" /></button>
          <div className="absolute top-3 right-3 rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">{idx + 1}/{images.length}</div>
        </>
      )}
      {avanceObra > 0 && (
        <div className="absolute bottom-20 left-4 bg-[#16A45E] rounded-md px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
          <HardHat className="h-3.5 w-3.5 text-white" /><span className="text-xs font-semibold text-white">{badgeText}</span>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4">
        <h1 className="font-bold text-xl text-white leading-tight">{projectName}</h1>
        {direccion && <p className="text-xs text-white/80 flex items-center gap-1 mt-1"><MapPin className="h-3 w-3 flex-shrink-0" /> <span className="line-clamp-2">{direccion}</span></p>}
      </div>
    </div>
  );
};

const AgentProyectoDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { impersonatedAgentPersonaId, isImpersonating } = useAgentImpersonation();
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;
  const isAgentRole = profile?.rol_nombre === 'Agente Inmobiliario';
  const { hasTrainingComplete, isLoading: onboardingLoading } = useAgentOnboardingStatus(personaId);
  const { permissions } = useAgentPortalPermissions();
  const inventarioPerms = permissions['/admin/agent/inventario'];
  const { registrarVista, registrarExportacion } = useActivityLogger();
  const { track } = useCtaTracker();
  const [shareOpen, setShareOpen] = useState(false);
  const [agendarCitaOpen, setAgendarCitaOpen] = useState(false);
  const [showAllAmenidades, setShowAllAmenidades] = useState(false);
  const [planoModeloUrl, setPlanoModeloUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [showAllStages, setShowAllStages] = useState(false);
  const modelosRef = useRef<HTMLDivElement>(null);

  // Log page view
  useEffect(() => {
    if (projectId > 0) {
      registrarVista(`/admin/agent/inventario/proyecto/${projectId}`, { proyecto_id: projectId });
      track({ page: 'agent_detalle_desarrollo', elementId: 'page_view', elementType: 'page', metadata: { proyecto_id: projectId } });
    }
  }, [projectId]);

  const handleShareMethod = (method: string) => {
    const name = project?.nombre || "";
    track({ page: 'agent_detalle_desarrollo', elementId: 'btn_compartir_plataforma', elementLabel: `Compartir ${method}`, metadata: { plataforma: method, proyecto_id: projectId } });
    switch (method) {
      case "web":
        window.open(publicUrl, "_blank");
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(`${name}\n${publicUrl}`)}`, "_blank");
        break;
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, "_blank");
        break;
      case "email":
        window.open(`mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(`${name}\n${project?.direccion || ''}\n${publicUrl}`)}`, "_blank");
        break;
      case "copy":
        navigator.clipboard.writeText(publicUrl);
        toast({ title: "Copiado", description: "Link copiado al portapapeles." });
        break;
    }
    setShareOpen(false);
  };

  // Fetch project data
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["agent-proyecto-detalle", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proyectos")
        .select("id, nombre, descripcion, direccion, url_imagen_portada, fecha_entrega, fecha_entrega_proyecto, fecha_inicio_construccion, id_estatus_proyecto, latitud, longitud")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: projectId > 0,
  });

  const publicUrl = desarrolloUrl(project?.nombre || "");

  // Fetch estatus_proyecto for avance calculation
  const { data: estatusData } = useQuery({
    queryKey: ["estatus-proyecto-all"],
    queryFn: async () => {
      const { data: allEstatus } = await (supabase as any)
        .from("estatus_proyecto")
        .select("id, nombre")
        .eq("activo", true)
        .order("id");
      return allEstatus || [];
    },
  });

  // Calculate avance from estatus
  const totalEstatus = estatusData?.length || 13;
  const idEstatus = project?.id_estatus_proyecto || 0;
  const avanceObra = totalEstatus > 0 ? Math.round((idEstatus / totalEstatus) * 100) : 0;
  const nombreEstatus = estatusData?.find((e: any) => e.id === idEstatus)?.nombre || "";

  // Fetch amenidades
  const { data: amenidades = [] } = useQuery({
    queryKey: ["agent-proyecto-amenidades", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("amenidades_proyectos")
        .select("amenidades(id, nombre, url)")
        .eq("id_proyecto", projectId)
        .eq("activo", true);
      if (error) throw error;
      return (data || []).map((a: any) => a.amenidades).filter(Boolean);
    },
    enabled: projectId > 0,
  });

  // Fetch stats (available/total)
  const { data: stats } = useQuery({
    queryKey: ["agent-proyecto-stats", projectId],
    queryFn: async () => {
      const { data: edificios } = await (supabase as any)
        .from("edificios").select("id").eq("id_proyecto", projectId).eq("activo", true);
      if (!edificios?.length) return { available: 0, total: 0 };

      const edIds = edificios.map((e: any) => e.id);
      const { data: edModelos } = await (supabase as any)
        .from("edificios_modelos").select("id").in("id_edificio", edIds);
      if (!edModelos?.length) return { available: 0, total: 0 };

      const emIds = edModelos.map((em: any) => em.id);
      const { data: props } = await (supabase as any)
        .from("propiedades")
        .select("id, id_estatus_disponibilidad")
        .eq("activo", true).eq("es_aprobado", true)
        .in("id_edificio_modelo", emIds);

      let available = 0, total = 0;
      (props || []).forEach((p: any) => {
        total++;
        if (p.id_estatus_disponibilidad === 2) available++;
      });
      return { available, total };
    },
    enabled: projectId > 0,
  });

  // Fetch puntos de interés
  const { data: puntosInteres = [] } = useQuery({
    queryKey: ["agent-puntos-interes", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("puntos_interes_proyecto")
        .select("*")
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .order("fecha_creacion");
      if (error) throw error;
      return data || [];
    },
    enabled: projectId > 0,
  });

  // Fetch brochure & ficha técnica
  const { data: documentos = [] } = useQuery({
    queryKey: ["agent-proyecto-docs", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos")
        .select("id, url, id_tipo_documento")
        .eq("id_proyecto", projectId)
        .in("id_tipo_documento", [30, 49])
        .eq("activo", true);
      if (error) throw error;
      return data || [];
    },
    enabled: projectId > 0,
  });

   // Fetch vistas del proyecto
   const { data: vistas = [] } = useQuery({
     queryKey: ["agent-proyecto-vistas", projectId],
     queryFn: async () => {
       const { data, error } = await (supabase as any)
         .from("vistas")
         .select("id, nombre, url")
         .eq("id_proyecto", projectId)
         .eq("activo", true)
         .order("nombre");
       if (error) throw error;
       return data || [];
     },
     enabled: projectId > 0,
   });

   // Fetch galería multimedia (images)
   const { data: multimedia = [] } = useQuery({
    queryKey: ["agent-proyecto-multimedia", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("multimedias_proyecto")
        .select("id, url")
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .eq("es_imagen", true);
      if (error) throw error;
      return data || [];
    },
    enabled: projectId > 0,
  });

  // Fetch most recent YouTube video
  const { data: latestVideo } = useQuery({
    queryKey: ["agent-proyecto-latest-video", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("videos_youtube")
        .select("id, link, nombre")
        .eq("id_proyecto", projectId)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: projectId > 0,
  });

  // Fetch modelos del proyecto with m2 and price
  const { data: modelos = [] } = useQuery({
    queryKey: ["agent-proyecto-modelos", projectId],
    queryFn: async () => {
      // Get edificios for this project
      const { data: edificios } = await (supabase as any)
        .from("edificios").select("id").eq("id_proyecto", projectId).eq("activo", true);
      if (!edificios?.length) return [];

      const edIds = edificios.map((e: any) => e.id);

      // Get edificios_modelos with modelo info
      const { data: edModelos, error: emError } = await (supabase as any)
        .from("edificios_modelos")
        .select("id, id_modelo, id_edificio, modelos!fk_edificios_modelos_modelo(id, nombre, numero_recamaras, numero_completo_banos, numero_medio_bano, url_imagen_portada, plano_arquitectonico)")
        .in("id_edificio", edIds);

      if (emError) { console.error("edModelos error:", emError); return []; }
      if (!edModelos?.length) return [];

      // Get min price and m2 per modelo from propiedades
      const emIds = edModelos.map((em: any) => em.id);
      const { data: props } = await (supabase as any)
        .from("propiedades")
        .select("id, precio_lista, m2_construccion, id_edificio_modelo, id_estatus_disponibilidad")
        .eq("activo", true)
        .eq("es_aprobado", true)
        .in("id_edificio_modelo", emIds);

      // Group by modelo
      const modeloMap = new Map<number, { modelo: any; minPrice: number; m2: number; emIds: number[]; availableCount: number }>();
      edModelos.forEach((em: any) => {
        if (!em.modelos) return;
        const mid = em.modelos.id;
        if (!modeloMap.has(mid)) {
          modeloMap.set(mid, { modelo: em.modelos, minPrice: Infinity, m2: 0, emIds: [], availableCount: 0 });
        }
        modeloMap.get(mid)!.emIds.push(em.id);
      });

      (props || []).forEach((p: any) => {
        const em = edModelos.find((e: any) => e.id === p.id_edificio_modelo);
        if (!em?.modelos) return;
        const entry = modeloMap.get(em.modelos.id);
        if (!entry) return;
        if (p.id_estatus_disponibilidad === 2) {
          entry.availableCount++;
          if (p.precio_lista > 0 && p.precio_lista < entry.minPrice) {
            entry.minPrice = p.precio_lista;
          }
        }
        if (p.m2_construccion > 0 && (entry.m2 === 0 || p.m2_construccion < entry.m2)) {
          entry.m2 = p.m2_construccion;
        }
      });

      // Fetch floor plans for each edificio_modelo
      const { data: planos } = await (supabase as any)
        .from("modelos_planos_arquitectonicos")
        .select("id, id_edificio_modelo, imagen_url")
        .in("id_edificio_modelo", emIds)
        .eq("activo", true);

      // Find the most common floor plan per modelo (the one appearing in most edificio_modelos)
      const planosPorModelo = new Map<number, string>();
      if (planos?.length) {
        for (const [mid, entry] of modeloMap.entries()) {
          const modelPlanos = planos.filter((pl: any) => entry.emIds.includes(pl.id_edificio_modelo));
          if (modelPlanos.length > 0) {
            // Count occurrences of each imagen_url
            const urlCounts = new Map<string, number>();
            modelPlanos.forEach((pl: any) => {
              urlCounts.set(pl.imagen_url, (urlCounts.get(pl.imagen_url) || 0) + 1);
            });
            // Pick the most frequent
            let bestUrl = modelPlanos[0].imagen_url;
            let bestCount = 0;
            urlCounts.forEach((count, url) => { if (count > bestCount) { bestCount = count; bestUrl = url; } });
            planosPorModelo.set(mid, bestUrl);
          }
        }
      }

      // Fetch multimedia images per modelo
      const modeloIds = Array.from(modeloMap.keys());
      const { data: multimediaModelos } = await (supabase as any)
        .from("multimedias_modelo")
        .select("id, id_modelo, url")
        .in("id_modelo", modeloIds)
        .eq("activo", true)
        .eq("es_imagen", true);

      const multimediaPorModelo = new Map<number, string[]>();
      (multimediaModelos || []).forEach((mm: any) => {
        if (!multimediaPorModelo.has(mm.id_modelo)) {
          multimediaPorModelo.set(mm.id_modelo, []);
        }
        multimediaPorModelo.get(mm.id_modelo)!.push(mm.url);
      });

      return Array.from(modeloMap.values()).map(v => ({
        ...v.modelo,
        minPrice: v.minPrice === Infinity ? null : v.minPrice,
        m2: v.m2 || null,
        availableCount: v.availableCount,
        planoUrl: planosPorModelo.get(v.modelo.id) || null,
        multimediaImages: multimediaPorModelo.get(v.modelo.id) || [],
      }));
    },
    enabled: projectId > 0,
  });

  const brochure = documentos.find((d: any) => d.id_tipo_documento === 30);
  const fichaTecnica = documentos.find((d: any) => d.id_tipo_documento === 49);

  const getYoutubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);

  // Portada primero, luego el resto de la galería (sin duplicar)
  const galleryImages: string[] = (() => {
    const arr: string[] = [];
    if (project?.url_imagen_portada) arr.push(project.url_imagen_portada);
    multimedia.forEach((m: any) => { if (m.url && !arr.includes(m.url)) arr.push(m.url); });
    return arr;
  })();
  const openLightbox = (imgs: string[], i = 0) => { if (imgs.length) setLightbox({ images: imgs, index: i }); };
  const latestVideoEmbed = latestVideo ? getYoutubeEmbedUrl(latestVideo.link) : null;
  const modeloImages = (m: any): string[] => {
    const imgs: string[] = [];
    if (m.url_imagen_portada) imgs.push(m.url_imagen_portada);
    (m.multimediaImages || []).forEach((u: string) => { if (u && !imgs.includes(u)) imgs.push(u); });
    if (m.plano_arquitectonico && !imgs.includes(m.plano_arquitectonico)) imgs.push(m.plano_arquitectonico);
    return imgs;
  };

  if (loadingProject) {
    return (
      <div className="pb-24">
        <AgentPortalHeader />
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="pb-24">
        <AgentPortalHeader />
        <div className="text-center py-12 text-sm text-muted-foreground">Proyecto no encontrado</div>
      </div>
    );
  }

  const list = showAllAmenidades ? amenidades : amenidades.slice(0, 8);
  const avanceBadge = avanceObra >= 100 ? (nombreEstatus || "Finalizado") : `${avanceObra}% avance de obra`;
  const stages = estatusData || [];
  const visibleStages = showAllStages ? stages : stages.slice(0, 5);

  return (
    <div className="pb-24 bg-[hsl(var(--agent-bg))]">
      {/* Portada = carrusel de galería */}
      {galleryImages.length > 0 ? (
        <HeroGallery
          images={galleryImages}
          projectName={project.nombre}
          direccion={project.direccion}
          avanceObra={avanceObra}
          badgeText={avanceBadge}
          onOpenFull={(i) => openLightbox(galleryImages, i)}
        />
      ) : (
        <div className="relative h-56 lg:h-80 w-full overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
          <Building2 className="h-12 w-12 text-gray-400" />
          <div className="absolute bottom-0 left-0 right-0 p-4"><h1 className="font-bold text-xl text-white leading-tight">{project.nombre}</h1></div>
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div className="px-4 lg:px-8 -mt-2">
          <div className="mx-auto max-w-[1000px] bg-white rounded-md shadow-sm border border-gray-100 grid grid-cols-2 divide-x divide-gray-100">
            <div className="text-center py-3">
              <p className="text-2xl font-bold text-[hsl(var(--agent-primary))] tabular-nums">{stats.available}</p>
              <p className="text-[11px] font-semibold text-[hsl(var(--agent-primary))]/80">Disponibles</p>
            </div>
            <div className="text-center py-3">
              <p className="text-2xl font-bold text-foreground tabular-nums">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Total unidades</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1000px] px-4 lg:px-8 mt-5 space-y-7">
        {/* Concepto */}
        {project.descripcion && (
          <section>
            <h2 className="text-xs font-semibold text-[hsl(var(--agent-primary))] tracking-widest uppercase mb-2">Concepto</h2>
            <p className="text-sm text-foreground leading-relaxed">{project.descripcion}</p>
            {(project.fecha_entrega || project.fecha_entrega_proyecto) && (
              <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[#4B5563]">
                <Calendar className="h-4 w-4 text-[hsl(var(--agent-primary))]" />
                Fecha de entrega:{" "}
                <span className="font-bold text-foreground">
                  {new Date(project.fecha_entrega || project.fecha_entrega_proyecto).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </span>
              </p>
            )}
          </section>
        )}

        {/* Modelos (arriba, debajo de Concepto) */}
        {modelos.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-[hsl(var(--agent-primary))] tracking-widest uppercase mb-3">Modelos</h2>
            <div className="relative">
              <div ref={modelosRef} className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-1">
                {modelos.map((m: any) => {
                  const imgs = modeloImages(m);
                  return (
                    <div key={m.id} className="snap-start min-w-[260px] max-w-[280px] flex-shrink-0 bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
                      <div className="cursor-zoom-in" onClick={() => imgs.length && openLightbox(imgs, 0)}>
                        {imgs.length > 0 ? (
                          <ModelCardCarousel images={imgs} alt={m.nombre} />
                        ) : (
                          <div className="w-full h-40 bg-gray-100 flex items-center justify-center"><Building2 className="h-10 w-10 text-gray-300" /></div>
                        )}
                      </div>
                      <div className="p-3.5">
                        <p className="text-base font-bold text-foreground">{m.nombre}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {m.m2 && <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" />{m.m2} m²</span>}
                          {m.numero_recamaras > 0 && <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{m.numero_recamaras} rec</span>}
                          {m.numero_completo_banos > 0 && <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{m.numero_completo_banos} baños</span>}
                        </div>
                        {m.minPrice && (
                          <div className="mt-2">
                            <p className="text-[10px] text-muted-foreground">Desde</p>
                            <p className="text-base font-bold text-foreground">{formatCurrency(m.minPrice)}</p>
                          </div>
                        )}
                        {m.availableCount > 0 && (
                          <button
                            onClick={() => { track({ page: 'agent_detalle_desarrollo', elementId: 'btn_ver_inventario_modelo', elementLabel: 'Ver inventario', metadata: { modelo_id: m.id } }); navigate(`/admin/agent/inventario/unidades?proyecto=${projectId}&modelo=${m.id}`); }}
                            className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-md bg-[hsl(var(--agent-primary))] py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
                          >
                            Ver inventario <ChevronRight className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {modelos.length > 1 && (
                <>
                  <button onClick={() => modelosRef.current?.scrollBy({ left: -320, behavior: 'smooth' })} className="hidden md:flex absolute -left-3 top-[72px] h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm items-center justify-center hover:bg-gray-50"><ChevronLeft className="h-5 w-5 text-gray-600" /></button>
                  <button onClick={() => modelosRef.current?.scrollBy({ left: 320, behavior: 'smooth' })} className="hidden md:flex absolute -right-3 top-[72px] h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm items-center justify-center hover:bg-gray-50"><ChevronRight className="h-5 w-5 text-gray-600" /></button>
                </>
              )}
            </div>
          </section>
        )}

        {/* Amenidades — texto (+ imagen si existe) */}
        {amenidades.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-[hsl(var(--agent-primary))] tracking-widest uppercase mb-3">Amenidades</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {list.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2.5 bg-white rounded-md border border-gray-100 p-2.5">
                  {a.url ? (
                    <OptImg src={a.url} w={72} h={72} resize="cover" alt={a.nombre} className="h-9 w-9 rounded-md object-cover shrink-0" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--agent-primary))] shrink-0" />
                  )}
                  <span className="text-[12px] font-medium text-foreground leading-tight">{a.nombre}</span>
                </div>
              ))}
            </div>
            {amenidades.length > 8 && (
              <button
                onClick={() => setShowAllAmenidades(!showAllAmenidades)}
                className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-[hsl(var(--agent-primary))]"
              >
                {showAllAmenidades ? 'Ver menos' : `Ver todas (${amenidades.length})`}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllAmenidades ? 'rotate-180' : ''}`} />
              </button>
            )}
          </section>
        )}

        {/* Vistas */}
        {vistas.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-[hsl(var(--agent-primary))] tracking-widest uppercase mb-3">Vistas</h2>
            <VistasCarousel vistas={vistas} />
          </section>
        )}

        {/* Ubicación + Puntos de interés — 2 cards en la misma fila */}
        {(project.direccion || (project.latitud && project.longitud) || puntosInteres.length > 0) && (
          <section className="grid gap-4 md:grid-cols-8">
            {(project.direccion || (project.latitud && project.longitud)) && (
              <div className="md:col-span-5 bg-white rounded-md border border-gray-100 p-4">
                <h2 className="text-xs font-semibold text-[hsl(var(--agent-primary))] tracking-widest uppercase mb-3">Ubicación</h2>
                {project.latitud && project.longitud && (
                  <div className="rounded-md overflow-hidden border border-gray-100 mb-3">
                    <LazyVisible minHeight={300}>
                      <GoogleMapComponent onLocationSelect={() => {}} initialLocation={{ lat: project.latitud, lng: project.longitud }} readOnly />
                    </LazyVisible>
                  </div>
                )}
                {project.direccion && (
                  <p className="text-sm text-foreground flex items-start gap-1.5">
                    <MapPin className="h-4 w-4 text-[hsl(var(--agent-primary))] flex-shrink-0 mt-0.5" />
                    {project.direccion}
                  </p>
                )}
              </div>
            )}
            {puntosInteres.length > 0 && (
              <div className="md:col-span-3 bg-white rounded-md border border-gray-100 p-4">
                <h2 className="text-xs font-semibold text-[hsl(var(--agent-primary))] tracking-widest uppercase mb-3">Puntos de interés</h2>
                <div className="space-y-2">
                  {puntosInteres.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-md bg-[#F6F7F8] px-3 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--agent-primary))]/10">
                        <MapPin className="h-3.5 w-3.5 text-[hsl(var(--agent-primary))]" />
                      </span>
                      <span className="flex-1 text-sm text-foreground leading-tight">{p.nombre}</span>
                      <span className="text-xs font-semibold text-[#4B5563] tabular-nums whitespace-nowrap">
                        {p.distancia_km < 1 ? `${(p.distancia_km * 1000).toFixed(0)} m` : `${p.distancia_km} km`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Avance de obra — video (izq) + desglose (der) */}
        {(avanceObra > 0 || latestVideoEmbed) && (
          <section>
            <h2 className="text-xs font-semibold text-[hsl(var(--agent-primary))] tracking-widest uppercase mb-3">Avance de obra</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {latestVideoEmbed && (
                <div className="rounded-md overflow-hidden border border-gray-100 bg-white self-start">
                  <YouTubeFacade embedUrl={latestVideoEmbed} title={latestVideo?.nombre} />
                  {latestVideo?.nombre && <p className="px-4 py-3 text-sm font-medium text-foreground">{latestVideo.nombre}</p>}
                </div>
              )}
              {avanceObra > 0 && (
                <div className="bg-white rounded-md border border-gray-100 p-4 md:p-5 self-start">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Avance global del proyecto</span>
                    <span className="text-2xl font-bold text-[hsl(var(--agent-primary))] tabular-nums">{avanceObra}%</span>
                  </div>
                  <Progress value={avanceObra} className="h-2 mb-1" />
                  {nombreEstatus && <p className="text-[11px] text-muted-foreground mb-4">Etapa actual: <span className="font-semibold text-foreground">{nombreEstatus}</span></p>}
                  <ul className="space-y-2.5">
                    {visibleStages.map((e: any) => {
                      const done = e.id <= idEstatus;
                      const pct = Math.round((e.id / (stages.length || 1)) * 100);
                      return (
                        <li key={e.id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            {done ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--agent-primary))]" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                            <span className={done ? "text-foreground" : "text-muted-foreground"}>{e.nombre}</span>
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                        </li>
                      );
                    })}
                  </ul>
                  {stages.length > 5 && (
                    <button
                      onClick={() => setShowAllStages((v) => !v)}
                      className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-[hsl(var(--agent-primary))]"
                    >
                      {showAllStages ? "Ver menos etapas" : `Ver ${stages.length - 5} etapas más`}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllStages ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  {(project.fecha_entrega || project.fecha_entrega_proyecto) && (
                    <p className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      Entrega estimada · {new Date(project.fecha_entrega || project.fecha_entrega_proyecto).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Material comercial */}
        {(brochure || fichaTecnica) && (
          <section>
            <h2 className="text-xs font-semibold text-[hsl(var(--agent-primary))] tracking-widest uppercase mb-3">Material comercial</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {brochure && (
                <div
                  className="bg-white rounded-md border border-gray-100 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => { track({ page: 'agent_detalle_desarrollo', elementId: 'btn_descargar_brochure', elementLabel: 'Brochure' }); registrarExportacion('brochure', { proyecto_id: projectId }); window.open(brochure.url, '_blank'); }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-[hsl(var(--agent-primary))]/10 flex items-center justify-center"><Download className="h-5 w-5 text-[hsl(var(--agent-primary))]" /></div>
                    <div><p className="text-sm font-semibold text-foreground">Brochure</p><p className="text-[11px] text-muted-foreground">PDF · Presentación</p></div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              {fichaTecnica && (
                <div
                  className="bg-white rounded-md border border-gray-100 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => { track({ page: 'agent_detalle_desarrollo', elementId: 'btn_descargar_ficha', elementLabel: 'Ficha técnica' }); registrarExportacion('ficha_tecnica', { proyecto_id: projectId }); window.open(fichaTecnica.url, '_blank'); }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-[hsl(var(--agent-primary))]/10 flex items-center justify-center"><Download className="h-5 w-5 text-[hsl(var(--agent-primary))]" /></div>
                    <div><p className="text-sm font-semibold text-foreground">Ficha técnica</p><p className="text-[11px] text-muted-foreground">PDF · Especificaciones</p></div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* CTA — botones en una sola fila */}
        <section className="rounded-md bg-[hsl(var(--agent-primary))]/[0.08] p-5">
          <p className="mb-3 text-center text-sm font-semibold text-foreground">¿Tu cliente está interesado en este proyecto?</p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={() => { track({ page: 'agent_detalle_desarrollo', elementId: 'btn_ver_inventario', elementLabel: 'Ver inventario', metadata: { proyecto_id: projectId } }); navigate(`/admin/agent/inventario/unidades?proyecto=${projectId}`); }}
              className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#16A45E] text-sm font-semibold text-white transition-colors hover:bg-[#128A4F]"
            >
              <Building2 className="h-4 w-4" /> Ver inventario
            </button>
            <button
              onClick={() => { track({ page: 'agent_detalle_desarrollo', elementId: 'btn_agendar_cita', elementLabel: 'Agendar cita', metadata: { proyecto_id: projectId } }); setAgendarCitaOpen(true); }}
              className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E7E9EC] bg-white text-sm font-semibold text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
            >
              <CalendarPlus className="h-4 w-4" /> Agendar cita
            </button>
            <button
              onClick={() => { track({ page: 'agent_detalle_desarrollo', elementId: 'btn_compartir', elementLabel: 'Compartir proyecto' }); setShareOpen(true); }}
              className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E7E9EC] bg-white text-sm font-semibold text-[#4B5563] transition-colors hover:bg-[#F6F7F8]"
            >
              <Share2 className="h-4 w-4" /> Compartir
            </button>
          </div>
        </section>
      </div>

      {/* Agendar cita dialog */}
      <AgendarCitaShowroomDialog open={agendarCitaOpen} onOpenChange={setAgendarCitaOpen} />

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Compartir - {project.nombre}</DialogTitle>
          </DialogHeader>
          <button
            onClick={() => handleShareMethod("web")}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#16A45E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#128A4F]"
          >
            <Globe className="h-4 w-4" /> Ver página web
          </button>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShareMethod("whatsapp")}>
              <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShareMethod("facebook")}>
              <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShareMethod("email")}>
              <Mail className="h-5 w-5 text-muted-foreground" />
              Correo
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShareMethod("copy")}>
              <Copy className="h-5 w-5 text-muted-foreground" />
              Copiar link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Plano de modelo dialog */}
      <Dialog open={!!planoModeloUrl} onOpenChange={() => setPlanoModeloUrl(null)}>
        <DialogContent className="max-w-lg p-2">
          <DialogHeader>
            <DialogTitle>Plano arquitectónico</DialogTitle>
          </DialogHeader>
          {planoModeloUrl && (
            <img src={planoModeloUrl} alt="Plano del modelo" className="w-full object-contain max-h-[70vh] rounded-md" />
          )}
        </DialogContent>
      </Dialog>

      {/* Visor pantalla completa */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) => setLightbox((prev) => prev ? { ...prev, index: i } : prev)}
        />
      )}
    </div>
  );
};

export default AgentProyectoDetalle;
