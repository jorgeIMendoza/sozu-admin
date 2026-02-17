import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2, ArrowLeft, BedDouble, Bath, ShowerHead, Maximize2, DollarSign, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 30;

const InventarioGlobal = () => {
  const navigate = useNavigate();
  const { accessibleProjectIds, hasUnrestrictedAccess, isLoading: isLoadingAccess, hasNoAccess } = useProjectAccess();
  const [page, setPage] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const [filterModelId, setFilterModelId] = useState<string>("all");
  const [filterBedrooms, setFilterBedrooms] = useState<string>("all");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["inventario-global-projects", accessibleProjectIds],
    queryFn: async () => {
      if (hasNoAccess) return [];
      let query = supabase
        .from("proyectos")
        .select(`
          id, nombre,
          edificios!fk_edificios_proyecto (
            id, nombre,
            edificios_modelos!fk_edificios_modelos_edificio (
              id,
              modelos!fk_edificios_modelos_modelo (
                id, nombre, numero_recamaras, numero_completo_banos, numero_medio_bano
              ),
              propiedades!fk_propiedades_edificio_modelo (
                id, numero, piso, precio_lista, m2_interiores, m2_exteriores,
                id_estatus_disponibilidad,
                estatus_disponibilidad:id_estatus_disponibilidad (nombre)
              )
            )
          )
        `)
        .eq("activo", true)
        .eq("publicar", true);

      if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
        query = query.in("id", accessibleProjectIds);
      }

      const { data, error } = await query.order("nombre");
      if (error) { console.error("Error:", error); return []; }
      return data || [];
    },
    enabled: !isLoadingAccess,
  });

  // Flatten all available properties
  const allAvailableProperties = useMemo(() => {
    const props: any[] = [];
    projects.forEach((project: any) => {
      project.edificios?.forEach((e: any) => {
        e.edificios_modelos?.forEach((em: any) => {
          em.propiedades?.forEach((p: any) => {
            if (p.id_estatus_disponibilidad === 2) {
              props.push({
                ...p,
                proyecto_id: project.id,
                proyecto_nombre: project.nombre,
                edificio_nombre: e.nombre,
                modelo_id: em.modelos?.id,
                modelo_nombre: em.modelos?.nombre,
                recamaras: em.modelos?.numero_recamaras,
                banos: em.modelos?.numero_completo_banos,
                medio_bano: em.modelos?.numero_medio_bano,
                m2_total: (p.m2_interiores || 0) + (p.m2_exteriores || 0),
              });
            }
          });
        });
      });
    });
    // Shuffle
    for (let i = props.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [props[i], props[j]] = [props[j], props[i]];
    }
    return props;
  }, [projects]);

  // Get unique models for selected project
  const availableModels = useMemo(() => {
    const modelsMap = new Map();
    const source = filterProjectId === "all" ? allAvailableProperties : allAvailableProperties.filter(p => p.proyecto_id === parseInt(filterProjectId));
    source.forEach(p => {
      if (p.modelo_id && !modelsMap.has(p.modelo_id)) {
        modelsMap.set(p.modelo_id, { id: p.modelo_id, nombre: p.modelo_nombre });
      }
    });
    return Array.from(modelsMap.values());
  }, [allAvailableProperties, filterProjectId]);

  // Get unique bedroom counts
  const availableBedrooms = useMemo(() => {
    const beds = new Set<number>();
    allAvailableProperties.forEach(p => { if (p.recamaras > 0) beds.add(p.recamaras); });
    return Array.from(beds).sort((a, b) => a - b);
  }, [allAvailableProperties]);

  // Apply filters
  const filteredProperties = useMemo(() => {
    let result = allAvailableProperties;
    if (filterProjectId !== "all") {
      result = result.filter(p => p.proyecto_id === parseInt(filterProjectId));
    }
    if (filterModelId !== "all") {
      result = result.filter(p => p.modelo_id === parseInt(filterModelId));
    }
    if (filterBedrooms !== "all") {
      result = result.filter(p => p.recamaras === parseInt(filterBedrooms));
    }
    return result;
  }, [allAvailableProperties, filterProjectId, filterModelId, filterBedrooms]);

  const totalPages = Math.ceil(filteredProperties.length / PAGE_SIZE);
  const pageProperties = filteredProperties.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(price);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };

  if (isLoading || isLoadingAccess) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/inmobiliarias/mis-proyectos")} className="gap-1 text-primary">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
      </div>

      <div className="px-1 space-y-1">
        <h1 className="text-xl font-bold text-foreground">Inventario Disponible</h1>
        <p className="text-sm text-muted-foreground">
          {filteredProperties.length} unidades disponibles
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-1">
        <Select value={filterProjectId} onValueChange={(v) => { handleFilterChange(setFilterProjectId, v); setFilterModelId("all"); }}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects.map((p: any) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterModelId} onValueChange={(v) => handleFilterChange(setFilterModelId, v)}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los modelos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los modelos</SelectItem>
            {availableModels.map((m: any) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterBedrooms} onValueChange={(v) => handleFilterChange(setFilterBedrooms, v)}>
          <SelectTrigger>
            <SelectValue placeholder="Recámaras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las recámaras</SelectItem>
            {availableBedrooms.map((b) => (
              <SelectItem key={b} value={String(b)}>{b} recámara{b > 1 ? "s" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Properties Grid */}
      {filteredProperties.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No hay propiedades disponibles con los filtros seleccionados</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-1">
            {pageProperties.map((prop: any) => (
              <Card
                key={prop.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow border"
                onClick={() => setSelectedProperty(prop)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">{prop.numero || `Unidad ${prop.id}`}</h4>
                      <p className="text-xs text-muted-foreground">{prop.proyecto_nombre}</p>
                      <p className="text-[11px] text-muted-foreground">{prop.edificio_nombre} • {prop.modelo_nombre}</p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-[10px]">
                      Disponible
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {prop.m2_total > 0 && (
                      <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" /> {prop.m2_total.toFixed(1)} m²</span>
                    )}
                    {prop.recamaras > 0 && (
                      <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {prop.recamaras}</span>
                    )}
                    {prop.banos > 0 && (
                      <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {prop.banos}</span>
                    )}
                  </div>

                  {prop.precio_lista > 0 && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      {formatPrice(prop.precio_lista)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Property Detail Dialog */}
      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedProperty?.numero || `Unidad ${selectedProperty?.id}`}</DialogTitle>
          </DialogHeader>
          {selectedProperty && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Proyecto</p>
                  <p className="font-medium text-sm">{selectedProperty.proyecto_nombre}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Edificio</p>
                  <p className="font-medium text-sm">{selectedProperty.edificio_nombre}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Modelo</p>
                  <p className="font-medium text-sm">{selectedProperty.modelo_nombre}</p>
                </div>
                {selectedProperty.piso && (
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Piso</p>
                    <p className="font-medium text-sm">{selectedProperty.piso}</p>
                  </div>
                )}
                {selectedProperty.m2_total > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Superficie</p>
                    <p className="font-medium text-sm">{selectedProperty.m2_total.toFixed(2)} m²</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {selectedProperty.recamaras > 0 && (
                  <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" /> {selectedProperty.recamaras} recámara{selectedProperty.recamaras > 1 ? "s" : ""}</span>
                )}
                {selectedProperty.banos > 0 && (
                  <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {selectedProperty.banos} baño{selectedProperty.banos > 1 ? "s" : ""}</span>
                )}
                {selectedProperty.medio_bano > 0 && (
                  <span className="flex items-center gap-1"><ShowerHead className="h-4 w-4" /> {selectedProperty.medio_bano} medio baño</span>
                )}
              </div>

              {selectedProperty.precio_lista > 0 && (
                <div className="bg-primary/5 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Precio de Lista</p>
                  <p className="text-xl font-bold text-foreground">{formatPrice(selectedProperty.precio_lista)}</p>
                </div>
              )}

              <Button className="w-full gap-2" size="lg" onClick={() => toast.info("Función de generar oferta próximamente disponible")}>
                <FileText className="h-5 w-5" />
                Generar Oferta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventarioGlobal;
