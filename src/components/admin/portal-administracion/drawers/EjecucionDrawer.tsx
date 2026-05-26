import { ExpedienteDrawer } from "./ExpedienteDrawer";
import type { EntityType, VentaContext } from "./types";

/**
 * EjecucionDrawer — chrome del Portal de Administración para las acciones
 * operativas de la Bandeja de Ejecución (factura SOZU, cobro, pago externo,
 * dispersión, excepción). Es un thin wrapper sobre ExpedienteDrawer.
 *
 * Por defecto oculta la VentaContextCard (folio/cliente/estado) porque los
 * contenidos de Ejecución muestran toda esa información en sus secciones
 * (Resumen de la venta, Datos de la propiedad, Comprador), y duplicarla
 * agrega ruido visual sin valor. Override `hideVentaContext={false}` si
 * algún contenido nuevo NO la presenta internamente.
 */
export function EjecucionDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  subtitle,
  ventaContext,
  hideVentaContext = true,
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
  hideVentaContext?: boolean;
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
      hideVentaContext={hideVentaContext}
    >
      {children}
    </ExpedienteDrawer>
  );
}
