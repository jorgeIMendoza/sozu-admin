import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MODAL_BODY_CLS, ModalFormHeader } from "@/components/ui/modal-form";
import { OptImg } from "@/components/ui/opt-img";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useCtaTracker } from "@/hooks/useCtaTracker";
import { useInventarioPortal } from "@/hooks/useInventarioPortal";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { mapEstatusCatalog } from "@/utils/avanceObra";
import { desarrolloUrl } from "@/utils/desarrolloUrl";
import { useQuery } from "@tanstack/react-query";
import { Building2, Copy, Eye, Globe, Loader2, Mail, MapPin, Search, Share2 } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  // Misma vista para Portal Agente y Portal del Personal: el portal activo define
  // rutas, permisos, analítica y la llave de búsqueda persistida.
  const { basePath, portalPrefix, permisos: inventarioPerms, stickyTopCls } = useInventarioPortal();
  const PAGE = `${portalPrefix}_inventario`;
  const SEARCH_KEY = `${portalPrefix}-inventario-search`;
  const { registrarVista } = useActivityLogger();
  const { track } = useCtaTracker();
  const [search, setSearch] = useState(() => {
    try { return sessionStorage.getItem(SEARCH_KEY) || ""; } catch { return ""; }
  });
  const navigate = useNavigate();

  useEffect(() => {
    try { sessionStorage.setItem(SEARCH_KEY, search); } catch { /* ignore */ }
  }, [search, SEARCH_KEY]);

  useEffect(() => {
    registrarVista(basePath);
    track({ page: PAGE, elementId: 'page_view', elementType: 'page' });
  }, [basePath, PAGE]);

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
    <div className="mx-auto max-w-[1040px]">
      {/* Search bar (título vive en el header del portal) */}
      <div className={cn("sticky z-10 -mx-1 bg-background px-1 py-1", stickyTopCls)}>
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar desarrollo..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (e.target.value.length > 0) {
                track({ page: PAGE, elementId: 'input_buscar_desarrollo', elementLabel: 'Buscar desarrollo', elementType: 'input' });
              }
            }}
            className="h-11 rounded-md pl-9 text-sm shadow-none"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No se encontraron desarrollos</p>
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
                track({ page: PAGE, elementId: 'btn_ver_desarrollo', elementLabel: 'Ver Desarrollo', metadata: { proyecto_id: proyecto.id } });
                navigate(`${basePath}/proyecto/${proyecto.id}`);
              }}
              onViewUnits={(e) => {
                e.stopPropagation();
                track({ page: PAGE, elementId: 'btn_ver_inventario', elementLabel: 'Ver inventario', metadata: { proyecto_id: proyecto.id } });
                navigate(`${basePath}/unidades?proyecto=${proyecto.id}`);
              }}
              track={track}
              page={PAGE}
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
  page,
}: {
  proyecto: ProyectoCard;
  formatCurrency: (v: number) => string;
  canRead: boolean;
  onViewProject: () => void;
  onViewUnits: (e: React.MouseEvent) => void;
  track: (opts: any) => void;
  page: string;
}) {
  const isAgotado = proyecto.unidades_disponibles === 0;
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false);

  const publicUrl = desarrolloUrl(proyecto.nombre);

  const handleShare = (method: string) => {
    track({ page, elementId: 'btn_compartir_plataforma', elementLabel: `Compartir ${method}`, metadata: { plataforma: method, proyecto_id: proyecto.id } });
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
      <Card className="overflow-hidden p-0">
        {/* Imagen (sin acción — solo los botones detonan navegación) */}
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-muted to-muted-foreground/20">
          {proyecto.imagen_url ? (
            <OptImg
              src={proyecto.imagen_url}
              w={640}
              h={360}
              resize="cover"
              alt={proyecto.nombre}
              className="h-full w-full transform-gpu object-cover object-[center_75%] [content-visibility:auto]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-10 w-10 text-white/50" />
            </div>
          )}

          {/* Disponibilidad */}
          <div className="absolute right-3 top-3">
            {isAgotado ? (
              <Badge className="bg-black/80 text-white shadow-sm hover:bg-black/80">Agotado</Badge>
            ) : (
              <Badge className="gap-1.5 bg-primary tabular-nums text-primary-foreground shadow-sm hover:bg-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-card" />
                {proyecto.unidades_disponibles} disponibles
              </Badge>
            )}
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-4">
          <h3 className="truncate text-base font-bold text-foreground">{proyecto.nombre}</h3>
          {proyecto.ubicacion && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{proyecto.ubicacion}</span>
            </p>
          )}
          {!isAgotado && proyecto.precio_desde && (
            <p className="mt-2.5 text-sm font-bold tabular-nums text-primary">
              Desde {formatCurrency(proyecto.precio_desde)}
            </p>
          )}

          {/* Stats */}
          <div className="mt-3 flex gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total unidades</p>
              <p className="text-sm font-bold tabular-nums text-foreground">{proyecto.total_unidades}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Avance</p>
              <p className="text-sm font-bold tabular-nums text-foreground">{proyecto.avance}%</p>
            </div>
          </div>

          {/* Acciones: Ver · Inventario · Compartir */}
          {canRead && (
            <div className="mt-4 flex items-center gap-2">
              <ActionButton icon={Eye} variant="outline" className="flex-1" onClick={onViewProject}>
                Ver
              </ActionButton>
              {!isAgotado && (
                <ActionButton icon={Building2} variant="outline" className="flex-1" onClick={onViewUnits}>
                  Inventario
                </ActionButton>
              )}
              <Button
                variant="primary-outline"
                size="icon"
                className="shrink-0"
                title="Compartir"
                aria-label="Compartir"
                onClick={(e) => {
                  e.stopPropagation();
                  track({ page, elementId: 'btn_compartir', elementLabel: 'Compartir', metadata: { proyecto_id: proyecto.id } });
                  setShareOpen(true);
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
          <ModalFormHeader title={`Compartir - ${proyecto.nombre}`} />
          <div className={cn(MODAL_BODY_CLS, "gap-3")}>
          <Button variant="primary-outline" className="w-full" onClick={() => handleShare("web")}>
            <Globe className="h-4 w-4" /> Ver página web
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShare("whatsapp")}>
              <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShare("facebook")}>
              <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Facebook
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShare("email")}>
              <Mail className="h-5 w-5 text-muted-foreground" /> Correo
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => handleShare("copy")}>
              <Copy className="h-5 w-5 text-muted-foreground" /> Copiar link
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
ProjectCard.displayName = "ProjectCard";

export default AgentInventario;
