import { useState, useMemo, useEffect, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";
import { useAgentPortalPermissions } from "@/hooks/useAgentPortalPermissions";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Building2, MapPin, Eye, Share2, Mail, Copy, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { desarrolloUrl } from "@/utils/desarrolloUrl";
import { mapEstatusCatalog } from "@/utils/avanceObra";
import { OptImg } from "@/components/ui/OptImg";

interface ProyectoCard {
  id: number;
  nombre: string;
  ubicacion: string;
  imagen_url: string | null;
  precio_desde: number | null;
  unidades_disponibles: number;
  total_unidades: number;
  avance: number;
  id_estatus_proyecto: number | null;
}

const AgentInventario = () => {
  const { profile } = useAuth();
  const { accessibleProjectIds, hasUnrestrictedAccess, isLoading: loadingAccess } = useProjectAccess();
  const { permissions } = useAgentPortalPermissions();
  const inventarioPerms = permissions['/admin/agent/inventario'];
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();
  const [search, setSearch] = useState(() => {
    try { return sessionStorage.getItem("agent-inventario-search") || ""; } catch { return ""; }
  });
  const navigate = useNavigate();

  useEffect(() => {
    try { sessionStorage.setItem("agent-inventario-search", search); } catch { /* ignore */ }
  }, [search]);

  useEffect(() => {
    registrarVista('/admin/agent/inventario');
    track({ page: 'agent_inventario', elementId: 'page_view', elementType: 'page' });
  }, []);

  const { data: estatusData } = useQuery({
    queryKey: ["estatus-proyecto-all"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("estatus_proyecto")
        .select("*")
        .eq("activo", true)
        .order("id");
      return data || [];
    },
  });

  const { data: proyectos = [], isLoading: loadingData } = useQuery({
    queryKey: ['agent-inventario-proyectos', hasUnrestrictedAccess ? 'all' : accessibleProjectIds],
    queryFn: async (): Promise<ProyectoCard[]> => {
      let query = (supabase as any)
        .from('proyectos')
        .select('id, nombre, direccion, url_imagen_portada, id_estatus_proyecto')
        .eq('activo', true)
        .eq('publicar', true)
        .order('nombre', { ascending: true });

      if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
        query = query.in('id', accessibleProjectIds);
      }

      const { data: projs, error } = await query;
      if (error || !projs) return [];

      const projIds = projs.map((p: any) => p.id);
      if (projIds.length === 0) return [];

      const { data: edificios } = await (supabase as any)
        .from('edificios')
        .select('id, id_proyecto')
        .in('id_proyecto', projIds)
        .eq('activo', true);

      if (!edificios || edificios.length === 0) return [];

      const edificioIds = edificios.map((e: any) => e.id);
      const edToProj = new Map<number, number>();
      edificios.forEach((e: any) => edToProj.set(e.id, e.id_proyecto));

      const { data: edModelos } = await (supabase as any)
        .from('edificios_modelos')
        .select('id, id_edificio')
        .in('id_edificio', edificioIds);

      if (!edModelos || edModelos.length === 0) return [];

      const edModeloIds = edModelos.map((em: any) => em.id);
      const edModeloToProj = new Map<number, number>();
      edModelos.forEach((em: any) => {
        const projId = edToProj.get(em.id_edificio);
        if (projId) edModeloToProj.set(em.id, projId);
      });

      const { data: propiedades } = await (supabase as any)
        .from('propiedades')
        .select('id, id_estatus_disponibilidad, precio_lista, id_edificio_modelo')
        .eq('activo', true)
        .eq('es_aprobado', true)
        .in('id_edificio_modelo', edModeloIds);

      const projStats = new Map<number, { available: number; total: number; minPrice: number }>();
      (propiedades || []).forEach((p: any) => {
        const projId = edModeloToProj.get(p.id_edificio_modelo);
        if (!projId || !projIds.includes(projId)) return;
        const stats = projStats.get(projId) || { available: 0, total: 0, minPrice: Infinity };
        stats.total++;
        if (p.id_estatus_disponibilidad === 2) {
          stats.available++;
          if (p.precio_lista && p.precio_lista > 0 && p.precio_lista < stats.minPrice) {
            stats.minPrice = p.precio_lista;
          }
        }
        projStats.set(projId, stats);
      });

      return projs.map((p: any) => {
        const stats = projStats.get(p.id) || { available: 0, total: 0, minPrice: Infinity };
        return {
          id: p.id,
          nombre: p.nombre,
          ubicacion: p.direccion || "",
          imagen_url: p.url_imagen_portada || null,
          precio_desde: stats.minPrice === Infinity ? null : stats.minPrice,
          unidades_disponibles: stats.available,
          total_unidades: stats.total,
          avance: 0,
          id_estatus_proyecto: p.id_estatus_proyecto || null,
        };
      }).filter((p: ProyectoCard) => p.total_unidades > 0);
    },
    enabled: !loadingAccess,
    staleTime: 60_000,
  });

  const proyectosConAvance = useMemo(() => {
    // Fuente única: estatus_proyecto.porcentaje_avance (fallback id/total legacy).
    const catalog = mapEstatusCatalog(estatusData ?? []);
    const pctById = new Map(catalog.map((e) => [e.id, e.porcentaje]));
    return proyectos.map(p => ({
      ...p,
      avance: p.id_estatus_proyecto ? (pctById.get(p.id_estatus_proyecto) ?? 0) : 0,
    }));
  }, [proyectos, estatusData]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return proyectosConAvance;
    return proyectosConAvance.filter(p => p.nombre.toLowerCase().includes(s));
  }, [proyectosConAvance, search]);

  const isLoading = loadingAccess || loadingData;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="mx-auto max-w-[1040px] pb-8">
      {/* Search bar (título vive en el header del portal) */}
      <div className="sticky top-16 z-10 -mx-1 bg-background px-1 py-1">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[#9AA3AD]" />
          <Input
            placeholder="Buscar desarrollo..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (e.target.value.length > 0) {
                track({ page: 'agent_inventario', elementId: 'input_buscar_desarrollo', elementLabel: 'Buscar desarrollo', elementType: 'input' });
              }
            }}
            className="h-11 rounded-md border-[#ECEEF0] bg-white pl-9 text-[13px] shadow-none focus-visible:ring-[hsl(158_64%_38%)]/30"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#9AA3AD]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Building2 className="h-10 w-10 text-[#9AA3AD]/40" />
          <p className="text-sm text-[#6B7280]">No se encontraron desarrollos</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {filtered.map(proyecto => (
            <ProjectCard
              key={proyecto.id}
              proyecto={proyecto}
              formatCurrency={formatCurrency}
              canRead={inventarioPerms.canRead}
              onViewProject={() => {
                track({ page: 'agent_inventario', elementId: 'btn_ver_desarrollo', elementLabel: 'Ver Desarrollo', metadata: { proyecto_id: proyecto.id } });
                navigate(`/admin/agent/inventario/proyecto/${proyecto.id}`);
              }}
              onViewUnits={(e) => {
                e.stopPropagation();
                track({ page: 'agent_inventario', elementId: 'btn_ver_inventario', elementLabel: 'Ver inventario', metadata: { proyecto_id: proyecto.id } });
                navigate(`/admin/agent/inventario/unidades?proyecto=${proyecto.id}`);
              }}
              track={track}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectCard = memo(function ProjectCard({
  proyecto,
  formatCurrency,
  canRead,
  onViewProject,
  onViewUnits,
  track,
}: {
  proyecto: ProyectoCard;
  formatCurrency: (v: number) => string;
  canRead: boolean;
  onViewProject: () => void;
  onViewUnits: (e: React.MouseEvent) => void;
  track: (opts: any) => void;
}) {
  const isAgotado = proyecto.unidades_disponibles === 0;
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false);

  const publicUrl = desarrolloUrl(proyecto.nombre);

  const handleShare = (method: string) => {
    track({ page: 'agent_inventario', elementId: 'btn_compartir_plataforma', elementLabel: `Compartir ${method}`, metadata: { plataforma: method, proyecto_id: proyecto.id } });
    switch (method) {
      case "web":
        window.open(publicUrl, "_blank");
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(`${proyecto.nombre}\n${publicUrl}`)}`, "_blank");
        break;
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, "_blank");
        break;
      case "email":
        window.open(`mailto:?subject=${encodeURIComponent(proyecto.nombre)}&body=${encodeURIComponent(`${proyecto.nombre}\n${proyecto.ubicacion}\n${publicUrl}`)}`, "_blank");
        break;
      case "copy":
        navigator.clipboard.writeText(publicUrl);
        toast({ title: "Copiado", description: "Link copiado al portapapeles." });
        break;
    }
    setShareOpen(false);
  };

  return (
    <>
      <div className="overflow-hidden rounded-md border border-[#E7E9EC] bg-white shadow-[0_1px_3px_rgba(20,30,25,0.04)]">
        {/* Image */}
        <div
          className="relative aspect-[16/9] w-full cursor-pointer overflow-hidden bg-gradient-to-br from-[#E4E7EA] to-[#CBD3D9]"
          onClick={onViewProject}
        >
          {proyecto.imagen_url ? (
            <OptImg
              src={proyecto.imagen_url}
              w={640}
              resize="cover"
              alt={proyecto.nombre}
              className="h-full w-full object-cover object-[center_75%] transform-gpu [content-visibility:auto]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-10 w-10 text-white/50" />
            </div>
          )}

          {/* Availability badge */}
          <div className="absolute right-3 top-3">
            {isAgotado ? (
              <span className="inline-flex items-center rounded-md bg-black/80 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm">
                Agotado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(158_64%_38%)] px-3 py-1.5 text-[12px] font-bold tabular-nums text-white shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {proyecto.unidades_disponibles} disponibles
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          <h3 className="truncate text-[16px] font-bold text-[#171A1D]">{proyecto.nombre}</h3>
          {proyecto.ubicacion && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#9AA3AD]">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{proyecto.ubicacion}</span>
            </p>
          )}
          {!isAgotado && proyecto.precio_desde && (
            <p className="mt-2.5 text-[13px] font-bold tabular-nums text-[hsl(158_64%_38%)]">
              Desde {formatCurrency(proyecto.precio_desde)}
            </p>
          )}

          {/* Stats */}
          <div className="mt-3 flex gap-[18px]">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Total unidades</p>
              <p className="text-[13px] font-bold tabular-nums text-[#171A1D]">{proyecto.total_unidades}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.5px] text-[#9AA3AD]">Avance</p>
              <p className="text-[13px] font-bold tabular-nums text-[#171A1D]">{proyecto.avance}%</p>
            </div>
          </div>

          {/* Actions - una sola fila: Ver, Inventario, Compartir */}
          {canRead && (
            <div className="mt-3.5 flex items-center gap-2">
              <button
                onClick={onViewProject}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#ECEEF0] py-2.5 text-[12px] font-semibold text-[#4B5563] hover:border-primary hover:bg-primary/[0.05] hover:text-primary"
              >
                <Eye className="h-3.5 w-3.5" />
                Ver
              </button>
              {!isAgotado && (
                <button
                  onClick={onViewUnits}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#ECEEF0] py-2.5 text-[12px] font-semibold text-[#4B5563] hover:border-primary hover:bg-primary/[0.05] hover:text-primary"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Inventario
                </button>
              )}
              <button
                title="Compartir"
                aria-label="Compartir"
                onClick={(e) => {
                  e.stopPropagation();
                  track({ page: 'agent_inventario', elementId: 'btn_compartir', elementLabel: 'Compartir', metadata: { proyecto_id: proyecto.id } });
                  setShareOpen(true);
                }}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-[hsl(158_64%_38%)] bg-white text-[hsl(158_64%_38%)] transition-colors hover:bg-[hsl(158_64%_38%)] hover:text-white"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Compartir - {proyecto.nombre}</DialogTitle>
          </DialogHeader>
          <button
            onClick={() => handleShare("web")}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-[hsl(158_64%_38%)] bg-white px-4 py-2.5 text-sm font-semibold text-[hsl(158_64%_38%)] transition-colors hover:bg-[hsl(158_64%_38%)]/[0.06]"
          >
            <Globe className="h-4 w-4" /> Ver página web
          </button>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShare("whatsapp")}>
              <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShare("facebook")}>
              <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShare("email")}>
              <Mail className="h-5 w-5 text-muted-foreground" />
              Correo
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShare("copy")}>
              <Copy className="h-5 w-5 text-muted-foreground" />
              Copiar link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
ProjectCard.displayName = "ProjectCard";

export default AgentInventario;
