import { TicketsWorkspace } from "@/components/admin/portal-tickets/tickets/TicketsWorkspace";
import { USUARIO_ACTUAL } from "@/lib/portal-tickets/tickets-data";
import { usePortalTicketsImpersonation } from "@/contexts/PortalTicketsImpersonationContext";

export default function MisTicketsPage() {
  const { impersonatedUser } = usePortalTicketsImpersonation();
  return (
    <TicketsWorkspace
      scope="mios"
      titulo="Mis tickets"
      descripcion={
        impersonatedUser
          ? `Tickets asignados a ${impersonatedUser.nombre}.`
          : "Tickets asignados a tu usuario."
      }
      propietarioActualId={USUARIO_ACTUAL.id}
      rutaActiva="/admin/portal-tickets/mis-tickets"
    />
  );
}