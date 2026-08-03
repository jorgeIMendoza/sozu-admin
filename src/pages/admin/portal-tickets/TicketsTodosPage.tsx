import { TicketsWorkspace } from "@/components/admin/portal-tickets/tickets/TicketsWorkspace";

export default function TicketsTodosPage() {
  return (
    <TicketsWorkspace
      scope="todos"
      titulo="Todos"
      descripcion="Seguimiento completo de solicitudes registradas en el portal."
      vistaInicial="kanban"
      rutaActiva="/admin/portal-tickets/todos"
    />
  );
}