import { PageHeader, EstadoVista } from "./_helpers";

/**
 * Auditoría — Portal Condominio.
 *
 * Vista pensada para mostrar una bitácora de eventos del sistema (cargos
 * creados, promesas de pago, conciliaciones, egresos aprobados, reservas,
 * etc.) para el condominio activo.
 *
 * Estado actual: NO existe todavía una fuente real de auditoría. El
 * `CondominioDataset` (useCondominioDataset) no expone eventos/logs, y no hay
 * tabla de bitácora específica del condominio en BD. Hasta que exista esa
 * fuente, la vista muestra un estado vacío en lugar de datos de ejemplo.
 *
 * Para cablearla en el futuro: agregar los eventos al dataset (o una query
 * dedicada tipo `fetchCondominioAuditoria(proyectoId)`) y renderizar la tabla
 * con esos datos reales, siguiendo el patrón de Cargos/Cobranza.
 */
export default function Auditoria() {
  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Bitácora de eventos del sistema" />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <EstadoVista
          isLoading={false}
          vacio
          mensajeVacio="Aún no hay una bitácora de eventos conectada a la base de datos para este condominio."
        />
      </div>
    </div>
  );
}
