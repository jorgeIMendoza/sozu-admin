import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  crearExpedienteYBloquearCobranza,
  CrearExpedienteYBloquearCobranzaInput,
  CrearExpedienteYBloquearCobranzaResult,
} from '../services/crearExpedienteYBloquearCobranza';
import { JURIDICO_QUERY_KEYS } from './useRegistrarActuacion';

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCrearExpedienteYBloquearCobranza() {
  const qc = useQueryClient();

  return useMutation<
    CrearExpedienteYBloquearCobranzaResult,
    Error,
    CrearExpedienteYBloquearCobranzaInput
  >({
    mutationFn: (input) => crearExpedienteYBloquearCobranza(input),
    onSuccess: (_result, variables) => {
      // Dashboard jurídico: nuevo expediente/asunto altera KPIs y distribuciones
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.dashboard() });

      // Bandeja combinada: el nuevo expediente Fase 2 debe aparecer sin refrescar manual
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.asuntosActivos() });

      // La propiedad quedó bloqueada (id_estatus_disponibilidad=11) — refrescar
      // cualquier vista de cobranza que dependa de ese estatus.
      qc.invalidateQueries({ queryKey: ['propiedades'] });
      qc.invalidateQueries({ queryKey: ['cuenta_detalle', String(variables.idCuentaCobranza)] });
    },
  });
}
