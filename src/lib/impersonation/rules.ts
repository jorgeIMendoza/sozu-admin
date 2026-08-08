import type { ViewRestrictions, ViewRule, ViewRuleContext } from './types';

/**
 * Registro de reglas de vista. Abierto a extensión, cerrado a modificación:
 * una regla nueva es un archivo nuevo que se registra a sí mismo; este archivo
 * no cambia nunca.
 *
 * Es un registro explícito (no un singleton escondido) para poder instanciarlo
 * en los tests sin contaminar el global.
 */

export interface ViewRuleRegistry {
  register: (rule: ViewRule<any>) => void;
  list: () => ViewRule<any>[];
  clear: () => void;
}

export function createViewRuleRegistry(initial: ViewRule<any>[] = []): ViewRuleRegistry {
  const rules = new Map<string, ViewRule<any>>();
  initial.forEach((r) => rules.set(r.id, r));
  return {
    // Registrar dos veces el mismo id (hot reload, doble import) reemplaza,
    // no duplica.
    register: (rule) => { rules.set(rule.id, rule); },
    list: () => [...rules.values()],
    clear: () => rules.clear(),
  };
}

/** Registro global de la app. Los archivos de `rules/` se registran aquí. */
export const viewRuleRegistry = createViewRuleRegistry();

export const EMPTY_RESTRICTIONS: ViewRestrictions = { hiddenPaths: [], readOnly: {} };

/** ¿La regla aplica en esta ruta? Sin `scope` es global. */
export function ruleMatchesScope(rule: ViewRule<any>, pathname: string): boolean {
  if (!rule.scope) return true;
  return pathname.startsWith(rule.scope);
}

/**
 * Corre las reglas y funde sus recortes. Una regla que devuelve `null` no aplica.
 * Las notas de solo lectura se funden por clave: gana la primera que la declare,
 * para que una regla nueva no pise el texto de otra sin querer.
 */
export function evaluateViewRules(
  rules: ViewRule<any>[],
  ctx: ViewRuleContext<any>,
  factsByRule: Record<string, unknown> = {}
): ViewRestrictions {
  const hiddenPaths = new Set<string>();
  const readOnly: Record<string, string> = {};

  for (const rule of rules) {
    if (!ruleMatchesScope(rule, ctx.pathname)) continue;
    const result = rule.evaluate({ ...ctx, facts: factsByRule[rule.id] });
    if (!result) continue;
    (result.hiddenPaths ?? []).forEach((p) => hiddenPaths.add(p));
    Object.entries(result.readOnly ?? {}).forEach(([key, nota]) => {
      if (!(key in readOnly)) readOnly[key] = nota;
    });
  }

  return { hiddenPaths: [...hiddenPaths], readOnly };
}

/** Helpers de consumo, para no repetir la misma lógica en cada portal. */
export function isPathHidden(restrictions: ViewRestrictions, path: string): boolean {
  return restrictions.hiddenPaths.includes(path);
}

export function readOnlyNote(restrictions: ViewRestrictions, key: string): string | null {
  return restrictions.readOnly[key] ?? null;
}
