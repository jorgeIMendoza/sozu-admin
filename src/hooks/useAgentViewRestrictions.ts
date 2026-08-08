import { useMemo } from 'react';
import { useAgentImpersonation } from '@/contexts/AgentImpersonationContext';
import { useAgentHasInmobiliaria } from '@/hooks/useAgentHasInmobiliaria';
import { useAgentPortalFullAccess } from '@/hooks/useAgentPortalFullAccess';
import { useViewRestrictions, type ViewRestrictionsApi } from '@/hooks/useViewRestrictions';
import { AGENTE_DEPENDIENTE_RULE_ID } from '@/lib/impersonation/rules/agente-dependiente';

interface Options {
  /** Nombre de la inmobiliaria dueña, si la página ya lo consultó. Solo cambia
   *  el texto de las notas, nunca qué se oculta. */
  inmobiliariaNombre?: string | null;
}

interface Result extends ViewRestrictionsApi {
  /** ER tipo 19 con `id_persona_duena_lead` → agente dependiente. */
  hasInmobiliaria: boolean;
  /** Mientras carga no se recorta nada: evita el parpadeo de tabs. */
  isLoading: boolean;
  fullAccess: boolean;
}

/**
 * Cableado del Portal Agente al registro de reglas: junta el impersonado, el
 * acceso completo y los datos que pide la regla `agente-dependiente`.
 *
 * La condición ("si es dependiente, oculta Comisiones y bloquea fiscal") NO vive
 * aquí: vive en la regla, que está cubierta por tests.
 */
export function useAgentViewRestrictions({ inmobiliariaNombre }: Options = {}): Result {
  const { impersonatedAgentEmail, impersonatedAgentPersonaId, impersonatedAgentName, impersonatedAgentRolId } =
    useAgentImpersonation();
  const { hasInmobiliaria, isLoading } = useAgentHasInmobiliaria();
  const fullAccess = useAgentPortalFullAccess();

  const target = useMemo(
    () =>
      impersonatedAgentEmail
        ? {
            email: impersonatedAgentEmail,
            personaId: impersonatedAgentPersonaId,
            nombre: impersonatedAgentName,
            rolId: impersonatedAgentRolId,
          }
        : null,
    [impersonatedAgentEmail, impersonatedAgentPersonaId, impersonatedAgentName, impersonatedAgentRolId]
  );

  const facts = useMemo(
    () => ({
      // Con la consulta en vuelo se manda `hasInmobiliaria: false`: la regla no
      // recorta y el menú no parpadea. `isLoading` deja que la página espere.
      [AGENTE_DEPENDIENTE_RULE_ID]: { hasInmobiliaria: isLoading ? false : hasInmobiliaria, inmobiliariaNombre },
    }),
    [hasInmobiliaria, isLoading, inmobiliariaNombre]
  );

  const api = useViewRestrictions({ target, fullAccess, facts });

  return { ...api, hasInmobiliaria, isLoading, fullAccess };
}
