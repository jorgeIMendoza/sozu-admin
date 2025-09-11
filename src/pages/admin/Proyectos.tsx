import { ProjectCard } from "@/components/admin/ProjectCard";
import { NewProjectDialog } from "@/components/admin/NewProjectDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { useState } from "react";

const Proyectos = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: activeProjects = [], refetch: refetchActive } = useQuery({
    queryKey: ["projects", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proyectos")
        .select(`
          id,
          nombre,
          descripcion,
          direccion,
          activo,
          precio_m2,
          fecha_inicio,
          id_tipo_uso,
          tipos_uso:id_tipo_uso (
            nombre
          ),
          edificios!fk_edificios_proyecto (
            id
          ),
          amenidades_proyectos (
            amenidades (
              id,
              nombre
            )
          )
        `)
        .eq("activo", true)
        .order("fecha_creacion", { ascending: false });
      
      if (error) {
        console.error("Error fetching active projects:", error);
        return [];
      }
      return data || [];
    },
  });

  const { data: deletedProjects = [], refetch: refetchDeleted } = useQuery({
    queryKey: ["projects", "deleted"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proyectos")
        .select(`
          id,
          nombre,
          descripcion,
          direccion,
          activo,
          precio_m2,
          fecha_inicio,
          id_tipo_uso,
          tipos_uso:id_tipo_uso (
            nombre
          ),
          edificios!fk_edificios_proyecto (
            id
          ),
          amenidades_proyectos (
            amenidades (
              id,
              nombre
            )
          )
        `)
        .eq("activo", false)
        .order("fecha_creacion", { ascending: false });
      
      if (error) {
        console.error("Error fetching deleted projects:", error);
        return [];
      }
      return data || [];
    },
  });


  const handleProjectAdded = () => {
    refetchActive();
  };

  const handleProjectUpdated = () => {
    refetchActive();
    refetchDeleted();
  };

  const handleProjectDeleted = () => {
    refetchActive();
    refetchDeleted();
  };

  // Filter active projects based on search term
  const filteredActiveProjects = activeProjects.filter(project =>
    project.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.direccion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter deleted projects based on search term
  const filteredDeletedProjects = deletedProjects.filter(project =>
    project.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.direccion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderProjectsGrid = (projects: any[], emptyMessage: string) => (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map((project) => (
          <ProjectCard 
            key={project.id} 
            id={project.id}
            nombre={project.nombre}
            direccion={project.direccion}
            precio_m2={project.precio_m2}
            activo={project.activo}
            tipo_uso={project.tipos_uso?.nombre}
            numero_edificios={project.edificios?.length || 0}
            numero_amenidades={project.amenidades_proyectos?.length || 0}
            fecha_inicio={project.fecha_inicio}
            descripcion={project.descripcion}
            onProjectUpdated={handleProjectUpdated}
            onProjectDeleted={handleProjectDeleted}
          />
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {emptyMessage}
          </p>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proyectos</h1>
          <p className="text-muted-foreground">Gestiona todos los proyectos inmobiliarios</p>
        </div>
        <NewProjectDialog onProjectAdded={handleProjectAdded} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar proyectos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Proyectos Activos ({activeProjects.length})
          </TabsTrigger>
          <TabsTrigger value="deleted">
            Proyectos Eliminados ({deletedProjects.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          {filteredActiveProjects.length === 0 && activeProjects.length > 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No se encontraron proyectos activos que coincidan con la búsqueda.
              </p>
            </div>
          ) : (
            renderProjectsGrid(
              filteredActiveProjects, 
              "No hay proyectos activos disponibles."
            )
          )}
        </TabsContent>
        
        <TabsContent value="deleted" className="mt-6">
          {filteredDeletedProjects.length === 0 && deletedProjects.length > 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No se encontraron proyectos eliminados que coincidan con la búsqueda.
              </p>
            </div>
          ) : (
            renderProjectsGrid(
              filteredDeletedProjects, 
              "No hay proyectos eliminados."
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Proyectos;