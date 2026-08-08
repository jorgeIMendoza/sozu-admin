import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentImpersonation } from "@/contexts/AgentImpersonationContext";

/**
 * Devuelve true si el agente pertenece a una inmobiliaria (agente DEPENDIENTE).
 *
 * TODOS los agentes tienen una fila en `entidades_relacionadas` con
 * `id_tipo_entidad = 19`; el discriminador real es `id_persona_duena_lead`:
 *   - NO nulo  → apunta a la persona de la inmobiliaria → DEPENDIENTE (true)
 *   - nulo     → agente INDEPENDIENTE (false)
 * Sin el predicado `id_persona_duena_lead not null` esto daría true para todos.
 */
export function useAgentHasInmobiliaria() {
  const { profile } = useAuth();
  const { isImpersonating, impersonatedAgentPersonaId } = useAgentImpersonation();
  // Persona EFECTIVA: al impersonar, la del usuario que se está revisando. Así el
  // discriminador describe a quien se ve en pantalla, no al admin. En "Vista
  // completa" da igual: `useAgentPortalFullAccess` desactiva los recortes.
  const personaId = isImpersonating ? impersonatedAgentPersonaId : profile?.id_persona;

  const { data: hasInmobiliaria = false, isLoading } = useQuery({
    queryKey: ["agent-has-inmobiliaria", personaId],
    queryFn: async () => {
      if (!personaId) return false;
      const { data } = await (supabase as any)
        .from("entidades_relacionadas")
        .select("id")
        .eq("id_persona", personaId)
        .eq("id_tipo_entidad", 19)
        .eq("activo", true)
        .not("id_persona_duena_lead", "is", null)
        .limit(1);
      return (data && data.length > 0) || false;
    },
    enabled: !!personaId,
    staleTime: 5 * 60_000,
  });

  return { hasInmobiliaria, isLoading };
}
