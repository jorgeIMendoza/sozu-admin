import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AgentPortalHeader } from "@/components/admin/agent-portal/AgentPortalHeader";
import { Building2, MapPin, ArrowLeft, Calendar, Loader2, Download, Share2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const AgentProyectoDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch project data
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["agent-proyecto-detalle", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proyectos")
        .select("id, nombre, descripcion, direccion, url_imagen_portada, fecha_entrega, fecha_inicio_construccion")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: projectId > 0,
  });

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

  // Fetch stats (available/total/min price)
  const { data: stats } = useQuery({
    queryKey: ["agent-proyecto-stats", projectId],
    queryFn: async () => {
      const { data: edificios } = await (supabase as any)
        .from("edificios").select("id").eq("id_proyecto", projectId).eq("activo", true);
      if (!edificios?.length) return { available: 0, total: 0, avance: 0 };

      const edIds = edificios.map((e: any) => e.id);
      const { data: edModelos } = await (supabase as any)
        .from("edificios_modelos").select("id").in("id_edificio", edIds);
      if (!edModelos?.length) return { available: 0, total: 0, avance: 0 };

      const emIds = edModelos.map((em: any) => em.id);
      const { data: props } = await (supabase as any)
        .from("propiedades")
        .select("id, id_estatus_disponibilidad, precio_lista")
        .eq("activo", true).eq("es_aprobado", true)
        .in("id_edificio_modelo", emIds);

      let available = 0, total = 0;
      (props || []).forEach((p: any) => {
        total++;
        if (p.id_estatus_disponibilidad === 2) available++;
      });
      const avance = total > 0 ? Math.round(((total - available) / total) * 100) : 0;
      return { available, total, avance };
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

  // Fetch galería multimedia
  const { data: multimedia = [] } = useQuery({
    queryKey: ["agent-proyecto-multimedia", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("multimedias_proyecto")
        .select("id, url")
        .eq("id_proyecto", projectId)
        .eq("activo", true);
      if (error) throw error;
      return data || [];
    },
    enabled: projectId > 0,
  });

  // Fetch YouTube videos
  const { data: videos = [] } = useQuery({
    queryKey: ["agent-proyecto-videos", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("videos_youtube")
        .select("id, link, nombre")
        .eq("id_proyecto", projectId)
        .eq("activo", true);
      if (error) throw error;
      return data || [];
    },
    enabled: projectId > 0,
  });

  const brochure = documentos.find((d: any) => d.id_tipo_documento === 30);
  const fichaTecnica = documentos.find((d: any) => d.id_tipo_documento === 49);
  const formatCurrency = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);

  const handleShare = async () => {
    const text = `${project?.nombre}\n${project?.direccion || ''}\nVer más detalles en nuestra plataforma.`;
    if (navigator.share) {
      try { await navigator.share({ title: project?.nombre, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Información copiada al portapapeles." });
    }
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
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

  return (
    <div className="pb-24 bg-[hsl(var(--agent-bg))]">
      {/* Hero image */}
      <div className="relative h-56 w-full overflow-hidden">
        {project.url_imagen_portada ? (
          <img src={project.url_imagen_portada} alt={project.nombre} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Back button */}
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>

        {/* Avance badge */}
        {stats && (
          <div className="absolute bottom-16 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-800">
            🏗 {stats.avance}% avance de obra
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="font-bold text-xl text-white">{project.nombre}</h1>
          {project.direccion && (
            <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {project.direccion}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="px-4 -mt-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
            <div className="text-center py-3">
              <p className="text-lg font-bold text-foreground">{stats.available}</p>
              <p className="text-[11px] text-muted-foreground">Disponibles</p>
            </div>
            <div className="text-center py-3">
              <p className="text-lg font-bold text-foreground">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Total unidades</p>
            </div>
            <div className="text-center py-3">
              <p className="text-lg font-bold text-foreground">{stats.avance}%</p>
              <p className="text-[11px] text-muted-foreground">Avance</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 mt-5 space-y-6">
        {/* Concepto */}
        {project.descripcion && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-2">Concepto</h2>
            <p className="text-sm text-foreground leading-relaxed">{project.descripcion}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {project.fecha_entrega && (
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Entrega: {new Date(project.fecha_entrega).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</span>
              )}
            </div>
          </section>
        )}

        {/* Amenidades */}
        {amenidades.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">Amenidades</h2>
            <div className="grid grid-cols-3 gap-2">
              {amenidades.map((a: any) => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                  {a.url ? (
                    <img src={a.url} alt={a.nombre} className="h-7 w-7 mx-auto mb-1.5 object-contain" />
                  ) : (
                    <div className="h-7 w-7 mx-auto mb-1.5 bg-gray-100 rounded-full" />
                  )}
                  <p className="text-[11px] text-foreground font-medium leading-tight">{a.nombre}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Avance de obra */}
        {stats && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">Avance de obra</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-2xl font-bold text-foreground">{stats.avance}%</span>
                <span className="text-[11px] text-muted-foreground">Completado</span>
              </div>
              <Progress value={stats.avance} className="h-2 mt-2" />
            </div>
          </section>
        )}

        {/* YouTube videos */}
        {videos.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">🎥 Video de avance</h2>
            {videos.map((v: any) => {
              const embedUrl = getYoutubeEmbedUrl(v.link);
              if (!embedUrl) return null;
              return (
                <div key={v.id} className="rounded-xl overflow-hidden border border-gray-100 mb-3">
                  <iframe src={embedUrl} className="w-full aspect-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              );
            })}
          </section>
        )}

        {/* Galería */}
        {multimedia.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">Galería</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {multimedia.map((m: any) => (
                <img key={m.id} src={m.url} alt="" className="h-32 w-48 rounded-xl object-cover flex-shrink-0" loading="lazy" />
              ))}
            </div>
          </section>
        )}

        {/* Ubicación + Puntos de interés */}
        {(project.direccion || puntosInteres.length > 0) && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">Ubicación</h2>
            {project.direccion && (
              <p className="text-sm text-foreground mb-3 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {project.direccion}
              </p>
            )}
            {puntosInteres.length > 0 && (
              <div className="space-y-0">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Puntos de interés</p>
                {puntosInteres.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-foreground">{p.nombre}</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {p.distancia_km < 1 ? `${(p.distancia_km * 1000).toFixed(0)} m` : `${p.distancia_km} km`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Material comercial */}
        {(brochure || fichaTecnica) && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3">Material comercial</h2>
            <div className="space-y-2">
              {brochure && (
                <div
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between cursor-pointer active:bg-gray-50"
                  onClick={() => window.open(brochure.url, '_blank')}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                      <Download className="h-5 w-5 text-[hsl(var(--agent-primary))]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Brochure</p>
                      <p className="text-[11px] text-muted-foreground">PDF · Presentación del proyecto</p>
                    </div>
                  </div>
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              {fichaTecnica && (
                <div
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between cursor-pointer active:bg-gray-50"
                  onClick={() => window.open(fichaTecnica.url, '_blank')}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                      <Download className="h-5 w-5 text-[hsl(var(--agent-primary))]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Ficha técnica</p>
                      <p className="text-[11px] text-muted-foreground">PDF · Especificaciones</p>
                    </div>
                  </div>
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          </section>
        )}

        {/* CTA: Ver unidades */}
        <section className="bg-gray-50 rounded-2xl p-5 text-center">
          <p className="text-sm font-semibold text-foreground mb-3">¿Tu cliente está interesado en este proyecto?</p>
          <Button
            onClick={() => navigate(`/admin/agent/inventario/proyecto/${projectId}/unidades`)}
            className="w-full bg-[hsl(var(--agent-primary))] hover:bg-[hsl(var(--agent-primary))]/90 text-white rounded-xl h-12 text-sm font-semibold"
          >
            <ChevronRight className="h-4 w-4 mr-1" />
            Ver unidades disponibles
          </Button>
        </section>

        {/* Compartir */}
        <div className="flex justify-center pb-4">
          <Button variant="outline" onClick={handleShare} className="rounded-xl">
            <Share2 className="h-4 w-4 mr-2" />
            Compartir proyecto
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AgentProyectoDetalle;
