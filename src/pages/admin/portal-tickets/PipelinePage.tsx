import { TicketsWorkspace } from "@/components/admin/portal-tickets/tickets/TicketsWorkspace";

export default function PipelinePage() {
  return (
    <TicketsWorkspace
      scope="todos"
      titulo="Pipeline"
      descripcion="Vista Kanban por etapa del pipeline seleccionado."
      vistaInicial="kanban"
      rutaActiva="/admin/portal-tickets/pipeline"
    />
  );
}