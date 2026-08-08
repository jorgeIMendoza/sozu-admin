import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useImpersonationViewMode } from '@/contexts/ImpersonationViewModeContext';
import { evaluateViewRules, isPathHidden, readOnlyNote, viewRuleRegistry } from '@/lib/impersonation/rules';
import type { ImpersonationTarget, ViewRestrictions } from '@/lib/impersonation/types';
// Carga el registro completo antes de evaluar. Import con efecto: cada archivo
// de `rules/` se registra a sí mismo.
import '@/lib/impersonation/rules/index';

interface Input {
  /** Usuario impersonado en este portal, o null. */
  target: ImpersonationTarget | null;
  /** ¿El usuario ve el portal completo? Lo resuelve cada portal con el núcleo. */
  fullAccess: boolean;
  /** Datos que declaró necesitar cada regla, indexados por `rule.id`. */
  facts?: Record<string, unknown>;
}

export interface ViewRestrictionsApi {
  restrictions: ViewRestrictions;
  /** ¿Esta ruta se oculta del menú? */
  isHidden: (path: string) => boolean;
  /** Nota de quién administra ese campo/bloque, o null si es editable. */
  readOnlyNote: (key: string) => string | null;
}

/**
 * Recortes de vista que aplican al usuario que se está viendo.
 *
 * Corre las reglas registradas (`lib/impersonation/rules/`) contra la ruta
 * actual. Las reglas fuera de `scope` no se evalúan, así que sale barato en los
 * portales que todavía no tienen ninguna.
 *
 * Los portales NO escriben aquí sus condiciones: escriben una regla. Este hook
 * está cerrado a modificación.
 */
export function useViewRestrictions({ target, fullAccess, facts }: Input): ViewRestrictionsApi {
  const { pathname } = useLocation();
  const { viewMode } = useImpersonationViewMode();

  const restrictions = useMemo(
    () =>
      evaluateViewRules(
        viewRuleRegistry.list(),
        { pathname, viewMode, isImpersonating: !!target?.email, fullAccess, target, facts: undefined },
        facts ?? {}
      ),
    [pathname, viewMode, target, fullAccess, facts]
  );

  return {
    restrictions,
    isHidden: (path: string) => isPathHidden(restrictions, path),
    readOnlyNote: (key: string) => readOnlyNote(restrictions, key),
  };
}
