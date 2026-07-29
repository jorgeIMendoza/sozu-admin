import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  crearAsunto,
  CrearAsuntoInput,
  CrearAsuntoResult,
} from '../services/crearAsunto';
import { JURIDICO_QUERY_KEYS } from './useRegistrarActuacion';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCrearAsunto() {
  const qc = useQueryClient();

  return useMutation<CrearAsuntoResult, Error, CrearAsuntoInput>({
    mutationFn: (input) => crearAsunto(input),
    onSuccess: () => {
      // Bandeja combinada: el expediente ahora tiene un asunto más — debe verse en el
      // selector de asuntos de la fila sin refrescar manual.
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.asuntosActivos() });

      // Dashboard jurídico: nuevo asunto altera KPIs y distribuciones.
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.dashboard() });

      // A diferencia de useCrearExpedienteYBloquearCobranza, NO se invalida
      // ['propiedades'] ni ['cuenta_detalle', ...] — crear_asunto no toca el bloqueo
      // institucional ni la cuenta de cobranza (ya quedaron fijados por el primer asunto).
    },
  });
}
