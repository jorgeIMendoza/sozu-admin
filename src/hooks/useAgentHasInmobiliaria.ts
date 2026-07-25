import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const personaId = profile?.id_persona;

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
