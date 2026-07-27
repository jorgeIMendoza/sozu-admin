export type EstadoExpediente = 'ACTIVO' | 'CERRADO' | 'ARCHIVADO';

/**
 * Fila de la bandeja combinada (Legacy + Fase 2) para expedientes/asuntos activos
 * creados vía T3 (crear_expediente) / el orquestador. Un expediente ACTIVO puede
 * tener más de un asunto — cada asunto activo produce una fila propia.
 */
export interface AsuntoActivoRow {
  idExpediente: string;
  idAsunto: string;
  idPropiedad: string;
  idProyecto: number;
  proyectoNombre: string;
  propiedadCodigo: string;
  folioExpediente: string;
  folioAsunto: string;
  estadoExpediente: EstadoExpediente;
  idTipoAsunto: string;
  tipoAsuntoNombre: string;
  /** BIGINT como string; null hasta que T2 cambiar_etapa_asunto la asigne. */
  idEtapaActual: string | null;
  etapaActualNombre: string | null;
  etapaEsTerminal: boolean;
  /** Usado para calcular "días restantes" — nulo hasta que se capture explícitamente. */
  fechaLimiteContestacion: string | null;
  fechaApertura: string | null;
}
