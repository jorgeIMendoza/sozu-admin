import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/admin/StatCard";
import { NoProjectAccess } from "@/components/admin/NoProjectAccess";
import { Building2, Home, DollarSign, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
interface ProjectData {
  id: number;
  nombre: string;
  direccion: string;
  precio_m2_actual: number;
  tipo_uso: string;
  monto_total: number;
  metraje_promedio: number;
  tiene_disponibles: boolean;
}

// PostgREST corta respuestas en 1000 filas (db-max-rows) y los .in() con miles de
// ids revientan el límite de la URL; se consulta por lotes de ids y se pagina
// cada lote hasta recibir página vacía (una página parcial no garantiza fin).
const IN_CHUNK_SIZE = 300;
const PAGE_SIZE = 1000;

async function fetchAllChunked<T>(
  ids: number[],
  buildQuery: (chunk: number[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_CHUNK_SIZE);
    for (let page = 0; ; page++) {
      const { data, error } = await buildQuery(chunk, page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length === 0) break;
    }
  }
  return rows;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isInmobiliariaRole = profile?.rol_id === 4;

  
  
  // Project access control
  const { 
    accessibleProjectIds, 
    hasUnrestrictedAccess, 
    isLoading: isLoadingAccess, 
    hasNoAccess 
  } = useProjectAccess();

  // Query para obtener datos de la inmobiliaria
  const { data: inmobiliariaData } = useQuery({
    queryKey: ['dashboard-inmobiliaria-data', profile?.id_persona],
    queryFn: async () => {
      const { data } = await supabase
        .from('personas')
        .select('nombre_legal, nombre_comercial, url_logo')
        .eq('id', profile!.id_persona)
        .single();
      return data;
    },
    enabled: isInmobiliariaRole && !!profile?.id_persona,
  });

  // Fetch Sozu-managed projects (Inmobiliaria = Real Estate Ventures)
  const { data: sozuProjectIds = [], isLoading: isLoadingSozu } = useQuery({
    queryKey: ['sozu-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entidades_relacionadas')
        .select('id_proyecto, personas!entidades_relacionadas_id_persona_fkey(nombre_legal)')
        .eq('id_tipo_entidad', 5) // Tipo Inmobiliaria
        .ilike('personas.nombre_legal', '%Real Estate Ventures%');

      if (error) throw error;
      // Hay registros tipo 5 sin proyecto asignado; un null dentro de .in('id', ...)
      // provoca 22P02 (invalid input syntax for type integer: "null") en PostgREST.
      return (data || [])
        .map(er => er.id_proyecto)
        .filter((id): id is number => id != null);
    }
  });

  // Fetch projects with amounts.
  // El dashboard solo muestra proyectos SOZU accesibles, así que se calcula
  // únicamente sobre esos. Todo se resuelve con 5 queries batched (waterfall
  // explícito + fetchAllChunked) en lugar de 6 queries por proyecto (N+1).
  const { data: projectAmounts = [] } = useQuery({
    queryKey: ['dashboard-project-amounts', accessibleProjectIds, sozuProjectIds],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // If user has no access and is not admin, return empty
      if (hasNoAccess || sozuProjectIds.length === 0) {
        return [];
      }

      let targetProjectIds = sozuProjectIds as number[];
      // Apply project access filter for non-admin users
      if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
        targetProjectIds = targetProjectIds.filter(id => accessibleProjectIds.includes(id));
      }
      if (targetProjectIds.length === 0) return [];

      const { data: projects, error: projectsError } = await supabase
        .from('proyectos')
        .select(`
          id,
          nombre,
          direccion,
          precio_m2_actual,
          tipos_uso(nombre)
        `)
        .eq('activo', true)
        .not('nombre', 'in', '("Productos","Servicios","Mantenimientos")')
        .in('id', targetProjectIds)
        .limit(10000);

      if (projectsError) throw projectsError;
      if (!projects || projects.length === 0) return [];

      // 1) Entidades relacionadas de todos los proyectos
      const entidades = await fetchAllChunked(projects.map(p => p.id), (chunk, from, to) =>
        supabase
          .from('entidades_relacionadas')
          .select('id, id_proyecto')
          .in('id_proyecto', chunk)
          .order('id')
          .range(from, to)
      );
      const proyectoByEntidad = new Map<number, number>();
      entidades.forEach(e => proyectoByEntidad.set(e.id, e.id_proyecto));

      // 2) Propiedades de todas las entidades (m2 para promedio, estatus para disponibles)
      const propiedades = await fetchAllChunked(entidades.map(e => e.id), (chunk, from, to) =>
        supabase
          .from('propiedades')
          .select('id, m2_interiores, id_estatus_disponibilidad, id_entidad_relacionada_dueno')
          .in('id_entidad_relacionada_dueno', chunk)
          .order('id')
          .range(from, to)
      );
      const proyectoByPropiedad = new Map<number, number>();
      propiedades.forEach(p => {
        const proyectoId = proyectoByEntidad.get(p.id_entidad_relacionada_dueno as number);
        if (proyectoId !== undefined) proyectoByPropiedad.set(p.id, proyectoId);
      });

      // 3) Ofertas activas de todas las propiedades
      const ofertas = await fetchAllChunked(propiedades.map(p => p.id), (chunk, from, to) =>
        supabase
          .from('ofertas')
          .select('id, id_propiedad')
          .in('id_propiedad', chunk)
          .eq('activo', true)
          .order('id')
          .range(from, to)
      );
      const proyectoByOferta = new Map<number, number>();
      ofertas.forEach(o => {
        const proyectoId = proyectoByPropiedad.get(o.id_propiedad as number);
        if (proyectoId !== undefined) proyectoByOferta.set(o.id, proyectoId);
      });

      // 4) Cuentas de cobranza activas de todas las ofertas
      const cuentas = await fetchAllChunked(ofertas.map(o => o.id), (chunk, from, to) =>
        supabase
          .from('cuentas_cobranza')
          .select('precio_final, id_oferta')
          .in('id_oferta', chunk)
          .eq('activo', true)
          .order('id')
          .range(from, to)
      );

      // Agregación en memoria por proyecto
      const montoByProyecto = new Map<number, number>();
      cuentas.forEach(c => {
        const proyectoId = proyectoByOferta.get(c.id_oferta as number);
        if (proyectoId === undefined) return;
        montoByProyecto.set(proyectoId, (montoByProyecto.get(proyectoId) || 0) + Number(c.precio_final));
      });

      const metrajeAcc = new Map<number, { sum: number; count: number }>();
      const disponiblesByProyecto = new Set<number>();
      propiedades.forEach(p => {
        const proyectoId = proyectoByPropiedad.get(p.id);
        if (proyectoId === undefined) return;
        if (p.m2_interiores && p.m2_interiores > 0) {
          const acc = metrajeAcc.get(proyectoId) || { sum: 0, count: 0 };
          acc.sum += p.m2_interiores;
          acc.count += 1;
          metrajeAcc.set(proyectoId, acc);
        }
        // id_estatus_disponibilidad = 2 es "Disponible"
        if (p.id_estatus_disponibilidad === 2) disponiblesByProyecto.add(proyectoId);
      });

      const projectsWithAmounts = projects.map(project => {
        const metraje = metrajeAcc.get(project.id);
        return {
          id: project.id,
          nombre: project.nombre,
          direccion: project.direccion,
          precio_m2_actual: project.precio_m2_actual || 0,
          tipo_uso: (project.tipos_uso as any)?.nombre || 'N/A',
          monto_total: montoByProyecto.get(project.id) || 0,
          metraje_promedio: metraje ? metraje.sum / metraje.count : 0,
          tiene_disponibles: disponiblesByProyecto.has(project.id)
        };
      });

      // Filter out projects with 0 monto_total and sort by monto_total descending
      return projectsWithAmounts
        .filter(p => p.monto_total > 0)
        .sort((a, b) => b.monto_total - a.monto_total);
    },
    enabled: !isLoadingAccess && !isLoadingSozu
  });

  // Filter projects to only show Sozu-managed ones (and accessible to user)
  const filteredProjects = useMemo(() => {
    let projects = projectAmounts.filter((p: ProjectData) => sozuProjectIds.includes(p.id));
    
    // Additional filter for non-admin users
    if (!hasUnrestrictedAccess && accessibleProjectIds.length > 0) {
      projects = projects.filter((p: ProjectData) => accessibleProjectIds.includes(p.id));
    }
    
    return projects;
  }, [projectAmounts, sozuProjectIds, hasUnrestrictedAccess, accessibleProjectIds]);

  // Fetch total buildings for filtered Sozu projects
  const projectIdsWithAmount = useMemo(() => 
    filteredProjects.map(p => p.id), 
    [filteredProjects]
  );

  const { data: totalBuildings = 0 } = useQuery({
    queryKey: ['dashboard-buildings', projectIdsWithAmount.join(',')],
    queryFn: async () => {
      if (projectIdsWithAmount.length === 0) return 0;
      
      const { count, error } = await supabase
        .from('edificios')
        .select('*', { count: 'exact', head: true })
        .in('id_proyecto', projectIdsWithAmount)
        .eq('activo', true);

      if (error) throw error;
      return count || 0;
    },
    enabled: projectIdsWithAmount.length > 0
  });

  // Calculate stats for Sozu projects only
  const stats = useMemo(() => {
    const totalProjects = filteredProjects.length;

    return [
      {
        title: "Proyectos",
        value: totalProjects.toString(),
        icon: Building2,
      }
    ];
  }, [filteredProjects]);

  // Get top 5 projects to display
  const topProjects = useMemo(() => {
    return filteredProjects.slice(0, 5);
  }, [filteredProjects]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Show no access message if user has no projects assigned
  if (!isLoadingAccess && hasNoAccess) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Panel de control</p>
          </div>
        </div>
        <NoProjectAccess message="No tienes proyectos asignados. Contacta al administrador para solicitar acceso a los proyectos." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con logo/nombre para Inmobiliaria */}
      {isInmobiliariaRole && inmobiliariaData && (
        <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-md">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                {inmobiliariaData.url_logo && (
                  <AvatarImage src={inmobiliariaData.url_logo} alt={inmobiliariaData.nombre_legal || ''} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {(inmobiliariaData.nombre_comercial || inmobiliariaData.nombre_legal)?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">
                  {inmobiliariaData.nombre_comercial || inmobiliariaData.nombre_legal}
                </h2>
                {inmobiliariaData.nombre_comercial && inmobiliariaData.nombre_legal && 
                  inmobiliariaData.nombre_comercial !== inmobiliariaData.nombre_legal && (
                  <p className="text-sm text-muted-foreground">{inmobiliariaData.nombre_legal}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isInmobiliariaRole && inmobiliariaData
              ? `Proyectos Comercializados por ${inmobiliariaData.nombre_comercial || inmobiliariaData.nombre_legal}`
              : 'Proyectos gestionados por Sozu'}
          </h1>
        </div>

      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div 
            key={index} 
            onClick={() => navigate('/admin/proyectos')} 
            className="cursor-pointer"
          >
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Proyectos a Comercializar</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {topProjects.map((project: ProjectData) => (
            <Card key={project.id} className="transition-all duration-200 hover:shadow-md">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{project.nombre}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span className="line-clamp-2">{project.direccion || 'Sin dirección'}</span>
                      </div>
                    </div>
                    <Badge 
                      variant="default"
                      className={project.tiene_disponibles 
                        ? "bg-green-500 text-white hover:bg-green-600" 
                        : "bg-blue-500 text-white hover:bg-blue-600"
                      }
                    >
                      {project.tiene_disponibles ? 'En venta' : 'Vendido'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">
                      <DollarSign className="h-4 w-4 inline mr-1" />
                      Costo por m²:
                    </div>
                    <div className="text-primary font-semibold">
                      {project.precio_m2_actual > 0 
                        ? formatCurrency(project.precio_m2_actual)
                        : 'N/A'
                      }
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-muted-foreground">
                      <Home className="h-4 w-4 inline mr-1" />
                      Metraje promedio:
                    </div>
                    <div className="font-medium">
                      {project.metraje_promedio > 0 
                        ? `${project.metraje_promedio.toFixed(0)} m²`
                        : 'N/A'
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {topProjects.length === 0 && !isLoadingAccess && (
          <div className="text-center py-12 text-muted-foreground">
            No hay proyectos disponibles
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
