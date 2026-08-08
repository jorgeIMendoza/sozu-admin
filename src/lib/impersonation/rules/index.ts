/**
 * Punto único de carga de reglas. Importar aquí el archivo de cada regla nueva:
 * es la ÚNICA línea que se agrega al migrar un portal, y garantiza que el
 * registro esté completo antes de que cualquier hook lo consulte.
 */
import './agente-dependiente';

export { agenteDependienteRule, AGENTE_DEPENDIENTE_RULE_ID } from './agente-dependiente';
export type { AgenteDependienteFacts } from './agente-dependiente';
