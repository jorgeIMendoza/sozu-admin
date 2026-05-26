import { ExpedienteDrawer } from "./ExpedienteDrawer";
import type { EntityType, VentaContext } from "./types";

/**
 * EjecucionDrawer — chrome del Portal de Administración para las 4 acciones
 * operativas de la Bandeja de Ejecución (cobro, pago externo, dispersión,
 * excepción). Es un thin wrapper sobre ExpedienteDrawer: reusa el header,
 * la VentaContextCard y el footer; el componente de contenido recibe la
 * acción específica (timbrar, ejecutar SPEI, dispersar, aplicar).
 */
export function EjecucionDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  subtitle,
  ventaContext,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: Extract<
    EntityType,
    | "ejecucion_factura_sozu"
    | "ejecucion_cobro"
    | "ejecucion_pago_externo"
    | "ejecucion_dispersion"
    | "ejecucion_excepcion"
  >;
  entityId: string;
  subtitle?: string;
  ventaContext: VentaContext;
  children: React.ReactNode;
}) {
  return (
    <ExpedienteDrawer
      open={open}
      onOpenChange={onOpenChange}
      entityType={entityType}
      entityId={entityId}
      subtitle={subtitle}
      ventaContext={ventaContext}
    >
      {children}
    </ExpedienteDrawer>
  );
}
