import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  crearExpediente,
  CrearExpedienteInput,
  CrearExpedienteResult,
} from '../services/crearExpediente';
import { JURIDICO_QUERY_KEYS } from './useRegistrarActuacion';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCrearExpediente() {
  const qc = useQueryClient();

  return useMutation<CrearExpedienteResult, Error, CrearExpedienteInput>({
    mutationFn: (input) => crearExpediente(input),
    onSuccess: () => {
      // Dashboard jurídico: nuevo expediente/asunto altera KPIs y distribuciones
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.dashboard() });
    },
  });
}
