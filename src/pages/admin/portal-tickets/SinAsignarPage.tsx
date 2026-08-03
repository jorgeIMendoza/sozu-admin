import { TicketsWorkspace } from "@/components/admin/portal-tickets/tickets/TicketsWorkspace";

export default function SinAsignarPage() {
  return (
    <TicketsWorkspace
      scope="sin-asignar"
      titulo="Tickets sin asignar"
      descripcion="Solicitudes que aún no tienen un responsable asignado."
      rutaActiva="/admin/portal-tickets/sin-asignar"
    />
  );
}