import { TicketsWorkspace } from "@/components/admin/portal-tickets/tickets/TicketsWorkspace";

export default function TicketsTodosPage() {
  return (
    <TicketsWorkspace
      scope="todos"
      titulo="Todos los tickets"
      descripcion="Seguimiento completo de solicitudes registradas en el portal."
      rutaActiva="/admin/portal-tickets/todos"
    />
  );
}