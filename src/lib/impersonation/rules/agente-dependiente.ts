import { viewRuleRegistry } from '../rules';
import type { ViewRule } from '../types';

/**
 * Recorte del agente DEPENDIENTE de una inmobiliaria (portal agente).
 *
 * Reproduce, tal cual, lo que hoy vive disperso en el portal:
 *   - `AgentPortalLayout`: se oculta el tab Comisiones (su comisión la cobra la
 *     inmobiliaria, no él).
 *   - `AgentPerfil`: Información fiscal, Cuenta bancaria y CSF en solo lectura;
 *     la Carta de comercialización no aplica (es del agente independiente).
 *
 * Ejemplo de extensión: una regla nueva es un archivo como este + su import en
 * `rules/index.ts`. No se toca el núcleo.
 */

export interface AgenteDependienteFacts {
  /** ER tipo 19 con `id_persona_duena_lead` no nulo → dependiente. */
  hasInmobiliaria: boolean;
  /** Nombre de la inmobiliaria dueña, para la nota de solo lectura. */
  inmobiliariaNombre?: string | null;
}

export const AGENTE_DEPENDIENTE_RULE_ID = 'agente-dependiente';

export const agenteDependienteRule: ViewRule<AgenteDependienteFacts> = {
  id: AGENTE_DEPENDIENTE_RULE_ID,
  scope: '/admin/agent',
  evaluate: ({ facts, fullAccess }) => {
    // `fullAccess` ya trae la lógica de Super Admin / puede_impersonar y de la
    // vista fiel: si es true, el recorte no aplica (modo soporte).
    if (!facts?.hasInmobiliaria || fullAccess) return null;

    const nota = facts.inmobiliariaNombre
      ? `La administra ${facts.inmobiliariaNombre}`
      : 'La administra tu inmobiliaria';

    return {
      hiddenPaths: ['/admin/agent/comisiones'],
      readOnly: {
        csf: facts.inmobiliariaNombre ? `La sube ${facts.inmobiliariaNombre}` : 'La sube tu inmobiliaria',
        fiscal: nota,
        banco: nota,
        carta: 'Solo aplica al agente independiente',
      },
    };
  },
};

viewRuleRegistry.register(agenteDependienteRule);
