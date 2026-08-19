import { useAuth } from "@/contexts/AuthContext";
import { useCrmImpersonation } from "@/contexts/CrmImpersonationContext";
import { activityLoggerService } from "@/services/activityLoggerService";

// Logger del CRM: registra en logs_actividad QUIÉN hace cada acción del CRM.
// - Registra SIEMPRE al actor REAL (el usuario autenticado), aunque esté impersonando ("Ver como");
//   si impersona, lo anota como `_visto_como` en el payload — así la auditoría no se puede falsear.
// - Fail-soft: activityLoggerService silencia sus errores → nunca rompe la operación principal.
// - workflow = `crm_<entidad>` para poder filtrar los logs del CRM (workflow LIKE 'crm_%')
//   en el módulo Logs, sin mezclarlos con la bitácora del resto de la plataforma.
export function useCrmLogger() {
  const { user } = useAuth();
  const { impersonatedCrmUserEmail } = useCrmImpersonation();
  const actor = user?.email ?? "desconocido";
  const meta = (d?: Record<string, unknown>): Record<string, unknown> =>
    impersonatedCrmUserEmail ? { ...(d ?? {}), _visto_como: impersonatedCrmUserEmail } : (d ?? {});

  return {
    /** Alta de una entidad del CRM (contacto, negocio, tarea, cita, nota, comentario…). */
    logCrear: (entidad: string, data: Record<string, unknown>) =>
      activityLoggerService.registrarCreacion(actor, entidad, meta(data), `crm_${entidad}`),
    /** Edición: pasa el estado anterior (si lo tienes) y el nuevo. */
    logActualizar: (entidad: string, antes: Record<string, unknown> | null, despues: Record<string, unknown>) =>
      activityLoggerService.registrarActualizacion(actor, entidad, antes, meta(despues), `crm_${entidad}`),
    /** Borrado (lógico o real) de una entidad del CRM. */
    logEliminar: (entidad: string, data: Record<string, unknown>) =>
      activityLoggerService.registrarEliminacion(actor, entidad, meta(data), `crm_${entidad}`),
    /** Asignación de dueño/propietario. */
    logAsignar: (entidad: string, data: Record<string, unknown>) =>
      activityLoggerService.registrarAsignacion(actor, entidad, meta(data), `crm_${entidad}`),
  };
}
