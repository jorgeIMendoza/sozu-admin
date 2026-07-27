import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cambiarEtapaAsunto,
  CambiarEtapaAsuntoInput,
  CambiarEtapaAsuntoResult,
} from '../services/cambiarEtapaAsunto';
import { JURIDICO_QUERY_KEYS } from './useRegistrarActuacion';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCambiarEtapaAsunto() {
  const qc = useQueryClient();

  return useMutation<CambiarEtapaAsuntoResult, Error, CambiarEtapaAsuntoInput>({
    mutationFn: (input) => cambiarEtapaAsunto(input),
    onSuccess: (_result, variables) => {
      const idAsunto = String(variables.idAsunto);

      // Detalle del asunto: id_etapa_actual cambió
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.asunto(idAsunto) });

      // Timeline: nueva actuación CAMBIO_ETAPA creada
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.actuaciones(idAsunto) });

      // Dashboard: distribución por etapa puede variar
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.dashboard() });

      // Bandeja combinada: el nombre de etapa mostrado en la tabla cambió
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.asuntosActivos() });
    },
  });
}
