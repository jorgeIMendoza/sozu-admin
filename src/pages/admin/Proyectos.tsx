import { NewProjectDialog } from "@/components/admin/NewProjectDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Search, Edit, Trash2, Eye, Image, Video, MapPin, Lock, Building2, Copy, ExternalLink, Map, X, SlidersHorizontal, FolderX, RotateCcw } from "lucide-react";
import { Dialog as ShowroomDialog, DialogContent as ShowroomDialogContent, DialogHeader as ShowroomDialogHeader, DialogTitle as ShowroomDialogTitle } from "@/components/ui/dialog";
import { GoogleMapComponent } from "@/components/admin/GoogleMapComponent";
import { toast } from "sonner";
import { useState, useEffect, useRef, useMemo } from "react";
import { EditProjectDialog } from "@/components/admin/EditProjectDialog";
import { ProjectMultimediaModal } from "@/components/admin/ProjectMultimediaModal";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { usePagePermissions } from "@/hooks/usePagePermissions";

// Función para formatear moneda completa
const formatCurrencyFull = (value: number): string => {
  return `$${value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

// Fallback consistente para celdas sin dato (reemplaza el guión medio suelto).
const EmptyValue = ({ label = "Sin dato" }: { label?: string }) => (
  <span className="text-sm text-muted-foreground/60">{label}</span>
);

// Persistencia de filtros en localStorage (se mantienen entre navegaciones/recargas).
const FILTERS_KEY = "proyectos:filtros";
interface ProjectFilters {
  search: string;
  desarrollador: string;
  ciudad: string;
  estatus: string;
  sozu: string;
}
const DEFAULT_FILTERS: ProjectFilters = {
  search: "",
  desarrollador: "",
  ciudad: "",
  estatus: "all",
  sozu: "all",
};
const loadFilters = (): ProjectFilters => {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FILTERS;
  }
};

// Nombre del desarrollador (entidad tipo 3) para un proyecto.
const getDeveloperName = (project: any): string =>
  project.entidades_relacionadas?.[0]?.personas?.nombre_comercial ||
  project.entidades_relacionadas?.[0]?.personas?.nombre_legal ||
  "Por definir";

// ShowroomCell component that fetches showrooms per project
const ShowroomCell = ({ projectId, projectName, onShowDetail }: { 
  projectId: number; 
  projectName: string; 
  onShowDetail: (showrooms: Array<{ id: number; nombre: string; descripcion_direccion: string; latitud: number; longitud: number }>) => void;
}) => {
  const { data: showrooms = [] } = useQuery({
    queryKey: ["showrooms-proyecto", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('showrooms_proyecto')
        .select('id, nombre, descripcion_direccion, latitud, longitud')
        .eq('id_proyecto', projectId)
        .eq('activo', true);
      if (error) return [];
      return data || [];
    },
    staleTime: 60000,
  });

  if (showrooms.length === 0) {
    return <EmptyValue />;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="p-1 h-auto"
      onClick={() => onShowDetail(showrooms as any)}
    >
      <Eye className="h-4 w-4" />
      {showrooms.length > 1 && <span className="text-xs ml-1">{showrooms.length}</span>}
    </Button>
  );
};

const Proyectos = () => {
  const queryClient = useQueryClient();
  const initialFilters = useMemo(() => loadFilters(), []);
  const [inputValue, setInputValue] = useState(initialFilters.search);
  const [searchTerm, setSearchTerm] = useState(initialFilters.search);
  const [selectedProjectMultimedia, setSelectedProjectMultimedia] = useState<{
    multimedia: any[];
    youtubeVideos: any[];
    projectName: string;
  } | null>(null);
  const [showroomDetail, setShowroomDetail] = useState<{
    showrooms: Array<{ id: number; nombre: string; descripcion_direccion: string; latitud: number; longitud: number }>;
    projectName: string;
  } | null>(null);
  const [selectedShowroomIndex, setSelectedShowroomIndex] = useState(0);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Project access hook
  const { accessibleProjectIds, hasUnrestrictedAccess, isLoading: isLoadingAccess, hasNoAccess } = useProjectAccess();
  
  // Page permissions
  const { canCreate, canUpdate, canDelete, isLoading: isLoadingPermissions, isSuperAdmin } = usePagePermissions('/admin/proyectos');
  
  // Check if user has any action permission
  const hasAnyActionPermission = canUpdate || canDelete || isSuperAdmin;
  
  // Filtros específicos (hidratados desde localStorage)
  const [desarrolladorFilter, setDesarrolladorFilter] = useState(initialFilters.desarrollador);
  const [ciudadFilter, setCiudadFilter] = useState(initialFilters.ciudad);
  const [estatusFilter, setEstatusFilter] = useState(initialFilters.estatus);
  const [sozuFilter, setSozuFilter] = useState(initialFilters.sozu);

  // Persistir filtros en cada cambio.
  useEffect(() => {
    const payload: ProjectFilters = {
      search: searchTerm,
      desarrollador: desarrolladorFilter,
      ciudad: ciudadFilter,
      estatus: estatusFilter,
      sozu: sozuFilter,
    };
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(payload));
    } catch {
      /* almacenamiento no disponible: ignorar */
    }
  }, [searchTerm, desarrolladorFilter, ciudadFilter, estatusFilter, sozuFilter]);

  const hasActiveFilters =
    inputValue !== "" ||
    desarrolladorFilter !== "" ||
    ciudadFilter !== "" ||
    estatusFilter !== "all" ||
    sozuFilter !== "all";

  const clearFilters = () => {
    setInputValue("");
    setSearchTerm("");
    setDesarrolladorFilter("");
    setCiudadFilter("");
    setEstatusFilter("all");
    setSozuFilter("all");
  };
  
  // Pagination states
  const [currentPageActive, setCurrentPageActive] = useState(1);
  const [currentPageDeleted, setCurrentPageDeleted] = useState(1);
  const itemsPerPage = 15;

  // Query to get project inmobiliaria names (entidades with id_tipo_entidad = 5)
  const { data: inmobiliariaProjectMap = {} as Record<number, string> } = useQuery({
    queryKey: ["inmobiliaria-project-map"],
    queryFn: async (): Promise<Record<number, string>> => {
      const { data, error } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto, personas!entidades_relacionadas_id_persona_fkey(nombre_comercial, nombre_legal)')
        .eq('id_tipo_entidad', 5)
        .eq('activo', true);
      
      if (error) {
        console.error("Error fetching inmobiliaria projects:", error);
        return {};
      }
      
      const result: Record<number, string> = {};
      data?.forEach(e => {
        if (e.id_proyecto != null) {
          const persona = e.personas as any;
          result[e.id_proyecto] = persona?.nombre_comercial || persona?.nombre_legal || 'Inmobiliaria';
        }
      });
      return result;
    },
    staleTime: 60000,
  });

  // Derive sozuProjectIds from the map for backward compatibility
  const sozuProjectIds = useMemo(() => new Set(Object.keys(inmobiliariaProjectMap).map(Number)), [inmobiliariaProjectMap]);

  const { data: activeProjectsData, refetch: refetchActive } = useQuery({
    queryKey: ["projects", "active", itemsPerPage, currentPageActive, searchTerm, estatusFilter, sozuFilter, accessibleProjectIds, Array.from(sozuProjectIds)],
    queryFn: async () => {
      // If user has no access and is not admin, return empty
      if (hasNoAccess) {
        return { projects: [], count: 0 };
      }

      const from = (currentPageActive - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      let query = supabase
        .from("proyectos")
        .select(`
          id,
          nombre,
          descripcion,
          direccion,
          latitud,
          longitud,
          activo,
          fecha_inicio_construccion,
          id_tipo_uso,
          id_estatus_proyecto,
          publicar,
          direccion_id_pais,
          direccion_id_estado,
          direccion_id_municipio,
          tipos_uso:id_tipo_uso (
            nombre
          ),
          estatus_proyecto:id_estatus_proyecto (
            id,
            nombre
          ),
          paises:direccion_id_pais (
            nombre
          ),
          estados_mx:direccion_id_estado (
            nombre
          ),
          municipios_mx:direccion_id_municipio (
            nombre
          ),
          edificios!fk_edificios_proyecto (
            id,
            nombre,
            edificios_modelos!fk_edificios_modelos_edificio (
              id,
              propiedades!fk_propiedades_edificio_modelo (
                id,
                precio_lista,
                m2_interiores,
                m2_exteriores
              )
            )
          ),
          multimedias_proyecto (
            id,
            url,
            es_imagen,
            activo
          ),
          videos_youtube (
            id,
            nombre,
            link,
            activo
          ),
          amenidades_proyectos (
            amenidades (
              id,
              nombre
            )
          ),
          entidades_relacionadas!fk_entrel_proyecto (
            id,
            id_persona,
            id_tipo_entidad,
            activo,
            personas!fk_entrel_persona (
              id,
              nombre_comercial,
              nombre_legal
            )
          )
        `, { count: 'exact' })
        .eq("entidades_relacionadas.activo", true)
        .eq("entidades_relacionadas.id_tipo_entidad", 3)
        .eq("activo", true);
      
      // Apply project access filter for non-admin users
      if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
        query = query.in("id", accessibleProjectIds);
      }
      
      // Aplicar filtros
      if (searchTerm) {
        query = query.ilike("nombre", `%${searchTerm}%`);
      }
      if (estatusFilter !== "all") {
        query = query.eq("id_estatus_proyecto", parseInt(estatusFilter));
      }

      // Apply Sozu filter
      if (sozuFilter === "sozu" && sozuProjectIds.size > 0) {
        query = query.in("id", Array.from(sozuProjectIds));
      } else if (sozuFilter === "no-sozu" && sozuProjectIds.size > 0) {
        // Filter out Sozu projects server-side using NOT IN
        const sozuIds = Array.from(sozuProjectIds);
        // Supabase doesn't have a direct "not in" on .in(), so we use .not()
        query = query.not("id", "in", `(${sozuIds.join(",")})`);
      }
      
      const { data, error, count } = await query
        .order("nombre", { ascending: true })
        .range(from, to);
      
      if (error) {
        console.error("Error fetching active projects:", error);
        return { projects: [], count: 0 };
      }
      
      // Add precio_m2_actual from raw query if available
      let projects = ((data || []) as any[]).map((project: any) => ({
        ...project,
        precio_m2_actual: project.precio_m2_actual || null
      }));
      
      return { projects, count: count || 0 };
    },
    enabled: !isLoadingAccess,
  });

  const activeProjects = activeProjectsData?.projects || [];
  const totalActiveCount = activeProjectsData?.count || 0;

  const { data: deletedProjectsData, refetch: refetchDeleted } = useQuery({
    queryKey: ["projects", "deleted", itemsPerPage, currentPageDeleted, searchTerm, estatusFilter],
    queryFn: async () => {
      const from = (currentPageDeleted - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      let query = supabase
        .from("proyectos")
        .select(`
          id,
          nombre,
          descripcion,
          direccion,
          latitud,
          longitud,
          activo,
          fecha_inicio_construccion,
          id_tipo_uso,
          id_estatus_proyecto,
          publicar,
          direccion_id_pais,
          direccion_id_estado,
          direccion_id_municipio,
          tipos_uso:id_tipo_uso (
            nombre
          ),
          estatus_proyecto:id_estatus_proyecto (
            id,
            nombre
          ),
          paises:direccion_id_pais (
            nombre
          ),
          estados_mx:direccion_id_estado (
            nombre
          ),
          municipios_mx:direccion_id_municipio (
            nombre
          ),
          edificios!fk_edificios_proyecto (
            id,
            nombre,
            edificios_modelos!fk_edificios_modelos_edificio (
              id,
              propiedades!fk_propiedades_edificio_modelo (
                id,
                precio_lista,
                m2_interiores,
                m2_exteriores
              )
            )
          ),
          multimedias_proyecto (
            id,
            url,
            es_imagen,
            activo
          ),
          videos_youtube (
            id,
            nombre,
            link,
            activo
          ),
          amenidades_proyectos (
            amenidades (
              id,
              nombre
            )
          ),
          entidades_relacionadas!fk_entrel_proyecto (
            id,
            id_persona,
            id_tipo_entidad,
            activo,
            personas!fk_entrel_persona (
              id,
              nombre_comercial,
              nombre_legal
            )
          )
        `, { count: 'exact' })
        .eq("entidades_relacionadas.activo", true)
        .eq("entidades_relacionadas.id_tipo_entidad", 3)
        .eq("activo", false);
      
      // Aplicar filtros
      if (searchTerm) {
        query = query.ilike("nombre", `%${searchTerm}%`);
      }
      if (estatusFilter !== "all") {
        query = query.eq("id_estatus_proyecto", parseInt(estatusFilter));
      }

      const { data, error, count } = await query
        .order("nombre", { ascending: true })
        .range(from, to);

      if (error) {
        console.error("Error fetching deleted projects:", error);
        return { projects: [], count: 0 };
      }
      
      // Add precio_m2_actual from raw query if available
      const projects = ((data || []) as any[]).map((project: any) => ({
        ...project,
        precio_m2_actual: project.precio_m2_actual || null
      }));
      
      return { projects, count: count || 0 };
    },
  });

  const deletedProjects = deletedProjectsData?.projects || [];
  const totalDeletedCount = deletedProjectsData?.count || 0;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Maintain focus on search input after re-render
  useEffect(() => {
    if (inputValue && searchInputRef.current && !activeProjectsData && !deletedProjectsData) {
      searchInputRef.current.focus();
    }
  }, [activeProjectsData, deletedProjectsData, inputValue]);

  // Reset pages when server-side filters change
  useEffect(() => {
    setCurrentPageActive(1);
  }, [searchTerm, estatusFilter, sozuFilter]);

  useEffect(() => {
    setCurrentPageDeleted(1);
  }, [searchTerm, estatusFilter, sozuFilter]);

  // Query para obtener estatus de proyecto para el filtro
  const { data: estatusProyecto = [] } = useQuery({
    queryKey: ["estatus-proyecto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estatus_proyecto")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      
      if (error) {
        console.error("Error fetching project status:", error);
        return [];
      }
      return data || [];
    },
  });

  const handleTogglePublicar = async (projectId: number, currentValue: boolean) => {
    try {
      // If trying to publish, validate requirements
      if (!currentValue) {
        // Check brochures (documentos with id_tipo_documento = 30)
        const { data: brochures, error: brochError } = await supabase
          .from("documentos")
          .select("id")
          .eq("id_proyecto", projectId)
          .eq("id_tipo_documento", 30)
          .eq("activo", true);

        if (brochError) {
          console.error("Error checking brochures:", brochError);
          toast.error("Error al validar requisitos de publicación");
          return;
        }

        // Check multimedia images
        const { data: multimedia, error: mmError } = await supabase
          .from("multimedias_proyecto")
          .select("id")
          .eq("id_proyecto", projectId)
          .eq("es_imagen", true)
          .eq("activo", true);

        if (mmError) {
          console.error("Error checking multimedia:", mmError);
          toast.error("Error al validar requisitos de publicación");
          return;
        }

        const brochureCount = brochures?.length || 0;
        const multimediaCount = multimedia?.length || 0;
        const issues: string[] = [];

        if (brochureCount === 0) {
          issues.push("al menos 1 brochure");
        }
        if (multimediaCount < 5) {
          issues.push(`al menos 5 imágenes multimedia (tiene ${multimediaCount})`);
        }

        if (issues.length > 0) {
          toast.error(`No se puede publicar. Requiere: ${issues.join(" y ")}.`, { duration: 6000 });
          return;
        }
      }

      const { error } = await supabase
        .from("proyectos")
        .update({ publicar: !currentValue })
        .eq("id", projectId);

      if (error) {
        console.error("Error toggling publicar:", error);
        toast.error("Error al cambiar el estado de publicación");
        return;
      }

      toast.success(!currentValue ? "Proyecto publicado" : "Proyecto despublicado");
      refetchActive();
      refetchDeleted();
    } catch (error) {
      console.error("Error toggling publicar:", error);
      toast.error("Error al cambiar el estado de publicación");
    }
  };


  const handleProjectAdded = () => {
    refetchActive();
  };

  const handleProjectUpdated = () => {
    refetchActive();
    refetchDeleted();
  };

  const handleProjectDeleted = async (projectId: number) => {
    try {
      const { error } = await supabase
        .from("proyectos")
        .update({ activo: false })
        .eq("id", projectId);

      if (error) {
        console.error("Error deleting project:", error);
        return;
      }

      refetchActive();
      refetchDeleted();
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  // Helper functions
  const getMultimediaCount = (project: any) => {
    const images = project.multimedias_proyecto?.filter((m: any) => m.es_imagen && m.activo) || [];
    const videos = project.multimedias_proyecto?.filter((m: any) => !m.es_imagen && m.activo) || [];
    const youtubeVideos = project.videos_youtube?.filter((v: any) => v.activo) || [];
    return { 
      images: images.length, 
      videos: videos.length + youtubeVideos.length 
    };
  };

  const getCityName = (project: any) => {
    if (project.municipios_mx?.nombre && project.estados_mx?.nombre) {
      return `${project.municipios_mx.nombre}, ${project.estados_mx.nombre}`;
    }
    if (project.estados_mx?.nombre) {
      return project.estados_mx.nombre;
    }
    if (project.paises?.nombre) {
      return project.paises.nombre;
    }
    return "No especificada";
  };

  const getBadgeVariant = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case 'activo':
      case 'en desarrollo':
        return 'default';
      case 'finalizado':
      case 'completado':
        return 'secondary';
      case 'en construcción':
      case 'construcción':
        return 'outline';
      case 'pausado':
      case 'suspendido':
        return 'destructive';
      case 'planeado':
      case 'planificado':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getAveragePropertyPrice = (project: any) => {
    console.log('Calculating average price for project:', project.nombre);
    console.log('Project edificios:', project.edificios);
    
    const properties = project.edificios?.flatMap((edificio: any) => {
      console.log('Processing edificio:', edificio);
      return edificio.edificios_modelos?.flatMap((modelo: any) => {
        console.log('Processing modelo:', modelo);
        console.log('Modelo propiedades:', modelo.propiedades);
        return modelo.propiedades || [];
      }) || [];
    }) || [];
    
    console.log('Total properties found:', properties.length);
    console.log('Properties sample:', properties.slice(0, 2));
    
    if (properties.length === 0) return 0;
    
    const validProperties = properties.filter((property: any) => 
      property.precio_lista && property.precio_lista > 0
    );
    
    console.log('Valid properties with precio_lista:', validProperties.length);
    
    if (validProperties.length === 0) return 0;
    
    const totalPrice = validProperties.reduce((sum: number, property: any) => 
      sum + (property.precio_lista || 0), 0);
    
    const average = totalPrice / validProperties.length;
    console.log('Average price calculated:', average);
    
    return average;
  };

  const getTotalPrecioLista = (project: any) => {
    const properties = project.edificios?.flatMap((edificio: any) => 
      edificio.edificios_modelos?.flatMap((modelo: any) => 
        modelo.propiedades || []
      ) || []
    ) || [];
    
    if (properties.length === 0) return 0;
    
    const validProperties = properties.filter((property: any) => 
      property.precio_lista && property.precio_lista > 0
    );
    
    if (validProperties.length === 0) return 0;
    
    return validProperties.reduce((sum: number, property: any) => 
      sum + (property.precio_lista || 0), 0);
  };

  const getAveragePricePerM2 = (project: any) => {
    console.log('Calculating average price per M2 for project:', project.nombre);
    
    const properties = project.edificios?.flatMap((edificio: any) => 
      edificio.edificios_modelos?.flatMap((modelo: any) => 
        modelo.propiedades || []
      ) || []
    ) || [];
    
    console.log('Total properties for M2 calculation:', properties.length);
    
    if (properties.length === 0) return 0;
    
    const validProperties = properties.filter((property: any) => {
      const totalM2 = (property.m2_interiores || 0) + (property.m2_exteriores || 0);
      return property.precio_lista && property.precio_lista > 0 && totalM2 > 0;
    });
    
    console.log('Valid properties with precio_lista and m2:', validProperties.length);
    
    if (validProperties.length === 0) return 0;
    
    const totalPrice = validProperties.reduce((sum: number, property: any) => 
      sum + (property.precio_lista || 0), 0);
    const totalM2 = validProperties.reduce((sum: number, property: any) => {
      const m2 = (property.m2_interiores || 0) + (property.m2_exteriores || 0);
      return sum + m2;
    }, 0);
    
    if (totalM2 === 0) return 0;
    
    const averagePerM2 = totalPrice / totalM2;
    console.log('Average price per M2 calculated:', averagePerM2);
    
    return averagePerM2;
  };

  // Refinamiento client-side sobre las filas ya cargadas (Desarrollador y Ciudad
  // dependen de datos embebidos/joins, no de la query paginada del servidor).
  const applyClientFilters = (rows: any[]) =>
    rows.filter((p) => {
      if (desarrolladorFilter && !getDeveloperName(p).toLowerCase().includes(desarrolladorFilter.toLowerCase())) return false;
      if (ciudadFilter && !getCityName(p).toLowerCase().includes(ciudadFilter.toLowerCase())) return false;
      return true;
    });

  const filteredActiveProjects = applyClientFilters(activeProjects);
  const filteredDeletedProjects = applyClientFilters(deletedProjects);

  // Pagination logic para proyectos activos (ahora del lado del servidor)
  const totalActivePages = Math.ceil(totalActiveCount / itemsPerPage);

  // Pagination logic para proyectos eliminados (ahora del lado del servidor)
  const totalDeletedPages = Math.ceil(totalDeletedCount / itemsPerPage);

  const handleProjectRestored = async (projectId: number) => {
    try {
      const { error } = await supabase
        .from("proyectos")
        .update({ activo: true })
        .eq("id", projectId);

      if (error) {
        console.error("Error restoring project:", error);
        return;
      }

      refetchActive();
      refetchDeleted();
    } catch (error) {
      console.error("Error restoring project:", error);
    }
  };

  // Helper function to generate pagination items
  const getPaginationItems = (currentPage: number, totalPages: number) => {
    const items: (number | 'ellipsis')[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Always show first page
    items.push(1);
    
    // Calculate range around current page
    let rangeStart = Math.max(2, currentPage - 1);
    let rangeEnd = Math.min(totalPages - 1, currentPage + 1);
    
    // Adjust range if we're near the start or end
    if (currentPage <= 3) {
      rangeEnd = Math.min(4, totalPages - 1);
    }
    if (currentPage >= totalPages - 2) {
      rangeStart = Math.max(totalPages - 3, 2);
    }
    
    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
      items.push('ellipsis');
    }
    
    // Add range around current page
    for (let i = rangeStart; i <= rangeEnd; i++) {
      items.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
      items.push('ellipsis');
    }
    
    // Always show last page
    if (totalPages > 1) {
      items.push(totalPages);
    }
    
    return items;
  };

  const renderProjectsTable = (projects: any[], emptyMessage: string, isDeletedTab: boolean = false) => (
    <TooltipProvider>
      {projects.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Desarrollador</TableHead>
                <TableHead className="text-center">Num. Departamentos</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead className="text-center">Dirección</TableHead>
                <TableHead className="text-center">Total Proyecto</TableHead>
                <TableHead className="text-center">Precio Promedio Propiedades</TableHead>
                <TableHead className="text-center">Precio Promedio por M2</TableHead>
                <TableHead className="text-center">Multimedia</TableHead>
                <TableHead className="text-center">Showroom</TableHead>
                <TableHead className="text-center">Estatus</TableHead>
                <TableHead className="text-center">Comercializador</TableHead>
                <TableHead className="text-center">Publicar</TableHead>
                {hasAnyActionPermission && <TableHead className="text-center">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const multimedia = getMultimediaCount(project);
                const city = getCityName(project);
                const developer = getDeveloperName(project);
                const departmentCount = project.edificios?.reduce((total: number, edificio: any) => {
                  return total + (edificio.edificios_modelos?.reduce((edificioTotal: number, modelo: any) => {
                    return edificioTotal + (modelo.propiedades?.length || 0);
                  }, 0) || 0);
                }, 0) || 0;
                const totalPrecioLista = getTotalPrecioLista(project);
                const avgPropertyPrice = getAveragePropertyPrice(project);
                const avgPricePerM2 = getAveragePricePerM2(project);
                
                return (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <span className="block max-w-[220px] truncate" title={project.nombre}>{project.nombre}</span>
                    </TableCell>
                    <TableCell>
                      {developer === "Por definir" ? (
                        <EmptyValue label="Por definir" />
                      ) : (
                        <span className="block max-w-[180px] truncate" title={developer}>{developer}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{departmentCount}</TableCell>
                    <TableCell>
                      {city === "No especificada" ? (
                        <EmptyValue label="No especificada" />
                      ) : (
                        <span className="block max-w-[180px] truncate" title={city}>{city}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {project.latitud && project.longitud ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={`https://www.google.com/maps?q=${project.latitud},${project.longitud}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-primary hover:text-primary/80"
                            >
                              <MapPin className="h-5 w-5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>{project.direccion || "Ver en mapa"}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center">
                              <MapPin className="h-5 w-5 text-muted-foreground/40" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Sin coordenadas</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums whitespace-nowrap">
                      {totalPrecioLista > 0 ? formatCurrencyFull(totalPrecioLista) : <EmptyValue />}
                    </TableCell>
                    <TableCell className="text-center tabular-nums whitespace-nowrap">
                      {avgPropertyPrice > 0 ? formatCurrencyFull(avgPropertyPrice) : <EmptyValue />}
                    </TableCell>
                    <TableCell className="text-center tabular-nums whitespace-nowrap">
                      {avgPricePerM2 > 0 ? formatCurrencyFull(avgPricePerM2) : <EmptyValue />}
                    </TableCell>
                    <TableCell className="text-center">
                      {multimedia.images > 0 || multimedia.videos > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mx-auto flex h-auto items-center gap-2 p-1 text-primary hover:bg-primary/10 hover:text-primary"
                              onClick={() => setSelectedProjectMultimedia({
                                multimedia: project.multimedias_proyecto || [],
                                youtubeVideos: project.videos_youtube || [],
                                projectName: project.nombre
                              })}
                            >
                              {multimedia.images > 0 && (
                                <span className="flex items-center gap-1">
                                  <Image className="h-4 w-4" />
                                  <span className="text-sm tabular-nums">{multimedia.images}</span>
                                </span>
                              )}
                              {multimedia.videos > 0 && (
                                <span className="flex items-center gap-1">
                                  <Video className="h-4 w-4" />
                                  <span className="text-sm tabular-nums">{multimedia.videos}</span>
                                </span>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Clic para ver la multimedia</TooltipContent>
                        </Tooltip>
                      ) : (
                        <EmptyValue label="Sin multimedia" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <ShowroomCell projectId={project.id} projectName={project.nombre} onShowDetail={(showrooms) => {
                        setShowroomDetail({ showrooms, projectName: project.nombre });
                        setSelectedShowroomIndex(0);
                      }} />
                    </TableCell>
                    <TableCell className="text-center">
                      {project.estatus_proyecto?.nombre ? (
                        <Badge variant={getBadgeVariant(project.estatus_proyecto?.nombre)} className="max-w-[160px] truncate">
                          {project.estatus_proyecto.nombre}
                        </Badge>
                      ) : (
                        <EmptyValue label="Sin estatus" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {inmobiliariaProjectMap[project.id] ? (
                        <Badge variant="default" className="max-w-[160px] truncate" title={inmobiliariaProjectMap[project.id]}>
                          {inmobiliariaProjectMap[project.id]}
                        </Badge>
                      ) : (
                        <EmptyValue />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {sozuProjectIds.has(project.id) ? (
                        <Switch
                          checked={!!project.publicar}
                          onCheckedChange={() => handleTogglePublicar(project.id, !!project.publicar)}
                          disabled={isDeletedTab}
                        />
                      ) : (
                        <EmptyValue label="N/A" />
                      )}
                    </TableCell>
                    {hasAnyActionPermission && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {!isDeletedTab && (canUpdate || isSuperAdmin) && (
                            <EditProjectDialog
                              projectId={project.id}
                              onProjectUpdated={handleProjectUpdated}
                              triggerTooltip="Editar proyecto"
                              canCreate={canCreate || isSuperAdmin}
                              canUpdate={canUpdate || isSuperAdmin}
                              canDelete={canDelete || isSuperAdmin}
                              trigger={
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar proyecto">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              }
                            />
                          )}
                          {(canDelete || isSuperAdmin) && !(project.id_tipo_uso === 9 || project.id_tipo_uso === 10 || project.id_tipo_uso === 11) && (
                            <AlertDialog>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={isDeletedTab ? "h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" : "h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"}
                                      disabled={!isDeletedTab && project.edificios && project.edificios.length > 0}
                                      aria-label={isDeletedTab ? "Restaurar proyecto" : "Eliminar proyecto"}
                                    >
                                      {isDeletedTab ? (
                                        <RotateCcw className="h-4 w-4" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {!isDeletedTab && project.edificios && project.edificios.length > 0
                                    ? "No se puede eliminar: tiene edificios"
                                    : isDeletedTab ? "Restaurar proyecto" : "Eliminar proyecto"}
                                </TooltipContent>
                              </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {isDeletedTab ? 'Restaurar Proyecto' : 'Eliminar Proyecto'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {isDeletedTab
                                    ? `¿Estás seguro de que deseas restaurar el proyecto "${project.nombre}"?`
                                    : `¿Estás seguro de que deseas eliminar el proyecto "${project.nombre}"? Esta acción se puede revertir posteriormente.`
                                  }
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => isDeletedTab ? handleProjectRestored(project.id) : handleProjectDeleted(project.id)}
                                  className={isDeletedTab ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                                >
                                  {isDeletedTab ? 'Restaurar' : 'Eliminar'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                           </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-14 text-center">
          <FolderX className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="font-medium text-foreground">{emptyMessage}</p>
          {hasActiveFilters && (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Prueba ajustar o limpiar los filtros.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Limpiar filtros
              </Button>
            </>
          )}
        </div>
      )}
    </TooltipProvider>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proyectos</h1>
          <p className="text-muted-foreground">Gestiona todos los proyectos inmobiliarios</p>
        </div>
        {(hasUnrestrictedAccess && (canCreate || isSuperAdmin)) && <NewProjectDialog onProjectAdded={handleProjectAdded} />}
      </div>

      {hasNoAccess ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Lock className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Sin acceso a proyectos</h2>
          <p className="text-muted-foreground max-w-md">
            No tienes acceso a ningún proyecto. Contacta a un administrador para que te asigne los proyectos que necesitas ver.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar proyectos por nombre..."
              ref={searchInputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-10 pr-10"
            />
            {inputValue && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => { setInputValue(""); setSearchTerm(""); searchInputRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

      {/* Filtros específicos */}
      <div className="rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Filtros
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
            className={`h-8 gap-1 ${hasActiveFilters ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-muted-foreground"}`}
          >
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Desarrollador</label>
            <div className="relative">
              <Input
                placeholder="Filtrar por desarrollador..."
                value={desarrolladorFilter}
                onChange={(e) => setDesarrolladorFilter(e.target.value)}
                className="pr-9"
              />
              {desarrolladorFilter && (
                <button type="button" aria-label="Limpiar desarrollador" onClick={() => setDesarrolladorFilter("")} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ciudad</label>
            <div className="relative">
              <Input
                placeholder="Filtrar por ciudad..."
                value={ciudadFilter}
                onChange={(e) => setCiudadFilter(e.target.value)}
                className="pr-9"
              />
              {ciudadFilter && (
                <button type="button" aria-label="Limpiar ciudad" onClick={() => setCiudadFilter("")} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Estatus</label>
            <Select value={estatusFilter} onValueChange={setEstatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los estatus" />
              </SelectTrigger>
              <SelectContent className="max-h-[228px]">
                <SelectItem value="all">Todos los estatus</SelectItem>
                {estatusProyecto.map((estatus) => (
                  <SelectItem key={estatus.id} value={estatus.id.toString()}>
                    {estatus.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Comercializada por</label>
            <Select value={sozuFilter} onValueChange={setSozuFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sozu">Sozu</SelectItem>
                <SelectItem value="no-sozu">No Sozu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Proyectos Activos ({totalActiveCount})
          </TabsTrigger>
          <TabsTrigger value="deleted">
            Proyectos Eliminados ({totalDeletedCount})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-4">
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                Mostrando <span className="font-medium text-foreground tabular-nums">{filteredActiveProjects.length}</span> de{" "}
                <span className="font-medium text-foreground tabular-nums">{totalActiveCount}</span> proyectos
              </p>
              {renderProjectsTable(
                filteredActiveProjects,
                hasActiveFilters ? "No se encontraron proyectos activos con estos filtros." : "No hay proyectos activos disponibles.",
                false
              )}
              {totalActivePages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPageActive(Math.max(1, currentPageActive - 1))}
                          className={currentPageActive === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {getPaginationItems(currentPageActive, totalActivePages).map((item, index) => (
                        item === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={item}>
                            <PaginationLink
                              onClick={() => setCurrentPageActive(item as number)}
                              isActive={currentPageActive === item}
                              className="cursor-pointer"
                            >
                              {item}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPageActive(Math.min(totalActivePages, currentPageActive + 1))}
                          className={currentPageActive === totalActivePages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
        </TabsContent>

        <TabsContent value="deleted" className="mt-4">
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                Mostrando <span className="font-medium text-foreground tabular-nums">{filteredDeletedProjects.length}</span> de{" "}
                <span className="font-medium text-foreground tabular-nums">{totalDeletedCount}</span> proyectos
              </p>
              {renderProjectsTable(
                filteredDeletedProjects,
                hasActiveFilters ? "No se encontraron proyectos eliminados con estos filtros." : "No hay proyectos eliminados.",
                true
              )}
              {totalDeletedPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPageDeleted(Math.max(1, currentPageDeleted - 1))}
                          className={currentPageDeleted === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {getPaginationItems(currentPageDeleted, totalDeletedPages).map((item, index) => (
                        item === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={item}>
                            <PaginationLink
                              onClick={() => setCurrentPageDeleted(item as number)}
                              isActive={currentPageDeleted === item}
                              className="cursor-pointer"
                            >
                              {item}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPageDeleted(Math.min(totalDeletedPages, currentPageDeleted + 1))}
                          className={currentPageDeleted === totalDeletedPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
        </TabsContent>
      </Tabs>

          {selectedProjectMultimedia && (
            <ProjectMultimediaModal
              isOpen={true}
              onClose={() => setSelectedProjectMultimedia(null)}
              multimedia={selectedProjectMultimedia.multimedia}
              youtubeVideos={selectedProjectMultimedia.youtubeVideos}
              projectName={selectedProjectMultimedia.projectName}
            />
          )}

          {/* Showroom Detail Dialog */}
          <ShowroomDialog open={!!showroomDetail} onOpenChange={() => setShowroomDetail(null)}>
            <ShowroomDialogContent className="max-w-md">
              <ShowroomDialogHeader>
                <ShowroomDialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Showrooms de {showroomDetail?.projectName}
                </ShowroomDialogTitle>
              </ShowroomDialogHeader>
              {showroomDetail && showroomDetail.showrooms.length > 0 && (() => {
                const current = showroomDetail.showrooms[selectedShowroomIndex];
                const googleMapsUrl = current ? `https://www.google.com/maps?q=${current.latitud},${current.longitud}` : '';
                return (
                <div className="space-y-4">
                  {showroomDetail.showrooms.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                      {showroomDetail.showrooms.map((s, idx) => (
                        <Button
                          key={idx}
                          variant={selectedShowroomIndex === idx ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedShowroomIndex(idx)}
                        >
                          {s.nombre || `Showroom ${idx + 1}`}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Showroom Name */}
                  <h3 className="text-lg font-semibold">
                    {current?.nombre || `Showroom ${selectedShowroomIndex + 1}`}
                  </h3>

                  {/* Address with icon */}
                  {current?.descripcion_direccion && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground">{current.descripcion_direccion}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => window.open(googleMapsUrl, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver en Google Maps
                    </button>
                    <span className="text-muted-foreground/40">|</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(current?.descripcion_direccion || `${current?.latitud}, ${current?.longitud}`);
                        toast.success("Ubicación copiada");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar ubicación
                    </button>
                  </div>

                  {/* Collapsible map */}
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-primary hover:underline list-none">
                      <Map className="h-4 w-4" />
                      Ver en el mapa
                    </summary>
                    <div className="mt-2 rounded-lg overflow-hidden border">
                      <GoogleMapComponent
                        onLocationSelect={() => {}}
                        initialLocation={{ 
                          lat: current?.latitud, 
                          lng: current?.longitud 
                        }}
                        readOnly
                      />
                    </div>
                  </details>
                </div>
                );
              })()}
            </ShowroomDialogContent>
          </ShowroomDialog>
        </>
      )}
    </div>
  );
};

export default Proyectos;