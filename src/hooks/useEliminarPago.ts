import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Eliminación de pagos = SOFT DELETE. Un pago es un registro contable: no se borra
// físicamente. El RPC transaccional `eliminar_pago` marca pagos.activo=false (+ auditoría
// quién/cuándo/motivo) y desactiva sus aplicaciones_pago (activo=false), lo que dispara
// el recálculo de pago_completado y la reversión de estatus de la propiedad. El historial
// (validaciones, CEP) se conserva. Si el pago tiene factura de mantenimiento timbrada, el
// RPC BLOQUEA la eliminación (hay que cancelar el CFDI primero).
// Ver Ejecuciones_manuales/P29_cobranza_eliminar_pago_rpc.md.

export interface PagoImpacto {
  aplicaciones: number; // abonos que dejarán de aplicarse
  facturas: number;     // facturas de mantenimiento ligadas → bloquean el borrado
  esStp: boolean;       // pago con método "STP" (automático) → NUNCA se puede eliminar
}

// Cuenta lo relevante para el diálogo: abonos activos + facturas de mantenimiento + si es STP.
// Regla: solo el método exacto "STP" bloquea; "STP-manual" y el resto sí se pueden eliminar.
export async function fetchPagoImpacto(idPago: number): Promise<PagoImpacto> {
  const [apl, fac, pagoRes] = await Promise.all([
    (supabase as any).from('aplicaciones_pago')
      .select('id', { count: 'exact', head: true }).eq('id_pago', idPago).eq('activo', true),
    (supabase as any).from('facturas_mantenimientos')
      .select('id', { count: 'exact', head: true }).eq('id_pago', idPago),
    (supabase as any).from('pagos')
      .select('metodos_pago(nombre)').eq('id', idPago).maybeSingle(),
  ]);
  return {
    aplicaciones: apl.count ?? 0,
    facturas: fac.count ?? 0,
    esStp: pagoRes?.data?.metodos_pago?.nombre === 'STP',
  };
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

  const eliminarPago = useCallback(async (idPago: number, motivo: string) => {
    setIsDeleting(true);
    try {
      const { data, error } = await (supabase as any).rpc('eliminar_pago', {
        p_id_pago: idPago,
        p_motivo: motivo?.trim() || null,
      });
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
