import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  registrarActuacion,
  RegistrarActuacionInput,
  RegistrarActuacionResult,
} from '../services/registrarActuacion';

// ── Query keys del módulo jurídico Fase 2 ─────────────────────────────────────
// Fuente autoritativa: todas las invalidaciones del módulo deben usar estas claves.

export const JURIDICO_QUERY_KEYS = {
  /** Detalle completo de un asunto (metadatos + etapa actual). */
  asunto: (idAsunto: string) => ['juridico-asunto', idAsunto] as const,
  /** Timeline de actuaciones procesales de un asunto. */
  actuaciones: (idAsunto: string) => ['juridico-actuaciones', idAsunto] as const,
  /** Dashboard agregado (Q1 — pendiente de implementación). */
  dashboard: () => ['juridico-dashboard'] as const,
  /** Expedientes/asuntos ACTIVOS Fase 2 — alimenta la bandeja combinada Legacy+Fase2. */
  asuntosActivos: () => ['juridico-asuntos-activos'] as const,
  /** Catálogo cat_tipos_asunto — usado por el formulario de creación de expediente. */
  catTiposAsunto: () => ['juridico-cat-tipos-asunto'] as const,
  /** Catálogo cat_etapas_procesales filtrado por tipo de asunto. */
  catEtapas: (idTipoAsunto: string) => ['juridico-cat-etapas', idTipoAsunto] as const,
} as const;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useRegistrarActuacion() {
  const qc = useQueryClient();

  return useMutation<RegistrarActuacionResult, Error, RegistrarActuacionInput>({
    mutationFn: (input) => registrarActuacion(input),
    onSuccess: (_result, variables) => {
      const idAsunto = String(variables.idAsunto);

      // Detalle del asunto: etapa_al_momento puede reflejarse aquí
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.asunto(idAsunto) });

      // Timeline de actuaciones del asunto: la nueva actuación debe aparecer
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.actuaciones(idAsunto) });

      // Dashboard jurídico: solo si hay métricas que dependen de actuaciones
      // No invalidar el grid completo — scope acotado al dashboard agregado
      qc.invalidateQueries({ queryKey: JURIDICO_QUERY_KEYS.dashboard() });
    },
  });
}
