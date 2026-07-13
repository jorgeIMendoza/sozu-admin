import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Eliminación de pagos en cascada. Un pago no vive solo en `pagos`: tiene abonos en
// `aplicaciones_pago`, validaciones en `pago_validaciones`, bitácora en `cep_audit_log`
// y a veces facturas en `facturas_mantenimientos`. El borrado real lo hace el RPC
// transaccional `eliminar_pago` (ver Ejecuciones_manuales/P29_cobranza_eliminar_pago_rpc.md).
// Este hook solo lo invoca; NUNCA borra las tablas hijas por separado desde el cliente
// (no sería transaccional y podría corromper los totales).

export interface PagoImpacto {
  aplicaciones: number;
  validaciones: number;
  cep: number;
  facturas: number;
}

// Cuenta lo que se borrará junto con el pago, para mostrarlo en la confirmación.
export async function fetchPagoImpacto(idPago: number): Promise<PagoImpacto> {
  const head = (tabla: string) =>
    (supabase as any).from(tabla).select('id', { count: 'exact', head: true }).eq('id_pago', idPago);

  const [apl, val, cep, fac] = await Promise.all([
    head('aplicaciones_pago'),
    head('pago_validaciones'),
    head('cep_audit_log'),
    head('facturas_mantenimientos'),
  ]);

  return {
    aplicaciones: apl.count ?? 0,
    validaciones: val.count ?? 0,
    cep: cep.count ?? 0,
    facturas: fac.count ?? 0,
  };
}

function plural(n: number, sing: string, plu: string): string {
  return `${n} ${n === 1 ? sing : plu}`;
}

// Frase legible con SOLO los registros asociados que se borrarán (omite los que están
// en cero). Ej: "1 aplicación de pago", "2 validaciones y 1 factura de mantenimiento".
// Devuelve null si no hay nada asociado.
export function describeImpacto(impacto: PagoImpacto | null): string | null {
  if (!impacto) return null;
  const parts: string[] = [];
  if (impacto.aplicaciones > 0) parts.push(plural(impacto.aplicaciones, 'aplicación de pago', 'aplicaciones de pago'));
  if (impacto.validaciones > 0) parts.push(plural(impacto.validaciones, 'validación', 'validaciones'));
  if (impacto.cep > 0) parts.push(plural(impacto.cep, 'registro CEP', 'registros CEP'));
  if (impacto.facturas > 0) parts.push(plural(impacto.facturas, 'factura de mantenimiento', 'facturas de mantenimiento'));
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

// Cláusula lista para concatenar a la descripción del diálogo. Incluye los registros
// asociados (si los hay) y siempre cierra recordando que la acción es definitiva.
export function impactoClause(impacto: PagoImpacto | null): string {
  if (impacto === null) return ' Revisando registros asociados…';
  const desc = describeImpacto(impacto);
  const asociados = desc ? ` Junto con él se eliminará ${desc}.` : '';
  return `${asociados} Esta acción no se puede deshacer.`;
}

// Advertencia (caja destacada) del diálogo. Solo se muestra cuando hay algo que amerita
// una alerta real: una factura de mantenimiento ligada. En el resto de casos no hay caja.
export function impactoWarning(impacto: PagoImpacto | null): string | undefined {
  if (impacto && impacto.facturas > 0) {
    const n = impacto.facturas;
    return n === 1
      ? 'Este pago tiene una factura de mantenimiento ligada que también se eliminará.'
      : `Este pago tiene ${n} facturas de mantenimiento ligadas que también se eliminarán.`;
  }
  return undefined;
}

// true si el RPC aún no está desplegado en la BD (graceful fallback).
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    /could not find the function|function .* does not exist/i.test(error.message ?? '')
  );
}

export function useEliminarPago() {
  const [isDeleting, setIsDeleting] = useState(false);

  const eliminarPago = useCallback(async (idPago: number) => {
    setIsDeleting(true);
    try {
      const { data, error } = await (supabase as any).rpc('eliminar_pago', { p_id_pago: idPago });
      if (error) {
        if (isMissingFunction(error)) {
          throw new Error(
            'La función de eliminación de pagos aún no está desplegada en la base de datos. Contacta al administrador.',
          );
        }
        throw new Error(error.message || 'No se pudo eliminar el pago.');
      }
      return data;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { eliminarPago, isDeleting };
}
