import { TicketsWorkspace } from "@/components/admin/portal-tickets/tickets/TicketsWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalTicketsImpersonation } from "@/contexts/PortalTicketsImpersonationContext";

export default function MisTicketsPage() {
  const { user } = useAuth();
  const { impersonatedUser } = usePortalTicketsImpersonation();
  // Propietario a filtrar = el usuario impersonado (si un Super Admin está "viendo como")
  // o el auth_user_id del usuario actual.
  const propietarioActualId = impersonatedUser?.id ?? user?.id ?? "";
  return (
    <TicketsWorkspace
      scope="mios"
      titulo="Mis tickets"
      descripcion={
        impersonatedUser
          ? `Tickets asignados a ${impersonatedUser.nombre}.`
          : "Tickets asignados a tu usuario."
      }
      propietarioActualId={propietarioActualId}
      rutaActiva="/admin/portal-tickets/mis-tickets"
    />
  );
}
