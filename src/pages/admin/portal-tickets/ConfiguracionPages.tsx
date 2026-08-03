import { CrudSection } from "@/components/admin/portal-tickets/CrudSection";
import { useTickets, nuevoId } from "@/lib/portal-tickets/tickets-store";
import { PRIORIDADES } from "@/lib/portal-tickets/tickets-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePagePermissions } from "@/hooks/usePagePermissions";

export function PipelinesConfigPage() {
  const { pipelines, guardarPipeline, eliminarPipeline } = useTickets();
  const { canUpdate, canCreate } = usePagePermissions("/admin/portal-tickets/configuracion/pipelines");
  return (
    <CrudSection
      titulo="Pipelines"
      descripcion="Flujos de trabajo disponibles para clasificar los tickets."
      campos={[
        { key: "nombre", label: "Nombre", tipo: "text" },
        { key: "descripcion", label: "Descripción", tipo: "text" },
      ]}
      items={pipelines}
      nuevo={() => ({ id: `p-${nuevoId()}`, nombre: "", descripcion: "" })}
      onGuardar={guardarPipeline}
      onEliminar={eliminarPipeline}
      soloLectura={!canUpdate && !canCreate}
    />
  );
}

export function EtapasConfigPage() {
  const { etapas, pipelines, guardarEtapa, eliminarEtapa } = useTickets();
  const { canUpdate, canCreate } = usePagePermissions("/admin/portal-tickets/configuracion/etapas");
  return (
    <CrudSection
      titulo="Etapas"
      descripcion="Etapas por pipeline. Las etapas marcadas como cerradas finalizan el ticket."
      campos={[
        { key: "nombre", label: "Nombre", tipo: "text" },
        {
          key: "pipelineId",
          label: "Pipeline",
          tipo: "select",
          opciones: pipelines.map((p) => ({ value: p.id, label: p.nombre })),
        },
        { key: "orden", label: "Orden", tipo: "number" },
        { key: "cerrada", label: "Cierra el ticket", tipo: "switch" },
      ]}
      items={[...etapas].sort((a, b) => a.pipelineId.localeCompare(b.pipelineId) || a.orden - b.orden)}
      nuevo={() => ({
        id: `e-${nuevoId()}`,
        pipelineId: pipelines[0]?.id ?? "",
        nombre: "",
        orden: etapas.length + 1,
        cerrada: false,
      })}
      onGuardar={guardarEtapa}
      onEliminar={eliminarEtapa}
      soloLectura={!canUpdate && !canCreate}
      render={(item, campo) => {
        if (campo.key === "pipelineId")
          return pipelines.find((p) => p.id === item.pipelineId)?.nombre ?? "—";
        if (campo.key === "cerrada")
          return (
            <Badge variant={item.cerrada ? "secondary" : "outline"}>
              {item.cerrada ? "Sí" : "No"}
            </Badge>
          );
        return undefined;
      }}
    />
  );
}

export function CategoriasConfigPage() {
  const { categorias, guardarCategoria, eliminarCategoria } = useTickets();
  const { canUpdate, canCreate } = usePagePermissions("/admin/portal-tickets/configuracion/categorias");
  return (
    <CrudSection
      titulo="Categorías"
      descripcion="Tipos de incidencia disponibles al crear un ticket."
      campos={[{ key: "nombre", label: "Nombre", tipo: "text" }]}
      items={categorias}
      nuevo={() => ({ id: `c-${nuevoId()}`, nombre: "" })}
      onGuardar={guardarCategoria}
      onEliminar={eliminarCategoria}
      soloLectura={!canUpdate && !canCreate}
    />
  );
}

export function EquipoConfigPage() {
  const { agentes, tickets, guardarAgente, eliminarAgente } = useTickets();
  const { canUpdate, canCreate } = usePagePermissions("/admin/portal-tickets/configuracion/equipo");
  return (
    <div className="space-y-6">
      <CrudSection
        titulo="Equipo"
        descripcion="Agentes que pueden ser propietarios de un ticket."
        campos={[
          { key: "nombre", label: "Nombre", tipo: "text" },
          { key: "rol", label: "Rol", tipo: "text" },
          { key: "email", label: "Correo", tipo: "text" },
        ]}
        items={agentes}
        nuevo={() => ({ id: `a-${nuevoId()}`, nombre: "", rol: "", email: "" })}
        onGuardar={guardarAgente}
        onEliminar={eliminarAgente}
        soloLectura={!canUpdate && !canCreate}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Carga de trabajo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {agentes.map((a) => {
            const abiertos = tickets.filter(
              (t) => t.propietarioId === a.id && !t.fechaCierre,
            ).length;
            return (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.rol}</p>
                </div>
                <Badge variant="secondary">{abiertos} abiertos</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export function PrioridadesConfigPage() {
  const { tickets } = useTickets();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prioridades</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Catálogo fijo del sistema. Distribución actual de tickets abiertos:
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRIORIDADES.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm">{p.nombre}</span>
              <Badge variant="secondary">
                {tickets.filter((t) => t.prioridad === p.id && !t.fechaCierre).length}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}