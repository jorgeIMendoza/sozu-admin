import { CrudSection } from "@/components/admin/portal-tickets/CrudSection";
import {
  PipelinesEtapasConfig,
  CategoriasPorPipelineConfig,
} from "@/components/admin/portal-tickets/PipelinesEtapasConfig";
import { useTickets } from "@/lib/portal-tickets/tickets-store";
import { PRIORIDADES } from "@/lib/portal-tickets/tickets-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePagePermissions } from "@/hooks/usePagePermissions";

// Pipelines + sus etapas en una sola pantalla (master-detail, estilo CRM).
export function PipelinesConfigPage() {
  const { canUpdate, canCreate } = usePagePermissions("/admin/portal-tickets/configuracion/pipelines");
  return <PipelinesEtapasConfig soloLectura={!canUpdate && !canCreate} />;
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
      items={[...etapas].sort(
        (a, b) => Number(a.pipelineId) - Number(b.pipelineId) || a.orden - b.orden,
      )}
      nuevo={() => ({
        id: "",
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

// Categorías por pipeline, con el mismo diseño master-detail que Pipelines.
export function CategoriasConfigPage() {
  const { canUpdate, canCreate } = usePagePermissions("/admin/portal-tickets/configuracion/categorias");
  return <CategoriasPorPipelineConfig soloLectura={!canUpdate && !canCreate} />;
}

export function EquipoConfigPage() {
  // El equipo son usuarios reales de la plataforma (con acceso al portal de tickets):
  // se listan aquí como candidatos a propietario, pero se administran en el módulo de Usuarios.
  const { agentes, tickets, guardarAgente, eliminarAgente } = useTickets();
  return (
    <div className="space-y-6">
      <CrudSection
        titulo="Equipo"
        descripcion="Usuarios con acceso al portal que pueden ser propietarios de un ticket. Se administran desde el módulo de Usuarios."
        campos={[
          { key: "nombre", label: "Nombre", tipo: "text" },
          { key: "rol", label: "Rol", tipo: "text" },
          { key: "email", label: "Correo", tipo: "text" },
        ]}
        items={agentes}
        nuevo={() => ({ id: "", nombre: "", rol: "", email: "" })}
        onGuardar={guardarAgente}
        onEliminar={eliminarAgente}
        soloLectura
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Carga de trabajo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {agentes.map((a) => {
            const abiertos = tickets.filter(
              (t) => t.propietarios.includes(a.id) && !t.fechaCierre,
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
